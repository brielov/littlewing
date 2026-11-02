# The Littlewing Host API

Version 3.0.

This document specifies the TypeScript API that an application uses to compile and run Littlewing programs. The language itself is specified in [SPEC.md](./SPEC.md), which this document does not change. Where a section of the language is cited, it is a section of that document.

## 1. Overview

```ts
import { compile, CompileError, evaluate } from 'littlewing';

const result = compile('price * quantity * (1 + tax)');
if (!result.ok) throw new CompileError(result.diagnostics);

result.program.inputs; // what the formula needs, inferred
evaluate(result.program, { variables: { price: 19.99, quantity: 3, tax: 0.21 } });
```

Compile a formula once, and evaluate it as often as needed. `run` does both, for one-off use.

| Entry point           | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `littlewing`          | `compile`, `evaluate`, `run`, `define`, `defineType`, `once`, `t`, `Decimal`, `EvaluationError`, `CompileError`, `toLineColumn`, `parse`, `generate`, `describeFunction`, `coreFunctions`, the types `Type`, `FunctionDefinition`, `AbstractType`, `RoundingMode`, `DecimalLike`, `Program`, `CompileOptions`, `CompileResult`, `ParseResult`, `EvaluateOptions`, `Diagnostic`, `InputSchema`, `InputDescription`, `FieldDescription`, `TypeDescription`, `FunctionDescription`, `OverloadDescription`, `ParameterDescription`, and the types of the syntax tree in the namespace `syntax` |
| `littlewing/std`      | The optional functions, as named exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `littlewing/temporal` | The date types, their functions as named exports, and all of those functions in `temporalFunctions`, as the types keep a namespace of this module from being spread into `functions`                                                                                                                                                                                                                                                                                                                                                                                                       |
| `littlewing/clock`    | `NOW`, `TODAY` and the other functions that read the clock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

A definition is typed by `FunctionDefinition` or `AbstractType<T>`. An exported one needs that annotation under `isolatedDeclarations`.

## 2. Compiling

```ts
function compile(source: string, options?: CompileOptions): CompileResult;

interface CompileOptions {
	functions?: Record<string, FunctionDefinition>;
	types?: AbstractType[];
	inputs?: Record<string, Type>;
	limits?: { maxSteps?: number };
}

type CompileResult =
	| { ok: true; program: Program; diagnostics: Diagnostic[] }
	| { ok: false; diagnostics: Diagnostic[] };
```

- `functions` adds to the core functions, and replaces one of the same name. Keys are identifiers in NFC, as a program could not call anything else. A key is the name a program calls.
- `types` lists abstract types. Types that appear in a function's signature or in `inputs` are included without being listed. A generic input can only hold a value of a listed or included type.
- `inputs` declares the types of inputs, as language section 6.5 allows. It is one signature, so `t.var('T')` used twice in it is one variable. A name that is not an input of the program has no effect beyond including its type, and is not in the schema.
- `limits.maxSteps` is the compile budget. It defaults to 20 million. It bounds the work a program can cause, and memory grows with the length of the source as well, so a host taking formulas from strangers should cap their length, as it would any input. Memory also grows with the size of the signatures a formula calls, and a program holds on to the types of its calls, at about 1 KB per signature node per call, so 3 KB of calls of a function with 1,000 record fields can keep 440 MB. A host that keeps programs compiled from strangers' formulas should weigh that. On a JavaScript heap under about 500 MB, lower `maxSteps`, the one control a host has: the default budget can use that much.

`functions` and `inputs` are read by their own enumerable keys, so nothing inherited counts, and an input named `toString` is simply an input.

`compile` never throws for a mistake in the program. Every one comes back in `diagnostics`, and warnings come back beside a program.

It throws a `TypeError` only for a mistake in the host:

- a key of `functions` that is not an identifier in NFC
- a value of `functions` not made with `define`, an entry of `types` not made with `defineType`, or a value of `inputs` that is not a type
- `t.optional` or `t.oneOf` directly in `inputs`
- two different types with one name
- a declared type past the limits of language section 11
- a `maxSteps` that is not a number, is `NaN`, or is negative

### Diagnostics

```ts
interface Diagnostic {
	code: string; // stable, from Appendix B of the language spec
	severity: 'error' | 'warning';
	message: string; // for people, and free to change
	start: number; // offset into the source, in UTF-16 code units
	end: number;
	cause?: unknown; // non-enumerable: what host code threw, for a constant failure
}
```

`toLineColumn(source, offset)` converts an offset for display. A host that treats warnings as errors checks `severity` itself.

### Programs

```ts
interface Program {
	readonly inputs: InputSchema;
	readonly output: TypeDescription;
}
```

A `Program` can only come from `compile`. It holds compiled code, it has no public constructor, and `evaluate` rejects anything else with a `TypeError`. It cannot be serialized, so a stored formula is stored as source and compiled again. A program is bound to the functions and types it was compiled with.

Hosts keep programs for a long time, so folding keeps a value in a program only if it holds no abstract value or unread field, its type has no generic variable left, and its logical size is at most 1024. Anything else runs at evaluation, and is charged there. Constant failures are still found, as such a value stays available until folding ends, and is dropped then.

### The input schema

The schema is plain data, so it can be sent as JSON and can drive a form. It is deeply frozen, every record in it has a `null` prototype, and `evaluate` never reads it.

The types in `inputs` and `output` are written after checking and before folding, and are charged to the compile budget at their written-out size, counting shared parts every time they appear. Types the budget cannot pay for are a `limit-exceeded` diagnostic. The same goes for a type printed in a diagnostic message, except during folding, when a message leaves the type out.

```ts
type InputSchema = Readonly<Record<string, InputDescription>>;

interface InputDescription {
	readonly type: TypeDescription;
	readonly required: boolean;
	readonly default?: string | boolean;
}

type TypeDescription =
	| { readonly kind: 'number' | 'string' | 'boolean' }
	| { readonly kind: 'array'; readonly element: TypeDescription }
	| {
			readonly kind: 'record';
			readonly open: boolean;
			readonly fields: Readonly<Record<string, FieldDescription>>;
			readonly uniform?: TypeDescription;
	  }
	| { readonly kind: 'abstract'; readonly name: string }
	| { readonly kind: 'generic'; readonly id: number; readonly classes?: readonly string[] };

interface FieldDescription {
	readonly type: TypeDescription;
	readonly required: boolean;
}
```

`default` is present only if a `?=` default is a constant number, string or boolean that folding kept. A number is written in the text form of language section 4.7, which `Decimal.from` reads back exactly.

Two `generic` types with one `id` are one type variable. A value at a generic position must belong to all of `classes`.

## 3. Evaluating

```ts
function evaluate(program: Program, options?: EvaluateOptions): unknown;

interface EvaluateOptions {
	variables?: Record<string, unknown>;
	limits?: { maxSteps?: number };
	numbers?: 'number' | 'decimal';
}
```

`limits.maxSteps` defaults to 20 million, and `Infinity` disables the budget for trusted programs. A `maxSteps` that is not a number, is `NaN` or is negative, or an unknown `numbers`, is a `TypeError`.

`variables` is a record, with own enumerable keys, under the rules of [Values](#values). Only the names of the program's inputs are read, once each. Anything else, such as a `Map`, is a `TypeError`.

The result has the type in `program.output`, as the table under [Values](#values) converts it.

### Crossing the boundary

A value crosses the boundary as an input, an argument or result of a function made with `define`, an argument of `cost`, an argument or result of a hook, or the result of `evaluate`. Each crossing copies it, in one pass that follows the type:

- Every array element and record field is read once per type, and the copy is what is checked. So a getter or proxy cannot give one value to the check and another to the program.
- Neither side ever holds an array or record the other holds. Host code cannot change a program's values, or the reverse.
- Sharing is preserved.
- Conversion follows the type, not the value.
- Abstract values and unread fields of open records cross by reference, and are never walked or converted. So an abstract value must be immutable.
- `cost` receives the same copy `run` receives, with numbers as `Decimal`s.
- `is` receives the host's own value, before that value is read, and is the only code that sees a host's array or record unread. An `is` during an uncharged read is not charged.

A throw during a read is an `invalid-input` error for an input, and a `host-error` for a result.

Reading the inputs of an outermost `evaluate` is not charged, as they are the host's own data. An `evaluate` nested as [Errors](#errors) describes, including during folding, charges for what it reads, because the program chooses how often that happens: every element, field and character walked, with a shared object walked once.

A value with a type past the limits of language section 11 is an `invalid-input` error for an input, and a `host-error` for a result. At a generic position, a value met again while it is still being read is past the limit at once, which stops cycles. A plain object graph with cycles can still be read under a finite type, once per type, so hosts should pass trees.

**The result of `evaluate`** is charged its logical size before it leaves, counting a shared part every time it appears, and walking it once. A result the budget cannot pay for fails with `limit-exceeded`. So a host can safely walk what the program built. An unread field and an abstract value each count as 1. An unread field is unmeasured, so a host that feeds results back in as inputs bounds them itself, or declares the input as a closed record, which rejects anything the program added.

### Numbers at the boundary

An input number can be a JS `number`, or a `Decimal`, which is how to pass an exact value. A JS number enters by its shortest decimal form, so `0.1` is exactly `0.1`. `NaN` and infinities are an `invalid-input` error.

With `numbers: 'number'`, the default, numbers come back as JS numbers, by the conversion of [`toNumber`](#7-decimal). A double holds any 15-digit decimal in its normal range, so digits beyond that are lost. A number too large for a double fails with `overflow`, and the message says to ask for a `Decimal`.

With `numbers: 'decimal'`, they come back as `Decimal`s, and nothing is lost. A host that stores or adds up amounts should use this.

### Values

| Language         | JavaScript                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `number`         | `number` or `Decimal`, as above                                                                   |
| `string`         | `string`, with no unpaired surrogates                                                             |
| `boolean`        | `boolean`                                                                                         |
| `array<T>`       | An array, read by index. An element that reads as `undefined`, such as a hole, is `invalid-input` |
| A record         | A plain object                                                                                    |
| An abstract type | The value itself, untouched                                                                       |

**Records.** Only an object with `Object.prototype` or `null` as its prototype is a record. Its fields are its own enumerable string keys. The name of a field a type names or a uniform type covers has no unpaired surrogates. A program can read nothing else, so it cannot reach `__proto__` or `constructor` on a host object.

A record handed to the host has a `null` prototype, so a field named `__proto__` is an ordinary property. `Object.assign` and deep-merge helpers can still treat such a key specially, so a host that merges results needs care.

**Absence.** A key whose value is `undefined` is absent, at every level. `null` is an `invalid-input` error, unless an `is` accepts it.

A value that passes more than one type's test follows language section 9.

### Errors

```ts
class EvaluationError extends Error {
	code: string;
	start: number;
	end: number;
	cause?: unknown;
}

class CompileError extends Error {
	diagnostics: Diagnostic[];
}
```

Every failure of `evaluate` on a program is an `EvaluationError`, with a code from Appendix B of the language spec. Messages never stringify a host value.

`start` and `end` locate the failing expression, and are `0` for anything that happens before the program runs or after it ends, such as an `overflow` at the result. For `host-error`, `cause` is what host code threw. It is absent if a result simply failed validation, and the message says why.

**Budget.** If the budget of the outermost evaluation runs out inside host code, the evaluation is `limit-exceeded`, not `host-error`, even if the host catches what is thrown. A lower nested budget that runs out is an ordinary `EvaluationError` to the code that set it. During folding, running out only stops folding. A stack overflow in the implementation's own frames is `limit-exceeded`.

**Nesting.** A `compile` or `evaluate` called from host code during an evaluation or folding runs on what is left of the enclosing budget, which for folding is the compile budget. Its `maxSteps` can only lower that, and its steps count against the enclosing evaluation. Each `evaluate` is otherwise independent, so one `Program` can be evaluated reentrantly.

### `run`

```ts
function run(source: string, options?: CompileOptions & EvaluateOptions): unknown;
```

`run` compiles and evaluates. It throws a `CompileError` if compilation fails. `limits.maxSteps` applies to each stage separately.

## 4. Defining functions

```ts
const DISCOUNT = define({
	args: [t.number('price'), t.number('percent')],
	returns: t.number(),
	pure: true,
	doc: 'Take a percentage off a price',
	run: (price, percent) => price.times(Decimal.from(1).minus(percent.div(100))),
});

compile(source, { functions: { DISCOUNT } });
```

| Field       | Required                 | Meaning                                                                                           |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `args`      | Unless `overloads` given | The parameters                                                                                    |
| `returns`   | Unless `overloads` given | The result type                                                                                   |
| `overloads` | No                       | A list of `{ args, returns }`, instead of those two                                               |
| `run`       | Yes                      | The implementation, with its parameters typed from `args`                                         |
| `pure`      | No                       | Same arguments give the same result, with no side effects, so it can fold. The default is `false` |
| `cost`      | No                       | Extra steps to charge, computed from the arguments                                                |
| `doc`       | No                       | A description for tooling                                                                         |

`define` throws a `TypeError` for an invalid definition: both `overloads` and `args`, a required parameter after a `t.optional` one, `t.optional` anywhere but a field or trailing argument, one variable name used by both `t.var` and `t.class`, or by `t.class` with two different classes, a class that is not one of language section 6.2, or a type past the limits of language section 11.

`run` is synchronous. Data a formula needs is fetched before it runs, and passed as variables.

**Arguments.** `check` guarantees the types of a call, so `run` needs no argument checks. A generic parameter holds whatever arrived, and is still a language value. An optional argument left out arrives as `undefined`.

**Numbers in `run`.** Every number in an argument arrives as a `Decimal`, at any depth, whatever the parameter's type, except inside an unread field. This applies to functions made with `define`, as core functions are not host code. So host code does not lose what the language keeps. Arrays and records arrive as frozen copies, typed `readonly`, so they cannot be changed, and an attempt that throws is a `host-error`. `run` can return a `Decimal` or a JS number. Host code that wants a double calls `.toNumber()`, and takes on what that means.

**Results.** A result must match the type the call has in the program, not the declaration, by the rules of language section 6.6. A variable still generic takes part in the binding that section describes, across inputs and results. Failure is a `host-error`, and that includes `NaN`.

**Cost.** A call is charged for the logical size of its arguments, before `cost` and `run` and after the `t.oneOf` check, and then for that of its result. That covers most functions. `Decimal` methods charge for themselves, as [section 7](#7-decimal) says. `cost` is for any other work, and is charged before `run`:

```ts
cost: (text, count) => text.length * count.toNumber();
```

`cost` returns a JS number. `NaN`, a negative number, anything else that is not a number, or a throw, is a `host-error`, before `run`. `Infinity` exhausts the budget.

### Overloads

```ts
const SIZE = define({
	overloads: [
		{ args: [t.string()], returns: t.number() },
		{ args: [t.array(t.var('T'))], returns: t.number() },
	],
	run: (value) => Array.from(value).length,
});
```

Order matters, as language section 6.5 says: the first overload that fits wins when nothing else decides.

### One value per evaluation

`once(fn)` returns a function that calls `fn` at most once per `evaluate`, so functions can share one reading:

```ts
const instant = once(() => Temporal.Now.instant());

const NOW = define({ args: [], returns: datetime, run: () => toDateTime(instant()) });
const TODAY = define({ args: [], returns: date, run: () => toDate(instant()) });
```

Every call of `NOW` still happens and is validated. This is how `littlewing/clock` gives one evaluation one instant. A nested `evaluate` has its own reading. Outside an evaluation, `once` calls `fn` every time. If `fn` throws, nothing is kept, and a later call tries again.

## 5. Types

```ts
t.number(name?)
t.string(name?)
t.boolean(name?)
t.array(element, name?)
t.record({ a: t.number(), b: t.optional(t.string()) }, name?)   // closed
t.openRecord({ a: t.number() }, name?)
t.uniformRecord(value, name?)
t.var('T', name?)                  // one variable per name, per signature
t.class('ordered', 'T', name?)     // a variable in a class of section 6.2
t.oneOf(['half_even', 'floor'], name?)   // a string restricted to these
t.optional(type)                   // an optional field or trailing argument
```

`name` labels a parameter, for tooling. An abstract type is itself a type, and can be used directly or called with a name: `money` or `money('price')`.

`t.oneOf` is valid only as a parameter, directly or in `t.optional`, and anywhere else is a `TypeError`. A value outside the list is an `invalid-argument` error, before `cost` and `run`.

## 6. Defining abstract types

```ts
const money = defineType<Money>({
	name: 'money',
	is: (value) => value instanceof Money,
	equals: (a, b) => a.equals(b),
	compare: (a, b) => a.compare(b),
	add: (a, b) => a.plus(b),
	subtract: (a, b) => a.minus(b),
	show: (a) => a.format(),
});
```

Only `name` and `is` are required. Language section 9 defines the rest.

Hooks are host code, and each call pays a flat charge, with `show` also paying for the length of its string. `is` receives any value, including `null`, and must handle it. `is` and `equals` must return a boolean, `compare` a JS number that is not `NaN`, `show` a string with no unpaired surrogates, and `add` and `subtract` a value that passes `is`. Anything else, or a throw, is a `host-error`, with `start` and `end` `0` at the boundary.

An abstract value counts as 1 in logical size. A type whose values can grow, such as a collection, must bound them itself, and its hook throws past that bound.

## 7. `Decimal`

`Decimal` is an immutable number with exactly the semantics of the language's `number`.

```ts
class Decimal {
	static from(value: number | string | Decimal): Decimal;

	plus(other: DecimalLike): Decimal;
	minus(other: DecimalLike): Decimal;
	times(other: DecimalLike): Decimal;
	div(other: DecimalLike): Decimal;
	mod(other: DecimalLike): Decimal;
	pow(other: DecimalLike): Decimal;
	neg(): Decimal;

	round(digits?: number, mode?: RoundingMode): Decimal;
	compare(other: DecimalLike): -1 | 0 | 1;
	equals(other: DecimalLike): boolean;
	isInteger(): boolean;

	toNumber(): number;
	toString(): string; // the text form of section 4.7
	toFixed(digits: number, mode?: RoundingMode): string;
	toJSON(): string;
	[Symbol.toPrimitive](hint: string): string;
}

type DecimalLike = number | string | Decimal;
type RoundingMode = 'half_away' | 'half_even' | 'floor' | 'ceil' | 'trunc';
```

- `Decimal.from` reads strings by `NUM`'s rules, and rejects `NaN` and infinities.
- `round` and `toFixed` are `ROUND` and `FIXED`, with their defaults and requirements.
- `toNumber` gives the nearest double, ties to even, and is the conversion of `evaluate`'s default. A result that would be infinite fails with `overflow`. A magnitude too small rounds to `0`, never `-0`.
- `toJSON` gives a string, as JSON numbers are read as doubles.
- `[Symbol.toPrimitive]` throws a `TypeError` unless the hint is `'string'`, so `a > b` and `a * b` fail rather than compare text or use doubles. Template strings keep working. `===` compares identity, and cannot be trapped, so use `equals`.

A method fails as the language operation does, with an `EvaluationError` of that code, and `start` and `end` `0`. Inside `run`, that becomes a `host-error`, with the error as `cause`.

During an evaluation or folding, `Decimal` methods charge the running budget as the matching operators do.

An implementation recognizes a `Decimal` by a private brand, not `instanceof`, and never calls a method on an incoming value.

## 8. Tools

```ts
function parse(source: string): ParseResult;

interface ParseResult {
	readonly program: syntax.Program;
	readonly diagnostics: readonly Diagnostic[];
}
```

`parse(source)` reads a program as `compile` does, and stops at nothing: `diagnostics` holds every syntax problem it finds, in source order, and `program` every statement it could read, with spans and comments. A statement the parser cannot read is left out with its comments, and reading resumes at the next one, so a tool such as an editor has a tree to work with while the source is broken. A statement with an error the parser reads past, such as an invalid number or escape, stays in the tree, so a tree with diagnostics is not one to write back as source. A source with no statements gives a program with none, which keeps its comments. `parse` throws `TypeError` for a source that is not a string, and nothing else.

`generate(program)` returns source text, which parses back to an equal tree apart from offsets, unless the text passes a limit of the language: it can add parentheses at the nesting limit, and writing a name in NFC can lengthen it. No syntax tree can be evaluated, since the only route to execution is `compile`.

`describeFunction(definition)` gives what a function takes and gives, written out for people, for an editor or for documentation. `coreFunctions` holds the core functions, so a tool can describe them too.

```ts
describeFunction(coreFunctions.ROUND);
// {
//   doc: 'Rounded to a number of places',
//   overloads: [{
//     args: [{ name: 'value', type: 'number', optional: false }, ...],
//     returns: 'number',
//   }],
// }
```

A parameter with no `name` label is called `arg1`, `arg2` and so on. A type of a class reads as that class, such as `ordered`.

## 9. Bundles

`define`, `t` and the compiler are always in a bundle. The core functions are too, since a program can call them with no import. Everything else tree-shakes, as definitions are ordinary named exports.
