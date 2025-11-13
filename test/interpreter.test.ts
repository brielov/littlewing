import { describe, expect, test } from 'bun:test'
import * as ast from '../src/ast'
import { evaluate } from '../src/interpreter'
import { parse } from '../src/parser'

describe('Interpreter', () => {
	test('execute number literal', () => {
		const result = evaluate('42')
		expect(result).toBe(42)
	})

	test('execute simple arithmetic', () => {
		const result = evaluate('2 + 3')
		expect(result).toBe(5)
	})

	test('execute decimal shorthand', () => {
		expect(evaluate('.2')).toBe(0.2)
		expect(evaluate('.5')).toBe(0.5)
		expect(evaluate('.999')).toBe(0.999)
	})

	test('execute decimal shorthand in expressions', () => {
		expect(evaluate('.2 + .3')).toBeCloseTo(0.5)
		expect(evaluate('.5 * 2')).toBe(1)
		expect(evaluate('1 - .25')).toBe(0.75)
		expect(evaluate('.1 + .2')).toBeCloseTo(0.3)
	})

	test('execute decimal shorthand with variables', () => {
		expect(evaluate('x = .5; x * 2')).toBe(1)
		expect(evaluate('y = .25; y + .75')).toBe(1)
	})

	test('execute decimal shorthand with scientific notation', () => {
		expect(evaluate('.5e2')).toBe(50)
		expect(evaluate('.3e-1')).toBeCloseTo(0.03)
		expect(evaluate('.1e+3')).toBe(100)
	})

	test('execute operator precedence', () => {
		const result = evaluate('2 + 3 * 4')
		expect(result).toBe(14)
	})

	test('execute exponentiation precedence', () => {
		// Exponentiation has higher precedence than multiplication
		expect(evaluate('2 * 3 ^ 2')).toBe(18) // 2 * 9, not 6 ^ 2
		expect(evaluate('2 ^ 3 * 4')).toBe(32) // 8 * 4, not 2 ^ 12
		expect(evaluate('(2 + 3) ^ 2')).toBe(25) // 5 ^ 2
	})

	test('execute exponentiation associativity (right-associative)', () => {
		// Exponentiation is right-associative: a ^ b ^ c = a ^ (b ^ c)
		expect(evaluate('2 ^ 3 ^ 2')).toBe(512) // 2 ^ (3 ^ 2) = 2 ^ 9 = 512
		expect(evaluate('2 ^ 2 ^ 3')).toBe(256) // 2 ^ (2 ^ 3) = 2 ^ 8 = 256
		expect(evaluate('4 ^ 3 ^ 2')).toBe(262144) // 4 ^ (3 ^ 2) = 4 ^ 9 = 262144

		// Verify it's NOT left-associative
		// If it were left-associative: (2 ^ 3) ^ 2 = 8 ^ 2 = 64 (wrong!)
		expect(evaluate('2 ^ 3 ^ 2')).not.toBe(64)

		// With parentheses to force left-associativity
		expect(evaluate('(2 ^ 3) ^ 2')).toBe(64) // (2 ^ 3) ^ 2 = 8 ^ 2 = 64
		expect(evaluate('(2 ^ 2) ^ 3')).toBe(64) // (2 ^ 2) ^ 3 = 4 ^ 3 = 64
	})

	test('execute parentheses', () => {
		const result = evaluate('(2 + 3) * 4')
		expect(result).toBe(20)
	})

	test('execute unary minus', () => {
		const result = evaluate('-5')
		expect(result).toBe(-5)
	})

	test('execute unary minus precedence', () => {
		// Unary minus binds tighter than addition/subtraction
		expect(evaluate('5 + -3')).toBe(2) // 5 + (-3) = 2
		expect(evaluate('10 - -5')).toBe(15) // 10 - (-5) = 15
		expect(evaluate('-2 + 3')).toBe(1) // (-2) + 3 = 1

		// Unary minus binds tighter than multiplication/division
		expect(evaluate('2 * -3')).toBe(-6) // 2 * (-3) = -6
		expect(evaluate('-10 / 2')).toBe(-5) // (-10) / 2 = -5
		expect(evaluate('-2 * -3')).toBe(6) // (-2) * (-3) = 6

		// Unary minus binds LOOSER than exponentiation (Python/Ruby/JS style)
		expect(evaluate('-2 ^ 2')).toBe(-4) // -(2 ^ 2) = -4, NOT (-2)^2 = 4
		expect(evaluate('-2 ^ 3')).toBe(-8) // -(2 ^ 3) = -8
		expect(evaluate('-3 ^ 2')).toBe(-9) // -(3 ^ 2) = -9

		// With parentheses, behavior changes
		expect(evaluate('(-2) ^ 2')).toBe(4) // (-2) ^ 2 = 4
		expect(evaluate('(-2) ^ 3')).toBe(-8) // (-2) ^ 3 = -8
		expect(evaluate('(-3) ^ 2')).toBe(9) // (-3) ^ 2 = 9

		// Complex expression with unary minus
		expect(evaluate('-2 ^ 2 + 3 * 4')).toBe(8) // -(2^2) + (3*4) = -4 + 12 = 8
		expect(evaluate('10 - 3 * 2 ^ 2 + 1')).toBe(-1) // 10 - (3*(2^2)) + 1 = 10 - 12 + 1 = -1

		// Double unary minus
		expect(evaluate('--5')).toBe(5) // -(-5) = 5
		expect(evaluate('---5')).toBe(-5) // -(-(-5)) = -5
	})

	test('execute all operators', () => {
		expect(evaluate('10 - 3')).toBe(7)
		expect(evaluate('3 * 4')).toBe(12)
		expect(evaluate('10 / 2')).toBe(5)
		expect(evaluate('10 % 3')).toBe(1)
		expect(evaluate('2 ^ 3')).toBe(8)
		expect(evaluate('5 ^ 2')).toBe(25)
	})

	test('execute variable assignment', () => {
		const result = evaluate('x = 5')
		expect(result).toBe(5)
	})

	test('execute variable reference', () => {
		const result = evaluate('x = 5; x')
		expect(result).toBe(5)
	})

	test('execute complex expression with variables', () => {
		const result = evaluate('x = 2; y = 3; z = x + y')
		expect(result).toBe(5)
	})

	test('execute function call without arguments', () => {
		const result = evaluate('NOW()', {
			functions: { NOW: () => 12345 },
		})
		expect(result).toBe(12345)
	})

	test('execute function call with arguments', () => {
		const result = evaluate('ABS(-5)', {
			functions: { ABS: Math.abs },
		})
		expect(result).toBe(5)
	})

	test('execute with global variables', () => {
		const result = evaluate('i + 10', {
			variables: { i: 5 },
		})
		expect(result).toBe(15)
	})

	test('execute arithmetic with global variable', () => {
		const result = evaluate('x = i - 10', {
			variables: { i: 25 },
		})
		expect(result).toBe(15)
	})

	test('error on undefined variable', () => {
		expect(() => evaluate('x + 1')).toThrow('Undefined variable: x')
	})

	test('error on undefined function', () => {
		expect(() => evaluate('foo()')).toThrow('Undefined function: foo')
	})

	test('error on division by zero', () => {
		expect(() => evaluate('1 / 0')).toThrow('Division by zero')
	})

	test('error on modulo by zero', () => {
		expect(() => evaluate('10 % 0')).toThrow('Modulo by zero')
	})

	test('floating point arithmetic', () => {
		expect(evaluate('0.1 + 0.2')).toBeCloseTo(0.3)
		expect(evaluate('3.14 * 2')).toBeCloseTo(6.28)
	})
})

describe('evaluate() function accepts string or AST', () => {
	test('evaluate() function accepts string', () => {
		const result = evaluate('2 + 3')
		expect(result).toBe(5)
	})

	test('evaluate() function accepts AST', () => {
		const astNode = parse('2 + 3')
		const result = evaluate(astNode)
		expect(result).toBe(5)
	})

	test('evaluate() with string and context', () => {
		const result = evaluate('x + 5', { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('evaluate() with AST and context', () => {
		const astNode = ast.binaryOp(ast.identifier('x'), '+', ast.number(5))
		const result = evaluate(astNode, { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('evaluate() handles complex expressions as string', () => {
		const result = evaluate('x * 2 + 5', { variables: { x: 10 } })
		expect(result).toBe(25)
	})

	test('evaluate() handles complex expressions as AST', () => {
		const astNode = ast.binaryOp(
			ast.binaryOp(ast.identifier('x'), '*', ast.number(2)),
			'+',
			ast.number(5),
		)
		const result = evaluate(astNode, { variables: { x: 10 } })
		expect(result).toBe(25)
	})
})

describe('Logical NOT operator', () => {
	test('execute NOT on zero', () => {
		const result = evaluate('!0')
		expect(result).toBe(1)
	})

	test('execute NOT on non-zero positive', () => {
		const result = evaluate('!5')
		expect(result).toBe(0)
	})

	test('execute NOT on non-zero negative', () => {
		const result = evaluate('!-5')
		expect(result).toBe(0)
	})

	test('execute double NOT', () => {
		const result1 = evaluate('!!0')
		expect(result1).toBe(0)
		const result2 = evaluate('!!5')
		expect(result2).toBe(1)
	})

	test('execute NOT in conditional', () => {
		const result = evaluate('!0 ? 100 : 50')
		expect(result).toBe(100)
	})

	test('execute NOT with comparison', () => {
		const result = evaluate('!(5 > 10)')
		expect(result).toBe(1)
	})

	test('execute NOT with logical AND', () => {
		const result = evaluate('!0 && !0')
		expect(result).toBe(1)
	})

	test('execute NOT with logical OR', () => {
		const result = evaluate('!1 || !0')
		expect(result).toBe(1)
	})

	test('execute NOT with arithmetic', () => {
		// !0 + 5 should be (!0) + 5 = 1 + 5 = 6
		const result = evaluate('!0 + 5')
		expect(result).toBe(6)
	})

	test('execute NOT with variable', () => {
		const result = evaluate('!x', { variables: { x: 0 } })
		expect(result).toBe(1)
	})

	test('execute NOT in complex expression', () => {
		const result = evaluate('x = 0; y = !x; y + 10')
		expect(result).toBe(11)
	})

	test('execute mixed unary operators', () => {
		// -!5 should be -((!5)) = -(0) = -0 (which equals 0)
		const result = evaluate('-!5')
		expect(result).toBe(-0) // -0 is valid (signed zero in JavaScript)
	})

	test('execute NOT with exponentiation precedence', () => {
		// !2 ^ 2 should be !(2 ^ 2) = !4 = 0
		const result = evaluate('!2 ^ 2')
		expect(result).toBe(0)
	})
})
