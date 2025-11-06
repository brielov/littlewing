import { describe, expect, test } from 'bun:test'
import { execute } from '../src'

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
duration = FROM_MINUTES(5);
end = start + duration
		`
		const result = execute(code, {
			functions: {
				NOW: () => now,
				FROM_MINUTES: (m: number) => m * 60 * 1000,
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
})
