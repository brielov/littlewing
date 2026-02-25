/**
 * Token types for the lexer
 * Represents all valid tokens in the language
 */
export const enum TokenKind {
	// Literals
	Number,
	Identifier,
	String,

	// Operators
	Plus, // +
	Minus, // -
	Star, // *
	Slash, // /
	Percent, // %
	Caret, // ^
	Bang, // !

	// Comparison operators
	EqEq, // ==
	NotEq, // !=
	Lt, // <
	Gt, // >
	Le, // <=
	Ge, // >=

	// Logical operators
	And, // &&
	Or, // ||

	// Punctuation
	LParen, // (
	RParen, // )
	LBracket, // [
	RBracket, // ]
	Eq, // =
	Comma, // ,

	// Keywords
	If,
	Then,
	Else,
	For,
	In,
	When,

	Eof,
}

/**
 * Keyword lookup table for identifier classification
 */
const KEYWORDS = new Map<string, TokenKind>([
	['if', TokenKind.If],
	['then', TokenKind.Then],
	['else', TokenKind.Else],
	['for', TokenKind.For],
	['in', TokenKind.In],
	['when', TokenKind.When],
])

/**
 * Token representation as a tuple for maximum performance
 * [kind, start, end] - text can be extracted via readText()
 */
export type Token = [kind: TokenKind, start: number, end: number]

/**
 * Cursor for tracking position during lexical analysis
 * Uses mutable position for zero-allocation iteration
 */
export interface Cursor {
	readonly source: string
	readonly len: number
	pos: number
}

/**
 * Create a new cursor for the given source code
 */
export function createCursor(source: string): Cursor {
	return {
		source,
		len: source.length,
		pos: 0,
	}
}

/**
 * Peek at a character code without consuming it
 */
function peek(cursor: Cursor, offset = 0): number {
	return cursor.pos + offset < cursor.len
		? cursor.source.charCodeAt(cursor.pos + offset)
		: 0
}

/**
 * Consume and return the current character code
 */
function advance(cursor: Cursor): number {
	const char = cursor.source.charCodeAt(cursor.pos)
	cursor.pos++
	return char
}

/**
 * Skip whitespace characters (space, tab, newline, carriage return)
 */
function skipWhitespace(cursor: Cursor): void {
	while (cursor.pos < cursor.len) {
		const c = cursor.source.charCodeAt(cursor.pos)
		if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) {
			cursor.pos++
		} else {
			break
		}
	}
}

/**
 * Skip a single-line comment starting with '//'
 */
function skipComment(cursor: Cursor): void {
	if (
		cursor.pos < cursor.len - 1 &&
		cursor.source.charCodeAt(cursor.pos) === 0x2f &&
		cursor.source.charCodeAt(cursor.pos + 1) === 0x2f
	) {
		cursor.pos += 2
		while (cursor.pos < cursor.len) {
			const ch = cursor.source.charCodeAt(cursor.pos)
			if (ch === 0x0a || ch === 0x0d) break
			cursor.pos++
		}
	}
}

/**
 * Check if character code is a digit (0-9)
 */
function isDigit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39
}

/**
 * Check if character code is an alphabetic character (a-z, A-Z)
 */
function isAlpha(ch: number): boolean {
	return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a)
}

/**
 * Extract the text content of a token from the source
 */
export function readText(cursor: Cursor, token: Token): string {
	return cursor.source.slice(token[1], token[2])
}

/**
 * Extract the string value from a String token.
 * Strips the surrounding quotes and resolves escape sequences.
 */
export function readStringValue(cursor: Cursor, token: Token): string {
	// Slice between the quotes
	const raw = cursor.source.slice(token[1] + 1, token[2] - 1)
	// Fast path: no backslashes
	if (!raw.includes('\\')) return raw

	let result = ''
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '\\' && i + 1 < raw.length) {
			i++
			const ch = raw[i]
			switch (ch) {
				case 'n':
					result += '\n'
					break
				case 't':
					result += '\t'
					break
				case '\\':
					result += '\\'
					break
				case '"':
					result += '"'
					break
				default:
					// Unknown escape: preserve as-is
					result += `\\${ch}`
			}
		} else {
			result += raw[i]
		}
	}
	return result
}

/**
 * Get the next token from the source
 */
export function nextToken(cursor: Cursor): Token {
	while (true) {
		const beforePos = cursor.pos
		skipWhitespace(cursor)
		skipComment(cursor)
		if (cursor.pos === beforePos) {
			break
		}
	}

	if (cursor.pos >= cursor.len) {
		return [TokenKind.Eof, cursor.pos, cursor.pos]
	}

	const start = cursor.pos
	const ch = peek(cursor)

	if (isDigit(ch)) {
		return lexNumber(cursor)
	}

	if (ch === 0x2e && isDigit(peek(cursor, 1))) {
		return lexNumber(cursor)
	}

	if (isAlpha(ch) || ch === 0x5f) {
		return lexIdentifier(cursor)
	}

	switch (ch) {
		case 0x22: // "
			return lexString(cursor)
		case 0x2b: // +
			advance(cursor)
			return [TokenKind.Plus, start, cursor.pos]
		case 0x2d: // -
			advance(cursor)
			return [TokenKind.Minus, start, cursor.pos]
		case 0x2a: // *
			advance(cursor)
			return [TokenKind.Star, start, cursor.pos]
		case 0x2f: // /
			advance(cursor)
			return [TokenKind.Slash, start, cursor.pos]
		case 0x25: // %
			advance(cursor)
			return [TokenKind.Percent, start, cursor.pos]
		case 0x5e: // ^
			advance(cursor)
			return [TokenKind.Caret, start, cursor.pos]
		case 0x28: // (
			advance(cursor)
			return [TokenKind.LParen, start, cursor.pos]
		case 0x29: // )
			advance(cursor)
			return [TokenKind.RParen, start, cursor.pos]
		case 0x5b: // [
			advance(cursor)
			return [TokenKind.LBracket, start, cursor.pos]
		case 0x5d: // ]
			advance(cursor)
			return [TokenKind.RBracket, start, cursor.pos]
		case 0x3d: // =
			advance(cursor)
			if (peek(cursor) === 0x3d) {
				advance(cursor)
				return [TokenKind.EqEq, start, cursor.pos]
			}
			return [TokenKind.Eq, start, cursor.pos]
		case 0x21: // !
			advance(cursor)
			if (peek(cursor) === 0x3d) {
				advance(cursor)
				return [TokenKind.NotEq, start, cursor.pos]
			}
			return [TokenKind.Bang, start, cursor.pos]
		case 0x3c: // <
			advance(cursor)
			if (peek(cursor) === 0x3d) {
				advance(cursor)
				return [TokenKind.Le, start, cursor.pos]
			}
			return [TokenKind.Lt, start, cursor.pos]
		case 0x3e: // >
			advance(cursor)
			if (peek(cursor) === 0x3d) {
				advance(cursor)
				return [TokenKind.Ge, start, cursor.pos]
			}
			return [TokenKind.Gt, start, cursor.pos]
		case 0x2c: // ,
			advance(cursor)
			return [TokenKind.Comma, start, cursor.pos]
		case 0x3b: // ;
			advance(cursor)
			return nextToken(cursor)
		case 0x26: // &
			advance(cursor)
			if (peek(cursor) === 0x26) {
				advance(cursor)
				return [TokenKind.And, start, cursor.pos]
			}
			throw new Error(
				`Unexpected character '${String.fromCharCode(ch)}' at position ${start}`,
			)
		case 0x7c: // |
			advance(cursor)
			if (peek(cursor) === 0x7c) {
				advance(cursor)
				return [TokenKind.Or, start, cursor.pos]
			}
			throw new Error(
				`Unexpected character '${String.fromCharCode(ch)}' at position ${start}`,
			)
		default:
			throw new Error(
				`Unexpected character '${String.fromCharCode(ch)}' at position ${start}`,
			)
	}
}

/**
 * Lex a string literal enclosed in double quotes.
 * Handles escape sequences by skipping the character after backslash.
 */
function lexString(cursor: Cursor): Token {
	const start = cursor.pos
	advance(cursor) // skip opening "

	while (cursor.pos < cursor.len) {
		const ch = cursor.source.charCodeAt(cursor.pos)
		if (ch === 0x5c) {
			// backslash
			cursor.pos += 2 // skip backslash and next char
		} else if (ch === 0x22) {
			// closing "
			cursor.pos++
			return [TokenKind.String, start, cursor.pos]
		} else {
			cursor.pos++
		}
	}

	throw new Error(`Unterminated string at position ${start}`)
}

/**
 * Lex a number token
 */
function lexNumber(cursor: Cursor): Token {
	const start = cursor.pos
	const { source, len } = cursor
	let pos = cursor.pos

	if (source.charCodeAt(pos) === 0x2e) {
		pos++
		while (
			pos < len &&
			source.charCodeAt(pos) >= 0x30 &&
			source.charCodeAt(pos) <= 0x39
		) {
			pos++
		}
		const ch = pos < len ? source.charCodeAt(pos) : 0
		if (ch === 0x65 || ch === 0x45) {
			pos = lexExponent(source, len, pos)
		}
		cursor.pos = pos
		return [TokenKind.Number, start, pos]
	}

	while (
		pos < len &&
		source.charCodeAt(pos) >= 0x30 &&
		source.charCodeAt(pos) <= 0x39
	) {
		pos++
	}

	if (pos < len && source.charCodeAt(pos) === 0x2e) {
		pos++
		while (
			pos < len &&
			source.charCodeAt(pos) >= 0x30 &&
			source.charCodeAt(pos) <= 0x39
		) {
			pos++
		}
	}

	if (pos < len) {
		const ch = source.charCodeAt(pos)
		if (ch === 0x65 || ch === 0x45) {
			pos = lexExponent(source, len, pos)
		}
	}

	cursor.pos = pos
	return [TokenKind.Number, start, pos]
}

function lexExponent(source: string, len: number, pos: number): number {
	pos++

	if (pos < len) {
		const next = source.charCodeAt(pos)
		if (next === 0x2b || next === 0x2d) {
			pos++
		}
	}

	if (pos >= len || !isDigit(source.charCodeAt(pos))) {
		throw new Error(
			`Invalid number: expected digit after exponent at position ${pos}`,
		)
	}

	while (pos < len && isDigit(source.charCodeAt(pos))) {
		pos++
	}

	return pos
}

function lexIdentifier(cursor: Cursor): Token {
	const start = cursor.pos
	const { source, len } = cursor
	let pos = cursor.pos + 1

	while (pos < len) {
		const ch = source.charCodeAt(pos)
		if (
			(ch >= 0x41 && ch <= 0x5a) ||
			(ch >= 0x61 && ch <= 0x7a) ||
			(ch >= 0x30 && ch <= 0x39) ||
			ch === 0x5f
		) {
			pos++
		} else {
			break
		}
	}

	cursor.pos = pos

	const text = source.slice(start, pos)
	const keywordKind = KEYWORDS.get(text)
	if (keywordKind !== undefined) {
		return [keywordKind, start, pos]
	}

	return [TokenKind.Identifier, start, pos]
}
