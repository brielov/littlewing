import { describe, expect, test } from 'bun:test'
import { evaluate } from '../src/interpreter'

describe('Operators', () => {
	describe('Comparison', () => {
		test('equality operator returns 1 or 0', () => {
			expect(evaluate('5 == 5')).toBe(1)
			expect(evaluate('5 == 3')).toBe(0)
			expect(evaluate('10 == 10')).toBe(1)
			expect(evaluate('7.5 == 7.5')).toBe(1)
		})

		test('not-equals operator', () => {
			expect(evaluate('5 != 3')).toBe(1)
			expect(evaluate('5 != 5')).toBe(0)
			expect(evaluate('10 != 10')).toBe(0)
		})

		test('less-than operator', () => {
			expect(evaluate('3 < 5')).toBe(1)
			expect(evaluate('5 < 3')).toBe(0)
			expect(evaluate('5 < 5')).toBe(0)
		})

		test('greater-than operator', () => {
			expect(evaluate('5 > 3')).toBe(1)
			expect(evaluate('3 > 5')).toBe(0)
			expect(evaluate('5 > 5')).toBe(0)
		})

		test('less-than-or-equal operator', () => {
			expect(evaluate('3 <= 5')).toBe(1)
			expect(evaluate('5 <= 5')).toBe(1)
			expect(evaluate('7 <= 5')).toBe(0)
		})

		test('greater-than-or-equal operator', () => {
			expect(evaluate('5 >= 3')).toBe(1)
			expect(evaluate('5 >= 5')).toBe(1)
			expect(evaluate('3 >= 5')).toBe(0)
		})

		test('comparison operators with variables', () => {
			expect(evaluate('x = 10; y = 5; x > y')).toBe(1)
			expect(evaluate('x = 5; y = 10; x < y')).toBe(1)
			expect(evaluate('x = 7; y = 7; x == y')).toBe(1)
		})

		test('comparison operator precedence (lower than arithmetic)', () => {
			// Comparisons have lower precedence than arithmetic
			expect(evaluate('2 + 3 == 5')).toBe(1) // (2 + 3) == 5 = 5 == 5 = 1
			expect(evaluate('10 - 5 > 3')).toBe(1) // (10 - 5) > 3 = 5 > 3 = 1
			expect(evaluate('2 * 3 < 10')).toBe(1) // (2 * 3) < 10 = 6 < 10 = 1
		})

		test('chained comparisons (left-to-right)', () => {
			// Note: Unlike Python, this evaluates left-to-right as binary ops
			// (5 > 3) > 0 = 1 > 0 = 1
			expect(evaluate('5 > 3 > 0')).toBe(1)
			// (3 < 5) < 2 = 1 < 2 = 1
			expect(evaluate('3 < 5 < 2')).toBe(1)
		})

		test('comparison in arithmetic expression', () => {
			// Comparison returns 0 or 1, can be used in arithmetic
			expect(evaluate('(5 > 3) * 10')).toBe(10) // 1 * 10 = 10
			expect(evaluate('(5 < 3) * 10')).toBe(0) // 0 * 10 = 0
			expect(evaluate('(10 == 10) + 5')).toBe(6) // 1 + 5 = 6
		})
	})

	describe('Logical', () => {
		test('&& returns 1 when both operands are truthy', () => {
			expect(evaluate('1 && 1')).toBe(1)
			expect(evaluate('5 && 3')).toBe(1)
			expect(evaluate('100 && 200')).toBe(1)
			expect(evaluate('-1 && -2')).toBe(1)
		})

		test('&& returns 0 when left operand is 0', () => {
			expect(evaluate('0 && 1')).toBe(0)
			expect(evaluate('0 && 5')).toBe(0)
			expect(evaluate('0 && 0')).toBe(0)
		})

		test('&& returns 0 when right operand is 0', () => {
			expect(evaluate('1 && 0')).toBe(0)
			expect(evaluate('5 && 0')).toBe(0)
		})

		test('|| returns 1 when left operand is truthy', () => {
			expect(evaluate('1 || 0')).toBe(1)
			expect(evaluate('5 || 0')).toBe(1)
			expect(evaluate('100 || 0')).toBe(1)
			expect(evaluate('-1 || 0')).toBe(1)
		})

		test('|| returns 1 when right operand is truthy', () => {
			expect(evaluate('0 || 1')).toBe(1)
			expect(evaluate('0 || 5')).toBe(1)
		})

		test('|| returns 1 when both operands are truthy', () => {
			expect(evaluate('1 || 1')).toBe(1)
			expect(evaluate('5 || 3')).toBe(1)
		})

		test('|| returns 0 when both operands are 0', () => {
			expect(evaluate('0 || 0')).toBe(0)
		})

		test('&& with comparison operators', () => {
			expect(evaluate('5 > 3 && 10 > 8')).toBe(1)
			expect(evaluate('5 > 3 && 10 < 8')).toBe(0)
			expect(evaluate('5 < 3 && 10 > 8')).toBe(0)
			expect(evaluate('5 < 3 && 10 < 8')).toBe(0)
		})

		test('|| with comparison operators', () => {
			expect(evaluate('5 > 3 || 10 > 8')).toBe(1)
			expect(evaluate('5 > 3 || 10 < 8')).toBe(1)
			expect(evaluate('5 < 3 || 10 > 8')).toBe(1)
			expect(evaluate('5 < 3 || 10 < 8')).toBe(0)
		})

		test('chained && operators', () => {
			expect(evaluate('1 && 1 && 1')).toBe(1)
			expect(evaluate('1 && 1 && 0')).toBe(0)
			expect(evaluate('1 && 0 && 1')).toBe(0)
			expect(evaluate('0 && 1 && 1')).toBe(0)
		})

		test('chained || operators', () => {
			expect(evaluate('0 || 0 || 0')).toBe(0)
			expect(evaluate('0 || 0 || 1')).toBe(1)
			expect(evaluate('0 || 1 || 0')).toBe(1)
			expect(evaluate('1 || 0 || 0')).toBe(1)
		})

		test('mixed && and || operators', () => {
			// && has higher precedence than ||
			expect(evaluate('0 || 1 && 1')).toBe(1) // 0 || (1 && 1) = 0 || 1 = 1
			expect(evaluate('1 && 0 || 1')).toBe(1) // (1 && 0) || 1 = 0 || 1 = 1
			expect(evaluate('1 || 0 && 0')).toBe(1) // 1 || (0 && 0) = 1 || 0 = 1
			expect(evaluate('0 && 1 || 0')).toBe(0) // (0 && 1) || 0 = 0 || 0 = 0
		})

		test('&& and || with ternary operator', () => {
			expect(evaluate('1 && 1 ? 100 : 50')).toBe(100)
			expect(evaluate('0 && 1 ? 100 : 50')).toBe(50)
			expect(evaluate('0 || 1 ? 100 : 50')).toBe(100)
			expect(evaluate('0 || 0 ? 100 : 50')).toBe(50)
		})

		test('logical operators in assignment', () => {
			expect(evaluate('x = 5 > 3 && 10 > 8; x')).toBe(1)
			expect(evaluate('x = 5 < 3 || 10 > 8; x')).toBe(1)
			expect(evaluate('x = 0 && 1; x')).toBe(0)
			expect(evaluate('x = 0 || 0; x')).toBe(0)
		})

		test('logical operators with variables', () => {
			const context = { variables: { a: 5, b: 0, c: 10 } }
			expect(evaluate('a && c', context)).toBe(1)
			expect(evaluate('a && b', context)).toBe(0)
			expect(evaluate('b && c', context)).toBe(0)
			expect(evaluate('a || b', context)).toBe(1)
			expect(evaluate('b || c', context)).toBe(1)
			expect(evaluate('b || 0', context)).toBe(0)
		})

		test('logical operators with parentheses', () => {
			expect(evaluate('(1 && 0) || 1')).toBe(1)
			expect(evaluate('1 && (0 || 1)')).toBe(1)
			expect(evaluate('(0 || 0) && 1')).toBe(0)
			expect(evaluate('0 || (0 && 1)')).toBe(0)
		})

		test('realistic boolean logic examples', () => {
			// Age check: between 18 and 65
			expect(evaluate('age = 25; age >= 18 && age <= 65')).toBe(1)
			expect(evaluate('age = 15; age >= 18 && age <= 65')).toBe(0)
			expect(evaluate('age = 70; age >= 18 && age <= 65')).toBe(0)

			// Discount eligibility: student or senior
			const studentScript = 'isStudent = 1; age = 20; isStudent || age >= 65'
			const seniorScript = 'isStudent = 0; age = 70; isStudent || age >= 65'
			const neitherScript = 'isStudent = 0; age = 30; isStudent || age >= 65'
			expect(evaluate(studentScript)).toBe(1)
			expect(evaluate(seniorScript)).toBe(1)
			expect(evaluate(neitherScript)).toBe(0)
		})
	})

	describe('Ternary', () => {
		test('ternary with truthy condition', () => {
			expect(evaluate('1 ? 100 : 50')).toBe(100)
			expect(evaluate('5 ? 10 : 20')).toBe(10)
			expect(evaluate('-1 ? 7 : 3')).toBe(7)
		})

		test('ternary with falsy condition', () => {
			expect(evaluate('0 ? 100 : 50')).toBe(50)
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
			expect(evaluate('1 ? 2 ? 3 : 4 : 5')).toBe(3)
			expect(evaluate('0 ? 2 ? 3 : 4 : 5')).toBe(5)
			expect(evaluate('1 ? 0 ? 3 : 4 : 5')).toBe(4)
		})

		test('ternary with arithmetic', () => {
			expect(evaluate('5 > 3 ? 10 + 5 : 20 + 5')).toBe(15)
			expect(evaluate('5 < 3 ? 10 + 5 : 20 + 5')).toBe(25)
		})

		test('ternary result in arithmetic', () => {
			expect(evaluate('(1 ? 10 : 5) * 2')).toBe(20)
			expect(evaluate('(0 ? 10 : 5) * 2')).toBe(10)
		})

		test('multi-level conditional logic', () => {
			// Simulating: if (age < 18) return 10 else if (age > 65) return 8 else return 15
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

		test('discount calculation with ternary', () => {
			// Premium customers get 20% discount, others get 0
			expect(
				evaluate(
					'price = 100; isPremium = 1; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(80)
			expect(
				evaluate(
					'price = 100; isPremium = 0; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(100)
		})

		test('age-based pricing with ternary', () => {
			// Children (< 18) pay 10, seniors (> 65) pay 8, others pay 15
			expect(evaluate('age = 12; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
			expect(evaluate('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
			expect(evaluate('age = 35; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
		})
	})
})
