import { describe, expect, test } from 'bun:test'
import type { BinaryOp } from '../src'
import { ast, Executor, isBinaryOp } from '../src'

describe('AST Builders', () => {
	test('manual construction', () => {
		const node = ast.add(ast.number(2), ast.number(3))
		const executor = new Executor()
		const result = executor.execute(node)
		expect(result).toBe(5)
	})

	test('complex expression', () => {
		const node = ast.multiply(
			ast.add(ast.number(2), ast.number(3)),
			ast.number(4),
		)
		const executor = new Executor()
		const result = executor.execute(node)
		expect(result).toBe(20)
	})

	test('with variables', () => {
		const node = ast.assign('x', ast.add(ast.number(2), ast.number(3)))
		const executor = new Executor()
		const result = executor.execute(node)
		expect(result).toBe(5)
	})

	test('function call', () => {
		const node = ast.functionCall('ABS', [ast.negate(ast.number(5))])
		const executor = new Executor({
			functions: { ABS: Math.abs },
		})
		const result = executor.execute(node)
		expect(result).toBe(5)
	})

	test('unary operator', () => {
		const node = ast.negate(ast.number(5))
		const executor = new Executor()
		const result = executor.execute(node)
		expect(result).toBe(-5)
	})

	test('comparison operator builders', () => {
		const node1 = ast.equals(ast.number(5), ast.number(5))
		expect(isBinaryOp(node1)).toBe(true)
		expect((node1 as BinaryOp).operator).toBe('==')

		const node2 = ast.notEquals(ast.number(5), ast.number(3))
		expect(isBinaryOp(node2)).toBe(true)
		expect((node2 as BinaryOp).operator).toBe('!=')

		const node3 = ast.lessThan(ast.number(3), ast.number(5))
		expect(isBinaryOp(node3)).toBe(true)
		expect((node3 as BinaryOp).operator).toBe('<')

		const node4 = ast.greaterThan(ast.number(5), ast.number(3))
		expect(isBinaryOp(node4)).toBe(true)
		expect((node4 as BinaryOp).operator).toBe('>')

		const node5 = ast.lessEqual(ast.number(3), ast.number(5))
		expect(isBinaryOp(node5)).toBe(true)
		expect((node5 as BinaryOp).operator).toBe('<=')

		const node6 = ast.greaterEqual(ast.number(5), ast.number(3))
		expect(isBinaryOp(node6)).toBe(true)
		expect((node6 as BinaryOp).operator).toBe('>=')
	})

	test('conditional expression builder', () => {
		const node = ast.conditional(
			ast.greaterThan(ast.number(5), ast.number(3)),
			ast.number(100),
			ast.number(50),
		)
		expect(node.type).toBe('ConditionalExpression')
		expect(node.condition).toBeDefined()
		expect(node.consequent).toBeDefined()
		expect(node.alternate).toBeDefined()
	})

	test('logicalAnd', () => {
		const node = ast.logicalAnd(ast.number(1), ast.number(1))
		expect(node.type).toBe('BinaryOp')
		expect(node.operator).toBe('&&')
		const result = new Executor().execute(node)
		expect(result).toBe(1)
	})

	test('logicalOr', () => {
		const node = ast.logicalOr(ast.number(0), ast.number(1))
		expect(node.type).toBe('BinaryOp')
		expect(node.operator).toBe('||')
		const result = new Executor().execute(node)
		expect(result).toBe(1)
	})
})
