# littlewing

A minimal, high-performance multi-type expression language for JavaScript. Five types, zero compromise, built for the browser.

```typescript
import { evaluate, defaultContext } from "littlewing";

// Arithmetic
evaluate("2 + 3 * 4"); // → 14

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Booleans
evaluate("5 > 3"); // → true

// Variables and functions
evaluate("radius = 5; 3.14159 * radius ^ 2"); // → 78.54

// Date arithmetic
evaluate("DIFFERENCE_IN_DAYS(TODAY(), DATE(2025, 12, 31))", defaultContext);

// Arrays
evaluate("[1, 2] + [3, 4]"); // → [1, 2, 3, 4]
```

## Features

- **Five types** - Numbers, strings, booleans, dates (`Temporal.PlainDate`), and homogeneous arrays
- **No implicit coercion** - Explicit type conversion via `STR()`, `NUM()`, etc.
- **Strict boolean logic** - `!`, `&&`, `||`, and ternary conditions require booleans
- **Deep equality** - `[1, 2] == [1, 2]` → `true`; cross-type `==` → `false`
- **O(n) performance** - Linear time parsing and execution
- **Safe evaluation** - Tree-walk interpreter, no code generation
- **Date arithmetic** - Built-in functions using `Temporal.PlainDate`
- **Extensible** - Add custom functions and variables via context
- **Type-safe** - Full TypeScript support with strict types

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
evaluate("10 ^ 2"); // → 100

// Strings
evaluate('"hello" + " world"'); // → "hello world"

// Booleans (comparisons return boolean, not 1/0)
evaluate("5 > 3"); // → true
evaluate("10 == 10"); // → true

// Logical operators (require boolean operands)
evaluate("!false"); // → true
evaluate("true && true"); // → true
evaluate("false || true"); // → true
evaluate("!(5 > 10)"); // → true

// Variables
evaluate("x = 10; y = 20; x + y"); // → 30

// Ternary conditionals (condition must be boolean)
evaluate("age >= 18 ? 100 : 0", { variables: { age: 21 } }); // → 100

// Arrays
evaluate("[1, 2, 3]"); // → [1, 2, 3]
evaluate("[1, 2] + [3, 4]"); // → [1, 2, 3, 4]
```

### With Built-in Functions

```typescript
import { evaluate, defaultContext } from "littlewing";

// Math functions
evaluate("ABS(-42)", defaultContext); // → 42
evaluate("SQRT(16)", defaultContext); // → 4
evaluate("MAX(3, 7, 2)", defaultContext); // → 7

// Type conversion
evaluate('NUM("42")', defaultContext); // → 42
evaluate("STR(42)", defaultContext); // → "42"
evaluate("TYPE(42)", defaultContext); // → "number"

// String functions
evaluate('STR_UPPER("hello")', defaultContext); // → "HELLO"
evaluate('STR_CONTAINS("hello world", "world")', defaultContext); // → true

// Array functions
evaluate("ARR_LEN([1, 2, 3])", defaultContext); // → 3
evaluate("ARR_REVERSE([1, 2, 3])", defaultContext); // → [3, 2, 1]

// Date functions
evaluate("TODAY()", defaultContext); // → Temporal.PlainDate
evaluate("DATE(2024, 6, 15)", defaultContext); // → Temporal.PlainDate for 2024-06-15
evaluate("ADD_DAYS(TODAY(), 7)", defaultContext); // → 7 days from now
evaluate("IS_WEEKEND(TODAY())", defaultContext); // → true or false
```

### Custom Functions and Variables

```typescript
import { evaluate } from "littlewing";

const context = {
	functions: {
		FAHRENHEIT: (celsius) => (celsius * 9) / 5 + 32,
		DISCOUNT: (price, percent) => price * (1 - percent / 100),
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

### External Variables Override Script Defaults

```typescript
const formula = "multiplier = 2; value = 100; value * multiplier";

evaluate(formula); // → 200
evaluate(formula, { variables: { multiplier: 3 } }); // → 300
evaluate(formula, { variables: { value: 50 } }); // → 100
```

## Language Reference

For complete language documentation including all operators, functions, and examples, see [LANGUAGE.md](./LANGUAGE.md).

## API

### Main Functions

#### `evaluate(input: string | ASTNode, context?: ExecutionContext): RuntimeValue`

Evaluate an expression or AST and return the result.

```typescript
evaluate("2 + 2"); // → 4
evaluate('"hello" + " world"'); // → "hello world"
evaluate("5 > 3"); // → true

// Evaluate pre-parsed AST (parse once, evaluate many)
const ast = parse("price * quantity");
evaluate(ast, { variables: { price: 10, quantity: 5 } }); // → 50
evaluate(ast, { variables: { price: 20, quantity: 3 } }); // → 60
```

#### `parse(source: string): ASTNode`

Parse source into an Abstract Syntax Tree without evaluating.

```typescript
const ast = parse("2 + 3 * 4");
evaluate(ast); // → 14

const optimized = optimize(ast);
evaluate(optimized); // → 14
```

#### `optimize(node: ASTNode): ASTNode`

Optimize an AST with constant folding and dead code elimination.

```typescript
const ast = parse("2 + 3 * 4");
const optimized = optimize(ast); // → NumberLiteral(14)

// Variables are NOT folded (can be overridden by context)
const ast2 = parse("x = 5; x + 10");
const opt2 = optimize(ast2); // Still has variable reference

// Dead code elimination removes unused variables
const ast3 = parse("x = 10; y = 20; z = x * 20");
const opt3 = optimize(ast3); // Removes unused y assignment
```

#### `generate(node: ASTNode): string`

Convert AST back to source code.

```typescript
const ast = parse("2 + 3 * 4");
generate(ast); // → "2 + 3 * 4"

generate(parse('"hello"')); // → '"hello"'
generate(parse("[1, 2, 3]")); // → "[1, 2, 3]"
```

#### `extractInputVariables(ast: ASTNode): string[]`

Extract variable identifiers assigned to constant values.

```typescript
const ast = parse("price = 100; tax = price * 0.08");
extractInputVariables(ast); // → ["price"]

const ast2 = parse("x = 10; y = 20; sum = x + y");
extractInputVariables(ast2); // → ["x", "y"]
```

### AST Visitor Pattern

#### `visit<T>(node: ASTNode, visitor: Visitor<T>): T`

Exhaustively visit every node in an AST. All 11 node types must be handled.

```typescript
import { visit, parse } from "littlewing";

const count = visit(parse("x + 10"), {
	Program: (n, recurse) => n[1].reduce((s, stmt) => s + recurse(stmt), 0),
	NumberLiteral: () => 1,
	StringLiteral: () => 1,
	BooleanLiteral: () => 1,
	ArrayLiteral: (n, recurse) => 1 + n[1].reduce((s, el) => s + recurse(el), 0),
	Identifier: () => 1,
	BinaryOp: (n, recurse) => 1 + recurse(n[1]) + recurse(n[3]),
	UnaryOp: (n, recurse) => 1 + recurse(n[2]),
	Assignment: (n, recurse) => 1 + recurse(n[2]),
	FunctionCall: (n, recurse) => 1 + n[2].reduce((s, arg) => s + recurse(arg), 0),
	ConditionalExpression: (n, recurse) => 1 + recurse(n[1]) + recurse(n[2]) + recurse(n[3]),
});
```

#### `visitPartial<T>(node, visitor, defaultHandler): T`

Visit only specific node types with a fallback for unhandled types.

### AST Builder Functions

The `ast` namespace provides builder functions for constructing AST nodes:

```typescript
import { ast, generate } from "littlewing";

// Core builders
generate(ast.add(ast.number(2), ast.number(3))); // → "2 + 3"
generate(ast.string("hello")); // → '"hello"'
generate(ast.boolean(true)); // → "true"
generate(ast.array([ast.number(1), ast.number(2)])); // → "[1, 2]"
```

**Available builders:**

- Core: `program()`, `number()`, `string()`, `boolean()`, `array()`, `identifier()`, `binaryOp()`, `unaryOp()`, `functionCall()`, `assign()`, `conditional()`
- Arithmetic: `add()`, `subtract()`, `multiply()`, `divide()`, `modulo()`, `exponentiate()`, `negate()`
- Comparison: `equals()`, `notEquals()`, `lessThan()`, `greaterThan()`, `lessEqual()`, `greaterEqual()`
- Logical: `logicalAnd()`, `logicalOr()`, `logicalNot()`

### ExecutionContext

```typescript
interface ExecutionContext {
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>;
	variables?: Record<string, RuntimeValue>;
}

type RuntimeValue = number | string | boolean | Temporal.PlainDate | readonly RuntimeValue[];
```

### Default Context Functions

The `defaultContext` includes 57 built-in functions:

**Type Conversion (3):** `STR`, `NUM`, `TYPE`

**Math (14):** `ABS`, `CEIL`, `FLOOR`, `ROUND`, `SQRT`, `MIN`, `MAX`, `CLAMP`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`

**String (8):** `STR_LEN`, `STR_CHAR_AT`, `STR_UPPER`, `STR_LOWER`, `STR_TRIM`, `STR_SLICE`, `STR_CONTAINS`, `STR_INDEX_OF`

**Array (8):** `ARR_LEN`, `ARR_INDEX`, `ARR_PUSH`, `ARR_SLICE`, `ARR_CONTAINS`, `ARR_REVERSE`, `ARR_FIRST`, `ARR_LAST`

**Date (24):** `TODAY`, `DATE`, `GET_YEAR`, `GET_MONTH`, `GET_DAY`, `GET_WEEKDAY`, `GET_DAY_OF_YEAR`, `GET_QUARTER`, `ADD_DAYS`, `ADD_MONTHS`, `ADD_YEARS`, `DIFFERENCE_IN_DAYS`, `DIFFERENCE_IN_WEEKS`, `DIFFERENCE_IN_MONTHS`, `DIFFERENCE_IN_YEARS`, `START_OF_MONTH`, `END_OF_MONTH`, `START_OF_YEAR`, `END_OF_YEAR`, `START_OF_WEEK`, `START_OF_QUARTER`, `IS_SAME_DAY`, `IS_WEEKEND`, `IS_LEAP_YEAR`

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

- **User-defined formulas** - Let users write safe expressions
- **Business rules** - Express logic without eval() or new Function()
- **Financial calculators** - Compound interest, loan payments, etc.
- **Date arithmetic** - Deadlines, scheduling, date calculations
- **Game mechanics** - Damage formulas, score calculations
- **Configuration expressions** - Dynamic config values
- **Data transformations** - Process and transform data

## Why Littlewing?

### The Problem

Your app needs to evaluate user-provided formulas or dynamic expressions. Using `eval()` is a security risk. Writing a parser is complex. Embedding a full scripting language is overkill.

### The Solution

Littlewing provides just enough: expressions with multiple types, variables, and functions. It's safe (no code execution), fast (linear time), and type-safe (no implicit coercion).

### What Makes It Different

1. **Multi-type with strict semantics** - Five types, no implicit coercion, no surprises
2. **External variables override** - Scripts have defaults, runtime provides overrides
3. **Date arithmetic** - First-class `Temporal.PlainDate` support
4. **Deep equality** - Arrays and dates compare by value
5. **O(n) everything** - Predictable performance at any scale

## Development

```bash
bun install     # Install dependencies
bun test        # Run tests
bun run build   # Build
bun run dev     # Watch mode
```

For detailed development docs, see [CLAUDE.md](./CLAUDE.md).

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
