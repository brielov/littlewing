# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a minimal, high-performance arithmetic expression language with a complete lexer, parser, and executor. It's optimized for browsers with zero dependencies and strict type safety. The library provides both class-based and functional APIs for executing math expressions, including support for variables, custom functions, and dates.

Key metrics:
- 3.61 KB gzipped bundle
- O(n) algorithms (lexer, parser, executor)
- 97.66% test coverage (71 tests)
- 100% ESM, no Node.js APIs

## Architecture

The codebase follows a **three-stage compilation pipeline**:

1. **Lexer** (`src/lexer.ts`) - Tokenizes source code into a token stream
   - Single-pass O(n) tokenization
   - Handles numbers, identifiers, operators, punctuation, and comments
   - Skips whitespace and comments automatically

2. **Parser** (`src/parser.ts`) - Builds an Abstract Syntax Tree (AST)
   - Pratt parsing (top-down operator precedence climbing)
   - Supports operator precedence: unary minus > exponentiation > mult/div/mod > add/sub > assignment
   - Handles variable assignments and function calls with variadic arguments

3. **Executor** (`src/executor.ts`) - Tree-walk interpreter
   - Evaluates AST nodes using pattern matching via type guards
   - Maintains variable state in a Map
   - Supports custom functions and variables via `ExecutionContext`

### Key Types and Contracts

- **ASTNode** (`src/types.ts`) - Discriminated union of all possible AST nodes (Program, NumberLiteral, Identifier, BinaryOp, UnaryOp, FunctionCall, Assignment, StringLiteral)
- **ExecutionContext** - Provides global `functions` and `variables` available during execution
- **RuntimeValue** - Numbers, Dates, or unknown (for function results)
- **Token** - Produced by lexer with type, value, and position

Type guards (`isNumberLiteral`, `isBinaryOp`, etc.) enable safe pattern matching on the ASTNode union. These were added as a recent refactor to improve AST node discrimination.

### Public API

- `execute(source, context?)` - Execute code directly
- `parseSource(source)` - Parse without executing
- `Lexer`, `Parser`, `Executor` - Use individual components
- `ast` namespace - Builders for manual AST construction
- `defaultContext` - Built-in math/date functions

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
└── defaults.ts       # Default context with built-in functions

test/
└── index.test.ts     # Comprehensive test suite (71 tests)
```

## Key Development Notes

### Type Safety

- Strict TypeScript mode enforced
- No implicit `any` types
- Type guards (`isAssignment`, `isBinaryOp`, etc.) required for safe union type narrowing
- Use `isolatedDeclarations` for better type inference

### Testing

Tests use Bun's built-in test framework. Structure:
- Lexer tests (tokenization)
- Parser tests (AST construction)
- Executor tests (evaluation)
- Integration tests (full pipeline)
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
4. Implement binary operation handling in `src/executor.ts`
5. Add AST builder function in `src/ast.ts`
6. Add comprehensive tests in `test/index.test.ts`

**Adding a new function to defaultContext:**
1. Implement in `src/defaults.ts`
2. Add JSDoc with parameter/return types
3. Handle edge cases and errors
4. Add tests covering happy path and edge cases

**Modifying execution behavior:**
- Core logic is in `src/executor.ts` execute method
- Use type guards to safely handle different node types
- Update tests to cover new behavior

## Build Output

- ESM-only distribution
- TypeScript declaration files generated
- Main entry point: `dist/index.js`
- Type definitions: `dist/index.d.ts`
- Optimized for tree-shaking
