# littlewing

A minimal, high-performance arithmetic expression language with a complete lexer, parser, and executor. Optimized for browsers with **zero dependencies** and **type-safe execution**.

## Features

- 🚀 **Minimal & Fast** - O(n) algorithms throughout (lexer, parser, executor)
- 📦 **Small Bundle** - 6.89 KB gzipped, zero dependencies
- 🌐 **Browser Ready** - 100% ESM, no Node.js APIs
- 🔒 **Type-Safe** - Strict TypeScript with full type coverage
- ✅ **Thoroughly Tested** - 247 tests, 98.61% line coverage
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

#### Arithmetic Operators

```typescript
2 + 3; // addition
10 - 4; // subtraction
3 * 4; // multiplication
10 / 2; // division
10 % 3; // modulo
2 ^ 3; // exponentiation (power)
-5; // unary minus
```

#### Comparison Operators

Returns `1` for true, `0` for false (following the numbers-only philosophy):

```typescript
5 == 5; // equality → 1
5 != 3; // not equal → 1
5 > 3; // greater than → 1
5 < 3; // less than → 0
5 >= 5; // greater than or equal → 1
5 <= 3; // less than or equal → 0
```

#### Logical Operators

Returns `1` for true, `0` for false. Treats `0` as false, any non-zero value as true:

```typescript
1 && 1; // logical AND → 1 (both truthy)
1 && 0; // logical AND → 0 (right is falsy)
0 || 1; // logical OR → 1 (right is truthy)
0 || 0; // logical OR → 0 (both falsy)

// Commonly used with comparisons
5 > 3 && 10 > 8; // → 1 (both conditions true)
5 < 3 || 10 > 8; // → 1 (second condition true)
age >= 18 && age <= 65; // age range check
isStudent || age >= 65; // student or senior discount
```

#### Ternary Operator

Conditional expression with `? :` syntax:

```typescript
5 > 3 ? 100 : 50; // → 100 (condition is true)
0 ? 100 : 50; // → 50 (0 is falsy)
x = age >= 18 ? 1 : 0; // assign based on condition

// Nested ternaries
age < 18 ? 10 : age >= 65 ? 15 : 0; // age-based discount
```

#### Assignment Operators

```typescript
x = 5; // regular assignment
price ??= 100; // nullish assignment - only assigns if variable doesn't exist
```

The `??=` operator is useful for providing default values to external variables:

```typescript
// Without ??=
execute("price * 2", { variables: { price: 50 } }); // → 100
execute("price * 2", {}); // Error: Undefined variable: price

// With ??=
execute("price ??= 100; price * 2", { variables: { price: 50 } }); // → 100 (uses existing)
execute("price ??= 100; price * 2", {}); // → 200 (uses default)
```

Unlike `||`, the `??=` operator preserves `0` values:

```typescript
execute("x ??= 10; x", { variables: { x: 0 } }); // → 0 (preserves zero)
execute("x ??= 10; x", {}); // → 10 (assigns default)
```

### Operator Precedence

From lowest to highest:

1. Assignment (`=`, `??=`) - Lowest
2. Ternary conditional (`? :`)
3. Logical OR (`||`)
4. Logical AND (`&&`)
5. Comparison (`==`, `!=`, `<`, `>`, `<=`, `>=`)
6. Addition, subtraction (`+`, `-`)
7. Multiplication, division, modulo (`*`, `/`, `%`)
8. Exponentiation (`^`)
9. Unary minus (`-`) - Highest

Parentheses override precedence:

```typescript
(2 + 3) * 4; // → 20 (not 14)
5 > 3 && 10 > 8; // → 1 (explicit grouping, though not necessary)
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

// Literals and identifiers
ast.number(42);
ast.identifier("x");

// Arithmetic operators
ast.add(left, right);
ast.subtract(left, right);
ast.multiply(left, right);
ast.divide(left, right);
ast.modulo(left, right);
ast.exponentiate(left, right);
ast.negate(argument);

// Comparison operators
ast.equals(left, right); // ==
ast.notEquals(left, right); // !=
ast.lessThan(left, right); // <
ast.greaterThan(left, right); // >
ast.lessEqual(left, right); // <=
ast.greaterEqual(left, right); // >=

// Logical operators
ast.logicalAnd(left, right); // &&
ast.logicalOr(left, right); // ||

// Control flow
ast.conditional(condition, consequent, alternate); // ? :

// Assignment
ast.assign("x", value); // =
ast.nullishAssign("x", value); // ??=

// Functions
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

### Advanced Optimization

The `optimize()` function implements a **production-grade, O(n) optimization algorithm** that achieves maximum AST compaction through constant propagation and dead code elimination.

#### Simple Example

```typescript
import { optimize, parseSource } from "littlewing";

// Basic constant folding
const ast = optimize(parseSource("2 + 3 * 4"));
// Result: NumberLiteral(14) - reduced from 3 nodes to 1!

// Transitive constant propagation
const ast2 = optimize(parseSource("x = 5; y = x + 10; y * 2"));
// Result: NumberLiteral(30) - fully evaluated!
```

#### Complex Example

```typescript
import { optimize, parseSource } from "littlewing";

const source = `
  principal = 1000;
  rate = 0.05;
  years = 10;
  n = 12;
  base = 1 + (rate / n);
  exponent = n * years;
  result = principal * (base ^ exponent);
  result
`;

const optimized = optimize(parseSource(source));
// Result: NumberLiteral(1647.0095406619717)
// Reduced from 8 statements (40+ nodes) to a single literal!
```

#### How It Works

The optimizer uses a three-phase algorithm inspired by compiler optimization theory:

1. **Program Analysis** (O(n))
   - Builds dependency graph between variables
   - Identifies constants and tainted expressions
   - Performs topological sorting for evaluation order

2. **Constant Propagation** (O(n))
   - Evaluates constants in dependency order
   - Propagates values transitively (a = 5; b = a + 10 → b = 15)
   - Replaces variable references with computed values

3. **Dead Code Elimination** (O(n))
   - Removes unused assignments
   - Eliminates fully-propagated variables
   - Unwraps single-value programs

**Time complexity:** O(n) guaranteed - no iteration, single pass through AST

#### What Gets Optimized

✅ **Constant folding:** `2 + 3 * 4` → `14`
✅ **Variable propagation:** `x = 5; x + 10` → `15`
✅ **Transitive evaluation:** `a = 5; b = a + 10; b * 2` → `30`
✅ **Chained computations:** Multi-statement programs fully evaluated
✅ **Dead code elimination:** Unused variables removed
✅ **Scientific notation:** `1e6 + 2e6` → `3000000`

#### What Stays (Correctly)

❌ **External variables:** Variables from `ExecutionContext`
❌ **Function calls:** `sqrt(16)`, `now()` (runtime behavior)
❌ **Reassigned variables:** `x = 5; x = 10; x` (not constant)
❌ **Tainted expressions:** Depend on function calls or external values

#### When to Use

- **Storage:** Compact ASTs for databases (87% size reduction typical)
- **Performance:** Faster execution, pre-calculate once
- **Network:** Smaller payload for transmitted ASTs
- **Caching:** Store optimized expressions for repeated evaluation
- **Build tools:** Optimize configuration files at compile time

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

### Conditional Logic & Validation

```typescript
import { execute } from "littlewing";

// Age-based discount system
const discountScript = `
  age ??= 30;
  isStudent ??= 0;
  isPremium ??= 0;

  discount = isPremium ? 0.2 :
             age < 18 ? 0.15 :
             age >= 65 ? 0.15 :
             isStudent ? 0.1 : 0;

  discount
`;

execute(discountScript); // → 0 (default 30-year-old)
execute(discountScript, { variables: { age: 16 } }); // → 0.15 (under 18)
execute(discountScript, { variables: { isPremium: 1 } }); // → 0.2 (premium)
execute(discountScript, { variables: { isStudent: 1 } }); // → 0.1 (student)

// Range validation
const validateAge = "age >= 18 && age <= 120";
execute(validateAge, { variables: { age: 25 } }); // → 1 (valid)
execute(validateAge, { variables: { age: 15 } }); // → 0 (too young)
execute(validateAge, { variables: { age: 150 } }); // → 0 (invalid)

// Complex business logic
const eligibilityScript = `
  age ??= 0;
  income ??= 0;
  creditScore ??= 0;

  hasGoodCredit = creditScore >= 700;
  hasStableIncome = income >= 30000;
  isAdult = age >= 18;

  eligible = isAdult && hasGoodCredit && hasStableIncome;
  eligible
`;

execute(eligibilityScript, {
	variables: { age: 25, income: 45000, creditScore: 750 },
}); // → 1 (eligible)
```

### Dynamic Pricing

```typescript
import { execute } from "littlewing";

const pricingFormula = `
  // Defaults
  basePrice ??= 100;
  isPeakHour ??= 0;
  isWeekend ??= 0;
  quantity ??= 1;
  isMember ??= 0;

  // Surge pricing
  surgeMultiplier = isPeakHour ? 1.5 : isWeekend ? 1.2 : 1.0;

  // Volume discount
  volumeDiscount = quantity >= 10 ? 0.15 :
                   quantity >= 5 ? 0.1 :
                   quantity >= 3 ? 0.05 : 0;

  // Member discount (stacks with volume)
  memberDiscount = isMember ? 0.1 : 0;

  // Calculate final price
  adjustedPrice = basePrice * surgeMultiplier;
  afterVolumeDiscount = adjustedPrice * (1 - volumeDiscount);
  finalPrice = afterVolumeDiscount * (1 - memberDiscount);

  finalPrice * quantity
`;

// Regular customer, 1 item
execute(pricingFormula); // → 100

// Peak hour, 5 items, member
execute(pricingFormula, {
	variables: { isPeakHour: 1, quantity: 5, isMember: 1 },
}); // → 607.5

// Weekend, bulk order (10 items)
execute(pricingFormula, {
	variables: { isWeekend: 1, quantity: 10 },
}); // → 1020
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

- **6.89 KB gzipped** (37.66 KB raw)
- Zero dependencies
- Includes production-grade O(n) optimizer
- Full feature set: arithmetic, comparisons, logical operators, ternary, assignments
- Fully tree-shakeable

### Test Coverage

- **247 tests** with **98.61% line coverage**
- **98.21% function coverage**
- Comprehensive coverage of all operators and features
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
