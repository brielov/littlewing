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
   - Handles numbers, identifiers, operators, punctuation, and comments
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
- Time converters should return milliseconds (e.g., `minutes(5)` → `300000`)
- Extractors should take timestamp and return component (e.g., `year(ts)` → `2024`)
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

The optimizer (`src/optimizer.ts`) implements a **production-grade, O(n) single-pass optimization algorithm** based on classical compiler optimization theory.

### Algorithm Overview

The optimizer achieves maximum AST compaction through three phases:

1. **Program Analysis** (O(n)) - Builds a complete data-flow graph
   - Dependency tracking between variables
   - Constant identification (variables assigned once with literal values)
   - Taint analysis (variables dependent on runtime values like function calls)
   - Topological sorting for optimal evaluation order
   - Liveness analysis via backward reachability

2. **Constant Propagation** (O(n)) - Evaluates constants in topological order
   - Transitive constant evaluation (if a = 5 and b = a + 10, then b = 15)
   - Single forward pass through dependencies
   - Replaces all variable references with computed constant values
   - Preserves tainted expressions (external variables, function calls)

3. **Dead Code Elimination** (O(n)) - Removes unnecessary code
   - Eliminates assignments to unused variables
   - Removes fully-propagated assignments (values already inlined)
   - Unwraps single-statement programs to direct values
   - Early evaluation of entire programs when possible

### Usage

```typescript
import { optimize, parseSource } from "littlewing";

// Automatic optimization
const ast = parseSource("x = 5; y = x + 10; y * 2");
const optimized = optimize(ast);
// Result: NumberLiteral(30)

// Complex example
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
```

### Optimization Capabilities

**What gets optimized:**

- ✅ All arithmetic with constant operands
- ✅ Variables assigned once with computable values
- ✅ Transitive dependencies (a = 5; b = a + 10 → b = 15)
- ✅ Chained computations across multiple statements
- ✅ Unused variables (dead code elimination)
- ✅ Fully propagated variables (even if referenced, once inlined)

**What stays (correctly):**

- ❌ External variables (passed via ExecutionContext)
- ❌ Function calls (runtime behavior - `now()`, `max()`, etc.)
- ❌ Variables reassigned multiple times
- ❌ Tainted expressions (depend on runtime values)

### Performance Characteristics

- **Time Complexity:** O(n) guaranteed - single pass through AST
- **Space Complexity:** O(n) for dependency graph
- **Typical Performance:** <1ms for 8-statement programs, ~3ms for 100-statement programs
- **No Iteration:** Unlike iterative fixed-point algorithms, uses topological evaluation

### Theoretical Foundation

Based on seminal compiler optimization research:

- **Cytron et al.** (1991) - "Efficiently Computing Static Single Assignment Form"
- **Wegman & Zadeck** (1991) - "Constant Propagation with Conditional Branches"
- **Appel** (1997) - "Modern Compiler Implementation"

### Implementation Details

**Key data structures:**

```typescript
interface ProgramAnalysis {
	constants: Map<string, number>; // Variables with known constant values
	tainted: Set<string>; // Variables dependent on runtime values
	dependencies: Map<string, Set<string>>; // Dependency graph
	liveVariables: Set<string>; // Variables that are referenced
	evaluationOrder: string[]; // Topological sort for evaluation
}
```

**Algorithm guarantees:**

- Formally sound - preserves program semantics
- Complete - finds all optimization opportunities
- Optimal - O(n) complexity, can't do better
- Robust - handles cycles, external dependencies, edge cases

### Trade-offs

**Pros:**

- Maximum compaction (8 statements → 1 literal in typical cases)
- Optimal complexity (O(n) vs O(n×k) for iterative algorithms)
- Production-ready correctness
- Comprehensive edge case handling

**Cons:**

- Slightly more complex implementation (~600 LOC vs ~300 for simpler approach)
- Optimized AST structure differs from source (expected for aggressive optimization)

### Development Notes

When adding new operators:

1. Update `evaluateBinaryOp` in optimizer to handle the new operator
2. Add tests for constant folding of the new operator
3. Ensure operator preserves error semantics (e.g., division by zero)

When modifying the optimizer:

- Maintain O(n) complexity guarantee
- Preserve formal correctness (no semantic changes)
- Update tests to cover new behavior
- Document any new optimization strategies
