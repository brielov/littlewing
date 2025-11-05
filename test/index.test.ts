import { expect, test } from 'bun:test'
import {
	ast,
	defaultContext,
	Executor,
	execute,
	generate,
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
	Lexer,
	optimize,
	parseSource,
	TokenType,
} from '../src'
import { CodeGenerator } from '../src/codegen'

// ============================================================================
// LEXER TESTS
// ============================================================================

test('Lexer: tokenize numbers', () => {
	const lexer = new Lexer('42 3.14')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	expect(tokens[0]?.value).toBe(42)
	expect(tokens[1]?.type).toBe(TokenType.NUMBER)
	expect(tokens[1]?.value).toBe(3.14)
	expect(tokens[2]?.type).toBe(TokenType.EOF)
})

test('Lexer: tokenize identifiers', () => {
	const lexer = new Lexer('x my_var now')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER)
	expect(tokens[0]?.value).toBe('x')
	expect(tokens[1]?.type).toBe(TokenType.IDENTIFIER)
	expect(tokens[1]?.value).toBe('my_var')
	expect(tokens[2]?.type).toBe(TokenType.IDENTIFIER)
	expect(tokens[2]?.value).toBe('now')
})

test('Lexer: tokenize operators', () => {
	const lexer = new Lexer('+ - * / % ^')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.PLUS)
	expect(tokens[1]?.type).toBe(TokenType.MINUS)
	expect(tokens[2]?.type).toBe(TokenType.STAR)
	expect(tokens[3]?.type).toBe(TokenType.SLASH)
	expect(tokens[4]?.type).toBe(TokenType.PERCENT)
	expect(tokens[5]?.type).toBe(TokenType.CARET)
})

test('Lexer: skip comments', () => {
	const lexer = new Lexer('42 // this is a comment\n 3.14')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.value).toBe(42)
	expect(tokens[1]?.value).toBe(3.14)
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
	expect(tokens[0]?.value).toBe('x')
	expect(tokens[1]?.value).toBe('=')
	expect(tokens[2]?.value).toBe(1)
	expect(tokens[3]?.value).toBe('+')
	expect(tokens[4]?.value).toBe(2)
})

test('Lexer: tokenize decimal numbers', () => {
	const lexer = new Lexer('3.14159 0.5 100.0')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	// biome-ignore lint/suspicious/noApproximativeNumericConstant: testing lexer parsing of literal
	expect(tokens[0]?.value).toBeCloseTo(3.14159)
	expect(tokens[1]?.type).toBe(TokenType.NUMBER)
	expect(tokens[1]?.value).toBe(0.5)
	expect(tokens[2]?.type).toBe(TokenType.NUMBER)
	expect(tokens[2]?.value).toBe(100.0)
})

test('Lexer: tokenize large numbers', () => {
	const lexer = new Lexer('1704067200000')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	expect(tokens[0]?.value).toBe(1704067200000)
})

test('Lexer: tokenize scientific notation', () => {
	const lexer = new Lexer('1.5e6 2e10 3e-2 4E+5')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	expect(tokens[0]?.value).toBe(1500000)
	expect(tokens[1]?.type).toBe(TokenType.NUMBER)
	expect(tokens[1]?.value).toBe(20000000000)
	expect(tokens[2]?.type).toBe(TokenType.NUMBER)
	expect(tokens[2]?.value).toBe(0.03)
	expect(tokens[3]?.type).toBe(TokenType.NUMBER)
	expect(tokens[3]?.value).toBe(400000)
})

test('Lexer: error on invalid scientific notation', () => {
	expect(() => new Lexer('1e').tokenize()).toThrow(
		'expected digit after exponent',
	)
	expect(() => new Lexer('1e+').tokenize()).toThrow(
		'expected digit after exponent',
	)
})

// ============================================================================
// PARSER TESTS
// ============================================================================

test('Parser: parse number literal', () => {
	const node = parseSource('42')
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(42)
	}
})

test('Parser: parse identifier', () => {
	const node = parseSource('x')
	expect(isIdentifier(node)).toBe(true)
	if (isIdentifier(node)) {
		expect(node.name).toBe('x')
	}
})

test('Parser: parse binary operation', () => {
	const node = parseSource('1 + 2')
	expect(isBinaryOp(node)).toBe(true)
	if (isBinaryOp(node)) {
		expect(node.operator).toBe('+')
		expect(node.left.type).toBe('NumberLiteral')
		expect(node.right.type).toBe('NumberLiteral')
	}
})

test('Parser: parse operator precedence', () => {
	const node = parseSource('1 + 2 * 3')
	// Should parse as 1 + (2 * 3)
	expect(isBinaryOp(node)).toBe(true)
	if (isBinaryOp(node)) {
		expect(node.operator).toBe('+')
		expect(node.right.type).toBe('BinaryOp')
		if (isBinaryOp(node.right)) {
			expect(node.right.operator).toBe('*')
		}
	}
})

test('Parser: parse parentheses', () => {
	const node = parseSource('(1 + 2) * 3')
	// Should parse as (1 + 2) * 3
	expect(isBinaryOp(node)).toBe(true)
	if (isBinaryOp(node)) {
		expect(node.operator).toBe('*')
		expect(node.left.type).toBe('BinaryOp')
		if (isBinaryOp(node.left)) {
			expect(node.left.operator).toBe('+')
		}
	}
})

test('Parser: parse unary minus', () => {
	const node = parseSource('-42')
	expect(isUnaryOp(node)).toBe(true)
	if (isUnaryOp(node)) {
		expect(node.operator).toBe('-')
		expect(node.argument.type).toBe('NumberLiteral')
		if (isNumberLiteral(node.argument)) {
			expect(node.argument.value).toBe(42)
		}
	}
})

test('Parser: parse function call without arguments', () => {
	const node = parseSource('now()')
	expect(isFunctionCall(node)).toBe(true)
	if (isFunctionCall(node)) {
		expect(node.name).toBe('now')
		expect(node.arguments.length).toBe(0)
	}
})

test('Parser: parse function call with arguments', () => {
	const node = parseSource('abs(-5)')
	expect(isFunctionCall(node)).toBe(true)
	if (isFunctionCall(node)) {
		expect(node.name).toBe('abs')
		expect(node.arguments.length).toBe(1)
	}
})

test('Parser: parse variable assignment', () => {
	const node = parseSource('x = 5')
	expect(isAssignment(node)).toBe(true)
	if (isAssignment(node)) {
		expect(node.name).toBe('x')
		expect(node.value.type).toBe('NumberLiteral')
	}
})

test('Parser: parse complex assignment', () => {
	const node = parseSource('z = x + y')
	expect(isAssignment(node)).toBe(true)
	if (isAssignment(node)) {
		expect(node.name).toBe('z')
		expect(node.value.type).toBe('BinaryOp')
	}
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
	expect(() => execute('10 % 0')).toThrow('Modulo by zero')
})

test('Executor: floating point arithmetic', () => {
	expect(execute('0.1 + 0.2')).toBeCloseTo(0.3)
	expect(execute('3.14 * 2')).toBeCloseTo(6.28)
})

// ============================================================================
// TIMESTAMP ARITHMETIC TESTS
// ============================================================================

test('Timestamp: add milliseconds to timestamp', () => {
	const timestamp = 1704067200000 // 2024-01-01T00:00:00Z
	const result = execute('t + 1000', {
		variables: { t: timestamp },
	})
	expect(result).toBe(timestamp + 1000)
})

test('Timestamp: subtract milliseconds from timestamp', () => {
	const timestamp = 1704067200000
	const result = execute('t - 1000', {
		variables: { t: timestamp },
	})
	expect(result).toBe(timestamp - 1000)
})

test('Timestamp: difference between two timestamps', () => {
	const t1 = 1704067200000 // 2024-01-01T00:00:00Z
	const t2 = 1704153600000 // 2024-01-02T00:00:00Z
	const result = execute('t2 - t1', {
		variables: { t1, t2 },
	})
	expect(result).toBe(t2 - t1) // 86400000 milliseconds (1 day)
})

test('Timestamp: now() returns timestamp', () => {
	const now = 1704067200000
	const result = execute('now()', {
		functions: { now: () => now },
	})
	expect(result).toBe(now)
})

test('Timestamp: timestamp + time duration', () => {
	const now = 1704067200000
	const result = execute('now() + minutes(5)', {
		functions: {
			now: () => now,
			minutes: (m: number) => m * 60 * 1000,
		},
	})
	expect(result).toBe(now + 5 * 60 * 1000)
})

test('Timestamp: complex date arithmetic', () => {
	const now = 1704067200000
	const result = execute('now() + hours(2) + minutes(30)', {
		functions: {
			now: () => now,
			hours: (h: number) => h * 60 * 60 * 1000,
			minutes: (m: number) => m * 60 * 1000,
		},
	})
	expect(result).toBe(now + 2 * 60 * 60 * 1000 + 30 * 60 * 1000)
})

test('Timestamp: calculate deadline', () => {
	const start = 1704067200000
	const duration = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
	const result = execute('start + duration', {
		variables: { start, duration },
	})
	expect(result).toBe(start + duration)
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
	const node = ast.functionCall('abs', [ast.negate(ast.number(5))])
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

test('Integration: multiple variable assignments', () => {
	const code = `
x = 1;
y = 2;
z = x + y
	`
	const result = execute(code)
	expect(result).toBe(3)
})

test('Integration: timestamp calculation', () => {
	const code = `t = now()`
	const now = 1704067200000
	const result = execute(code, {
		functions: { now: () => now },
	})
	expect(result).toBe(now)
})

test('Integration: variable arithmetic', () => {
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

test('Integration: timestamp-based calculation', () => {
	const now = 1704067200000
	const code = `
start = now();
duration = minutes(5);
end = start + duration
	`
	const result = execute(code, {
		functions: {
			now: () => now,
			minutes: (m: number) => m * 60 * 1000,
		},
	})
	expect(result).toBe(now + 5 * 60 * 1000)
})

test('Integration: compound interest calculation', () => {
	const code = `
principal = 1000;
rate = 0.05;
years = 3;
amount = principal * (1 + rate) ^ years
	`
	const result = execute(code)
	expect(result).toBeCloseTo(1157.625)
})

// ============================================================================
// OPTIMIZATION TESTS
// ============================================================================

test('Optimization: constant folding binary operations', () => {
	const node = optimize(parseSource('2 + 3'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(5)
	}
})

test('Optimization: constant folding with multiplication', () => {
	const node = optimize(parseSource('4 * 5'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(20)
	}
})

test('Optimization: constant folding complex expression', () => {
	const node = optimize(parseSource('2 + 3 * 4'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(14)
	}
})

test('Optimization: constant folding with exponentiation', () => {
	const node = optimize(parseSource('2 ^ 3'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(8)
	}
})

test('Optimization: constant folding unary minus', () => {
	const node = optimize(parseSource('-5'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(-5)
	}
})

test('Optimization: constant folding nested unary and binary', () => {
	const node = optimize(parseSource('-(2 + 3)'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(-5)
	}
})

test('Optimization: does not fold with variables', () => {
	const node = optimize(parseSource('x + 3'))
	// Should remain a binary operation since x is not a literal
	expect(isBinaryOp(node)).toBe(true)
	if (isBinaryOp(node)) {
		expect(node.operator).toBe('+')
		expect(node.left.type).toBe('Identifier')
		// Right side should be optimized
		expect(isNumberLiteral(node.right)).toBe(true)
	}
})

test('Optimization: partial folding in assignments', () => {
	const node = optimize(parseSource('x = 2 + 3'))
	expect(isAssignment(node)).toBe(true)
	if (isAssignment(node)) {
		expect(node.name).toBe('x')
		// Value should be folded to 5
		expect(isNumberLiteral(node.value)).toBe(true)
		if (isNumberLiteral(node.value)) {
			expect(node.value.value).toBe(5)
		}
	}
})

test('Optimization: multiple statements with folding', () => {
	const node = optimize(parseSource('x = 5; y = 2 * 3'))
	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		expect(node.statements.length).toBe(2)
		// Second statement should have folded value
		const secondStmt = node.statements[1]
		if (secondStmt && isAssignment(secondStmt)) {
			expect(isNumberLiteral(secondStmt.value)).toBe(true)
			if (isNumberLiteral(secondStmt.value)) {
				expect(secondStmt.value.value).toBe(6)
			}
		}
	}
})

test('Optimization: scientific notation folding', () => {
	const node = optimize(parseSource('1e6 + 2e6'))
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(3000000)
	}
})

test('Optimization: manual optimize() function', () => {
	const unoptimized = parseSource('10 * 5')
	const optimized = optimize(unoptimized)
	expect(isNumberLiteral(optimized)).toBe(true)
	if (isNumberLiteral(optimized)) {
		expect(optimized.value).toBe(50)
	}
})

test('Optimization: execution result same with or without optimization', () => {
	const source = '2 + 3 * 4 - 1'
	const unoptimized = execute(source)
	const optimizedAst = optimize(parseSource(source))
	const executor = new Executor()
	const optimized = executor.execute(optimizedAst)
	expect(optimized).toBe(unoptimized)
	expect(optimized).toBe(13)
})

test('Optimization: division by zero error during folding', () => {
	expect(() => optimize(parseSource('1 / 0'))).toThrow(
		'Division by zero in constant folding',
	)
})

test('Optimization: modulo by zero error during folding', () => {
	expect(() => optimize(parseSource('10 % 0'))).toThrow(
		'Modulo by zero in constant folding',
	)
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

test('Default context: now() returns timestamp', () => {
	const before = Date.now()
	const result = execute('now()', defaultContext)
	const after = Date.now()
	expect(typeof result).toBe('number')
	expect(result).toBeGreaterThanOrEqual(before)
	expect(result).toBeLessThanOrEqual(after)
})

test('Default context: timestamp() creates timestamp', () => {
	const result = execute('timestamp(2024, 1, 1)', defaultContext)
	expect(typeof result).toBe('number')
	const date = new Date(result)
	expect(date.getFullYear()).toBe(2024)
	expect(date.getMonth()).toBe(0) // January is 0
	expect(date.getDate()).toBe(1)
})

test('Default context: timestamp() with time components', () => {
	const result = execute('timestamp(2024, 1, 1, 12, 30, 0)', defaultContext)
	expect(typeof result).toBe('number')
	const date = new Date(result)
	expect(date.getFullYear()).toBe(2024)
	expect(date.getHours()).toBe(12)
	expect(date.getMinutes()).toBe(30)
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

test('Default context: weeks()', () => {
	const result = execute('weeks(1)', defaultContext)
	expect(result).toBe(7 * 24 * 60 * 60 * 1000)
})

test('Default context: year() extracts year from timestamp', () => {
	const timestamp = new Date('2024-06-15').getTime()
	const result = execute('year(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(2024)
})

test('Default context: month() extracts month from timestamp', () => {
	const timestamp = new Date('2024-06-15').getTime()
	const result = execute('month(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(6) // 1-based: June = 6
})

test('Default context: day() extracts day from timestamp', () => {
	const timestamp = new Date('2024-06-15').getTime()
	const result = execute('day(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(15)
})

test('Default context: hour() extracts hour from timestamp', () => {
	const timestamp = new Date('2024-06-15T14:30:00').getTime()
	const result = execute('hour(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(14)
})

test('Default context: minute() extracts minute from timestamp', () => {
	const timestamp = new Date('2024-06-15T14:30:00').getTime()
	const result = execute('minute(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(30)
})

test('Default context: second() extracts second from timestamp', () => {
	const timestamp = new Date('2024-06-15T14:30:45').getTime()
	const result = execute('second(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBe(45)
})

test('Default context: weekday() extracts day of week', () => {
	const timestamp = new Date('2024-01-01').getTime() // Monday
	const result = execute('weekday(t)', {
		...defaultContext,
		variables: { t: timestamp },
	})
	expect(result).toBeGreaterThanOrEqual(0)
	expect(result).toBeLessThanOrEqual(6)
})

test('Default context: now() + minutes()', () => {
	const result = execute('now() + minutes(5)', defaultContext)
	expect(typeof result).toBe('number')
	expect(result).toBeGreaterThan(Date.now())
})

test('Default context: spread into custom context', () => {
	const result = execute('abs(x * -2)', {
		...defaultContext,
		variables: { x: 5 },
	})
	expect(result).toBe(10)
})

// ============================================================================
// CODE GENERATION TESTS
// ============================================================================

test('CodeGen: generate number literal', () => {
	const node = ast.number(42)
	const code = generate(node)
	expect(code).toBe('42')
})

test('CodeGen: generate identifier', () => {
	const node = ast.identifier('x')
	const code = generate(node)
	expect(code).toBe('x')
})

test('CodeGen: generate simple binary operation', () => {
	const node = ast.add(ast.number(2), ast.number(3))
	const code = generate(node)
	expect(code).toBe('2 + 3')
})

test('CodeGen: generate binary operation with proper spacing', () => {
	const node = ast.subtract(ast.number(10), ast.number(5))
	const code = generate(node)
	expect(code).toBe('10 - 5')
})

test('CodeGen: generate multiplication', () => {
	const node = ast.multiply(ast.number(3), ast.number(4))
	const code = generate(node)
	expect(code).toBe('3 * 4')
})

test('CodeGen: generate division', () => {
	const node = ast.divide(ast.number(10), ast.number(2))
	const code = generate(node)
	expect(code).toBe('10 / 2')
})

test('CodeGen: generate modulo', () => {
	const node = ast.modulo(ast.number(10), ast.number(3))
	const code = generate(node)
	expect(code).toBe('10 % 3')
})

test('CodeGen: generate exponentiation', () => {
	const node = ast.exponentiate(ast.number(2), ast.number(3))
	const code = generate(node)
	expect(code).toBe('2 ^ 3')
})

test('CodeGen: generate unary minus', () => {
	const node = ast.negate(ast.number(5))
	const code = generate(node)
	expect(code).toBe('-5')
})

test('CodeGen: generate unary minus with binary operation', () => {
	const node = ast.negate(ast.add(ast.number(2), ast.number(3)))
	const code = generate(node)
	expect(code).toBe('-(2 + 3)')
})

test('CodeGen: generate function call without arguments', () => {
	const node = ast.functionCall('now')
	const code = generate(node)
	expect(code).toBe('now()')
})

test('CodeGen: generate function call with single argument', () => {
	const node = ast.functionCall('abs', [ast.negate(ast.number(5))])
	const code = generate(node)
	expect(code).toBe('abs(-5)')
})

test('CodeGen: generate function call with multiple arguments', () => {
	const node = ast.functionCall('max', [
		ast.number(1),
		ast.number(5),
		ast.number(3),
	])
	const code = generate(node)
	expect(code).toBe('max(1, 5, 3)')
})

test('CodeGen: generate variable assignment', () => {
	const node = ast.assign('x', ast.number(5))
	const code = generate(node)
	expect(code).toBe('x = 5')
})

test('CodeGen: generate complex assignment', () => {
	const node = ast.assign(
		'z',
		ast.add(ast.identifier('x'), ast.identifier('y')),
	)
	const code = generate(node)
	expect(code).toBe('z = x + y')
})

test('CodeGen: precedence - multiply binds tighter than add', () => {
	const node = ast.add(
		ast.number(1),
		ast.multiply(ast.number(2), ast.number(3)),
	)
	const code = generate(node)
	expect(code).toBe('1 + 2 * 3')
})

test('CodeGen: precedence - add on left needs parens', () => {
	const node = ast.multiply(
		ast.add(ast.number(1), ast.number(2)),
		ast.number(3),
	)
	const code = generate(node)
	expect(code).toBe('(1 + 2) * 3')
})

test('CodeGen: precedence - power binds tighter than multiply', () => {
	const node = ast.multiply(
		ast.number(2),
		ast.exponentiate(ast.number(3), ast.number(2)),
	)
	const code = generate(node)
	expect(code).toBe('2 * 3 ^ 2')
})

test('CodeGen: precedence - nested operations', () => {
	const node = ast.add(
		ast.multiply(ast.number(2), ast.number(3)),
		ast.divide(ast.number(10), ast.number(2)),
	)
	const code = generate(node)
	expect(code).toBe('2 * 3 + 10 / 2')
})

test('CodeGen: precedence - subtract left side', () => {
	const node = ast.subtract(
		ast.add(ast.number(10), ast.number(5)),
		ast.number(3),
	)
	const code = generate(node)
	expect(code).toBe('10 + 5 - 3')
})

test('CodeGen: precedence - subtract right side', () => {
	const node = ast.subtract(
		ast.number(10),
		ast.subtract(ast.number(5), ast.number(2)),
	)
	const code = generate(node)
	expect(code).toBe('10 - (5 - 2)')
})

test('CodeGen: precedence - divide right side needs parens', () => {
	const node = ast.divide(
		ast.number(20),
		ast.multiply(ast.number(2), ast.number(5)),
	)
	const code = generate(node)
	expect(code).toBe('20 / (2 * 5)')
})

test('CodeGen: precedence - exponentiation is right associative', () => {
	const node = ast.exponentiate(
		ast.number(2),
		ast.exponentiate(ast.number(3), ast.number(2)),
	)
	const code = generate(node)
	expect(code).toBe('2 ^ 3 ^ 2')
})

test('CodeGen: precedence - left exponentiation needs parens', () => {
	const node = ast.exponentiate(
		ast.exponentiate(ast.number(2), ast.number(3)),
		ast.number(2),
	)
	const code = generate(node)
	expect(code).toBe('(2 ^ 3) ^ 2')
})

test('CodeGen: round-trip simple expression', () => {
	const source = '2 + 3'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const result1 = new Executor().execute(ast1)
	const result2 = new Executor().execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: round-trip with precedence', () => {
	const source = '2 + 3 * 4'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const result1 = new Executor().execute(ast1)
	const result2 = new Executor().execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: round-trip with parentheses', () => {
	const source = '(2 + 3) * 4'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const result1 = new Executor().execute(ast1)
	const result2 = new Executor().execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: round-trip with variables', () => {
	const source = 'x = 5; y = x + 10'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const executor1 = new Executor()
	const result1 = executor1.execute(ast1)
	const executor2 = new Executor()
	const result2 = executor2.execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: round-trip with functions', () => {
	const source = 'abs(-5)'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const executor1 = new Executor({ functions: { abs: Math.abs } })
	const result1 = executor1.execute(ast1)
	const executor2 = new Executor({ functions: { abs: Math.abs } })
	const result2 = executor2.execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: round-trip complex expression', () => {
	const source = '2 ^ 3 * 4 + 5'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const ast2 = parseSource(code)
	const result1 = new Executor().execute(ast1)
	const result2 = new Executor().execute(ast2)
	expect(result1).toBe(result2)
})

test('CodeGen: program with multiple statements', () => {
	const node = {
		type: 'Program' as const,
		statements: [
			ast.assign('x', ast.number(5)),
			ast.assign('y', ast.number(10)),
			ast.add(ast.identifier('x'), ast.identifier('y')),
		],
	}
	const code = generate(node)
	expect(code).toBe('x = 5; y = 10; x + y')
})

test('CodeGen: generated code is syntactically valid', () => {
	const node = ast.multiply(
		ast.add(ast.number(2), ast.number(3)),
		ast.exponentiate(ast.number(2), ast.number(3)),
	)
	const code = generate(node)
	const parsed = parseSource(code)
	expect(parsed).toBeDefined()
})

// ============================================================================
// ADDITIONAL COVERAGE TESTS
// ============================================================================

test('Optimization: unary operation with variable (cannot fold)', () => {
	// Test unary operation that can't be folded (lines 61, 64-67 in optimizer.ts)
	const ast1 = parseSource('-x')
	const optimized = optimize(ast1)
	// Should still be a unary op because x is a variable, not a literal
	expect(isUnaryOp(optimized)).toBe(true)
	if (isUnaryOp(optimized)) {
		expect(isIdentifier(optimized.argument)).toBe(true)
	}
})

test('Default context: milliseconds() returns milliseconds', () => {
	// Test milliseconds function (uncovered in defaults.ts)
	const result = execute('milliseconds(1500)', defaultContext)
	expect(result).toBe(1500)
})

test('CodeGen: error on unknown node type', () => {
	// Test error handling for invalid AST node
	// biome-ignore lint/suspicious/noExplicitAny: testing error handling with intentionally invalid node type
	const invalidNode = { type: 'InvalidType' } as any
	const generator = new CodeGenerator()
	expect(() => generator.generate(invalidNode)).toThrow('Unknown node type')
})
