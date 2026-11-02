# v3 Plan

Work remaining before v3 ships. The engine overhaul is done, on the `v3` branch. Everything below builds on it. Nothing here is decided until it is ticked.

## Order

1. [x] Commit the overhaul on `v3`
2. [x] Review the language spec, and settle the decisions in [Language](#language)
   - [x] Write the language spec, `SPEC.md`
   - [x] Write the host API spec, `HOST_API.md`
   - [x] Review the host API spec until the reviewer agrees
3. [ ] Implement, one milestone at a time, each reviewed by an independent agent before the next starts:
   - [x] M0: Dependencies
   - [x] M1: `Decimal`, the number type, including `ln` and `exp` for `^`
   - [x] M2: Lexer, parser, diagnostics with recovery, and `generate`
   - [x] M3: `t`, `define` and `defineType`
   - [x] M4: Desugaring and the checker: inference, classes, records, input schema
   - [x] M5: The optimizer, and the interpreter on typed programs
   - [x] M6: `compile`, `evaluate`, `run`, and crossing the boundary
   - [x] M7: Core functions, `littlewing/std`, `littlewing/temporal`, `littlewing/clock`
   - [x] Swap: delete the old pipeline, export the new API, and port the consumer tests and playground to it, in one commit as the lint hook covers them all
   - [ ] M8: The conformance suite and fuzzing, including solving order
     - Old coverage nothing replaces yet, in git history: the random-program property of `optimizer-contract.test.ts`, that folding preserves value, failure and host calls; `UNIQUE` against a quadratic scan on random arrays, and values that print alike, from `stdlib.test.ts`; order, once-only evaluation and failure spans of pipes with host functions, from `pipe.test.ts`; datetime variants of each date function, from `date-utils`, `time` and `datetime-full`, now with declared `inputs`
   - [ ] M9: Playground, docs and packaging
4. [ ] Release v3.0.0, following AGENTS.md

Hold all of it for one v3 release: with 66 npm downloads in the last month, breaking changes are cheap now. The cost is that v2 keeps its known wrong results, such as `8 / -2 * 4`, until then.

## Language

To settle in the spec review. Nothing below is started.

### Decisions

- [x] **Type inference:** yes, and mandatory: `evaluate` only accepts a checked program. See [Type inference](#type-inference) and [Pipeline](#pipeline).
- [x] **Function definitions:** `define` is required, for the standard library and host functions alike. See [Function definitions](#function-definitions). `check` depends on this.
- [x] **Audience:** developers write the formulas in our own use, and end users may in others. A GitHub code search finds no public consumer outside this repo, and npm shows 66 downloads a month, so there is no usage to learn from and little to migrate. Design for developers, and keep it safe for end users.
- [x] **The syntax freezes at v3.** New capability arrives through `define` and `defineType`, not grammar, so "we can add it later" is not a reason to leave something out.
- [x] **Standard library:** an always-available core plus optional exports, with no `defaultContext`. See [Standard library](#standard-library).
- [x] **Types:** `defineType` adds abstract types for foreign values. See [Types](#types).
- [x] **Numbers:** one number type, a 34-digit decimal, with no double, `NaN` or infinity. `evaluate` returns JS numbers, and a `Decimal` on request. See [Numbers](#numbers).
- [x] **Temporal:** a `defineType` module, so the engine never mentions it. See [Temporal](#temporal).
- [x] **Records:** `order.customer.tier`, the biggest gap in the language today. The type system is designed with them from the start.
- [x] **Missing values:** `x ?? fallback` for unset variables, missing fields and out-of-range indexes, without adding `null`.
- [x] **Inputs:** `?=` is what accepts input, as in `rate ?= 0.1`, replacing "a host variable silently wins over an assignment". A name read but never bound is a required input, and `=` always means the value is the program's, so the optimizer folds `=` names without `externalVariables`, which goes away.
- [x] **Assignment:** statement-only and single-assignment.
- [x] **String interpolation:** `"Total: #{x}"`, as there is no coercion to lean on. `${x}` would be expanded by JavaScript first when a formula sits in a template literal, and strings holding JSON stay untouched.
- [x] **`ROUND(x, digits)`**, plus an optional rounding mode.
- [x] **Function names:** the `STR_` and `ARR_` prefixes go.
- [x] **Pipe shorthand:** `x |> ABS` means `x |> ABS(?)`. Calls with other arguments keep the `?`.
- [x] **Homogeneous arrays:** kept, as inference needs them.

Settled while reviewing the syntax:

- [x] **Record literals:** `{ name: "a", total: 1 }`, since without them a program can read records but `for` cannot build any.
- [x] **Names inside a `for` body:** none. Statement-only assignment leaves the body as one expression, and two loops cover the rest.
- [x] **`=` on a name the host also supplies:** the program's value wins, so a formula never has to know every variable a host passes.

Settled before the spec was written:

- [x] **Lookup by a computed key:** `rates[country]`. A record whose values share one type can be indexed by a string, with no new type or literal, and `??` for a missing key.
- [x] **Sorting records:** there are no lambdas, so `SORT` cannot take a key. `SORT_BY(items, keys)`, as in `SORT_BY(items, for i in items then i.price)`, with no new syntax.
- [x] **Building records from records:** spread and shorthand, `{ ...item, total: t }` and `{ total, tax }`.
- [x] **Identifiers:** ASCII only today, so `año` fails. Unicode letters are allowed.
- [x] **`ROUND` default:** today `ROUND(2.5)` is `3` and `ROUND(-2.5)` is `-2`. Half away from zero, so `-3`, with half-even as a mode.
- [x] **What the spec is:** language-independent and normative, with a conformance suite of plain data, and a promise that a stored formula keeps its meaning across 3.x.

`SPEC.md` is the language as decided, and overrides this list where they differ. Agreed defaults it started from:

- `??` applies directly to a variable, field or index path and catches only missing values, never errors. `(a / b) ?? 0` fails `check`.
- A program must end in an expression. An empty program stays an error.
- A loop variable may not reuse a bound name. Functions and variables keep separate namespaces.
- A literal with more than 34 significant digits is an error. Numbers keep decimal128's exponent range, and overflow is an error.
- `%` keeps the sign of the dividend. `0 ^ 0` is `1`, and `(-8) ^ 0.5` is an error.
- `STR` writes plain digits up to 34, and scientific notation beyond that.
- Digit separators: `1_000_000`. Trailing commas are allowed. Strings may span lines.
- An unknown escape is an error, where `"\q"` silently stays `\q` today. `\#` and `\u{...}` are added.
- Strings compare by code point, where `<` uses UTF-16 order today, which disagrees with `LEN` and indexing.
- `NOW` and `TODAY` return one value per evaluation.
- Host functions stay synchronous, and data a formula needs is fetched before it runs.
- Warnings never block. Diagnostics have stable codes, and a host can treat warnings as errors.
- A result too large for a JS number fails, and tells the host to ask for a `Decimal`.
- `null`, `let`, `fn` and `match` are reserved. `type` is not, as it is too common a name for an input, and field names can be keywords anyway.

Host API, designed after the language and specified separately:

- `define` and `defineType`, and how a definition declares its cost.
- The formats of `program.inputs` and of a diagnostic.
- How a host declares an input at compile time.
- The `Decimal` class, and the option that asks for it.
- Limits on `compile`.

### Out of scope unless we say otherwise

- Lambdas and user-defined functions in v3. `for` covers map, filter and reduce. See [v4](#v4-some-day).
- A `null` value.

### Type inference

The goal is Hindley-Milner in spirit: no annotations, full type safety.

The hardest part of Hindley-Milner is generalization, which gives user-defined functions polymorphic types. This language has no user-defined functions, so it needs none of that. What remains is unification over one program, which is small.

What it would take:

- **Types:** `number`, `string`, `boolean`, `array<T>`, records, and type variables. `[]` is `array<α>`.
- **Built-ins** are polymorphic signatures from a table, such as `REVERSE: array<α> -> array<α>`.
- **Overloads** are the part that is not plain Hindley-Milner: `+` works on numbers, strings and arrays, `<` on ordered types, `LEN` on strings and arrays. A type variable bounded to a set of types handles it: `+: a -> a -> a where a ∈ {number, string, array}`, and unifying narrows the set.
- **Field access** on an unknown input needs an open record: `order.total` means "a record with at least `total`". With no generalization, that is a set of known fields on a variable.
- **Host functions** need a signature, or their results are unknown.

What it would give:

- Errors before running, several at once, with spans: `if c then 1 else "a"`, `[1, "a"]`, wrong argument counts, unknown names.
- **An inferred input schema.** `price * qty > limit` tells the host that it needs three numbers, with no declaration. A host could generate a form from that. This may be the most compelling feature on the list.
- The signature table the playground keeps by hand today, for autocomplete and docs.

What it would cost:

- A checker in every bundle, as it can no longer be tree-shaken. Its size and its cost per compile are not measured yet.
- Stricter programs: both branches of an `if` must agree, and a variable keeps one type.
- The step budget stays. Types say nothing about how long a program runs.
- Host values and host function results are still validated at the boundary.

What dropping runtime checks gains, measured with every provable one removed, on the compiled interpreter, on Node:

| Scenario        | Gain  |
| --------------- | ----- |
| Reused formula  | 1.02x |
| Loop, reduce    | 1.05x |
| Loop, map+guard | 1.01x |
| Arrays          | 1.16x |
| Stdlib calls    | 1.32x |

That is the ceiling, before any cost for checking itself, and it is not why checking is mandatory. Checking is mandatory because a formula that handles money should be proven as far as possible before it runs.

An input nothing constrains stays generic, as in `x == y`, where the boundary only requires both to share a type. An operator on inputs alone, as in `x + y`, defaults to `number`. A host that wants otherwise declares the input at compile time.

### Function definitions

`HOST_API.md` is the design now, and overrides this section where they differ. In particular, a `t.number()` parameter arrives as a `Decimal`, so `run` cannot lose what the language keeps.

A function is a bare JavaScript function today, with no metadata. `check` cannot work without signatures, so this comes first. As first proposed:

```ts
import { define, t } from 'littlewing';

const DISCOUNT = define({
	args: [t.number('price'), t.number('percent')],
	returns: t.number(),
	doc: 'Take a percentage off a price',
	run: (price, percent) => price * (1 - percent / 100),
});
```

- `run` is typed from `args`, so TypeScript and the language agree from one declaration.
- Combinators rather than a signature string: no parser in the bundle, and TypeScript infers from them directly.
- Also needed: generics (`t.var()`), overloads (`t.oneOf()`) and optional arguments. No function is variadic, as `MIN` and `MAX` take arrays.
- The standard library uses the same mechanism, which replaces the `assert*` calls in each function, gives arity errors everywhere, and replaces the playground's `function-metadata.ts`.

Open questions:

- How does a definition declare what it costs? Today the assertions charge for reading arguments.
- Does `doc` ship in the main bundle? 82 descriptions add weight, so they may belong in a separate module. Measure it.
- Can the per-call argument check be generated from the signature as fast as the handwritten assertions?

### Standard library

Measured, minified and gzipped:

| Bundle                             | Size          |
| ---------------------------------- | ------------- |
| `evaluate` alone                   | 7.9 KB        |
| `evaluate` with all 82 functions   | 11.8 KB       |
| Single functions, helpers included | 0.3 to 0.7 KB |

So the 82 functions add about 3.9 KB. The problem is not bytes but surface: 82 names to learn, document and keep forever, offered as all or nothing.

Two tiers, replacing `defaultContext`:

- **Core:** always available, with no import. A function is core if programs in any domain need it and a formula author could not replace it with one correct expression.
- **Optional:** named exports from `littlewing/std`, for what one expression already does, and for what only some domains need, such as trigonometry.

Programs cannot define functions, so "write it yourself" means repeating the expression at every use. That is why the test is one correct expression and not whether a program could do it at all. `SORT` can be written as a loop, and no formula author should have to.

Measured against today's functions, on 14 numbers including `-0`, infinities and `NaN`, plus strings with surrogate pairs:

| Function                                         | Equivalent                  | Result                                |
| ------------------------------------------------ | --------------------------- | ------------------------------------- |
| `ABS`, `SQRT`, `SUM`, `STARTS_WITH`, `ENDS_WITH` | One expression              | Agrees on every input                 |
| `MIN`                                            | `if x < 1 then x else 1`    | Differs on `NaN` only                 |
| `FLOOR`                                          | `x - x % 1`                 | Wrong on negatives: `-1.5` gives `-1` |
| `FLOOR`, `ROUND`                                 | Two statements with an `if` | Agrees on every input                 |

```ts
import { evaluate } from 'littlewing';
import { ABS, SUM } from 'littlewing/std';
import * as std from 'littlewing/std';

evaluate('ROUND(price)', { variables }); // core needs no import
evaluate(source, { functions: { ABS, SUM, DISCOUNT } }); // pick
evaluate(source, { functions: { ...std, DISCOUNT } }); // or take all
```

Proposed split of the 37 functions outside date and time:

| Tier          | Functions                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core (16)     | `STR`, `NUM`, `LEN`, `SLICE`, `CONTAINS`, `INDEX_OF`, `SORT`, `JOIN`, `SPLIT`, `REPLACE`, `UPPER`, `LOWER`, `TRIM`, `FLOOR`, `CEIL`, `ROUND`               |
| Optional (18) | `ABS`, `MIN`, `MAX`, `CLAMP`, `SQRT`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`, `STARTS_WITH`, `ENDS_WITH`, `REPEAT`, `REVERSE`, `SUM`, `UNIQUE`, `FLAT` |

- Across all 82 functions, dropping the `STR_` and `ARR_` prefixes collides only on `MIN` and `MAX`.
- `MIN` and `MAX` take an array, so `ARR_MIN` and `ARR_MAX` merge into them and `MIN(a, b)` becomes `MIN([a, b])`. `TYPE` goes, as it is a constant in every checked program. That makes 34 functions from 37.
- `CEIL`, `CONTAINS`, `INDEX_OF` and the rest of core were placed by the rule without being tested against an equivalent.
- Size in min+gzip, measured with today's functions and before `define` adds anything: `evaluate` 7.9 KB, with core 9.2 KB, with every non-date function 10.3 KB, with all 82 11.8 KB. Core adds 1.3 KB to every consumer and cannot be tree-shaken.
- Core functions are pure and metered, with no clock and no side effects. Everything impure, such as `NOW` and `TODAY`, stays opt-in.
- Core never touches `Temporal`, so it runs on every runtime without a polyfill. That is why even `DATE` is not core.
- Host functions win over a core function of the same name, so that adding to core in a 3.x release cannot break a host.
- Definitions are ordinary named exports, so bundlers drop what is unused and a namespace import is the preset.
- Trust travels with the definition, which removes the `WeakSet`, the bound public copies, and the pure-annotated registration.
- A `pure` flag on definitions would let the optimizer fold calls such as `ABS(-1)`.

Reducing the 45 date and time functions:

| Today                                      | Count | Becomes                                            |
| ------------------------------------------ | ----- | -------------------------------------------------- |
| `YEAR(d)`, `MONTH(d)`, `HOUR(t)` and so on | 10    | Stay as they are, as abstract types have no fields |
| `ADD_DAYS(d, 7)` and five more             | 6     | `ADD(d, 7, "days")`                                |
| `DIFFERENCE_IN_DAYS(a, b)` and six more    | 7     | `DIFF(a, b, "days")`                               |
| `START_OF_MONTH(d)`, `END_OF_YEAR(d)` etc  | 8     | `START_OF(d, "month")`, `END_OF(d, "year")`        |

That leaves about 28. `check` validates the unit strings if `define` supports literal types.

### Types

Hosts can add abstract types, to represent foreign values in a formula and give them functions. A type is built in only if it has literal syntax or the core depends on it: `number`, `string`, `boolean`, arrays and records. A host cannot change those. Anything else is an abstract type, and no abstract type is privileged: `littlewing/temporal` is one choice, and a host can define dates on `Date` or any library instead.

```ts
const money = defineType<Money>({
	name: 'money',
	is: (v) => v instanceof Money,

	// Optional, and each one enables syntax on this type
	equals: (a, b) => a.equals(b), // == and !=
	compare: (a, b) => a.compare(b), // <, >, <=, >= and SORT
	add: (a, b) => a.plus(b), // +
	subtract: (a, b) => a.minus(b), // -
	show: (a) => a.format(), // STR and #{}
});

const USD = define({
	args: [t.number('amount')],
	returns: money,
	pure: true,
	run: (amount) => new Money(amount, 'USD'),
});
```

- Only `name` and `is` are required. `is` validates values at the boundary.
- A value of an abstract type is opaque. A program can hold it, pass it to functions, keep it in arrays and records, and return it. It cannot look inside, and `.` works on records only, so a formula can never reach `.constructor` on a host object.
- Using an operator the type does not provide is a `check` error.
- `+` and `-` are `a -> a -> a`. `*`, `/`, `%` and `^` stay number-only, so `price * quantity` proves both are numbers. Money times a rate is a function call.
- Two types make currencies a compile error: `usd + eur` fails `check`.
- No literals, as values come from functions and variables. No type parameters.
- Hooks are host code, so they are metered and validated as host functions are.
- `check` resolves an operator to its hook, so only operations on generic inputs dispatch at runtime.
- The date types are the first user of this API, with `equals`, `compare` and `show`, so the API has to be enough for them.
- Decimal is not an abstract type, because it is `number`. Literals, indexes, ranges and `*` all depend on it. As an option it would make `0.1 + 0.2 == 0.3` depend on the host, bring back `NaN`, and double the spec and its conformance suite, to save about 1.5 KB and a factor of 2 on formulas that already run about 2 million times a second.
- `define` and `defineType` must be designed together.

### Numbers

One number type, decimal with 34 significant digits and half-even rounding, as in the IEEE decimal128 format that the TC39 proposal builds on. That proposal is at Stage 1 and may never reach us in time, so littlewing carries its own.

A number with a fixed digit limit is what keeps this safe for untrusted programs. With arbitrary precision, `x = x * x` doubles the digits at every step.

A prototype in a scratch copy of the interpreter keeps safe integers as JS numbers and uses a decimal object otherwise, with a number coefficient while it fits and a `BigInt` after that. Slowdown against today's doubles, medians of 5 runs on Node and 3 on Bun:

| Scenario                | Today (Node, ops/s) | Tiered, Node | Tiered, Bun | Plain `BigInt`, Node |
| ----------------------- | ------------------- | ------------ | ----------- | -------------------- |
| `price * quantity...`   | 3.9M                | 2.1x         | 1.8x        | 6.0x                 |
| `19.99 * quantity...`   | 4.6M                | 1.5x         | 2.1x        | 3.6x                 |
| Rules with `if`         | 3.1M                | 1.3x         | 1.6x        | 3.2x                 |
| Integer loop            | 424                 | 2.0x         | 1.2x        | 25.4x                |
| Guarded loop            | 302                 | 1.4x         | 1.3x        | 22.1x                |
| Money loop              | 1,141               | 2.0x         | 2.5x        | 9.7x                 |
| Fractions loop          | 1,321               | 2.4x         | 2.1x        | 15.1x                |
| Compounding 360 periods | 49,124              | 46x          | 76x         | 47x                  |

- The prototype agrees with Python's `decimal` on 20,000 of 20,000 random `+`, `-`, `*` and `/` operations.
- 360 periods of compound interest are right to 31 digits in the prototype and 14 with doubles. At 46x slower that takes about 1 ms.
- It adds about 1.5 KB min+gzip. A real version also needs rounding modes, formatting and the math functions.
- `NaN` and infinities go away, with `0 / 0`, `SQRT(-1)` and overflow as errors. So does the rule for sorting `NaN`.
- `+`, `-` and `*` are exact within 34 digits. `/` rounds, so `1 / 3 * 3` is `0.9999999999999999999999999999999999`, where doubles happen to give `1`.
- Fractional exponents are correctly rounded, as `^` is in the language and the result must match everywhere, which double math does not guarantee. That needs decimal `ln` and `exp`. A power takes about 25 us, and `Decimal` adds 4.2 KB min+gzip. `SQRT`, `SIN` and `LOG` are optional functions, and can go through doubles at about 15 digits.
- Numbers lose trailing zeros, so display needs a core `FIXED(x, 2)`, giving `"1.10"`.

Not measured yet: the stdlib on decimals, step charges for the slow path, hostile programs, or a type table holding decimals. The prototype also reads literals through a double. The real lexer has to keep their digits, which changes `NumberLiteral`.

At the host boundary, JS numbers enter by their shortest decimal form, so `0.1` is exactly `0.1`, and `evaluate` returns JS numbers unless asked for a `Decimal`. A double holds any 15-digit decimal, so that only loses digits beyond 15.

### Temporal

Temporal is three of seven types and 45 of 82 functions.

`littlewing/temporal` defines `date`, `time` and `datetime` with `defineType`, along with their functions, and the engine stops mentioning `Temporal`. `NOW` and `TODAY` get their own entry, `littlewing/clock`, so that `temporalFunctions` stays deterministic.

This replaces the earlier decision to keep the date types in the engine. That decision judged an opaque type mechanism by what dates alone would save, and relied on adding it in a later 3.x release. With the syntax frozen, and with money and decimals in view, the mechanism is the point.

Facts behind it, as of 2026-11-01:

- The engine already runs without `Temporal`. With the global deleted on Node, arithmetic, strings, arrays, sorting and equality all work, and only the date functions fail.
- Outside the date modules, `Temporal` appears on 41 lines, 34 in `utils.ts` and 7 in `types.ts`.
- Node 26, Bun 1.4, Chrome 144 and Firefox 139 ship `Temporal`. Safari, and so iOS, did not in the newest sources found, the latest from May 2026.
- `temporal-polyfill` 0.3.2 is 21.1 KB min+gzip, 2.7 times `evaluate` alone. A date function in always-on core would force that on every Safari user or fail for them.

Without a global `Temporal`, the date functions should fail with an error that names the polyfill, in place of today's `Temporal is not defined`. Date literals stay out of scope.

## Pipeline

```
source -> lex -> parse -> desugar -> check -> optimize -> evaluate
```

```ts
const result = compile(source, { functions, types });
if (!result.ok) return report(result.diagnostics); // every error, with spans

result.program.inputs; // the inferred input schema
evaluate(result.program, { variables }); // throws runtime errors only
```

- Every stage always runs. There is one route from source to execution, and it goes through `compile`.
- `compile` runs everything up to `evaluate`. A mistake in the program never throws from it: all of them come back as diagnostics. A mistake in the host, such as an invalid definition, still throws.
- `parse` and `generate` stay public for tools such as formatters. They are not a way to execute anything.
- `optimize` stops being public, and `externalVariables` and `preserveScope` go. `evaluateScope` goes too, as a program returns several values with a record: `{ total: t, tax: x }`.
- Optimizing costs little: 0.18 us on a one-line formula, 1.95 us on three statements of rules and 108 us on 200 statements, or 0.3x to 1.2x the time parsing takes.
- Failures the optimizer can prove become diagnostics: an error if the code always runs, such as `1 / 0`, and a warning if it may not. Unused variables and constant conditions are warnings. Only `pure` functions fold.
- Runtime errors are what no checker can know: division by zero, an index out of range, overflow, the budget.
- A `Program` is opaque and can only come from `compile`, so nobody can hand `evaluate` a forged typed AST. It holds compiled closures, so it cannot change once checked. It is not serializable: a program saved elsewhere is compiled again.
- Functions and types bind at compile time, and `evaluate` takes only variables.
- Desugaring keeps the span of the sugar it came from, so an error points at what the author wrote. Pipes and interpolation desugar. `generate` works on the parsed AST, before desugaring.
- `check` resolves each operator to one implementation where the type is known, so `+` on numbers compiles straight to number addition.
- `evaluate` validates variables against `program.inputs`, and host function results against their signatures. Inside that boundary, stdlib argument checks and array homogeneity walks go.
- A failure path that costs nothing stays. The number fast path needs a `typeof` anyway, to tell an integer from a decimal, so falling through to an error is free. If `check` ever has a bug, the program fails loudly instead of returning a wrong number.
- `compile` faces untrusted source, so it needs its own limits. Types of nested records can double in size at every step, as in `b = { x: a, y: a }`.
- A fuzz test must show that no program passing `check` can hit a type error at runtime.
- A `run(source, context)` shortcut does both steps and throws on diagnostics, for one-off use and scripts.

Not measured yet: the checker's size, and what `compile` costs per formula.

- [ ] `compile()` as public API, replacing the hidden `WeakMap`, `evaluate(source)` and the "AST must not change" caveat.
- [ ] `check` as a stage of `compile`. It absorbs the analyzer.
- [ ] String node kinds instead of the numeric `NodeKind`, for readable ASTs that stay stable as JSON between versions. Dispatch on kind is no longer hot.
- [ ] Function signatures in the library, moved from the playground's `function-metadata.ts`.
- [ ] Drop `visit`. `forEachChild` and `mapChildren` cover it and nothing internal uses it.
- [ ] Parser error recovery, to report several syntax errors at once. This is now required, as `compile` reports everything it finds.

## v4, some day

A functional redesign, considered on 2026-11-01 and deferred. v3 ships `SPEC.md` as reviewed. Not started, and not a commitment.

The idea, with Elm and Gleam as models: functions as values, `x -> x * 2`, with `.price` and `_ * 2` as short forms, data-first pipes, no recursion, Hindley-Milner inference by constraint solving, a real `Option` type behind `??`, `xs[0]` returning an `Option`, tagged unions with exhaustive `match`, Standard ML style operators, and row polymorphism with scoped labels for records.

It is more expressive and proves more, and it is harder for anyone who is not a developer. Sections 3, 4, 8, 9 and 11 of `SPEC.md` would mostly carry over. Sections 5, 6 and 10 and the grammar would not.

## Dependencies

Done in M0: `temporal-polyfill` and `temporal-spec` 1.0, the easy updates, TypeScript 7 with `oxlint-tsgolint` 7, `oxfmt` 0.75, `bumpp` 12, Bun pinned in CI to 1.4.4, and Dependabot. The global `Temporal` type now comes from `temporal-spec/global` in the playground too.

## Playground

- [ ] Compare CodeMirror 6 with Monaco. Monaco appears to load from a public CDN at runtime, separately from its `package.json` version, which is only used for types. Measure size, load time and mobile behaviour first.
- [ ] Run evaluation in a Web Worker, so that typing never blocks the page. Dates need custom serialization to cross into it.
- [ ] Embed mode, so that docs examples are runnable
- [ ] Use the library's function signatures instead of `function-metadata.ts`, which needs `doc` on every definition, and parameter names back in `std` and `temporal`, as the shared type constants dropped them
- [ ] Measure load time, and whether both `.woff` and `.woff2` fonts need shipping

## Open source

Broken today:

- [ ] Fix the GitHub description, which still says "arithmetic expression language"
- [ ] Link the playground from the README, which never mentions it
- [ ] Remove the stale bot, which closes issues after 44 days
- [ ] Stop pointing README readers at CLAUDE.md for development docs

To build:

- [ ] Reposition around the problem: let users write formulas, without `eval` and without letting them hang your app
- [ ] New README opening: a 30-second example, a playground link and a demo
- [ ] Recipes: pricing rules, a formula field in a form, a generated form if inference lands
- [ ] Editor integration for CodeMirror or Monaco
- [ ] A threat model page
- [ ] A comparison with other libraries, verified by running them
- [ ] Reproducible benchmarks in the repo
- [ ] Update the npm description and keywords, and consider publishing to JSR
- [ ] A launch post: the attacks found while hardening it make a good story

## Known gaps

From the overhaul, still untested:

- [ ] Windows and macOS CI runners
- [ ] The polyfill path in CI: `lts/*` is likely Node 26, whose native `Temporal` `temporal-polyfill` hands back, so `smoke.mjs` no longer runs on the polyfill there
- [ ] The playground in a real browser: Monaco markers, the quick fix, time inputs, HMR and mobile
- [ ] Node 18 to 24
- [ ] TypeScript 5.0 to 5.8
- [ ] The playground in a real browser, including Firefox
- [ ] The types in `define.d.ts` need TypeScript 5.4 with `skipLibCheck: false`. Inference works from 5.0 with `skipLibCheck: true`.
- [ ] Undecided overloaded calls are all retried after each rule of section 6.5, which is quadratic, and charged. About 60 KB of nothing but such calls passes the default compile budget.
- [ ] A program at the limits needs about 700 KB of stack to parse, which default stacks have. On less, parsing reports `limit-exceeded`.
- [ ] NFC on names of up to 1024 code points is linear in the source but slow, at up to 3 s per MB on Bun, so `compile` has to charge for it.
- [ ] `optimize` on a 1024-term chain needs more than 600 KB of stack. Default stacks are fine, and running out has to become a diagnostic, as `compile` must not throw on a program.
- [ ] `evaluate(parse(src))` is less than half the speed of `evaluate(src)` for one-off use. `compile()` removes this.
