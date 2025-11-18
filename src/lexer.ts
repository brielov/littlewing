/**
 * Token types for the lexer
 * Represents all valid tokens in the language
 */
export const enum TokenKind {
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
 * Inlined for performance - avoids function call overhead in hot path
 * @param cursor - The cursor to advance
 */
function skipWhitespace(cursor: Cursor): void {
	// 0x20 = space, 0x0a = \n, 0x0d = \r, 0x09 = \t
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
 * Advances cursor to the end of line or EOF
 * Inlined for performance - avoids function call overhead in hot path
 * @param cursor - The cursor to advance
 */
function skipComment(cursor: Cursor): void {
	if (
		cursor.pos < cursor.len - 1 &&
		cursor.source.charCodeAt(cursor.pos) === 0x2f &&
		cursor.source.charCodeAt(cursor.pos + 1) === 0x2f
	) {
		cursor.pos += 2 // Skip both slashes
		// Skip until newline or EOF
		while (cursor.pos < cursor.len) {
			const ch = cursor.source.charCodeAt(cursor.pos)
			if (ch === 0x0a || ch === 0x0d) break
			cursor.pos++
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
 * Optimized for performance - inlined character access to avoid function call overhead
 * @param cursor - The cursor to read from
 * @returns A Number token with start and end positions
 * @throws Error if scientific notation is malformed (e.g., "1e" without digits)
 */
function lexNumber(cursor: Cursor): Token {
	const start = cursor.pos
	const { source, len } = cursor
	let pos = cursor.pos

	// Handle decimal shorthand (.5 means 0.5)
	// Caller (nextToken) has already verified a digit follows the dot
	if (source.charCodeAt(pos) === 0x2e) {
		pos++
		// Skip decimal digits (we know at least one exists from caller check)
		while (
			pos < len &&
			source.charCodeAt(pos) >= 0x30 &&
			source.charCodeAt(pos) <= 0x39
		) {
			pos++
		}
		// Check for scientific notation after decimal shorthand
		const ch = pos < len ? source.charCodeAt(pos) : 0
		if (ch === 0x65 || ch === 0x45) {
			pos = lexExponent(source, len, pos)
		}
		cursor.pos = pos
		return [TokenKind.Number, start, pos]
	}

	// Consume integer part
	while (
		pos < len &&
		source.charCodeAt(pos) >= 0x30 &&
		source.charCodeAt(pos) <= 0x39
	) {
		pos++
	}

	// Check for decimal point
	if (pos < len && source.charCodeAt(pos) === 0x2e) {
		pos++
		// Consume fractional part
		while (
			pos < len &&
			source.charCodeAt(pos) >= 0x30 &&
			source.charCodeAt(pos) <= 0x39
		) {
			pos++
		}
	}

	// Check for scientific notation
	if (pos < len) {
		const ch = source.charCodeAt(pos)
		if (ch === 0x65 || ch === 0x45) {
			pos = lexExponent(source, len, pos)
		}
	}

	cursor.pos = pos
	return [TokenKind.Number, start, pos]
}

/**
 * Lex the exponent part of scientific notation
 * Assumes pos points to 'e' or 'E'
 * @param source - Source string
 * @param len - Length of source
 * @param pos - Current position (at 'e'/'E')
 * @returns New position after exponent
 */
function lexExponent(source: string, len: number, pos: number): number {
	pos++ // Skip 'e' or 'E'

	// Optional sign: '+' or '-'
	if (pos < len) {
		const next = source.charCodeAt(pos)
		if (next === 0x2b || next === 0x2d) {
			pos++
		}
	}

	// Must have at least one digit after 'e'/'E' and optional sign
	if (pos >= len || !isDigit(source.charCodeAt(pos))) {
		throw new Error(
			`Invalid number: expected digit after exponent at position ${pos}`,
		)
	}

	// Consume all exponent digits
	while (pos < len && isDigit(source.charCodeAt(pos))) {
		pos++
	}

	return pos
}

/**
 * Lex an identifier token
 * Identifiers start with a letter or underscore, followed by letters, digits, or underscores
 * Examples: x, my_var, NOW, _temp, variable123
 * Optimized for performance - inlined character access to avoid function call overhead
 * @param cursor - The cursor to read from
 * @returns An Identifier token with start and end positions
 */
function lexIdentifier(cursor: Cursor): Token {
	const start = cursor.pos
	const { source, len } = cursor
	let pos = cursor.pos + 1 // Skip first char (already validated)

	// Consume remaining identifier characters: letters, digits, or underscores
	// Inline isAlpha and isDigit checks for performance
	while (pos < len) {
		const ch = source.charCodeAt(pos)
		if (
			(ch >= 0x41 && ch <= 0x5a) || // A-Z
			(ch >= 0x61 && ch <= 0x7a) || // a-z
			(ch >= 0x30 && ch <= 0x39) || // 0-9
			ch === 0x5f // _
		) {
			pos++
		} else {
			break
		}
	}

	cursor.pos = pos
	return [TokenKind.Identifier, start, pos]
}
