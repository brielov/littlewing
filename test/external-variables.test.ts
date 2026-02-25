import { describe, expect, test } from 'bun:test'
import { evaluate } from '../src/interpreter'

describe('External Variables', () => {
	test('external variables override internal assignments', () => {
		expect(evaluate('price = 100', { variables: { price: 50 } })).toBe(50)
		expect(evaluate('price = 100; price', { variables: { price: 50 } })).toBe(
			50,
		)
	})

	test('assignments without external variables work normally', () => {
		expect(evaluate('price = 100')).toBe(100)
		expect(evaluate('price = 100; price')).toBe(100)
	})

	test('external variables allow script defaults', () => {
		const formula = `
			price = 100
			tax = 0.1
			discount = 0
			total = price * (1 + tax) * (1 - discount)
			total
		`

		expect(evaluate(formula)).toBeCloseTo(110)
		expect(evaluate(formula, { variables: { price: 200 } })).toBeCloseTo(220)
		expect(evaluate(formula, { variables: { discount: 0.2 } })).toBeCloseTo(88)
		expect(
			evaluate(formula, { variables: { price: 200, discount: 0.1 } }),
		).toBeCloseTo(198)
	})

	test('external variables preserve zero and falsy values', () => {
		expect(evaluate('discount = 0.2', { variables: { discount: 0 } })).toBe(0)
		expect(
			evaluate('discount = 0.2; discount', { variables: { discount: 0 } }),
		).toBe(0)
	})

	test('external variable evaluates assignment expression for side effects', () => {
		let callCount = 0
		const formula = 'price = COUNTER(); price'
		const context = {
			functions: {
				COUNTER: () => {
					callCount++
					return callCount
				},
			},
			variables: { price: 100 },
		}
		const result = evaluate(formula, context)
		expect(result).toBe(100)
		expect(callCount).toBe(1)
	})

	test('mix of external and internal assignments', () => {
		const formula = `
			base = 100
			multiplier = 2
			result = base * multiplier
			result
		`
		expect(evaluate(formula, { variables: { base: 50 } })).toBe(100)
	})

	test('realistic pricing with external overrides', () => {
		const pricingScript = `
			basePrice = 100
			quantity = 1
			discount = quantity > 5 ? 0.1 : 0
			shipping = 10
			tax = 0.08
			subtotal = basePrice * quantity * (1 - discount)
			total = (subtotal + shipping) * (1 + tax)
			total
		`

		expect(evaluate(pricingScript)).toBeCloseTo(118.8)

		expect(
			evaluate(pricingScript, { variables: { quantity: 10 } }),
		).toBeCloseTo(982.8)

		expect(
			evaluate(pricingScript, { variables: { basePrice: 50, shipping: 5 } }),
		).toBeCloseTo(59.4)
	})

	test('external variables can be any RuntimeValue type', () => {
		expect(evaluate('name', { variables: { name: 'Alice' } })).toBe('Alice')
		expect(evaluate('flag', { variables: { flag: true } })).toBe(true)
		expect(evaluate('items', { variables: { items: [1, 2, 3] } })).toEqual([
			1, 2, 3,
		])
	})
})
