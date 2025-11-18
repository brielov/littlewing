# littlewing

A minimal, high-performance arithmetic expression language for JavaScript. Pure numbers, zero dependencies, built for the browser.

```typescript
import { evaluate, defaultContext } from "littlewing";

// Simple arithmetic
evaluate("2 + 3 * 4"); // → 14

// Variables and functions
evaluate("radius = 5; area = 3.14159 * radius ^ 2", defaultContext); // → 78.54

// Date arithmetic with timestamps
evaluate("deadline = NOW() + FROM_DAYS(7)", defaultContext); // → timestamp 7 days from now

// Conditional logic
evaluate("score = 85; grade = score >= 90 ? 100 : 90", {
	variables: { score: 85 },
}); // → 90
```

## Features

- **Numbers-only** - Every value is a number. Simple, predictable, fast.
- **Zero dependencies** - 7.8 KB gzipped, perfect for browser bundles
- **O(n) performance** - Linear time parsing and execution
- **Safe evaluation** - No eval(), no code generation, no security risks
- **Timestamp arithmetic** - Built-in date/time functions using numeric timestamps
- **Extensible** - Add custom functions and variables via context
- **Type-safe** - Full TypeScript support with strict types
- **Excellent test coverage** - 502 tests with 99.45% function coverage, 98.57% line coverage

## Installation

```bash
npm install littlewing
```

## Quick Start

### Basic Usage

```typescript
import { evaluate } from "littlewing";

// Arithmetic expressions
evaluate("2 + 3 * 4"); // → 14
evaluate("10 ^ 2"); // → 100
evaluate("17 % 5"); // → 2

// Variables
evaluate("x = 10; y = 20; x + y"); // → 30

// Comparisons (return 1 for true, 0 for false)
evaluate("5 > 3"); // → 1
evaluate("10 == 10"); // → 1
evaluate("2 != 2"); // → 0

// Logical operators
evaluate("!0"); // → 1 (NOT)
evaluate("1 && 1"); // → 1 (AND)
evaluate("0 || 1"); // → 1 (OR)
evaluate("!(5 > 10)"); // → 1 (negates comparison)

// Ternary conditionals
evaluate("age >= 18 ? 100 : 0", { variables: { age: 21 } }); // → 100
evaluate("!isBlocked ? 100 : 0", { variables: { isBlocked: 0 } }); // → 100
```

### With Built-in Functions

```typescript
import { evaluate, defaultContext } from "littlewing";

// Math functions
evaluate("ABS(-42)", defaultContext); // → 42
evaluate("SQRT(16)", defaultContext); // → 4
evaluate("MAX(3, 7, 2)", defaultContext); // → 7

// Current timestamp
evaluate("NOW()", defaultContext); // → 1704067200000

// Date arithmetic
evaluate("NOW() + FROM_DAYS(7)", defaultContext); // → timestamp 7 days from now
evaluate("tomorrow = NOW() + FROM_DAYS(1)", defaultContext); // → tomorrow's timestamp

// Extract date components
const ctx = { ...defaultContext, variables: { ts: Date.now() } };
evaluate("GET_YEAR(ts)", ctx); // → 2024
evaluate("GET_MONTH(ts)", ctx); // → 11
evaluate("GET_DAY(ts)", ctx); // → 6

// Calculate time differences
const ts1 = Date.now();
const ts2 = ts1 + 1000 * 60 * 60 * 5; // 5 hours later
const context = { ...defaultContext, variables: { ts1, ts2 } };
evaluate("DIFFERENCE_IN_HOURS(ts1, ts2)", context); // → 5

// Date arithmetic and comparisons
evaluate("ADD_DAYS(NOW(), 7)", defaultContext); // → 7 days from now
evaluate("START_OF_DAY(NOW())", defaultContext); // → today at 00:00:00.000
evaluate("IS_WEEKEND(NOW())", defaultContext); // → 1 if today is Sat/Sun, else 0
```

### Custom Functions and Variables

```typescript
import { evaluate } from "littlewing";

const context = {
	functions: {
		// Custom functions should use UPPERCASE naming (like built-in functions)
		FAHRENHEIT: (celsius: number) => (celsius * 9) / 5 + 32,
		DISCOUNT: (price: number, percent: number) => price * (1 - percent / 100),
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
// Scripts can define default values
const formula = "multiplier = 2; value = 100; value * multiplier";

// Without external variables: uses script defaults
evaluate(formula); // → 200

// External variables override script assignments
evaluate(formula, { variables: { multiplier: 3 } }); // → 300
evaluate(formula, { variables: { value: 50 } }); // → 100

// Useful for configurable formulas
const pricing = `
  basePrice = 100;
  taxRate = 0.08;
  discount = 0;
  finalPrice = basePrice * (1 - discount) * (1 + taxRate)
`;

evaluate(pricing); // → 108 (uses all defaults)
evaluate(pricing, { variables: { discount: 0.1 } }); // → 97.2 (10% discount)
evaluate(pricing, { variables: { basePrice: 200, discount: 0.2 } }); // → 172.8
```

## Language Reference

For complete language documentation including all operators, functions, and examples, see [LANGUAGE.md](./LANGUAGE.md).

## API

### Main Functions

#### `evaluate(input: string | ASTNode, context?: ExecutionContext): number`

Evaluate an expression or AST and return the result. Accepts either a source string or a pre-parsed AST node.

```typescript
// Evaluate source string directly
evaluate("2 + 2"); // → 4
evaluate("ABS(-5)", { functions: { ABS: Math.abs } }); // → 5

// Evaluate pre-parsed AST (useful for parse-once, evaluate-many scenarios)
const ast = parse("2 + 2");
evaluate(ast); // → 4
evaluate(ast); // → 4 (no re-parsing)
```

#### `parse(source: string): ASTNode`

Parse source into an Abstract Syntax Tree without evaluating. Useful for parse-once, execute-many scenarios.

```typescript
const ast = parse("2 + 3 * 4");

// Evaluate multiple times with different contexts (no re-parsing)
evaluate(ast); // → 14
evaluate(ast, {
	variables: {
		/* ... */
	},
}); // → 14 (with context)

// Or use with optimize() function
const optimized = optimize(ast);
```

#### `optimize(node: ASTNode): ASTNode`

Optimize an AST with constant folding and dead code elimination. Safe for use with external variables.

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
```

#### `humanize(node: ASTNode, options?: HumanizeOptions): string`

Convert AST to human-readable English text.

```typescript
const ast = parse("x + 10");
humanize(ast); // → "x plus 10"

// With HTML output
humanize(ast, { html: true }); // → "<span class='identifier'>x</span> plus <span class='number'>10</span>"
```

#### `extractInputVariables(ast: ASTNode): string[]`

Extract all variable identifiers that are assigned to constant values (literals, constant expressions, or function calls with constant arguments). Variables computed from other variables are excluded.

```typescript
const ast = parse("price = 100; tax = price * 0.08");
extractInputVariables(ast); // → ["price"]
// 'tax' is excluded because it's computed from 'price'

const ast2 = parse("x = 10; y = 20; sum = x + y");
extractInputVariables(ast2); // → ["x", "y"]
// 'sum' is excluded because it's computed from 'x' and 'y'
```

### AST Visitor Pattern

The visitor pattern provides a centralized, type-safe way to traverse and transform ASTs. This is useful for implementing custom analyzers, transformers, or code generators.

#### `visit<T>(node: ASTNode, visitor: Visitor<T>): T`

Exhaustively visit every node in an AST. All node types must be handled.

```typescript
import { visit, parse } from "littlewing";

const ast = parse("x = 5; x + 10");

// Count all identifiers in an AST
const count = visit(ast, {
	// Tuple: [kind, statements]
	Program: (n, recurse) => {
		const statements = n[1];
		return statements.reduce((sum, stmt) => sum + recurse(stmt), 0);
	},
	NumberLiteral: () => 0,
	Identifier: () => 1,
	// Tuple: [kind, left, operator, right]
	BinaryOp: (n, recurse) => recurse(n[1]) + recurse(n[3]),
	// Tuple: [kind, operator, argument]
	UnaryOp: (n, recurse) => recurse(n[2]),
	// Tuple: [kind, name, value]
	Assignment: (n, recurse) => 1 + recurse(n[2]),
	// Tuple: [kind, name, arguments]
	FunctionCall: (n, recurse) => {
		const args = n[2];
		return 1 + args.reduce((sum, arg) => sum + recurse(arg), 0);
	},
	// Tuple: [kind, condition, consequent, alternate]
	ConditionalExpression: (n, recurse) =>
		recurse(n[1]) + recurse(n[2]) + recurse(n[3]),
}); // → 3 (x appears 3 times)
```

#### `visitPartial<T>(node: ASTNode, visitor: Partial<Visitor<T>>, defaultHandler: (node: ASTNode, recurse: (n: ASTNode) => T) => T): T`

Visit only specific node types. The `defaultHandler` is called for unhandled node types.

```typescript
import { visitPartial, parse } from "littlewing";

const ast = parse("x = 5; y = x + 10; y * 2");

// Find first assignment to a specific variable
const result = visitPartial(
	ast,
	{
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1];
			for (const stmt of statements) {
				const found = recurse(stmt);
				if (found !== undefined) return found;
			}
			return undefined;
		},
		// Tuple: [kind, name, value]
		Assignment: (n, recurse) => {
			const name = n[1];
			const value = n[2];
			if (name === "y") return n; // Found it!
			return recurse(value); // Keep searching
		},
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => recurse(n[1]) ?? recurse(n[3]),
	},
	() => undefined,
); // → Assignment node for "y = x + 10"
```

#### Transform Pattern

Use `visit<ASTNode>` to create AST transformers:

```typescript
import { visit, parse, ast } from "littlewing";

// Double all numeric literals
const transformed = visit<ASTNode>(parse("2 + 3 * 4"), {
	// Tuple: [kind, statements]
	Program: (n, recurse) => {
		const statements = n[1];
		return ast.program(statements.map((stmt) => recurse(stmt)));
	},
	// Tuple: [kind, value]
	NumberLiteral: (n) => ast.number(n[1] * 2),
	Identifier: (n) => n,
	// Tuple: [kind, left, operator, right]
	BinaryOp: (n, recurse) => ast.binaryOp(recurse(n[1]), n[2], recurse(n[3])),
	// Tuple: [kind, operator, argument]
	UnaryOp: (n, recurse) => ast.unaryOp(n[1], recurse(n[2])),
	// Tuple: [kind, name, value]
	Assignment: (n, recurse) => ast.assign(n[1], recurse(n[2])),
	// Tuple: [kind, name, arguments]
	FunctionCall: (n, recurse) => {
		const name = n[1];
		const args = n[2];
		return ast.functionCall(name, args.map(recurse));
	},
	// Tuple: [kind, condition, consequent, alternate]
	ConditionalExpression: (n, recurse) =>
		ast.conditional(recurse(n[1]), recurse(n[2]), recurse(n[3])),
});

generate(transformed); // → "4 + 6 * 8"
```

### AST Builder Functions

The `ast` namespace provides builder functions for constructing AST nodes manually:

```typescript
import { ast, generate } from "littlewing";

// Core builders
const node = ast.binaryOp(ast.number(2), "+", ast.number(3));
generate(node); // → "2 + 3"

// Convenience builders
const expr = ast.add(ast.identifier("x"), ast.number(10));
generate(expr); // → "x + 10"
```

**Available builders:**

- Core: `program()`, `number()`, `identifier()`, `binaryOp()`, `unaryOp()`, `functionCall()`, `assignment()`, `conditional()`
- Arithmetic: `add()`, `subtract()`, `multiply()`, `divide()`, `modulo()`, `exponentiate()`, `negate()`
- Comparison: `equals()`, `notEquals()`, `lessThan()`, `greaterThan()`, `lessEqual()`, `greaterEqual()`
- Logical: `logicalAnd()`, `logicalOr()`, `logicalNot()`

### ExecutionContext

```typescript
interface ExecutionContext {
	functions?: Record<string, (...args: number[]) => number>;
	variables?: Record<string, number>;
}
```

### Default Context Functions

The `defaultContext` includes these built-in functions:

**Math (14 functions):** `ABS`, `CEIL`, `FLOOR`, `ROUND`, `SQRT`, `MIN`, `MAX`, `CLAMP`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`

**Timestamps (2 functions):** `NOW`, `DATE`

**Time converters (4 functions, to milliseconds):** `FROM_DAYS`, `FROM_WEEKS`, `FROM_MONTHS`, `FROM_YEARS`

**Date component extractors (10 functions):** `GET_YEAR`, `GET_MONTH`, `GET_DAY`, `GET_HOUR`, `GET_MINUTE`, `GET_SECOND`, `GET_WEEKDAY`, `GET_MILLISECOND`, `GET_DAY_OF_YEAR`, `GET_QUARTER`

**Time differences (7 functions, always positive):** `DIFFERENCE_IN_SECONDS`, `DIFFERENCE_IN_MINUTES`, `DIFFERENCE_IN_HOURS`, `DIFFERENCE_IN_DAYS`, `DIFFERENCE_IN_WEEKS`, `DIFFERENCE_IN_MONTHS`, `DIFFERENCE_IN_YEARS`

**Start/End of period (8 functions):** `START_OF_DAY`, `END_OF_DAY`, `START_OF_WEEK`, `START_OF_MONTH`, `END_OF_MONTH`, `START_OF_YEAR`, `END_OF_YEAR`, `START_OF_QUARTER`

**Date arithmetic (3 functions):** `ADD_DAYS`, `ADD_MONTHS`, `ADD_YEARS`

**Date comparisons (3 functions):** `IS_SAME_DAY`, `IS_WEEKEND`, `IS_LEAP_YEAR`

**Note:** For before/after comparisons, use the comparison operators directly: `ts1 < ts2`, `ts1 > ts2`, `ts1 <= ts2`, `ts1 >= ts2`

**Total: 54 built-in functions**

## Performance Optimization

For expressions that are executed multiple times with different contexts, parse once and reuse the AST:

```typescript
import { evaluate, parse } from "littlewing";

// Parse once
const formula = parse("price * quantity * (1 - discount) * (1 + taxRate)");

// Evaluate many times with different values (no re-parsing)
evaluate(formula, {
	variables: { price: 10, quantity: 5, discount: 0.1, taxRate: 0.08 },
});
evaluate(formula, {
	variables: { price: 20, quantity: 3, discount: 0.15, taxRate: 0.08 },
});
evaluate(formula, {
	variables: { price: 15, quantity: 10, discount: 0.2, taxRate: 0.08 },
});

// This avoids lexing and parsing overhead on every execution
```

## Use Cases

- **User-defined formulas** - Let users write safe arithmetic expressions
- **Business rules** - Express logic without eval() or new Function()
- **Financial calculators** - Compound interest, loan payments, etc.
- **Date arithmetic** - Deadlines, scheduling, time calculations
- **Game mechanics** - Damage formulas, score calculations
- **Configuration expressions** - Dynamic config values
- **Data transformations** - Process numeric data streams

## Why Littlewing?

### The Problem

Your app needs to evaluate user-provided formulas or dynamic expressions. Using `eval()` is a security risk. Writing a parser is complex. Embedding a full scripting language is overkill.

### The Solution

Littlewing provides just enough: arithmetic expressions with variables and functions. It's safe (no code execution), fast (linear time), and tiny (7.8 KB gzipped).

### What Makes It Different

1. **Numbers-only by design** - No string concatenation, no type coercion, no confusion
2. **External variables override** - Scripts have defaults, runtime provides overrides
3. **Timestamp arithmetic** - Dates are just numbers (milliseconds)
4. **Zero dependencies** - No bloat, no supply chain risks
5. **O(n) everything** - Predictable performance at any scale

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Develop with watch mode
bun run dev
```

For detailed development docs, see [CLAUDE.md](./CLAUDE.md).

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
