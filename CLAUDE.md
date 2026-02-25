# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**littlewing** is a minimal, high-performance multi-type expression language with a complete lexer, parser, and interpreter. It supports seven types: numbers, strings, booleans, dates (`Temporal.PlainDate`), times (`Temporal.PlainTime`), datetimes (`Temporal.PlainDateTime`), and homogeneous arrays. The library provides a functional API for evaluating expressions with variables and custom functions.

Key characteristics:

- **Multi-type system** - Seven types: `number`, `string`, `boolean`, `Temporal.PlainDate`, `Temporal.PlainTime`, `Temporal.PlainDateTime`, `readonly RuntimeValue[]`
- **No implicit coercion** - Explicit conversion via `STR()`, `NUM()`, etc.
- **Strict boolean logic** - `!`, `&&`, `||`, and `if` conditions require boolean operands
- **Control flow** - `if/then/else` expressions and `for/in/then` comprehensions (with optional `when` guard)
- **Deep structural equality** - `[1, 2] == [1, 2]` → `true`; cross-type `==` → `false`
- **Homogeneous arrays** - `[1, "two"]` is a TypeError
- **Full Temporal support** - PlainDate (date-only), PlainTime (time-only), PlainDateTime (date+time, no timezone)
- **O(n) algorithms** - Lexer, parser, interpreter all run in linear time
- **100% ESM** - No Node.js APIs, optimized for browsers
- **Zero runtime dependencies** - Requires global `Temporal` API (native or user-provided polyfill)

## Architecture

The codebase follows a **three-stage compilation pipeline**:

1. **Lexer** (`packages/littlewing/src/lexer.ts`) - Tokenizes source code into a token stream
   - Single-pass O(n) tokenization
   - Handles numbers (integers and standard decimals like `0.5`), identifiers, operators, punctuation
   - Handles string literals with escape sequences (`\"`, `\\`, `\n`, `\t`)
   - Handles bracket tokens (`[`, `]`) for array literals and index access
   - Handles range tokens (`..`, `..=`) for range expressions
   - Skips whitespace, semicolons, and single-line comments (`//`) automatically
   - `true` and `false` are parsed as identifiers and handled in the parser

2. **Parser** (`packages/littlewing/src/parser.ts`) - Builds an Abstract Syntax Tree (AST)
   - Pratt parsing (top-down operator precedence climbing)
   - Supports: unary > exponentiation > mult/div/mod > add/sub > range > comparison > logical AND > logical OR > assignment
   - Postfix bracket indexing (`arr[0]`, `str[1]`) with chaining support (`a[0][1]`, `f()[0]`)
   - `if/then/else` and `for/in/then` are prefix expressions (not infix), parsed in prefix position
   - Keywords: `if`, `then`, `else`, `for`, `in`, `when` — have no precedence, naturally terminate sub-expressions
   - Handles string literals, boolean literals (`true`/`false` in prefix position), array literals (`[...]`)
   - `true`/`false` cannot be used as assignment targets

3. **Interpreter** (`packages/littlewing/src/interpreter.ts`) - Tree-walk evaluation
   - Evaluates AST nodes using the visitor pattern
   - Maintains variable state in a `Map<string, RuntimeValue>`
   - Short-circuit evaluation for `&&` and `||` (both require boolean operands)
   - `if` condition must be boolean
   - `for` expression iterates arrays and strings (strings split into single-character strings)
   - `for` with `when` guard filters elements (guard must be boolean)
   - `for` result must be a homogeneous array
   - `!` operator requires boolean, `-` operator requires number
   - Validates homogeneous array elements at construction time
   - Supports custom functions and variables via `ExecutionContext`

### Key Types and Contracts

- **RuntimeValue** (`packages/littlewing/src/types.ts`) - `number | string | boolean | Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | readonly RuntimeValue[]`
- **ASTNode** (`packages/littlewing/src/ast.ts`) - Discriminated union of 14 node types:
  - Program, NumberLiteral, StringLiteral, BooleanLiteral, ArrayLiteral, Identifier, BinaryOp, UnaryOp, FunctionCall, Assignment, IfExpression, ForExpression, IndexAccess, RangeExpression
- **ExecutionContext** (`packages/littlewing/src/types.ts`) - Provides global `functions` and `variables`
  - Functions: `(...args: RuntimeValue[]) => RuntimeValue`
  - Variables: `Record<string, RuntimeValue>`

Type guards (`isNumberLiteral`, `isStringLiteral`, `isBooleanLiteral`, `isArrayLiteral`, `isBinaryOp`, etc.) enable safe pattern matching on the ASTNode union.

### Operator Semantics

| Operator                | Types                                               | Behavior                                   |
| ----------------------- | --------------------------------------------------- | ------------------------------------------ | ------------ | ------------------------------ |
| `+`                     | number+number, string+string, array+array           | Add, concatenate, or concat arrays         |
| `-`, `*`, `/`, `%`, `^` | number only                                         | Arithmetic                                 |
| `==`, `!=`              | any types                                           | Deep equality (cross-type → `false`)       |
| `<`, `>`, `<=`, `>=`    | number, string, date, time, or datetime (same type) | Ordered comparison                         |
| `&&`, `                 |                                                     | `                                          | boolean only | Short-circuit; returns boolean |
| `!`                     | boolean only                                        | Logical NOT                                |
| `-` (unary)             | number only                                         | Negation                                   |
| `[]`                    | array or string                                     | Bracket indexing (zero-based, negative OK) |
| `..`                    | number                                              | Exclusive range (`1..4` → `[1, 2, 3]`)     |
| `..=`                   | number                                              | Inclusive range (`1..=3` → `[1, 2, 3]`)    |

### Public API

**Core Functions:**

- `evaluate(source | ast, context?)` - Evaluate and return `RuntimeValue`
- `evaluateScope(source | ast, context?)` - Evaluate and return all assigned variables
- `parse(source)` - Parse without evaluating, returns AST
- `generate(ast)` - Convert AST back to source code
- `optimize(ast, externalVariables?)` - Optimize AST with constant folding, constant propagation, and dead code elimination
- `extractInputVariables(ast)` - Extract variables assigned to constant values
- `extractAssignedVariables(ast)` - Extract all assigned variable names

**Builders (`ast` namespace):**

- Core: `program()`, `number()`, `string()`, `boolean()`, `array()`, `identifier()`, `binaryOp()`, `unaryOp()`, `functionCall()`, `assign()`, `ifExpr()`, `forExpr()`, `indexAccess()`, `rangeExpr()`
- Arithmetic: `add()`, `subtract()`, `multiply()`, `divide()`, `modulo()`, `exponentiate()`, `negate()`
- Comparison: `equals()`, `notEquals()`, `lessThan()`, `greaterThan()`, `lessEqual()`, `greaterEqual()`
- Logical: `logicalAnd()`, `logicalOr()`, `logicalNot()`

**Visitor Pattern:**

- `visit<T>(node, visitor)` - Exhaustive visitor requiring handlers for all 14 node types
- `visitPartial<T>(node, visitor, defaultHandler)` - Partial visitor with fallback
- `Visitor<T>` - Type definition for visitor objects

**Type Guards:**

- `isProgram()`, `isNumberLiteral()`, `isStringLiteral()`, `isBooleanLiteral()`, `isArrayLiteral()`, `isIdentifier()`, `isBinaryOp()`, `isUnaryOp()`, `isFunctionCall()`, `isAssignment()`, `isIfExpression()`, `isForExpression()`, `isIndexAccess()`, `isRangeExpression()`

**Utilities:**

- `typeOf(value)` - Returns type name as string: `"number"`, `"string"`, `"boolean"`, `"date"`, `"array"`

**Standard Library:**

- `defaultContext` - All 78 built-in functions
- `core` - Type conversion: `STR`, `NUM`, `TYPE`
- `math` - Math functions (14)
- `string` - String functions (8)
- `array` - Array functions (8)
- `datetime` - Date functions (24, most also accept PlainDateTime)
- `time` - Time functions (13)
- `datetimefull` - DateTime construction/conversion functions (7)

## Development Commands

```bash
# Root-level commands (run from repo root)
bun run build           # Build the library
bun run test            # Run all library tests
bun run lint            # Lint all packages
bun run lint:fix        # Auto-fix lint issues
bun run fmt             # Format all files
bun run fmt:check       # Check formatting

# Library-specific commands
bun run --cwd packages/littlewing dev            # Watch mode
bun run --cwd packages/littlewing test:watch      # Tests in watch mode
bun run --cwd packages/littlewing test:coverage   # Coverage report
bun run --cwd packages/littlewing release         # Bump version, commit, push, tag

# Playground
bun run --cwd packages/playground dev      # Start Vite dev server
bun run --cwd packages/playground build    # Production build
bun run --cwd packages/playground preview  # Preview production build
```

## Project Structure

This is a **Bun workspaces monorepo** with two packages:

```
/
├── package.json              # Workspace root (private)
├── bunfig.toml               # [install] linker = "hoisted"
├── tsconfig.json             # Project references only
├── .oxlintrc.json            # Shared lint config
├── .oxfmtrc.json             # Shared format config
├── packages/
│   ├── littlewing/           # Publishable library
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── bunfig.toml       # [test] preload only
│   │   ├── bunup.config.ts
│   │   ├── src/
│   │   │   ├── index.ts          # Public API exports
│   │   │   ├── types.ts          # RuntimeValue, ExecutionContext
│   │   │   ├── lexer.ts          # Tokenization (source → tokens)
│   │   │   ├── parser.ts         # Parsing (tokens → AST)
│   │   │   ├── interpreter.ts    # Tree-walk evaluation (AST + context → result)
│   │   │   ├── optimizer.ts      # AST optimization (constant folding + DCE)
│   │   │   ├── visitor.ts        # Visitor pattern for AST traversal
│   │   │   ├── ast.ts            # AST node types, type guards, builder functions
│   │   │   ├── codegen.ts        # Code generation (AST → source)
│   │   │   ├── analyzer.ts       # Static analysis utilities
│   │   │   ├── utils.ts          # Shared utilities (operators, type assertions, equality)
│   │   │   └── stdlib/
│   │   │       ├── index.ts          # Combines all stdlib modules into defaultContext
│   │   │       ├── core.ts           # STR, NUM, TYPE
│   │   │       ├── math.ts           # Math functions (14)
│   │   │       ├── string.ts         # String functions (8)
│   │   │       ├── array.ts          # Array functions (8)
│   │   │       ├── datetime.ts       # Date functions (24)
│   │   │       ├── time.ts           # Time functions (13)
│   │   │       └── datetimefull.ts   # DateTime functions (7)
│   │   └── test/                 # 16 test files, 737 tests
│   └── playground/           # Private web app
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts    # React + Tailwind + source alias
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── index.css
```

## Key Development Notes

### Type Safety

- Strict TypeScript mode enforced
- No implicit `any` types
- Type guards required for safe union type narrowing
- `isolatedDeclarations` enabled
- `RuntimeValue` is a 7-type union requiring explicit type handling

### Visitor Pattern

The codebase uses a centralized visitor pattern for AST traversal, implemented in `packages/littlewing/src/visitor.ts`.

**Two visitor functions:**

1. **`visit<T>(node, visitor)`** - Exhaustive visitor requiring all 14 node type handlers
2. **`visitPartial<T>(node, visitor, defaultHandler)`** - Partial visitor with fallback

**Used by:** interpreter, optimizer, codegen, analyzer

**Example (custom traversal):**

```typescript
import { visit } from "littlewing";

const count = visit(ast, {
	Program: (n, recurse) => n.statements.reduce((sum, s) => sum + recurse(s), 0),
	NumberLiteral: () => 1,
	StringLiteral: () => 1,
	BooleanLiteral: () => 1,
	ArrayLiteral: (n, recurse) => 1 + n.elements.reduce((sum, el) => sum + recurse(el), 0),
	Identifier: () => 1,
	BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
	UnaryOp: (n, recurse) => 1 + recurse(n.argument),
	FunctionCall: (n, recurse) => 1 + n.args.reduce((sum, arg) => sum + recurse(arg), 0),
	Assignment: (n, recurse) => 1 + recurse(n.value),
	IfExpression: (n, recurse) =>
		1 + recurse(n.condition) + recurse(n.consequent) + recurse(n.alternate),
	ForExpression: (n, recurse) =>
		1 + recurse(n.iterable) + (n.guard ? recurse(n.guard) : 0) + recurse(n.body),
	IndexAccess: (n, recurse) => 1 + recurse(n.object) + recurse(n.index),
	RangeExpression: (n, recurse) => 1 + recurse(n.start) + recurse(n.end),
});
```

**Important: Object-based AST structure:**

- Nodes are readonly objects with a `kind` discriminator
- Access fields by name: `n.left`, `n.operator`, `n.right`, etc.
- Use type guards for safe type narrowing: `if (isBinaryOp(node))`

### Optimization

The optimizer (`packages/littlewing/src/optimizer.ts`) implements constant folding, constant propagation, and dead code elimination:

- **Constant folding** - Evaluates pure expressions at compile time (numbers, strings, booleans)
- **Cross-type folding** - `1 == "1"` folds to `false`, `"a" + "b"` folds to `"ab"`
- **Conditional folding** - `if true then x else y` folds to `x` (requires boolean literal condition)
- **Constant propagation** - When `externalVariables` is provided, substitutes single-assignment literal variables and re-folds iteratively until stable. Variables in the `externalVariables` set, reassigned variables, and `for` loop variables are never propagated.
- **Dead code elimination** - Removes unused variable assignments
- **Without `externalVariables`** - No variables are propagated (backward-compatible; they can be overridden by `ExecutionContext.variables` at runtime)

### Testing

Tests use Bun's built-in test framework:

- **737 tests** across 16 test files
- Run a single test file: `bun test packages/littlewing/test/optimizer.test.ts`

### Code Style

- oxlint for linting, oxfmt for formatting
- Tabs for indentation
- Double quotes, semicolons (configured in oxlint/oxfmt)
- Git hooks enforce lint and type-check on pre-commit

### Common Development Tasks

**Adding a new stdlib function:**

1. Implement in the appropriate `packages/littlewing/src/stdlib/*.ts` module
2. Use assertion helpers (`assertNumber`, `assertString`, `assertArray`, `assertDate`, `assertBoolean`) for type safety
3. Use UPPERCASE naming convention
4. Add tests in `packages/littlewing/test/defaults.test.ts`
5. Export is automatic via the stdlib `index.ts` spread

**Adding a new AST node type:**

1. Add `NodeKind` variant in `packages/littlewing/src/ast.ts`
2. Add interface type definition, type guard, and builder function in `packages/littlewing/src/ast.ts`
3. Expand `ASTNode` union and update `getNodeName`
4. Add handler to `Visitor<T>` in `packages/littlewing/src/visitor.ts`
5. Add case to `visitPartial` switch
6. Update all visitor consumers: interpreter, optimizer, codegen
7. Update `collectAllIdentifiers` in `packages/littlewing/src/utils.ts`
8. Add parser support in `packages/littlewing/src/parser.ts`

**Adding a new binary operator:**

1. Add token type to `TokenKind` in `packages/littlewing/src/lexer.ts`
2. Handle tokenization in `nextToken`
3. Add precedence in parser's `getTokenPrecedence`
4. Add to `Operator` type in `packages/littlewing/src/ast.ts`
5. Add to `evaluateBinaryOperation()` in `packages/littlewing/src/utils.ts`
6. Add tests

## AST Node Types Reference

```typescript
// 14 readonly object-based AST node types

interface Program {
	readonly kind: NodeKind.Program;
	readonly statements: readonly ASTNode[];
}
interface NumberLiteral {
	readonly kind: NodeKind.NumberLiteral;
	readonly value: number;
}
interface StringLiteral {
	readonly kind: NodeKind.StringLiteral;
	readonly value: string;
}
interface BooleanLiteral {
	readonly kind: NodeKind.BooleanLiteral;
	readonly value: boolean;
}
interface ArrayLiteral {
	readonly kind: NodeKind.ArrayLiteral;
	readonly elements: readonly ASTNode[];
}
interface Identifier {
	readonly kind: NodeKind.Identifier;
	readonly name: string;
}
interface BinaryOp {
	readonly kind: NodeKind.BinaryOp;
	readonly left: ASTNode;
	readonly operator: Operator;
	readonly right: ASTNode;
}
interface UnaryOp {
	readonly kind: NodeKind.UnaryOp;
	readonly operator: "-" | "!";
	readonly argument: ASTNode;
}
interface FunctionCall {
	readonly kind: NodeKind.FunctionCall;
	readonly name: string;
	readonly args: readonly ASTNode[];
}
interface Assignment {
	readonly kind: NodeKind.Assignment;
	readonly name: string;
	readonly value: ASTNode;
}
interface IfExpression {
	readonly kind: NodeKind.IfExpression;
	readonly condition: ASTNode;
	readonly consequent: ASTNode;
	readonly alternate: ASTNode;
}
interface ForExpression {
	readonly kind: NodeKind.ForExpression;
	readonly variable: string;
	readonly iterable: ASTNode;
	readonly guard: ASTNode | null;
	readonly body: ASTNode;
}
interface IndexAccess {
	readonly kind: NodeKind.IndexAccess;
	readonly object: ASTNode;
	readonly index: ASTNode;
}
interface RangeExpression {
	readonly kind: NodeKind.RangeExpression;
	readonly start: ASTNode;
	readonly end: ASTNode;
	readonly inclusive: boolean;
}
```

## Built-in Functions Summary

**Total: 78 built-in functions in `defaultContext`**

- **Type Conversion (3):** STR, NUM, TYPE
- **Math (14):** ABS, CEIL, FLOOR, ROUND, SQRT, MIN, MAX, CLAMP, SIN, COS, TAN, LOG, LOG10, EXP
- **String (8):** STR_LEN, STR_CHAR_AT, STR_UPPER, STR_LOWER, STR_TRIM, STR_SLICE, STR_CONTAINS, STR_INDEX_OF
- **Array (8):** ARR_LEN, ARR_INDEX, ARR_PUSH, ARR_SLICE, ARR_CONTAINS, ARR_REVERSE, ARR_FIRST, ARR_LAST
- **Date - Core (2):** TODAY, DATE
- **Date - Extractors (6):** GET_YEAR, GET_MONTH, GET_DAY, GET_WEEKDAY, GET_DAY_OF_YEAR, GET_QUARTER
- **Date - Arithmetic (3):** ADD_DAYS, ADD_MONTHS, ADD_YEARS
- **Date - Differences (4):** DIFFERENCE_IN_DAYS, DIFFERENCE_IN_WEEKS, DIFFERENCE_IN_MONTHS, DIFFERENCE_IN_YEARS
- **Date - Period Boundaries (6):** START_OF_MONTH, END_OF_MONTH, START_OF_YEAR, END_OF_YEAR, START_OF_WEEK, START_OF_QUARTER
- **Date - Comparisons (3):** IS_SAME_DAY, IS_WEEKEND, IS_LEAP_YEAR
- **Time - Core (2):** TIME, NOW_TIME
- **Time - Extractors (4):** GET_HOUR, GET_MINUTE, GET_SECOND, GET_MILLISECOND
- **Time - Arithmetic (3):** ADD_HOURS, ADD_MINUTES, ADD_SECONDS
- **Time - Differences (3):** DIFFERENCE_IN_HOURS, DIFFERENCE_IN_MINUTES, DIFFERENCE_IN_SECONDS
- **Time - Comparisons (1):** IS_SAME_TIME
- **DateTime - Core (2):** DATETIME, NOW
- **DateTime - Conversions (3):** TO_DATE, TO_TIME, COMBINE
- **DateTime - Day Boundaries (2):** START_OF_DAY, END_OF_DAY

Date functions use `Temporal.PlainDate` (most also accept `Temporal.PlainDateTime`). Time functions use `Temporal.PlainTime` (most also accept `Temporal.PlainDateTime`). DateTime functions use `Temporal.PlainDateTime`.

## Build Output

- ESM-only distribution
- TypeScript declaration files generated
- Main entry point: `packages/littlewing/dist/index.js`
- Type definitions: `packages/littlewing/dist/index.d.ts`
- Optimized for tree-shaking
