import { describe, expect, test } from 'bun:test'
import { execute } from '../src'

describe('Operators', () => {
	describe('Comparison', () => {
		test('equality operator returns 1 or 0', () => {
			expect(execute('5 == 5')).toBe(1)
			expect(execute('5 == 3')).toBe(0)
			expect(execute('10 == 10')).toBe(1)
			expect(execute('7.5 == 7.5')).toBe(1)
		})

		test('not-equals operator', () => {
			expect(execute('5 != 3')).toBe(1)
			expect(execute('5 != 5')).toBe(0)
			expect(execute('10 != 10')).toBe(0)
		})

		test('less-than operator', () => {
			expect(execute('3 < 5')).toBe(1)
			expect(execute('5 < 3')).toBe(0)
			expect(execute('5 < 5')).toBe(0)
		})

		test('greater-than operator', () => {
			expect(execute('5 > 3')).toBe(1)
			expect(execute('3 > 5')).toBe(0)
			expect(execute('5 > 5')).toBe(0)
		})

		test('less-than-or-equal operator', () => {
			expect(execute('3 <= 5')).toBe(1)
			expect(execute('5 <= 5')).toBe(1)
			expect(execute('7 <= 5')).toBe(0)
		})

		test('greater-than-or-equal operator', () => {
			expect(execute('5 >= 3')).toBe(1)
			expect(execute('5 >= 5')).toBe(1)
			expect(execute('3 >= 5')).toBe(0)
		})

		test('comparison operators with variables', () => {
			expect(execute('x = 10; y = 5; x > y')).toBe(1)
			expect(execute('x = 5; y = 10; x < y')).toBe(1)
			expect(execute('x = 7; y = 7; x == y')).toBe(1)
		})

		test('comparison operator precedence (lower than arithmetic)', () => {
			// Comparisons have lower precedence than arithmetic
			expect(execute('2 + 3 == 5')).toBe(1) // (2 + 3) == 5 = 5 == 5 = 1
			expect(execute('10 - 5 > 3')).toBe(1) // (10 - 5) > 3 = 5 > 3 = 1
			expect(execute('2 * 3 < 10')).toBe(1) // (2 * 3) < 10 = 6 < 10 = 1
		})

		test('chained comparisons (left-to-right)', () => {
			// Note: Unlike Python, this evaluates left-to-right as binary ops
			// (5 > 3) > 0 = 1 > 0 = 1
			expect(execute('5 > 3 > 0')).toBe(1)
			// (3 < 5) < 2 = 1 < 2 = 1
			expect(execute('3 < 5 < 2')).toBe(1)
		})

		test('comparison in arithmetic expression', () => {
			// Comparison returns 0 or 1, can be used in arithmetic
			expect(execute('(5 > 3) * 10')).toBe(10) // 1 * 10 = 10
			expect(execute('(5 < 3) * 10')).toBe(0) // 0 * 10 = 0
			expect(execute('(10 == 10) + 5')).toBe(6) // 1 + 5 = 6
		})
	})

	describe('Logical', () => {
		test('&& returns 1 when both operands are truthy', () => {
			expect(execute('1 && 1')).toBe(1)
			expect(execute('5 && 3')).toBe(1)
			expect(execute('100 && 200')).toBe(1)
			expect(execute('-1 && -2')).toBe(1)
		})

		test('&& returns 0 when left operand is 0', () => {
			expect(execute('0 && 1')).toBe(0)
			expect(execute('0 && 5')).toBe(0)
			expect(execute('0 && 0')).toBe(0)
		})

		test('&& returns 0 when right operand is 0', () => {
			expect(execute('1 && 0')).toBe(0)
			expect(execute('5 && 0')).toBe(0)
		})

		test('|| returns 1 when left operand is truthy', () => {
			expect(execute('1 || 0')).toBe(1)
			expect(execute('5 || 0')).toBe(1)
			expect(execute('100 || 0')).toBe(1)
			expect(execute('-1 || 0')).toBe(1)
		})

		test('|| returns 1 when right operand is truthy', () => {
			expect(execute('0 || 1')).toBe(1)
			expect(execute('0 || 5')).toBe(1)
		})

		test('|| returns 1 when both operands are truthy', () => {
			expect(execute('1 || 1')).toBe(1)
			expect(execute('5 || 3')).toBe(1)
		})

		test('|| returns 0 when both operands are 0', () => {
			expect(execute('0 || 0')).toBe(0)
		})

		test('&& with comparison operators', () => {
			expect(execute('5 > 3 && 10 > 8')).toBe(1)
			expect(execute('5 > 3 && 10 < 8')).toBe(0)
			expect(execute('5 < 3 && 10 > 8')).toBe(0)
			expect(execute('5 < 3 && 10 < 8')).toBe(0)
		})

		test('|| with comparison operators', () => {
			expect(execute('5 > 3 || 10 > 8')).toBe(1)
			expect(execute('5 > 3 || 10 < 8')).toBe(1)
			expect(execute('5 < 3 || 10 > 8')).toBe(1)
			expect(execute('5 < 3 || 10 < 8')).toBe(0)
		})

		test('chained && operators', () => {
			expect(execute('1 && 1 && 1')).toBe(1)
			expect(execute('1 && 1 && 0')).toBe(0)
			expect(execute('1 && 0 && 1')).toBe(0)
			expect(execute('0 && 1 && 1')).toBe(0)
		})

		test('chained || operators', () => {
			expect(execute('0 || 0 || 0')).toBe(0)
			expect(execute('0 || 0 || 1')).toBe(1)
			expect(execute('0 || 1 || 0')).toBe(1)
			expect(execute('1 || 0 || 0')).toBe(1)
		})

		test('mixed && and || operators', () => {
			// && has higher precedence than ||
			expect(execute('0 || 1 && 1')).toBe(1) // 0 || (1 && 1) = 0 || 1 = 1
			expect(execute('1 && 0 || 1')).toBe(1) // (1 && 0) || 1 = 0 || 1 = 1
			expect(execute('1 || 0 && 0')).toBe(1) // 1 || (0 && 0) = 1 || 0 = 1
			expect(execute('0 && 1 || 0')).toBe(0) // (0 && 1) || 0 = 0 || 0 = 0
		})

		test('&& and || with ternary operator', () => {
			expect(execute('1 && 1 ? 100 : 50')).toBe(100)
			expect(execute('0 && 1 ? 100 : 50')).toBe(50)
			expect(execute('0 || 1 ? 100 : 50')).toBe(100)
			expect(execute('0 || 0 ? 100 : 50')).toBe(50)
		})

		test('logical operators in assignment', () => {
			expect(execute('x = 5 > 3 && 10 > 8; x')).toBe(1)
			expect(execute('x = 5 < 3 || 10 > 8; x')).toBe(1)
			expect(execute('x = 0 && 1; x')).toBe(0)
			expect(execute('x = 0 || 0; x')).toBe(0)
		})

		test('logical operators with variables', () => {
			const context = { variables: { a: 5, b: 0, c: 10 } }
			expect(execute('a && c', context)).toBe(1)
			expect(execute('a && b', context)).toBe(0)
			expect(execute('b && c', context)).toBe(0)
			expect(execute('a || b', context)).toBe(1)
			expect(execute('b || c', context)).toBe(1)
			expect(execute('b || 0', context)).toBe(0)
		})

		test('logical operators with parentheses', () => {
			expect(execute('(1 && 0) || 1')).toBe(1)
			expect(execute('1 && (0 || 1)')).toBe(1)
			expect(execute('(0 || 0) && 1')).toBe(0)
			expect(execute('0 || (0 && 1)')).toBe(0)
		})

		test('realistic boolean logic examples', () => {
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
	})

	describe('Ternary', () => {
		test('ternary with truthy condition', () => {
			expect(execute('1 ? 100 : 50')).toBe(100)
			expect(execute('5 ? 10 : 20')).toBe(10)
			expect(execute('-1 ? 7 : 3')).toBe(7)
		})

		test('ternary with falsy condition', () => {
			expect(execute('0 ? 100 : 50')).toBe(50)
		})

		test('ternary with comparison', () => {
			expect(execute('5 > 3 ? 100 : 50')).toBe(100)
			expect(execute('5 < 3 ? 100 : 50')).toBe(50)
			expect(execute('10 == 10 ? 1 : 0')).toBe(1)
		})

		test('ternary with variables', () => {
			expect(execute('x = 10; y = 5; x > y ? 100 : 50')).toBe(100)
			expect(execute('x = 3; y = 7; x > y ? 100 : 50')).toBe(50)
		})

		test('nested ternary expressions', () => {
			expect(execute('1 ? 2 ? 3 : 4 : 5')).toBe(3)
			expect(execute('0 ? 2 ? 3 : 4 : 5')).toBe(5)
			expect(execute('1 ? 0 ? 3 : 4 : 5')).toBe(4)
		})

		test('ternary with arithmetic', () => {
			expect(execute('5 > 3 ? 10 + 5 : 20 + 5')).toBe(15)
			expect(execute('5 < 3 ? 10 + 5 : 20 + 5')).toBe(25)
		})

		test('ternary result in arithmetic', () => {
			expect(execute('(1 ? 10 : 5) * 2')).toBe(20)
			expect(execute('(0 ? 10 : 5) * 2')).toBe(10)
		})

		test('multi-level conditional logic', () => {
			// Simulating: if (age < 18) return 10 else if (age > 65) return 8 else return 15
			expect(execute('age = 15; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
			expect(execute('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
			expect(execute('age = 30; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
		})

		test('ternary in assignment', () => {
			expect(execute('x = 5 > 3 ? 100 : 50; x')).toBe(100)
			expect(execute('x = 5 < 3 ? 100 : 50; x')).toBe(50)
		})

		test('MAX using ternary', () => {
			expect(execute('a = 10; b = 20; a > b ? a : b')).toBe(20)
			expect(execute('a = 30; b = 20; a > b ? a : b')).toBe(30)
		})

		test('MIN using ternary', () => {
			expect(execute('a = 10; b = 20; a < b ? a : b')).toBe(10)
			expect(execute('a = 30; b = 20; a < b ? a : b')).toBe(20)
		})

		test('discount calculation with ternary', () => {
			// Premium customers get 20% discount, others get 0
			expect(
				execute(
					'price = 100; isPremium = 1; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(80)
			expect(
				execute(
					'price = 100; isPremium = 0; price * (1 - (isPremium ? 0.2 : 0))',
				),
			).toBe(100)
		})

		test('age-based pricing with ternary', () => {
			// Children (< 18) pay 10, seniors (> 65) pay 8, others pay 15
			expect(execute('age = 12; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(10)
			expect(execute('age = 70; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(8)
			expect(execute('age = 35; age < 18 ? 10 : age > 65 ? 8 : 15')).toBe(15)
		})
	})
})
