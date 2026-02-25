import { describe, expect, test } from 'bun:test'
import { evaluate } from '../src/interpreter'

describe('Operators', () => {
	describe('Comparison', () => {
		test('equality operator returns boolean', () => {
			expect(evaluate('5 == 5')).toBe(true)
			expect(evaluate('5 == 3')).toBe(false)
			expect(evaluate('10 == 10')).toBe(true)
			expect(evaluate('7.5 == 7.5')).toBe(true)
		})

		test('not-equals operator', () => {
			expect(evaluate('5 != 3')).toBe(true)
			expect(evaluate('5 != 5')).toBe(false)
			expect(evaluate('10 != 10')).toBe(false)
		})

		test('less-than operator', () => {
			expect(evaluate('3 < 5')).toBe(true)
			expect(evaluate('5 < 3')).toBe(false)
			expect(evaluate('5 < 5')).toBe(false)
		})

		test('greater-than operator', () => {
			expect(evaluate('5 > 3')).toBe(true)
			expect(evaluate('3 > 5')).toBe(false)
			expect(evaluate('5 > 5')).toBe(false)
		})

		test('less-than-or-equal operator', () => {
			expect(evaluate('3 <= 5')).toBe(true)
			expect(evaluate('5 <= 5')).toBe(true)
			expect(evaluate('7 <= 5')).toBe(false)
		})

		test('greater-than-or-equal operator', () => {
			expect(evaluate('5 >= 3')).toBe(true)
			expect(evaluate('5 >= 5')).toBe(true)
			expect(evaluate('3 >= 5')).toBe(false)
		})

		test('comparison operators with variables', () => {
			expect(evaluate('x = 10; y = 5; x > y')).toBe(true)
			expect(evaluate('x = 5; y = 10; x < y')).toBe(true)
			expect(evaluate('x = 7; y = 7; x == y')).toBe(true)
		})

		test('comparison operator precedence (lower than arithmetic)', () => {
			expect(evaluate('2 + 3 == 5')).toBe(true) // (2 + 3) == 5
			expect(evaluate('10 - 5 > 3')).toBe(true) // (10 - 5) > 3
			expect(evaluate('2 * 3 < 10')).toBe(true) // (2 * 3) < 10
		})

		test('string comparisons', () => {
			expect(evaluate('"abc" == "abc"')).toBe(true)
			expect(evaluate('"abc" != "def"')).toBe(true)
			expect(evaluate('"abc" < "def"')).toBe(true)
			expect(evaluate('"def" > "abc"')).toBe(true)
		})

		test('cross-type equality returns false', () => {
			expect(evaluate('5 == "5"')).toBe(false)
			expect(evaluate('5 != "5"')).toBe(true)
			expect(evaluate('true == 1')).toBe(false)
			expect(evaluate('true != 1')).toBe(true)
		})

		test('boolean equality', () => {
			expect(evaluate('true == true')).toBe(true)
			expect(evaluate('false == false')).toBe(true)
			expect(evaluate('true == false')).toBe(false)
			expect(evaluate('true != false')).toBe(true)
		})

		test('array equality (deep structural)', () => {
			expect(evaluate('[1, 2, 3] == [1, 2, 3]')).toBe(true)
			expect(evaluate('[1, 2] == [1, 2, 3]')).toBe(false)
			expect(evaluate('[1, 2] != [3, 4]')).toBe(true)
		})
	})

	describe('Logical', () => {
		test('&& returns true when both operands are true', () => {
			expect(evaluate('true && true')).toBe(true)
		})

		test('&& returns false when left operand is false', () => {
			expect(evaluate('false && true')).toBe(false)
			expect(evaluate('false && false')).toBe(false)
		})

		test('&& returns false when right operand is false', () => {
			expect(evaluate('true && false')).toBe(false)
		})

		test('|| returns true when left operand is true', () => {
			expect(evaluate('true || false')).toBe(true)
			expect(evaluate('true || true')).toBe(true)
		})

		test('|| returns true when right operand is true', () => {
			expect(evaluate('false || true')).toBe(true)
		})

		test('|| returns false when both operands are false', () => {
			expect(evaluate('false || false')).toBe(false)
		})

		test('&& with comparison operators', () => {
			expect(evaluate('5 > 3 && 10 > 8')).toBe(true)
			expect(evaluate('5 > 3 && 10 < 8')).toBe(false)
			expect(evaluate('5 < 3 && 10 > 8')).toBe(false)
			expect(evaluate('5 < 3 && 10 < 8')).toBe(false)
		})

		test('|| with comparison operators', () => {
			expect(evaluate('5 > 3 || 10 > 8')).toBe(true)
			expect(evaluate('5 > 3 || 10 < 8')).toBe(true)
			expect(evaluate('5 < 3 || 10 > 8')).toBe(true)
			expect(evaluate('5 < 3 || 10 < 8')).toBe(false)
		})

		test('chained && operators', () => {
			expect(evaluate('true && true && true')).toBe(true)
			expect(evaluate('true && true && false')).toBe(false)
			expect(evaluate('true && false && true')).toBe(false)
			expect(evaluate('false && true && true')).toBe(false)
		})

		test('chained || operators', () => {
			expect(evaluate('false || false || false')).toBe(false)
			expect(evaluate('false || false || true')).toBe(true)
			expect(evaluate('false || true || false')).toBe(true)
			expect(evaluate('true || false || false')).toBe(true)
		})

		test('mixed && and || operators', () => {
			// && has higher precedence than ||
			expect(evaluate('false || true && true')).toBe(true) // false || (true && true)
			expect(evaluate('true && false || true')).toBe(true) // (true && false) || true
			expect(evaluate('true || false && false')).toBe(true) // true || (false && false)
			expect(evaluate('false && true || false')).toBe(false) // (false && true) || false
		})

		test('&& and || with ternary operator', () => {
			expect(evaluate('true && true ? 100 : 50')).toBe(100)
			expect(evaluate('false && true ? 100 : 50')).toBe(50)
			expect(evaluate('false || true ? 100 : 50')).toBe(100)
			expect(evaluate('false || false ? 100 : 50')).toBe(50)
		})

		test('logical operators in assignment', () => {
			expect(evaluate('x = 5 > 3 && 10 > 8; x')).toBe(true)
			expect(evaluate('x = 5 < 3 || 10 > 8; x')).toBe(true)
			expect(evaluate('x = false && true; x')).toBe(false)
			expect(evaluate('x = false || false; x')).toBe(false)
		})

		test('logical operators with boolean variables', () => {
			const context = { variables: { a: true, b: false, c: true } }
			expect(evaluate('a && c', context)).toBe(true)
			expect(evaluate('a && b', context)).toBe(false)
			expect(evaluate('b && c', context)).toBe(false)
			expect(evaluate('a || b', context)).toBe(true)
			expect(evaluate('b || c', context)).toBe(true)
			expect(evaluate('b || false', context)).toBe(false)
		})

		test('logical operators with parentheses', () => {
			expect(evaluate('(true && false) || true')).toBe(true)
			expect(evaluate('true && (false || true)')).toBe(true)
			expect(evaluate('(false || false) && true')).toBe(false)
			expect(evaluate('false || (false && true)')).toBe(false)
		})

		test('logical operators require boolean operands', () => {
			expect(() => evaluate('1 && 1')).toThrow(TypeError)
			expect(() => evaluate('0 || 1')).toThrow(TypeError)
			expect(() => evaluate('5 && 3')).toThrow(TypeError)
		})

		test('realistic boolean logic examples', () => {
			// Age check: between 18 and 65
			expect(evaluate('age = 25; age >= 18 && age <= 65')).toBe(true)
			expect(evaluate('age = 15; age >= 18 && age <= 65')).toBe(false)
			expect(evaluate('age = 70; age >= 18 && age <= 65')).toBe(false)

			// Discount eligibility using boolean variables
			expect(
				evaluate('isStudent = true; age = 20; isStudent || age >= 65'),
			).toBe(true)
			expect(
				evaluate('isStudent = false; age = 70; isStudent || age >= 65'),
			).toBe(true)
			expect(
				evaluate('isStudent = false; age = 30; isStudent || age >= 65'),
			).toBe(false)
		})
	})

	describe('Ternary', () => {
		test('ternary with true condition', () => {
			expect(evaluate('true ? 100 : 50')).toBe(100)
		})

		test('ternary with false condition', () => {
			expect(evaluate('false ? 100 : 50')).toBe(50)
		})

		test('ternary with comparison', () => {
			expect(evaluate('5 > 3 ? 100 : 50')).toBe(100)
			expect(evaluate('5 < 3 ? 100 : 50')).toBe(50)
			expect(evaluate('10 == 10 ? 1 : 0')).toBe(1)
		})

		test('ternary with variables', () => {
			expect(evaluate('x = 10; y = 5; x > y ? 100 : 50')).toBe(100)
			expect(evaluate('x = 3; y = 7; x > y ? 100 : 50')).toBe(50)
		})

		test('nested ternary expressions', () => {
			expect(evaluate('true ? true ? 3 : 4 : 5')).toBe(3)
			expect(evaluate('false ? true ? 3 : 4 : 5')).toBe(5)
			expect(evaluate('true ? false ? 3 : 4 : 5')).toBe(4)
		})

		test('ternary with arithmetic', () => {
			expect(evaluate('5 > 3 ? 10 + 5 : 20 + 5')).toBe(15)
			expect(evaluate('5 < 3 ? 10 + 5 : 20 + 5')).toBe(25)
		})

		test('ternary result in arithmetic', () => {
			expect(evaluate('(true ? 10 : 5) * 2')).toBe(20)
			expect(evaluate('(false ? 10 : 5) * 2')).toBe(10)
		})

		test('multi-level conditional logic', () => {
			expect(evaluate('age = 15; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
			expect(evaluate('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
			expect(evaluate('age = 30; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
		})

		test('ternary in assignment', () => {
			expect(evaluate('x = 5 > 3 ? 100 : 50; x')).toBe(100)
			expect(evaluate('x = 5 < 3 ? 100 : 50; x')).toBe(50)
		})

		test('MAX using ternary', () => {
			expect(evaluate('a = 10; b = 20; a > b ? a : b')).toBe(20)
			expect(evaluate('a = 30; b = 20; a > b ? a : b')).toBe(30)
		})

		test('MIN using ternary', () => {
			expect(evaluate('a = 10; b = 20; a < b ? a : b')).toBe(10)
			expect(evaluate('a = 30; b = 20; a < b ? a : b')).toBe(20)
		})

		test('ternary requires boolean condition', () => {
			expect(() => evaluate('1 ? 100 : 50')).toThrow(TypeError)
			expect(() => evaluate('0 ? 100 : 50')).toThrow(TypeError)
		})

		test('discount calculation with ternary', () => {
			expect(
				evaluate(
					'price = 100; isPremium = true; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(80)
			expect(
				evaluate(
					'price = 100; isPremium = false; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(100)
		})

		test('age-based pricing with ternary', () => {
			expect(evaluate('age = 12; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
			expect(evaluate('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
			expect(evaluate('age = 35; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
		})
	})
})
