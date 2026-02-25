import { describe, expect, test } from 'bun:test'
import { evaluate } from '../src/interpreter'
import { defaultContext } from '../src/stdlib'

describe('Integration', () => {
	test('multiple variable assignments', () => {
		const code = `
x = 1;
y = 2;
z = x + y
		`
		const result = evaluate(code)
		expect(result).toBe(3)
	})

	test('timestamp calculation', () => {
		const code = 't = NOW()'
		const now = 1704067200000
		const result = evaluate(code, {
			functions: { NOW: () => now },
		})
		expect(result).toBe(now)
	})

	test('variable arithmetic', () => {
		const code = 'p = i - 10'
		const result = evaluate(code, {
			variables: { i: 25 },
		})
		expect(result).toBe(15)
	})

	test('complex real-world example', () => {
		const code = `
base = 100;
rate = 0.05;
interest = base * rate;
total = base + interest
		`
		const result = evaluate(code)
		expect(result).toBe(105)
	})

	test('timestamp-based calculation', () => {
		const now = 1704067200000
		const code = `
start = NOW();
duration = 5 * 60 * 1000;
end = start + duration
		`
		const result = evaluate(code, {
			functions: {
				NOW: () => now,
			},
		})
		expect(result).toBe(now + 5 * 60 * 1000)
	})

	test('compound interest calculation', () => {
		const code = `
principal = 1000;
rate = 0.05;
years = 3;
amount = principal * (1 + rate) ^ years
		`
		const result = evaluate(code)
		expect(result).toBeCloseTo(1157.625)
	})

	test('spread defaultContext into custom context', () => {
		const result = evaluate('ABS(x * -2)', {
			...defaultContext,
			variables: { x: 5 },
		})
		expect(result).toBe(10)
	})

	test('NOT operator in real-world conditions', () => {
		const checkEligibility = 'age >= 18 && !isBlocked'
		const result1 = evaluate(checkEligibility, {
			variables: { age: 25, isBlocked: false },
		})
		expect(result1).toBe(true)

		const result2 = evaluate(checkEligibility, {
			variables: { age: 25, isBlocked: true },
		})
		expect(result2).toBe(false)
	})

	test('NOT in discount calculation', () => {
		const formula = 'price * (!isPremium ? 1 : 0.8)'
		const result1 = evaluate(formula, {
			variables: { price: 100, isPremium: false },
		})
		expect(result1).toBe(100)

		const result2 = evaluate(formula, {
			variables: { price: 100, isPremium: true },
		})
		expect(result2).toBe(80)
	})

	test('NOT with validation logic', () => {
		const validation = 'score >= 60 && !(score > 100)'
		const result1 = evaluate(validation, { variables: { score: 75 } })
		expect(result1).toBe(true)

		const result2 = evaluate(validation, { variables: { score: 150 } })
		expect(result2).toBe(false)

		const result3 = evaluate(validation, { variables: { score: 50 } })
		expect(result3).toBe(false)
	})

	test('string operations', () => {
		expect(evaluate('"hello" + " " + "world"')).toBe('hello world')
	})

	test('array operations', () => {
		expect(evaluate('[1, 2] + [3, 4]')).toEqual([1, 2, 3, 4])
	})

	test('multi-type with default context', () => {
		const result = evaluate('STR_LEN("hello")', defaultContext)
		expect(result).toBe(5)
	})
})
