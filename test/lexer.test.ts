import { describe, expect, test } from 'bun:test'
import {
	createCursor,
	nextToken,
	readText,
	type Token,
	TokenKind,
} from '../src/lexer'

/**
 * Helper function to tokenize source and return all tokens
 */
function tokenize(source: string): Token[] {
	const cursor = createCursor(source)
	const tokens: Token[] = []
	let token = nextToken(cursor)
	while (token[0] !== TokenKind.Eof) {
		tokens.push(token)
		token = nextToken(cursor)
	}
	tokens.push(token) // Include EOF token
	return tokens
}

/**
 * Helper to get numeric value from a Number token
 */
function getNumberValue(
	cursor: ReturnType<typeof createCursor>,
	token: Token,
): number {
	return Number.parseFloat(readText(cursor, token))
}

/**
 * Helper to get string value from any token
 */
function getTextValue(
	cursor: ReturnType<typeof createCursor>,
	token: Token,
): string {
	return readText(cursor, token)
}

describe('Lexer', () => {
	test('tokenize numbers', () => {
		const source = '42 3.14'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[0]!)).toBe(42)
		expect(tokens[1]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(3.14)
		expect(tokens[2]?.[0]).toBe(TokenKind.Eof)
	})

	test('tokenize identifiers', () => {
		const source = 'x my_var now'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Identifier)
		expect(getTextValue(cursor, tokens[0]!)).toBe('x')
		expect(tokens[1]?.[0]).toBe(TokenKind.Identifier)
		expect(getTextValue(cursor, tokens[1]!)).toBe('my_var')
		expect(tokens[2]?.[0]).toBe(TokenKind.Identifier)
		expect(getTextValue(cursor, tokens[2]!)).toBe('now')
	})

	test('tokenize operators', () => {
		const tokens = tokenize('+ - * / % ^')
		expect(tokens[0]?.[0]).toBe(TokenKind.Plus)
		expect(tokens[1]?.[0]).toBe(TokenKind.Minus)
		expect(tokens[2]?.[0]).toBe(TokenKind.Star)
		expect(tokens[3]?.[0]).toBe(TokenKind.Slash)
		expect(tokens[4]?.[0]).toBe(TokenKind.Percent)
		expect(tokens[5]?.[0]).toBe(TokenKind.Caret)
	})

	test('skip comments', () => {
		const source = '42 // this is a comment\n 3.14'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(getNumberValue(cursor, tokens[0]!)).toBe(42)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(3.14)
	})

	test('skip whitespace and semicolons', () => {
		const tokens = tokenize('x = 1 ; y = 2')
		const filtered = tokens.filter((t) => t[0] !== TokenKind.Eof)
		expect(filtered.length).toBe(6) // x, =, 1, y, =, 2
	})

	test('tokenize full expression', () => {
		const source = 'x = 1 + 2'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(getTextValue(cursor, tokens[0]!)).toBe('x')
		expect(getTextValue(cursor, tokens[1]!)).toBe('=')
		expect(getNumberValue(cursor, tokens[2]!)).toBe(1)
		expect(getTextValue(cursor, tokens[3]!)).toBe('+')
		expect(getNumberValue(cursor, tokens[4]!)).toBe(2)
	})

	test('tokenize decimal numbers', () => {
		const source = '3.14159 0.5 100.0'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		// biome-ignore lint/suspicious/noApproximativeNumericConstant: testing lexer parsing of literal
		expect(getNumberValue(cursor, tokens[0]!)).toBeCloseTo(3.14159)
		expect(tokens[1]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(0.5)
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[2]!)).toBe(100.0)
	})

	test('tokenize large numbers', () => {
		const source = '1704067200000'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[0]!)).toBe(1704067200000)
	})

	test('tokenize scientific notation', () => {
		const source = '1.5e6 2e10 3e-2 4E+5'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[0]!)).toBe(1500000)
		expect(tokens[1]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(20000000000)
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[2]!)).toBe(0.03)
		expect(tokens[3]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[3]!)).toBe(400000)
	})

	test('error on invalid scientific notation', () => {
		expect(() => tokenize('1e')).toThrow('expected digit after exponent')
		expect(() => tokenize('1e+')).toThrow('expected digit after exponent')
	})

	test('tokenize decimal shorthand', () => {
		const source = '.2 .5 .999'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[0]!)).toBe(0.2)
		expect(tokens[1]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(0.5)
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[2]!)).toBe(0.999)
	})

	test('tokenize decimal shorthand with scientific notation', () => {
		const source = '.5e2 .3E-1 .1e+3'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[0]!)).toBe(50)
		expect(tokens[1]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[1]!)).toBe(0.03)
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
		expect(getNumberValue(cursor, tokens[2]!)).toBe(100)
	})

	test('error on lone decimal point', () => {
		expect(() => tokenize('.')).toThrow('Unexpected character')
		expect(() => tokenize('1 + .')).toThrow('Unexpected character')
		expect(() => tokenize('. + 1')).toThrow('Unexpected character')
	})

	test('tokenize comparison operators', () => {
		const source = '== != < > <= >='
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.EqEq)
		expect(getTextValue(cursor, tokens[0]!)).toBe('==')
		expect(tokens[1]?.[0]).toBe(TokenKind.NotEq)
		expect(getTextValue(cursor, tokens[1]!)).toBe('!=')
		expect(tokens[2]?.[0]).toBe(TokenKind.Lt)
		expect(getTextValue(cursor, tokens[2]!)).toBe('<')
		expect(tokens[3]?.[0]).toBe(TokenKind.Gt)
		expect(getTextValue(cursor, tokens[3]!)).toBe('>')
		expect(tokens[4]?.[0]).toBe(TokenKind.Le)
		expect(getTextValue(cursor, tokens[4]!)).toBe('<=')
		expect(tokens[5]?.[0]).toBe(TokenKind.Ge)
		expect(getTextValue(cursor, tokens[5]!)).toBe('>=')
	})

	test('distinguish = from ==', () => {
		const tokens = tokenize('x = 5 == 5')
		expect(tokens[1]?.[0]).toBe(TokenKind.Eq)
		expect(tokens[3]?.[0]).toBe(TokenKind.EqEq)
	})

	test('tokenize ! operator', () => {
		const source = '!'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Bang)
		expect(getTextValue(cursor, tokens[0]!)).toBe('!')
	})

	test('distinguish ! from !=', () => {
		const source = '! !='
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Bang)
		expect(getTextValue(cursor, tokens[0]!)).toBe('!')
		expect(tokens[1]?.[0]).toBe(TokenKind.NotEq)
		expect(getTextValue(cursor, tokens[1]!)).toBe('!=')
	})

	test('tokenize ternary operator', () => {
		const source = 'x ? y : z'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[1]?.[0]).toBe(TokenKind.Question)
		expect(getTextValue(cursor, tokens[1]!)).toBe('?')
		expect(tokens[3]?.[0]).toBe(TokenKind.Colon)
		expect(getTextValue(cursor, tokens[3]!)).toBe(':')
	})

	test('tokenize && operator', () => {
		const source = '1 && 2'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(tokens[1]?.[0]).toBe(TokenKind.And)
		expect(getTextValue(cursor, tokens[1]!)).toBe('&&')
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
	})

	test('tokenize || operator', () => {
		const source = '1 || 0'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expect(tokens[0]?.[0]).toBe(TokenKind.Number)
		expect(tokens[1]?.[0]).toBe(TokenKind.Or)
		expect(getTextValue(cursor, tokens[1]!)).toBe('||')
		expect(tokens[2]?.[0]).toBe(TokenKind.Number)
	})

	test('single & throws error', () => {
		expect(() => tokenize('5 & 3')).toThrow("Unexpected character '&'")
	})

	test('single | throws error', () => {
		expect(() => tokenize('5 | 3')).toThrow("Unexpected character '|'")
	})
})
