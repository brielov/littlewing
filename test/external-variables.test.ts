import { describe, expect, test } from 'bun:test'
import { evaluate } from '../src/interpreter'

describe('External Variables', () => {
	test('external variables override internal assignments', () => {
		// External variable should override the assignment
		expect(evaluate('price = 100', { variables: { price: 50 } })).toBe(50)
		expect(evaluate('price = 100; price', { variables: { price: 50 } })).toBe(
			50,
		)
	})

	test('assignments without external variables work normally', () => {
		// Without external variable, assignment works as usual
		expect(evaluate('price = 100')).toBe(100)
		expect(evaluate('price = 100; price')).toBe(100)
	})

	test('external variables allow script defaults', () => {
		// Real-world use case: formula with defaults that can be overridden
		const formula = `
			price = 100
			tax = 0.1
			discount = 0
			total = price * (1 + tax) * (1 - discount)
			total
		`

		// Use all defaults
		expect(evaluate(formula)).toBeCloseTo(110)

		// Override some values
		expect(evaluate(formula, { variables: { price: 200 } })).toBeCloseTo(220)
		expect(evaluate(formula, { variables: { discount: 0.2 } })).toBeCloseTo(88)
		expect(
			evaluate(formula, { variables: { price: 200, discount: 0.1 } }),
		).toBeCloseTo(198)
	})

	test('external variables preserve zero and falsy values', () => {
		// Zero should be preserved as an external value
		expect(evaluate('discount = 0.2', { variables: { discount: 0 } })).toBe(0)
		expect(
			evaluate('discount = 0.2; discount', { variables: { discount: 0 } }),
		).toBe(0)
	})

	test('external variable evaluates assignment expression for side effects', () => {
		// Right side MUST be evaluated for side effects (e.g., function calls)
		// but the external value takes precedence for the assignment result
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
		expect(result).toBe(100) // External value takes precedence
		expect(callCount).toBe(1) // But COUNTER() was called for side effects
	})

	test('mix of external and internal assignments', () => {
		const formula = `
			base = 100
			multiplier = 2
			result = base * multiplier
			result
		`
		// Override only 'base', 'multiplier' uses internal default
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

		// Default values
		expect(evaluate(pricingScript)).toBeCloseTo(118.8)

		// Bulk order with external quantity
		expect(
			evaluate(pricingScript, { variables: { quantity: 10 } }),
		).toBeCloseTo(982.8)

		// Custom pricing
		expect(
			evaluate(pricingScript, { variables: { basePrice: 50, shipping: 5 } }),
		).toBeCloseTo(59.4)
	})
})
