/**
 * Token types for the lexer
 * Represents all valid tokens in the language
 */
export enum TokenKind {
	// Literals
	Number,
	Identifier,

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
	Eq, // =
	Comma, // ,
	Question, // ?
	Colon, // :

	Eof,
}

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
 * @param source - The source code to tokenize
 * @returns A cursor positioned at the start of the source
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
 * @param cursor - The cursor to peek from
 * @param offset - Optional offset from current position (default: 0)
 * @returns Character code at position, or 0 if beyond EOF
 */
function peek(cursor: Cursor, offset = 0): number {
	return cursor.pos + offset < cursor.len
		? cursor.source.charCodeAt(cursor.pos + offset)
		: 0
}

/**
 * Consume and return the current character code
 * @param cursor - The cursor to advance
 * @returns Character code at current position
 */
function advance(cursor: Cursor): number {
	const char = cursor.source.charCodeAt(cursor.pos)
	cursor.pos++
	return char
}

/**
 * Skip whitespace characters (space, tab, newline, carriage return)
 * @param cursor - The cursor to advance
 */
function skipWhitespace(cursor: Cursor): void {
	let c = peek(cursor)
	// 0x20 = space, 0x0a = \n, 0x0d = \r, 0x09 = \t
	while (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) {
		advance(cursor)
		c = peek(cursor)
	}
}

/**
 * Skip a single-line comment starting with '//'
 * Advances cursor to the end of line or EOF
 * @param cursor - The cursor to advance
 */
function skipComment(cursor: Cursor): void {
	if (peek(cursor) === 0x2f && peek(cursor, 1) === 0x2f) {
		// Skip until newline or EOF (0 is returned for EOF by peek)
		let ch = peek(cursor)
		while (ch !== 0x0a && ch !== 0x0d && ch !== 0) {
			advance(cursor)
			ch = peek(cursor)
		}
	}
}

/**
 * Check if character code is a digit (0-9)
 * @param ch - Character code to check
 * @returns true if ch is in range 0x30-0x39 (ASCII '0'-'9')
 */
function isDigit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39
}

/**
 * Check if character code is an alphabetic character (a-z, A-Z)
 * @param ch - Character code to check
 * @returns true if ch is in range 0x41-0x5a or 0x61-0x7a (ASCII 'A'-'Z' or 'a'-'z')
 */
function isAlpha(ch: number): boolean {
	return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a)
}

/**
 * Extract the text content of a token from the source
 * Deferred extraction for performance - only allocate string when needed
 * @param cursor - The cursor containing the source
 * @param token - The token to extract text from
 * @returns The substring of source between token's start and end positions
 */
export function readText(cursor: Cursor, token: Token): string {
	return cursor.source.slice(token[1], token[2])
}

/**
 * Get the next token from the source
 * Handles whitespace, comments, operators, literals, and identifiers
 * @param cursor - The cursor to read from
 * @returns A token tuple [kind, start, end]
 */
export function nextToken(cursor: Cursor): Token {
	// Skip whitespace and comments in a loop to handle all cases:
	// - whitespace followed by comments
	// - comments followed by whitespace
	// - multiple consecutive comments
	while (true) {
		const beforePos = cursor.pos
		skipWhitespace(cursor)
		skipComment(cursor)
		// If position didn't change, we're done skipping
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
		case 0x3f: // ?
			advance(cursor)
			return [TokenKind.Question, start, cursor.pos]
		case 0x3a: // :
			advance(cursor)
			return [TokenKind.Colon, start, cursor.pos]
		case 0x2c: // ,
			advance(cursor)
			return [TokenKind.Comma, start, cursor.pos]
		case 0x3b: // ;
			advance(cursor)
			return nextToken(cursor)
		case 0x26: // &
			advance(cursor) // Consume first '&'
			if (peek(cursor) === 0x26) {
				advance(cursor) // Consume second '&'
				return [TokenKind.And, start, cursor.pos]
			}
			throw new Error(
				`Unexpected character '${String.fromCharCode(ch)}' at position ${start}`,
			)
		case 0x7c: // |
			advance(cursor) // Consume first '|'
			if (peek(cursor) === 0x7c) {
				advance(cursor) // Consume second '|'
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
 * Lex a number token
 * Supports integers (42), decimals (3.14), decimal shorthand (.5), and scientific notation (1e6, 2.5e-3)
 * @param cursor - The cursor to read from
 * @returns A Number token with start and end positions
 * @throws Error if scientific notation is malformed (e.g., "1e" without digits)
 */
function lexNumber(cursor: Cursor): Token {
	const start = cursor.pos
	let hasDecimal = false
	let hasExponent = false

	let ch = peek(cursor)

	// Handle decimal shorthand (.5 means 0.5)
	// Caller (nextToken) has already verified a digit follows the dot
	if (ch === 0x2e) {
		hasDecimal = true
		advance(cursor)
		ch = peek(cursor)
	}

	// Main number parsing loop
	while (ch !== 0) {
		if (isDigit(ch)) {
			advance(cursor)
			ch = peek(cursor)
		} else if (ch === 0x2e && !hasDecimal && !hasExponent) {
			// Decimal point (only one allowed, not in exponent)
			hasDecimal = true
			advance(cursor)
			ch = peek(cursor)
		} else if ((ch === 0x65 || ch === 0x45) && !hasExponent) {
			// Scientific notation: 'e' or 'E'
			hasExponent = true
			advance(cursor)
			ch = peek(cursor)

			// Optional sign: '+' or '-'
			if (ch === 0x2b || ch === 0x2d) {
				advance(cursor)
				ch = peek(cursor)
			}

			// Must have at least one digit after 'e'/'E' and optional sign
			if (!isDigit(ch)) {
				throw new Error(
					`Invalid number: expected digit after exponent at position ${cursor.pos}`,
				)
			}

			// Consume all exponent digits
			while (isDigit(ch)) {
				advance(cursor)
				ch = peek(cursor)
			}

			// Scientific notation ends the number
			break
		} else {
			// Not part of number, stop parsing
			break
		}
	}

	return [TokenKind.Number, start, cursor.pos]
}

/**
 * Lex an identifier token
 * Identifiers start with a letter or underscore, followed by letters, digits, or underscores
 * Examples: x, my_var, NOW, _temp, variable123
 * @param cursor - The cursor to read from
 * @returns An Identifier token with start and end positions
 */
function lexIdentifier(cursor: Cursor): Token {
	const start = cursor.pos

	// Consume first character (caller has verified it's valid: letter or underscore)
	advance(cursor)

	let ch = peek(cursor)

	// Consume remaining identifier characters: letters, digits, or underscores
	while (isAlpha(ch) || isDigit(ch) || ch === 0x5f) {
		advance(cursor)
		ch = peek(cursor)
	}

	return [TokenKind.Identifier, start, cursor.pos]
}
