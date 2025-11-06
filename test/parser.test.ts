import { describe, expect, test } from 'bun:test'
import type { BinaryOp, NumberLiteral } from '../src'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isUnaryOp,
	parseSource,
} from '../src'

describe('Parser', () => {
	test('parse number literal', () => {
		const node = parseSource('42')
		expect(isNumberLiteral(node)).toBe(true)
		const numberNode = node as NumberLiteral
		expect(numberNode.value).toBe(42)
	})

	test('parse identifier', () => {
		const node = parseSource('x')
		expect(isIdentifier(node)).toBe(true)
		expect((node as { name: string }).name).toBe('x')
	})

	test('parse binary operation', () => {
		const node = parseSource('1 + 2')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('+')
		expect(binaryNode.left.type).toBe('NumberLiteral')
		expect(binaryNode.right.type).toBe('NumberLiteral')
	})

	test('parse operator precedence', () => {
		const node = parseSource('1 + 2 * 3')
		// Should parse as 1 + (2 * 3)
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('+')
		expect(binaryNode.right.type).toBe('BinaryOp')
		expect(isBinaryOp(binaryNode.right)).toBe(true)
		expect((binaryNode.right as BinaryOp).operator).toBe('*')
	})

	test('parse parentheses', () => {
		const node = parseSource('(1 + 2) * 3')
		// Should parse as (1 + 2) * 3
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('*')
		expect(binaryNode.left.type).toBe('BinaryOp')
		expect(isBinaryOp(binaryNode.left)).toBe(true)
		expect((binaryNode.left as BinaryOp).operator).toBe('+')
	})

	test('parse unary minus', () => {
		const node = parseSource('-42')
		expect(isUnaryOp(node)).toBe(true)
		const unaryNode = node as {
			operator: string
			argument: { type: string; value?: number }
		}
		expect(unaryNode.operator).toBe('-')
		expect(unaryNode.argument.type).toBe('NumberLiteral')
		expect(
			isNumberLiteral(unaryNode.argument as import('../src').ASTNode),
		).toBe(true)
		expect((unaryNode.argument as NumberLiteral).value).toBe(42)
	})

	test('parse function call without arguments', () => {
		const node = parseSource('NOW()')
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as { name: string; arguments: unknown[] }
		expect(funcNode.name).toBe('NOW')
		expect(funcNode.arguments.length).toBe(0)
	})

	test('parse function call with arguments', () => {
		const node = parseSource('ABS(-5)')
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as { name: string; arguments: unknown[] }
		expect(funcNode.name).toBe('ABS')
		expect(funcNode.arguments.length).toBe(1)
	})

	test('parse variable assignment', () => {
		const node = parseSource('x = 5')
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as { name: string; value: { type: string } }
		expect(assignNode.name).toBe('x')
		expect(assignNode.value.type).toBe('NumberLiteral')
	})

	test('parse complex assignment', () => {
		const node = parseSource('z = x + y')
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as { name: string; value: { type: string } }
		expect(assignNode.name).toBe('z')
		expect(assignNode.value.type).toBe('BinaryOp')
	})

	test('parse && operator', () => {
		const ast = parseSource('5 && 3')
		expect(isBinaryOp(ast)).toBe(true)
		expect((ast as BinaryOp).operator).toBe('&&')
	})

	test('parse || operator', () => {
		const ast = parseSource('5 || 0')
		expect(isBinaryOp(ast)).toBe(true)
		expect((ast as BinaryOp).operator).toBe('||')
	})

	test('ternary error on missing colon', () => {
		expect(() => parseSource('1 ? 2')).toThrow(
			'Expected : in ternary expression',
		)
	})
})
