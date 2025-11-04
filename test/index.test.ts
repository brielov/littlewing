import { expect, test } from 'bun:test'
import {
	ast,
	defaultContext,
	Executor,
	execute,
	Lexer,
	parseSource,
	TokenType,
} from '../src'

// ============================================================================
// LEXER TESTS
// ============================================================================

test('Lexer: tokenize numbers', () => {
	const lexer = new Lexer('42 3.14')
	const tokens = lexer.tokenize()
	expect(tokens[0].type).toBe(TokenType.NUMBER)
	expect(tokens[0].value).toBe(42)
	expect(tokens[1].type).toBe(TokenType.NUMBER)
	expect(tokens[1].value).toBe(3.14)
	expect(tokens[2].type).toBe(TokenType.EOF)
})

test('Lexer: tokenize identifiers', () => {
	const lexer = new Lexer('x my_var now')
	const tokens = lexer.tokenize()
	expect(tokens[0].type).toBe(TokenType.IDENTIFIER)
	expect(tokens[0].value).toBe('x')
	expect(tokens[1].type).toBe(TokenType.IDENTIFIER)
	expect(tokens[1].value).toBe('my_var')
	expect(tokens[2].type).toBe(TokenType.IDENTIFIER)
	expect(tokens[2].value).toBe('now')
})

test('Lexer: tokenize operators', () => {
	const lexer = new Lexer('+ - * / %')
	const tokens = lexer.tokenize()
	expect(tokens[0].type).toBe(TokenType.PLUS)
	expect(tokens[1].type).toBe(TokenType.MINUS)
	expect(tokens[2].type).toBe(TokenType.STAR)
	expect(tokens[3].type).toBe(TokenType.SLASH)
	expect(tokens[4].type).toBe(TokenType.PERCENT)
})

test('Lexer: skip comments', () => {
	const lexer = new Lexer('42 // this is a comment\n 3.14')
	const tokens = lexer.tokenize()
	expect(tokens[0].value).toBe(42)
	expect(tokens[1].value).toBe(3.14)
})

test('Lexer: skip whitespace and semicolons', () => {
	const lexer = new Lexer('x = 1 ; y = 2')
	const tokens = lexer.tokenize()
	const filtered = tokens.filter((t) => t.type !== TokenType.EOF)
	expect(filtered.length).toBe(6) // x, =, 1, y, =, 2
})

test('Lexer: tokenize full expression', () => {
	const lexer = new Lexer('x = 1 + 2')
	const tokens = lexer.tokenize()
	expect(tokens[0].value).toBe('x')
	expect(tokens[1].value).toBe('=')
	expect(tokens[2].value).toBe(1)
	expect(tokens[3].value).toBe('+')
	expect(tokens[4].value).toBe(2)
})

test('Lexer: tokenize string literal', () => {
	const lexer = new Lexer("'hello'")
	const tokens = lexer.tokenize()
	expect(tokens[0].type).toBe(TokenType.STRING)
	expect(tokens[0].value).toBe('hello')
})

test('Lexer: tokenize string with escape sequences', () => {
	const lexer = new Lexer("'hello\\'world'")
	const tokens = lexer.tokenize()
	expect(tokens[0].type).toBe(TokenType.STRING)
	expect(tokens[0].value).toBe("hello'world")
})

// ============================================================================
// PARSER TESTS
// ============================================================================

test('Parser: parse number literal', () => {
	const ast = parseSource('42')
	expect(ast.type).toBe('NumberLiteral')
	expect(ast.value).toBe(42)
})

test('Parser: parse string literal', () => {
	const ast = parseSource("'hello'")
	expect(ast.type).toBe('StringLiteral')
	expect(ast.value).toBe('hello')
})

test('Parser: parse identifier', () => {
	const ast = parseSource('x')
	expect(ast.type).toBe('Identifier')
	expect(ast.name).toBe('x')
})

test('Parser: parse binary operation', () => {
	const ast = parseSource('1 + 2')
	expect(ast.type).toBe('BinaryOp')
	expect(ast.operator).toBe('+')
	expect(ast.left.type).toBe('NumberLiteral')
	expect(ast.right.type).toBe('NumberLiteral')
})

test('Parser: parse operator precedence', () => {
	const ast = parseSource('1 + 2 * 3')
	// Should parse as 1 + (2 * 3)
	expect(ast.type).toBe('BinaryOp')
	expect(ast.operator).toBe('+')
	expect(ast.right.type).toBe('BinaryOp')
	expect(ast.right.operator).toBe('*')
})

test('Parser: parse parentheses', () => {
	const ast = parseSource('(1 + 2) * 3')
	// Should parse as (1 + 2) * 3
	expect(ast.type).toBe('BinaryOp')
	expect(ast.operator).toBe('*')
	expect(ast.left.type).toBe('BinaryOp')
	expect(ast.left.operator).toBe('+')
})

test('Parser: parse unary minus', () => {
	const ast = parseSource('-42')
	expect(ast.type).toBe('UnaryOp')
	expect(ast.operator).toBe('-')
	expect(ast.argument.type).toBe('NumberLiteral')
	expect(ast.argument.value).toBe(42)
})

test('Parser: parse function call without arguments', () => {
	const ast = parseSource('now()')
	expect(ast.type).toBe('FunctionCall')
	expect(ast.name).toBe('now')
	expect(ast.arguments.length).toBe(0)
})

test('Parser: parse function call with arguments', () => {
	const ast = parseSource('abs(-5)')
	expect(ast.type).toBe('FunctionCall')
	expect(ast.name).toBe('abs')
	expect(ast.arguments.length).toBe(1)
})

test('Parser: parse variable assignment', () => {
	const ast = parseSource('x = 5')
	expect(ast.type).toBe('Assignment')
	expect(ast.name).toBe('x')
	expect(ast.value.type).toBe('NumberLiteral')
})

test('Parser: parse complex assignment', () => {
	const ast = parseSource('z = x + y')
	expect(ast.type).toBe('Assignment')
	expect(ast.name).toBe('z')
	expect(ast.value.type).toBe('BinaryOp')
})

// ============================================================================
// EXECUTOR TESTS
// ============================================================================

test('Executor: execute number literal', () => {
	const result = execute('42')
	expect(result).toBe(42)
})

test('Executor: execute simple arithmetic', () => {
	const result = execute('2 + 3')
	expect(result).toBe(5)
})

test('Executor: execute operator precedence', () => {
	const result = execute('2 + 3 * 4')
	expect(result).toBe(14)
})

test('Executor: execute exponentiation precedence', () => {
	// Exponentiation has higher precedence than multiplication
	expect(execute('2 * 3 ^ 2')).toBe(18) // 2 * 9, not 6 ^ 2
	expect(execute('2 ^ 3 * 4')).toBe(32) // 8 * 4, not 2 ^ 12
	expect(execute('(2 + 3) ^ 2')).toBe(25) // 5 ^ 2
})

test('Executor: execute parentheses', () => {
	const result = execute('(2 + 3) * 4')
	expect(result).toBe(20)
})

test('Executor: execute unary minus', () => {
	const result = execute('-5')
	expect(result).toBe(-5)
})

test('Executor: execute all operators', () => {
	expect(execute('10 - 3')).toBe(7)
	expect(execute('3 * 4')).toBe(12)
	expect(execute('10 / 2')).toBe(5)
	expect(execute('10 % 3')).toBe(1)
	expect(execute('2 ^ 3')).toBe(8)
	expect(execute('5 ^ 2')).toBe(25)
})

test('Executor: execute variable assignment', () => {
	const result = execute('x = 5')
	expect(result).toBe(5)
})

test('Executor: execute variable reference', () => {
	const result = execute('x = 5; x')
	expect(result).toBe(5)
})

test('Executor: execute complex expression with variables', () => {
	const result = execute('x = 2; y = 3; z = x + y')
	expect(result).toBe(5)
})

test('Executor: execute function call without arguments', () => {
	const result = execute('now()', {
		functions: { now: () => 12345 },
	})
	expect(result).toBe(12345)
})

test('Executor: execute function call with arguments', () => {
	const result = execute('abs(-5)', {
		functions: { abs: Math.abs },
	})
	expect(result).toBe(5)
})

test('Executor: execute with global variables', () => {
	const result = execute('i + 10', {
		variables: { i: 5 },
	})
	expect(result).toBe(15)
})

test('Executor: execute arithmetic with global variable', () => {
	const result = execute('x = i - 10', {
		variables: { i: 25 },
	})
	expect(result).toBe(15)
})

test('Executor: error on undefined variable', () => {
	expect(() => execute('x + 1')).toThrow('Undefined variable: x')
})

test('Executor: error on undefined function', () => {
	expect(() => execute('foo()')).toThrow('Undefined function: foo')
})

test('Executor: error on division by zero', () => {
	expect(() => execute('1 / 0')).toThrow('Division by zero')
})

test('Executor: error on modulo by zero', () => {
	expect(() => execute('10 % 0')).toThrow('Division by zero')
})

test('Executor: error on string variable assignment', () => {
	expect(() => execute("x = 'foo'")).toThrow('Cannot assign string to variable')
})

// ============================================================================
// DATE SUPPORT TESTS
// ============================================================================

test('Executor: function returning Date', () => {
	const now = new Date('2024-01-01T00:00:00Z').getTime()
	const result = execute('now()', {
		functions: { now: () => new Date(now) },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(now)
})

test('Executor: Date + number', () => {
	const date = new Date('2024-01-01T00:00:00Z')
	const result = execute('d + 1000', {
		variables: { d: date },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(date.getTime() + 1000)
})

test('Executor: number + Date', () => {
	const date = new Date('2024-01-01T00:00:00Z')
	const result = execute('1000 + d', {
		variables: { d: date },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(date.getTime() + 1000)
})

test('Executor: Date - number', () => {
	const date = new Date('2024-01-01T00:00:00Z')
	const result = execute('d - 1000', {
		variables: { d: date },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(date.getTime() - 1000)
})

test('Executor: Date + Date', () => {
	const date1 = new Date('2024-01-01T00:00:00Z')
	const date2 = new Date('2024-01-02T00:00:00Z')
	const result = execute('d1 + d2', {
		variables: { d1: date1, d2: date2 },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(date1.getTime() + date2.getTime())
})

test('Executor: Date - Date', () => {
	const date1 = new Date('2024-01-02T00:00:00Z')
	const date2 = new Date('2024-01-01T00:00:00Z')
	const result = execute('d1 - d2', {
		variables: { d1: date1, d2: date2 },
	})
	expect(result).toBe(date1.getTime() - date2.getTime())
})

test('Executor: now() + milliseconds', () => {
	const now = new Date('2024-01-01T00:00:00Z').getTime()
	const result = execute('now() + 60000', {
		functions: { now: () => new Date(now) },
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(now + 60000)
})

test('Executor: Date arithmetic with functions', () => {
	const now = new Date('2024-01-01T00:00:00Z').getTime()
	const result = execute('now() + minutes(2)', {
		functions: {
			now: () => new Date(now),
			minutes: (m) => m * 60 * 1000,
		},
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(now + 2 * 60 * 1000)
})

// ============================================================================
// AST BUILDER TESTS
// ============================================================================

test('AST builders: manual construction', () => {
	const node = ast.add(ast.number(2), ast.number(3))
	const executor = new Executor()
	const result = executor.execute(node)
	expect(result).toBe(5)
})

test('AST builders: complex expression', () => {
	const node = ast.multiply(
		ast.add(ast.number(2), ast.number(3)),
		ast.number(4),
	)
	const executor = new Executor()
	const result = executor.execute(node)
	expect(result).toBe(20)
})

test('AST builders: with variables', () => {
	const node = ast.assign('x', ast.add(ast.number(2), ast.number(3)))
	const executor = new Executor()
	const result = executor.execute(node)
	expect(result).toBe(5)
})

test('AST builders: function call', () => {
	const node = ast.functionCall('abs', [ast.number(-5)])
	const executor = new Executor({
		functions: { abs: Math.abs },
	})
	const result = executor.execute(node)
	expect(result).toBe(5)
})

test('AST builders: unary operator', () => {
	const node = ast.negate(ast.number(5))
	const executor = new Executor()
	const result = executor.execute(node)
	expect(result).toBe(-5)
})

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

test('Integration: lang.txt example 1', () => {
	const code = `
x = 1;
y = 2;
z = x + y
	`
	const result = execute(code)
	expect(result).toBe(3)
})

test('Integration: lang.txt example 2', () => {
	const code = `
d = now()
	`
	const now = new Date('2024-01-01T00:00:00Z')
	const result = execute(code, {
		functions: { now: () => now },
	})
	expect(result).toBe(now)
})

test('Integration: lang.txt example 3', () => {
	const code = `p = i - 10`
	const result = execute(code, {
		variables: { i: 25 },
	})
	expect(result).toBe(15)
})

test('Integration: complex real-world example', () => {
	const code = `
base = 100;
rate = 0.05;
interest = base * rate;
total = base + interest
	`
	const result = execute(code)
	expect(result).toBe(105)
})

test('Integration: date-based calculation', () => {
	const now = new Date('2024-01-01T00:00:00Z').getTime()
	const code = `
start = now();
duration = minutes(5);
end = start + duration
	`
	const result = execute(code, {
		functions: {
			now: () => new Date(now),
			minutes: (m) => m * 60 * 1000,
		},
	})
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(now + 5 * 60 * 1000)
})

// ============================================================================
// DEFAULT CONTEXT TESTS
// ============================================================================

test('Default context: Math.abs', () => {
	const result = execute('abs(-42)', defaultContext)
	expect(result).toBe(42)
})

test('Default context: Math.floor', () => {
	const result = execute('floor(3.7)', defaultContext)
	expect(result).toBe(3)
})

test('Default context: Math.ceil', () => {
	const result = execute('ceil(3.2)', defaultContext)
	expect(result).toBe(4)
})

test('Default context: Math.round', () => {
	const result = execute('round(3.5)', defaultContext)
	expect(result).toBe(4)
})

test('Default context: Math.sqrt', () => {
	const result = execute('sqrt(16)', defaultContext)
	expect(result).toBe(4)
})

test('Default context: exponentiation operator', () => {
	const result = execute('2 ^ 3', defaultContext)
	expect(result).toBe(8)
})

test('Default context: Math.max', () => {
	const result = execute('max(1, 5, 3)', defaultContext)
	expect(result).toBe(5)
})

test('Default context: Math.min', () => {
	const result = execute('min(1, 5, 3)', defaultContext)
	expect(result).toBe(1)
})

test('Default context: now()', () => {
	const before = Date.now()
	const result = execute('now()', defaultContext)
	const after = Date.now()
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBeGreaterThanOrEqual(before)
	expect((result as Date).getTime()).toBeLessThanOrEqual(after)
})

test('Default context: date() with timestamp', () => {
	const timestamp = 1704067200000 // 2024-01-01T00:00:00Z
	const result = execute('date(1704067200000)', defaultContext)
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBe(timestamp)
})

test('Default context: date() with ISO string', () => {
	const result = execute("date('2025-10-01')", defaultContext)
	expect(result instanceof Date).toBe(true)
	const date = result as Date
	expect(date.getUTCFullYear()).toBe(2025)
	expect(date.getUTCMonth()).toBe(9) // October is month 9 (0-indexed)
	expect(date.getUTCDate()).toBe(1)
})

test('Default context: date() no arguments', () => {
	const before = Date.now()
	const result = execute('date()', defaultContext)
	const after = Date.now()
	expect(result instanceof Date).toBe(true)
	expect((result as Date).getTime()).toBeGreaterThanOrEqual(before)
	expect((result as Date).getTime()).toBeLessThanOrEqual(after)
})

test('Default context: seconds()', () => {
	const result = execute('seconds(5)', defaultContext)
	expect(result).toBe(5000)
})

test('Default context: minutes()', () => {
	const result = execute('minutes(2)', defaultContext)
	expect(result).toBe(2 * 60 * 1000)
})

test('Default context: hours()', () => {
	const result = execute('hours(1)', defaultContext)
	expect(result).toBe(60 * 60 * 1000)
})

test('Default context: days()', () => {
	const result = execute('days(1)', defaultContext)
	expect(result).toBe(24 * 60 * 60 * 1000)
})

test('Default context: now() + minutes()', () => {
	const result = execute('now() + minutes(5)', defaultContext)
	expect(result instanceof Date).toBe(true)
})

test('Default context: spread into custom context', () => {
	const result = execute('abs(x * -2)', {
		...defaultContext,
		variables: { x: 5 },
	})
	expect(result).toBe(10)
})
