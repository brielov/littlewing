import { describe, expect, test } from 'bun:test'
import { ast, Executor, execute, generate, parseSource } from '../src'
import { CodeGenerator } from '../src/codegen'

describe('CodeGenerator', () => {
	test('generate number literal', () => {
		const node = ast.number(42)
		const code = generate(node)
		expect(code).toBe('42')
	})

	test('decimal shorthand normalizes to standard form', () => {
		const ast1 = parseSource('.2')
		const code1 = generate(ast1)
		expect(code1).toBe('0.2')

		const ast2 = parseSource('.5 + .3')
		const code2 = generate(ast2)
		expect(code2).toBe('0.5 + 0.3')

		const ast3 = parseSource('x = .25')
		const code3 = generate(ast3)
		expect(code3).toBe('x = 0.25')
	})

	test('generate identifier', () => {
		const node = ast.identifier('x')
		const code = generate(node)
		expect(code).toBe('x')
	})

	test('generate simple binary operation', () => {
		const node = ast.add(ast.number(2), ast.number(3))
		const code = generate(node)
		expect(code).toBe('2 + 3')
	})

	test('generate binary operation with proper spacing', () => {
		const node = ast.subtract(ast.number(10), ast.number(5))
		const code = generate(node)
		expect(code).toBe('10 - 5')
	})

	test('generate multiplication', () => {
		const node = ast.multiply(ast.number(3), ast.number(4))
		const code = generate(node)
		expect(code).toBe('3 * 4')
	})

	test('generate division', () => {
		const node = ast.divide(ast.number(10), ast.number(2))
		const code = generate(node)
		expect(code).toBe('10 / 2')
	})

	test('generate modulo', () => {
		const node = ast.modulo(ast.number(10), ast.number(3))
		const code = generate(node)
		expect(code).toBe('10 % 3')
	})

	test('generate exponentiation', () => {
		const node = ast.exponentiate(ast.number(2), ast.number(3))
		const code = generate(node)
		expect(code).toBe('2 ^ 3')
	})

	test('generate unary minus', () => {
		const node = ast.negate(ast.number(5))
		const code = generate(node)
		expect(code).toBe('-5')
	})

	test('generate unary minus with binary operation', () => {
		const node = ast.negate(ast.add(ast.number(2), ast.number(3)))
		const code = generate(node)
		expect(code).toBe('-(2 + 3)')
	})

	test('generate function call without arguments', () => {
		const node = ast.functionCall('NOW')
		const code = generate(node)
		expect(code).toBe('NOW()')
	})

	test('generate function call with single argument', () => {
		const node = ast.functionCall('ABS', [ast.negate(ast.number(5))])
		const code = generate(node)
		expect(code).toBe('ABS(-5)')
	})

	test('generate function call with multiple arguments', () => {
		const node = ast.functionCall('MAX', [
			ast.number(1),
			ast.number(5),
			ast.number(3),
		])
		const code = generate(node)
		expect(code).toBe('MAX(1, 5, 3)')
	})

	test('generate variable assignment', () => {
		const node = ast.assign('x', ast.number(5))
		const code = generate(node)
		expect(code).toBe('x = 5')
	})

	test('generate complex assignment', () => {
		const node = ast.assign(
			'z',
			ast.add(ast.identifier('x'), ast.identifier('y')),
		)
		const code = generate(node)
		expect(code).toBe('z = x + y')
	})

	test('precedence - multiply binds tighter than add', () => {
		const node = ast.add(
			ast.number(1),
			ast.multiply(ast.number(2), ast.number(3)),
		)
		const code = generate(node)
		expect(code).toBe('1 + 2 * 3')
	})

	test('precedence - add on left needs parens', () => {
		const node = ast.multiply(
			ast.add(ast.number(1), ast.number(2)),
			ast.number(3),
		)
		const code = generate(node)
		expect(code).toBe('(1 + 2) * 3')
	})

	test('precedence - power binds tighter than multiply', () => {
		const node = ast.multiply(
			ast.number(2),
			ast.exponentiate(ast.number(3), ast.number(2)),
		)
		const code = generate(node)
		expect(code).toBe('2 * 3 ^ 2')
	})

	test('precedence - nested operations', () => {
		const node = ast.add(
			ast.multiply(ast.number(2), ast.number(3)),
			ast.divide(ast.number(10), ast.number(2)),
		)
		const code = generate(node)
		expect(code).toBe('2 * 3 + 10 / 2')
	})

	test('precedence - subtract left side', () => {
		const node = ast.subtract(
			ast.add(ast.number(10), ast.number(5)),
			ast.number(3),
		)
		const code = generate(node)
		expect(code).toBe('10 + 5 - 3')
	})

	test('precedence - subtract right side', () => {
		const node = ast.subtract(
			ast.number(10),
			ast.subtract(ast.number(5), ast.number(2)),
		)
		const code = generate(node)
		expect(code).toBe('10 - (5 - 2)')
	})

	test('precedence - divide right side needs parens', () => {
		const node = ast.divide(
			ast.number(20),
			ast.multiply(ast.number(2), ast.number(5)),
		)
		const code = generate(node)
		expect(code).toBe('20 / (2 * 5)')
	})

	test('precedence - exponentiation is right associative', () => {
		const node = ast.exponentiate(
			ast.number(2),
			ast.exponentiate(ast.number(3), ast.number(2)),
		)
		const code = generate(node)
		expect(code).toBe('2 ^ 3 ^ 2')
	})

	test('precedence - left exponentiation needs parens', () => {
		const node = ast.exponentiate(
			ast.exponentiate(ast.number(2), ast.number(3)),
			ast.number(2),
		)
		const code = generate(node)
		expect(code).toBe('(2 ^ 3) ^ 2')
	})

	test('precedence - unary minus on left of exponentiation needs parens', () => {
		// (-2) ^ 2 = 4, but -2 ^ 2 = -4
		// When UnaryOp is the base of exponentiation, we need parens
		const node = ast.exponentiate(ast.unaryOp(ast.number(2)), ast.number(2))
		const code = generate(node)
		expect(code).toBe('(-2) ^ 2')
	})

	test('precedence - unary minus wraps exponentiation', () => {
		// -2 ^ 2 should generate as -(2 ^ 2)
		const node = ast.unaryOp(ast.exponentiate(ast.number(2), ast.number(2)))
		const code = generate(node)
		expect(code).toBe('-(2 ^ 2)')
	})

	test('round-trip simple expression', () => {
		const source = '2 + 3'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const result1 = new Executor().execute(ast1)
		const result2 = new Executor().execute(ast2)
		expect(result1).toBe(result2)
	})

	test('round-trip with precedence', () => {
		const source = '2 + 3 * 4'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const result1 = new Executor().execute(ast1)
		const result2 = new Executor().execute(ast2)
		expect(result1).toBe(result2)
	})

	test('round-trip with parentheses', () => {
		const source = '(2 + 3) * 4'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const result1 = new Executor().execute(ast1)
		const result2 = new Executor().execute(ast2)
		expect(result1).toBe(result2)
	})

	test('round-trip with variables', () => {
		const source = 'x = 5; y = x + 10'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const executor1 = new Executor()
		const result1 = executor1.execute(ast1)
		const executor2 = new Executor()
		const result2 = executor2.execute(ast2)
		expect(result1).toBe(result2)
	})

	test('round-trip with functions', () => {
		const source = 'ABS(-5)'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const executor1 = new Executor({ functions: { ABS: Math.abs } })
		const result1 = executor1.execute(ast1)
		const executor2 = new Executor({ functions: { ABS: Math.abs } })
		const result2 = executor2.execute(ast2)
		expect(result1).toBe(result2)
	})

	test('round-trip complex expression', () => {
		const source = '2 ^ 3 * 4 + 5'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const ast2 = parseSource(code)
		const result1 = new Executor().execute(ast1)
		const result2 = new Executor().execute(ast2)
		expect(result1).toBe(result2)
	})

	test('program with multiple statements', () => {
		const node = {
			type: 'Program' as const,
			statements: [
				ast.assign('x', ast.number(5)),
				ast.assign('y', ast.number(10)),
				ast.add(ast.identifier('x'), ast.identifier('y')),
			],
		}
		const code = generate(node)
		expect(code).toBe('x = 5; y = 10; x + y')
	})

	test('generated code is syntactically valid', () => {
		const node = ast.multiply(
			ast.add(ast.number(2), ast.number(3)),
			ast.exponentiate(ast.number(2), ast.number(3)),
		)
		const code = generate(node)
		const parsed = parseSource(code)
		expect(parsed).toBeDefined()
	})

	test('comparison operators', () => {
		const node1 = ast.equals(ast.number(5), ast.number(3))
		expect(generate(node1)).toBe('5 == 3')

		const node2 = ast.lessThan(ast.number(10), ast.number(20))
		expect(generate(node2)).toBe('10 < 20')

		const node3 = ast.greaterEqual(ast.identifier('x'), ast.number(5))
		expect(generate(node3)).toBe('x >= 5')
	})

	test('comparison with arithmetic (precedence)', () => {
		// Arithmetic has higher precedence than comparison, no parens needed
		const node = ast.lessThan(
			ast.add(ast.number(2), ast.number(3)),
			ast.number(10),
		)
		expect(generate(node)).toBe('2 + 3 < 10')
	})

	test('ternary operator', () => {
		const node = ast.conditional(
			ast.greaterThan(ast.number(5), ast.number(3)),
			ast.number(100),
			ast.number(50),
		)
		expect(generate(node)).toBe('5 > 3 ? 100 : 50')
	})

	test('ternary with complex condition', () => {
		const node = ast.conditional(
			ast.add(ast.number(2), ast.number(3)),
			ast.number(100),
			ast.number(50),
		)
		expect(generate(node)).toBe('2 + 3 ? 100 : 50')
	})

	test('nested ternary', () => {
		const node = ast.conditional(
			ast.number(1),
			ast.conditional(ast.number(1), ast.number(100), ast.number(200)),
			ast.number(300),
		)
		expect(generate(node)).toBe('1 ? 1 ? 100 : 200 : 300')
	})

	test('ternary round-trip', () => {
		const source = 'x > 5 ? 100 : 50'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const _ast2 = parseSource(code)
		const result1 = execute(source, { variables: { x: 10 } })
		const result2 = execute(code, { variables: { x: 10 } })
		expect(result1).toBe(result2)
		expect(result1).toBe(100)
	})

	test('&& operator', () => {
		const source = '5 && 3'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		expect(code).toBe('5 && 3')
	})

	test('|| operator', () => {
		const source = '0 || 1'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		expect(code).toBe('0 || 1')
	})

	test('mixed logical and comparison operators', () => {
		const source = '5 > 3 && 10 < 20'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		const _ast2 = parseSource(code)
		expect(execute(source)).toBe(execute(code))
	})

	test('logical operators with parentheses', () => {
		const source = '(1 && 0) || 1'
		const ast1 = parseSource(source)
		const code = generate(ast1)
		expect(execute(source)).toBe(execute(code))
	})

	test('error on unknown node type', () => {
		// Test error handling for invalid AST node
		// biome-ignore lint/suspicious/noExplicitAny: testing error handling with intentionally invalid node type
		const invalidNode = { type: 'InvalidType' } as any
		const generator = new CodeGenerator()
		expect(() => generator.generate(invalidNode)).toThrow('Unknown node type')
	})
})
