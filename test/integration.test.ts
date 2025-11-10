import { describe, expect, test } from 'bun:test'
import { defaultContext, execute } from '../src'

describe('Integration', () => {
	test('multiple variable assignments', () => {
		const code = `
x = 1;
y = 2;
z = x + y
		`
		const result = execute(code)
		expect(result).toBe(3)
	})

	test('timestamp calculation', () => {
		const code = `t = NOW()`
		const now = 1704067200000
		const result = execute(code, {
			functions: { NOW: () => now },
		})
		expect(result).toBe(now)
	})

	test('variable arithmetic', () => {
		const code = `p = i - 10`
		const result = execute(code, {
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
		const result = execute(code)
		expect(result).toBe(105)
	})

	test('timestamp-based calculation', () => {
		const now = 1704067200000
		const code = `
start = NOW();
duration = 5 * 60 * 1000;
end = start + duration
		`
		const result = execute(code, {
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
		const result = execute(code)
		expect(result).toBeCloseTo(1157.625)
	})

	test('spread defaultContext into custom context', () => {
		const result = execute('ABS(x * -2)', {
			...defaultContext,
			variables: { x: 5 },
		})
		expect(result).toBe(10)
	})

	test('NOT operator in real-world conditions', () => {
		const checkEligibility = 'age >= 18 && !isBlocked'
		const result1 = execute(checkEligibility, {
			variables: { age: 25, isBlocked: 0 },
		})
		expect(result1).toBe(1) // eligible

		const result2 = execute(checkEligibility, {
			variables: { age: 25, isBlocked: 1 },
		})
		expect(result2).toBe(0) // not eligible (blocked)
	})

	test('NOT in discount calculation', () => {
		const formula = 'price * (!isPremium ? 1 : 0.8)'
		const result1 = execute(formula, {
			variables: { price: 100, isPremium: 0 },
		})
		expect(result1).toBe(100) // no discount

		const result2 = execute(formula, {
			variables: { price: 100, isPremium: 1 },
		})
		expect(result2).toBe(80) // 20% discount
	})

	test('NOT with validation logic', () => {
		const validation = 'score >= 60 && !(score > 100)'
		const result1 = execute(validation, { variables: { score: 75 } })
		expect(result1).toBe(1) // valid score

		const result2 = execute(validation, { variables: { score: 150 } })
		expect(result2).toBe(0) // invalid (over 100)

		const result3 = execute(validation, { variables: { score: 50 } })
		expect(result3).toBe(0) // invalid (below 60)
	})
})
