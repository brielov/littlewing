import { describe, expect, test } from 'bun:test'
import { Lexer, TokenType } from '../src'

describe('Lexer', () => {
	test('tokenize numbers', () => {
		const lexer = new Lexer('42 3.14')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[0]?.value).toBe(42)
		expect(tokens[1]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.value).toBe(3.14)
		expect(tokens[2]?.type).toBe(TokenType.EOF)
	})

	test('tokenize identifiers', () => {
		const lexer = new Lexer('x my_var now')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.IDENTIFIER)
		expect(tokens[0]?.value).toBe('x')
		expect(tokens[1]?.type).toBe(TokenType.IDENTIFIER)
		expect(tokens[1]?.value).toBe('my_var')
		expect(tokens[2]?.type).toBe(TokenType.IDENTIFIER)
		expect(tokens[2]?.value).toBe('now')
	})

	test('tokenize operators', () => {
		const lexer = new Lexer('+ - * / % ^')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.PLUS)
		expect(tokens[1]?.type).toBe(TokenType.MINUS)
		expect(tokens[2]?.type).toBe(TokenType.STAR)
		expect(tokens[3]?.type).toBe(TokenType.SLASH)
		expect(tokens[4]?.type).toBe(TokenType.PERCENT)
		expect(tokens[5]?.type).toBe(TokenType.CARET)
	})

	test('skip comments', () => {
		const lexer = new Lexer('42 // this is a comment\n 3.14')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.value).toBe(42)
		expect(tokens[1]?.value).toBe(3.14)
	})

	test('skip whitespace and semicolons', () => {
		const lexer = new Lexer('x = 1 ; y = 2')
		const tokens = lexer.tokenize()
		const filtered = tokens.filter((t) => t.type !== TokenType.EOF)
		expect(filtered.length).toBe(6) // x, =, 1, y, =, 2
	})

	test('tokenize full expression', () => {
		const lexer = new Lexer('x = 1 + 2')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.value).toBe('x')
		expect(tokens[1]?.value).toBe('=')
		expect(tokens[2]?.value).toBe(1)
		expect(tokens[3]?.value).toBe('+')
		expect(tokens[4]?.value).toBe(2)
	})

	test('tokenize decimal numbers', () => {
		const lexer = new Lexer('3.14159 0.5 100.0')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		// biome-ignore lint/suspicious/noApproximativeNumericConstant: testing lexer parsing of literal
		expect(tokens[0]?.value).toBeCloseTo(3.14159)
		expect(tokens[1]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.value).toBe(0.5)
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
		expect(tokens[2]?.value).toBe(100.0)
	})

	test('tokenize large numbers', () => {
		const lexer = new Lexer('1704067200000')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[0]?.value).toBe(1704067200000)
	})

	test('tokenize scientific notation', () => {
		const lexer = new Lexer('1.5e6 2e10 3e-2 4E+5')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[0]?.value).toBe(1500000)
		expect(tokens[1]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.value).toBe(20000000000)
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
		expect(tokens[2]?.value).toBe(0.03)
		expect(tokens[3]?.type).toBe(TokenType.NUMBER)
		expect(tokens[3]?.value).toBe(400000)
	})

	test('error on invalid scientific notation', () => {
		expect(() => new Lexer('1e').tokenize()).toThrow(
			'expected digit after exponent',
		)
		expect(() => new Lexer('1e+').tokenize()).toThrow(
			'expected digit after exponent',
		)
	})

	test('tokenize decimal shorthand', () => {
		const lexer = new Lexer('.2 .5 .999')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[0]?.value).toBe(0.2)
		expect(tokens[1]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.value).toBe(0.5)
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
		expect(tokens[2]?.value).toBe(0.999)
	})

	test('tokenize decimal shorthand with scientific notation', () => {
		const lexer = new Lexer('.5e2 .3E-1 .1e+3')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[0]?.value).toBe(50)
		expect(tokens[1]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.value).toBe(0.03)
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
		expect(tokens[2]?.value).toBe(100)
	})

	test('error on lone decimal point', () => {
		expect(() => new Lexer('.').tokenize()).toThrow('Unexpected character')
		expect(() => new Lexer('1 + .').tokenize()).toThrow('Unexpected character')
		expect(() => new Lexer('. + 1').tokenize()).toThrow('Unexpected character')
	})

	test('tokenize comparison operators', () => {
		const lexer = new Lexer('== != < > <= >=')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.DOUBLE_EQUALS)
		expect(tokens[0]?.value).toBe('==')
		expect(tokens[1]?.type).toBe(TokenType.NOT_EQUALS)
		expect(tokens[1]?.value).toBe('!=')
		expect(tokens[2]?.type).toBe(TokenType.LESS_THAN)
		expect(tokens[2]?.value).toBe('<')
		expect(tokens[3]?.type).toBe(TokenType.GREATER_THAN)
		expect(tokens[3]?.value).toBe('>')
		expect(tokens[4]?.type).toBe(TokenType.LESS_EQUAL)
		expect(tokens[4]?.value).toBe('<=')
		expect(tokens[5]?.type).toBe(TokenType.GREATER_EQUAL)
		expect(tokens[5]?.value).toBe('>=')
	})

	test('distinguish = from ==', () => {
		const lexer = new Lexer('x = 5 == 5')
		const tokens = lexer.tokenize()
		expect(tokens[1]?.type).toBe(TokenType.EQUALS)
		expect(tokens[3]?.type).toBe(TokenType.DOUBLE_EQUALS)
	})

	test('tokenize ! operator', () => {
		const lexer = new Lexer('!')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.EXCLAMATION)
		expect(tokens[0]?.value).toBe('!')
	})

	test('distinguish ! from !=', () => {
		const lexer = new Lexer('! !=')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.EXCLAMATION)
		expect(tokens[0]?.value).toBe('!')
		expect(tokens[1]?.type).toBe(TokenType.NOT_EQUALS)
		expect(tokens[1]?.value).toBe('!=')
	})

	test('tokenize ternary operator', () => {
		const lexer = new Lexer('x ? y : z')
		const tokens = lexer.tokenize()
		expect(tokens[1]?.type).toBe(TokenType.QUESTION)
		expect(tokens[1]?.value).toBe('?')
		expect(tokens[3]?.type).toBe(TokenType.COLON)
		expect(tokens[3]?.value).toBe(':')
	})

	test('tokenize && operator', () => {
		const lexer = new Lexer('1 && 2')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.type).toBe(TokenType.LOGICAL_AND)
		expect(tokens[1]?.value).toBe('&&')
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
	})

	test('tokenize || operator', () => {
		const lexer = new Lexer('1 || 0')
		const tokens = lexer.tokenize()
		expect(tokens[0]?.type).toBe(TokenType.NUMBER)
		expect(tokens[1]?.type).toBe(TokenType.LOGICAL_OR)
		expect(tokens[1]?.value).toBe('||')
		expect(tokens[2]?.type).toBe(TokenType.NUMBER)
	})

	test('single & throws error', () => {
		const lexer = new Lexer('5 & 3')
		expect(() => lexer.tokenize()).toThrow("Unexpected character '&'")
	})

	test('single | throws error', () => {
		const lexer = new Lexer('5 | 3')
		expect(() => lexer.tokenize()).toThrow("Unexpected character '|'")
	})
})
