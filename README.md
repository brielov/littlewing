# littlewing

A minimal, high-performance multi-type expression language for JavaScript. Seven types, zero compromise, built for the browser.

```typescript
import { evaluate, defaultContext } from "littlewing";

// Arithmetic
evaluate("2 + 3 * 4"); // → 14

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Variables and conditionals
evaluate('price = 100; if price > 50 then "expensive" else "cheap"'); // → "expensive"

// Date arithmetic
evaluate("DIFFERENCE_IN_DAYS(TODAY(), DATE(2025, 12, 31))", defaultContext);

// Array comprehensions
evaluate("for x in 1..=5 then x ^ 2"); // → [1, 4, 9, 16, 25]

// Reduce with accumulator
evaluate("for x in [1, 2, 3, 4] into sum = 0 then sum + x"); // → 10

// Pipe operator — chain values through functions
evaluate("-5 |> ABS(?) |> STR(?)", defaultContext); // → "5"
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
- **85 built-in functions** — Math, string, array, date, time, and datetime operations
- **O(n) performance** — Linear time parsing and execution
- **Safe evaluation** — Tree-walk interpreter, no code generation
- **Extensible** — Add custom functions and variables via context
- **Type-safe** — Full TypeScript support with strict types
- **Zero runtime dependencies** — Requires global `Temporal` API (native or polyfill)

## Installation

```bash
npm install littlewing
```

## Quick Start

### Basic Usage

```typescript
import { evaluate } from "littlewing";

// Arithmetic
evaluate("2 + 3 * 4"); // → 14
evaluate("2 ^ 10"); // → 1024

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Booleans (comparisons return boolean, not 1/0)
evaluate("5 > 3"); // → true
evaluate("!(5 > 10)"); // → true

// Variables
evaluate("x = 10; y = 20; x + y"); // → 30

// Conditionals (condition must be boolean, else is required)
evaluate('age = 21; if age >= 18 then "adult" else "minor"'); // → "adult"

// Arrays and indexing
evaluate("[10, 20, 30][-1]"); // → 30
evaluate("[1, 2] + [3, 4]"); // → [1, 2, 3, 4]

// Ranges
evaluate("1..=5"); // → [1, 2, 3, 4, 5]

// For comprehensions (map, filter, reduce)
evaluate("for x in 1..=5 then x * 2"); // → [2, 4, 6, 8, 10]
evaluate("for x in 1..=10 when x % 2 == 0 then x"); // → [2, 4, 6, 8, 10]
evaluate("for x in [1, 2, 3] into sum = 0 then sum + x"); // → 6

// Pipe operator
evaluate("-42 |> ABS(?)", defaultContext); // → 42
evaluate("150 |> CLAMP(?, 0, 100)", defaultContext); // → 100
evaluate("-3 |> ABS(?) |> STR(?)", defaultContext); // → "3"
```

### With Built-in Functions

```typescript
import { evaluate, defaultContext } from "littlewing";

// Math
evaluate("ABS(-42)", defaultContext); // → 42
evaluate("ROUND(3.7)", defaultContext); // → 4

// Type conversion
evaluate('NUM("42")', defaultContext); // → 42
evaluate("STR(42)", defaultContext); // → "42"

// String functions
evaluate('STR_UPPER("hello")', defaultContext); // → "HELLO"
evaluate('STR_SPLIT("a,b,c", ",")', defaultContext); // → ["a", "b", "c"]

// Array functions
evaluate("ARR_SORT([3, 1, 2])", defaultContext); // → [1, 2, 3]
evaluate("ARR_SUM([10, 20, 30])", defaultContext); // → 60
evaluate('ARR_JOIN(["a", "b", "c"], "-")', defaultContext); // → "a-b-c"

// Date functions
evaluate("TODAY()", defaultContext); // → Temporal.PlainDate
evaluate("ADD_DAYS(TODAY(), 7)", defaultContext); // → 7 days from now
evaluate("IS_WEEKEND(TODAY())", defaultContext); // → true or false

// Time functions
evaluate("TIME(14, 30, 0)", defaultContext); // → Temporal.PlainTime
evaluate("ADD_HOURS(TIME(10, 0, 0), 3)", defaultContext); // → 13:00:00

// DateTime functions
evaluate("NOW()", defaultContext); // → Temporal.PlainDateTime
evaluate("TO_DATE(NOW())", defaultContext); // → today's date
```

### Custom Functions and Variables

```typescript
import { evaluate, assertNumber, assertString } from "littlewing";

const context = {
	functions: {
		FAHRENHEIT: (celsius) => {
			assertNumber(celsius, "FAHRENHEIT");
			return (celsius * 9) / 5 + 32;
		},
		DISCOUNT: (price, percent) => {
			assertNumber(price, "DISCOUNT", "price");
			assertNumber(percent, "DISCOUNT", "percent");
			return price * (1 - percent / 100);
		},
	},
	variables: {
		pi: 3.14159,
		taxRate: 0.08,
	},
};

evaluate("FAHRENHEIT(20)", context); // → 68
evaluate("DISCOUNT(100, 15)", context); // → 85
evaluate("100 * (1 + taxRate)", context); // → 108
```

The assertion helpers (`assertNumber`, `assertString`, `assertBoolean`, `assertArray`, `assertDate`, `assertTime`, `assertDateTime`, `assertDateOrDateTime`, `assertTimeOrDateTime`) are the same ones used by the built-in standard library. They throw `TypeError` with consistent messages on type mismatch.

### External Variables Override Script Defaults

```typescript
const formula = "multiplier = 2; value = 100; value * multiplier";

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
evaluate("2 + 2"); // → 4

// Evaluate pre-parsed AST (parse once, evaluate many)
const ast = parse("price * quantity");
evaluate(ast, { variables: { price: 10, quantity: 5 } }); // → 50
evaluate(ast, { variables: { price: 20, quantity: 3 } }); // → 60
```

#### `evaluateScope(input: string | ASTNode, context?: ExecutionContext): Record<string, RuntimeValue>`

Evaluate and return all assigned variables as a record.

```typescript
evaluateScope("x = 10; y = x * 2"); // → { x: 10, y: 20 }
```

#### `parse(source: string): ASTNode`

Parse source into an Abstract Syntax Tree without evaluating.

```typescript
const ast = parse("2 + 3 * 4");
evaluate(ast); // → 14
```

#### `generate(node: ASTNode): string`

Convert AST back to source code (preserves comments).

```typescript
generate(parse("2 + 3 * 4")); // → "2 + 3 * 4"
```

#### `optimize(node: ASTNode, externalVariables?: ReadonlySet<string>): ASTNode`

Optimize an AST with constant folding, constant propagation, and dead code elimination.

```typescript
const ast = parse("2 + 3 * 4");
optimize(ast); // → NumberLiteral(14)

// With external variables: propagates internal constants while preserving external ones
const ast2 = parse("x = 5; y = 10; x + y");
optimize(ast2, new Set(["x"])); // Propagates y=10, keeps x as external
```

#### `extractInputVariables(ast: ASTNode): string[]`

Extract variable names assigned to constant values (useful for building UIs with input controls).

```typescript
const ast = parse("price = 100; tax = price * 0.08");
extractInputVariables(ast); // → ["price"]
```

### AST Visitor Pattern

#### `visit<T>(node: ASTNode, visitor: Visitor<T>): T`

Exhaustively visit every node in an AST. All 16 node types must be handled.

```typescript
import { visit, parse } from "littlewing";

const count = visit(parse("2 + 3"), {
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
		1 + recurse(n.iterable) + (n.guard ? recurse(n.guard) : 0) + recurse(n.body),
	IndexAccess: (n, recurse) => 1 + recurse(n.object) + recurse(n.index),
	RangeExpression: (n, recurse) => 1 + recurse(n.start) + recurse(n.end),
	PipeExpression: (n, recurse) =>
		1 + recurse(n.value) + n.args.reduce((s, arg) => s + recurse(arg), 0),
	Placeholder: () => 1,
});
```

#### `visitPartial<T>(node, visitor, defaultHandler): T`

Visit only specific node types with a fallback for unhandled types.

### AST Builder Functions

The `ast` namespace provides builder functions for constructing AST nodes:

```typescript
import { ast, generate } from "littlewing";

generate(ast.add(ast.number(2), ast.number(3))); // → "2 + 3"
generate(ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(0))); // → "if true then 1 else 0"
generate(
	ast.forExpr(
		"x",
		ast.identifier("arr"),
		null,
		null,
		ast.multiply(ast.identifier("x"), ast.number(2)),
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
}

type RuntimeValue =
	| number
	| string
	| boolean
	| Temporal.PlainDate
	| Temporal.PlainTime
	| Temporal.PlainDateTime
	| readonly RuntimeValue[];
```

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
import { evaluate, parse } from "littlewing";

const formula = parse("price * quantity * (1 - discount)");

evaluate(formula, { variables: { price: 10, quantity: 5, discount: 0.1 } }); // → 45
evaluate(formula, { variables: { price: 20, quantity: 3, discount: 0.15 } }); // → 51
```

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

Littlewing provides just enough: expressions with multiple types, variables, and functions. It's safe (no code execution), fast (linear time), and type-safe (no implicit coercion).

### What Makes It Different

1. **Multi-type with strict semantics** — Seven types, no implicit coercion, no surprises
2. **External variables override** — Scripts have defaults, runtime provides overrides
3. **Full Temporal support** — First-class `PlainDate`, `PlainTime`, and `PlainDateTime`
4. **Deep equality** — Arrays and dates compare by value
5. **O(n) everything** — Predictable performance at any scale

## Development

```bash
bun install     # Install dependencies
bun test        # Run tests
bun run build   # Build
bun run --cwd packages/littlewing dev   # Watch mode
```

For detailed development docs, see [CLAUDE.md](./CLAUDE.md).

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
