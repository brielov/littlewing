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

	test('parse exponentiation right-associativity', () => {
		// 2 ^ 3 ^ 4 should parse as 2 ^ (3 ^ 4), not (2 ^ 3) ^ 4
		const node = parseSource('2 ^ 3 ^ 4')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('^')
		expect(binaryNode.left.type).toBe('NumberLiteral')
		expect((binaryNode.left as NumberLiteral).value).toBe(2)
		// Right side should be another BinaryOp: 3 ^ 4
		expect(isBinaryOp(binaryNode.right)).toBe(true)
		const rightNode = binaryNode.right as BinaryOp
		expect(rightNode.operator).toBe('^')
		expect((rightNode.left as NumberLiteral).value).toBe(3)
		expect((rightNode.right as NumberLiteral).value).toBe(4)
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

	test('parse unary minus with exponentiation precedence', () => {
		// -2 ^ 2 should parse as -(2 ^ 2), not (-2) ^ 2
		const node = parseSource('-2 ^ 2')
		expect(isUnaryOp(node)).toBe(true)
		const unaryNode = node as import('../src').UnaryOp
		expect(unaryNode.operator).toBe('-')
		// Argument should be BinaryOp: 2 ^ 2
		expect(isBinaryOp(unaryNode.argument)).toBe(true)
		const binaryNode = unaryNode.argument as BinaryOp
		expect(binaryNode.operator).toBe('^')
		expect((binaryNode.left as NumberLiteral).value).toBe(2)
		expect((binaryNode.right as NumberLiteral).value).toBe(2)
	})

	test('parse unary minus with addition precedence', () => {
		// -2 + 3 should parse as (-2) + 3, not -(2 + 3)
		const node = parseSource('-2 + 3')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('+')
		// Left side should be UnaryOp: -2
		expect(isUnaryOp(binaryNode.left)).toBe(true)
		const leftUnary = binaryNode.left as import('../src').UnaryOp
		expect(leftUnary.operator).toBe('-')
		expect((leftUnary.argument as NumberLiteral).value).toBe(2)
		// Right side should be NumberLiteral: 3
		expect((binaryNode.right as NumberLiteral).value).toBe(3)
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

	test('parse logical NOT', () => {
		const node = parseSource('!5')
		expect(isUnaryOp(node)).toBe(true)
		const unaryNode = node as import('../src').UnaryOp
		expect(unaryNode.operator).toBe('!')
		expect(unaryNode.argument.type).toBe('NumberLiteral')
		expect((unaryNode.argument as NumberLiteral).value).toBe(5)
	})

	test('parse double NOT', () => {
		const node = parseSource('!!1')
		expect(isUnaryOp(node)).toBe(true)
		const outerUnary = node as import('../src').UnaryOp
		expect(outerUnary.operator).toBe('!')
		expect(isUnaryOp(outerUnary.argument)).toBe(true)
		const innerUnary = outerUnary.argument as import('../src').UnaryOp
		expect(innerUnary.operator).toBe('!')
		expect((innerUnary.argument as NumberLiteral).value).toBe(1)
	})

	test('parse NOT with parentheses', () => {
		const node = parseSource('!(x + y)')
		expect(isUnaryOp(node)).toBe(true)
		const unaryNode = node as import('../src').UnaryOp
		expect(unaryNode.operator).toBe('!')
		expect(isBinaryOp(unaryNode.argument)).toBe(true)
		expect((unaryNode.argument as BinaryOp).operator).toBe('+')
	})

	test('parse NOT with exponentiation precedence', () => {
		// !2 ^ 2 should parse as !(2 ^ 2), not (!2) ^ 2
		const node = parseSource('!2 ^ 2')
		expect(isUnaryOp(node)).toBe(true)
		const unaryNode = node as import('../src').UnaryOp
		expect(unaryNode.operator).toBe('!')
		expect(isBinaryOp(unaryNode.argument)).toBe(true)
		const binaryNode = unaryNode.argument as BinaryOp
		expect(binaryNode.operator).toBe('^')
	})

	test('parse NOT with addition precedence', () => {
		// !2 + 3 should parse as (!2) + 3, not !(2 + 3)
		const node = parseSource('!2 + 3')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('+')
		expect(isUnaryOp(binaryNode.left)).toBe(true)
		const leftUnary = binaryNode.left as import('../src').UnaryOp
		expect(leftUnary.operator).toBe('!')
	})

	test('parse NOT with logical AND', () => {
		// !x && y should parse as (!x) && y
		const node = parseSource('!x && y')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('&&')
		expect(isUnaryOp(binaryNode.left)).toBe(true)
	})

	test('parse NOT with comparison', () => {
		// !x == 1 should parse as (!x) == 1
		const node = parseSource('!x == 1')
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('==')
		expect(isUnaryOp(binaryNode.left)).toBe(true)
	})
})
