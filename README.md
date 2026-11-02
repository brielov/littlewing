# littlewing

Let your users write formulas, without `eval` and without letting them hang your app.

littlewing is a small typed language for the formulas people put in spreadsheets, pricing rules and form fields. A program can only compute: it has no access to anything you do not hand it, and every run has a budget that stops it. Numbers are exact decimals, so `0.1 + 0.2` is `0.3`. And it infers what a formula needs, so a form can be built from it.

```ts
import { compile, evaluate } from 'littlewing';

const result = compile('price * quantity * (1 + tax)');
if (!result.ok) throw new Error(result.diagnostics[0]?.message);

Object.keys(result.program.inputs); // ['price', 'quantity', 'tax']

evaluate(result.program, { variables: { price: 19.99, quantity: 3, tax: 0.21 } }); // 72.5637
```

## Why

- **Safe by construction.** A program reaches nothing but the values and functions you pass in. There is no global, no prototype, and no way to loop forever: a step budget bounds its time and memory, however hostile it is.
- **Checked before it runs.** Types are inferred, and every mistake the compiler can find comes back at once with its location, so a formula editor can underline them. A syntax error comes first, and hides what lies behind it. Given inputs that match and functions that keep their signatures, a valid program cannot hit a type error at run time.
- **Exact.** One number type, a 34-digit decimal, rounded the same way everywhere. Money adds up. `SQRT` and the trigonometric, `LOG` and `EXP` functions of `littlewing/std` are the exception: they go through doubles, for about 15 digits, and all but `SQRT` can differ in the last digit between engines.
- **It tells you what it needs.** `program.inputs` is a plain, JSON-ready schema of the inputs and their types, inferred from how the formula uses them.
- **Yours to extend.** Add functions with `define`, and your own types, such as money or dates, with `defineType`.
- **Specified.** The language has a [normative spec](https://github.com/brielov/littlewing/blob/master/SPEC.md) and a [conformance suite](https://github.com/brielov/littlewing/tree/master/packages/littlewing/conformance) of plain data, and a stored formula keeps its meaning across 3.x.

## Install

```bash
npm install littlewing
```

Everything is ESM, about 30 KB gzipped with the compiler and the core functions, and optional functions tree-shake.

## The language

```littlewing
items = [
  { name: "Keyboard", price: 29.99, quantity: 2 },
  { name: "Cable", price: 9.5, quantity: 3 }
]
subtotal = for item in items into sum = 0 then sum + item.price * item.quantity
rates = { AR: 0.21, UY: 0.22 }
country = "UY"
tax = subtotal * (rates[country] ?? 0)
"Total: #{FIXED(subtotal + tax, 2)}"
// => "Total: 107.95"
```

[LANGUAGE.md](https://github.com/brielov/littlewing/blob/master/LANGUAGE.md) is a guide for people writing formulas. [SPEC.md](https://github.com/brielov/littlewing/blob/master/SPEC.md) is the definition.

## Using it

Compile a formula once, and evaluate it as often as you need. Mistakes in a program never throw from `compile`: they come back as diagnostics, each with a stable code and a location.

```ts
import { compile, toLineColumn } from 'littlewing';

const source = 'total = price * "2"\ntotal';
const result = compile(source);

for (const { code, message, start } of result.diagnostics) {
	const { line, column } = toLineColumn(source, start);
	console.log(`${line}:${column} ${code}: ${message}`); // 1:17 type-mismatch: Expected number, got string
}
```

`run` does both at once, for one-off use, and throws a `CompileError` if the program is invalid.

```ts
import { run } from 'littlewing';

run('[1, 2, 3] + [4]'); // [1, 2, 3, 4]
```

### Inputs

A name read but never bound is an input, which is required unless every read of it is under `??`. `?=` declares one with a default. `=` always means the program's own value, so a formula never has to know every variable a host passes.

```ts
import { compile, evaluate } from 'littlewing';

const result = compile('rate ?= 0.21\nprice * (1 + rate)');
if (result.ok) {
	result.program.inputs.price; // { type: { kind: 'number' }, required: true }
	result.program.inputs.rate; // { type: { kind: 'number' }, required: false, default: '0.21' }

	evaluate(result.program, { variables: { price: 100 } }); // 121
	evaluate(result.program, { variables: { price: 100, rate: 0.1 } }); // 110
}
```

Inputs are checked against the schema before anything runs, and copied, so a program never shares an array or record it reads with the host. Fields it never reads, and abstract values, pass through by reference.

### Numbers

Results come back as JS numbers by default, which keep about 15 digits. Ask for `Decimal`s to keep all 34.

```ts
import { Decimal, run } from 'littlewing';

run('1 / 3'); // 0.3333333333333333
run('1 / 3', { numbers: 'decimal' }); // Decimal 0.3333333333333333333333333333333333

run('a * 3', { variables: { a: Decimal.from('0.1') } }); // 0.3
```

### Functions

Eighteen core functions are always there, such as `ROUND`, `LEN` and `SORT`. Add your own with `define`, whose types drive inference and TypeScript alike. Numbers arrive as `Decimal`s, so nothing is lost.

```ts
import { define, run, t } from 'littlewing';

const DISCOUNT = define({
	args: [t.number('price'), t.number('percent')],
	returns: t.number(),
	pure: true,
	doc: 'Take a percentage off a price',
	run: (price, percent) => price.times(percent.div(100).neg().plus(1)),
});

run('DISCOUNT(200, 15)', { functions: { DISCOUNT } }); // 170
```

A function declared `pure` can run at compile time. `littlewing/std` adds optional functions, as named exports, so a bundle only keeps what you use.

```ts
import { run } from 'littlewing';
import { ABS, SUM } from 'littlewing/std';
import * as std from 'littlewing/std';

run('SUM([1, 2]) + ABS(-1)', { functions: { ABS, SUM } }); // 4
run('MAX([1, 2])', { functions: std }); // 2
```

### Types

Anything that is not a number, string, boolean, array or record is an abstract type. A program can hold one and pass it around, and uses only the operations you give it.

```ts
import { define, defineType, run, t } from 'littlewing';

class Money {
	constructor(readonly cents: number) {}
}

const money = defineType<Money>({
	name: 'money',
	is: (value) => value instanceof Money,
	equals: (a, b) => a.cents === b.cents,
	compare: (a, b) => a.cents - b.cents,
	add: (a, b) => new Money(a.cents + b.cents),
	show: (a) => `$${(a.cents / 100).toFixed(2)}`,
});

const USD = define({
	args: [t.number()],
	returns: money,
	pure: true,
	run: (amount) => new Money(amount.times(100).toNumber()),
});

run('"#{USD(1.5) + USD(2)}"', { functions: { USD } }); // "$3.50"
```

### Dates

`littlewing/temporal` defines `date`, `time` and `datetime` this way, on [Temporal](https://tc39.es/proposal-temporal/). Where the platform has no `Temporal`, load a polyfill first: `import 'temporal-polyfill/global'`. `littlewing/clock` has `NOW` and `TODAY`, apart from the rest, so that formulas stay deterministic unless you say otherwise.

```ts
import { run } from 'littlewing';
import { TODAY } from 'littlewing/clock';
import { temporalFunctions } from 'littlewing/temporal';

const functions = { ...temporalFunctions, TODAY };

run('DIFF(DATE(2026, 1, 1), DATE(2026, 3, 1), "days")', { functions }); // 59
run('AGE(DATE(2000, 6, 15), TODAY()) > 18', { functions }); // true
```

### Budgets

Every `evaluate` spends from a budget of 20 million steps, which `limits.maxSteps` changes. A program that runs out fails with `limit-exceeded`, however it spent them, including through host functions, which are charged for what they take and give. `compile` has a budget of its own. Memory also grows with the length of the source, so cap the length of formulas you take from strangers.

```ts
import { compile, evaluate, EvaluationError } from 'littlewing';

const result = compile('for x in 0..1000000 into sum = 0 then sum + x');
if (result.ok) {
	try {
		evaluate(result.program, { limits: { maxSteps: 1000 } });
	} catch (error) {
		if (error instanceof EvaluationError) console.log(error.code); // 'limit-exceeded'
	}
}
```

Every failure of a program is an `EvaluationError`, with a stable `code`, and `start` and `end` offsets into the source, which are `0` for what fails outside the program. A failure in your own code is a `host-error`, with what you threw as `cause`. A mistake in how you call the API is a `TypeError`.

## Reference

- [LANGUAGE.md](https://github.com/brielov/littlewing/blob/master/LANGUAGE.md): the guide for people writing formulas
- [HOST_API.md](https://github.com/brielov/littlewing/blob/master/HOST_API.md): the whole host API
- [SPEC.md](https://github.com/brielov/littlewing/blob/master/SPEC.md): the language, normatively
- [UPGRADING.md](https://github.com/brielov/littlewing/blob/master/UPGRADING.md): moving from 2.x

## Contributing

See [CONTRIBUTING.md](https://github.com/brielov/littlewing/blob/master/CONTRIBUTING.md). Report a security problem as [SECURITY.md](https://github.com/brielov/littlewing/blob/master/SECURITY.md) says.

## License

MIT
