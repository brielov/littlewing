import { ParseError } from './errors.js';

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

	// Range operators
	DotDot, // ..
	DotDotEq, // ..=

	// Punctuation
	LParen, // (
	RParen, // )
	LBracket, // [
	RBracket, // ]
	Eq, // =
	Comma, // ,
	Semicolon, // ;

	// Pipe
	Pipe, // |>
	Question, // ?

	// Keywords
	If,
	Then,
	Else,
	For,
	In,
	When,
	Into,
	True,
	False,

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
	['into', TokenKind.Into],
	['true', TokenKind.True],
	['false', TokenKind.False],
]);

const MAX_KEYWORD_LENGTH = 5;

/**
 * Check if a character code starts some keyword (e, f, i, t, w)
 */
function startsKeyword(ch: number): boolean {
	return ch === 0x65 || ch === 0x66 || ch === 0x69 || ch === 0x74 || ch === 0x77;
}

/**
 * Longest allowed identifier. Engines hash long strings by length alone, so names
 * beyond this would make every variable lookup walk a chain of colliding names.
 */
const MAX_IDENTIFIER_LENGTH = 1024;

/**
 * Token representation as a tuple for maximum performance
 * [kind, start, end] - text can be extracted via readText()
 */
export type Token = [kind: TokenKind, start: number, end: number];

/**
 * A comment collected during lexing, with its source text and UTF-16 offset.
 */
export interface Comment {
	readonly text: string;
	readonly offset: number;
}

/**
 * Cursor for tracking position during lexical analysis
 * Uses mutable position for zero-allocation iteration
 */
export interface Cursor {
	readonly source: string;
	readonly len: number;
	readonly comments: Comment[];
	pos: number;
	/** Whether a line break separates the most recently returned token from the one before it */
	newlineBefore: boolean;
}

/**
 * Create a new cursor for the given source code
 */
export function createCursor(source: string): Cursor {
	return {
		source,
		len: source.length,
		comments: [],
		// A leading byte order mark is not part of the program
		pos: source.charCodeAt(0) === 0xfeff ? 1 : 0,
		newlineBefore: false,
	};
}

/**
 * Peek at a character code without consuming it
 */
function peek(cursor: Cursor, offset = 0): number {
	return cursor.pos + offset < cursor.len ? cursor.source.charCodeAt(cursor.pos + offset) : 0;
}

/**
 * Consume and return the current character code
 */
function advance(cursor: Cursor): number {
	const char = cursor.source.charCodeAt(cursor.pos);
	cursor.pos++;
	return char;
}

/**
 * Skip whitespace and collect comments up to the next token, recording whether
 * a line break was crossed.
 */
function skipTrivia(cursor: Cursor): void {
	const { source, len } = cursor;
	let pos = cursor.pos;
	let newlineBefore = false;

	while (pos < len) {
		const ch = source.charCodeAt(pos);
		if (ch === 0x0a || ch === 0x0d) {
			newlineBefore = true;
			pos++;
		} else if (ch === 0x20 || ch === 0x09) {
			pos++;
		} else if (ch === 0x2f && source.charCodeAt(pos + 1) === 0x2f) {
			const offset = pos;
			pos += 2;
			while (pos < len) {
				const c = source.charCodeAt(pos);
				if (c === 0x0a || c === 0x0d) break;
				pos++;
			}
			cursor.comments.push({ text: source.slice(offset, pos), offset });
		} else {
			break;
		}
	}

	cursor.pos = pos;
	cursor.newlineBefore = newlineBefore;
}

/**
 * Check if character code is a digit (0-9)
 */
function isDigit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39;
}

/**
 * Check if character code can start an identifier (a-z, A-Z, _)
 */
function isIdentifierStart(ch: number): boolean {
	return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a) || ch === 0x5f;
}

/**
 * Check if character code can continue an identifier (a-z, A-Z, 0-9, _)
 */
function isIdentifierPart(ch: number): boolean {
	return isIdentifierStart(ch) || isDigit(ch);
}

/**
 * Extract the text content of a token from the source
 */
export function readText(cursor: Cursor, token: Token): string {
	return cursor.source.slice(token[1], token[2]);
}

/**
 * Extract the string value from a String token.
 * Strips the surrounding quotes and resolves escape sequences.
 */
export function readStringValue(cursor: Cursor, token: Token): string {
	// Slice between the quotes
	const raw = cursor.source.slice(token[1] + 1, token[2] - 1);
	// Fast path: no backslashes
	if (!raw.includes('\\')) return raw;

	let result = '';
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '\\' && i + 1 < raw.length) {
			i++;
			const ch = raw[i];
			switch (ch) {
				case 'n':
					result += '\n';
					break;
				case 'r':
					result += '\r';
					break;
				case 't':
					result += '\t';
					break;
				case '\\':
					result += '\\';
					break;
				case '"':
					result += '"';
					break;
				default:
					// Unknown escape: preserve as-is
					result += `\\${ch}`;
			}
		} else {
			result += raw[i];
		}
	}
	return result;
}

/**
 * Get the next token from the source
 */
export function nextToken(cursor: Cursor): Token {
	skipTrivia(cursor);

	if (cursor.pos >= cursor.len) {
		return [TokenKind.Eof, cursor.pos, cursor.pos];
	}

	const start = cursor.pos;
	const ch = peek(cursor);

	if (isDigit(ch)) {
		return lexNumber(cursor);
	}

	if (isIdentifierStart(ch)) {
		return lexIdentifier(cursor);
	}

	switch (ch) {
		case 0x22: // "
			return lexString(cursor);
		case 0x2b: // +
			advance(cursor);
			return [TokenKind.Plus, start, cursor.pos];
		case 0x2d: // -
			advance(cursor);
			return [TokenKind.Minus, start, cursor.pos];
		case 0x2a: // *
			advance(cursor);
			return [TokenKind.Star, start, cursor.pos];
		case 0x2f: // /
			advance(cursor);
			return [TokenKind.Slash, start, cursor.pos];
		case 0x25: // %
			advance(cursor);
			return [TokenKind.Percent, start, cursor.pos];
		case 0x5e: // ^
			advance(cursor);
			return [TokenKind.Caret, start, cursor.pos];
		case 0x28: // (
			advance(cursor);
			return [TokenKind.LParen, start, cursor.pos];
		case 0x29: // )
			advance(cursor);
			return [TokenKind.RParen, start, cursor.pos];
		case 0x5b: // [
			advance(cursor);
			return [TokenKind.LBracket, start, cursor.pos];
		case 0x5d: // ]
			advance(cursor);
			return [TokenKind.RBracket, start, cursor.pos];
		case 0x3d: // =
			advance(cursor);
			if (peek(cursor) === 0x3d) {
				advance(cursor);
				return [TokenKind.EqEq, start, cursor.pos];
			}
			return [TokenKind.Eq, start, cursor.pos];
		case 0x21: // !
			advance(cursor);
			if (peek(cursor) === 0x3d) {
				advance(cursor);
				return [TokenKind.NotEq, start, cursor.pos];
			}
			return [TokenKind.Bang, start, cursor.pos];
		case 0x3c: // <
			advance(cursor);
			if (peek(cursor) === 0x3d) {
				advance(cursor);
				return [TokenKind.Le, start, cursor.pos];
			}
			return [TokenKind.Lt, start, cursor.pos];
		case 0x3e: // >
			advance(cursor);
			if (peek(cursor) === 0x3d) {
				advance(cursor);
				return [TokenKind.Ge, start, cursor.pos];
			}
			return [TokenKind.Gt, start, cursor.pos];
		case 0x2e: // .
			if (peek(cursor, 1) === 0x2e) {
				advance(cursor);
				advance(cursor);
				if (peek(cursor) === 0x3d) {
					advance(cursor);
					return [TokenKind.DotDotEq, start, cursor.pos];
				}
				return [TokenKind.DotDot, start, cursor.pos];
			}
			throw unexpectedCharacter(cursor, start);
		case 0x2c: // ,
			advance(cursor);
			return [TokenKind.Comma, start, cursor.pos];
		case 0x3b: // ;
			advance(cursor);
			return [TokenKind.Semicolon, start, cursor.pos];
		case 0x26: // &
			advance(cursor);
			if (peek(cursor) === 0x26) {
				advance(cursor);
				return [TokenKind.And, start, cursor.pos];
			}
			throw unexpectedCharacter(cursor, start);
		case 0x7c: // |
			advance(cursor);
			if (peek(cursor) === 0x7c) {
				advance(cursor);
				return [TokenKind.Or, start, cursor.pos];
			}
			if (peek(cursor) === 0x3e) {
				advance(cursor);
				return [TokenKind.Pipe, start, cursor.pos];
			}
			throw unexpectedCharacter(cursor, start);
		case 0x3f: // ?
			advance(cursor);
			return [TokenKind.Question, start, cursor.pos];
		default:
			throw unexpectedCharacter(cursor, start);
	}
}

/**
 * Build the error for the character at `start`, spanning a whole code point.
 */
function unexpectedCharacter(cursor: Cursor, start: number): ParseError {
	const char = String.fromCodePoint(cursor.source.codePointAt(start) as number);
	return new ParseError(`Unexpected character '${char}'`, start, start + char.length);
}

/**
 * Lex a string literal enclosed in double quotes.
 * Handles escape sequences by skipping the character after backslash.
 */
function lexString(cursor: Cursor): Token {
	const start = cursor.pos;
	advance(cursor); // skip opening "

	while (cursor.pos < cursor.len) {
		const ch = cursor.source.charCodeAt(cursor.pos);
		if (ch === 0x5c) {
			// backslash: skip it and the escaped character
			cursor.pos = Math.min(cursor.pos + 2, cursor.len);
		} else if (ch === 0x22) {
			// closing "
			cursor.pos++;
			return [TokenKind.String, start, cursor.pos];
		} else {
			cursor.pos++;
		}
	}

	throw new ParseError('Unterminated string', start, cursor.pos);
}

/**
 * Lex a number token.
 * Supports integers (42), decimals (3.14) and exponents (1e5, 2.5E-3).
 * Only consumes a decimal point if followed by a digit, to avoid ambiguity with
 * the range operator (..). A number must not run into an identifier: `3x` and
 * `1e` are errors, not two tokens.
 */
function lexNumber(cursor: Cursor): Token {
	const start = cursor.pos;
	const { source, len } = cursor;
	let pos = cursor.pos;

	while (pos < len && isDigit(source.charCodeAt(pos))) {
		pos++;
	}

	if (source.charCodeAt(pos) === 0x2e && isDigit(source.charCodeAt(pos + 1))) {
		pos++;
		while (pos < len && isDigit(source.charCodeAt(pos))) {
			pos++;
		}
	}

	const e = source.charCodeAt(pos);
	if (e === 0x65 || e === 0x45) {
		const sign = source.charCodeAt(pos + 1);
		const digits = sign === 0x2b || sign === 0x2d ? pos + 2 : pos + 1;
		if (isDigit(source.charCodeAt(digits))) {
			pos = digits + 1;
			while (pos < len && isDigit(source.charCodeAt(pos))) {
				pos++;
			}
		}
	}

	if (pos < len && isIdentifierStart(source.charCodeAt(pos))) {
		while (pos < len && isIdentifierPart(source.charCodeAt(pos))) {
			pos++;
		}
		throw new ParseError(`Invalid number '${source.slice(start, pos)}'`, start, pos);
	}

	cursor.pos = pos;
	return [TokenKind.Number, start, pos];
}

function lexIdentifier(cursor: Cursor): Token {
	const start = cursor.pos;
	const { source, len } = cursor;
	let pos = cursor.pos + 1;

	while (pos < len && isIdentifierPart(source.charCodeAt(pos))) {
		pos++;
	}

	cursor.pos = pos;

	if (pos - start > MAX_IDENTIFIER_LENGTH) {
		throw new ParseError('Identifier is too long', start, pos);
	}

	// Most names cannot be keywords, which spares slicing and hashing them
	if (pos - start <= MAX_KEYWORD_LENGTH && startsKeyword(source.charCodeAt(start))) {
		const keywordKind = KEYWORDS.get(source.slice(start, pos));
		if (keywordKind !== undefined) {
			return [keywordKind, start, pos];
		}
	}

	return [TokenKind.Identifier, start, pos];
}
