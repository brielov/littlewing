import { describe, expect, test } from 'bun:test'
import * as ast from '../src/ast'
import {
	isArrayLiteral,
	isBinaryOp,
	isBooleanLiteral,
	isConditionalExpression,
	isStringLiteral,
	NodeKind,
} from '../src/ast'
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
			functions: {
				ABS: (x) => {
					if (typeof x !== 'number') throw new TypeError('expected number')
					return Math.abs(x)
				},
			},
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
			expect(node1.operator).toBe('==')
		}

		const node2 = ast.notEquals(ast.number(5), ast.number(3))
		expect(isBinaryOp(node2)).toBe(true)
		if (isBinaryOp(node2)) {
			expect(node2.operator).toBe('!=')
		}

		const node3 = ast.lessThan(ast.number(3), ast.number(5))
		expect(isBinaryOp(node3)).toBe(true)
		if (isBinaryOp(node3)) {
			expect(node3.operator).toBe('<')
		}

		const node4 = ast.greaterThan(ast.number(5), ast.number(3))
		expect(isBinaryOp(node4)).toBe(true)
		if (isBinaryOp(node4)) {
			expect(node4.operator).toBe('>')
		}

		const node5 = ast.lessEqual(ast.number(3), ast.number(5))
		expect(isBinaryOp(node5)).toBe(true)
		if (isBinaryOp(node5)) {
			expect(node5.operator).toBe('<=')
		}

		const node6 = ast.greaterEqual(ast.number(5), ast.number(3))
		expect(isBinaryOp(node6)).toBe(true)
		if (isBinaryOp(node6)) {
			expect(node6.operator).toBe('>=')
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
			expect(node.kind).toBe(NodeKind.ConditionalExpression)
			expect(node.condition).toBeDefined()
			expect(node.consequent).toBeDefined()
			expect(node.alternate).toBeDefined()
		}
	})

	test('logicalAnd', () => {
		const node = ast.logicalAnd(ast.boolean(true), ast.boolean(true))
		expect(isBinaryOp(node)).toBe(true)
		if (isBinaryOp(node)) {
			expect(node.operator).toBe('&&')
		}
		const result = evaluate(node)
		expect(result).toBe(true)
	})

	test('logicalOr', () => {
		const node = ast.logicalOr(ast.boolean(false), ast.boolean(true))
		expect(isBinaryOp(node)).toBe(true)
		if (isBinaryOp(node)) {
			expect(node.operator).toBe('||')
		}
		const result = evaluate(node)
		expect(result).toBe(true)
	})

	test('string builder', () => {
		const node = ast.string('hello')
		expect(isStringLiteral(node)).toBe(true)
		if (isStringLiteral(node)) {
			expect(node.kind).toBe(NodeKind.StringLiteral)
			expect(node.value).toBe('hello')
		}
	})

	test('boolean builder', () => {
		const nodeTrue = ast.boolean(true)
		expect(isBooleanLiteral(nodeTrue)).toBe(true)
		if (isBooleanLiteral(nodeTrue)) {
			expect(nodeTrue.kind).toBe(NodeKind.BooleanLiteral)
			expect(nodeTrue.value).toBe(true)
		}

		const nodeFalse = ast.boolean(false)
		expect(isBooleanLiteral(nodeFalse)).toBe(true)
		if (isBooleanLiteral(nodeFalse)) {
			expect(nodeFalse.value).toBe(false)
		}
	})

	test('array builder', () => {
		const node = ast.array([ast.number(1), ast.number(2), ast.number(3)])
		expect(isArrayLiteral(node)).toBe(true)
		if (isArrayLiteral(node)) {
			expect(node.kind).toBe(NodeKind.ArrayLiteral)
			expect(node.elements.length).toBe(3)
		}
	})

	test('logicalNot builder', () => {
		const node = ast.logicalNot(ast.boolean(true))
		expect(node.kind).toBe(NodeKind.UnaryOp)
		expect(node.operator).toBe('!')
		const result = evaluate(node)
		expect(result).toBe(false)
	})
})
