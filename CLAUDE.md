# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a small multi-type expression language with a lexer, parser, interpreter, optimizer and code generator, built to evaluate untrusted formulas. [LANGUAGE.md](./LANGUAGE.md) is the language reference, and [README.md](./README.md) documents the API.

- **Seven types**: `number`, `string`, `boolean`, date, time, datetime (`Temporal.Plain*`), and homogeneous arrays
- **No implicit coercion**, and `!`, `&&`, `||` and `if` require booleans
- **Bounded**: every evaluation spends from a step budget, which bounds its time and memory
- **100% ESM**, no Node.js APIs. Needs a global `Temporal`; `temporal-spec` is a types-only dependency

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
bun run --cwd packages/littlewing test test/time.test.ts  # One test file

# Playground
bun run --cwd packages/playground dev      # Start the Vite dev server
```

Releases follow [AGENTS.md](./AGENTS.md).

### Running anything memory-hungry

Stress tests, mutation runs and fuzzers exercise the very limits that protect a machine, so a bug in them can consume all its memory. `timeout` does not bound memory. Run these under a hard cap, such as `systemd-run --user --scope -p MemoryMax=3G -p MemorySwapMax=0 ...`. Tests of a limit must stay small in absolute terms if the limit is broken: use a small budget, as the hostile programs in `test/evaluation.test.ts` do.

## Architecture

```
source → lexer → parser → AST → interpreter → value
                           ├──→ optimizer → AST
                           └──→ codegen → source
```

All of it lives in `packages/littlewing/src`:

| File               | Role                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| `lexer.ts`         | Tokens, comments, and whether a line break precedes each token              |
| `parser.ts`        | Pratt parser; statement separation, depth limits, spans, comment attachment |
| `ast.ts`           | Node types, guards, builders, `visit`, `forEachChild`, `mapChildren`        |
| `interpreter.ts`   | Compiles the AST to closures and runs them; errors, `evaluate*`             |
| `limits.ts`        | The step budget, and which functions are trusted                            |
| `optimizer.ts`     | Constant folding and propagation, dead code elimination                     |
| `codegen.ts`       | AST back to source, with parentheses from precedence                        |
| `analyzer.ts`      | `extractInputVariables`, `extractAssignedVariables`                         |
| `utils.ts`         | Operators, equality, type assertions, array shapes, precedence, ranges      |
| `errors.ts`        | `ParseError`, `EvaluationError`, `toLineColumn`                             |
| `stdlib/*.ts`      | The 82 built-in functions, one module per family                            |
| `stdlib/search.ts` | Substring search that stays linear and respects code points                 |

`packages/playground` is a private Vite app that consumes the library from source.

### Grammar

- Precedence, loosest to tightest: assignment, pipe, `||`, `&&`, comparison, range, additive, multiplicative, unary, `^`, postfix indexing. Unary operators parse their operand at the `^` level, so `-2 ^ 2` is `-(2 ^ 2)` but `-2 * 3` is `(-2) * 3`.
- `;` is a token, and statements need a `;` or a line break between them. A line starting with `-`, `(` or `[` starts a new statement, unless enclosed by brackets or a keyword pair. The parser tracks that in `state.enclosed`, and the cursor tracks `newlineBefore`.
- `if` and `for` are prefix expressions with open-ended tails that absorb anything after them, which is why codegen has to know whether a position is a tail.
- `else if` chains are parsed in a loop. Nesting is limited to `MAX_NESTING` and AST height to `MAX_HEIGHT`, which every recursive pass relies on staying within the call stack.
- `?` is only valid directly as a pipe argument, and a pipe step needs at least one.

### The budget

`limits.ts` holds the steps remaining in a module-level variable, because work is charged wherever it happens. Evaluation is synchronous, and `run` saves and restores the budget, so only a nested `evaluate` can interleave.

The rule is that **anything a program can make take time or memory has to charge for it, before doing it where the size is known**:

- Every compiled node spends a `step`, and arrays and dates cost extra because they weigh more.
- Reading a string natively pays `chargeRead`, as the first read flattens a lazily concatenated string.
- The `assert*` helpers charge for reading their argument, so most stdlib functions are metered by their first line.
- `assertReadable` rejects results whose logical size exceeds the budget, because aliasing makes a value exponentially larger than the work that built it.
- Never hash program-controlled data: engines hash integers without a seed and long strings by length alone. `ARR_UNIQUE` sorts instead.
- Never use a regular expression that can backtrack, or a native search with a long pattern.

Functions in `defaultContext` are trusted: they skip the charge for their arguments and the check on their result, so `LEN` is free on arrays. The public namespaces (`core.LEN`) hold bound copies, which count as host functions everywhere, bundled or not. A bound call costs about 15%, so the trusted table keeps the originals. Host functions are charged for the logical size of their arguments, and their results are validated.

Check the costs with `stepsOf` in `test/helpers.ts`, which finds the exact number of steps a program takes. A test that merely expects a limit error usually passes for the wrong reason.

### Evaluation

`compile` turns each node into a closure, so evaluating it skips the dispatch on its kind, and variables are numbered into slots at compile time. An AST is compiled once and cached in a `WeakMap`; a string is compiled afresh, as nothing can reuse it. An AST from the host can share nodes, so its compilation is memoized by node. What a string parses to cannot, and skips that. The closures for `+`, `-` and `*` are separate on purpose: merging them was measured at four times slower on loops. A call site caches the function it resolved for one evaluation, keyed by `frame.id`. One- and two-argument calls have their own paths for the same reason as the arithmetic.

`step` runs for every node, so everything on that path is measured. Change it with the profiler open: `node --cpu-prof`, and the inspector's `HeapProfiler.startSampling` with `includeObjectsCollectedByMinorGC` for allocation, since `--heap-prof` only shows what survives.

### Optimizer contract

The result evaluates exactly like the original: to the same value or the same failure, with the same function calls. So nothing that may fail is removed, and a fold that fails leaves the expression in place.

One forward pass folds and propagates together, so a constant only reaches statements after its assignment. Dead code elimination then walks backwards. `externalVariables` enables propagation, and names what the host may supply. `preserveScope` keeps every assignment.

Long strings are not propagated, and a variable stays in `s[i]` when the index does not fold, because the interpreter caches a split string by variable slot.

### Types and contracts

- `RuntimeValue` (`types.ts`) uses `PlainDate`, `PlainTime` and `PlainDateTime`, which resolve to the global `Temporal` types where a project has them and to `temporal-spec` otherwise. Public signatures must use those aliases. The source gets its global `Temporal` from tsconfig `types`, and the published types must not depend on one.
- Runtime failures are `EvaluationError`s with `start`, `end` and the original `cause`. `frame.current` is the node to blame. It is only set where something can fail, and has to be set again after evaluating children.
- Parsed nodes carry `start` and `end`. Builders take them as optional trailing arguments, so every node of a kind has one shape.
- `forEachChild` and `mapChildren` cover generic traversal. Prefer them to a new switch over every kind. `mapChildren` keeps spans and comments and returns the same node if nothing changed.

## Key Development Notes

- Strict TypeScript with `isolatedDeclarations`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
- Imports in `src` use explicit `.js` specifiers, as the output is one module per source file for `tsc` to emit unchanged. That per-module `dist` is what lets bundlers tree-shake.
- oxlint for linting, oxfmt for formatting, tabs for indentation, single quotes in source.

### Testing

Tests use Bun's test runner, in `packages/littlewing/test`.

- `generators.ts` builds random ASTs and programs. `roundtrip.test.ts` and `optimizer-contract.test.ts` hold the properties that matter most: any AST survives `generate` and `parse`, and an optimized program behaves like the original.
- `evaluation.test.ts` covers errors, host values, budgets and hostile programs. `stdlib.test.ts` covers function behaviour and exact costs. `grammar.test.ts` covers statements, numbers, depth and spans.
- `consumer/` is a strict TypeScript consumer of the built package, and a smoke test on Node, whose engine differs from Bun's in ways that have hidden bugs.

### Common tasks

**Adding a stdlib function:** implement it in the right `stdlib/*.ts` module with an UPPERCASE name. Use the `assert*` helpers, charge for any work they do not cover, and return a valid `RuntimeValue`, as nothing checks it. Add behaviour and cost tests to `stdlib.test.ts`, metadata to the playground's `function-metadata.ts`, and a row to LANGUAGE.md.

**Adding an AST node:** add the `NodeKind`, interface, guard and builder in `ast.ts`, extend `ASTNode`, `Visitor`, `visit`, `forEachChild` and `mapChildren`, then handle it in the interpreter, `collectFreeIdentifiers` if it binds names, codegen's `precedenceOf` and `emitBare`, the optimizer if it can fold, and the parser. Add it to `randomAst`, so the round trip tests reach it.

**Adding a binary operator:** add the token in `lexer.ts`, its precedence in `getTokenPrecedence` and `getOperatorPrecedence`, the `Operator` type, and the operation in `evaluateBinaryOperation`, charged for what it costs.
