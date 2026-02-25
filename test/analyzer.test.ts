import { describe, expect, test } from 'bun:test'
import {
	extractAssignedVariables,
	extractInputVariables,
} from '../src/analyzer'
import { parse } from '../src/parser'

describe('extractInputVariables', () => {
	describe('literals as inputs', () => {
		test('extracts variable assigned to positive literal', () => {
			const ast = parse('x = 10')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to decimal literal', () => {
			const ast = parse('rate = 0.08')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['rate'])
		})

		test('extracts variable assigned to negative literal (unary minus)', () => {
			const ast = parse('x = -10')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to decimal shorthand', () => {
			const ast = parse('x = .5')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to scientific notation', () => {
			const ast = parse('x = 1.5e6')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts multiple literal variables', () => {
			const ast = parse('x = 10; y = 20; z = -5')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x', 'y', 'z'])
		})
	})

	describe('constant expressions as inputs', () => {
		test('extracts variable assigned to constant addition', () => {
			const ast = parse('x = 2 + 3')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to constant multiplication', () => {
			const ast = parse('hours = 24 * 7')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['hours'])
		})

		test('extracts variable assigned to complex constant expression', () => {
			const ast = parse('x = (2 + 3) * 4 - 1')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to unary minus of constant expression', () => {
			const ast = parse('x = -(2 + 3)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('function calls as inputs', () => {
		test('extracts variable assigned to function with no args', () => {
			const ast = parse('start = NOW()')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['start'])
		})

		test('extracts variable assigned to function with constant args', () => {
			const ast = parse('max_val = MAX(10, 20)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['max_val'])
		})

		test('extracts variable assigned to function with constant expression args', () => {
			const ast = parse('result = MAX(2 + 3, 4 * 5)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['result'])
		})

		test('extracts variable assigned to nested function calls', () => {
			const ast = parse('x = ABS(MAX(-10, -20))')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('computed variables (excluded)', () => {
		test('excludes variable that references another variable', () => {
			const ast = parse('x = 10; y = x')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable computed from binary operation with variable', () => {
			const ast = parse('price = 100; tax = price * 0.08')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['price'])
		})

		test('excludes variable computed from multiple variables', () => {
			const ast = parse('x = 10; y = 20; sum = x + y')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x', 'y'])
		})

		test('excludes variable with unary minus of variable', () => {
			const ast = parse('x = 10; y = -x')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from function call with variable argument', () => {
			const ast = parse('x = 10; y = ABS(x)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from function call mixing constants and variables', () => {
			const ast = parse('x = 10; y = MAX(x, 20)')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable from nested expression with variable reference', () => {
			const ast = parse('x = 10; y = (x + 5) * 2')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('if expressions', () => {
		test('extracts variable assigned to if expression with constant condition', () => {
			const ast = parse('x = if true then 100 else 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('extracts variable assigned to if expression with constant comparison', () => {
			const ast = parse('x = if 5 > 3 then 100 else 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable with if expression that references variable', () => {
			const ast = parse('x = 10; y = if x > 5 then 100 else 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})

		test('excludes variable with if expression that has variable in branches', () => {
			const ast = parse('x = 10; y = if true then x else 50')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['x'])
		})
	})

	describe('complex scenarios', () => {
		test('extracts input variables from realistic formula', () => {
			const ast = parse(`
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
			const ast = parse(`
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
			const ast = parse(`
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
			const ast = parse(`
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
			const ast = parse('2 + 3')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual([])
		})

		test('throws error for empty program', () => {
			expect(() => parse('')).toThrow('Empty program')
		})

		test('preserves order of first occurrence', () => {
			const ast = parse('z = 30; a = 10; m = 20')
			const inputs = extractInputVariables(ast)
			expect(inputs).toEqual(['z', 'a', 'm'])
		})
	})
})

describe('extractAssignedVariables', () => {
	test('extracts single assignment', () => {
		const ast = parse('x = 10')
		expect(extractAssignedVariables(ast)).toEqual(['x'])
	})

	test('extracts multiple assignments', () => {
		const ast = parse('x = 10; y = 20; z = 30')
		expect(extractAssignedVariables(ast)).toEqual(['x', 'y', 'z'])
	})

	test('deduplicates reassigned variables', () => {
		const ast = parse('x = 10; x = 20')
		expect(extractAssignedVariables(ast)).toEqual(['x'])
	})

	test('preserves definition order', () => {
		const ast = parse('z = 1; a = 2; m = 3')
		expect(extractAssignedVariables(ast)).toEqual(['z', 'a', 'm'])
	})

	test('returns empty array when no assignments exist', () => {
		const ast = parse('2 + 3')
		expect(extractAssignedVariables(ast)).toEqual([])
	})

	test('includes computed assignments', () => {
		const ast = parse('x = 10; y = x * 2')
		expect(extractAssignedVariables(ast)).toEqual(['x', 'y'])
	})

	test('extracts from realistic BVA efficiency formula', () => {
		const ast = parse(`
			totalTime = hoursPerWeek * 52
			hoursRecovered = totalTime * efficiencyGain
			valueRecovered = hoursRecovered * hourlyRate
		`)
		expect(extractAssignedVariables(ast)).toEqual([
			'totalTime',
			'hoursRecovered',
			'valueRecovered',
		])
	})

	test('extracts from formula with function calls', () => {
		const ast = parse(
			'start = NOW(); duration = 24 * 7; end_date = ADD_DAYS(start, duration)',
		)
		expect(extractAssignedVariables(ast)).toEqual([
			'start',
			'duration',
			'end_date',
		])
	})

	test('extracts from formula with if expressions', () => {
		const ast = parse('x = 10; y = if x > 5 then 100 else 50')
		expect(extractAssignedVariables(ast)).toEqual(['x', 'y'])
	})

	test('handles single non-program node', () => {
		// parse('x = 42') returns an Assignment node directly (not a Program)
		const ast = parse('x = 42')
		expect(extractAssignedVariables(ast)).toEqual(['x'])
	})
})
