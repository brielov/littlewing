import { describe, expect, test } from 'bun:test'
import {
	createCursor,
	nextToken,
	readStringValue,
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

/**
 * Helper to assert token kind
 */
function expectToken(token: Token | undefined, kind: TokenKind): void {
	expect(token).toBeDefined()
	expect(token![0]).toBe(kind)
}

/**
 * Helper to assert token kind and get text value
 */
function expectTokenText(
	cursor: ReturnType<typeof createCursor>,
	token: Token | undefined,
	kind: TokenKind,
	text: string,
): void {
	expectToken(token, kind)
	expect(getTextValue(cursor, token!)).toBe(text)
}

/**
 * Helper to assert token kind and get number value
 */
function expectTokenNumber(
	cursor: ReturnType<typeof createCursor>,
	token: Token | undefined,
	kind: TokenKind,
	value: number,
): void {
	expectToken(token, kind)
	expect(getNumberValue(cursor, token!)).toBe(value)
}

describe('Lexer', () => {
	test('tokenize numbers', () => {
		const source = '42 3.14'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 42)
		expectTokenNumber(cursor, tokens[1], TokenKind.Number, 3.14)
		expectToken(tokens[2], TokenKind.Eof)
	})

	test('tokenize identifiers', () => {
		const source = 'x my_var now'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenText(cursor, tokens[0], TokenKind.Identifier, 'x')
		expectTokenText(cursor, tokens[1], TokenKind.Identifier, 'my_var')
		expectTokenText(cursor, tokens[2], TokenKind.Identifier, 'now')
	})

	test('tokenize operators', () => {
		const tokens = tokenize('+ - * / % ^')
		expectToken(tokens[0], TokenKind.Plus)
		expectToken(tokens[1], TokenKind.Minus)
		expectToken(tokens[2], TokenKind.Star)
		expectToken(tokens[3], TokenKind.Slash)
		expectToken(tokens[4], TokenKind.Percent)
		expectToken(tokens[5], TokenKind.Caret)
	})

	test('skip comments', () => {
		const source = '42 // this is a comment\n 3.14'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 42)
		expectTokenNumber(cursor, tokens[1], TokenKind.Number, 3.14)
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

		expectTokenText(cursor, tokens[0], TokenKind.Identifier, 'x')
		expectTokenText(cursor, tokens[1], TokenKind.Eq, '=')
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 1)
		expectTokenText(cursor, tokens[3], TokenKind.Plus, '+')
		expectTokenNumber(cursor, tokens[4], TokenKind.Number, 2)
	})

	test('tokenize decimal numbers', () => {
		const source = '3.14159 0.5 100.0'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.Number)
		// biome-ignore lint/suspicious/noApproximativeNumericConstant: testing lexer parsing of literal
		expect(getNumberValue(cursor, tokens[0]!)).toBeCloseTo(3.14159)
		expectTokenNumber(cursor, tokens[1], TokenKind.Number, 0.5)
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 100.0)
	})

	test('tokenize large numbers', () => {
		const source = '1704067200000'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 1704067200000)
	})

	test('error on leading-dot shorthand', () => {
		expect(() => tokenize('.5')).toThrow('Unexpected character')
		expect(() => tokenize('.2 + .3')).toThrow('Unexpected character')
	})

	test('error on scientific notation', () => {
		// 1e6 is now lexed as number(1) then identifier(e6)
		const source = '1e6'
		const cursor = createCursor(source)
		const tokens = tokenize(source)
		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 1)
		expectTokenText(cursor, tokens[1], TokenKind.Identifier, 'e6')
	})

	test('error on lone decimal point', () => {
		expect(() => tokenize('.')).toThrow('Unexpected character')
		expect(() => tokenize('1 + .')).toThrow('Unexpected character')
		expect(() => tokenize('. + 1')).toThrow('Unexpected character')
	})

	test('tokenize .. operator', () => {
		const source = '1..5'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 1)
		expectToken(tokens[1], TokenKind.DotDot)
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 5)
	})

	test('tokenize ..= operator', () => {
		const source = '1..=5'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 1)
		expectToken(tokens[1], TokenKind.DotDotEq)
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 5)
	})

	test('disambiguate decimal from range', () => {
		// 5.3..10 should be: number(5.3) DotDot number(10)
		const source = '5.3..10'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 5.3)
		expectToken(tokens[1], TokenKind.DotDot)
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 10)
	})

	test('integer followed by range', () => {
		// 5..10 should be: number(5) DotDot number(10)
		const source = '5..10'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenNumber(cursor, tokens[0], TokenKind.Number, 5)
		expectToken(tokens[1], TokenKind.DotDot)
		expectTokenNumber(cursor, tokens[2], TokenKind.Number, 10)
	})

	test('tokenize comparison operators', () => {
		const source = '== != < > <= >='
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenText(cursor, tokens[0], TokenKind.EqEq, '==')
		expectTokenText(cursor, tokens[1], TokenKind.NotEq, '!=')
		expectTokenText(cursor, tokens[2], TokenKind.Lt, '<')
		expectTokenText(cursor, tokens[3], TokenKind.Gt, '>')
		expectTokenText(cursor, tokens[4], TokenKind.Le, '<=')
		expectTokenText(cursor, tokens[5], TokenKind.Ge, '>=')
	})

	test('distinguish = from ==', () => {
		const tokens = tokenize('x = 5 == 5')
		expectToken(tokens[1], TokenKind.Eq)
		expectToken(tokens[3], TokenKind.EqEq)
	})

	test('tokenize ! operator', () => {
		const source = '!'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenText(cursor, tokens[0], TokenKind.Bang, '!')
	})

	test('distinguish ! from !=', () => {
		const source = '! !='
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectTokenText(cursor, tokens[0], TokenKind.Bang, '!')
		expectTokenText(cursor, tokens[1], TokenKind.NotEq, '!=')
	})

	test('tokenize keywords', () => {
		const tokens = tokenize('if then else for in when')
		expectToken(tokens[0], TokenKind.If)
		expectToken(tokens[1], TokenKind.Then)
		expectToken(tokens[2], TokenKind.Else)
		expectToken(tokens[3], TokenKind.For)
		expectToken(tokens[4], TokenKind.In)
		expectToken(tokens[5], TokenKind.When)
	})

	test('keywords are case-sensitive', () => {
		const source = 'IF THEN ELSE FOR IN WHEN'
		const tokens = tokenize(source)
		// Uppercase versions are identifiers, not keywords
		for (let i = 0; i < 6; i++) {
			expectToken(tokens[i], TokenKind.Identifier)
		}
	})

	test('keywords as part of identifiers remain identifiers', () => {
		const source = 'iffy thenx elsewhere format infix whenever'
		const tokens = tokenize(source)
		for (let i = 0; i < 6; i++) {
			expectToken(tokens[i], TokenKind.Identifier)
		}
	})

	test('tokenize && operator', () => {
		const source = '1 && 2'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.Number)
		expectTokenText(cursor, tokens[1], TokenKind.And, '&&')
		expectToken(tokens[2], TokenKind.Number)
	})

	test('tokenize || operator', () => {
		const source = '1 || 0'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.Number)
		expectTokenText(cursor, tokens[1], TokenKind.Or, '||')
		expectToken(tokens[2], TokenKind.Number)
	})

	test('single & throws error', () => {
		expect(() => tokenize('5 & 3')).toThrow("Unexpected character '&'")
	})

	test('single | throws error', () => {
		expect(() => tokenize('5 | 3')).toThrow("Unexpected character '|'")
	})

	test('tokenize string literal', () => {
		const source = '"hello"'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.String)
		expect(readText(cursor, tokens[0]!)).toBe('"hello"')
	})

	test('tokenize string with escapes', () => {
		const source = '"hello\\nworld"'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.String)
		expect(readText(cursor, tokens[0]!)).toBe('"hello\\nworld"')
	})

	test('tokenize empty string', () => {
		const source = '""'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.String)
		expect(readText(cursor, tokens[0]!)).toBe('""')
	})

	test('error on unterminated string', () => {
		expect(() => tokenize('"hello')).toThrow('Unterminated string')
	})

	test('tokenize string with escaped quote', () => {
		const source = '"say \\"hi\\""'
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.String)
	})

	test('tokenize bracket tokens', () => {
		const tokens = tokenize('[ ]')
		expectToken(tokens[0], TokenKind.LBracket)
		expectToken(tokens[1], TokenKind.RBracket)
	})

	test('tokenize array literal', () => {
		const source = '[1, 2, 3]'
		const cursor = createCursor(source)
		const tokens = tokenize(source)

		expectToken(tokens[0], TokenKind.LBracket)
		expectTokenNumber(cursor, tokens[1], TokenKind.Number, 1)
		expectToken(tokens[2], TokenKind.Comma)
		expectTokenNumber(cursor, tokens[3], TokenKind.Number, 2)
		expectToken(tokens[4], TokenKind.Comma)
		expectTokenNumber(cursor, tokens[5], TokenKind.Number, 3)
		expectToken(tokens[6], TokenKind.RBracket)
	})

	test('readStringValue extracts unescaped content', () => {
		const source = '"hello world"'
		const cursor = createCursor(source)
		const tokens = tokenize(source)
		const value = readStringValue(cursor, tokens[0]!)
		expect(value).toBe('hello world')
	})

	test('readStringValue resolves escape sequences', () => {
		const source = '"line1\\nline2\\ttab"'
		const cursor = createCursor(source)
		const tokens = tokenize(source)
		const value = readStringValue(cursor, tokens[0]!)
		expect(value).toBe('line1\nline2\ttab')
	})

	test('readStringValue resolves escaped quotes', () => {
		const source = '"say \\"hi\\""'
		const cursor = createCursor(source)
		const tokens = tokenize(source)
		const value = readStringValue(cursor, tokens[0]!)
		expect(value).toBe('say "hi"')
	})

	test('readStringValue resolves escaped backslash', () => {
		const source = '"path\\\\to\\\\file"'
		const cursor = createCursor(source)
		const tokens = tokenize(source)
		const value = readStringValue(cursor, tokens[0]!)
		expect(value).toBe('path\\to\\file')
	})
})
