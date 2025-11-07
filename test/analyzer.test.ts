import { describe, expect, test } from 'bun:test'
import { extractInputVariables, parseSource } from '../src/index'

describe('extractInputVariables', () => {
	describe('literals as inputs', () => {
		test('extracts variable assigned to positive literal', () => {
			const ast = parseSource('x = 10')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to decimal literal', () => {
			const ast = parseSource('rate = 0.08')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['rate'])
		})

		test('extracts variable assigned to negative literal (unary minus)', () => {
			const ast = parseSource('x = -10')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to decimal shorthand', () => {
			const ast = parseSource('x = .5')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to scientific notation', () => {
			const ast = parseSource('x = 1.5e6')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts multiple literal variables', () => {
			const ast = parseSource('x = 10; y = 20; z = -5')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x', 'y', 'z'])
		})
	})

	describe('constant expressions as inputs', () => {
		test('extracts variable assigned to constant addition', () => {
			const ast = parseSource('x = 2 + 3')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to constant multiplication', () => {
			const ast = parseSource('hours = 24 * 7')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['hours'])
		})

		test('extracts variable assigned to complex constant expression', () => {
			const ast = parseSource('x = (2 + 3) * 4 - 1')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to unary minus of constant expression', () => {
			const ast = parseSource('x = -(2 + 3)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('function calls as inputs', () => {
		test('extracts variable assigned to function with no args', () => {
			const ast = parseSource('start = NOW()')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['start'])
		})

		test('extracts variable assigned to function with constant args', () => {
			const ast = parseSource('max_val = MAX(10, 20)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['max_val'])
		})

		test('extracts variable assigned to function with constant expression args', () => {
			const ast = parseSource('result = MAX(2 + 3, 4 * 5)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['result'])
		})

		test('extracts variable assigned to nested function calls', () => {
			const ast = parseSource('x = ABS(MAX(-10, -20))')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('computed variables (excluded)', () => {
		test('excludes variable that references another variable', () => {
			const ast = parseSource('x = 10; y = x')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable computed from binary operation with variable', () => {
			const ast = parseSource('price = 100; tax = price * 0.08')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['price'])
		})

		test('excludes variable computed from multiple variables', () => {
			const ast = parseSource('x = 10; y = 20; sum = x + y')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x', 'y'])
		})

		test('excludes variable with unary minus of variable', () => {
			const ast = parseSource('x = 10; y = -x')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from function call with variable argument', () => {
			const ast = parseSource('x = 10; y = ABS(x)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from function call mixing constants and variables', () => {
			const ast = parseSource('x = 10; y = MAX(x, 20)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from nested expression with variable reference', () => {
			const ast = parseSource('x = 10; y = (x + 5) * 2')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('conditional expressions', () => {
		test('extracts variable assigned to conditional with constant condition', () => {
			const ast = parseSource('x = 1 ? 100 : 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to conditional with constant expression', () => {
			const ast = parseSource('x = 5 > 3 ? 100 : 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable with conditional that references variable', () => {
			const ast = parseSource('x = 10; y = x > 5 ? 100 : 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable with conditional that has variable in branches', () => {
			const ast = parseSource('x = 10; y = 1 ? x : 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('complex scenarios', () => {
		test('extracts input variables from realistic formula', () => {
			const ast = parseSource(`
				principal = 1000
				rate = 0.05
				time = 2
				interest = principal * rate * time
				total = principal + interest
			`)
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['principal', 'rate', 'time'])
		})

		test('extracts input variables from date calculation', () => {
			const ast = parseSource(`
				start_date = NOW()
				days_to_add = 7
				hours_offset = 24 * 7
				end_date = ADD_DAYS(start_date, days_to_add)
				deadline = ADD_HOURS(start_date, hours_offset)
			`)
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['start_date', 'days_to_add', 'hours_offset'])
		})

		test('extracts input variables from mixed computation', () => {
			const ast = parseSource(`
				price = 100
				tax_rate = 0.08
				discount = MAX(10, 20)
				tax = price * tax_rate
				final_price = price + tax - discount
			`)
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['price', 'tax_rate', 'discount'])
		})

		test('handles variable shadowing correctly', () => {
			const ast = parseSource(`
				x = 10
				x = x + 5
			`)
			const inputs = extractInputVariables(ast)
			// First x is input, second x references a variable (itself)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('edge cases', () => {
		test('returns empty array for program with no assignments', () => {
			const ast = parseSource('2 + 3')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual([])
		})

		test('throws error for empty program', () => {
			expect(() => parseSource('')).toThrow('Empty program')
		})

		test('preserves order of first occurrence', () => {
			const ast = parseSource('z = 30; a = 10; m = 20')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['z', 'a', 'm'])
		})
	})
})
