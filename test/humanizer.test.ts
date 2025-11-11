import { describe, expect, test } from 'bun:test'
import * as ast from '../src/ast'
import { humanize, parseSource } from '../src/index'

describe('Humanizer', () => {
	describe('Basic node types', () => {
		test('humanize number literal', () => {
			const node = ast.number(42)
			expect(humanize(node)).toBe('42')
		})

		test('humanize identifier', () => {
			const node = ast.identifier('price')
			expect(humanize(node)).toBe('price')
		})

		test('humanize assignment', () => {
			const node = ast.assign('x', ast.number(5))
			expect(humanize(node)).toBe('set x to 5')
		})

		test('humanize program with multiple statements', () => {
			const node = ast.program([
				ast.assign('x', ast.number(5)),
				ast.assign('y', ast.number(10)),
				ast.add(ast.identifier('x'), ast.identifier('y')),
			])
			expect(humanize(node)).toBe('Set x to 5. Set y to 10. X plus y')
		})
	})

	describe('Binary operators', () => {
		test('humanize addition', () => {
			const node = ast.add(ast.number(2), ast.number(3))
			expect(humanize(node)).toBe('2 plus 3')
		})

		test('humanize subtraction', () => {
			const node = ast.subtract(ast.number(10), ast.number(5))
			expect(humanize(node)).toBe('10 minus 5')
		})

		test('humanize multiplication', () => {
			const node = ast.multiply(
				ast.identifier('price'),
				ast.identifier('quantity'),
			)
			expect(humanize(node)).toBe('price times quantity')
		})

		test('humanize division', () => {
			const node = ast.divide(ast.number(100), ast.number(4))
			expect(humanize(node)).toBe('100 divided by 4')
		})

		test('humanize modulo', () => {
			const node = ast.modulo(ast.number(10), ast.number(3))
			expect(humanize(node)).toBe('10 modulo 3')
		})

		test('humanize exponentiation', () => {
			const node = ast.exponentiate(ast.number(2), ast.number(8))
			expect(humanize(node)).toBe('2 to the power of 8')
		})
	})

	describe('Comparison operators', () => {
		test('humanize equals', () => {
			const node = ast.equals(ast.identifier('x'), ast.number(5))
			expect(humanize(node)).toBe('x equals 5')
		})

		test('humanize not equals', () => {
			const node = ast.notEquals(ast.identifier('x'), ast.number(0))
			expect(humanize(node)).toBe('x is not equal to 0')
		})

		test('humanize less than', () => {
			const node = ast.lessThan(ast.identifier('age'), ast.number(18))
			expect(humanize(node)).toBe('age is less than 18')
		})

		test('humanize greater than', () => {
			const node = ast.greaterThan(ast.identifier('score'), ast.number(100))
			expect(humanize(node)).toBe('score is greater than 100')
		})

		test('humanize less than or equal', () => {
			const node = ast.lessEqual(ast.identifier('x'), ast.number(10))
			expect(humanize(node)).toBe('x is less than or equal to 10')
		})

		test('humanize greater than or equal', () => {
			const node = ast.greaterEqual(ast.identifier('y'), ast.number(0))
			expect(humanize(node)).toBe('y is greater than or equal to 0')
		})
	})

	describe('Logical operators', () => {
		test('humanize logical AND', () => {
			const node = ast.logicalAnd(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
				ast.lessThan(ast.identifier('x'), ast.number(10)),
			)
			expect(humanize(node)).toBe('x is greater than 5 and x is less than 10')
		})

		test('humanize logical OR', () => {
			const node = ast.logicalOr(
				ast.equals(ast.identifier('status'), ast.number(1)),
				ast.equals(ast.identifier('status'), ast.number(2)),
			)
			expect(humanize(node)).toBe('status equals 1 or status equals 2')
		})

		test('humanize logical NOT with simple operand', () => {
			const node = ast.logicalNot(ast.identifier('active'))
			expect(humanize(node)).toBe('not active')
		})

		test('humanize logical NOT with complex operand', () => {
			const node = ast.logicalNot(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
			)
			expect(humanize(node)).toBe('not x is greater than 5')
		})
	})

	describe('Unary operators', () => {
		test('humanize unary minus on number', () => {
			const node = ast.negate(ast.number(5))
			expect(humanize(node)).toBe('negative 5')
		})

		test('humanize unary minus on identifier', () => {
			const node = ast.negate(ast.identifier('x'))
			expect(humanize(node)).toBe('negative x')
		})

		test('humanize unary minus on complex expression', () => {
			const node = ast.negate(ast.add(ast.identifier('x'), ast.identifier('y')))
			expect(humanize(node)).toBe('the negative of x plus y')
		})
	})

	describe('Function calls', () => {
		test('humanize known function with no arguments', () => {
			const node = ast.functionCall('NOW', [])
			expect(humanize(node)).toBe('the current time')
		})

		test('humanize known function with one argument', () => {
			const node = ast.functionCall('ABS', [ast.negate(ast.number(5))])
			expect(humanize(node)).toBe('the absolute value of negative 5')
		})

		test('humanize known function with two arguments', () => {
			const node = ast.functionCall('MAX', [ast.number(10), ast.number(20)])
			expect(humanize(node)).toBe('the maximum of 10 and 20')
		})

		test('humanize known function with multiple arguments', () => {
			const node = ast.functionCall('MAX', [
				ast.number(5),
				ast.number(10),
				ast.number(15),
			])
			expect(humanize(node)).toBe('the maximum of 5, 10 and 15')
		})

		test('humanize unknown function with no arguments', () => {
			const node = ast.functionCall('CUSTOM', [])
			expect(humanize(node)).toBe('the result of CUSTOM')
		})

		test('humanize unknown function with one argument', () => {
			const node = ast.functionCall('CUSTOM', [ast.number(42)])
			expect(humanize(node)).toBe('the result of CUSTOM with 42')
		})

		test('humanize unknown function with multiple arguments', () => {
			const node = ast.functionCall('CUSTOM', [
				ast.number(1),
				ast.number(2),
				ast.number(3),
			])
			expect(humanize(node)).toBe('the result of CUSTOM with 1, 2 and 3')
		})
	})

	describe('Conditional expressions', () => {
		test('humanize simple conditional', () => {
			const node = ast.conditional(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
				ast.number(100),
				ast.number(50),
			)
			expect(humanize(node)).toBe(
				'if x is greater than 5 then 100, otherwise 50',
			)
		})

		test('humanize nested conditional in consequent', () => {
			const node = ast.conditional(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
				ast.conditional(
					ast.greaterThan(ast.identifier('y'), ast.number(10)),
					ast.number(100),
					ast.number(50),
				),
				ast.number(0),
			)
			expect(humanize(node)).toBe(
				'if x is greater than 5 then if y is greater than 10 then 100, otherwise 50, otherwise 0',
			)
		})

		test('humanize nested conditional in alternate', () => {
			const node = ast.conditional(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
				ast.number(100),
				ast.conditional(
					ast.greaterThan(ast.identifier('y'), ast.number(10)),
					ast.number(50),
					ast.number(0),
				),
			)
			expect(humanize(node)).toBe(
				'if x is greater than 5 then 100, otherwise if y is greater than 10 then 50, otherwise 0',
			)
		})
	})

	describe('Complex expressions', () => {
		test('humanize nested arithmetic operations', () => {
			const node = ast.add(
				ast.multiply(ast.number(2), ast.number(3)),
				ast.number(4),
			)
			expect(humanize(node)).toBe('2 times 3 plus 4')
		})

		test('humanize complex expression with variables', () => {
			const node = ast.multiply(
				ast.add(ast.identifier('price'), ast.identifier('tax')),
				ast.identifier('quantity'),
			)
			expect(humanize(node)).toBe('price plus tax times quantity')
		})

		test('humanize user example from requirements', () => {
			const source =
				'price * quantity > 100 ? (price * quantity - discount) * (1 + tax_rate) : MAX(price * quantity, 50)'
			const node = parseSource(source)
			expect(humanize(node)).toBe(
				'if price times quantity is greater than 100 then price times quantity minus discount times 1 plus tax_rate, otherwise the maximum of price times quantity and 50',
			)
		})
	})

	describe('HTML output', () => {
		test('humanize with html enabled', () => {
			const node = ast.add(ast.number(2), ast.identifier('x'))
			const result = humanize(node, { html: true })
			expect(result).toBe('<span>2</span> <span>plus</span> <span>x</span>')
		})

		test('humanize with custom CSS classes', () => {
			const node = ast.add(ast.number(2), ast.identifier('x'))
			const result = humanize(node, {
				html: true,
				htmlClasses: {
					number: 'num',
					identifier: 'var',
					operator: 'op',
				},
			})
			expect(result).toBe(
				'<span class="num">2</span> <span class="op">plus</span> <span class="var">x</span>',
			)
		})

		test('humanize function call with HTML', () => {
			const node = ast.functionCall('MAX', [ast.number(10), ast.number(20)])
			const result = humanize(node, {
				html: true,
				htmlClasses: {
					function: 'fn',
					number: 'num',
				},
			})
			expect(result).toBe(
				'the maximum of <span class="num">10</span> and <span class="num">20</span>',
			)
		})
	})

	describe('Custom options', () => {
		test('custom operator phrase', () => {
			const node = ast.add(ast.number(2), ast.number(3))
			const result = humanize(node, {
				operatorPhrases: {
					'+': 'added to',
				},
			})
			expect(result).toBe('2 added to 3')
		})

		test('custom function phrase', () => {
			const node = ast.functionCall('CUSTOM_FUNC', [ast.number(42)])
			const result = humanize(node, {
				functionPhrases: {
					CUSTOM_FUNC: 'my custom function of',
				},
			})
			expect(result).toBe('my custom function of 42')
		})

		test('multiple custom phrases', () => {
			const node = ast.conditional(
				ast.greaterThan(ast.identifier('x'), ast.number(5)),
				ast.functionCall('CUSTOM', [ast.identifier('x')]),
				ast.number(0),
			)
			const result = humanize(node, {
				operatorPhrases: {
					'>': 'exceeds',
				},
				functionPhrases: {
					CUSTOM: 'process',
				},
			})
			expect(result).toBe('if x exceeds 5 then process x, otherwise 0')
		})
	})

	describe('Real-world examples', () => {
		test('compound interest formula', () => {
			const source = 'principal * (1 + rate) ^ years'
			const node = parseSource(source)
			expect(humanize(node)).toBe(
				'principal times 1 plus rate to the power of years',
			)
		})

		test('discount calculation', () => {
			const source = 'price * (1 - discount_rate)'
			const node = parseSource(source)
			expect(humanize(node)).toBe('price times 1 minus discount_rate')
		})

		test('tax calculation with conditional', () => {
			const source = 'amount > 1000 ? amount * 0.2 : amount * 0.1'
			const node = parseSource(source)
			expect(humanize(node)).toBe(
				'if amount is greater than 1000 then amount times 0.2, otherwise amount times 0.1',
			)
		})

		test('complex date calculation', () => {
			const source = 'DIFFERENCE_IN_DAYS(deadline, NOW()) < 7'
			const node = parseSource(source)
			expect(humanize(node)).toBe(
				'the difference in days between deadline and the current time is less than 7',
			)
		})

		test('formula with assignment and calculation', () => {
			const source =
				'total = price * quantity; total > 100 ? total * 0.9 : total'
			const node = parseSource(source)
			expect(humanize(node)).toBe(
				'Set total to price times quantity. If total is greater than 100 then total times 0.9, otherwise total',
			)
		})
	})

	describe('Edge cases', () => {
		test('humanize single number in program', () => {
			const node = ast.program([ast.number(42)])
			expect(humanize(node)).toBe('42')
		})

		test('humanize empty MAX call', () => {
			const node = ast.functionCall('MAX', [])
			expect(humanize(node)).toBe('the maximum of')
		})

		test('humanize deeply nested expression', () => {
			const node = ast.add(
				ast.multiply(ast.add(ast.number(1), ast.number(2)), ast.number(3)),
				ast.number(4),
			)
			expect(humanize(node)).toBe('1 plus 2 times 3 plus 4')
		})

		test('humanize chained comparisons', () => {
			const node = ast.logicalAnd(
				ast.greaterThan(ast.identifier('x'), ast.number(0)),
				ast.lessThan(ast.identifier('x'), ast.number(100)),
			)
			expect(humanize(node)).toBe('x is greater than 0 and x is less than 100')
		})
	})
})
