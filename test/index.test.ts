import { expect, test } from 'bun:test'
import {
	ast,
	defaultContext,
	Executor,
	execute,
	generate,
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
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
	// With aggressive optimization, unused variables are eliminated
	// Since neither x nor y are used, this optimizes to just the last assignment value
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(6)
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

test('Optimization: function call arguments are optimized recursively', () => {
	// max(2 + 3, 4 * 5) should optimize to max(5, 20)
	const node = optimize(parseSource('max(2 + 3, 4 * 5)'))
	expect(isFunctionCall(node)).toBe(true)
	if (isFunctionCall(node)) {
		expect(node.arguments.length).toBe(2)
		// First argument should be folded to 5
		const firstArg = node.arguments[0]
		expect(firstArg).toBeDefined()
		if (firstArg) {
			expect(isNumberLiteral(firstArg)).toBe(true)
			if (isNumberLiteral(firstArg)) {
				expect(firstArg.value).toBe(5)
			}
		}
		// Second argument should be folded to 20
		const secondArg = node.arguments[1]
		expect(secondArg).toBeDefined()
		if (secondArg) {
			expect(isNumberLiteral(secondArg)).toBe(true)
			if (isNumberLiteral(secondArg)) {
				expect(secondArg.value).toBe(20)
			}
		}
	}
})

test('Optimization: nested function calls with constant folding', () => {
	// max(min(10, 5 + 5), 2 ^ 3) should optimize to max(min(10, 10), 8)
	const node = optimize(parseSource('max(min(10, 5 + 5), 2 ^ 3)'))
	expect(isFunctionCall(node)).toBe(true)
	if (isFunctionCall(node)) {
		expect(node.name).toBe('max')
		// First arg should be nested function call with optimized args
		const firstArg = node.arguments[0]
		expect(firstArg).toBeDefined()
		if (firstArg && isFunctionCall(firstArg)) {
			expect(firstArg.name).toBe('min')
			const minFirstArg = firstArg.arguments[0]
			const minSecondArg = firstArg.arguments[1]
			if (minFirstArg && isNumberLiteral(minFirstArg)) {
				expect(minFirstArg.value).toBe(10)
			}
			if (minSecondArg && isNumberLiteral(minSecondArg)) {
				expect(minSecondArg.value).toBe(10)
			}
		}
		// Second arg should be folded to 8
		const secondArg = node.arguments[1]
		if (secondArg && isNumberLiteral(secondArg)) {
			expect(secondArg.value).toBe(8)
		}
	}
})

test('Optimization: assignment with deeply nested expression', () => {
	// x = -(3 + 4) * 2 should optimize to x = -14
	const node = optimize(parseSource('x = -(3 + 4) * 2'))
	expect(isAssignment(node)).toBe(true)
	if (isAssignment(node)) {
		expect(node.name).toBe('x')
		expect(isNumberLiteral(node.value)).toBe(true)
		if (isNumberLiteral(node.value)) {
			expect(node.value.value).toBe(-14)
		}
	}
})

test('Optimization: function call with nested unary and binary ops', () => {
	// abs(-(2 + 3) * 4) should optimize to abs(-20)
	const node = optimize(parseSource('abs(-(2 + 3) * 4)'))
	expect(isFunctionCall(node)).toBe(true)
	if (isFunctionCall(node)) {
		expect(node.name).toBe('abs')
		const arg = node.arguments[0]
		if (arg && isNumberLiteral(arg)) {
			expect(arg.value).toBe(-20)
		}
	}
})

test('Optimization: program with multiple complex statements', () => {
	// Multiple statements with various levels of nesting
	const source = 'a = 2 + 3; b = -(4 * 5); max(a, 10 + 10)'
	const node = optimize(parseSource(source))
	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		// With aggressive optimization:
		// - 'a' is propagated (a = 5)
		// - 'b' is eliminated (never used)
		// - max(5, 20) remains but cannot be folded (function call)
		expect(node.statements.length).toBe(1)

		// Should be just the function call with optimized arguments
		const stmt = node.statements[0]
		if (stmt && isFunctionCall(stmt)) {
			expect(stmt.name).toBe('max')
			// First arg should be folded to 5 (propagated from a)
			const arg1 = stmt.arguments[0]
			if (arg1 && isNumberLiteral(arg1)) {
				expect(arg1.value).toBe(5)
			}
			// Second arg should be folded to 20
			const arg2 = stmt.arguments[1]
			if (arg2 && isNumberLiteral(arg2)) {
				expect(arg2.value).toBe(20)
			}
		}
	}
})

// ============================================================================
// ADVANCED OPTIMIZATION TESTS (Constant Propagation & Dead Code Elimination)
// ============================================================================

test('Optimization: constant propagation - single variable', () => {
	const source = 'x = 5; x + 10'
	const node = optimize(parseSource(source))
	// Should be fully optimized to a single literal: 15
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(15)
	}
})

test('Optimization: constant propagation - multiple variables', () => {
	const source = 'x = 10; y = 20; x + y'
	const node = optimize(parseSource(source))
	// Should be fully optimized to a single literal: 30
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(30)
	}
})

test('Optimization: constant propagation - chained assignments', () => {
	const source = 'a = 5; b = a + 10; c = b * 2; c'
	const node = optimize(parseSource(source))
	// Should be fully optimized to a single literal: (5 + 10) * 2 = 30
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(30)
	}
})

test('Optimization: dead code elimination - unused assignment', () => {
	const source = 'x = 5; y = 10; y'
	const node = optimize(parseSource(source))
	// x is never used, should be eliminated, result should be 10
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(10)
	}
})

test('Optimization: dead code elimination - multiple unused', () => {
	const source = 'a = 1; b = 2; c = 3; d = 4; c + d'
	const node = optimize(parseSource(source))
	// a and b are never used, should be eliminated and fully folded to 7
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(7)
	}
})

test('Optimization: compound interest example', () => {
	const source = `
		principal = 1000;
		rate = 0.05;
		years = 10;
		n = 12;
		base = 1 + (rate / n);
		exponent = n * years;
		result = principal * (base ^ exponent);
		result
	`
	const node = optimize(parseSource(source))

	// Should be fully optimized to a single number literal
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		// 1000 * (1 + 0.05/12)^(12*10)
		expect(node.value).toBeCloseTo(1647.01, 2)
	}
})

test('Optimization: preserves external variables', () => {
	const source = 'x = external + 10; x * 2'
	const node = optimize(parseSource(source))

	// Cannot fully optimize because 'external' is not assigned
	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		expect(node.statements.length).toBe(2)

		// First statement should still be an assignment
		const stmt1 = node.statements[0]
		if (stmt1) {
			expect(isAssignment(stmt1)).toBe(true)
		}

		// Second statement references x, which cannot be inlined
		const stmt2 = node.statements[1]
		if (stmt2) {
			expect(isBinaryOp(stmt2)).toBe(true)
		}
	}
})

test('Optimization: mixed constant and external variables', () => {
	const source = 'a = 5; b = external; c = a + b; c'
	const node = optimize(parseSource(source))

	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		// 'a' can be propagated but 'external' and 'b' cannot
		expect(node.statements.length).toBeGreaterThan(1)

		// Verify that we still reference external variable
		const json = JSON.stringify(node)
		expect(json).toContain('external')
	}
})

test('Optimization: function calls prevent full folding', () => {
	const source = 'x = 5; y = now(); x + y'
	const node = optimize(parseSource(source))

	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		// Cannot fully fold because now() is a function call
		expect(node.statements.length).toBeGreaterThan(1)

		// But 'x' should still be propagated
		const json = JSON.stringify(node)
		expect(json).toContain('now')
	}
})

test('Optimization: variable reassignment prevents propagation', () => {
	const source = 'x = 5; x = 10; x'
	const node = optimize(parseSource(source))

	expect(isProgram(node)).toBe(true)
	if (isProgram(node)) {
		// Cannot propagate x because it's reassigned
		expect(node.statements.length).toBe(3)

		// All three statements should remain
		const stmt1 = node.statements[0]
		const stmt2 = node.statements[1]
		const stmt3 = node.statements[2]
		if (stmt1) expect(isAssignment(stmt1)).toBe(true)
		if (stmt2) expect(isAssignment(stmt2)).toBe(true)
		if (stmt3) expect(isIdentifier(stmt3)).toBe(true)
	}
})

test('Optimization: complex arithmetic fully optimized', () => {
	const source = 'a = 2; b = 3; c = 4; result = a * b + c ^ 2; result'
	const node = optimize(parseSource(source))

	// Should be fully optimized to a single literal: 2 * 3 + 4^2 = 22
	expect(isNumberLiteral(node)).toBe(true)
	if (isNumberLiteral(node)) {
		expect(node.value).toBe(22)
	}
})

test('Optimization: execution result unchanged after optimization', () => {
	const source = 'x = 10; y = 20; z = x + y; z * 2'

	const unoptimized = parseSource(source)
	const optimized = optimize(unoptimized)

	const result1 = new Executor().execute(unoptimized)
	const result2 = new Executor().execute(optimized)

	expect(result1).toBe(result2)
	expect(result1).toBe(60)
})

test('Optimization: preserves division by zero error', () => {
	const source = 'x = 10; y = 0; x / y'

	expect(() => optimize(parseSource(source))).toThrow('Division by zero')
})

test('Optimization: preserves modulo by zero error', () => {
	const source = 'x = 10; y = 0; x % y'

	expect(() => optimize(parseSource(source))).toThrow('Modulo by zero')
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
// COMPARISON OPERATORS TESTS
// ============================================================================

test('Lexer: tokenize comparison operators', () => {
	const lexer = new Lexer('== != < > <= >=')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.DOUBLE_EQUALS)
	expect(tokens[0]?.value).toBe('==')
	expect(tokens[1]?.type).toBe(TokenType.NOT_EQUALS)
	expect(tokens[1]?.value).toBe('!=')
	expect(tokens[2]?.type).toBe(TokenType.LESS_THAN)
	expect(tokens[2]?.value).toBe('<')
	expect(tokens[3]?.type).toBe(TokenType.GREATER_THAN)
	expect(tokens[3]?.value).toBe('>')
	expect(tokens[4]?.type).toBe(TokenType.LESS_EQUAL)
	expect(tokens[4]?.value).toBe('<=')
	expect(tokens[5]?.type).toBe(TokenType.GREATER_EQUAL)
	expect(tokens[5]?.value).toBe('>=')
})

test('Lexer: distinguish = from ==', () => {
	const lexer = new Lexer('x = 5 == 5')
	const tokens = lexer.tokenize()
	expect(tokens[1]?.type).toBe(TokenType.EQUALS)
	expect(tokens[3]?.type).toBe(TokenType.DOUBLE_EQUALS)
})

test('Lexer: != requires both characters', () => {
	const lexer = new Lexer('!')
	expect(() => lexer.tokenize()).toThrow('Unexpected character')
})

test('Execute: equality operator returns 1 or 0', () => {
	expect(execute('5 == 5')).toBe(1)
	expect(execute('5 == 3')).toBe(0)
	expect(execute('10 == 10')).toBe(1)
	expect(execute('7.5 == 7.5')).toBe(1)
})

test('Execute: not-equals operator', () => {
	expect(execute('5 != 3')).toBe(1)
	expect(execute('5 != 5')).toBe(0)
	expect(execute('10 != 10')).toBe(0)
})

test('Execute: less-than operator', () => {
	expect(execute('3 < 5')).toBe(1)
	expect(execute('5 < 3')).toBe(0)
	expect(execute('5 < 5')).toBe(0)
})

test('Execute: greater-than operator', () => {
	expect(execute('5 > 3')).toBe(1)
	expect(execute('3 > 5')).toBe(0)
	expect(execute('5 > 5')).toBe(0)
})

test('Execute: less-than-or-equal operator', () => {
	expect(execute('3 <= 5')).toBe(1)
	expect(execute('5 <= 5')).toBe(1)
	expect(execute('7 <= 5')).toBe(0)
})

test('Execute: greater-than-or-equal operator', () => {
	expect(execute('5 >= 3')).toBe(1)
	expect(execute('5 >= 5')).toBe(1)
	expect(execute('3 >= 5')).toBe(0)
})

test('Execute: comparison operators with variables', () => {
	expect(execute('x = 10; y = 5; x > y')).toBe(1)
	expect(execute('x = 5; y = 10; x < y')).toBe(1)
	expect(execute('x = 7; y = 7; x == y')).toBe(1)
})

test('Execute: comparison operator precedence (lower than arithmetic)', () => {
	// Comparisons have lower precedence than arithmetic
	expect(execute('2 + 3 == 5')).toBe(1) // (2 + 3) == 5 = 5 == 5 = 1
	expect(execute('10 - 5 > 3')).toBe(1) // (10 - 5) > 3 = 5 > 3 = 1
	expect(execute('2 * 3 < 10')).toBe(1) // (2 * 3) < 10 = 6 < 10 = 1
})

test('Execute: chained comparisons (left-to-right)', () => {
	// Note: Unlike Python, this evaluates left-to-right as binary ops
	// (5 > 3) > 0 = 1 > 0 = 1
	expect(execute('5 > 3 > 0')).toBe(1)
	// (3 < 5) < 2 = 1 < 2 = 1
	expect(execute('3 < 5 < 2')).toBe(1)
})

test('Execute: comparison in arithmetic expression', () => {
	// Comparison returns 0 or 1, can be used in arithmetic
	expect(execute('(5 > 3) * 10')).toBe(10) // 1 * 10 = 10
	expect(execute('(5 < 3) * 10')).toBe(0) // 0 * 10 = 0
	expect(execute('(10 == 10) + 5')).toBe(6) // 1 + 5 = 6
})

test('AST: comparison operator builders', () => {
	const node1 = ast.equals(ast.number(5), ast.number(5))
	expect(isBinaryOp(node1)).toBe(true)
	if (isBinaryOp(node1)) {
		expect(node1.operator).toBe('==')
	}

	const node2 = ast.notEquals(ast.number(5), ast.number(3))
	expect(isBinaryOp(node2)).toBe(true)
	if (isBinaryOp(node2)) {
		expect(node2.operator).toBe('!=')
	}

	const node3 = ast.lessThan(ast.number(3), ast.number(5))
	expect(isBinaryOp(node3)).toBe(true)
	if (isBinaryOp(node3)) {
		expect(node3.operator).toBe('<')
	}

	const node4 = ast.greaterThan(ast.number(5), ast.number(3))
	expect(isBinaryOp(node4)).toBe(true)
	if (isBinaryOp(node4)) {
		expect(node4.operator).toBe('>')
	}

	const node5 = ast.lessEqual(ast.number(3), ast.number(5))
	expect(isBinaryOp(node5)).toBe(true)
	if (isBinaryOp(node5)) {
		expect(node5.operator).toBe('<=')
	}

	const node6 = ast.greaterEqual(ast.number(5), ast.number(3))
	expect(isBinaryOp(node6)).toBe(true)
	if (isBinaryOp(node6)) {
		expect(node6.operator).toBe('>=')
	}
})

test('Optimizer: constant folding for comparison operators', () => {
	expect(execute('x = 5 > 3; x')).toBe(1)
	const ast1 = parseSource('5 == 5')
	const optimized1 = optimize(ast1)
	expect(isNumberLiteral(optimized1)).toBe(true)
	if (isNumberLiteral(optimized1)) {
		expect(optimized1.value).toBe(1)
	}

	const ast2 = parseSource('10 < 5')
	const optimized2 = optimize(ast2)
	expect(isNumberLiteral(optimized2)).toBe(true)
	if (isNumberLiteral(optimized2)) {
		expect(optimized2.value).toBe(0)
	}

	const ast3 = parseSource('x = 10; y = 5; z = x > y; z')
	const optimized3 = optimize(ast3)
	expect(isNumberLiteral(optimized3)).toBe(true)
	if (isNumberLiteral(optimized3)) {
		expect(optimized3.value).toBe(1)
	}
})

test('CodeGen: comparison operators', () => {
	const node1 = ast.equals(ast.number(5), ast.number(3))
	expect(generate(node1)).toBe('5 == 3')

	const node2 = ast.lessThan(ast.number(10), ast.number(20))
	expect(generate(node2)).toBe('10 < 20')

	const node3 = ast.greaterEqual(ast.identifier('x'), ast.number(5))
	expect(generate(node3)).toBe('x >= 5')
})

test('CodeGen: comparison with arithmetic (precedence)', () => {
	// Arithmetic has higher precedence than comparison, no parens needed
	const node = ast.lessThan(
		ast.add(ast.number(2), ast.number(3)),
		ast.number(10),
	)
	expect(generate(node)).toBe('2 + 3 < 10')
})

// ============================================================================
// TERNARY OPERATOR TESTS
// ============================================================================

test('Lexer: tokenize ternary operator', () => {
	const lexer = new Lexer('x ? y : z')
	const tokens = lexer.tokenize()
	expect(tokens[1]?.type).toBe(TokenType.QUESTION)
	expect(tokens[1]?.value).toBe('?')
	expect(tokens[3]?.type).toBe(TokenType.COLON)
	expect(tokens[3]?.value).toBe(':')
})

test('Execute: ternary with truthy condition', () => {
	expect(execute('1 ? 100 : 50')).toBe(100)
	expect(execute('5 ? 10 : 20')).toBe(10)
	expect(execute('-1 ? 7 : 3')).toBe(7)
})

test('Execute: ternary with falsy condition', () => {
	expect(execute('0 ? 100 : 50')).toBe(50)
})

test('Execute: ternary with comparison', () => {
	expect(execute('5 > 3 ? 100 : 50')).toBe(100)
	expect(execute('5 < 3 ? 100 : 50')).toBe(50)
	expect(execute('10 == 10 ? 1 : 0')).toBe(1)
})

test('Execute: ternary with variables', () => {
	expect(execute('x = 10; y = 5; x > y ? 100 : 50')).toBe(100)
	expect(execute('x = 3; y = 7; x > y ? 100 : 50')).toBe(50)
})

test('Execute: nested ternary expressions', () => {
	expect(execute('1 ? 2 ? 3 : 4 : 5')).toBe(3)
	expect(execute('0 ? 2 ? 3 : 4 : 5')).toBe(5)
	expect(execute('1 ? 0 ? 3 : 4 : 5')).toBe(4)
})

test('Execute: ternary with arithmetic', () => {
	expect(execute('5 > 3 ? 10 + 5 : 20 + 5')).toBe(15)
	expect(execute('5 < 3 ? 10 + 5 : 20 + 5')).toBe(25)
})

test('Execute: ternary result in arithmetic', () => {
	expect(execute('(1 ? 10 : 5) * 2')).toBe(20)
	expect(execute('(0 ? 10 : 5) * 2')).toBe(10)
})

test('Execute: multi-level conditional logic', () => {
	// Simulating: if (age < 18) return 10 else if (age > 65) return 8 else return 15
	expect(execute('age = 15; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
	expect(execute('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
	expect(execute('age = 30; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
})

test('Execute: ternary in assignment', () => {
	expect(execute('x = 5 > 3 ? 100 : 50; x')).toBe(100)
	expect(execute('x = 5 < 3 ? 100 : 50; x')).toBe(50)
})

test('AST: conditional expression builder', () => {
	const node = ast.conditional(
		ast.greaterThan(ast.number(5), ast.number(3)),
		ast.number(100),
		ast.number(50),
	)
	expect(node.type).toBe('ConditionalExpression')
	expect(node.condition).toBeDefined()
	expect(node.consequent).toBeDefined()
	expect(node.alternate).toBeDefined()
})

test('Optimizer: constant folding for ternary (true condition)', () => {
	const ast1 = parseSource('1 ? 100 : 50')
	const optimized1 = optimize(ast1)
	expect(isNumberLiteral(optimized1)).toBe(true)
	if (isNumberLiteral(optimized1)) {
		expect(optimized1.value).toBe(100)
	}
})

test('Optimizer: constant folding for ternary (false condition)', () => {
	const ast1 = parseSource('0 ? 100 : 50')
	const optimized1 = optimize(ast1)
	expect(isNumberLiteral(optimized1)).toBe(true)
	if (isNumberLiteral(optimized1)) {
		expect(optimized1.value).toBe(50)
	}
})

test('Optimizer: ternary with constant comparison', () => {
	const ast1 = parseSource('5 > 3 ? 100 : 50')
	const optimized1 = optimize(ast1)
	expect(isNumberLiteral(optimized1)).toBe(true)
	if (isNumberLiteral(optimized1)) {
		expect(optimized1.value).toBe(100)
	}

	const ast2 = parseSource('5 < 3 ? 100 : 50')
	const optimized2 = optimize(ast2)
	expect(isNumberLiteral(optimized2)).toBe(true)
	if (isNumberLiteral(optimized2)) {
		expect(optimized2.value).toBe(50)
	}
})

test('Optimizer: complex ternary optimization', () => {
	const source = 'x = 10; y = 5; result = x > y ? 100 : 50; result'
	const ast1 = parseSource(source)
	const optimized = optimize(ast1)
	expect(isNumberLiteral(optimized)).toBe(true)
	if (isNumberLiteral(optimized)) {
		expect(optimized.value).toBe(100)
	}
})

test('Optimizer: nested ternary optimization', () => {
	const ast1 = parseSource('1 ? 1 ? 100 : 200 : 300')
	const optimized1 = optimize(ast1)
	expect(isNumberLiteral(optimized1)).toBe(true)
	if (isNumberLiteral(optimized1)) {
		expect(optimized1.value).toBe(100)
	}
})

test('CodeGen: ternary operator', () => {
	const node = ast.conditional(
		ast.greaterThan(ast.number(5), ast.number(3)),
		ast.number(100),
		ast.number(50),
	)
	expect(generate(node)).toBe('5 > 3 ? 100 : 50')
})

test('CodeGen: ternary with complex condition', () => {
	const node = ast.conditional(
		ast.add(ast.number(2), ast.number(3)),
		ast.number(100),
		ast.number(50),
	)
	expect(generate(node)).toBe('2 + 3 ? 100 : 50')
})

test('CodeGen: nested ternary', () => {
	const node = ast.conditional(
		ast.number(1),
		ast.conditional(ast.number(1), ast.number(100), ast.number(200)),
		ast.number(300),
	)
	expect(generate(node)).toBe('1 ? 1 ? 100 : 200 : 300')
})

test('CodeGen: ternary round-trip', () => {
	const source = 'x > 5 ? 100 : 50'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const _ast2 = parseSource(code)
	const result1 = execute(source, { variables: { x: 10 } })
	const result2 = execute(code, { variables: { x: 10 } })
	expect(result1).toBe(result2)
	expect(result1).toBe(100)
})

test('Execute: max using ternary', () => {
	expect(execute('a = 10; b = 20; a > b ? a : b')).toBe(20)
	expect(execute('a = 30; b = 20; a > b ? a : b')).toBe(30)
})

test('Execute: min using ternary', () => {
	expect(execute('a = 10; b = 20; a < b ? a : b')).toBe(10)
	expect(execute('a = 30; b = 20; a < b ? a : b')).toBe(20)
})

test('Execute: discount calculation with ternary', () => {
	// Premium customers get 20% discount, others get 0
	expect(
		execute('price = 100; isPremium = 1; price * (1 - (isPremium ? 0.2 : 0))'),
	).toBe(80)
	expect(
		execute('price = 100; isPremium = 0; price * (1 - (isPremium ? 0.2 : 0))'),
	).toBe(100)
})

test('Execute: age-based pricing with ternary', () => {
	// Children (< 18) pay 10, seniors (> 65) pay 8, others pay 15
	expect(execute('age = 12; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
	expect(execute('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
	expect(execute('age = 35; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
})

test('Parser: ternary error on missing colon', () => {
	expect(() => parseSource('1 ? 2')).toThrow('Expected : in ternary expression')
})

// ============================================================================
// NULLISH ASSIGNMENT (??=) TESTS
// ============================================================================

test('Lexer: tokenize ??= operator', () => {
	const lexer = new Lexer('x ??= 10')
	const tokens = lexer.tokenize()
	expect(tokens[1]?.type).toBe(TokenType.NULLISH_ASSIGN)
	expect(tokens[1]?.value).toBe('??=')
})

test('Execute: ??= assigns when variable is undefined', () => {
	// Variable doesn't exist, should assign
	expect(execute('price ??= 100')).toBe(100)
	expect(execute('price ??= 100; price')).toBe(100)
})

test('Execute: ??= does not assign when variable exists', () => {
	// Variable exists in context, should keep existing value
	expect(execute('price ??= 100', { variables: { price: 50 } })).toBe(50)
	expect(execute('price ??= 100; price', { variables: { price: 50 } })).toBe(50)
})

test('Execute: ??= preserves zero values', () => {
	// Key difference from ||=: zero is a valid value, not "falsy"
	expect(execute('discount ??= 0.2', { variables: { discount: 0 } })).toBe(0)
	expect(
		execute('discount ??= 0.2; discount', { variables: { discount: 0 } }),
	).toBe(0)
})

test('Execute: ??= with complex default value', () => {
	expect(execute('price ??= 50 * 2')).toBe(100)
	expect(execute('price ??= 50 * 2; price')).toBe(100)
})

test('Execute: ??= does not evaluate right side when variable exists', () => {
	// The right side should not be evaluated if variable exists
	// This is important for performance and side effects
	const source = 'x ??= y + 1; x'
	expect(execute(source, { variables: { x: 10 } })).toBe(10)
	// Note: y is not defined, but no error because right side not evaluated
})

test('Execute: multiple ??= statements', () => {
	expect(
		execute('price ??= 100; discount ??= 0.1; price * (1 - discount)'),
	).toBe(90)
})

test('Execute: ??= with external variables use case', () => {
	// Typical use case: provide defaults for optional external variables
	const script = `
		price ??= 100
		tax ??= 0.1
		discount ??= 0
		total = price * (1 + tax) * (1 - discount)
		total
	`

	// With no context, uses all defaults
	expect(execute(script)).toBeCloseTo(110, 5)

	// With partial context, uses some defaults
	expect(execute(script, { variables: { price: 200 } })).toBeCloseTo(220, 5)

	// With full context, uses no defaults
	expect(
		execute(script, { variables: { price: 200, tax: 0.2, discount: 0.1 } }),
	).toBeCloseTo(216, 5)
})

test('Execute: ??= in program with regular assignment', () => {
	// Mix of ??= and regular =
	const script = `
		price ??= 100
		price = price * 2
		price
	`
	expect(execute(script)).toBe(200)
	expect(execute(script, { variables: { price: 50 } })).toBe(100)
})

test('Execute: ??= chain (right-associative)', () => {
	// x ??= y ??= 5 should work like x ??= (y ??= 5)
	expect(execute('x ??= y ??= 5; x')).toBe(5)
	expect(execute('x ??= y ??= 5; y')).toBe(5)
})

test('AST: nullish assignment builder', () => {
	const node = ast.nullishAssign('price', ast.number(100))
	expect(node.type).toBe('NullishAssignment')
	expect(node.name).toBe('price')
	expect(isNumberLiteral(node.value) && node.value.value).toBe(100)
})

test('Optimizer: constant folding with ??=', () => {
	const ast1 = parseSource('x ??= 100; x')
	const optimized = optimize(ast1)
	// Should optimize to just the literal 100
	expect(isNumberLiteral(optimized)).toBe(true)
	if (isNumberLiteral(optimized)) {
		expect(optimized.value).toBe(100)
	}
})

test('Optimizer: ??= with complex expression', () => {
	const source = 'price ??= 50 * 2; price'
	const ast1 = parseSource(source)
	const optimized = optimize(ast1)
	// Note: ??= cannot be fully optimized away because it's conditional
	// The value expression should be optimized to 100, but the assignment remains
	expect(isProgram(optimized)).toBe(true)
	if (isProgram(optimized)) {
		expect(optimized.statements.length).toBe(2)
		const assignment = optimized.statements[0]
		// The right side should be optimized to a literal
		expect(assignment?.type).toBe('NullishAssignment')
		if (assignment?.type === 'NullishAssignment') {
			expect(isNumberLiteral(assignment.value)).toBe(true)
			if (isNumberLiteral(assignment.value)) {
				expect(assignment.value.value).toBe(100)
			}
		}
	}
})

test('CodeGen: nullish assignment', () => {
	const node = ast.nullishAssign('price', ast.number(100))
	expect(generate(node)).toBe('price ??= 100')
})

test('CodeGen: nullish assignment with expression', () => {
	const node = ast.nullishAssign(
		'price',
		ast.add(ast.number(50), ast.number(50)),
	)
	expect(generate(node)).toBe('price ??= 50 + 50')
})

test('CodeGen: ??= round-trip', () => {
	const source = 'price ??= 100'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const _ast2 = parseSource(code)
	expect(code).toBe('price ??= 100')

	// Execute both and verify same result
	const result1 = execute(source, { variables: { price: 50 } })
	const result2 = execute(code, { variables: { price: 50 } })
	expect(result1).toBe(result2)
	expect(result1).toBe(50)
})

test('Execute: ??= with ternary operator', () => {
	// Complex expression: default with conditional logic
	expect(execute('price ??= 100 > 50 ? 100 : 50; price')).toBe(100)
})

test('Execute: realistic pricing script with ??=', () => {
	const pricingScript = `
		// Provide defaults for external variables
		basePrice ??= 100
		isPremium ??= 0
		age ??= 30

		// Calculate discount based on user type
		discount = isPremium ? 0.2 : age > 65 ? 0.15 : age < 18 ? 0.1 : 0

		// Final price
		finalPrice = basePrice * (1 - discount)
		finalPrice
	`

	// Default customer (no context)
	expect(execute(pricingScript)).toBe(100)

	// Premium customer
	expect(execute(pricingScript, { variables: { isPremium: 1 } })).toBe(80)

	// Senior with custom base price
	expect(
		execute(pricingScript, { variables: { basePrice: 200, age: 70 } }),
	).toBe(170)

	// Child
	expect(execute(pricingScript, { variables: { age: 12 } })).toBe(90)
})

test('Execute: ??= preserves assignment return value', () => {
	// ??= should return the value (existing or newly assigned)
	expect(execute('x ??= 10')).toBe(10)
	expect(execute('(x ??= 10) * 2', { variables: { x: 5 } })).toBe(10)
	expect(execute('(x ??= 10) * 2')).toBe(20)
})

test('Parser: ??= has same precedence as =', () => {
	// Should parse similar to regular assignment
	const ast1 = parseSource('x ??= 5 + 3')
	expect(ast1.type).toBe('NullishAssignment')
})

// ============================================================================
// LOGICAL OPERATORS (&& and ||)
// ============================================================================

test('Lexer: tokenize && operator', () => {
	const lexer = new Lexer('1 && 2')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	expect(tokens[1]?.type).toBe(TokenType.LOGICAL_AND)
	expect(tokens[1]?.value).toBe('&&')
	expect(tokens[2]?.type).toBe(TokenType.NUMBER)
})

test('Lexer: tokenize || operator', () => {
	const lexer = new Lexer('1 || 0')
	const tokens = lexer.tokenize()
	expect(tokens[0]?.type).toBe(TokenType.NUMBER)
	expect(tokens[1]?.type).toBe(TokenType.LOGICAL_OR)
	expect(tokens[1]?.value).toBe('||')
	expect(tokens[2]?.type).toBe(TokenType.NUMBER)
})

test('Lexer: single & throws error', () => {
	const lexer = new Lexer('5 & 3')
	expect(() => lexer.tokenize()).toThrow("Unexpected character '&'")
})

test('Lexer: single | throws error', () => {
	const lexer = new Lexer('5 | 3')
	expect(() => lexer.tokenize()).toThrow("Unexpected character '|'")
})

test('Parser: parse && operator', () => {
	const ast = parseSource('5 && 3')
	expect(isBinaryOp(ast)).toBe(true)
	if (isBinaryOp(ast)) {
		expect(ast.operator).toBe('&&')
	}
})

test('Parser: parse || operator', () => {
	const ast = parseSource('5 || 0')
	expect(isBinaryOp(ast)).toBe(true)
	if (isBinaryOp(ast)) {
		expect(ast.operator).toBe('||')
	}
})

test('Execute: && returns 1 when both operands are truthy', () => {
	expect(execute('1 && 1')).toBe(1)
	expect(execute('5 && 3')).toBe(1)
	expect(execute('100 && 200')).toBe(1)
	expect(execute('-1 && -2')).toBe(1)
})

test('Execute: && returns 0 when left operand is 0', () => {
	expect(execute('0 && 1')).toBe(0)
	expect(execute('0 && 5')).toBe(0)
	expect(execute('0 && 0')).toBe(0)
})

test('Execute: && returns 0 when right operand is 0', () => {
	expect(execute('1 && 0')).toBe(0)
	expect(execute('5 && 0')).toBe(0)
})

test('Execute: || returns 1 when left operand is truthy', () => {
	expect(execute('1 || 0')).toBe(1)
	expect(execute('5 || 0')).toBe(1)
	expect(execute('100 || 0')).toBe(1)
	expect(execute('-1 || 0')).toBe(1)
})

test('Execute: || returns 1 when right operand is truthy', () => {
	expect(execute('0 || 1')).toBe(1)
	expect(execute('0 || 5')).toBe(1)
})

test('Execute: || returns 1 when both operands are truthy', () => {
	expect(execute('1 || 1')).toBe(1)
	expect(execute('5 || 3')).toBe(1)
})

test('Execute: || returns 0 when both operands are 0', () => {
	expect(execute('0 || 0')).toBe(0)
})

test('Execute: && with comparison operators', () => {
	expect(execute('5 > 3 && 10 > 8')).toBe(1)
	expect(execute('5 > 3 && 10 < 8')).toBe(0)
	expect(execute('5 < 3 && 10 > 8')).toBe(0)
	expect(execute('5 < 3 && 10 < 8')).toBe(0)
})

test('Execute: || with comparison operators', () => {
	expect(execute('5 > 3 || 10 > 8')).toBe(1)
	expect(execute('5 > 3 || 10 < 8')).toBe(1)
	expect(execute('5 < 3 || 10 > 8')).toBe(1)
	expect(execute('5 < 3 || 10 < 8')).toBe(0)
})

test('Execute: chained && operators', () => {
	expect(execute('1 && 1 && 1')).toBe(1)
	expect(execute('1 && 1 && 0')).toBe(0)
	expect(execute('1 && 0 && 1')).toBe(0)
	expect(execute('0 && 1 && 1')).toBe(0)
})

test('Execute: chained || operators', () => {
	expect(execute('0 || 0 || 0')).toBe(0)
	expect(execute('0 || 0 || 1')).toBe(1)
	expect(execute('0 || 1 || 0')).toBe(1)
	expect(execute('1 || 0 || 0')).toBe(1)
})

test('Execute: mixed && and || operators', () => {
	// && has higher precedence than ||
	expect(execute('0 || 1 && 1')).toBe(1) // 0 || (1 && 1) = 0 || 1 = 1
	expect(execute('1 && 0 || 1')).toBe(1) // (1 && 0) || 1 = 0 || 1 = 1
	expect(execute('1 || 0 && 0')).toBe(1) // 1 || (0 && 0) = 1 || 0 = 1
	expect(execute('0 && 1 || 0')).toBe(0) // (0 && 1) || 0 = 0 || 0 = 0
})

test('Execute: && and || with ternary operator', () => {
	expect(execute('1 && 1 ? 100 : 50')).toBe(100)
	expect(execute('0 && 1 ? 100 : 50')).toBe(50)
	expect(execute('0 || 1 ? 100 : 50')).toBe(100)
	expect(execute('0 || 0 ? 100 : 50')).toBe(50)
})

test('Execute: logical operators in assignment', () => {
	expect(execute('x = 5 > 3 && 10 > 8; x')).toBe(1)
	expect(execute('x = 5 < 3 || 10 > 8; x')).toBe(1)
	expect(execute('x = 0 && 1; x')).toBe(0)
	expect(execute('x = 0 || 0; x')).toBe(0)
})

test('Execute: logical operators with variables', () => {
	const context = { variables: { a: 5, b: 0, c: 10 } }
	expect(execute('a && c', context)).toBe(1)
	expect(execute('a && b', context)).toBe(0)
	expect(execute('b && c', context)).toBe(0)
	expect(execute('a || b', context)).toBe(1)
	expect(execute('b || c', context)).toBe(1)
	expect(execute('b || 0', context)).toBe(0)
})

test('Execute: logical operators with parentheses', () => {
	expect(execute('(1 && 0) || 1')).toBe(1)
	expect(execute('1 && (0 || 1)')).toBe(1)
	expect(execute('(0 || 0) && 1')).toBe(0)
	expect(execute('0 || (0 && 1)')).toBe(0)
})

test('Execute: realistic boolean logic examples', () => {
	// Age check: between 18 and 65
	expect(execute('age = 25; age >= 18 && age <= 65')).toBe(1)
	expect(execute('age = 15; age >= 18 && age <= 65')).toBe(0)
	expect(execute('age = 70; age >= 18 && age <= 65')).toBe(0)

	// Discount eligibility: student or senior
	const studentScript = 'isStudent = 1; age = 20; isStudent || age >= 65'
	const seniorScript = 'isStudent = 0; age = 70; isStudent || age >= 65'
	const neitherScript = 'isStudent = 0; age = 30; isStudent || age >= 65'
	expect(execute(studentScript)).toBe(1)
	expect(execute(seniorScript)).toBe(1)
	expect(execute(neitherScript)).toBe(0)
})

test('Optimization: constant folding for &&', () => {
	expect(optimize(parseSource('1 && 1'))).toEqual(ast.number(1))
	expect(optimize(parseSource('1 && 0'))).toEqual(ast.number(0))
	expect(optimize(parseSource('0 && 1'))).toEqual(ast.number(0))
	expect(optimize(parseSource('5 && 3'))).toEqual(ast.number(1))
})

test('Optimization: constant folding for ||', () => {
	expect(optimize(parseSource('1 || 1'))).toEqual(ast.number(1))
	expect(optimize(parseSource('1 || 0'))).toEqual(ast.number(1))
	expect(optimize(parseSource('0 || 1'))).toEqual(ast.number(1))
	expect(optimize(parseSource('0 || 0'))).toEqual(ast.number(0))
})

test('Optimization: logical operators with comparisons', () => {
	expect(optimize(parseSource('5 > 3 && 10 > 8'))).toEqual(ast.number(1))
	expect(optimize(parseSource('5 < 3 || 10 > 8'))).toEqual(ast.number(1))
	expect(optimize(parseSource('5 < 3 && 10 < 8'))).toEqual(ast.number(0))
})

test('AST builders: logicalAnd', () => {
	const node = ast.logicalAnd(ast.number(1), ast.number(1))
	expect(node.type).toBe('BinaryOp')
	expect(node.operator).toBe('&&')
	const result = new Executor().execute(node)
	expect(result).toBe(1)
})

test('AST builders: logicalOr', () => {
	const node = ast.logicalOr(ast.number(0), ast.number(1))
	expect(node.type).toBe('BinaryOp')
	expect(node.operator).toBe('||')
	const result = new Executor().execute(node)
	expect(result).toBe(1)
})

test('CodeGen: && operator', () => {
	const source = '5 && 3'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	expect(code).toBe('5 && 3')
})

test('CodeGen: || operator', () => {
	const source = '0 || 1'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	expect(code).toBe('0 || 1')
})

test('CodeGen: mixed logical and comparison operators', () => {
	const source = '5 > 3 && 10 < 20'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	const _ast2 = parseSource(code)
	expect(execute(source)).toBe(execute(code))
})

test('CodeGen: logical operators with parentheses', () => {
	const source = '(1 && 0) || 1'
	const ast1 = parseSource(source)
	const code = generate(ast1)
	expect(execute(source)).toBe(execute(code))
})

test('Precedence: logical operators vs comparison', () => {
	// Comparison (2) has higher precedence than logical (1.75)
	// So: 5 > 3 && 10 > 8 should parse as (5 > 3) && (10 > 8)
	const ast1 = parseSource('5 > 3 && 10 > 8')
	expect(isBinaryOp(ast1)).toBe(true)
	if (isBinaryOp(ast1)) {
		expect(ast1.operator).toBe('&&')
		expect(isBinaryOp(ast1.left)).toBe(true)
		expect(isBinaryOp(ast1.right)).toBe(true)
		if (isBinaryOp(ast1.left)) {
			expect(ast1.left.operator).toBe('>')
		}
		if (isBinaryOp(ast1.right)) {
			expect(ast1.right.operator).toBe('>')
		}
	}
})

test('Precedence: logical operators vs ternary', () => {
	// Ternary (1.5) has lower precedence than logical (1.75)
	// So: 1 && 1 ? 100 : 50 should parse as (1 && 1) ? 100 : 50
	const ast1 = parseSource('1 && 1 ? 100 : 50')
	expect(isConditionalExpression(ast1)).toBe(true)
	if (isConditionalExpression(ast1)) {
		expect(isBinaryOp(ast1.condition)).toBe(true)
		if (isBinaryOp(ast1.condition)) {
			expect(ast1.condition.operator).toBe('&&')
		}
	}
})

test('Precedence: logical operators vs assignment', () => {
	// Assignment (1) has lower precedence than logical (1.75)
	// So: x = 1 && 0 should parse as x = (1 && 0)
	const ast1 = parseSource('x = 1 && 0')
	expect(isAssignment(ast1)).toBe(true)
	if (isAssignment(ast1)) {
		expect(isBinaryOp(ast1.value)).toBe(true)
		if (isBinaryOp(ast1.value)) {
			expect(ast1.value.operator).toBe('&&')
		}
	}
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
