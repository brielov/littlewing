import { describe, expect, test } from 'bun:test'
import * as ast from '../src/ast'
import { isBinaryOp, isConditionalExpression, NodeKind } from '../src/ast'
import { evaluate } from '../src/interpreter'

describe('AST Builders', () => {
	test('manual construction', () => {
		const node = ast.add(ast.number(2), ast.number(3))
		const result = evaluate(node)
		expect(result).toBe(5)
	})

	test('complex expression', () => {
		const node = ast.multiply(
			ast.add(ast.number(2), ast.number(3)),
			ast.number(4),
		)
		const result = evaluate(node)
		expect(result).toBe(20)
	})

	test('with variables', () => {
		const node = ast.assign('x', ast.add(ast.number(2), ast.number(3)))
		const result = evaluate(node)
		expect(result).toBe(5)
	})

	test('function call', () => {
		const node = ast.functionCall('ABS', [ast.negate(ast.number(5))])
		const result = evaluate(node, {
			functions: { ABS: Math.abs },
		})
		expect(result).toBe(5)
	})

	test('unary operator', () => {
		const node = ast.negate(ast.number(5))
		const result = evaluate(node)
		expect(result).toBe(-5)
	})

	test('comparison operator builders', () => {
		const node1 = ast.equals(ast.number(5), ast.number(5))
		expect(isBinaryOp(node1)).toBe(true)
		if (isBinaryOp(node1)) {
			expect(node1[2]).toBe('==')
		}

		const node2 = ast.notEquals(ast.number(5), ast.number(3))
		expect(isBinaryOp(node2)).toBe(true)
		if (isBinaryOp(node2)) {
			expect(node2[2]).toBe('!=')
		}

		const node3 = ast.lessThan(ast.number(3), ast.number(5))
		expect(isBinaryOp(node3)).toBe(true)
		if (isBinaryOp(node3)) {
			expect(node3[2]).toBe('<')
		}

		const node4 = ast.greaterThan(ast.number(5), ast.number(3))
		expect(isBinaryOp(node4)).toBe(true)
		if (isBinaryOp(node4)) {
			expect(node4[2]).toBe('>')
		}

		const node5 = ast.lessEqual(ast.number(3), ast.number(5))
		expect(isBinaryOp(node5)).toBe(true)
		if (isBinaryOp(node5)) {
			expect(node5[2]).toBe('<=')
		}

		const node6 = ast.greaterEqual(ast.number(5), ast.number(3))
		expect(isBinaryOp(node6)).toBe(true)
		if (isBinaryOp(node6)) {
			expect(node6[2]).toBe('>=')
		}
	})

	test('conditional expression builder', () => {
		const node = ast.conditional(
			ast.greaterThan(ast.number(5), ast.number(3)),
			ast.number(100),
			ast.number(50),
		)
		expect(isConditionalExpression(node)).toBe(true)
		if (isConditionalExpression(node)) {
			// Tuple: [kind, condition, consequent, alternate]
			expect(node[0]).toBe(NodeKind.ConditionalExpression)
			expect(node[1]).toBeDefined()
			expect(node[2]).toBeDefined()
			expect(node[3]).toBeDefined()
		}
	})

	test('logicalAnd', () => {
		const node = ast.logicalAnd(ast.number(1), ast.number(1))
		expect(isBinaryOp(node)).toBe(true)
		if (isBinaryOp(node)) {
			expect(node[2]).toBe('&&')
		}
		const result = evaluate(node)
		expect(result).toBe(1)
	})

	test('logicalOr', () => {
		const node = ast.logicalOr(ast.number(0), ast.number(1))
		expect(isBinaryOp(node)).toBe(true)
		if (isBinaryOp(node)) {
			expect(node[2]).toBe('||')
		}
		const result = evaluate(node)
		expect(result).toBe(1)
	})
})
