# littlewing

A minimal, high-performance arithmetic expression language with a complete lexer, parser, and executor. Optimized for browsers with **zero dependencies** and **type-safe execution**.

## Features

- 🚀 **Minimal & Fast** - O(n) algorithms throughout (lexer, parser, executor)
- 📦 **Tiny Bundle** - 4.20 KB gzipped, zero dependencies
- 🌐 **Browser Ready** - 100% ESM, no Node.js APIs
- 🔒 **Type-Safe** - Strict TypeScript with full type coverage
- ✅ **Thoroughly Tested** - 136 tests, 99.52% line coverage
- 📐 **Pure Arithmetic** - Numbers-only, clean semantics
- 🎯 **Clean API** - Intuitive dual API (class-based + functional)
- 📝 **Well Documented** - Complete JSDoc and examples

## Installation

```bash
npm install littlewing
```

## Quick Start

### Basic Usage

```typescript
import { execute, defaultContext } from "littlewing";

// Simple arithmetic
execute("2 + 3 * 4"); // → 14

// Variables
execute("x = 5; y = 10; x + y"); // → 15

// Functions from context
execute("abs(-42)", defaultContext); // → 42
execute("sqrt(16)", defaultContext); // → 4
```

### With Custom Context

```typescript
import { execute } from "littlewing";

const context = {
	functions: {
		double: (n) => n * 2,
		triple: (n) => n * 3,
	},
	variables: {
		pi: 3.14159,
		maxValue: 100,
	},
};

execute("double(5)", context); // → 10
execute("pi * 2", context); // → 6.28318
execute("maxValue - 25", context); // → 75
```

### Timestamp Arithmetic

Littlewing uses a numbers-only type system. Timestamps (milliseconds since Unix epoch) are just numbers, enabling clean date arithmetic:

```typescript
import { execute, defaultContext } from "littlewing";

// Get current timestamp
execute("now()", defaultContext); // → 1704067200000 (number)

// Create timestamp from date components
execute("timestamp(2025, 10, 1)", defaultContext); // → timestamp for Oct 1, 2025

// Add time durations (all return milliseconds)
execute("now() + minutes(30)", defaultContext); // → timestamp 30 minutes from now
execute("now() + hours(2) + minutes(15)", defaultContext); // → 2h 15m from now

// Time conversion helpers
execute("seconds(30)", defaultContext); // → 30000 (milliseconds)
execute("minutes(5)", defaultContext); // → 300000 (milliseconds)
execute("hours(2)", defaultContext); // → 7200000 (milliseconds)
execute("days(7)", defaultContext); // → 604800000 (milliseconds)
execute("weeks(2)", defaultContext); // → 1209600000 (milliseconds)

// Extract components from timestamps
const timestamp = new Date("2024-06-15T14:30:00").getTime();
execute("year(t)", { ...defaultContext, variables: { t: timestamp } }); // → 2024
execute("month(t)", { ...defaultContext, variables: { t: timestamp } }); // → 6 (June)
execute("day(t)", { ...defaultContext, variables: { t: timestamp } }); // → 15
execute("hour(t)", { ...defaultContext, variables: { t: timestamp } }); // → 14

// Convert result back to Date when needed
const result = execute("now() + days(7)", defaultContext);
const futureDate = new Date(result); // JavaScript Date object
```

### Manual AST Construction

```typescript
import { ast, Executor } from "littlewing";

const expr = ast.add(ast.number(2), ast.multiply(ast.number(3), ast.number(4)));

const executor = new Executor();
executor.execute(expr); // → 14
```

## Language Syntax

### Literals

```typescript
42; // integer
3.14; // floating point
1.5e6; // scientific notation (1500000)
2e-3; // negative exponent (0.002)
```

### Variables

```typescript
x = 5;
y = x + 10;
z = x * y;
```

### Operators

All standard arithmetic operators with proper precedence:

```typescript
2 + 3; // addition
10 - 4; // subtraction
3 * 4; // multiplication
10 / 2; // division
10 % 3; // modulo
2 ^
	(3 - // exponentiation (power)
		5); // unary minus
```

### Operator Precedence

1. Unary minus (`-`) - Highest
2. Exponentiation (`^`)
3. Multiplication, division, modulo (`*`, `/`, `%`)
4. Addition, subtraction (`+`, `-`)
5. Assignment (`=`) - Lowest

Parentheses override precedence:

```typescript
(2 + 3) * 4; // → 20 (not 14)
```

### Functions

Functions accept any number of arguments:

```typescript
abs(-5); // → 5
max(1, 5, 3); // → 5
timestamp(2025, 1, 1); // → timestamp
```

### Comments

Single-line comments with `//`:

```typescript
x = 5; // this is a comment
y = x + 10; // another comment
```

### Return Value

The last expression is always returned:

```typescript
execute("x = 5; x + 10"); // → 15
execute("42"); // → 42
```

## API Reference

### Main Functions

#### `execute(source: string, context?: ExecutionContext): number`

Execute source code with an optional execution context. Always returns a number.

```typescript
execute("2 + 2");
execute("abs(-5)", { functions: { abs: Math.abs } });
```

#### `parseSource(source: string): ASTNode`

Parse source code into an Abstract Syntax Tree without executing.

```typescript
const ast = parseSource("2 + 3 * 4");
// Returns: BinaryOp(+, NumberLiteral(2), BinaryOp(*, ...))
```

#### `generate(node: ASTNode): string`

Convert an AST node back to source code. Intelligently adds parentheses only when necessary to preserve semantics.

```typescript
import { generate, ast } from "littlewing";

// From AST builders
const expr = ast.multiply(ast.add(ast.number(2), ast.number(3)), ast.number(4));
generate(expr); // → "(2 + 3) * 4"

// Round-trip: parse → generate → parse
const code = "2 + 3 * 4";
const tree = parseSource(code);
const regenerated = generate(tree); // → "2 + 3 * 4"
parseSource(regenerated); // Same AST structure
```

#### `optimize(node: ASTNode): ASTNode`

Optimize an AST by performing constant folding. Evaluates expressions with only literals at compile-time.

```typescript
import { optimize, parseSource } from "littlewing";

// Parse first, then optimize
const ast = parseSource("2 + 3 * 4");
const optimized = optimize(ast);
// Transforms BinaryOp tree to NumberLiteral(14)

// Useful for storing compact ASTs
const compactAst = optimize(parseSource("1e6 + 2e6"));
// → NumberLiteral(3000000)
```

### Classes

#### `Lexer`

Tokenize source code into a token stream.

```typescript
import { Lexer, TokenType } from "littlewing";

const lexer = new Lexer("x = 42");
const tokens = lexer.tokenize();
// → [Identifier('x'), Equals, Number(42), EOF]
```

#### `Parser`

Parse tokens into an AST.

```typescript
import { Parser } from "littlewing";

const parser = new Parser(tokens);
const ast = parser.parse();
```

#### `Executor`

Execute an AST with a given context.

```typescript
import { Executor } from "littlewing";

const executor = new Executor(context);
const result = executor.execute(ast);
```

#### `CodeGenerator`

Convert AST nodes back to source code. Handles operator precedence and associativity automatically.

```typescript
import { CodeGenerator } from "littlewing";

const generator = new CodeGenerator();
const code = generator.generate(ast);
```

### AST Builders

The `ast` namespace provides convenient functions for building AST nodes:

```typescript
import { ast } from "littlewing";

ast.number(42);
ast.identifier("x");
ast.add(left, right);
ast.subtract(left, right);
ast.multiply(left, right);
ast.divide(left, right);
ast.modulo(left, right);
ast.exponentiate(left, right);
ast.negate(argument);
ast.assign("x", value);
ast.functionCall("abs", [ast.number(-5)]);
```

### Default Context

The `defaultContext` provides a comprehensive set of built-in functions:

```typescript
import { defaultContext } from "littlewing";

// Math functions
(abs, ceil, floor, round, sqrt, min, max);
(sin, cos, tan, log, log10, exp);

// Timestamp functions
now(); // Current timestamp
timestamp(year, month, day); // Create timestamp from date components

// Time conversion (returns milliseconds)
(milliseconds(n), seconds(n), minutes(n), hours(n), days(n), weeks(n));

// Timestamp component extractors
year(timestamp); // Extract year (e.g., 2024)
month(timestamp); // Extract month (1-12, 1 = January)
day(timestamp); // Extract day of month (1-31)
hour(timestamp); // Extract hour (0-23)
minute(timestamp); // Extract minute (0-59)
second(timestamp); // Extract second (0-59)
weekday(timestamp); // Extract day of week (0-6, 0 = Sunday)
```

## Advanced Features

### Constant Folding Optimization

The `optimize()` function performs constant folding, pre-calculating expressions with only literal values. This results in smaller ASTs and faster execution.

**Without optimization:**

```typescript
import { parseSource } from "littlewing";

const ast = parseSource("2 + 3 * 4");
// AST: BinaryOp(+, NumberLiteral(2), BinaryOp(*, NumberLiteral(3), NumberLiteral(4)))
// Size: 3 nodes
```

**With optimization:**

```typescript
import { optimize, parseSource } from "littlewing";

const ast = optimize(parseSource("2 + 3 * 4"));
// AST: NumberLiteral(14)
// Size: 1 node - 67% smaller!
```

**When to use:**

- **Storage:** Compact ASTs for databases or serialization
- **Performance:** Faster execution (no runtime calculation needed)
- **Network:** Smaller payload when transmitting ASTs
- **Caching:** Pre-calculate expensive expressions once

**What gets optimized:**

- ✅ Binary operations with literals: `2 + 3` → `5`
- ✅ Unary operations: `-5` → `-5`
- ✅ Nested expressions: `2 + 3 * 4` → `14`
- ✅ Scientific notation: `1e6 + 2e6` → `3000000`
- ✅ Partial optimization: `x = 2 + 3` → `x = 5`
- ❌ Variables: `x + 3` stays as-is (x is not a literal)
- ❌ Functions: `sqrt(16)` stays as-is (might have side effects)

### Scientific Notation

Littlewing supports scientific notation for large or small numbers:

```typescript
execute("1.5e6"); // → 1500000
execute("2e10"); // → 20000000000
execute("3e-2"); // → 0.03
execute("4E+5"); // → 400000

// Works with optimization too
const ast = parseSource("1e6 * 2", { optimize: true });
// → NumberLiteral(2000000)
```

## Examples

### Calculator

```typescript
import { execute, defaultContext } from "littlewing";

function calculate(expression: string): number {
	return execute(expression, defaultContext);
}

calculate("2 + 2 * 3"); // → 8
calculate("(2 + 2) * 3"); // → 12
calculate("sqrt(16) + abs(-5)"); // → 9
```

### Financial Calculations

```typescript
import { execute } from "littlewing";

const context = {
	functions: {},
	variables: {
		principal: 1000,
		rate: 0.05,
		years: 2,
	},
};

const compound = execute("principal * (1 + rate) ^ years", context);
// → 1102.5
```

### Timestamp Arithmetic

```typescript
import { execute, defaultContext } from "littlewing";

// Calculate deadline
const deadline = execute("now() + days(7)", defaultContext);
const deadlineDate = new Date(deadline); // Convert to Date

// Complex time calculations
const result = execute("now() + weeks(2) + days(3) + hours(4)", defaultContext);

// Time until event
const eventTime = new Date("2025-12-31").getTime();
const timeUntil = execute("event - now()", {
	...defaultContext,
	variables: { event: eventTime },
});
const daysUntil = timeUntil / (1000 * 60 * 60 * 24);
```

### Custom Functions

```typescript
import { execute } from "littlewing";

const context = {
	functions: {
		fahrenheit: (celsius) => (celsius * 9) / 5 + 32,
		kilometers: (miles) => miles * 1.60934,
		factorial: (n) => (n <= 1 ? 1 : n * context.functions.factorial(n - 1)),
	},
	variables: {
		roomTemp: 20,
	},
};

execute("fahrenheit(roomTemp)", context); // → 68
execute("kilometers(5)", context); // → 8.0467
```

### Scheduling System

```typescript
import { execute, defaultContext } from "littlewing";

// Parse user's relative time expressions
const tasks = [
	{ name: "Review PR", due: "now() + hours(2)" },
	{ name: "Deploy", due: "now() + days(1)" },
	{ name: "Meeting", due: "timestamp(2025, 10, 15, 14, 30, 0)" },
];

const dueTimes = tasks.map((task) => ({
	name: task.name,
	dueTimestamp: execute(task.due, defaultContext),
	dueDate: new Date(execute(task.due, defaultContext)),
}));
```

## Performance

### Algorithms

- **Lexer**: O(n) single-pass tokenization
- **Parser**: Optimal Pratt parsing with O(n) time complexity
- **Executor**: O(n) tree-walk evaluation with no type checking overhead

### Bundle Size

- **4.20 KB gzipped** (19.72 KB raw)
- Zero dependencies
- Includes optimizer for constant folding
- Fully tree-shakeable

### Test Coverage

- **136 tests** with **99.52% line coverage**
- **99.26% function coverage**
- All edge cases handled
- Type-safe execution guaranteed

## Type Safety

- Strict TypeScript mode
- Zero implicit `any` types
- Complete type annotations
- Single `RuntimeValue = number` type
- No runtime type checking overhead

## Error Handling

Clear, actionable error messages for:

- Undefined variables: `"Undefined variable: x"`
- Undefined functions: `"Undefined function: abs"`
- Division by zero: `"Division by zero"`
- Modulo by zero: `"Modulo by zero"`
- Syntax errors with position information

## Browser Support

- ✅ All modern browsers (ES2023+)
- ✅ No polyfills required
- ✅ Tree-shakeable for optimal bundle sizes
- ✅ 100% ESM, no CommonJS

## Node.js Support

Works with Node.js 18+ via ESM imports.

## Philosophy

Littlewing embraces a **numbers-only** type system for maximum simplicity and performance:

- **Pure arithmetic**: Every operation works on numbers
- **No type checking overhead**: Operators don't need runtime type discrimination
- **Timestamps as numbers**: Date arithmetic uses millisecond timestamps
- **Clean semantics**: No ambiguous operations like `Date + Date`
- **Flexibility**: Convert to/from JavaScript Dates at the boundaries

This design keeps the language minimal while remaining powerful enough for real-world use cases.

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
