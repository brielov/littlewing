import { describe, expect, test } from 'bun:test'
import { defaultContext } from '../src/defaults'
import { evaluate } from '../src/interpreter'

describe('Default Context Functions', () => {
	describe('CLAMP', () => {
		test('CLAMP returns value when within bounds', () => {
			const result = evaluate('CLAMP(50, 0, 100)', defaultContext)
			expect(result).toBe(50)
		})

		test('CLAMP returns min when value is below minimum', () => {
			const result = evaluate('CLAMP(-10, 0, 100)', defaultContext)
			expect(result).toBe(0)
		})

		test('CLAMP returns max when value is above maximum', () => {
			const result = evaluate('CLAMP(150, 0, 100)', defaultContext)
			expect(result).toBe(100)
		})

		test('CLAMP works with negative bounds', () => {
			const result = evaluate('CLAMP(-5, -10, -1)', defaultContext)
			expect(result).toBe(-5)
		})

		test('CLAMP at exact minimum boundary', () => {
			const result = evaluate('CLAMP(0, 0, 100)', defaultContext)
			expect(result).toBe(0)
		})

		test('CLAMP at exact maximum boundary', () => {
			const result = evaluate('CLAMP(100, 0, 100)', defaultContext)
			expect(result).toBe(100)
		})

		test('CLAMP with decimal values', () => {
			const result = evaluate('CLAMP(5.5, 0, 10)', defaultContext)
			expect(result).toBe(5.5)
		})

		test('CLAMP with variables', () => {
			const result = evaluate('CLAMP(value, minVal, maxVal)', {
				...defaultContext,
				variables: { value: 75, minVal: 0, maxVal: 100 },
			})
			expect(result).toBe(75)
		})

		test('CLAMP in expression - percentage clamping', () => {
			const result = evaluate('CLAMP((score / total) * 100, 0, 100)', {
				...defaultContext,
				variables: { score: 95, total: 90 },
			})
			expect(result).toBe(100)
		})

		test('CLAMP in expression - discount validation', () => {
			const result = evaluate('price * (1 - CLAMP(discount, 0, 1))', {
				...defaultContext,
				variables: { price: 100, discount: 1.5 },
			})
			expect(result).toBe(0)
		})
	})
})
