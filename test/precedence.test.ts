import { describe, expect, test } from 'bun:test'
import { isAssignment, isBinaryOp, isIfExpression } from '../src/ast'
import { parse } from '../src/parser'

describe('Precedence', () => {
	test('logical operators vs comparison', () => {
		// Comparison has higher precedence than logical
		// So: 5 > 3 && 10 > 8 should parse as (5 > 3) && (10 > 8)
		const ast1 = parse('5 > 3 && 10 > 8')
		expect(isBinaryOp(ast1)).toBe(true)
		if (isBinaryOp(ast1)) {
			expect(ast1.operator).toBe('&&')
			expect(isBinaryOp(ast1.left)).toBe(true)
			expect(isBinaryOp(ast1.right)).toBe(true)
			if (isBinaryOp(ast1.left)) {
				expect(ast1.left.operator).toBe('>')
			}
			if (isBinaryOp(ast1.right)) {
				expect(ast1.right.operator).toBe('>')
			}
		}
	})

	test('logical operators vs assignment', () => {
		// Assignment has lower precedence than logical
		// So: x = 1 && 0 should parse as x = (1 && 0)
		const ast1 = parse('x = 1 && 0')
		expect(isAssignment(ast1)).toBe(true)
		if (isAssignment(ast1)) {
			const value = ast1.value
			expect(isBinaryOp(value)).toBe(true)
			if (isBinaryOp(value)) {
				expect(value.operator).toBe('&&')
			}
		}
	})

	test('if expression as prefix does not need precedence', () => {
		// if expressions are prefix, not infix — they parse the full sub-expression
		const ast1 = parse('if true then 1 else 2')
		expect(isIfExpression(ast1)).toBe(true)
	})
})
