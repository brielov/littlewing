# littlewing

A minimal, high-performance multi-type expression language for JavaScript. Seven types, zero compromise, built for the browser.

Upgrading? See the [upgrade guide](https://github.com/brielov/littlewing/blob/master/UPGRADING.md).

```typescript
import { evaluate, defaultContext } from 'littlewing';

// Arithmetic
evaluate('2 + 3 * 4'); // → 14

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Variables and conditionals
evaluate('price = 100; if price > 50 then "expensive" else "cheap"'); // → "expensive"

// Date arithmetic
evaluate('DIFFERENCE_IN_DAYS(TODAY(), DATE(2025, 12, 31))', defaultContext);

// Array comprehensions
evaluate('for x in 1..=5 then x ^ 2'); // → [1, 4, 9, 16, 25]

// Reduce with accumulator
evaluate('for x in [1, 2, 3, 4] into sum = 0 then sum + x'); // → 10

// Pipe operator — chain values through functions
evaluate('-5 |> ABS(?) |> STR(?)', defaultContext); // → "5"
```

## Features

- **Seven types** — Numbers, strings, booleans, dates (`Temporal.PlainDate`), times (`Temporal.PlainTime`), datetimes (`Temporal.PlainDateTime`), and homogeneous arrays
- **No implicit coercion** — Explicit type conversion via `STR()`, `NUM()`, etc.
- **Strict boolean logic** — `!`, `&&`, `||`, and `if` conditions require booleans
- **Control flow** — `if/then/else` expressions and `for/in/then` comprehensions with optional `when` guard and `into` accumulator
- **Bracket indexing** — `arr[0]`, `str[-1]`, with chaining (`matrix[0][1]`)
- **Pipe operator** — `x |> FUN(?) |> OTHER(?, 1)` chains values through function calls
- **Range expressions** — `1..5` (exclusive), `1..=5` (inclusive)
- **Deep equality** — `[1, 2] == [1, 2]` → `true`; cross-type `==` → `false`
- **82 built-in functions** — Math, string, array, date, time, and datetime operations
- **Bounded execution** — A step budget stops any program, within limits you set
- **Located errors** — Parse and runtime errors carry the source span of what failed
- **Extensible** — Add custom functions and variables via context
- **Type-safe** — Full TypeScript support with strict types
- **Zero runtime code in dependencies** — Requires a global `Temporal` API (native or polyfill); the `temporal-spec` dependency is types only
- **Tree-shakeable** — About 8 KB gzipped for `evaluate` alone, 12 KB with the standard library

## Installation

```bash
npm install littlewing
```

Dates and times need a global `Temporal`. Where the platform has none, install a polyfill and load it before evaluating anything:

```typescript
import 'temporal-polyfill/global';
```

Everything has to come from that one global: values made by a different Temporal implementation are rejected, including a polyfill imported directly on an engine that has a native one.

## Quick Start

### Basic Usage

```typescript
import { defaultContext, evaluate } from 'littlewing';

// Arithmetic
evaluate('2 + 3 * 4'); // → 14
evaluate('2 ^ 10'); // → 1024

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Booleans (comparisons return boolean, not 1/0)
evaluate('5 > 3'); // → true
evaluate('!(5 > 10)'); // → true

// Variables
evaluate('x = 10; y = 20; x + y'); // → 30

// Conditionals (condition must be boolean, else is required)
evaluate('age = 21; if age >= 18 then "adult" else "minor"'); // → "adult"

// Arrays and indexing
evaluate('[10, 20, 30][-1]'); // → 30
evaluate('[1, 2] + [3, 4]'); // → [1, 2, 3, 4]

// Ranges
evaluate('1..=5'); // → [1, 2, 3, 4, 5]

// For comprehensions (map, filter, reduce)
evaluate('for x in 1..=5 then x * 2'); // → [2, 4, 6, 8, 10]
evaluate('for x in 1..=10 when x % 2 == 0 then x'); // → [2, 4, 6, 8, 10]
evaluate('for x in [1, 2, 3] into sum = 0 then sum + x'); // → 6

// Pipe operator
evaluate('-42 |> ABS(?)', defaultContext); // → 42
evaluate('150 |> CLAMP(?, 0, 100)', defaultContext); // → 100
evaluate('-3 |> ABS(?) |> STR(?)', defaultContext); // → "3"
```

### With Built-in Functions

```typescript
import { evaluate, defaultContext } from 'littlewing';

// Math
evaluate('ABS(-42)', defaultContext); // → 42
evaluate('ROUND(3.7)', defaultContext); // → 4

// Type conversion
evaluate('NUM("42")', defaultContext); // → 42
evaluate('STR(42)', defaultContext); // → "42"

// String functions
evaluate('STR_UPPER("hello")', defaultContext); // → "HELLO"
evaluate('STR_SPLIT("a,b,c", ",")', defaultContext); // → ["a", "b", "c"]

// Array functions
evaluate('ARR_SORT([3, 1, 2])', defaultContext); // → [1, 2, 3]
evaluate('ARR_SUM([10, 20, 30])', defaultContext); // → 60
evaluate('ARR_JOIN(["a", "b", "c"], "-")', defaultContext); // → "a-b-c"

// Date functions
evaluate('TODAY()', defaultContext); // → Temporal.PlainDate
evaluate('ADD_DAYS(TODAY(), 7)', defaultContext); // → 7 days from now
evaluate('IS_WEEKEND(TODAY())', defaultContext); // → true or false

// Time functions
evaluate('TIME(14, 30, 0)', defaultContext); // → Temporal.PlainTime
evaluate('ADD_HOURS(TIME(10, 0, 0), 3)', defaultContext); // → 13:00:00

// DateTime functions
evaluate('NOW()', defaultContext); // → Temporal.PlainDateTime
evaluate('TO_DATE(NOW())', defaultContext); // → today's date
```

### Custom Functions and Variables

```typescript
import { evaluate, assertNumber, assertString } from 'littlewing';

const context = {
	functions: {
		FAHRENHEIT: (celsius) => {
			assertNumber(celsius, 'FAHRENHEIT');
			return (celsius * 9) / 5 + 32;
		},
		DISCOUNT: (price, percent) => {
			assertNumber(price, 'DISCOUNT', 'price');
			assertNumber(percent, 'DISCOUNT', 'percent');
			return price * (1 - percent / 100);
		},
	},
	variables: {
		pi: 3.14159,
		taxRate: 0.08,
	},
};

evaluate('FAHRENHEIT(20)', context); // → 68
evaluate('DISCOUNT(100, 15)', context); // → 85
evaluate('100 * (1 + taxRate)', context); // → 108
```

The assertion helpers (`assertNumber`, `assertInteger`, `assertString`, `assertBoolean`, `assertArray`, `assertDate`, `assertTime`, `assertDateTime`, `assertDateOrDateTime`, `assertTimeOrDateTime`, `assertRuntimeValue`) are the same ones used by the built-in standard library. They throw `TypeError` with consistent messages on type mismatch.

A function must return a language value: a result of `undefined`, `null`, an object or a mixed array fails the evaluation.

### Errors

Failures carry the source span of what failed, ready for an editor or a message, unless the AST was built by hand. `toLineColumn` turns an offset into a line and column.

```typescript
import { EvaluationError, ParseError, evaluate, toLineColumn } from 'littlewing';

const source = 'total = 10\ntotal + "a"';

try {
	evaluate(source);
} catch (err) {
	if (err instanceof ParseError || err instanceof EvaluationError) {
		console.log(err.message, source.slice(err.start, err.end));
		// → Operator '+' not supported for number and string  total + "a"
	}
	if (err instanceof EvaluationError) {
		console.log(err.cause); // → the TypeError, or what your function threw
	}
}
```

### Running Untrusted Programs

A program from a user cannot reach anything but the functions and variables you give it, and it cannot run forever: every evaluation has a budget, which bounds its time and memory. A failure while evaluating is an `EvaluationError`, a program that does not parse is a `ParseError`, and an invalid `variables` entry or `limits.maxSteps` is a `TypeError`, since that is a mistake in the host.

```typescript
import { LimitExceededError, defaultContext, evaluate } from 'littlewing';

try {
	evaluate('for i in 0..1000000 then for j in 0..1000000 then i', defaultContext);
} catch (err) {
	console.log(err.cause instanceof LimitExceededError); // → true
}
```

The budget is `limits.maxSteps`, 20 million steps by default. An evaluated node is one step, and operators and functions spend steps in proportion to the time and memory they use. It is a limit on work, not a clock, so here is what it means in practice. Measured with the worst programs we could find on Node, with `temporal-polyfill`:

- **Time:** a default budget lasts up to about 2.5 seconds, and typically well under one.
- **Memory:** a step holds at most about 16 bytes of data. With engine overhead, an evaluation peaked at about 450 MB on Node and 640 MB of RSS on Bun. If your process has less to spare, lower `maxSteps`: running out of memory is the one failure you cannot catch.
- **Results:** a result or scope larger than `maxSteps` elements and characters fails inside `evaluate`, so reading what you get back is safe too.

Some things are yours to keep bounded:

- **Source size.** The budget covers evaluation. Parsing and optimizing are linear but unmetered, so limit the length of the programs you accept. A few megabytes is already generous.
- **Your own functions.** They are charged for their arguments, but what they do with them is up to you. A call site looks a function up once per evaluation, so do not rely on changing `context.functions` during one.
- **Calling `evaluate` from a function.** A nested evaluation has its own budget, which multiplies the outer one.
- **Deep values.** A result can be nested as deep as the call stack allows, so a recursive walker of your own can still overflow it. That is a catchable error: a `RangeError` on most engines, an `InternalError` on Firefox.

### External Variables Override Script Defaults

```typescript
const formula = 'multiplier = 2; value = 100; value * multiplier';

evaluate(formula); // → 200
evaluate(formula, { variables: { multiplier: 3 } }); // → 300
evaluate(formula, { variables: { value: 50 } }); // → 100
```

## Language Reference

For complete language documentation including all operators, control flow, and built-in functions, see [LANGUAGE.md](./LANGUAGE.md).

## API

### Main Functions

#### `evaluate(input: string | ASTNode, context?: ExecutionContext): RuntimeValue`

Evaluate an expression or AST and return the result.

```typescript
evaluate('2 + 2'); // → 4

// Evaluate pre-parsed AST (parse once, evaluate many)
const ast = parse('price * quantity');
evaluate(ast, { variables: { price: 10, quantity: 5 } }); // → 50
evaluate(ast, { variables: { price: 20, quantity: 3 } }); // → 60
```

#### `evaluateScope(input: string | ASTNode, context?: ExecutionContext): Record<string, RuntimeValue>`

Evaluate and return all variables as a record, including those from the context, in no particular order.

```typescript
evaluateScope('x = 10; y = x * 2'); // → { x: 10, y: 20 }
```

#### `evaluateWithScope(input: string | ASTNode, context?: ExecutionContext): ExecutionResult`

Evaluate once and return both the final value and the full variable scope.

```typescript
evaluateWithScope('x = 10; y = x * 2; y + 1');
// → { value: 21, scope: { x: 10, y: 20 } }
```

#### `parse(source: string): ASTNode`

Parse source into an Abstract Syntax Tree without evaluating.

```typescript
const ast = parse('2 + 3 * 4');
evaluate(ast); // → 14
```

#### `generate(node: ASTNode): string`

Convert AST back to source code. It evaluates exactly like the AST, keeps statement comments, and adds parentheses only where needed.

```typescript
generate(parse('2 + (3 * 4)')); // → "2 + 3 * 4"
```

#### `optimize(node: ASTNode, options?: OptimizeOptions): ASTNode`

Optimize an AST with constant folding, constant propagation, and dead code elimination. The result evaluates exactly like the original: to the same value or the same failure, with the same function calls.

```typescript
optimize(parse('2 + 3 * 4')); // → NumberLiteral(14)

// `externalVariables` names what the host may supply, which enables propagation:
// everything else is taken to be fully determined by the program
optimize(parse('x = 5; y = 10; x + y'), { externalVariables: new Set(['x']) });
// → x = 5; x + 10
```

Without `preserveScope`, only the result is preserved: assignments that do not contribute to it are removed, so `evaluateScope` may miss a variable or report the value it held before. Pass `preserveScope: true` to keep every assignment.

#### `extractInputVariables(ast: ASTNode): string[]`

Extract the variables whose first assignment needs no other variable (useful for building UIs with input controls).

```typescript
const ast = parse('price = 100; tax = price * 0.08');
extractInputVariables(ast); // → ["price"]
```

#### `extractAssignedVariables(ast: ASTNode): string[]`

Extract the name of every assigned variable, in order of first assignment.

```typescript
extractAssignedVariables(parse('total = a + b; rate = 0.1')); // → ["total", "rate"]
```

### AST Visitor Pattern

#### `visit<T>(node: ASTNode, visitor: Visitor<T>): T`

Exhaustively visit every node in an AST. All 16 node types must be handled.

```typescript
import { visit, parse } from 'littlewing';

const count = visit(parse('2 + 3'), {
	Program: (n, recurse) => n.statements.reduce((s, stmt) => s + recurse(stmt), 0),
	NumberLiteral: () => 1,
	StringLiteral: () => 1,
	BooleanLiteral: () => 1,
	ArrayLiteral: (n, recurse) => 1 + n.elements.reduce((s, el) => s + recurse(el), 0),
	Identifier: () => 1,
	BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
	UnaryOp: (n, recurse) => 1 + recurse(n.argument),
	Assignment: (n, recurse) => 1 + recurse(n.value),
	FunctionCall: (n, recurse) => 1 + n.args.reduce((s, arg) => s + recurse(arg), 0),
	IfExpression: (n, recurse) =>
		1 + recurse(n.condition) + recurse(n.consequent) + recurse(n.alternate),
	ForExpression: (n, recurse) =>
		1 +
		recurse(n.iterable) +
		(n.accumulator ? recurse(n.accumulator.initial) : 0) +
		(n.guard ? recurse(n.guard) : 0) +
		recurse(n.body),
	IndexAccess: (n, recurse) => 1 + recurse(n.object) + recurse(n.index),
	RangeExpression: (n, recurse) => 1 + recurse(n.from) + recurse(n.to),
	PipeExpression: (n, recurse) =>
		1 + recurse(n.value) + n.args.reduce((s, arg) => s + recurse(arg), 0),
	Placeholder: () => 1,
});
```

#### `forEachChild(node, fn)` and `mapChildren(node, fn)`

Walk the direct children of a node in evaluation order, whatever its kind. `forEachChild` stops at the first truthy result and returns it. `mapChildren` rebuilds the node with each child replaced, returning the same node if nothing changed, and keeps spans and comments.

```typescript
import { forEachChild, isIdentifier, parse } from 'littlewing';

function names(node) {
	const found = isIdentifier(node) ? [node.name] : [];
	forEachChild(node, (child) => {
		found.push(...names(child));
	});
	return found;
}

names(parse('a + F(b)')); // → ['a', 'b']
```

### AST Builder Functions

The `ast` namespace provides builder functions for constructing AST nodes:

```typescript
import { ast, generate } from 'littlewing';

generate(ast.add(ast.number(2), ast.number(3))); // → "2 + 3"
generate(ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(0))); // → "if true then 1 else 0"
generate(
	ast.forExpr(
		'x',
		ast.identifier('arr'),
		null,
		null,
		ast.multiply(ast.identifier('x'), ast.number(2)),
	),
);
// → "for x in arr then x * 2"
```

**Available builders:**

- Core: `program()`, `number()`, `string()`, `boolean()`, `array()`, `identifier()`, `binaryOp()`, `unaryOp()`, `functionCall()`, `assign()`, `ifExpr()`, `forExpr()`, `indexAccess()`, `rangeExpr()`, `pipeExpr()`, `placeholder()`
- Arithmetic: `add()`, `subtract()`, `multiply()`, `divide()`, `modulo()`, `exponentiate()`, `negate()`
- Comparison: `equals()`, `notEquals()`, `lessThan()`, `greaterThan()`, `lessEqual()`, `greaterEqual()`
- Logical: `logicalAnd()`, `logicalOr()`, `logicalNot()`

### ExecutionContext

```typescript
interface ExecutionContext {
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>;
	variables?: Record<string, RuntimeValue>;
	limits?: { maxSteps?: number };
}

type RuntimeValue =
	| number
	| string
	| boolean
	| PlainDate
	| PlainTime
	| PlainDateTime
	| readonly RuntimeValue[];
```

`PlainDate`, `PlainTime` and `PlainDateTime` are exported for your own signatures. They are your project's global `Temporal` types if it declares any, and those of `temporal-spec` otherwise. Dates must use the ISO calendar. TypeScript 6 with `lib: ["ESNext"]` needs `skipLibCheck: true`, because `temporal-spec` disagrees with that lib about `Intl`.

`limits.maxSteps` defaults to `DEFAULT_MAX_STEPS`. The types are exported as `ExecutionContext`, `ExecutionLimits`, `ExecutionResult`, `HostFunction` and `OptimizeOptions`.

### Other Exports

- `typeOf(value)` names a value's type as `TYPE` does: `"number"`, `"date"`, `"array"` and so on
- `NodeKind` and the guards `isNumberLiteral()`, `isBinaryOp()` and so on, one per node type, for working with ASTs
- `core`, `math`, `string`, `array`, `datetime`, `time` and `datetimefull` hold the standard library by family, to pick from. Functions taken from these are charged like your own, unlike those in `defaultContext`, which meter themselves

### Default Context Functions

The `defaultContext` includes **82 built-in functions**:

**Core (8):** `STR`, `NUM`, `TYPE`, `LEN`, `SLICE`, `CONTAINS`, `REVERSE`, `INDEX_OF`

**Math (14):** `ABS`, `CEIL`, `FLOOR`, `ROUND`, `SQRT`, `MIN`, `MAX`, `CLAMP`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`

**String (8):** `STR_UPPER`, `STR_LOWER`, `STR_TRIM`, `STR_SPLIT`, `STR_REPLACE`, `STR_STARTS_WITH`, `STR_ENDS_WITH`, `STR_REPEAT`

**Array (7):** `ARR_SORT`, `ARR_UNIQUE`, `ARR_FLAT`, `ARR_JOIN`, `ARR_SUM`, `ARR_MIN`, `ARR_MAX`

**Date (25):** `TODAY`, `DATE`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DAY_OF_YEAR`, `QUARTER`, `ADD_DAYS`, `ADD_MONTHS`, `ADD_YEARS`, `DIFFERENCE_IN_DAYS`, `DIFFERENCE_IN_WEEKS`, `DIFFERENCE_IN_MONTHS`, `DIFFERENCE_IN_YEARS`, `START_OF_MONTH`, `END_OF_MONTH`, `START_OF_YEAR`, `END_OF_YEAR`, `START_OF_WEEK`, `START_OF_QUARTER`, `IS_SAME_DAY`, `IS_WEEKEND`, `IS_LEAP_YEAR`, `AGE`

**Time (13):** `TIME`, `NOW_TIME`, `HOUR`, `MINUTE`, `SECOND`, `MILLISECOND`, `ADD_HOURS`, `ADD_MINUTES`, `ADD_SECONDS`, `DIFFERENCE_IN_HOURS`, `DIFFERENCE_IN_MINUTES`, `DIFFERENCE_IN_SECONDS`, `IS_SAME_TIME`

**DateTime (7):** `DATETIME`, `NOW`, `TO_DATE`, `TO_TIME`, `COMBINE`, `START_OF_DAY`, `END_OF_DAY`

**Temporal type support:** Date functions accept both `PlainDate` and `PlainDateTime` (preserving type). Time functions accept both `PlainTime` and `PlainDateTime`. Difference functions require both arguments to be the same type.

## Performance Optimization

### Parse Once, Evaluate Many

For expressions executed multiple times, parse once and reuse the AST:

```typescript
import { evaluate, parse } from 'littlewing';

const formula = parse('price * quantity * (1 - discount)');

evaluate(formula, { variables: { price: 10, quantity: 5, discount: 0.1 } }); // → 45
evaluate(formula, { variables: { price: 20, quantity: 3, discount: 0.15 } }); // → 51
```

An AST compiles to code on its first evaluation, and keeps that code for as long as it lives, which is what makes reuse fast. So an AST must not change once evaluated, and to evaluate something only once, pass the source: `evaluate(source)` is more than twice as fast as `evaluate(parse(source))`, and holds on to nothing.

Parsing, optimizing and generating are linear in the size of the source. Evaluation takes as long as the program does, up to its budget.

## Use Cases

- **User-defined formulas** — Let users write safe expressions
- **Business rules** — Express logic without `eval()` or `new Function()`
- **Financial calculators** — Compound interest, loan payments, etc.
- **Date arithmetic** — Deadlines, scheduling, date calculations
- **Data transformations** — Map, filter, and reduce arrays
- **Configuration expressions** — Dynamic config values

## Why Littlewing?

### The Problem

Your app needs to evaluate user-provided formulas or dynamic expressions. Using `eval()` is a security risk. Writing a parser is complex. Embedding a full scripting language is overkill.

### The Solution

Littlewing provides just enough: expressions with multiple types, variables, and functions. It's safe (no code execution, bounded resources), fast, and type-safe (no implicit coercion).

### What Makes It Different

1. **Multi-type with strict semantics** — Seven types, no implicit coercion, no surprises
2. **External variables override** — Scripts have defaults, runtime provides overrides
3. **Full Temporal support** — First-class `PlainDate`, `PlainTime`, and `PlainDateTime`
4. **Deep equality** — Arrays and dates compare by value
5. **Bounded by design** — Every evaluation has a step budget

## Development

```bash
bun install     # Install dependencies
bun run test    # Run tests
bun run build   # Build
bun run --cwd packages/littlewing dev   # Watch mode
```

For detailed development docs, see [CLAUDE.md](./CLAUDE.md).

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
