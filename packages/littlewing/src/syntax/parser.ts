import type { Diagnostic } from '../diagnostics.js';
import { ParseError } from '../errors.js';
import type { BinaryOperator, Expression, Program, RecordMember, Statement } from './ast.js';
import { Precedence } from './ast.js';
import type { Comment, Cursor, Token } from './lexer.js';
import {
	clip,
	continueTemplate,
	createCursor,
	isWord,
	nextToken,
	readStringText,
	report as reportAt,
	TokenKind,
} from './lexer.js';

/** Open delimiters at once: language section 11. */
const MAX_NESTING = 256;

/** The tallest statement: language section 11. */
const MAX_HEIGHT = 1024;

/**
 * Parser recursion. A recursive call adds a level to the tree or opens a
 * delimiter, so a program this deep is past one of the two limits. This stops
 * `- - - - ...`, whose height is only known on the way back up.
 */
const MAX_DEPTH = MAX_HEIGHT + MAX_NESTING;

/** Thrown to abandon a statement after reporting what is wrong with it. */
const BAIL = Symbol('bail');

const NON_ASCII = /[^\0-\x7f]/;

/** The UTF-16 length of the longest name: 1024 code points of two units each. */
const MAX_NAME_UNITS = 2048;

interface ParserState {
	readonly cursor: Cursor;
	readonly source: string;
	token: Token;
	/** The token after `token`, if a statement start has looked at it. */
	lookahead: Token | undefined;
	previousEnd: number;
	/** Open delimiters, including the keyword pairs inside which line breaks mean nothing. */
	enclosed: number;
	/** Open brackets, for finding the end of a broken statement. */
	brackets: number;
	/** Recursive calls in progress. */
	depth: number;
	/** The height of the expression parsed last. */
	height: number;
	/** Open record literals, for finding the end of a broken interpolation. */
	braces: number;
	/** Strings whose interpolation is open. */
	templates: number;
	/** Where the innermost such string starts. */
	templateStart: number;
	/** Expressions in parentheses, which a path of `??` may not contain. */
	readonly parenthesized: Set<Expression>;
	/** Placeholders not yet claimed by a pipe step. */
	readonly placeholders: Set<Expression>;
}

export interface ParseResult {
	/** Absent only if no statement could be read. */
	readonly program: Program | undefined;
	readonly diagnostics: readonly Diagnostic[];
}

function report(
	state: ParserState,
	code: string,
	message: string,
	start: number,
	end: number,
): void {
	reportAt(state.cursor, code, message, start, end);
}

function advance(state: ParserState): void {
	state.previousEnd = state.token[2];
	state.token = state.lookahead ?? nextToken(state.cursor);
	state.lookahead = undefined;
}

function peekNext(state: ParserState): Token {
	state.lookahead ??= nextToken(state.cursor);
	return state.lookahead;
}

function describe(state: ParserState): string {
	const [kind, start, end] = state.token;
	return kind === TokenKind.Eof ? 'end of input' : `'${clip(state.source.slice(start, end))}'`;
}

function unexpected(state: ParserState, expected: string): never {
	// If the lexer has reported something here, that is the mistake, and this follows from it
	const latest = state.cursor.diagnostics.at(-1);
	if (latest !== undefined && latest.start >= state.previousEnd) throw BAIL;

	const [kind, start, end] = state.token;
	if (kind === TokenKind.Eof && latest?.code === 'unterminated-string') throw BAIL;
	if (kind === TokenKind.Eof && state.templates > 0) {
		report(state, 'unterminated-string', 'Unterminated string', state.templateStart, end);
	} else {
		report(state, 'unexpected-token', `Expected ${expected}, got ${describe(state)}`, start, end);
	}
	throw BAIL;
}

function expect(state: ParserState, kind: TokenKind, expected: string): void {
	if (state.token[0] !== kind) unexpected(state, expected);
	advance(state);
}

function tooDeep(state: ParserState): never {
	const [, start, end] = state.token;
	report(state, 'too-deep', 'Expression is too deeply nested', start, end);
	throw BAIL;
}

function setHeight(state: ParserState, height: number): void {
	if (height > MAX_HEIGHT) tooDeep(state);
	state.height = height;
}

function enter(state: ParserState): void {
	if (++state.enclosed > MAX_NESTING) tooDeep(state);
}

function leave(state: ParserState): void {
	state.enclosed--;
}

function openBracket(state: ParserState): void {
	advance(state);
	state.brackets++;
	enter(state);
}

function closeBracket(state: ParserState, kind: TokenKind, expected: string): void {
	expect(state, kind, expected);
	state.brackets--;
	leave(state);
}

/** Whether the current token is on a new line where that ends an expression. */
function startsLine(state: ParserState): boolean {
	return state.token[3] && state.enclosed === 0;
}

/** The name an identifier token stands for: its NFC form. */
function nameOf(state: ParserState, token: Token): string {
	const text = state.source.slice(token[1], token[2]);
	// Normalizing is quadratic on combining marks. Past this the lexer has reported
	// the name as too long, whatever its characters
	if (text.length > MAX_NAME_UNITS || !NON_ASCII.test(text)) return text;
	return text.normalize('NFC');
}

function expectName(state: ParserState, expected: string): string {
	const { token } = state;
	if (token[0] !== TokenKind.Identifier) unexpected(state, expected);
	advance(state);
	return nameOf(state, token);
}

function fieldName(state: ParserState): string {
	const { token } = state;
	if (!isWord(token[0])) unexpected(state, 'a field name');
	advance(state);
	return nameOf(state, token);
}

const BINARY_PRECEDENCE: Partial<Record<TokenKind, number>> = {
	[TokenKind.Pipe]: Precedence.Pipe,
	[TokenKind.Or]: Precedence.Or,
	[TokenKind.And]: Precedence.And,
	[TokenKind.EqEq]: Precedence.Compare,
	[TokenKind.NotEq]: Precedence.Compare,
	[TokenKind.Lt]: Precedence.Compare,
	[TokenKind.Gt]: Precedence.Compare,
	[TokenKind.Le]: Precedence.Compare,
	[TokenKind.Ge]: Precedence.Compare,
	[TokenKind.Fallback]: Precedence.Fallback,
	[TokenKind.DotDot]: Precedence.Range,
	[TokenKind.DotDotEq]: Precedence.Range,
	[TokenKind.Plus]: Precedence.Add,
	[TokenKind.Minus]: Precedence.Add,
	[TokenKind.Star]: Precedence.Multiply,
	[TokenKind.Slash]: Precedence.Multiply,
	[TokenKind.Percent]: Precedence.Multiply,
	[TokenKind.Caret]: Precedence.Power,
};

function parseExpression(state: ParserState, minimum: number): Expression {
	if (++state.depth > MAX_DEPTH) tooDeep(state);

	const start = state.token[1];
	let left = parsePrefix(state);
	let height = state.height;
	// The tightest operator that can still apply to `left`. Operators tighter than
	// what built it are not its to take, as a pipe step is followed only by a pipe,
	// and ranges do not chain. They go back to the caller, which is usually an error.
	let ceiling: number = Precedence.Atom;

	for (;;) {
		const kind = state.token[0];
		if ((kind === TokenKind.Dot || kind === TokenKind.LBracket) && ceiling < Precedence.Postfix) {
			break;
		}

		if (kind === TokenKind.Dot) {
			advance(state);
			const name = fieldName(state);
			left = { kind: 'member', object: left, name, start, end: state.previousEnd };
			setHeight(state, height + 1);
			height = state.height;
			continue;
		}

		if (kind === TokenKind.LBracket) {
			if (startsLine(state)) break;
			openBracket(state);
			const index = parseExpression(state, Precedence.None);
			setHeight(state, Math.max(height, state.height) + 1);
			height = state.height;
			closeBracket(state, TokenKind.RBracket, "']'");
			left = { kind: 'index', object: left, index, start, end: state.previousEnd };
			continue;
		}

		const precedence = BINARY_PRECEDENCE[kind];
		if (precedence === undefined || precedence < minimum || precedence > ceiling) break;
		if (kind === TokenKind.Minus && startsLine(state)) break;

		if (kind === TokenKind.Pipe) {
			left = parsePipe(state, left, height, start);
			height = state.height;
			ceiling = Precedence.Pipe;
			continue;
		}

		if (kind === TokenKind.Fallback) {
			checkPath(state, left, start);
			advance(state);
			const fallback = parseExpression(state, Precedence.Fallback);
			setHeight(state, Math.max(height, state.height) + 1);
			height = state.height;
			left = { kind: 'fallback', path: left, fallback, start, end: state.previousEnd };
			ceiling = Precedence.Compare;
			continue;
		}

		if (kind === TokenKind.DotDot || kind === TokenKind.DotDotEq) {
			advance(state);
			const to = parseExpression(state, Precedence.Range + 1);
			setHeight(state, Math.max(height, state.height) + 1);
			height = state.height;
			const inclusive = kind === TokenKind.DotDotEq;
			left = { kind: 'range', from: left, to, inclusive, start, end: state.previousEnd };
			ceiling = Precedence.Fallback;
			continue;
		}

		const operator = state.source.slice(state.token[1], state.token[2]) as BinaryOperator;
		advance(state);
		const rightMinimum = kind === TokenKind.Caret ? precedence : precedence + 1;
		const right = parseExpression(state, rightMinimum);
		setHeight(state, Math.max(height, state.height) + 1);
		height = state.height;
		left = { kind: 'binary', operator, left, right, start, end: state.previousEnd };
		ceiling = kind === TokenKind.Caret ? Precedence.Multiply : precedence;
	}

	state.height = height;
	state.depth--;
	return left;
}

function parsePrefix(state: ParserState): Expression {
	const { token } = state;
	const [kind, start, end] = token;

	switch (kind) {
		case TokenKind.Minus:
		case TokenKind.Bang: {
			advance(state);
			const argument = parseExpression(state, Precedence.Power);
			setHeight(state, state.height + 1);
			const operator = kind === TokenKind.Minus ? '-' : '!';
			return { kind: 'unary', operator, argument, start, end: state.previousEnd };
		}

		case TokenKind.LParen: {
			openBracket(state);
			const expression = parseExpression(state, Precedence.None);
			closeBracket(state, TokenKind.RParen, "')'");
			state.parenthesized.add(expression);
			return expression;
		}

		case TokenKind.LBracket:
			return parseArray(state);
		case TokenKind.LBrace:
			return parseRecord(state);
		case TokenKind.If:
			return parseIf(state);
		case TokenKind.For:
			return parseFor(state);

		case TokenKind.Number:
			advance(state);
			state.height = 1;
			return { kind: 'number', text: state.source.slice(start, end), start, end };

		case TokenKind.String:
			advance(state);
			state.height = 1;
			return {
				kind: 'string',
				value: readStringText(state.source, start + 1, end - 1),
				start,
				end,
			};

		case TokenKind.TemplateHead:
			return parseTemplate(state);

		case TokenKind.True:
		case TokenKind.False:
			advance(state);
			state.height = 1;
			return { kind: 'boolean', value: kind === TokenKind.True, start, end };

		case TokenKind.Question: {
			advance(state);
			state.height = 1;
			const placeholder: Expression = { kind: 'placeholder', start, end };
			state.placeholders.add(placeholder);
			return placeholder;
		}

		case TokenKind.Identifier: {
			const name = nameOf(state, token);
			advance(state);
			if (state.token[0] === TokenKind.LParen && !startsLine(state)) {
				const args = parseArguments(state);
				return { kind: 'call', name, args, start, end: state.previousEnd };
			}
			state.height = 1;
			return { kind: 'name', name, start, end };
		}

		default:
			return unexpected(state, 'an expression');
	}
}

/** Parse `(args)`, setting the height of a call: one more than the tallest argument. */
function parseArguments(state: ParserState): Expression[] {
	openBracket(state);
	const args = parseList(state, TokenKind.RParen);
	closeBracket(state, TokenKind.RParen, "')'");
	return args;
}

/** Parse a list up to `close`, which stays unread, setting the height of what holds it. */
function parseList(state: ParserState, close: TokenKind): Expression[] {
	const items: Expression[] = [];
	let tallest = 0;
	while (state.token[0] !== close) {
		items.push(parseExpression(state, Precedence.None));
		tallest = Math.max(tallest, state.height);
		if (state.token[0] !== TokenKind.Comma) break;
		advance(state);
	}
	setHeight(state, tallest + 1);
	return items;
}

function parseArray(state: ParserState): Expression {
	const start = state.token[1];
	openBracket(state);
	const elements = parseList(state, TokenKind.RBracket);
	closeBracket(state, TokenKind.RBracket, "']'");
	return { kind: 'array', elements, start, end: state.previousEnd };
}

function parseRecord(state: ParserState): Expression {
	const start = state.token[1];
	state.braces++;
	openBracket(state);

	const members: RecordMember[] = [];
	const names = new Set<string>();
	let tallest = 0;

	while (state.token[0] !== TokenKind.RBrace) {
		const { token } = state;
		const [kind, memberStart] = token;

		if (kind === TokenKind.Spread) {
			advance(state);
			const value = parseExpression(state, Precedence.None);
			tallest = Math.max(tallest, state.height);
			members.push({ kind: 'spread', value, start: memberStart, end: state.previousEnd });
		} else {
			const next = kind === TokenKind.Identifier ? peekNext(state)[0] : undefined;
			if (next === TokenKind.Comma || next === TokenKind.RBrace) {
				const name = nameOf(state, token);
				advance(state);
				const value: Expression = { kind: 'name', name, start: memberStart, end: token[2] };
				tallest = Math.max(tallest, 1);
				addField(state, names, name, token);
				members.push({
					kind: 'field',
					name,
					value,
					shorthand: true,
					start: memberStart,
					end: token[2],
				});
			} else {
				let name: string;
				if (kind === TokenKind.String) {
					advance(state);
					name = readStringText(state.source, token[1] + 1, token[2] - 1);
				} else {
					name = fieldName(state);
				}
				addField(state, names, name, token);
				expect(state, TokenKind.Colon, "':'");
				const value = parseExpression(state, Precedence.None);
				tallest = Math.max(tallest, state.height);
				members.push({
					kind: 'field',
					name,
					value,
					shorthand: false,
					start: memberStart,
					end: state.previousEnd,
				});
			}
		}

		if (state.token[0] !== TokenKind.Comma) break;
		advance(state);
	}

	setHeight(state, tallest + 1);
	closeBracket(state, TokenKind.RBrace, "'}'");
	state.braces--;
	return { kind: 'record', members, start, end: state.previousEnd };
}

function addField(state: ParserState, names: Set<string>, name: string, token: Token): void {
	if (names.has(name)) {
		report(state, 'duplicate-field', `Field '${clip(name)}' is set twice`, token[1], token[2]);
	}
	names.add(name);
}

/** A string being skipped, and the braces open in its current interpolation. */
interface OpenString {
	readonly open: number;
	braces: number;
}

/**
 * Skip tokens until every string in `strings` has ended, or the source has. This
 * is a loop, as a hostile source can nest strings as deep as it is long.
 */
function skipStrings(state: ParserState, strings: OpenString[]): void {
	while (strings.length > 0) {
		const kind = state.token[0];
		if (kind === TokenKind.Eof) return;

		const top = strings[strings.length - 1] as OpenString;
		if (kind === TokenKind.TemplateHead) {
			strings.push({ open: state.token[1], braces: 0 });
		} else if (kind === TokenKind.LBrace) {
			top.braces++;
		} else if (kind === TokenKind.RBrace) {
			if (top.braces > 0) {
				top.braces--;
			} else {
				state.token = continueTemplate(state.cursor, top.open);
				if (state.token[0] === TokenKind.TemplateTail) strings.pop();
			}
		}
		advance(state);
	}
}

function parseTemplate(state: ParserState): Expression {
	let { token } = state;
	const [, start] = token;
	const outerStart = state.templateStart;
	state.templateStart = start;
	const parts: (string | Expression)[] = [readStringText(state.source, token[1] + 1, token[2] - 2)];
	// The chain of `+` this becomes: a leaf for the first piece of text
	let height = 1;

	for (;;) {
		const { brackets, braces, enclosed } = state;
		state.templates++;
		let expression: Expression;
		try {
			openBracket(state);
			expression = parseExpression(state, Precedence.None);
			if (state.token[0] !== TokenKind.RBrace) unexpected(state, "'}'");
		} catch (error) {
			if (error !== BAIL) throw error;
			// What opened inside the interpolation ends with it
			const opened = state.braces - braces;
			state.brackets = brackets;
			state.braces = braces;
			state.enclosed = enclosed;
			state.templates--;
			state.templateStart = outerStart;
			skipStrings(state, [{ open: start, braces: opened }]);
			throw BAIL;
		}
		state.templates--;
		state.brackets--;
		leave(state);

		// `STR(e)` is a call, and joining it is an operator
		height = Math.max(height, state.height + 1) + 1;
		parts.push(expression);

		token = continueTemplate(state.cursor, start);
		state.token = token;
		const tail = token[0] === TokenKind.TemplateTail;
		const text = readStringText(state.source, token[1] + 1, tail ? token[2] - 1 : token[2] - 2);
		parts.push(text);
		if (text !== '') height++;
		if (tail) break;
	}

	state.templateStart = outerStart;
	advance(state);
	if (height > MAX_HEIGHT) {
		report(state, 'too-deep', 'Expression is too deeply nested', start, state.previousEnd);
		throw BAIL;
	}
	state.height = height;
	return { kind: 'template', parts, start, end: state.previousEnd };
}

function parseIf(state: ParserState): Expression {
	const start = state.token[1];
	enter(state);
	advance(state);
	const condition = parseExpression(state, Precedence.None);
	let tallest = state.height;
	expect(state, TokenKind.Then, "'then'");
	const consequent = parseExpression(state, Precedence.None);
	tallest = Math.max(tallest, state.height);
	leave(state);
	expect(state, TokenKind.Else, "'else'");
	const alternate = parseExpression(state, Precedence.None);
	setHeight(state, Math.max(tallest, state.height) + 1);
	return { kind: 'if', condition, consequent, alternate, start, end: state.previousEnd };
}

function parseFor(state: ParserState): Expression {
	const start = state.token[1];
	enter(state);
	advance(state);
	const variable = expectName(state, 'a loop variable');
	expect(state, TokenKind.In, "'in'");
	const iterable = parseExpression(state, Precedence.None);
	let tallest = state.height;

	let guard: Expression | null = null;
	if (state.token[0] === TokenKind.When) {
		advance(state);
		guard = parseExpression(state, Precedence.None);
		tallest = Math.max(tallest, state.height);
	}

	let accumulator: { name: string; initial: Expression } | null = null;
	if (state.token[0] === TokenKind.Into) {
		advance(state);
		const name = expectName(state, 'an accumulator');
		expect(state, TokenKind.Eq, "'='");
		accumulator = { name, initial: parseExpression(state, Precedence.None) };
		tallest = Math.max(tallest, state.height);
	}

	leave(state);
	expect(state, TokenKind.Then, "'then'");
	const body = parseExpression(state, Precedence.None);
	setHeight(state, Math.max(tallest, state.height) + 1);
	return {
		kind: 'for',
		variable,
		iterable,
		guard,
		accumulator,
		body,
		start,
		end: state.previousEnd,
	};
}

function parsePipe(
	state: ParserState,
	value: Expression,
	height: number,
	start: number,
): Expression {
	advance(state);
	const stepStart = state.token[1];
	const name = expectName(state, 'a function name');

	if (state.token[0] !== TokenKind.LParen || startsLine(state)) {
		setHeight(state, height + 1);
		return { kind: 'pipe', value, name, stepStart, args: null, start, end: state.previousEnd };
	}

	const open = state.token[1];
	const args = parseArguments(state);
	setHeight(state, Math.max(height + 1, state.height));

	let claimed = false;
	for (const arg of args) {
		if (arg.kind === 'placeholder') {
			state.placeholders.delete(arg);
			claimed = true;
		}
	}
	if (!claimed) {
		const message = 'A pipe step with parentheses needs a ?';
		report(state, 'invalid-placeholder', message, open, state.previousEnd);
	}
	return { kind: 'pipe', value, name, stepStart, args, start, end: state.previousEnd };
}

function checkPath(state: ParserState, expression: Expression, start: number): void {
	let node = expression;
	for (;;) {
		if (state.parenthesized.has(node)) break;
		if (node.kind === 'name') return;
		if (node.kind !== 'member' && node.kind !== 'index') break;
		node = node.object;
	}
	const message = 'The left of ?? must be a name, followed by fields and indexes';
	report(state, 'invalid-fallback', message, start, state.previousEnd);
}

function parseStatement(state: ParserState): Statement {
	const { token } = state;
	if (token[0] === TokenKind.Identifier) {
		const next = peekNext(state)[0];
		if (next === TokenKind.Eq || next === TokenKind.InputEq) {
			const name = nameOf(state, token);
			advance(state);
			advance(state);
			const value = parseExpression(state, Precedence.None);
			return {
				kind: 'binding',
				name,
				input: next === TokenKind.InputEq,
				value,
				start: token[1],
				end: state.previousEnd,
			};
		}
	}
	return parseExpression(state, Precedence.None);
}

/** Whether a statement can start with a token of this kind. */
function startsStatement(kind: TokenKind): boolean {
	switch (kind) {
		case TokenKind.Number:
		case TokenKind.Identifier:
		case TokenKind.String:
		case TokenKind.TemplateHead:
		case TokenKind.Minus:
		case TokenKind.Bang:
		case TokenKind.LParen:
		case TokenKind.LBracket:
		case TokenKind.LBrace:
		case TokenKind.If:
		case TokenKind.For:
		case TokenKind.True:
		case TokenKind.False:
		case TokenKind.Question:
		case TokenKind.Reserved:
			return true;
		default:
			return false;
	}
}

/** Skip to where the next statement can start, past any brackets left open. */
function recover(state: ParserState): void {
	let open = state.brackets;
	state.enclosed = 0;
	state.brackets = 0;
	state.braces = 0;

	for (;;) {
		const [kind, start, , lineBreak] = state.token;
		if (kind === TokenKind.Eof) return;
		if (open <= 0 && kind === TokenKind.Semicolon) return;
		if (open <= 0 && lineBreak && startsStatement(kind)) return;

		if (kind === TokenKind.TemplateHead) {
			advance(state);
			skipStrings(state, [{ open: start, braces: 0 }]);
			continue;
		}
		if (kind === TokenKind.LParen || kind === TokenKind.LBracket || kind === TokenKind.LBrace) {
			open++;
		} else if (
			kind === TokenKind.RParen ||
			kind === TokenKind.RBracket ||
			kind === TokenKind.RBrace
		) {
			open--;
		}
		advance(state);
	}
}

function endsStatement(token: Token): boolean {
	return token[0] === TokenKind.Semicolon || token[0] === TokenKind.Eof || token[3];
}

function isInlineComment(source: string, commentOffset: number): boolean {
	let i = commentOffset - 1;
	let ch = source.charCodeAt(i);
	while (ch === 0x20 || ch === 0x09 || ch === 0x3b) ch = source.charCodeAt(--i);
	return ch !== 0x0a && ch !== 0x0d;
}

/**
 * Put comments on statements: one on the same line as code trails it, one on its
 * own line or inside a statement leads a statement, and any left over trail the
 * program.
 */
function attachComments(
	source: string,
	statements: readonly Statement[],
	extents: readonly (readonly [start: number, end: number])[],
	comments: readonly Comment[],
): { statements: readonly Statement[]; trailing: string[] | undefined } {
	if (comments.length === 0) return { statements, trailing: undefined };

	const leading: (string[] | undefined)[] = [];
	const inline: (string[] | undefined)[] = [];
	let programTrailing: string[] | undefined;
	let started = 0;

	for (const comment of comments) {
		while (
			started < statements.length &&
			(extents[started] as readonly [number, number])[0] <= comment.offset
		) {
			started++;
		}
		const current = extents[started - 1];
		if (current !== undefined && comment.offset < current[1]) {
			// Inside a statement, where nothing can hold it, so it goes before it
			(leading[started - 1] ??= []).push(comment.text);
		} else if (started > 0 && isInlineComment(source, comment.offset)) {
			(inline[started - 1] ??= []).push(comment.text);
		} else if (started < statements.length) {
			(leading[started] ??= []).push(comment.text);
		} else {
			(programTrailing ??= []).push(comment.text);
		}
	}

	const result = statements.map((statement, i) => {
		const leadingComments = leading[i];
		const trailingComments = inline[i];
		if (!leadingComments && !trailingComments) return statement;
		return {
			...statement,
			...(leadingComments ? { leadingComments } : {}),
			...(trailingComments ? { trailingComments } : {}),
		};
	});
	return { statements: result, trailing: programTrailing };
}

/**
 * Parse a program for a tool such as a formatter, throwing on its first error.
 */
export function parse(source: string): Program {
	const { program, diagnostics } = parseProgram(source);
	const first = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
	if (first !== undefined || program === undefined) {
		const { code, message, start, end } = first as Diagnostic;
		throw new ParseError(message, start, end, code);
	}
	return program;
}

/**
 * Parse a program, reporting every problem it can find rather than the first. A
 * broken statement is abandoned at its first error, and parsing resumes at the
 * next statement.
 */
export function parseProgram(source: string): ParseResult {
	const cursor = createCursor(source);
	const state: ParserState = {
		cursor,
		source,
		token: nextToken(cursor),
		lookahead: undefined,
		previousEnd: 0,
		enclosed: 0,
		brackets: 0,
		depth: 0,
		height: 0,
		braces: 0,
		templates: 0,
		templateStart: 0,
		parenthesized: new Set(),
		placeholders: new Set(),
	};

	const statements: Statement[] = [];
	// With any outer parentheses, which the nodes leave out
	const extents: [start: number, end: number][] = [];
	let broken = false;

	for (;;) {
		while (state.token[0] === TokenKind.Semicolon) advance(state);
		if (state.token[0] === TokenKind.Eof) break;

		state.depth = 0;
		state.templates = 0;
		const statementStart = state.token[1];
		let failed = false;
		try {
			statements.push(parseStatement(state));
			extents.push([statementStart, state.previousEnd]);
			if (!endsStatement(state.token)) unexpected(state, 'the end of the statement');
		} catch (error) {
			if (error instanceof RangeError) {
				// A small stack, as a program within the limits needs about 700 KB of it
				const [, start, end] = state.token;
				report(state, 'limit-exceeded', 'Out of stack', start, end);
				broken = true;
				break;
			}
			if (error !== BAIL) throw error;
			broken = true;
			failed = true;
			// A token no statement can start with would otherwise be met again and again
			if (state.token[1] === statementStart) advance(state);
			recover(state);
		}

		if (state.placeholders.size > 0) {
			if (!failed) {
				for (const placeholder of state.placeholders) {
					const message = '? is only valid as a whole argument of a pipe step';
					report(state, 'invalid-placeholder', message, placeholder.start, placeholder.end);
				}
			}
			state.placeholders.clear();
		}
		if (state.parenthesized.size > 0) state.parenthesized.clear();
	}

	if (statements.length === 0 && !broken && cursor.diagnostics.length === 0) {
		report(state, 'empty-program', 'Empty program', 0, 0);
	}

	const diagnostics = cursor.diagnostics.slice().sort((a, b) => a.start - b.start);
	if (statements.length === 0) return { program: undefined, diagnostics };

	const attached = attachComments(source, statements, extents, cursor.comments);
	const program: Program = {
		kind: 'program',
		statements: attached.statements,
		start: (statements[0] as Statement).start,
		end: (statements[statements.length - 1] as Statement).end,
		...(attached.trailing ? { trailingComments: attached.trailing } : {}),
	};
	return { program, diagnostics };
}
