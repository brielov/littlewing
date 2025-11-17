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
			// Tuple: [kind, left, operator, right]
			expect(ast1[2]).toBe('&&')
			expect(isBinaryOp(ast1[1])).toBe(true)
			expect(isBinaryOp(ast1[3])).toBe(true)
			if (isBinaryOp(ast1[1])) {
				expect(ast1[1][2]).toBe('>')
			}
			if (isBinaryOp(ast1[3])) {
				expect(ast1[3][2]).toBe('>')
			}
		}
	})

	test('logical operators vs ternary', () => {
		// Ternary (1.5) has lower precedence than logical (1.75)
		// So: 1 && 1 ? 100 : 50 should parse as (1 && 1) ? 100 : 50
		const ast1 = parse('1 && 1 ? 100 : 50')
		expect(isConditionalExpression(ast1)).toBe(true)
		if (isConditionalExpression(ast1)) {
			// Tuple: [kind, condition, consequent, alternate]
			const condition = ast1[1]
			expect(isBinaryOp(condition)).toBe(true)
			if (isBinaryOp(condition)) {
				expect(condition[2]).toBe('&&')
			}
		}
	})

	test('logical operators vs assignment', () => {
		// Assignment (1) has lower precedence than logical (1.75)
		// So: x = 1 && 0 should parse as x = (1 && 0)
		const ast1 = parse('x = 1 && 0')
		expect(isAssignment(ast1)).toBe(true)
		if (isAssignment(ast1)) {
			// Tuple: [kind, name, value]
			const value = ast1[2]
			expect(isBinaryOp(value)).toBe(true)
			if (isBinaryOp(value)) {
				expect(value[2]).toBe('&&')
			}
		}
	})
})
