import { describe, expect, test } from 'bun:test'
import {
	type ASTNode,
	type BinaryOp,
	type ForExpression,
	type IfExpression,
	type IndexAccess,
	NodeKind,
	type NumberLiteral,
	type Operator,
	type RangeExpression,
	type UnaryOp,
} from '../src/ast'
import { parse } from '../src/parser'

// Helper function to assert node kind and narrow type
function expectKind<T extends ASTNode>(
	node: ASTNode,
	kind: T['kind'],
): asserts node is T {
	expect(node.kind).toBe(kind)
}

// Helper to expect a binary operation with specific operator
function expectBinaryOp(
	node: ASTNode,
	operator: Operator,
): asserts node is BinaryOp {
	expectKind<BinaryOp>(node, NodeKind.BinaryOp)
	expect(node.operator).toBe(operator)
}

// Helper to expect a number literal with specific value
function expectNumber(
	node: ASTNode,
	value: number,
): asserts node is NumberLiteral {
	expectKind<NumberLiteral>(node, NodeKind.NumberLiteral)
	expect(node.value).toBe(value)
}

// Helper to expect a unary operation with specific operator
function expectUnaryOp(
	node: ASTNode,
	operator: '-' | '!',
): asserts node is UnaryOp {
	expectKind<UnaryOp>(node, NodeKind.UnaryOp)
	expect(node.operator).toBe(operator)
}

describe('Parser', () => {
	test('parse number literal', () => {
		const node = parse('42')
		expectNumber(node, 42)
	})

	test('parse identifier', () => {
		const node = parse('x')
		expectKind(node, NodeKind.Identifier)
		expect((node as { name: string }).name).toBe('x')
	})

	test('parse binary operation', () => {
		const node = parse('1 + 2')
		expectBinaryOp(node, '+')
		expectNumber((node as BinaryOp).left, 1)
		expectNumber((node as BinaryOp).right, 2)
	})

	test('parse operator precedence', () => {
		const node = parse('1 + 2 * 3')
		// Should parse as 1 + (2 * 3)
		expectBinaryOp(node, '+')
		expectNumber((node as BinaryOp).left, 1)
		expectBinaryOp((node as BinaryOp).right, '*')
	})

	test('parse exponentiation right-associativity', () => {
		// 2 ^ 3 ^ 4 should parse as 2 ^ (3 ^ 4), not (2 ^ 3) ^ 4
		const node = parse('2 ^ 3 ^ 4')
		expectBinaryOp(node, '^')
		expectNumber((node as BinaryOp).left, 2)

		// Right side should be another BinaryOp: 3 ^ 4
		const right = (node as BinaryOp).right
		expectBinaryOp(right, '^')
		expectNumber((right as BinaryOp).left, 3)
		expectNumber((right as BinaryOp).right, 4)
	})

	test('parse parentheses', () => {
		const node = parse('(1 + 2) * 3')
		// Should parse as (1 + 2) * 3
		expectBinaryOp(node, '*')

		const left = (node as BinaryOp).left
		expectBinaryOp(left, '+')
	})

	test('parse unary minus', () => {
		const node = parse('-42')
		expectUnaryOp(node, '-')
		expectNumber((node as UnaryOp).argument, 42)
	})

	test('parse unary minus with exponentiation precedence', () => {
		// -2 ^ 2 should parse as -(2 ^ 2), not (-2) ^ 2
		const node = parse('-2 ^ 2')
		expectUnaryOp(node, '-')

		// Argument should be BinaryOp: 2 ^ 2
		const argument = (node as UnaryOp).argument
		expectBinaryOp(argument, '^')
		expectNumber((argument as BinaryOp).left, 2)
		expectNumber((argument as BinaryOp).right, 2)
	})

	test('parse unary minus with addition precedence', () => {
		// -2 + 3 should parse as (-2) + 3, not -(2 + 3)
		const node = parse('-2 + 3')
		expectBinaryOp(node, '+')

		// Left side should be UnaryOp: -2
		const left = (node as BinaryOp).left
		expectUnaryOp(left, '-')
		expectNumber((left as UnaryOp).argument, 2)

		// Right side should be NumberLiteral: 3
		expectNumber((node as BinaryOp).right, 3)
	})

	test('parse function call without arguments', () => {
		const node = parse('NOW()')
		expectKind(node, NodeKind.FunctionCall)
		expect((node as { name: string }).name).toBe('NOW')
		expect((node as { args: readonly ASTNode[] }).args.length).toBe(0)
	})

	test('parse function call with arguments', () => {
		const node = parse('ABS(-5)')
		expectKind(node, NodeKind.FunctionCall)
		expect((node as { name: string }).name).toBe('ABS')
		expect((node as { args: readonly ASTNode[] }).args.length).toBe(1)
	})

	test('parse variable assignment', () => {
		const node = parse('x = 5')
		expectKind(node, NodeKind.Assignment)
		expect((node as { name: string }).name).toBe('x')
		expectNumber((node as { value: ASTNode }).value, 5)
	})

	test('parse complex assignment', () => {
		const node = parse('z = x + y')
		expectKind(node, NodeKind.Assignment)
		expect((node as { name: string }).name).toBe('z')
		expectBinaryOp((node as { value: ASTNode }).value, '+')
	})

	test('parse && operator', () => {
		const node = parse('5 && 3')
		expectBinaryOp(node, '&&')
	})

	test('parse || operator', () => {
		const node = parse('5 || 0')
		expectBinaryOp(node, '||')
	})

	test('parse logical NOT', () => {
		const node = parse('!5')
		expectUnaryOp(node, '!')
		expectNumber((node as UnaryOp).argument, 5)
	})

	test('parse double NOT', () => {
		const node = parse('!!1')
		expectUnaryOp(node, '!')

		const inner = (node as UnaryOp).argument
		expectUnaryOp(inner, '!')
		expectNumber((inner as UnaryOp).argument, 1)
	})

	test('parse NOT with parentheses', () => {
		const node = parse('!(x + y)')
		expectUnaryOp(node, '!')
		expectBinaryOp((node as UnaryOp).argument, '+')
	})

	test('parse NOT with exponentiation precedence', () => {
		// !2 ^ 2 should parse as !(2 ^ 2), not (!2) ^ 2
		const node = parse('!2 ^ 2')
		expectUnaryOp(node, '!')
		expectBinaryOp((node as UnaryOp).argument, '^')
	})

	test('parse NOT with addition precedence', () => {
		// !2 + 3 should parse as (!2) + 3, not !(2 + 3)
		const node = parse('!2 + 3')
		expectBinaryOp(node, '+')

		const left = (node as BinaryOp).left
		expectUnaryOp(left, '!')
	})

	test('parse NOT with logical AND', () => {
		// !x && y should parse as (!x) && y
		const node = parse('!x && y')
		expectBinaryOp(node, '&&')
		expectUnaryOp((node as BinaryOp).left, '!')
	})

	test('parse NOT with comparison', () => {
		// !x == 1 should parse as (!x) == 1
		const node = parse('!x == 1')
		expectBinaryOp(node, '==')
		expectUnaryOp((node as BinaryOp).left, '!')
	})

	// Number format tests
	test('parse decimal number', () => {
		const node = parse('123.456')
		expectNumber(node, 123.456)
	})

	test('parse negative number literal', () => {
		const node = parse('-17')
		expectUnaryOp(node, '-')
		expectNumber((node as UnaryOp).argument, 17)
	})

	// Comparison operator tests
	test('parse equality operator', () => {
		const node = parse('5 == 5')
		expectBinaryOp(node, '==')
		expectNumber((node as BinaryOp).left, 5)
		expectNumber((node as BinaryOp).right, 5)
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
		expectNumber((node as BinaryOp).left, 10)
		expectNumber((node as BinaryOp).right, 3)
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
		expectNumber((node as BinaryOp).left, 2)
		expectNumber((node as BinaryOp).right, 3)
	})

	// If expression tests
	test('parse basic if expression', () => {
		const node = parse('if true then 2 else 3')
		expectKind(node, NodeKind.IfExpression)
		const ifNode = node as IfExpression
		expectKind(ifNode.condition, NodeKind.BooleanLiteral)
		expectNumber(ifNode.consequent, 2)
		expectNumber(ifNode.alternate, 3)
	})

	test('parse if expression with comparison condition', () => {
		const node = parse('if x > 5 then 10 else 20')
		expectKind(node, NodeKind.IfExpression)
		const ifNode = node as IfExpression
		expectBinaryOp(ifNode.condition, '>')
		expectNumber(ifNode.consequent, 10)
		expectNumber(ifNode.alternate, 20)
	})

	test('parse nested if expression (in alternate)', () => {
		const node = parse('if x then y else if z then a else b')
		expectKind(node, NodeKind.IfExpression)
		const ifNode = node as IfExpression
		expectKind(ifNode.condition, NodeKind.Identifier)
		expectKind(ifNode.consequent, NodeKind.Identifier)
		expectKind(ifNode.alternate, NodeKind.IfExpression)
	})

	test('parse if expression with complex expressions', () => {
		const node = parse('if a + b > c then d * 2 else e / 2')
		expectKind(node, NodeKind.IfExpression)
		const ifNode = node as IfExpression
		expectBinaryOp(ifNode.condition, '>')
		expectBinaryOp(ifNode.consequent, '*')
		expectBinaryOp(ifNode.alternate, '/')
	})

	test('if expression error on missing then', () => {
		expect(() => parse('if true 2 else 3')).toThrow(
			'Expected "then" in if expression',
		)
	})

	test('if expression error on missing else', () => {
		expect(() => parse('if true then 2')).toThrow(
			'Expected "else" in if expression',
		)
	})

	// For expression tests
	test('parse basic for expression', () => {
		const node = parse('for x in [1, 2, 3] then x')
		expectKind(node, NodeKind.ForExpression)
		const forNode = node as ForExpression
		expect(forNode.variable).toBe('x')
		expectKind(forNode.iterable, NodeKind.ArrayLiteral)
		expect(forNode.guard).toBeNull()
		expectKind(forNode.body, NodeKind.Identifier)
	})

	test('parse for expression with when guard', () => {
		const node = parse('for x in arr when x > 0 then x * 2')
		expectKind(node, NodeKind.ForExpression)
		const forNode = node as ForExpression
		expect(forNode.variable).toBe('x')
		expectKind(forNode.iterable, NodeKind.Identifier)
		expect(forNode.guard).not.toBeNull()
		expectBinaryOp(forNode.guard!, '>')
		expectBinaryOp(forNode.body, '*')
	})

	test('for expression error on missing in', () => {
		expect(() => parse('for x [1, 2] then x')).toThrow(
			'Expected "in" in for expression',
		)
	})

	test('for expression error on missing then', () => {
		expect(() => parse('for x in [1, 2] x')).toThrow(
			'Expected "then" in for expression',
		)
	})

	test('for expression error on missing identifier', () => {
		expect(() => parse('for 5 in [1, 2] then x')).toThrow(
			'Expected identifier after "for"',
		)
	})

	// Assignment operator tests
	test('parse chained assignment (right-associative)', () => {
		// a = b = c = 5 should parse as a = (b = (c = 5))
		const node = parse('a = b = c = 5')
		expectKind(node, NodeKind.Assignment)
		const a = node as { name: string; value: ASTNode }
		expect(a.name).toBe('a')

		// Value should be another Assignment
		const bNode = a.value
		expectKind(bNode, NodeKind.Assignment)
		const b = bNode as { name: string; value: ASTNode }
		expect(b.name).toBe('b')

		// Nested assignment value
		const cNode = b.value
		expectKind(cNode, NodeKind.Assignment)
		const c = cNode as { name: string; value: ASTNode }
		expect(c.name).toBe('c')
		expectNumber(c.value, 5)
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
		const fn = node as { name: string; args: readonly ASTNode[] }
		expect(fn.name).toBe('MAX')
		expect(fn.args.length).toBe(3)
		expectNumber(fn.args[0]!, 1)
		expectNumber(fn.args[1]!, 2)
		expectNumber(fn.args[2]!, 3)
	})

	test('parse nested function calls', () => {
		const node = parse('ABS(MIN(-5, -10))')
		expectKind(node, NodeKind.FunctionCall)
		const fn = node as { name: string; args: readonly ASTNode[] }
		expect(fn.name).toBe('ABS')
		expect(fn.args.length).toBe(1)

		const innerCall = fn.args[0]!
		expectKind(innerCall, NodeKind.FunctionCall)
		expect((innerCall as { name: string }).name).toBe('MIN')
	})

	test('parse function call in expression', () => {
		const node = parse('x + ABS(y)')
		expectBinaryOp(node, '+')
		expectKind((node as BinaryOp).left, NodeKind.Identifier)
		expectKind((node as BinaryOp).right, NodeKind.FunctionCall)
	})

	test('parse function call with complex arguments', () => {
		const node = parse('MAX(x + 1, y * 2, z / 3)')
		expectKind(node, NodeKind.FunctionCall)
		const fn = node as { args: readonly ASTNode[] }
		expect(fn.args.length).toBe(3)
		expectBinaryOp(fn.args[0]!, '+')
		expectBinaryOp(fn.args[1]!, '*')
		expectBinaryOp(fn.args[2]!, '/')
	})

	// Operator precedence combination tests
	test('parse comparison with logical AND', () => {
		// x > 5 && y < 10 should parse as (x > 5) && (y < 10)
		const node = parse('x > 5 && y < 10')
		expectBinaryOp(node, '&&')
		expectBinaryOp((node as BinaryOp).left, '>')
		expectBinaryOp((node as BinaryOp).right, '<')
	})

	test('parse comparison with logical OR', () => {
		// x < 0 || x > 100 should parse as (x < 0) || (x > 100)
		const node = parse('x < 0 || x > 100')
		expectBinaryOp(node, '||')
		expectBinaryOp((node as BinaryOp).left, '<')
		expectBinaryOp((node as BinaryOp).right, '>')
	})

	test('parse logical AND with higher precedence than OR', () => {
		// a || b && c should parse as a || (b && c)
		const node = parse('a || b && c')
		expectBinaryOp(node, '||')
		expectKind((node as BinaryOp).left, NodeKind.Identifier)
		expectBinaryOp((node as BinaryOp).right, '&&')
	})

	test('parse complex precedence: arithmetic, comparison, logical', () => {
		// x + 5 > 10 && y * 2 < 20 should parse as ((x + 5) > 10) && ((y * 2) < 20)
		const node = parse('x + 5 > 10 && y * 2 < 20')
		expectBinaryOp(node, '&&')

		const left = (node as BinaryOp).left
		expectBinaryOp(left, '>')
		expectBinaryOp((left as BinaryOp).left, '+')

		const right = (node as BinaryOp).right
		expectBinaryOp(right, '<')
		expectBinaryOp((right as BinaryOp).left, '*')
	})

	test('parse assignment with if expression', () => {
		// x = if a then b else c should parse as x = (if a then b else c)
		const node = parse('x = if a then b else c')
		expectKind(node, NodeKind.Assignment)
		expectKind((node as { value: ASTNode }).value, NodeKind.IfExpression)
	})

	// Multi-statement program tests
	test('parse program with multiple statements', () => {
		const node = parse('x = 5\ny = 10\nx + y')
		expectKind(node, NodeKind.Program)
		const prog = node as { statements: readonly ASTNode[] }
		expect(prog.statements.length).toBe(3)

		expectKind(prog.statements[0]!, NodeKind.Assignment)
		expectKind(prog.statements[1]!, NodeKind.Assignment)
		expectBinaryOp(prog.statements[2]!, '+')
	})

	test('parse program with semicolons', () => {
		const node = parse('x = 5; y = 10; x + y')
		expectKind(node, NodeKind.Program)
		expect((node as { statements: readonly ASTNode[] }).statements.length).toBe(
			3,
		)
	})

	test('parse program with mixed separators', () => {
		const node = parse('x = 5; y = 10\nz = x + y')
		expectKind(node, NodeKind.Program)
		expect((node as { statements: readonly ASTNode[] }).statements.length).toBe(
			3,
		)
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
		expectBinaryOp((node as BinaryOp).left, '*')
		expectBinaryOp((node as BinaryOp).right, '^')
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
		expect((node as { value: string }).value).toBe('hello')
	})

	test('parse string with escapes', () => {
		const node = parse('"hello\\nworld"')
		expectKind(node, NodeKind.StringLiteral)
		expect((node as { value: string }).value).toBe('hello\nworld')
	})

	test('parse empty string', () => {
		const node = parse('""')
		expectKind(node, NodeKind.StringLiteral)
		expect((node as { value: string }).value).toBe('')
	})

	test('parse string concatenation', () => {
		const node = parse('"hello" + " world"')
		expectBinaryOp(node, '+')
		expectKind((node as BinaryOp).left, NodeKind.StringLiteral)
		expectKind((node as BinaryOp).right, NodeKind.StringLiteral)
	})

	// Boolean literal tests
	test('parse true literal', () => {
		const node = parse('true')
		expectKind(node, NodeKind.BooleanLiteral)
		expect((node as { value: boolean }).value).toBe(true)
	})

	test('parse false literal', () => {
		const node = parse('false')
		expectKind(node, NodeKind.BooleanLiteral)
		expect((node as { value: boolean }).value).toBe(false)
	})

	test('parse boolean in if condition', () => {
		const node = parse('if true then 1 else 0')
		expectKind(node, NodeKind.IfExpression)
		expectKind(
			(node as { condition: ASTNode }).condition,
			NodeKind.BooleanLiteral,
		)
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
		expect((node as { elements: readonly ASTNode[] }).elements.length).toBe(0)
	})

	test('parse array with numbers', () => {
		const node = parse('[1, 2, 3]')
		expectKind(node, NodeKind.ArrayLiteral)
		const arr = node as { elements: readonly ASTNode[] }
		expect(arr.elements.length).toBe(3)
		expectNumber(arr.elements[0]!, 1)
		expectNumber(arr.elements[1]!, 2)
		expectNumber(arr.elements[2]!, 3)
	})

	test('parse array with strings', () => {
		const node = parse('["a", "b"]')
		expectKind(node, NodeKind.ArrayLiteral)
		const arr = node as { elements: readonly ASTNode[] }
		expect(arr.elements.length).toBe(2)
		expectKind(arr.elements[0]!, NodeKind.StringLiteral)
		expectKind(arr.elements[1]!, NodeKind.StringLiteral)
	})

	test('parse array with expressions', () => {
		const node = parse('[1 + 2, 3 * 4]')
		expectKind(node, NodeKind.ArrayLiteral)
		const arr = node as { elements: readonly ASTNode[] }
		expect(arr.elements.length).toBe(2)
		expectBinaryOp(arr.elements[0]!, '+')
		expectBinaryOp(arr.elements[1]!, '*')
	})

	test('parse nested arrays', () => {
		const node = parse('[[1, 2], [3, 4]]')
		expectKind(node, NodeKind.ArrayLiteral)
		const arr = node as { elements: readonly ASTNode[] }
		expect(arr.elements.length).toBe(2)
		expectKind(arr.elements[0]!, NodeKind.ArrayLiteral)
		expectKind(arr.elements[1]!, NodeKind.ArrayLiteral)
	})

	// Bracket indexing tests
	test('parse bracket indexing', () => {
		const node = parse('arr[0]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectKind(idx.object, NodeKind.Identifier)
		expectNumber(idx.index, 0)
	})

	test('parse bracket indexing with negative index', () => {
		const node = parse('arr[-1]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectKind(idx.object, NodeKind.Identifier)
		expectUnaryOp(idx.index, '-')
	})

	test('parse chained bracket indexing', () => {
		const node = parse('arr[0][1]')
		expectKind(node, NodeKind.IndexAccess)
		const outer = node as IndexAccess
		expectNumber(outer.index, 1)
		expectKind(outer.object, NodeKind.IndexAccess)
		const inner = outer.object as IndexAccess
		expectKind(inner.object, NodeKind.Identifier)
		expectNumber(inner.index, 0)
	})

	test('parse function call followed by indexing', () => {
		const node = parse('f()[0]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectKind(idx.object, NodeKind.FunctionCall)
		expectNumber(idx.index, 0)
	})

	test('parse indexing with expression', () => {
		const node = parse('arr[x + 1]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectBinaryOp(idx.index, '+')
	})

	test('parse binary op result indexing', () => {
		const node = parse('(a + b)[0]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectBinaryOp(idx.object, '+')
		expectNumber(idx.index, 0)
	})

	// Range expression tests
	test('parse exclusive range', () => {
		const node = parse('1..5')
		expectKind(node, NodeKind.RangeExpression)
		const range = node as RangeExpression
		expectNumber(range.start, 1)
		expectNumber(range.end, 5)
		expect(range.inclusive).toBe(false)
	})

	test('parse inclusive range', () => {
		const node = parse('1..=5')
		expectKind(node, NodeKind.RangeExpression)
		const range = node as RangeExpression
		expectNumber(range.start, 1)
		expectNumber(range.end, 5)
		expect(range.inclusive).toBe(true)
	})

	test('parse range with arithmetic (range lower precedence than add)', () => {
		// 1 + 2..3 + 4 should parse as (1 + 2)..(3 + 4)
		const node = parse('1 + 2..3 + 4')
		expectKind(node, NodeKind.RangeExpression)
		const range = node as RangeExpression
		expectBinaryOp(range.start, '+')
		expectBinaryOp(range.end, '+')
	})

	test('parse range indexing', () => {
		// (1..=3)[0] — range then index
		const node = parse('(1..=3)[0]')
		expectKind(node, NodeKind.IndexAccess)
		const idx = node as IndexAccess
		expectKind(idx.object, NodeKind.RangeExpression)
		expectNumber(idx.index, 0)
	})
})
