import { describe, expect, test } from 'bun:test'
import { ast, execute, parseSource } from '../src'

describe('Executor', () => {
	test('execute number literal', () => {
		const result = execute('42')
		expect(result).toBe(42)
	})

	test('execute simple arithmetic', () => {
		const result = execute('2 + 3')
		expect(result).toBe(5)
	})

	test('execute decimal shorthand', () => {
		expect(execute('.2')).toBe(0.2)
		expect(execute('.5')).toBe(0.5)
		expect(execute('.999')).toBe(0.999)
	})

	test('execute decimal shorthand in expressions', () => {
		expect(execute('.2 + .3')).toBeCloseTo(0.5)
		expect(execute('.5 * 2')).toBe(1)
		expect(execute('1 - .25')).toBe(0.75)
		expect(execute('.1 + .2')).toBeCloseTo(0.3)
	})

	test('execute decimal shorthand with variables', () => {
		expect(execute('x = .5; x * 2')).toBe(1)
		expect(execute('y = .25; y + .75')).toBe(1)
	})

	test('execute decimal shorthand with scientific notation', () => {
		expect(execute('.5e2')).toBe(50)
		expect(execute('.3e-1')).toBeCloseTo(0.03)
		expect(execute('.1e+3')).toBe(100)
	})

	test('execute operator precedence', () => {
		const result = execute('2 + 3 * 4')
		expect(result).toBe(14)
	})

	test('execute exponentiation precedence', () => {
		// Exponentiation has higher precedence than multiplication
		expect(execute('2 * 3 ^ 2')).toBe(18) // 2 * 9, not 6 ^ 2
		expect(execute('2 ^ 3 * 4')).toBe(32) // 8 * 4, not 2 ^ 12
		expect(execute('(2 + 3) ^ 2')).toBe(25) // 5 ^ 2
	})

	test('execute exponentiation associativity (right-associative)', () => {
		// Exponentiation is right-associative: a ^ b ^ c = a ^ (b ^ c)
		expect(execute('2 ^ 3 ^ 2')).toBe(512) // 2 ^ (3 ^ 2) = 2 ^ 9 = 512
		expect(execute('2 ^ 2 ^ 3')).toBe(256) // 2 ^ (2 ^ 3) = 2 ^ 8 = 256
		expect(execute('4 ^ 3 ^ 2')).toBe(262144) // 4 ^ (3 ^ 2) = 4 ^ 9 = 262144

		// Verify it's NOT left-associative
		// If it were left-associative: (2 ^ 3) ^ 2 = 8 ^ 2 = 64 (wrong!)
		expect(execute('2 ^ 3 ^ 2')).not.toBe(64)

		// With parentheses to force left-associativity
		expect(execute('(2 ^ 3) ^ 2')).toBe(64) // (2 ^ 3) ^ 2 = 8 ^ 2 = 64
		expect(execute('(2 ^ 2) ^ 3')).toBe(64) // (2 ^ 2) ^ 3 = 4 ^ 3 = 64
	})

	test('execute parentheses', () => {
		const result = execute('(2 + 3) * 4')
		expect(result).toBe(20)
	})

	test('execute unary minus', () => {
		const result = execute('-5')
		expect(result).toBe(-5)
	})

	test('execute unary minus precedence', () => {
		// Unary minus binds tighter than addition/subtraction
		expect(execute('5 + -3')).toBe(2) // 5 + (-3) = 2
		expect(execute('10 - -5')).toBe(15) // 10 - (-5) = 15
		expect(execute('-2 + 3')).toBe(1) // (-2) + 3 = 1

		// Unary minus binds tighter than multiplication/division
		expect(execute('2 * -3')).toBe(-6) // 2 * (-3) = -6
		expect(execute('-10 / 2')).toBe(-5) // (-10) / 2 = -5
		expect(execute('-2 * -3')).toBe(6) // (-2) * (-3) = 6

		// Unary minus binds LOOSER than exponentiation (Python/Ruby/JS style)
		expect(execute('-2 ^ 2')).toBe(-4) // -(2 ^ 2) = -4, NOT (-2)^2 = 4
		expect(execute('-2 ^ 3')).toBe(-8) // -(2 ^ 3) = -8
		expect(execute('-3 ^ 2')).toBe(-9) // -(3 ^ 2) = -9

		// With parentheses, behavior changes
		expect(execute('(-2) ^ 2')).toBe(4) // (-2) ^ 2 = 4
		expect(execute('(-2) ^ 3')).toBe(-8) // (-2) ^ 3 = -8
		expect(execute('(-3) ^ 2')).toBe(9) // (-3) ^ 2 = 9

		// Complex expression with unary minus
		expect(execute('-2 ^ 2 + 3 * 4')).toBe(8) // -(2^2) + (3*4) = -4 + 12 = 8
		expect(execute('10 - 3 * 2 ^ 2 + 1')).toBe(-1) // 10 - (3*(2^2)) + 1 = 10 - 12 + 1 = -1

		// Double unary minus
		expect(execute('--5')).toBe(5) // -(-5) = 5
		expect(execute('---5')).toBe(-5) // -(-(-5)) = -5
	})

	test('execute all operators', () => {
		expect(execute('10 - 3')).toBe(7)
		expect(execute('3 * 4')).toBe(12)
		expect(execute('10 / 2')).toBe(5)
		expect(execute('10 % 3')).toBe(1)
		expect(execute('2 ^ 3')).toBe(8)
		expect(execute('5 ^ 2')).toBe(25)
	})

	test('execute variable assignment', () => {
		const result = execute('x = 5')
		expect(result).toBe(5)
	})

	test('execute variable reference', () => {
		const result = execute('x = 5; x')
		expect(result).toBe(5)
	})

	test('execute complex expression with variables', () => {
		const result = execute('x = 2; y = 3; z = x + y')
		expect(result).toBe(5)
	})

	test('execute function call without arguments', () => {
		const result = execute('NOW()', {
			functions: { NOW: () => 12345 },
		})
		expect(result).toBe(12345)
	})

	test('execute function call with arguments', () => {
		const result = execute('ABS(-5)', {
			functions: { ABS: Math.abs },
		})
		expect(result).toBe(5)
	})

	test('execute with global variables', () => {
		const result = execute('i + 10', {
			variables: { i: 5 },
		})
		expect(result).toBe(15)
	})

	test('execute arithmetic with global variable', () => {
		const result = execute('x = i - 10', {
			variables: { i: 25 },
		})
		expect(result).toBe(15)
	})

	test('error on undefined variable', () => {
		expect(() => execute('x + 1')).toThrow('Undefined variable: x')
	})

	test('error on undefined function', () => {
		expect(() => execute('foo()')).toThrow('Undefined function: foo')
	})

	test('error on division by zero', () => {
		expect(() => execute('1 / 0')).toThrow('Division by zero')
	})

	test('error on modulo by zero', () => {
		expect(() => execute('10 % 0')).toThrow('Modulo by zero')
	})

	test('floating point arithmetic', () => {
		expect(execute('0.1 + 0.2')).toBeCloseTo(0.3)
		expect(execute('3.14 * 2')).toBeCloseTo(6.28)
	})
})

describe('execute() function accepts string or AST', () => {
	test('execute() function accepts string', () => {
		const result = execute('2 + 3')
		expect(result).toBe(5)
	})

	test('execute() function accepts AST', () => {
		const astNode = parseSource('2 + 3')
		const result = execute(astNode)
		expect(result).toBe(5)
	})

	test('execute() with string and context', () => {
		const result = execute('x + 5', { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('execute() with AST and context', () => {
		const astNode = ast.binaryOp(ast.identifier('x'), '+', ast.number(5))
		const result = execute(astNode, { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('execute() handles complex expressions as string', () => {
		const result = execute('x * 2 + 5', { variables: { x: 10 } })
		expect(result).toBe(25)
	})

	test('execute() handles complex expressions as AST', () => {
		const astNode = ast.binaryOp(
			ast.binaryOp(ast.identifier('x'), '*', ast.number(2)),
			'+',
			ast.number(5),
		)
		const result = execute(astNode, { variables: { x: 10 } })
		expect(result).toBe(25)
	})
})
