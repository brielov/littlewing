import { describe, expect, test } from 'bun:test'
import type { Assignment, BinaryOp, ConditionalExpression } from '../src'
import {
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	parseSource,
} from '../src'

describe('Precedence', () => {
	test('logical operators vs comparison', () => {
		// Comparison (2) has higher precedence than logical (1.75)
		// So: 5 > 3 && 10 > 8 should parse as (5 > 3) && (10 > 8)
		const ast1 = parseSource('5 > 3 && 10 > 8')
		expect(isBinaryOp(ast1)).toBe(true)
		const binaryNode = ast1 as BinaryOp
		expect(binaryNode.operator).toBe('&&')
		expect(isBinaryOp(binaryNode.left)).toBe(true)
		expect(isBinaryOp(binaryNode.right)).toBe(true)
		expect((binaryNode.left as BinaryOp).operator).toBe('>')
		expect((binaryNode.right as BinaryOp).operator).toBe('>')
	})

	test('logical operators vs ternary', () => {
		// Ternary (1.5) has lower precedence than logical (1.75)
		// So: 1 && 1 ? 100 : 50 should parse as (1 && 1) ? 100 : 50
		const ast1 = parseSource('1 && 1 ? 100 : 50')
		expect(isConditionalExpression(ast1)).toBe(true)
		const condNode = ast1 as ConditionalExpression
		expect(isBinaryOp(condNode.condition)).toBe(true)
		expect((condNode.condition as BinaryOp).operator).toBe('&&')
	})

	test('logical operators vs assignment', () => {
		// Assignment (1) has lower precedence than logical (1.75)
		// So: x = 1 && 0 should parse as x = (1 && 0)
		const ast1 = parseSource('x = 1 && 0')
		expect(isAssignment(ast1)).toBe(true)
		const assignNode = ast1 as Assignment
		expect(isBinaryOp(assignNode.value)).toBe(true)
		expect((assignNode.value as BinaryOp).operator).toBe('&&')
	})
})
