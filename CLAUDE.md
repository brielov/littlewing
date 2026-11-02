# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a small typed language for the formulas users write, built to run untrusted programs. [SPEC.md](./SPEC.md) defines the language and [HOST_API.md](./HOST_API.md) the host API, normatively. [LANGUAGE.md](./LANGUAGE.md) is a guide for formula authors, and [README.md](./README.md) introduces it.

- **Types**: `number`, a 34-digit decimal; `string`; `boolean`; arrays; records; and abstract types a host defines
- **Inferred and checked**: every program is type checked before it runs, and there is one route to execution, `compile`
- **Bounded**: compiling and evaluating each spend from a step budget, which bounds time and memory
- **100% ESM**, with no Node.js APIs. Only `littlewing/temporal` and `littlewing/clock` need a global `Temporal`

## Development Commands

```bash
# From the repo root
bun run build           # Build the library and the playground
bun run test            # Run all library tests
bun run test:package    # Check the built package: consumer types, then a Node smoke test
bun run lint            # Lint with type checking
bun run lint:fix        # Auto-fix lint issues
bun run fmt             # Format all files
bun run fmt:check       # Check formatting

# Library
bun run --cwd packages/littlewing dev            # Rebuild on change
bun run --cwd packages/littlewing test:watch     # Tests in watch mode
bun run --cwd packages/littlewing test:coverage  # Coverage report
bun run --cwd packages/littlewing test test/run.test.ts   # One test file
FUZZ_ROUNDS=300000 bun run --cwd packages/littlewing test test/fuzz.test.ts  # A deep fuzz run

# Playground
bun run --cwd packages/playground dev      # Start the Vite dev server
```

Releases follow [AGENTS.md](./AGENTS.md).

### Running anything memory-hungry

Stress tests, mutation runs and fuzzers exercise the very limits that protect a machine, so a bug in them can consume all its memory. `timeout` does not bound memory. Run these under a hard cap, such as `systemd-run --user --scope -p MemoryMax=3G -p MemorySwapMax=0 ...`. Tests of a limit must stay small in absolute terms if the limit is broken: use a small budget, as the programs in `test/run-hostile.test.ts` do.

## Architecture

```
source -> lex -> parse -> desugar -> check -> optimize -> evaluate
```

Every stage always runs. `compile` does everything up to `evaluate`, and `optimize` is not a stage of its own: folding happens as the closures are built. All of it lives in `packages/littlewing/src`:

| File                 | Role                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `syntax/lexer.ts`    | Tokens, comments, and whether a line break precedes each token           |
| `syntax/parser.ts`   | Pratt parser with recovery, so that one run reports every syntax error   |
| `syntax/ast.ts`      | The syntax tree, of plain objects with a string `kind`                   |
| `syntax/desugar.ts`  | Pipes and interpolation become calls, keeping their spans                |
| `syntax/generate.ts` | The tree back to source                                                  |
| `check/solver.ts`    | Unification, classes, rows, and everything that waits for a type         |
| `check/check.ts`     | Walks a program, gathers its constraints, and solves them                |
| `check/schema.ts`    | The inferred types, written out as `program.inputs` and `program.output` |
| `run/interpret.ts`   | Compiles to closures, and folds constants on the way                     |
| `run/operations.ts`  | What a program does at run time beyond arithmetic, without the compiler  |
| `run/boundary.ts`    | `Reader` and `Writer`: everything that crosses between host and program  |
| `compile.ts`         | `compile`, `evaluate`, `run`, and nested budgets                         |
| `define.ts`          | `t`, `define`, `defineType`, `once`, and the library's `defineNative`    |
| `functions/core.ts`  | The 18 core functions                                                    |
| `std.ts`             | `littlewing/std`                                                         |
| `temporal.ts`        | `littlewing/temporal`, which is ordinary `define` and `defineType`       |
| `clock.ts`           | `littlewing/clock`                                                       |
| `number.ts`          | Decimal arithmetic on `Num`, a safe integer or a `Dec`                   |
| `decimal.ts`         | `Decimal`, the public face of a `Num`                                    |
| `limits.ts`          | The step budget                                                          |

`packages/playground` is a private Vite app that consumes the library from source.

### The spec comes first

`SPEC.md` and `HOST_API.md` override the code, and `V3_PLAN.md`. Change a spec and its conformance cases before the behaviour, and never fit a conformance case to what the code does: expected values come from the spec.

### The budget

`limits.ts` holds the steps remaining in a module-level variable, because work is charged wherever it happens. Evaluation is synchronous, and `withBudget` in `compile.ts` saves and restores it, so only a nested `compile` or `evaluate` from host code can interleave. Such a call runs on what is left of the budget around it.

The rule is that **anything a program can make take time or memory has to charge for it, before doing it where the size is known**:

- Every compiled node spends a `step`, with `stepBy` for what costs more, so a limit is blamed on the node that hit it.
- Reading a string natively pays `chargeRead`, or `charge` for a slow scan, as the first read flattens a lazily concatenated string. Bun often does not flatten where Node does, so `bun test` cannot show a missed charge: the smoke test has a rope case for this, and a metering change needs a run on Node.
- `logicalSize` charges for a value's size with shared parts counted every time, as sharing makes a value exponentially larger than the work that built it.
- Never hash program-controlled data: engines hash integers without a seed and long strings by length alone. `UNIQUE` sorts instead.
- Never use a regular expression that can backtrack, or a native search with a long pattern.

Check costs with the exact tables in `test/functions.test.ts` and `test/temporal.test.ts`. A change to them is a change of price, so make it deliberately. A test that merely expects a limit error usually passes for the wrong reason.

### Host code and trust

Everything that crosses the boundary goes through `Reader` or `Writer`, in one pass that follows the type, so a getter or Proxy cannot show the check one value and the program another. Host code only runs inside `hostCall` or `callIs`. A message never holds a host value: what was thrown stays in `cause`.

A function of the library is a `Native`, which takes the language's own values and charges for itself. `defineNative` is not exported from the package, and natives live in a private `WeakMap`, so nothing a host holds can reach them. Its `hooks` list the arguments that can reach an operation of an abstract type, which is what keeps it from folding.

### Evaluation

`Compiler` turns each node into a closure, with variables in slots numbered at compile time. `step` runs for every node, so everything on that path is measured. Change it with the profiler open: `bun --cpu-prof`. The closures for number arithmetic have fast paths for safe integers, each of which has to agree with the exact path, including on negative zero.

A closure shares the scope it is made in, and a method whose arrows use `this` keeps `this` in that scope. So the closures of literals and calls are built by module-level functions, which is what keeps a `Program` from holding on to the compiler. `test/run-hostile.test.ts` holds that with `WeakRef`s.

### Folding

A fold runs the closure of an expression on the values of its children, so it always does what the code would. A failure is a compile error if the expression always runs, and a `may-fail` warning if it may be skipped. Running out of budget only stops folding. A program keeps a value only if it is plain and at most 1024 in logical size, as hosts keep programs a long time.

### Types and contracts

- A type of the language at run time is a `check/types.ts` type. An abstract type at a known position always goes through its hooks, as its values can be strings or numbers. Only a generic position tells values apart by what they are, which the boundary makes safe by refusing a value that is both.
- Offsets are UTF-16 code units. Runtime failures are `EvaluationError`s, and `frame.current` is the node to blame, set before anything that can fail.
- Public types must not depend on a global `Temporal`: use `temporal-spec` types.

## Key Development Notes

- Strict TypeScript with `isolatedDeclarations`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
- Imports in `src` use explicit `.js` specifiers, as the output is one module per source file for `tsc` to emit unchanged. That per-module `dist` is what lets bundlers tree-shake.
- A definition at the top level of `std.ts` or `temporal.ts` needs `/* @__PURE__ */` on every call it makes, arguments included, or bundlers keep it.
- oxlint for linting, oxfmt for formatting, tabs for indentation, single quotes in source.

### Testing

Tests use Bun's test runner, in `packages/littlewing/test`.

- `conformance.test.ts` runs `conformance/*.jsonl`, the plain data that any implementation can test itself against. See its README.
- `fuzz.test.ts` holds the properties that matter most: a fold never changes a value, a failure or a call, no type is ever broken, and any input is turned away or read correctly.
- `check.test.ts` covers inference, and holds that the order of statements does not matter. `syntax.test.ts` covers the front end, with a round trip through `generate`.
- `run.test.ts` covers evaluation and `run-hostile.test.ts` what a hostile host or program can try. `functions.test.ts` and `temporal.test.ts` cover the library and its exact costs.
- `docs.test.ts` checks the result of every formula in README and LANGUAGE and every `ts` block in README, and requires each playground example to compile without diagnostics.
- `consumer/` is a strict TypeScript consumer of the built package, and a smoke test on Node, whose engine differs from Bun's in ways that have hidden bugs.

### Common tasks

**Adding a core function:** spec it in SPEC.md section 10, add conformance cases, then write it in `functions/core.ts` with `defineNative`, a `doc` and named parameters. It charges for what it reads and allocates, and names in `hooks` any argument that can reach an abstract operation. Add it to the step table, and to LANGUAGE.md.

**Adding a function to `std` or `temporal`:** the same, without the spec, and with `/* @__PURE__ */` on every call.

**Changing the syntax:** the syntax froze at v3. New capability arrives through `define` and `defineType`.
