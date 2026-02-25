import { describe, expect, test } from 'bun:test'
import {
	type ASTNode,
	type BinaryOp,
	NodeKind,
	type NumberLiteral,
	type Operator,
	type UnaryOp,
} from '../src/ast'
import { parse } from '../src/parser'

// Helper function to assert node kind and narrow type
function expectKind<T extends NodeKind>(
	node: ASTNode,
	kind: T,
): asserts node is Extract<ASTNode, readonly [T, ...unknown[]]> {
	expect(node[0]).toBe(kind)
}

// Helper to expect a binary operation with specific operator
function expectBinaryOp(
	node: ASTNode,
	operator: Operator,
): asserts node is BinaryOp {
	expectKind(node, NodeKind.BinaryOp)
	expect(node[2]).toBe(operator)
}

// Helper to expect a number literal with specific value
function expectNumber(
	node: ASTNode,
	value: number,
): asserts node is NumberLiteral {
	expectKind(node, NodeKind.NumberLiteral)
	expect(node[1]).toBe(value)
}

// Helper to expect a unary operation with specific operator
function expectUnaryOp(
	node: ASTNode,
	operator: '-' | '!',
): asserts node is UnaryOp {
	expectKind(node, NodeKind.UnaryOp)
	expect(node[1]).toBe(operator)
}

describe('Parser', () => {
	test('parse number literal', () => {
		const node = parse('42')
		expectNumber(node, 42)
	})

	test('parse identifier', () => {
		const node = parse('x')
		expectKind(node, NodeKind.Identifier)
		expect(node[1]).toBe('x')
	})

	test('parse binary operation', () => {
		const node = parse('1 + 2')
		expectBinaryOp(node, '+')
		expectNumber(node[1], 1)
		expectNumber(node[3], 2)
	})

	test('parse operator precedence', () => {
		const node = parse('1 + 2 * 3')
		// Should parse as 1 + (2 * 3)
		expectBinaryOp(node, '+')
		expectNumber(node[1], 1)
		expectBinaryOp(node[3], '*')
	})

	test('parse exponentiation right-associativity', () => {
		// 2 ^ 3 ^ 4 should parse as 2 ^ (3 ^ 4), not (2 ^ 3) ^ 4
		const node = parse('2 ^ 3 ^ 4')
		expectBinaryOp(node, '^')
		expectNumber(node[1], 2)

		// Right side should be another BinaryOp: 3 ^ 4
		const right = node[3]
		expectBinaryOp(right, '^')
		expectNumber(right[1], 3)
		expectNumber(right[3], 4)
	})

	test('parse parentheses', () => {
		const node = parse('(1 + 2) * 3')
		// Should parse as (1 + 2) * 3
		expectBinaryOp(node, '*')

		const left = node[1]
		expectBinaryOp(left, '+')
	})

	test('parse unary minus', () => {
		const node = parse('-42')
		expectUnaryOp(node, '-')
		expectNumber(node[2], 42)
	})

	test('parse unary minus with exponentiation precedence', () => {
		// -2 ^ 2 should parse as -(2 ^ 2), not (-2) ^ 2
		const node = parse('-2 ^ 2')
		expectUnaryOp(node, '-')

		// Argument should be BinaryOp: 2 ^ 2
		const argument = node[2]
		expectBinaryOp(argument, '^')
		expectNumber(argument[1], 2)
		expectNumber(argument[3], 2)
	})

	test('parse unary minus with addition precedence', () => {
		// -2 + 3 should parse as (-2) + 3, not -(2 + 3)
		const node = parse('-2 + 3')
		expectBinaryOp(node, '+')

		// Left side should be UnaryOp: -2
		const left = node[1]
		expectUnaryOp(left, '-')
		expectNumber(left[2], 2)

		// Right side should be NumberLiteral: 3
		expectNumber(node[3], 3)
	})

	test('parse function call without arguments', () => {
		const node = parse('NOW()')
		expectKind(node, NodeKind.FunctionCall)
		expect(node[1]).toBe('NOW')
		expect(node[2].length).toBe(0)
	})

	test('parse function call with arguments', () => {
		const node = parse('ABS(-5)')
		expectKind(node, NodeKind.FunctionCall)
		expect(node[1]).toBe('ABS')
		expect(node[2].length).toBe(1)
	})

	test('parse variable assignment', () => {
		const node = parse('x = 5')
		expectKind(node, NodeKind.Assignment)
		expect(node[1]).toBe('x')
		expectNumber(node[2], 5)
	})

	test('parse complex assignment', () => {
		const node = parse('z = x + y')
		expectKind(node, NodeKind.Assignment)
		expect(node[1]).toBe('z')
		expectBinaryOp(node[2], '+')
	})

	test('parse && operator', () => {
		const node = parse('5 && 3')
		expectBinaryOp(node, '&&')
	})

	test('parse || operator', () => {
		const node = parse('5 || 0')
		expectBinaryOp(node, '||')
	})

	test('ternary error on missing colon', () => {
		expect(() => parse('1 ? 2')).toThrow('Expected : in ternary expression')
	})

	test('parse logical NOT', () => {
		const node = parse('!5')
		expectUnaryOp(node, '!')
		expectNumber(node[2], 5)
	})

	test('parse double NOT', () => {
		const node = parse('!!1')
		expectUnaryOp(node, '!')

		const inner = node[2]
		expectUnaryOp(inner, '!')
		expectNumber(inner[2], 1)
	})

	test('parse NOT with parentheses', () => {
		const node = parse('!(x + y)')
		expectUnaryOp(node, '!')
		expectBinaryOp(node[2], '+')
	})

	test('parse NOT with exponentiation precedence', () => {
		// !2 ^ 2 should parse as !(2 ^ 2), not (!2) ^ 2
		const node = parse('!2 ^ 2')
		expectUnaryOp(node, '!')
		expectBinaryOp(node[2], '^')
	})

	test('parse NOT with addition precedence', () => {
		// !2 + 3 should parse as (!2) + 3, not !(2 + 3)
		const node = parse('!2 + 3')
		expectBinaryOp(node, '+')

		const left = node[1]
		expectUnaryOp(left, '!')
	})

	test('parse NOT with logical AND', () => {
		// !x && y should parse as (!x) && y
		const node = parse('!x && y')
		expectBinaryOp(node, '&&')
		expectUnaryOp(node[1], '!')
	})

	test('parse NOT with comparison', () => {
		// !x == 1 should parse as (!x) == 1
		const node = parse('!x == 1')
		expectBinaryOp(node, '==')
		expectUnaryOp(node[1], '!')
	})

	// Number format tests
	test('parse decimal number', () => {
		const node = parse('123.456')
		expectNumber(node, 123.456)
	})

	test('parse decimal shorthand', () => {
		const node = parse('.5')
		expectNumber(node, 0.5)
	})

	test('parse scientific notation with lowercase e', () => {
		const node = parse('1.5e6')
		expectNumber(node, 1500000)
	})

	test('parse scientific notation with uppercase E', () => {
		const node = parse('2E-3')
		expectNumber(node, 0.002)
	})

	test('parse scientific notation with explicit plus', () => {
		const node = parse('3e+2')
		expectNumber(node, 300)
	})

	test('parse decimal shorthand with scientific notation', () => {
		const node = parse('.5e2')
		expectNumber(node, 50)
	})

	test('parse negative number literal', () => {
		const node = parse('-17')
		expectUnaryOp(node, '-')
		expectNumber(node[2], 17)
	})

	// Comparison operator tests
	test('parse equality operator', () => {
		const node = parse('5 == 5')
		expectBinaryOp(node, '==')
		expectNumber(node[1], 5)
		expectNumber(node[3], 5)
	})

	test('parse not equal operator', () => {
		const node = parse('5 != 3')
		expectBinaryOp(node, '!=')
	})

	test('parse less than operator', () => {
		const node = parse('3 < 5')
		expectBinaryOp(node, '<')
	})

	test('parse greater than operator', () => {
		const node = parse('5 > 3')
		expectBinaryOp(node, '>')
	})

	test('parse less or equal operator', () => {
		const node = parse('3 <= 3')
		expectBinaryOp(node, '<=')
	})

	test('parse greater or equal operator', () => {
		const node = parse('5 >= 3')
		expectBinaryOp(node, '>=')
	})

	// Arithmetic operator tests
	test('parse subtraction', () => {
		const node = parse('10 - 3')
		expectBinaryOp(node, '-')
		expectNumber(node[1], 10)
		expectNumber(node[3], 3)
	})

	test('parse multiplication', () => {
		const node = parse('4 * 3')
		expectBinaryOp(node, '*')
	})

	test('parse division', () => {
		const node = parse('10 / 2')
		expectBinaryOp(node, '/')
	})

	test('parse modulo', () => {
		const node = parse('10 % 3')
		expectBinaryOp(node, '%')
	})

	test('parse exponentiation', () => {
		const node = parse('2 ^ 3')
		expectBinaryOp(node, '^')
		expectNumber(node[1], 2)
		expectNumber(node[3], 3)
	})

	// Ternary operator tests
	test('parse basic ternary', () => {
		const node = parse('1 ? 2 : 3')
		expectKind(node, NodeKind.ConditionalExpression)
		expectNumber(node[1], 1)
		expectNumber(node[2], 2)
		expectNumber(node[3], 3)
	})

	test('parse ternary with comparison condition', () => {
		const node = parse('x > 5 ? 10 : 20')
		expectKind(node, NodeKind.ConditionalExpression)
		expectBinaryOp(node[1], '>')
		expectNumber(node[2], 10)
		expectNumber(node[3], 20)
	})

	test('parse nested ternary (right-associative)', () => {
		// x ? y : z ? a : b should parse as x ? y : (z ? a : b)
		const node = parse('x ? y : z ? a : b')
		expectKind(node, NodeKind.ConditionalExpression)
		expectKind(node[1], NodeKind.Identifier)
		expectKind(node[2], NodeKind.Identifier)

		// Alternate should be another ConditionalExpression
		const alternate = node[3]
		expectKind(alternate, NodeKind.ConditionalExpression)
	})

	test('parse ternary with complex expressions', () => {
		const node = parse('a + b > c ? d * 2 : e / 2')
		expectKind(node, NodeKind.ConditionalExpression)
		expectBinaryOp(node[1], '>')
		expectBinaryOp(node[2], '*')
		expectBinaryOp(node[3], '/')
	})

	// Assignment operator tests
	test('parse chained assignment (right-associative)', () => {
		// a = b = c = 5 should parse as a = (b = (c = 5))
		const node = parse('a = b = c = 5')
		expectKind(node, NodeKind.Assignment)
		expect(node[1]).toBe('a')

		// Value should be another Assignment
		const value = node[2]
		expectKind(value, NodeKind.Assignment)
		expect(value[1]).toBe('b')

		// Nested assignment value
		const nestedValue = value[2]
		expectKind(nestedValue, NodeKind.Assignment)
		expect(nestedValue[1]).toBe('c')
		expectNumber(nestedValue[2], 5)
	})

	test('assignment to non-identifier throws error', () => {
		expect(() => parse('5 = 10')).toThrow()
	})

	test('assignment to expression throws error', () => {
		expect(() => parse('x + y = 10')).toThrow()
	})

	// Function call tests
	test('parse function call with multiple arguments', () => {
		const node = parse('MAX(1, 2, 3)')
		expectKind(node, NodeKind.FunctionCall)
		expect(node[1]).toBe('MAX')
		expect(node[2].length).toBe(3)
		expectNumber(node[2][0]!, 1)
		expectNumber(node[2][1]!, 2)
		expectNumber(node[2][2]!, 3)
	})

	test('parse nested function calls', () => {
		const node = parse('ABS(MIN(-5, -10))')
		expectKind(node, NodeKind.FunctionCall)
		expect(node[1]).toBe('ABS')
		expect(node[2].length).toBe(1)

		const innerCall = node[2][0]!
		expectKind(innerCall, NodeKind.FunctionCall)
		expect(innerCall[1]).toBe('MIN')
	})

	test('parse function call in expression', () => {
		const node = parse('x + ABS(y)')
		expectBinaryOp(node, '+')
		expectKind(node[1], NodeKind.Identifier)
		expectKind(node[3], NodeKind.FunctionCall)
	})

	test('parse function call with complex arguments', () => {
		const node = parse('MAX(x + 1, y * 2, z / 3)')
		expectKind(node, NodeKind.FunctionCall)
		expect(node[2].length).toBe(3)
		expectBinaryOp(node[2][0]!, '+')
		expectBinaryOp(node[2][1]!, '*')
		expectBinaryOp(node[2][2]!, '/')
	})

	// Operator precedence combination tests
	test('parse comparison with logical AND', () => {
		// x > 5 && y < 10 should parse as (x > 5) && (y < 10)
		const node = parse('x > 5 && y < 10')
		expectBinaryOp(node, '&&')
		expectBinaryOp(node[1], '>')
		expectBinaryOp(node[3], '<')
	})

	test('parse comparison with logical OR', () => {
		// x < 0 || x > 100 should parse as (x < 0) || (x > 100)
		const node = parse('x < 0 || x > 100')
		expectBinaryOp(node, '||')
		expectBinaryOp(node[1], '<')
		expectBinaryOp(node[3], '>')
	})

	test('parse logical AND with higher precedence than OR', () => {
		// a || b && c should parse as a || (b && c)
		const node = parse('a || b && c')
		expectBinaryOp(node, '||')
		expectKind(node[1], NodeKind.Identifier)
		expectBinaryOp(node[3], '&&')
	})

	test('parse complex precedence: arithmetic, comparison, logical', () => {
		// x + 5 > 10 && y * 2 < 20 should parse as ((x + 5) > 10) && ((y * 2) < 20)
		const node = parse('x + 5 > 10 && y * 2 < 20')
		expectBinaryOp(node, '&&')

		const left = node[1]
		expectBinaryOp(left, '>')
		expectBinaryOp(left[1], '+')

		const right = node[3]
		expectBinaryOp(right, '<')
		expectBinaryOp(right[1], '*')
	})

	test('parse ternary with lower precedence than logical OR', () => {
		// a || b ? c : d should parse as (a || b) ? c : d
		const node = parse('a || b ? c : d')
		expectKind(node, NodeKind.ConditionalExpression)
		expectBinaryOp(node[1], '||')
	})

	test('parse assignment with lower precedence than ternary', () => {
		// x = a ? b : c should parse as x = (a ? b : c)
		const node = parse('x = a ? b : c')
		expectKind(node, NodeKind.Assignment)
		expectKind(node[2], NodeKind.ConditionalExpression)
	})

	// Multi-statement program tests
	test('parse program with multiple statements', () => {
		const node = parse('x = 5\ny = 10\nx + y')
		expectKind(node, NodeKind.Program)
		expect(node[1].length).toBe(3)

		expectKind(node[1][0]!, NodeKind.Assignment)
		expectKind(node[1][1]!, NodeKind.Assignment)
		expectBinaryOp(node[1][2]!, '+')
	})

	test('parse program with semicolons', () => {
		const node = parse('x = 5; y = 10; x + y')
		expectKind(node, NodeKind.Program)
		expect(node[1].length).toBe(3)
	})

	test('parse program with mixed separators', () => {
		const node = parse('x = 5; y = 10\nz = x + y')
		expectKind(node, NodeKind.Program)
		expect(node[1].length).toBe(3)
	})

	test('parse single statement as expression (not Program)', () => {
		const node = parse('x + y')
		// Single statement should return the expression directly, not wrapped in Program
		expectBinaryOp(node, '+')
	})

	// Edge case tests
	test('parse nested parentheses', () => {
		const node = parse('((1 + 2) * 3)')
		expectBinaryOp(node, '*')
	})

	test('parse complex nested expression', () => {
		const node = parse('(x + y) * (a - b) / (c ^ 2)')
		expectBinaryOp(node, '/')
		expectBinaryOp(node[1], '*')
		expectBinaryOp(node[3], '^')
	})

	test('parse whitespace variations', () => {
		const node1 = parse('1+2')
		const node2 = parse('1 + 2')
		const node3 = parse('1  +  2')

		expectBinaryOp(node1, '+')
		expectBinaryOp(node2, '+')
		expectBinaryOp(node3, '+')
	})

	test('parse expression with trailing whitespace', () => {
		const node = parse('1 + 2   ')
		expectBinaryOp(node, '+')
	})

	test('parse expression with leading whitespace', () => {
		const node = parse('   1 + 2')
		expectBinaryOp(node, '+')
	})

	// String literal tests
	test('parse string literal', () => {
		const node = parse('"hello"')
		expectKind(node, NodeKind.StringLiteral)
		expect(node[1]).toBe('hello')
	})

	test('parse string with escapes', () => {
		const node = parse('"hello\\nworld"')
		expectKind(node, NodeKind.StringLiteral)
		expect(node[1]).toBe('hello\nworld')
	})

	test('parse empty string', () => {
		const node = parse('""')
		expectKind(node, NodeKind.StringLiteral)
		expect(node[1]).toBe('')
	})

	test('parse string concatenation', () => {
		const node = parse('"hello" + " world"')
		expectBinaryOp(node, '+')
		expectKind(node[1], NodeKind.StringLiteral)
		expectKind(node[3], NodeKind.StringLiteral)
	})

	// Boolean literal tests
	test('parse true literal', () => {
		const node = parse('true')
		expectKind(node, NodeKind.BooleanLiteral)
		expect(node[1]).toBe(true)
	})

	test('parse false literal', () => {
		const node = parse('false')
		expectKind(node, NodeKind.BooleanLiteral)
		expect(node[1]).toBe(false)
	})

	test('parse boolean in ternary condition', () => {
		const node = parse('true ? 1 : 0')
		expectKind(node, NodeKind.ConditionalExpression)
		expectKind(node[1], NodeKind.BooleanLiteral)
	})

	test('assignment to true throws error', () => {
		expect(() => parse('true = 5')).toThrow()
	})

	test('assignment to false throws error', () => {
		expect(() => parse('false = 5')).toThrow()
	})

	// Array literal tests
	test('parse empty array', () => {
		const node = parse('[]')
		expectKind(node, NodeKind.ArrayLiteral)
		expect(node[1].length).toBe(0)
	})

	test('parse array with numbers', () => {
		const node = parse('[1, 2, 3]')
		expectKind(node, NodeKind.ArrayLiteral)
		expect(node[1].length).toBe(3)
		expectNumber(node[1][0]!, 1)
		expectNumber(node[1][1]!, 2)
		expectNumber(node[1][2]!, 3)
	})

	test('parse array with strings', () => {
		const node = parse('["a", "b"]')
		expectKind(node, NodeKind.ArrayLiteral)
		expect(node[1].length).toBe(2)
		expectKind(node[1][0]!, NodeKind.StringLiteral)
		expectKind(node[1][1]!, NodeKind.StringLiteral)
	})

	test('parse array with expressions', () => {
		const node = parse('[1 + 2, 3 * 4]')
		expectKind(node, NodeKind.ArrayLiteral)
		expect(node[1].length).toBe(2)
		expectBinaryOp(node[1][0]!, '+')
		expectBinaryOp(node[1][1]!, '*')
	})

	test('parse nested arrays', () => {
		const node = parse('[[1, 2], [3, 4]]')
		expectKind(node, NodeKind.ArrayLiteral)
		expect(node[1].length).toBe(2)
		expectKind(node[1][0]!, NodeKind.ArrayLiteral)
		expectKind(node[1][1]!, NodeKind.ArrayLiteral)
	})
})
