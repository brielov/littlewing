# littlewing

A minimal, high-performance arithmetic expression language with a complete lexer, parser, and executor. Optimized for browsers with **zero dependencies** and **type-safe execution**.

## Features

- 🚀 **Minimal & Fast** - O(n) algorithms throughout (lexer, parser, executor)
- 📦 **Tiny Bundle** - 3.61 KB gzipped, zero dependencies
- 🌐 **Browser Ready** - 100% ESM, no Node.js APIs
- 🔒 **Type-Safe** - Strict TypeScript with full type coverage
- ✅ **Thoroughly Tested** - 71 tests, 97.66% coverage
- 📐 **Math Expressions** - Numbers, dates, operators, functions, variables
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

### Date Support

```typescript
import { execute, defaultContext } from "littlewing";

// Dates as first-class citizens
execute("now()", defaultContext); // → Date object (current time)
execute("date('2025-10-01')", defaultContext); // → Date object
execute("now() + minutes(30)", defaultContext); // → Date 30 minutes from now

// Time conversion helpers
execute("seconds(30)", defaultContext); // → 30000 (milliseconds)
execute("minutes(5)", defaultContext); // → 300000 (milliseconds)
execute("hours(2)", defaultContext); // → 7200000 (milliseconds)
execute("days(1)", defaultContext); // → 86400000 (milliseconds)
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
42; // number
3.14; // floating point
("hello"); // string (function arguments only)
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
date("2025-01-01"); // → Date object
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

#### `execute(source: string, context?: ExecutionContext): RuntimeValue`

Execute source code with an optional execution context.

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

// Date functions
(now, date);

// Time conversion (returns milliseconds)
(milliseconds, seconds, minutes, hours, days);
```

## Type Definitions

### ExecutionContext

```typescript
interface ExecutionContext {
	functions?: Record<string, (...args: any[]) => number | Date>;
	variables?: Record<string, number | Date>;
}
```

### RuntimeValue

```typescript
type RuntimeValue = number | Date | unknown;
```

### ASTNode

```typescript
type ASTNode =
	| Program
	| NumberLiteral
	| StringLiteral
	| Identifier
	| BinaryOp
	| UnaryOp
	| FunctionCall
	| Assignment;
```

## Examples

### Calculator

```typescript
import { execute, defaultContext } from "littlewing";

function calculate(expression: string): number {
	return execute(expression, defaultContext) as number;
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
```

### Date Arithmetic

```typescript
import { execute, defaultContext } from "littlewing";

// 5 days from now
const deadline = execute("now() + days(5)", defaultContext);

// Add 2 hours and 30 minutes
const futureTime = execute("now() + hours(2) + minutes(30)", defaultContext);
```

### Custom Functions

```typescript
import { execute } from "littlewing";

const context = {
	functions: {
		fahrenheit: (celsius) => (celsius * 9) / 5 + 32,
		kilometers: (miles) => miles * 1.60934,
		factorial: (n) => (n <= 1 ? 1 : n * factorial(n - 1)),
	},
	variables: {
		roomTemp: 20,
	},
};

execute("fahrenheit(roomTemp)", context); // → 68
execute("kilometers(5)", context); // → 8.0467
```

## Performance

### Algorithms

- **Lexer**: O(n) single-pass tokenization
- **Parser**: Optimal Pratt parsing with O(n) time complexity
- **Executor**: O(n) tree-walk evaluation

### Bundle Size

- Raw: 16.70 KB
- Gzipped: **3.61 KB**
- Zero dependencies

### Test Coverage

- 71 comprehensive tests
- 97.66% code coverage
- All edge cases handled

## Type Safety

- Strict TypeScript mode
- Zero implicit `any` types
- Complete type annotations
- Runtime type validation
- Type guards on all operations

## Error Handling

Clear, actionable error messages for:

- Undefined variables: `"Undefined variable: x"`
- Undefined functions: `"Undefined function: abs"`
- Type mismatches: `"Cannot add string and number"`
- Division by zero: `"Division by zero"`
- Invalid assignments: `"Cannot assign string to variable"`

## Browser Support

- ✅ All modern browsers (ES2023+)
- ✅ No polyfills required
- ✅ Tree-shakeable for optimal bundle sizes
- ✅ 100% ESM, no CommonJS

## Node.js Support

Works with Node.js 18+ via ESM imports.

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

Made with ❤️ by the littlewing team
