# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a minimal, high-performance arithmetic expression language with a complete lexer, parser, and interpreter. It's optimized for browsers with zero dependencies and strict type safety. The library provides a functional API for evaluating pure arithmetic expressions with variables and custom functions.

Key characteristics:

- **Numbers-only type system** - Pure arithmetic with single `RuntimeValue = number` type
- **Timestamp-based date handling** - Dates represented as millisecond timestamps (numbers)
- **O(n) algorithms** - Lexer, parser, interpreter all run in linear time
- **Zero dependencies** - Small bundle, no external requirements
- **100% ESM** - No Node.js APIs, optimized for browsers
- **502 tests** - Comprehensive test coverage with 99.45% function coverage, 98.57% line coverage

## Architecture

The codebase follows a **three-stage compilation pipeline**:

1. **Lexer** (`src/lexer.ts`) - Tokenizes source code into a token stream
   - Single-pass O(n) tokenization
   - Handles numbers (including decimal shorthand like `.5`), identifiers, operators, punctuation
   - Supports scientific notation (`1.5e6`) and decimal shorthand (`.5` → `0.5`)
   - Skips whitespace automatically
   - Skips single-line comments (`//`) automatically
   - Semicolons are optional and ignored by the lexer
   - No string literal support (numbers-only design)

2. **Parser** (`src/parser.ts`) - Builds an Abstract Syntax Tree (AST)
   - Pratt parsing (top-down operator precedence climbing)
   - Supports operator precedence: unary > exponentiation > mult/div/mod > add/sub > comparison > logical AND > logical OR > ternary > assignment
   - Handles variable assignments, function calls with variadic arguments, and ternary conditionals

3. **Interpreter** (`src/interpreter.ts`) - Tree-walk interpreter
   - Evaluates AST nodes using the visitor pattern
   - Maintains variable state in a Map
   - **No runtime type checking** - All operations work on numbers
   - Supports custom functions and variables via `ExecutionContext`

### Key Types and Contracts

- **RuntimeValue** (`src/types.ts`) - Simply `number` (pure arithmetic)
- **ASTNode** (`src/types.ts`) - Discriminated union of all possible AST nodes:
  - Program, NumberLiteral, Identifier, BinaryOp, UnaryOp, FunctionCall, Assignment, ConditionalExpression
- **ExecutionContext** - Provides global `functions` and `variables` available during execution
  - Functions: `(...args: number[]) => number`
  - Variables: `Record<string, number>`
- **Token** - Produced by lexer with type, value, and position

Type guards (`isNumberLiteral`, `isBinaryOp`, etc.) enable safe pattern matching on the ASTNode union for zero-cost runtime type narrowing.

### Public API

**Functional API:**

- `evaluate(source | ast, context?)` - Evaluate code directly, returns number
- `parse(source)` - Parse without evaluating, returns AST
- `generate(ast)` - Convert AST back to source code
- `humanize(ast, options?)` - Convert AST to English text (with optional HTML output)
- `optimize(ast)` - Optimize AST with constant folding and dead code elimination
- `extractInputVariables(ast)` - Extract variables assigned to constant values (no variable dependencies)

**Builders (`ast` namespace):**

- Core: `program()`, `number()`, `identifier()`, `binaryOp()`, `unaryOp()`, `functionCall()`, `assignment()`, `conditional()`
- Arithmetic: `add()`, `subtract()`, `multiply()`, `divide()`, `modulo()`, `exponentiate()`, `negate()`
- Comparison: `equals()`, `notEquals()`, `lessThan()`, `greaterThan()`, `lessEqual()`, `greaterEqual()`
- Logical: `logicalAnd()`, `logicalOr()`, `logicalNot()`

**Visitor Pattern:**

- `visit<T>(node, visitor)` - Exhaustive visitor requiring handlers for all node types
- `visitPartial<T>(node, visitor, defaultHandler)` - Partial visitor with fallback for unhandled types
- `Visitor<T>` - Type definition for visitor objects

**Type Guards:**

- `isProgram()`, `isNumberLiteral()`, `isIdentifier()`, `isBinaryOp()`, `isUnaryOp()`, `isFunctionCall()`, `isAssignment()`, `isConditionalExpression()`

**Defaults:**

- `defaultContext` - Built-in math and timestamp functions (54 total functions)

## Development Commands

```bash
# Build the project
bun run build

# Watch mode during development
bun run dev

# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage report
bun test --coverage

# Lint and format check
bun run lint

# Auto-fix linting and formatting issues
bun run lint:fix

# Type check without emitting
bun run type-check

# Release a new version (bumps version, commits, pushes, creates tag)
bun release
```

## Project Structure

```
src/
├── index.ts          # Public API exports
├── types.ts          # Type definitions and type guards
├── lexer.ts          # Tokenization (source → tokens)
├── parser.ts         # Parsing (tokens → AST)
├── interpreter.ts    # Evaluation (AST + context → result)
├── optimizer.ts      # AST optimization (constant folding + DCE)
├── visitor.ts        # Visitor pattern for AST traversal
├── ast.ts            # AST builder functions
├── codegen.ts        # Code generation (AST → source)
├── humanizer.ts      # AST to English text conversion
├── analyzer.ts       # Static analysis utilities
├── date-utils.ts     # Date/time utility functions (40 functions)
├── defaults.ts       # Default context with built-in functions
└── utils.ts          # Shared utilities

test/
├── lexer.test.ts           # Lexer tests
├── parser.test.ts          # Parser tests
├── interpreter.test.ts     # Interpreter tests
├── optimizer.test.ts       # Optimizer tests
├── visitor.test.ts         # Visitor pattern tests
├── codegen.test.ts         # Code generation tests
├── humanizer.test.ts       # Humanizer tests
├── analyzer.test.ts        # Analyzer tests
├── ast.test.ts             # AST builder tests
├── defaults.test.ts        # Default context tests
├── date-utils.test.ts      # Date utility tests
├── integration.test.ts     # Integration tests
├── operators.test.ts       # Operator tests
├── external-variables.test.ts  # Context override tests
└── precedence.test.ts      # Precedence tests
```

## Key Development Notes

### Type Safety

- Strict TypeScript mode enforced
- No implicit `any` types (except justified in ExecutionContext for variadic functions)
- Type guards (`isAssignment`, `isBinaryOp`, etc.) required for safe union type narrowing
- `isolatedDeclarations` enabled for better type inference
- Single `RuntimeValue = number` eliminates runtime type checking

### Scientific Notation

The lexer supports scientific notation (e.g., `1.5e6`, `2e-3`, `3E+10`):

- Handles both `e` and `E`
- Supports optional `+` or `-` in exponent
- Validates that exponent has at least one digit
- JavaScript's `parseFloat()` handles the final conversion

### Decimal Shorthand

The lexer supports JavaScript-style decimal shorthand notation where leading zeros can be omitted:

- `.5` is equivalent to `0.5`
- `.5e2` is equivalent to `50` (scientific notation works with shorthand)
- Lone `.` without digits is still an error
- Code generation normalizes shorthand to standard form (`.5` → `0.5`)
- Enables more compact expressions: `x = .5; y = .25`

### Comments

The lexer supports single-line comments starting with `//`:

- Comments extend to the end of the line
- Automatically skipped during tokenization
- Can appear anywhere whitespace is allowed
- Example: `x = 10 // This is a comment`

### Semicolons

Semicolons between statements are **optional**:

- The lexer skips semicolons (they become no-ops)
- Both `x = 10; y = 20` and `x = 10\ny = 20` are valid
- Users can use semicolons for clarity or omit them for brevity

### Numbers-Only Philosophy

**Design principle:** All values in the language are numbers. This provides:

- **Simplicity** - No complex type checking logic
- **Performance** - Operators don't need type discrimination
- **Clear semantics** - All operations have mathematical meaning
- **Flexibility** - Timestamps (numbers) can represent dates

**Timestamp handling:**

- Dates are represented as millisecond timestamps (Unix epoch)
- `defaultContext` provides 40 helper functions for timestamp creation and manipulation
- Conversion to/from JavaScript `Date` happens at boundaries (context functions, user code)
- Time durations are milliseconds (numbers), enabling clean arithmetic
- All date operations use local timezone for user-friendly calendar calculations

### Visitor Pattern

The codebase uses a centralized visitor pattern for AST traversal, implemented in `src/visitor.ts`.

**Benefits:**

- **DRY:** Single source of truth for traversal logic
- **Type safety:** Compile-time exhaustiveness checking via TypeScript
- **Maintainability:** Adding new node types requires updating one place
- **Public API:** External users can traverse ASTs without reimplementing traversal

**Two visitor functions:**

1. **`visit<T>(node, visitor)`** - Exhaustive visitor
   - Requires handlers for all 8 node types
   - TypeScript enforces completeness at compile time
   - Used by: optimizer, interpreter, codegen, humanizer

2. **`visitPartial<T>(node, visitor, defaultHandler)`** - Partial visitor
   - Handlers for specific node types only
   - Default handler for unhandled types
   - Used by: analyzer, custom user code

**Usage in modules:**

- `interpreter.ts`: Evaluates AST nodes to numbers
- `optimizer.ts`: Transforms AST with constant folding and DCE
- `codegen.ts`: Generates source code from AST
- `humanizer.ts`: Converts AST to English text
- `analyzer.ts`: Extracts information (e.g., input variables)

**Example (custom traversal):**

```typescript
import { visit } from "littlewing";

// Count all nodes
const count = visit(ast, {
	// Tuple: [kind, statements]
	Program: (n, recurse) => {
		const statements = n[1];
		return 1 + statements.reduce((sum, s) => sum + recurse(s), 0);
	},
	NumberLiteral: () => 1,
	Identifier: () => 1,
	// Tuple: [kind, left, operator, right]
	BinaryOp: (n, recurse) => 1 + recurse(n[1]) + recurse(n[3]),
	// Tuple: [kind, operator, argument]
	UnaryOp: (n, recurse) => 1 + recurse(n[2]),
	// Tuple: [kind, name, arguments]
	FunctionCall: (n, recurse) => {
		const args = n[2];
		return 1 + args.reduce((sum, arg) => sum + recurse(arg), 0);
	},
	// Tuple: [kind, name, value]
	Assignment: (n, recurse) => 1 + recurse(n[2]),
	// Tuple: [kind, condition, consequent, alternate]
	ConditionalExpression: (n, recurse) =>
		1 + recurse(n[1]) + recurse(n[2]) + recurse(n[3]),
});
```

**Important: Tuple-based AST structure:**

- Nodes are readonly tuples: `[NodeKind, ...fields]`
- Access fields by index: `n[1]`, `n[2]`, etc.
- Use type guards for safe type narrowing: `if (isBinaryOp(node))`
- Node type is `ConditionalExpression` (not `Ternary`)

### Testing

Tests use Bun's built-in test framework. Current coverage:

- **502 tests** across 15 test files
- **99.45% function coverage**
- **98.57% line coverage**

Test structure:

- Lexer tests (tokenization, scientific notation, comments)
- Parser tests (AST construction, precedence)
- Interpreter tests (evaluation, context)
- Optimizer tests (constant folding + dead code elimination)
- Visitor tests (traversal patterns)
- Codegen tests (AST → source)
- Humanizer tests (AST → English)
- Analyzer tests (static analysis)
- AST builder tests (manual construction)
- Integration tests (full pipeline)
- Default context tests (built-in functions)
- Date utilities tests (timestamp operations)
- Operator tests (all operators)
- External variables tests (context override)
- Precedence tests (operator precedence)

Run a single test file: `bun test test/optimizer.test.ts`

### Code Style

- Biome for linting and formatting
- Single quotes, no semicolons (configured in biome.json)
- Comments use JSDoc format
- Git hooks enforce lint and type-check on pre-commit

### Common Development Tasks

**Adding a new binary operator:**

1. Add token type to `TokenType` enum in `src/types.ts`
2. Handle tokenization in `src/lexer.ts` (nextToken method)
3. Add precedence in `src/utils.ts` (getTokenPrecedence and getOperatorPrecedence)
4. Add to `evaluateBinaryOperation()` in `src/utils.ts`
5. Add AST builder function in `src/ast.ts`
6. Add to operator type in `src/types.ts`
7. Add comprehensive tests in all relevant test files

Note: With the visitor pattern, you don't need to modify `interpreter.ts`, `optimizer.ts`, or `codegen.ts` individually - they use the shared `evaluateBinaryOperation()` function.

**Adding a new unary operator:**

1. Add token type to `TokenType` enum in `src/types.ts` (e.g., `EXCLAMATION`)
2. Update `UnaryOp` interface operator type in `src/types.ts` (e.g., `'-' | '!'`)
3. Handle tokenization in `src/lexer.ts` (nextToken method)
4. Add parsing in `src/parser.ts` (parsePrefix method with correct precedence)
5. Add operation handling in the visitor handlers:
   - `src/interpreter.ts` (UnaryOp visitor handler)
   - `src/optimizer.ts` (UnaryOp visitor handler for constant folding)
   - `src/codegen.ts` (UnaryOp visitor handler if special formatting needed)
   - `src/humanizer.ts` (UnaryOp visitor handler for English text)
6. Update `unaryOp()` function signature in `src/ast.ts`
7. Add convenience builder function in `src/ast.ts` (e.g., `logicalNot()`)
8. Add comprehensive tests for lexer, parser, interpreter, optimizer, and codegen
9. Update documentation (LANGUAGE.md, README.md, CLAUDE.md)

**Adding a new function to defaultContext:**

1. Implement in `src/date-utils.ts` (for date/time) or `src/defaults.ts` (for math)
2. Add JSDoc with parameter/return types
3. Ensure it returns a number
4. Handle edge cases and errors
5. Use UPPERCASE naming convention (e.g., `FROM_DAYS`, `GET_YEAR`)
6. Add tests covering happy path and edge cases
7. Update function count in documentation

**Custom user functions (via ExecutionContext):**

- Should use UPPERCASE naming to match built-in function convention
- Avoids collisions with user variables (which typically use lowercase)
- Example: `FAHRENHEIT()`, `DISCOUNT()`, `CLAMP()` instead of `fahrenheit()`, `discount()`, `clamp()`
- Makes it visually clear that it's a function call rather than a variable reference

**Adding timestamp utilities:**

- Add to `src/date-utils.ts` as standalone functions
- Export from `src/index.ts` as `dateUtils` namespace
- Include in `defaultContext` by spreading `...dateUtils`
- All function names use UPPERCASE convention (e.g., `FROM_MINUTES`, `GET_YEAR`)
- Time converters use `FROM_*` prefix and return milliseconds (e.g., `FROM_MINUTES(5)` → `300000`)
- Extractors use `GET_*` prefix and take timestamp, return component (e.g., `GET_YEAR(ts)` → `2024`)
- Difference functions use `DIFFERENCE_IN_*` pattern (e.g., `DIFFERENCE_IN_HOURS(ts1, ts2)`)
- Date arithmetic uses `ADD_*` pattern (e.g., `ADD_DAYS(ts, 7)`)
- Start/End functions use `START_OF_*` / `END_OF_*` pattern (e.g., `START_OF_DAY(ts)`)
- Comparison functions use `IS_*` pattern and return 1 or 0 (e.g., `IS_WEEKEND(ts)`)
- Use JavaScript's `Date` object internally, return numbers
- All operations use local timezone for user-friendly calendar behavior

**Modifying evaluation behavior:**

- Core logic is in `src/interpreter.ts` using the visitor pattern
- Use type guards to safely handle different node types
- All operators work on `number` operands only
- Update tests to cover new behavior

## Build Output

- ESM-only distribution
- TypeScript declaration files generated
- Main entry point: `dist/index.js`
- Type definitions: `dist/index.d.ts`
- Optimized for tree-shaking
- Small bundle size thanks to numbers-only type system

## Optimization

The optimizer (`src/optimizer.ts`) implements a **safe, local optimizer** with two passes: constant folding and dead code elimination.

### Design Philosophy

**Key constraint:** Variables in scripts can be overridden by `ExecutionContext.variables` at runtime. This means the optimizer **cannot assume any variable has a constant value**, even if it appears to be assigned a literal in the script.

Example:

```typescript
// Script: x = 5; x + 10
evaluate(script); // Returns 15 (x = 5 from script)
evaluate(script, { variables: { x: 100 } }); // Returns 110 (x = 100 from context overrides script)
```

If the optimizer propagated `x = 5`, the second execution would incorrectly return `15` instead of `110`.

### Algorithm Overview

The optimizer performs **safe, local optimizations** in two passes:

**Pass 1: Constant Folding & Expression Simplification**

1. **Constant Folding** - Evaluates pure arithmetic at compile-time
   - Binary operations: `2 + 3` → `5`, `10 * 5` → `50`
   - Unary operations: `-(5)` → `-5`, `-(2 + 3)` → `-5`
   - Comparisons: `5 > 3` → `1`, `10 < 5` → `0`
   - Logical operators: `1 && 1` → `1`, `0 || 1` → `1`

2. **Function Argument Pre-evaluation** - Simplifies expressions passed to functions
   - `MAX(2 + 3, 4 * 5)` → `MAX(5, 20)`
   - `ABS(-(2 + 3) * 4)` → `ABS(-20)`
   - The function call itself is not evaluated (runtime-dependent)

3. **Conditional Folding** - Evaluates ternary with constant condition
   - `1 ? 100 : 50` → `100`
   - `0 ? 100 : 50` → `50`
   - `5 > 3 ? 100 : 50` → `100` (condition is constant, foldable)

**Pass 2: Dead Code Elimination (DCE)**

4. **Dead Code Elimination** - Removes unused variable assignments
   - `x = 10; y = 20; z = x * 20` → `x = 10; z = x * 20` (y is unused)
   - Uses single backwards pass O(n) to handle transitive dependencies
   - Always preserves the last statement (it's the return value)
   - Conservative: if a variable is read anywhere, all assignments are kept

### What is NOT Optimized (By Design)

- ❌ **Variable propagation** - Variables might be overridden by context
- ❌ **Cross-statement analysis** - Each statement must remain independent
- ❌ **Function evaluation** - Functions have runtime behavior (`NOW()`, etc.)
- ❌ **Reaching definitions** - Doesn't track which specific assignment reaches which use

### Usage

```typescript
import { optimize, parse } from "littlewing";

// Constant folding works
const ast1 = parse("2 + 3 * 4");
const optimized1 = optimize(ast1);
// Result: NumberLiteral(14)

// Dead code elimination removes unused variables
const ast2 = parse("x = 10; y = 20; z = x * 20");
const optimized2 = optimize(ast2);
// Result: Program([Assignment('x', 10), Assignment('z', BinaryOp(...))])
// Note: y is removed because it's never used

// Variables are NOT propagated (context-safe)
const ast3 = parse("x = 5; x + 10");
const optimized3 = optimize(ast3);
// Result: Program([Assignment('x', 5), BinaryOp(Identifier('x'), '+', 10)])
// Note: x is kept because it's used in the expression

// Function arguments are pre-evaluated
const ast4 = parse("MAX(2 + 3, 4 * 5)");
const optimized4 = optimize(ast4);
// Result: FunctionCall('MAX', [NumberLiteral(5), NumberLiteral(20)])
```

### Context Override Safety

The optimizer is designed to preserve correct behavior with context overrides:

```typescript
const source =
	"principal = 1000; rate = 0.05; result = principal * rate; result";

// Without context: uses script values
evaluate(source); // 50

// With context: context overrides work correctly
evaluate(source, { variables: { principal: 2000 } }); // 100
evaluate(source, { variables: { rate: 0.1 } }); // 100

// If we had propagated constants, overrides would fail!
```

### Performance Characteristics

- **Time Complexity:** O(n) for constant folding + O(n) for DCE = O(n) total
- **Space Complexity:** O(d + v) where d is max depth, v is unique variables
- **Typical Performance:** <1ms for most programs
- **Correctness:** 100% semantically equivalent to unoptimized evaluation

### Development Notes

When adding new operators:

1. Add constant folding in `optimize()` function
2. Use shared `evaluateBinaryOperation()` from `utils.ts` for consistency
3. Add tests for constant folding of the new operator
4. Ensure operator preserves error semantics (e.g., division by zero)

When modifying the optimizer:

- **Never propagate variables** - they can be overridden by context
- Keep DCE conservative - only eliminate clearly unused assignments
- Maintain O(n) complexity
- Preserve formal correctness (no semantic changes)
- Update tests to cover new behavior

**Dead Code Elimination Notes:**

- DCE uses a single backwards pass to handle transitive dependencies efficiently
- Example: `x = 1; y = x; z = 5; z` → removes both `x` and `y` (transitively dead)
- Processing backwards: last statement is live → marks used variables → removes unused assignments
- Always preserves the last statement (return value)
- More efficient than iterative approach while maintaining correctness

## AST Node Types Reference

For quick reference, here are all 8 AST node types with their tuple-based structure:

```typescript
// Tuple-based AST nodes (readonly tuples for zero-cost abstractions)

type Program = readonly [
	kind: NodeKind.Program,
	statements: readonly ASTNode[],
];

type NumberLiteral = readonly [kind: NodeKind.NumberLiteral, value: number];

type Identifier = readonly [kind: NodeKind.Identifier, name: string];

type BinaryOp = readonly [
	kind: NodeKind.BinaryOp,
	left: ASTNode,
	operator:
		| "+"
		| "-"
		| "*"
		| "/"
		| "%"
		| "^"
		| "=="
		| "!="
		| "<"
		| ">"
		| "<="
		| ">="
		| "&&"
		| "||",
	right: ASTNode,
];

type UnaryOp = readonly [
	kind: NodeKind.UnaryOp,
	operator: "-" | "!",
	argument: ASTNode,
];

type FunctionCall = readonly [
	kind: NodeKind.FunctionCall,
	name: string,
	arguments: readonly ASTNode[],
];

type Assignment = readonly [
	kind: NodeKind.Assignment,
	name: string,
	value: ASTNode,
];

type ConditionalExpression = readonly [
	kind: NodeKind.ConditionalExpression,
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
];

// Access tuple fields by index:
// Program: n[0] = kind, n[1] = statements
// NumberLiteral: n[0] = kind, n[1] = value
// BinaryOp: n[0] = kind, n[1] = left, n[2] = operator, n[3] = right
// etc.
```

## Built-in Functions Summary

**Total: 54 built-in functions in `defaultContext`**

- **Math (14):** ABS, CEIL, FLOOR, ROUND, SQRT, MIN, MAX, CLAMP, SIN, COS, TAN, LOG, LOG10, EXP
- **Timestamps (2):** NOW, DATE
- **Time converters (4):** FROM_DAYS, FROM_WEEKS, FROM_MONTHS, FROM_YEARS
- **Component extractors (10):** GET_YEAR, GET_MONTH, GET_DAY, GET_HOUR, GET_MINUTE, GET_SECOND, GET_WEEKDAY, GET_MILLISECOND, GET_DAY_OF_YEAR, GET_QUARTER
- **Time differences (7):** DIFFERENCE_IN_SECONDS, DIFFERENCE_IN_MINUTES, DIFFERENCE_IN_HOURS, DIFFERENCE_IN_DAYS, DIFFERENCE_IN_WEEKS, DIFFERENCE_IN_MONTHS, DIFFERENCE_IN_YEARS
- **Start/End (8):** START_OF_DAY, END_OF_DAY, START_OF_WEEK, START_OF_MONTH, END_OF_MONTH, START_OF_YEAR, END_OF_YEAR, START_OF_QUARTER
- **Date arithmetic (3):** ADD_DAYS, ADD_MONTHS, ADD_YEARS
- **Date comparisons (3):** IS_SAME_DAY, IS_WEEKEND, IS_LEAP_YEAR

All date/time functions use local timezone for user-friendly calendar behavior.
