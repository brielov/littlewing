import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
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

		test('PlainTime equality', () => {
			const t1 = new Temporal.PlainTime(10, 30, 0)
			const t2 = new Temporal.PlainTime(10, 30, 0)
			const t3 = new Temporal.PlainTime(11, 0, 0)
			expect(evaluate('t1 == t2', { variables: { t1, t2 } })).toBe(true)
			expect(evaluate('t1 == t3', { variables: { t1, t3 } })).toBe(false)
			expect(evaluate('t1 != t3', { variables: { t1, t3 } })).toBe(true)
		})

		test('PlainDateTime equality', () => {
			const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 30, 0)
			const dt2 = new Temporal.PlainDateTime(2024, 6, 15, 10, 30, 0)
			const dt3 = new Temporal.PlainDateTime(2024, 6, 15, 11, 0, 0)
			expect(evaluate('dt1 == dt2', { variables: { dt1, dt2 } })).toBe(true)
			expect(evaluate('dt1 == dt3', { variables: { dt1, dt3 } })).toBe(false)
			expect(evaluate('dt1 != dt3', { variables: { dt1, dt3 } })).toBe(true)
		})

		test('cross-type temporal equality returns false', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const t = new Temporal.PlainTime(10, 30, 0)
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 30, 0)
			expect(evaluate('d == dt', { variables: { d, dt } })).toBe(false)
			expect(evaluate('d == t', { variables: { d, t } })).toBe(false)
			expect(evaluate('t == dt', { variables: { t, dt } })).toBe(false)
		})

		test('PlainTime comparison operators', () => {
			const t1 = new Temporal.PlainTime(10, 0, 0)
			const t2 = new Temporal.PlainTime(14, 0, 0)
			expect(evaluate('t1 < t2', { variables: { t1, t2 } })).toBe(true)
			expect(evaluate('t2 > t1', { variables: { t1, t2 } })).toBe(true)
			expect(evaluate('t1 >= t1', { variables: { t1 } })).toBe(true)
			expect(evaluate('t1 <= t2', { variables: { t1, t2 } })).toBe(true)
		})

		test('PlainDateTime comparison operators', () => {
			const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
			const dt2 = new Temporal.PlainDateTime(2024, 6, 15, 14, 0, 0)
			expect(evaluate('dt1 < dt2', { variables: { dt1, dt2 } })).toBe(true)
			expect(evaluate('dt2 > dt1', { variables: { dt1, dt2 } })).toBe(true)
		})

		test('cross-type ordered comparison throws TypeError', () => {
			const t = new Temporal.PlainTime(10, 0, 0)
			const d = new Temporal.PlainDate(2024, 6, 15)
			expect(() => evaluate('t < d', { variables: { t, d } })).toThrow(
				TypeError,
			)
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
			expect(() => evaluate('t < dt', { variables: { t, dt } })).toThrow(
				TypeError,
			)
			expect(() => evaluate('d < dt', { variables: { d, dt } })).toThrow(
				TypeError,
			)
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

		test('&& and || with if expression', () => {
			expect(evaluate('if true && true then 100 else 50')).toBe(100)
			expect(evaluate('if false && true then 100 else 50')).toBe(50)
			expect(evaluate('if false || true then 100 else 50')).toBe(100)
			expect(evaluate('if false || false then 100 else 50')).toBe(50)
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

	describe('If expression', () => {
		test('if with true condition', () => {
			expect(evaluate('if true then 100 else 50')).toBe(100)
		})

		test('if with false condition', () => {
			expect(evaluate('if false then 100 else 50')).toBe(50)
		})

		test('if with comparison', () => {
			expect(evaluate('if 5 > 3 then 100 else 50')).toBe(100)
			expect(evaluate('if 5 < 3 then 100 else 50')).toBe(50)
			expect(evaluate('if 10 == 10 then 1 else 0')).toBe(1)
		})

		test('if with variables', () => {
			expect(evaluate('x = 10; y = 5; if x > y then 100 else 50')).toBe(100)
			expect(evaluate('x = 3; y = 7; if x > y then 100 else 50')).toBe(50)
		})

		test('nested if expressions', () => {
			expect(evaluate('if true then if true then 3 else 4 else 5')).toBe(3)
			expect(evaluate('if false then if true then 3 else 4 else 5')).toBe(5)
			expect(evaluate('if true then if false then 3 else 4 else 5')).toBe(4)
		})

		test('if with arithmetic', () => {
			expect(evaluate('if 5 > 3 then 10 + 5 else 20 + 5')).toBe(15)
			expect(evaluate('if 5 < 3 then 10 + 5 else 20 + 5')).toBe(25)
		})

		test('if result in arithmetic', () => {
			expect(evaluate('(if true then 10 else 5) * 2')).toBe(20)
			expect(evaluate('(if false then 10 else 5) * 2')).toBe(10)
		})

		test('multi-level conditional logic', () => {
			expect(
				evaluate(
					'age = 15; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(10)
			expect(
				evaluate(
					'age = 70; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(8)
			expect(
				evaluate(
					'age = 30; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(15)
		})

		test('if in assignment', () => {
			expect(evaluate('x = if 5 > 3 then 100 else 50; x')).toBe(100)
			expect(evaluate('x = if 5 < 3 then 100 else 50; x')).toBe(50)
		})

		test('MAX using if', () => {
			expect(evaluate('a = 10; b = 20; if a > b then a else b')).toBe(20)
			expect(evaluate('a = 30; b = 20; if a > b then a else b')).toBe(30)
		})

		test('MIN using if', () => {
			expect(evaluate('a = 10; b = 20; if a < b then a else b')).toBe(10)
			expect(evaluate('a = 30; b = 20; if a < b then a else b')).toBe(20)
		})

		test('if requires boolean condition', () => {
			expect(() => evaluate('if 1 then 100 else 50')).toThrow(TypeError)
			expect(() => evaluate('if 0 then 100 else 50')).toThrow(TypeError)
		})

		test('discount calculation with if', () => {
			expect(
				evaluate(
					'price = 100; isPremium = true; price * (1 - (if isPremium then 0.2 else 0))',
				),
			).toBe(80)
			expect(
				evaluate(
					'price = 100; isPremium = false; price * (1 - (if isPremium then 0.2 else 0))',
				),
			).toBe(100)
		})

		test('age-based pricing with if', () => {
			expect(
				evaluate(
					'age = 12; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(10)
			expect(
				evaluate(
					'age = 70; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(8)
			expect(
				evaluate(
					'age = 35; if age < 18 then 10 else if age > 65 then 8 else 15',
				),
			).toBe(15)
		})
	})
})
