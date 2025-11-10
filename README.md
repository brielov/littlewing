# littlewing

A minimal, high-performance arithmetic expression language for JavaScript. Pure numbers, zero dependencies, built for the browser.

```typescript
import { execute, defaultContext } from "littlewing";

// Simple arithmetic
execute("2 + 3 * 4"); // → 14

// Variables and functions
execute("radius = 5; area = 3.14159 * radius ^ 2", defaultContext); // → 78.54

// Date arithmetic with timestamps
execute("deadline = NOW() + FROM_DAYS(7)", defaultContext); // → timestamp 7 days from now

// Conditional logic
execute("score = 85; grade = score >= 90 ? 100 : 90", {
	variables: { score: 85 },
}); // → 90
```

## Features

- **Numbers-only** - Every value is a number. Simple, predictable, fast.
- **Zero dependencies** - 6.15 KB gzipped, perfect for browser bundles
- **O(n) performance** - Linear time parsing and execution
- **Safe evaluation** - No eval(), no code generation, no security risks
- **Timestamp arithmetic** - Built-in date/time functions using numeric timestamps
- **Extensible** - Add custom functions and variables via context
- **Type-safe** - Full TypeScript support with strict types
- **99%+ test coverage** - 276 tests with 99.39% function coverage, 99.56% line coverage

## Installation

```bash
npm install littlewing
```

## Quick Start

### Basic Usage

```typescript
import { execute } from "littlewing";

// Arithmetic expressions
execute("2 + 3 * 4"); // → 14
execute("10 ^ 2"); // → 100
execute("17 % 5"); // → 2

// Variables
execute("x = 10; y = 20; x + y"); // → 30

// Comparisons (return 1 for true, 0 for false)
execute("5 > 3"); // → 1
execute("10 == 10"); // → 1
execute("2 != 2"); // → 0

// Logical operators
execute("1 && 1"); // → 1
execute("0 || 1"); // → 1

// Ternary conditionals
execute("age >= 18 ? 100 : 0", { variables: { age: 21 } }); // → 100
```

### With Built-in Functions

```typescript
import { execute, defaultContext } from "littlewing";

// Math functions
execute("ABS(-42)", defaultContext); // → 42
execute("SQRT(16)", defaultContext); // → 4
execute("MAX(3, 7, 2)", defaultContext); // → 7

// Current timestamp
execute("NOW()", defaultContext); // → 1704067200000

// Date arithmetic
execute("NOW() + FROM_HOURS(2)", defaultContext); // → timestamp 2 hours from now
execute("tomorrow = NOW() + FROM_DAYS(1)", defaultContext); // → tomorrow's timestamp

// Extract date components
const ctx = { ...defaultContext, variables: { ts: Date.now() } };
execute("GET_YEAR(ts)", ctx); // → 2024
execute("GET_MONTH(ts)", ctx); // → 11
execute("GET_DAY(ts)", ctx); // → 6

// Calculate time differences
const ts1 = Date.now();
const ts2 = ts1 + 1000 * 60 * 60 * 5; // 5 hours later
const context = { ...defaultContext, variables: { ts1, ts2 } };
execute("DIFFERENCE_IN_HOURS(ts1, ts2)", context); // → 5

// Date arithmetic and comparisons
execute("ADD_DAYS(NOW(), 7)", defaultContext); // → 7 days from now
execute("START_OF_DAY(NOW())", defaultContext); // → today at 00:00:00.000
execute("IS_WEEKEND(NOW())", defaultContext); // → 1 if today is Sat/Sun, else 0
```

### Custom Functions and Variables

```typescript
import { execute } from "littlewing";

const context = {
	functions: {
		// Custom functions must return numbers
		fahrenheit: (celsius: number) => (celsius * 9) / 5 + 32,
		discount: (price: number, percent: number) => price * (1 - percent / 100),
	},
	variables: {
		pi: 3.14159,
		taxRate: 0.08,
	},
};

execute("fahrenheit(20)", context); // → 68
execute("discount(100, 15)", context); // → 85
execute("100 * (1 + taxRate)", context); // → 108
```

### External Variables Override Script Defaults

```typescript
// Scripts can define default values
const formula = "multiplier = 2; value = 100; value * multiplier";

// Without external variables: uses script defaults
execute(formula); // → 200

// External variables override script assignments
execute(formula, { variables: { multiplier: 3 } }); // → 300
execute(formula, { variables: { value: 50 } }); // → 100

// Useful for configurable formulas
const pricing = `
  basePrice = 100;
  taxRate = 0.08;
  discount = 0;
  finalPrice = basePrice * (1 - discount) * (1 + taxRate)
`;

execute(pricing); // → 108 (uses all defaults)
execute(pricing, { variables: { discount: 0.1 } }); // → 97.2 (10% discount)
execute(pricing, { variables: { basePrice: 200, discount: 0.2 } }); // → 172.8
```

## Language Reference

For complete language documentation including all operators, functions, and examples, see [LANGUAGE.md](./LANGUAGE.md).

## API

### Main Functions

#### `execute(input: string | ASTNode, context?: ExecutionContext): number`

Execute an expression or AST and return the result. Accepts either a source string or a pre-parsed AST node.

```typescript
// Execute source string directly
execute("2 + 2"); // → 4
execute("ABS(-5)", { functions: { ABS: Math.abs } }); // → 5

// Execute pre-parsed AST (useful for parse-once, execute-many scenarios)
const ast = parseSource("2 + 2");
execute(ast); // → 4
execute(ast); // → 4 (no re-parsing)
```

#### `parseSource(source: string): ASTNode`

Parse source into an Abstract Syntax Tree without executing. Useful for parse-once, execute-many scenarios.

```typescript
const ast = parseSource("2 + 3 * 4");

// Execute multiple times with different contexts (no re-parsing)
execute(ast); // → 14
execute(ast, {
	variables: {
		/* ... */
	},
}); // → 14 (with context)

// Or use with Executor class or optimize() function
const optimized = optimize(ast);
```

#### `optimize(node: ASTNode): ASTNode`

Optimize an AST by folding constants. Safe for use with external variables.

```typescript
const ast = parseSource("2 + 3 * 4");
const optimized = optimize(ast); // → NumberLiteral(14)

// Variables are NOT folded (can be overridden by context)
const ast2 = parseSource("x = 5; x + 10");
const opt2 = optimize(ast2); // Still has variable reference
```

#### `generate(node: ASTNode): string`

Convert AST back to source code.

```typescript
const ast = parseSource("2 + 3 * 4");
generate(ast); // → "2 + 3 * 4"
```

### ExecutionContext

```typescript
interface ExecutionContext {
	functions?: Record<string, (...args: any[]) => number>;
	variables?: Record<string, number>;
}
```

### Default Context Functions

The `defaultContext` includes these built-in functions:

**Math:** `ABS`, `CEIL`, `FLOOR`, `ROUND`, `SQRT`, `MIN`, `MAX`, `CLAMP`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`

**Timestamps:** `NOW`, `DATE`

**Time converters (to milliseconds):** `FROM_DAYS`, `FROM_WEEKS`, `FROM_MONTHS`, `FROM_YEARS`

**Date component extractors:** `GET_YEAR`, `GET_MONTH`, `GET_DAY`, `GET_HOUR`, `GET_MINUTE`, `GET_SECOND`, `GET_WEEKDAY`, `GET_MILLISECOND`, `GET_DAY_OF_YEAR`, `GET_QUARTER`

**Time differences (always positive):** `DIFFERENCE_IN_SECONDS`, `DIFFERENCE_IN_MINUTES`, `DIFFERENCE_IN_HOURS`, `DIFFERENCE_IN_DAYS`, `DIFFERENCE_IN_WEEKS`, `DIFFERENCE_IN_MONTHS`, `DIFFERENCE_IN_YEARS`

**Start/End of period:** `START_OF_DAY`, `END_OF_DAY`, `START_OF_WEEK`, `START_OF_MONTH`, `END_OF_MONTH`, `START_OF_YEAR`, `END_OF_YEAR`, `START_OF_QUARTER`

**Date arithmetic:** `ADD_DAYS`, `ADD_MONTHS`, `ADD_YEARS`

**Date comparisons:** `IS_SAME_DAY`, `IS_WEEKEND`, `IS_LEAP_YEAR` (use `<`, `>`, `<=`, `>=` operators for before/after comparisons)

## Performance Optimization

For expressions that are executed multiple times with different contexts, parse once and reuse the AST:

```typescript
import { execute, parseSource } from "littlewing";

// Parse once
const formula = parseSource(
	"price * quantity * (1 - discount) * (1 + taxRate)",
);

// Execute many times with different values (no re-parsing)
execute(formula, {
	variables: { price: 10, quantity: 5, discount: 0.1, taxRate: 0.08 },
});
execute(formula, {
	variables: { price: 20, quantity: 3, discount: 0.15, taxRate: 0.08 },
});
execute(formula, {
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

Littlewing provides just enough: arithmetic expressions with variables and functions. It's safe (no code execution), fast (linear time), and tiny (5KB gzipped).

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
