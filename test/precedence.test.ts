import { describe, expect, test } from 'bun:test'
import { isAssignment, isBinaryOp, isConditionalExpression } from '../src/ast'
import { parse } from '../src/parser'

describe('Precedence', () => {
	test('logical operators vs comparison', () => {
		// Comparison (2) has higher precedence than logical (1.75)
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

	test('logical operators vs ternary', () => {
		// Ternary (1.5) has lower precedence than logical (1.75)
		// So: 1 && 1 ? 100 : 50 should parse as (1 && 1) ? 100 : 50
		const ast1 = parse('1 && 1 ? 100 : 50')
		expect(isConditionalExpression(ast1)).toBe(true)
		if (isConditionalExpression(ast1)) {
			const condition = ast1.condition
			expect(isBinaryOp(condition)).toBe(true)
			if (isBinaryOp(condition)) {
				expect(condition.operator).toBe('&&')
			}
		}
	})

	test('logical operators vs assignment', () => {
		// Assignment (1) has lower precedence than logical (1.75)
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
})
