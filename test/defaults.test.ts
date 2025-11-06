import { describe, expect, test } from 'bun:test'
import { defaultContext, execute } from '../src'

describe('Default Context', () => {
	test('Math.ABS', () => {
		const result = execute('ABS(-42)', defaultContext)
		expect(result).toBe(42)
	})

	test('Math.FLOOR', () => {
		const result = execute('FLOOR(3.7)', defaultContext)
		expect(result).toBe(3)
	})

	test('Math.CEIL', () => {
		const result = execute('CEIL(3.2)', defaultContext)
		expect(result).toBe(4)
	})

	test('Math.ROUND', () => {
		const result = execute('ROUND(3.5)', defaultContext)
		expect(result).toBe(4)
	})

	test('Math.SQRT', () => {
		const result = execute('SQRT(16)', defaultContext)
		expect(result).toBe(4)
	})

	test('exponentiation operator', () => {
		const result = execute('2 ^ 3', defaultContext)
		expect(result).toBe(8)
	})

	test('Math.MAX', () => {
		const result = execute('MAX(1, 5, 3)', defaultContext)
		expect(result).toBe(5)
	})

	test('Math.MIN', () => {
		const result = execute('MIN(1, 5, 3)', defaultContext)
		expect(result).toBe(1)
	})

	test('spread into custom context', () => {
		const result = execute('ABS(x * -2)', {
			...defaultContext,
			variables: { x: 5 },
		})
		expect(result).toBe(10)
	})
})
