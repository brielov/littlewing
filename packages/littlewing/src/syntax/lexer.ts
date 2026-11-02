import type { Diagnostic } from '../diagnostics.js';
import { errorAt } from '../diagnostics.js';
import { parseNumber } from '../number.js';

export const enum TokenKind {
	Number,
	Identifier,
	/** A string with no interpolation. */
	String,
	/** A string up to its first `#{`. */
	TemplateHead,
	/** Text between one `}` and the next `#{`. */
	TemplateMiddle,
	/** Text from the last `}` to the end of the string. */
	TemplateTail,

	Plus,
	Minus,
	Star,
	Slash,
	Percent,
	Caret,
	Bang,

	EqEq,
	NotEq,
	Lt,
	Gt,
	Le,
	Ge,

	And,
	Or,
	Fallback,

	DotDot,
	DotDotEq,
	Spread,
	Dot,

	LParen,
	RParen,
	LBracket,
	RBracket,
	LBrace,
	RBrace,
	Eq,
	InputEq,
	Comma,
	Semicolon,
	Colon,

	Pipe,
	Question,

	If,
	Then,
	Else,
	For,
	In,
	When,
	Into,
	True,
	False,
	/** A word reserved for later, which only a field can be named. */
	Reserved,

	Eof,
}

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
	['null', TokenKind.Reserved],
	['let', TokenKind.Reserved],
	['fn', TokenKind.Reserved],
	['match', TokenKind.Reserved],
]);

/** Whether a word is a keyword or reserved, so that a program cannot use it as a name. */
export function isKeyword(word: string): boolean {
	return KEYWORDS.has(word);
}

const MAX_KEYWORD_LENGTH = 5;

/** Most names cannot be keywords, which spares slicing and hashing them. */
function startsKeyword(ch: number): boolean {
	// e, f, i, l, m, n, t, w
	return (
		ch === 0x65 ||
		ch === 0x66 ||
		ch === 0x69 ||
		ch === 0x6c ||
		ch === 0x6d ||
		ch === 0x6e ||
		ch === 0x74 ||
		ch === 0x77
	);
}

/** A name a program can give, and what keeps variable lookups from degrading. */
const MAX_IDENTIFIER_LENGTH = 1024;

/** Whether a token is a word, which is all a field name has to be. */
export function isWord(kind: TokenKind): boolean {
	return kind === TokenKind.Identifier || (kind >= TokenKind.If && kind <= TokenKind.Reserved);
}

/** `[kind, start, end, whether a line break comes before it]` */
export type Token = readonly [kind: TokenKind, start: number, end: number, lineBreak: boolean];

export interface Comment {
	readonly text: string;
	readonly offset: number;
}

export interface Cursor {
	readonly source: string;
	readonly len: number;
	readonly comments: Comment[];
	readonly diagnostics: Diagnostic[];
	pos: number;
}

const UNPAIRED_SURROGATE = /\p{Cs}/u;

export function createCursor(source: string): Cursor {
	const cursor: Cursor = {
		source,
		len: source.length,
		comments: [],
		diagnostics: [],
		// A leading byte order mark is not part of the program
		pos: source.charCodeAt(0) === 0xfeff ? 1 : 0,
	};

	// Anywhere in the source, comments and strings included
	const surrogate = UNPAIRED_SURROGATE.exec(source);
	if (surrogate !== null) {
		const { index } = surrogate;
		report(cursor, 'invalid-character', 'Unpaired surrogate', index, index + 1);
	}
	return cursor;
}

/**
 * Keeps a hostile source from turning every character into a report, which would
 * take hundreds of bytes of memory for each byte of source.
 */
const MAX_DIAGNOSTICS = 100;

/** Report a problem. Past the limit nothing more is worth finding, so reading stops. */
export function report(
	cursor: Cursor,
	code: string,
	message: string,
	start: number,
	end: number,
): void {
	if (cursor.diagnostics.length < MAX_DIAGNOSTICS) {
		cursor.diagnostics.push(errorAt(code, message, start, end));
	} else {
		cursor.pos = cursor.len;
	}
}

/** Shorten source text for a message, as it can be as long as the source. */
export function clip(text: string): string {
	if (text.length <= 40) return text;
	return `${Array.from(text.slice(0, 40)).slice(0, -1).join('')}...`;
}

function isDigit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39;
}

function isAsciiNameStart(ch: number): boolean {
	return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a) || ch === 0x5f;
}

function isAsciiNamePart(ch: number): boolean {
	return isAsciiNameStart(ch) || isDigit(ch);
}

const XID_START = /^\p{XID_Start}$/u;
const XID_CONTINUE = /^\p{XID_Continue}$/u;

function codePointText(source: string, pos: number): string {
	return String.fromCodePoint(source.codePointAt(pos) as number);
}

/** The width of a name character at `pos`, or 0 if there is none. */
function nameCharacter(source: string, pos: number, pattern: RegExp): number {
	if (source.charCodeAt(pos) < 0x80) return 0;
	const text = codePointText(source, pos);
	return pattern.test(text) ? text.length : 0;
}

/** The end of the name characters from `pos`. */
function nameEnd(source: string, len: number, pos: number): number {
	while (pos < len) {
		if (isAsciiNamePart(source.charCodeAt(pos))) {
			pos++;
		} else {
			const width = nameCharacter(source, pos, XID_CONTINUE);
			if (width === 0) break;
			pos += width;
		}
	}
	return pos;
}

function skipTrivia(cursor: Cursor): boolean {
	const { source, len } = cursor;
	let pos = cursor.pos;
	let lineBreak = false;

	while (pos < len) {
		const ch = source.charCodeAt(pos);
		if (ch === 0x0a || ch === 0x0d) {
			lineBreak = true;
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
	return lineBreak;
}

function digitsEnd(source: string, len: number, pos: number): number {
	while (pos < len) {
		const ch = source.charCodeAt(pos);
		if (!isDigit(ch) && ch !== 0x5f) break;
		pos++;
	}
	return pos;
}

/**
 * Whether a number is certainly valid, with nothing to read: just digits and a
 * point, few enough to fit, and no leading zero. Almost all of them are this.
 */
function isPlainNumber(source: string, start: number, end: number): boolean {
	if (end - start > 34) return false;
	if (source.charCodeAt(start) === 0x30 && isDigit(source.charCodeAt(start + 1))) return false;
	for (let i = start; i < end; i++) {
		const ch = source.charCodeAt(i);
		if (!isDigit(ch) && ch !== 0x2e) return false;
	}
	return true;
}

/** Whether digits and separators form `digit { [ "_" ] digit }`. */
function isDigitRun(source: string, start: number, end: number): boolean {
	if (source.charCodeAt(start) === 0x5f || source.charCodeAt(end - 1) === 0x5f) return false;
	for (let i = start + 1; i < end; i++) {
		if (source.charCodeAt(i) === 0x5f && source.charCodeAt(i - 1) === 0x5f) return false;
	}
	return true;
}

function lexNumber(cursor: Cursor, lineBreak: boolean): Token {
	const { source, len } = cursor;
	const start = cursor.pos;
	let pos = digitsEnd(source, len, start);

	const zeroLed = source.charCodeAt(start) === 0x30 && pos - start > 1;
	let wellFormed = !zeroLed && isDigitRun(source, start, pos);

	if (source.charCodeAt(pos) === 0x2e && isDigit(source.charCodeAt(pos + 1))) {
		const end = digitsEnd(source, len, pos + 1);
		wellFormed &&= isDigitRun(source, pos + 1, end);
		pos = end;
	}

	const e = source.charCodeAt(pos);
	if (e === 0x65 || e === 0x45) {
		const sign = source.charCodeAt(pos + 1);
		const digits = sign === 0x2b || sign === 0x2d ? pos + 2 : pos + 1;
		if (isDigit(source.charCodeAt(digits))) {
			const end = digitsEnd(source, len, digits);
			wellFormed &&= isDigitRun(source, digits, end);
			pos = end;
		}
	}

	// Whatever runs into a number is one invalid number with it
	let runsOn = false;
	if (source.charCodeAt(pos) === 0x2e && source.charCodeAt(pos + 1) !== 0x2e) {
		runsOn = true;
		pos = nameEnd(source, len, pos + 1);
	} else {
		const end = nameEnd(source, len, pos);
		runsOn = end > pos;
		pos = end;
	}

	cursor.pos = pos;
	if (!runsOn && isPlainNumber(source, start, pos))
		return [TokenKind.Number, start, pos, lineBreak];

	const text = source.slice(start, pos);
	if (runsOn || !wellFormed) {
		report(cursor, 'invalid-number', `Invalid number '${clip(text)}'`, start, pos);
	} else if (parseNumber(text.replaceAll('_', '')) === undefined) {
		report(cursor, 'invalid-number', `No number can hold '${clip(text)}' exactly`, start, pos);
	}
	return [TokenKind.Number, start, pos, lineBreak];
}

function lexName(cursor: Cursor, lineBreak: boolean): Token {
	const { source, len } = cursor;
	const start = cursor.pos;
	const pos = nameEnd(source, len, start);
	cursor.pos = pos;

	if (pos - start > MAX_IDENTIFIER_LENGTH) {
		// A code point takes at most two units, so only a short name needs counting
		const long = pos - start > 2 * MAX_IDENTIFIER_LENGTH;
		if (long || Array.from(source.slice(start, pos)).length > MAX_IDENTIFIER_LENGTH) {
			report(cursor, 'identifier-too-long', 'Identifier is too long', start, pos);
		}
	}

	if (pos - start <= MAX_KEYWORD_LENGTH && startsKeyword(source.charCodeAt(start))) {
		const keyword = KEYWORDS.get(source.slice(start, pos));
		if (keyword !== undefined) return [keyword, start, pos, lineBreak];
	}
	return [TokenKind.Identifier, start, pos, lineBreak];
}

function isHex(ch: number): boolean {
	return isDigit(ch) || (ch >= 0x41 && ch <= 0x46) || (ch >= 0x61 && ch <= 0x66);
}

/** The end of a valid `\u{...}` whose `\` is at `pos`, or undefined. */
function unicodeEscapeEnd(source: string, pos: number): number | undefined {
	if (source.charCodeAt(pos + 2) !== 0x7b) return undefined;
	let end = pos + 3;
	while (isHex(source.charCodeAt(end))) end++;
	const digits = end - (pos + 3);
	if (digits < 1 || digits > 6 || source.charCodeAt(end) !== 0x7d) return undefined;
	const code = Number.parseInt(source.slice(pos + 3, end), 16);
	const scalar = code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
	return scalar ? end + 1 : undefined;
}

/**
 * Lex string text from `cursor.pos` up to its end or its next `#{`, giving the
 * end of the text. `open` is the offset of what started this piece.
 */
function lexStringText(cursor: Cursor, open: number): { end: number; closed: boolean } {
	const { source, len } = cursor;
	let pos = cursor.pos;

	while (pos < len) {
		const ch = source.charCodeAt(pos);
		if (ch === 0x22) {
			cursor.pos = pos + 1;
			return { end: pos, closed: true };
		}
		if (ch === 0x23 && source.charCodeAt(pos + 1) === 0x7b) {
			cursor.pos = pos + 2;
			return { end: pos, closed: false };
		}
		if (ch !== 0x5c) {
			pos++;
			continue;
		}

		// A backslash that ends the source is part of the unterminated string
		if (pos + 1 >= len) break;

		const next = source.charCodeAt(pos + 1);
		const unicodeEnd = next === 0x75 ? unicodeEscapeEnd(source, pos) : undefined;
		if (
			next === 0x22 ||
			next === 0x5c ||
			next === 0x23 ||
			next === 0x6e ||
			next === 0x72 ||
			next === 0x74
		) {
			pos += 2;
		} else if (unicodeEnd !== undefined) {
			pos = unicodeEnd;
		} else {
			const width = codePointText(source, pos + 1).length;
			report(cursor, 'invalid-escape', 'Invalid escape', pos, pos + 1 + width);
			pos += 1 + width;
		}
	}

	report(cursor, 'unterminated-string', 'Unterminated string', open, len);
	cursor.pos = len;
	return { end: len, closed: true };
}

function lexString(cursor: Cursor, lineBreak: boolean): Token {
	const start = cursor.pos;
	cursor.pos++;
	const { closed } = lexStringText(cursor, start);
	return [closed ? TokenKind.String : TokenKind.TemplateHead, start, cursor.pos, lineBreak];
}

/**
 * Continue a string after the `}` of an interpolation, which must be the last
 * thing the cursor read.
 */
export function continueTemplate(cursor: Cursor, open: number): Token {
	const start = cursor.pos - 1;
	const { closed } = lexStringText(cursor, open);
	return [closed ? TokenKind.TemplateTail : TokenKind.TemplateMiddle, start, cursor.pos, false];
}

/** The text of a string piece between `start` and `end`, with its escapes resolved. */
export function readStringText(source: string, start: number, end: number): string {
	const raw = source.slice(start, end);
	if (!raw.includes('\\')) return raw;

	let result = '';
	let i = 0;
	while (i < raw.length) {
		const ch = raw[i] as string;
		if (ch !== '\\') {
			result += ch;
			i++;
			continue;
		}
		const next = raw[i + 1];
		i += 2;
		if (next === 'n') result += '\n';
		else if (next === 'r') result += '\r';
		else if (next === 't') result += '\t';
		else if (next === 'u') {
			// An invalid escape was reported, and its value does not matter
			if (raw[i] === '{') {
				let end = i + 1;
				while (isHex(raw.charCodeAt(end))) end++;
				const code = Number.parseInt(raw.slice(i + 1, end), 16);
				if (raw[end] === '}' && code <= 0x10ffff) {
					result += String.fromCodePoint(code);
					i = end + 1;
				}
			}
		} else if (next !== undefined) result += next;
	}
	return result;
}

/** A two character token if the next character is `second`, or else a one character one. */
function either(
	cursor: Cursor,
	lineBreak: boolean,
	second: number,
	long: TokenKind,
	short: TokenKind,
): Token {
	const start = cursor.pos;
	if (cursor.source.charCodeAt(start + 1) === second) {
		cursor.pos += 2;
		return [long, start, cursor.pos, lineBreak];
	}
	cursor.pos++;
	return [short, start, cursor.pos, lineBreak];
}

function single(cursor: Cursor, lineBreak: boolean, kind: TokenKind): Token {
	const start = cursor.pos;
	cursor.pos++;
	return [kind, start, cursor.pos, lineBreak];
}

function lexDots(cursor: Cursor, lineBreak: boolean): Token {
	const { source } = cursor;
	const start = cursor.pos;
	if (source.charCodeAt(start + 1) === 0x2e) {
		const third = source.charCodeAt(start + 2);
		if (third === 0x3d) {
			cursor.pos += 3;
			return [TokenKind.DotDotEq, start, cursor.pos, lineBreak];
		}
		if (third === 0x2e) {
			cursor.pos += 3;
			return [TokenKind.Spread, start, cursor.pos, lineBreak];
		}
		cursor.pos += 2;
		return [TokenKind.DotDot, start, cursor.pos, lineBreak];
	}
	if (isDigit(source.charCodeAt(start + 1))) {
		const end = nameEnd(source, cursor.len, digitsEnd(source, cursor.len, start + 1));
		cursor.pos = end;
		const text = clip(source.slice(start, end));
		report(cursor, 'invalid-number', `Invalid number '${text}'`, start, end);
		return [TokenKind.Number, start, end, lineBreak];
	}
	return single(cursor, lineBreak, TokenKind.Dot);
}

export function nextToken(cursor: Cursor): Token {
	let lineBreak = false;
	for (;;) {
		lineBreak = skipTrivia(cursor) || lineBreak;
		if (cursor.pos >= cursor.len) return [TokenKind.Eof, cursor.pos, cursor.pos, lineBreak];

		const ch = cursor.source.charCodeAt(cursor.pos);
		if (isDigit(ch)) return lexNumber(cursor, lineBreak);
		if (isAsciiNameStart(ch)) return lexName(cursor, lineBreak);

		switch (ch) {
			case 0x22:
				return lexString(cursor, lineBreak);
			case 0x2b:
				return single(cursor, lineBreak, TokenKind.Plus);
			case 0x2d:
				return single(cursor, lineBreak, TokenKind.Minus);
			case 0x2a:
				return single(cursor, lineBreak, TokenKind.Star);
			case 0x2f:
				return single(cursor, lineBreak, TokenKind.Slash);
			case 0x25:
				return single(cursor, lineBreak, TokenKind.Percent);
			case 0x5e:
				return single(cursor, lineBreak, TokenKind.Caret);
			case 0x28:
				return single(cursor, lineBreak, TokenKind.LParen);
			case 0x29:
				return single(cursor, lineBreak, TokenKind.RParen);
			case 0x5b:
				return single(cursor, lineBreak, TokenKind.LBracket);
			case 0x5d:
				return single(cursor, lineBreak, TokenKind.RBracket);
			case 0x7b:
				return single(cursor, lineBreak, TokenKind.LBrace);
			case 0x7d:
				return single(cursor, lineBreak, TokenKind.RBrace);
			case 0x2c:
				return single(cursor, lineBreak, TokenKind.Comma);
			case 0x3b:
				return single(cursor, lineBreak, TokenKind.Semicolon);
			case 0x3a:
				return single(cursor, lineBreak, TokenKind.Colon);
			case 0x3d:
				return either(cursor, lineBreak, 0x3d, TokenKind.EqEq, TokenKind.Eq);
			case 0x21:
				return either(cursor, lineBreak, 0x3d, TokenKind.NotEq, TokenKind.Bang);
			case 0x3c:
				return either(cursor, lineBreak, 0x3d, TokenKind.Le, TokenKind.Lt);
			case 0x3e:
				return either(cursor, lineBreak, 0x3d, TokenKind.Ge, TokenKind.Gt);
			case 0x2e:
				return lexDots(cursor, lineBreak);
			case 0x3f: {
				const next = cursor.source.charCodeAt(cursor.pos + 1);
				if (next === 0x3d) {
					return either(cursor, lineBreak, 0x3d, TokenKind.InputEq, TokenKind.Question);
				}
				return either(cursor, lineBreak, 0x3f, TokenKind.Fallback, TokenKind.Question);
			}
			default:
		}

		if (ch === 0x26 && cursor.source.charCodeAt(cursor.pos + 1) === 0x26) {
			cursor.pos += 2;
			return [TokenKind.And, cursor.pos - 2, cursor.pos, lineBreak];
		}
		if (ch === 0x7c) {
			const next = cursor.source.charCodeAt(cursor.pos + 1);
			if (next === 0x7c || next === 0x3e) {
				cursor.pos += 2;
				return [
					next === 0x7c ? TokenKind.Or : TokenKind.Pipe,
					cursor.pos - 2,
					cursor.pos,
					lineBreak,
				];
			}
		}

		if (nameCharacter(cursor.source, cursor.pos, XID_START) > 0) {
			return lexName(cursor, lineBreak);
		}

		const text = codePointText(cursor.source, cursor.pos);
		const start = cursor.pos;
		cursor.pos += text.length;
		// An unpaired surrogate has been reported, once, wherever it was
		if (!UNPAIRED_SURROGATE.test(text)) {
			report(cursor, 'invalid-character', `Unexpected character '${text}'`, start, cursor.pos);
		}
	}
}
