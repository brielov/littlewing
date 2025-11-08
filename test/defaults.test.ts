import { describe, expect, test } from 'bun:test'
import { defaultContext, execute } from '../src'

describe('Default Context Functions', () => {
	describe('CLAMP', () => {
		test('CLAMP returns value when within bounds', () => {
			const result = execute('CLAMP(50, 0, 100)', defaultContext)
			expect(result).toBe(50)
		})

		test('CLAMP returns min when value is below minimum', () => {
			const result = execute('CLAMP(-10, 0, 100)', defaultContext)
			expect(result).toBe(0)
		})

		test('CLAMP returns max when value is above maximum', () => {
			const result = execute('CLAMP(150, 0, 100)', defaultContext)
			expect(result).toBe(100)
		})

		test('CLAMP works with negative bounds', () => {
			const result = execute('CLAMP(-5, -10, -1)', defaultContext)
			expect(result).toBe(-5)
		})

		test('CLAMP at exact minimum boundary', () => {
			const result = execute('CLAMP(0, 0, 100)', defaultContext)
			expect(result).toBe(0)
		})

		test('CLAMP at exact maximum boundary', () => {
			const result = execute('CLAMP(100, 0, 100)', defaultContext)
			expect(result).toBe(100)
		})

		test('CLAMP with decimal values', () => {
			const result = execute('CLAMP(5.5, 0, 10)', defaultContext)
			expect(result).toBe(5.5)
		})

		test('CLAMP with variables', () => {
			const result = execute('CLAMP(value, minVal, maxVal)', {
				...defaultContext,
				variables: { value: 75, minVal: 0, maxVal: 100 },
			})
			expect(result).toBe(75)
		})

		test('CLAMP in expression - percentage clamping', () => {
			const result = execute('CLAMP((score / total) * 100, 0, 100)', {
				...defaultContext,
				variables: { score: 95, total: 90 },
			})
			expect(result).toBe(100)
		})

		test('CLAMP in expression - discount validation', () => {
			const result = execute('price * (1 - CLAMP(discount, 0, 1))', {
				...defaultContext,
				variables: { price: 100, discount: 1.5 },
			})
			expect(result).toBe(0)
		})
	})
})
