# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a minimal, high-performance arithmetic expression language with a complete lexer, parser, and executor. It's optimized for browsers with zero dependencies and strict type safety. The library provides both class-based and functional APIs for executing pure arithmetic expressions with variables and custom functions.

Key characteristics:

- **Numbers-only type system** - Pure arithmetic with single `RuntimeValue = number` type
- **Timestamp-based date handling** - Dates represented as millisecond timestamps (numbers)
- **O(n) algorithms** - Lexer, parser, executor all run in linear time
- **Zero dependencies** - Small bundle, no external requirements
- **100% ESM** - No Node.js APIs, optimized for browsers

## Architecture

The codebase follows a **three-stage compilation pipeline**:

1. **Lexer** (`src/lexer.ts`) - Tokenizes source code into a token stream
   - Single-pass O(n) tokenization
   - Handles numbers (including decimal shorthand like `.2`), identifiers, operators, punctuation, and comments
   - Supports scientific notation (`1.5e6`) and decimal shorthand (`.2` → `0.2`)
   - Skips whitespace and comments automatically
   - No string literal support (numbers-only design)

2. **Parser** (`src/parser.ts`) - Builds an Abstract Syntax Tree (AST)
   - Pratt parsing (top-down operator precedence climbing)
   - Supports operator precedence: unary minus > exponentiation > mult/div/mod > add/sub > assignment
   - Handles variable assignments and function calls with variadic arguments

3. **Executor** (`src/executor.ts`) - Tree-walk interpreter
   - Evaluates AST nodes using pattern matching via type guards
   - Maintains variable state in a Map
   - **No runtime type checking** - All operations work on numbers
   - Supports custom functions and variables via `ExecutionContext`

### Key Types and Contracts

- **RuntimeValue** (`src/types.ts`) - Simply `number` (pure arithmetic)
- **ASTNode** (`src/types.ts`) - Discriminated union of all possible AST nodes:
  - Program, NumberLiteral, Identifier, BinaryOp, UnaryOp, FunctionCall, Assignment
- **ExecutionContext** - Provides global `functions` and `variables` available during execution
  - Functions: `(...args: any[]) => number`
  - Variables: `Record<string, number>`
- **Token** - Produced by lexer with type, value, and position

Type guards (`isNumberLiteral`, `isBinaryOp`, etc.) enable safe pattern matching on the ASTNode union for zero-cost runtime type narrowing.

### Public API

**Functional API (recommended):**

- `execute(source, context?)` - Execute code directly, returns number
- `parseSource(source)` - Parse without executing, returns AST
- `generate(ast)` - Convert AST back to source code

**Class-based API (advanced):**

- `Lexer` - Tokenization component
- `Parser` - Parsing component
- `Executor` - Execution component
- `CodeGenerator` - AST to source code generation

**Builders:**

- `ast` namespace - Functions for manual AST construction

**Defaults:**

- `defaultContext` - Built-in math and timestamp functions

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
├── executor.ts       # Execution (AST + context → result)
├── ast.ts            # AST builder functions
├── codegen.ts        # Code generation (AST → source)
└── defaults.ts       # Default context with built-in functions

test/
└── index.test.ts     # Comprehensive test suite
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

- `.2` is equivalent to `0.2`
- `.5e2` is equivalent to `50` (scientific notation works with shorthand)
- Lone `.` without digits is still an error
- Code generation normalizes shorthand to standard form (`.2` → `0.2`)
- Enables more compact expressions: `x = .5; y = .25`

### Numbers-Only Philosophy

**Design principle:** All values in the language are numbers. This provides:

- **Simplicity** - No complex type checking logic
- **Performance** - Operators don't need type discrimination
- **Clear semantics** - All operations have mathematical meaning
- **Flexibility** - Timestamps (numbers) can represent dates

**Timestamp handling:**

- Dates are represented as millisecond timestamps (Unix epoch)
- `defaultContext` provides helper functions for timestamp creation and manipulation
- Conversion to/from JavaScript `Date` happens at boundaries (context functions, user code)
- Time durations are milliseconds (numbers), enabling clean arithmetic

### Testing

Tests use Bun's built-in test framework. Structure:

- Lexer tests (tokenization)
- Parser tests (AST construction)
- Executor tests (evaluation)
- Timestamp arithmetic tests (date calculations)
- AST builder tests (manual construction)
- Integration tests (full pipeline)
- Default context tests (built-in functions)
- Code generation tests (AST → source)
- Edge cases and error handling

Run a single test file: `bun test test/index.test.ts`

### Code Style

- Biome for linting and formatting
- Single quotes, no semicolons (configured in biome.json)
- Comments use JSDoc format
- Git hooks enforce lint and type-check on pre-commit

### Common Development Tasks

**Adding a new operator:**

1. Add token type to `TokenType` enum in `src/types.ts`
2. Handle tokenization in `src/lexer.ts` (nextToken method)
3. Add precedence in `src/parser.ts` (getPrecedence method)
4. Implement operation in `src/executor.ts` (executeBinaryOp method)
5. Add AST builder function in `src/ast.ts`
6. Add code generation in `src/codegen.ts` (getPrecedence method)
7. Add comprehensive tests in `test/index.test.ts`

**Adding a new function to defaultContext:**

1. Implement in `src/defaults.ts`
2. Add JSDoc with parameter/return types
3. Ensure it returns a number
4. Handle edge cases and errors
5. Add tests covering happy path and edge cases

**Adding timestamp utilities:**

- Add to `defaultContext` in `src/defaults.ts`
- All function names use UPPERCASE convention (e.g., `FROM_MINUTES`, `GET_YEAR`)
- Time converters use `FROM_*` prefix and return milliseconds (e.g., `FROM_MINUTES(5)` → `300000`)
- Extractors use `GET_*` prefix and take timestamp, return component (e.g., `GET_YEAR(ts)` → `2024`)
- Difference functions use `DIFFERENCE_IN_*` pattern (e.g., `DIFFERENCE_IN_HOURS(ts1, ts2)`)
- Use JavaScript's `Date` object internally, return numbers

**Modifying execution behavior:**

- Core logic is in `src/executor.ts` execute method
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

The optimizer (`src/optimizer.ts`) implements a **safe, local constant-folding optimizer** designed to work correctly with the language's context variable semantics.

### Design Philosophy

**Key constraint:** Variables in scripts can be overridden by `ExecutionContext.variables` at runtime. This means the optimizer **cannot assume any variable has a constant value**, even if it appears to be assigned a literal in the script.

Example:

```typescript
// Script: x = 5; x + 10
execute(script); // Returns 15 (x = 5 from script)
execute(script, { variables: { x: 100 } }); // Returns 110 (x = 100 from context overrides script)
```

If the optimizer propagated `x = 5`, the second execution would incorrectly return `15` instead of `110`.

### Algorithm Overview

The optimizer performs **local, expression-level optimizations** only:

1. **Constant Folding** - Evaluates pure arithmetic at compile-time
   - Binary operations: `2 + 3` → `5`, `10 * 5` → `50`
   - Unary operations: `-(5)` → `-5`, `-(2 + 3)` → `-5`
   - Comparisons: `5 > 3` → `1`, `10 < 5` → `0`
   - Logical operators: `1 && 1` → `1`, `0 || 1` → `1`

2. **Function Argument Pre-evaluation** - Simplifies expressions passed to functions
   - `max(2 + 3, 4 * 5)` → `max(5, 20)`
   - `abs(-(2 + 3) * 4)` → `abs(-20)`
   - The function call itself is not evaluated (runtime-dependent)

3. **Conditional Folding** - Evaluates ternary with constant condition
   - `1 ? 100 : 50` → `100`
   - `0 ? 100 : 50` → `50`
   - `5 > 3 ? 100 : 50` → `100` (condition is constant, foldable)

### What is NOT Optimized (By Design)

- ❌ **Variable propagation** - Variables might be overridden by context
- ❌ **Dead code elimination** - Assignments might be used by context
- ❌ **Cross-statement analysis** - Each statement must remain independent
- ❌ **Function evaluation** - Functions have runtime behavior (`now()`, etc.)

### Usage

```typescript
import { optimize, parseSource } from "littlewing";

// Constant folding works
const ast1 = parseSource("2 + 3 * 4");
const optimized1 = optimize(ast1);
// Result: NumberLiteral(14)

// Variables are NOT propagated (context-safe)
const ast2 = parseSource("x = 5; x + 10");
const optimized2 = optimize(ast2);
// Result: Program([Assignment('x', 5), BinaryOp(Identifier('x'), '+', 10)])

// Function arguments are pre-evaluated
const ast3 = parseSource("MAX(2 + 3, 4 * 5)");
const optimized3 = optimize(ast3);
// Result: FunctionCall('MAX', [NumberLiteral(5), NumberLiteral(20)])
```

### Context Override Safety

The optimizer is designed to preserve correct behavior with context overrides:

```typescript
const source =
	"principal = 1000; rate = 0.05; result = principal * rate; result";

// Without context: uses script values
execute(source); // 50

// With context: context overrides work correctly
execute(source, { variables: { principal: 2000 } }); // 100
execute(source, { variables: { rate: 0.1 } }); // 100

// If we had propagated constants, overrides would fail!
```

### Performance Characteristics

- **Time Complexity:** O(n) where n is the number of AST nodes
- **Space Complexity:** O(d) where d is the max depth (recursion stack)
- **Typical Performance:** <0.5ms for most programs
- **Correctness:** 100% semantically equivalent to unoptimized execution

### Development Notes

When adding new operators:

1. Add constant folding in `optimize()` function
2. Use shared `evaluateBinaryOperation()` from `utils.ts` for consistency
3. Add tests for constant folding of the new operator
4. Ensure operator preserves error semantics (e.g., division by zero)

When modifying the optimizer:

- **Never propagate variables** - they can be overridden by context
- Maintain O(n) complexity guarantee
- Preserve formal correctness (no semantic changes)
- Update tests to cover new behavior
