/**
 * The source as the editor sees it, read by the library's own lexer, so what is
 * highlighted is exactly what the compiler reads, Unicode names, `_` in numbers
 * and strings nested in interpolations included. The lexer is internal to the
 * library, which is fine for a playground built from the same tree.
 */
import type { Diagnostic } from '../../../littlewing/src/diagnostics.ts';
import {
	continueTemplate,
	createCursor,
	type Cursor,
	isWord,
	nextToken,
	TokenKind,
	type Token as LexerToken,
} from '../../../littlewing/src/syntax/lexer.ts';

export { isWord, TokenKind };

/**
 * Whether a token can start a statement, which a line break before it outside
 * enclosed code then does. Any other token, as an operator, goes on with the
 * statement before it. As the parser's own `startsStatement`.
 */
export function startsStatement(kind: Token['kind']): boolean {
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

/** A token as the lexer gives it, with comments as tokens of their own. */
export interface Token {
	readonly kind: TokenKind | 'comment';
	readonly from: number;
	readonly to: number;
	/**
	 * Whether it starts a line where that ends an expression: after a line break,
	 * and outside brackets, interpolations, `if ... else` and `for ... then`, as in
	 * the parser. So `F\n(1)` is no call, but `[F\n(1)]` is. False for a comment.
	 */
	readonly startsLine: boolean;
	/** For a string or the last piece of one, whether it runs to the end of the source unclosed. */
	readonly unterminated?: true;
}

const CLOSES = new Map([
	[TokenKind.RParen, TokenKind.LParen],
	[TokenKind.RBracket, TokenKind.LBracket],
	[TokenKind.RBrace, TokenKind.LBrace],
	[TokenKind.TemplateTail, TokenKind.TemplateHead],
]);

/** Follow what `kind` opens or closes, as the parser counts enclosed code. */
function enclose(enclosing: TokenKind[], kind: TokenKind): void {
	switch (kind) {
		case TokenKind.LParen:
		case TokenKind.LBracket:
		case TokenKind.LBrace:
		case TokenKind.TemplateHead:
		case TokenKind.If:
		case TokenKind.For:
			enclosing.push(kind);
			return;
		// `if` is enclosed up to its `else`, and `for` up to its `then`
		case TokenKind.Then:
			if (enclosing.at(-1) === TokenKind.For) enclosing.pop();
			return;
		case TokenKind.Else:
			if (enclosing.at(-1) === TokenKind.If) enclosing.pop();
			return;
		default: {
			const opener = CLOSES.get(kind);
			if (opener === undefined) return;
			// What is left open inside a bracket ends with it
			const index = enclosing.lastIndexOf(opener);
			if (index >= 0) enclosing.length = index;
		}
	}
}

/** A string that is open, with how many `{` its current interpolation has open. */
interface OpenString {
	readonly open: number;
	braces: number;
}

/**
 * Every token in `source`, in order. Strings with interpolations come as their
 * pieces, each ending or starting with its `#{` or `}`, as the parser reads them.
 */
export function lex(source: string): Token[] {
	// The lexer stops reading at its hundredth problem, which pasted prose can reach,
	// so it gets a list that keeps none: the compiler reports them anyway
	let unterminated = false;
	const sink = Object.assign([] as Diagnostic[], {
		push: (diagnostic: Diagnostic): number => {
			if (diagnostic.code === 'unterminated-string') unterminated = true;
			return 0;
		},
	});
	const cursor: Cursor = { ...createCursor(source), diagnostics: sink };
	const tokens: Token[] = [];
	const strings: OpenString[] = [];
	// What encloses the next token, innermost last, which lets a line break go on
	const enclosing: TokenKind[] = [];
	let comments = 0;

	for (;;) {
		let token: LexerToken = nextToken(cursor);
		const [kind] = token;

		// `}` that closes an interpolation goes on with the string it is in
		const top = strings.at(-1);
		if (kind === TokenKind.RBrace && top !== undefined) {
			if (top.braces > 0) top.braces--;
			else token = continueTemplate(cursor, top.open);
		} else if (kind === TokenKind.LBrace && top !== undefined) {
			top.braces++;
		}

		// Comments come before the token that follows them
		for (; comments < cursor.comments.length; comments++) {
			const { offset, text } = cursor.comments[comments]!;
			tokens.push({ kind: 'comment', from: offset, to: offset + text.length, startsLine: false });
		}

		const [final, from, to, lineBreak] = token;
		if (final === TokenKind.Eof) return tokens;
		const startsLine = lineBreak && enclosing.length === 0;
		enclose(enclosing, final);
		// Only a string at the end of the source can be unclosed
		tokens.push(
			unterminated
				? { kind: final, from, to, startsLine, unterminated }
				: { kind: final, from, to, startsLine },
		);
		unterminated = false;

		if (final === TokenKind.TemplateHead) strings.push({ open: from, braces: 0 });
		else if (final === TokenKind.TemplateTail) strings.pop();
	}
}

/** What a piece of source is, which picks its color. */
export type Style =
	| 'comment'
	| 'keyword'
	| 'boolean'
	| 'number'
	| 'string'
	| 'escape'
	| 'interpolation'
	| 'operator'
	| 'punctuation'
	| 'function'
	| 'variable'
	| 'definition'
	| 'input'
	| 'property';

export interface Span {
	readonly from: number;
	readonly to: number;
	readonly style: Style;
	/**
	 * For a bracket, how deeply it is nested, counting every kind of bracket, or -1
	 * for one without its pair, which picks its color as bracket pairs are colored.
	 */
	readonly depth?: number;
}

const OPENERS = new Set<TokenKind | 'comment'>([
	TokenKind.LParen,
	TokenKind.LBracket,
	TokenKind.LBrace,
]);
const PAIRS = new Map<TokenKind | 'comment', TokenKind>([
	[TokenKind.RParen, TokenKind.LParen],
	[TokenKind.RBracket, TokenKind.LBracket],
	[TokenKind.RBrace, TokenKind.LBrace],
]);

const OPERATORS = new Set<TokenKind | 'comment'>([
	TokenKind.Plus,
	TokenKind.Minus,
	TokenKind.Star,
	TokenKind.Slash,
	TokenKind.Percent,
	TokenKind.Caret,
	TokenKind.Bang,
	TokenKind.EqEq,
	TokenKind.NotEq,
	TokenKind.Lt,
	TokenKind.Gt,
	TokenKind.Le,
	TokenKind.Ge,
	TokenKind.And,
	TokenKind.Or,
	TokenKind.Fallback,
	TokenKind.DotDot,
	TokenKind.DotDotEq,
	TokenKind.Spread,
	TokenKind.Eq,
	TokenKind.InputEq,
	TokenKind.Pipe,
	TokenKind.Question,
]);

const KEYWORDS = new Set<TokenKind | 'comment'>([
	TokenKind.If,
	TokenKind.Then,
	TokenKind.Else,
	TokenKind.For,
	TokenKind.In,
	TokenKind.When,
	TokenKind.Into,
	TokenKind.Reserved,
]);

/** What a word is from the tokens around it, which is all a broken program still has. */
function wordStyle(previous: Token | undefined, token: Token, next: Token | undefined): Style {
	const before = previous?.kind;
	const after = next?.kind;
	// A field, which can be any word, keywords included
	if (before === TokenKind.Dot || after === TokenKind.Colon) return 'property';
	if (token.kind !== TokenKind.Identifier) {
		if (token.kind === TokenKind.True || token.kind === TokenKind.False) return 'boolean';
		return 'keyword';
	}
	const call = after === TokenKind.LParen && !next!.startsLine;
	if (call || before === TokenKind.Pipe) return 'function';
	if (after === TokenKind.InputEq) return 'input';
	if (after === TokenKind.Eq || before === TokenKind.For || before === TokenKind.Into) {
		return 'definition';
	}
	return 'variable';
}

/** The escapes the lexer accepts; anything else after `\\` is reported, and left as text. */
const ESCAPE = /\\(?:["\\#nrt]|u\{([0-9a-fA-F]{1,6})\})/gu;

/** Whether a `\\u{...}` names a Unicode scalar value, as the lexer requires. */
function isScalar(hex: string | undefined): boolean {
	if (hex === undefined) return true;
	const code = Number.parseInt(hex, 16);
	return code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
}

/** A piece of a string, with its escapes and the `#{` and `}` around interpolations. */
function stringSpans(source: string, token: Token, spans: Span[]): void {
	let { from, to } = token;
	if (token.kind === TokenKind.TemplateMiddle || token.kind === TokenKind.TemplateTail) {
		spans.push({ from, to: from + 1, style: 'interpolation' });
		from++;
	}
	const opens = token.kind === TokenKind.TemplateHead || token.kind === TokenKind.TemplateMiddle;
	// A piece that opens an interpolation ends with its `#{`
	if (opens) to -= 2;

	const text = source.slice(from, to);
	let last = 0;
	for (const match of text.matchAll(ESCAPE)) {
		if (!isScalar(match[1])) continue;
		if (match.index > last)
			spans.push({ from: from + last, to: from + match.index, style: 'string' });
		const end = match.index + match[0].length;
		spans.push({ from: from + match.index, to: from + end, style: 'escape' });
		last = end;
	}
	if (last < text.length) spans.push({ from: from + last, to, style: 'string' });
	if (to < token.to) spans.push({ from: to, to: token.to, style: 'interpolation' });
}

/** How each token in `tokens` is shown. Spans are in order and never overlap. */
export function highlight(source: string, tokens: readonly Token[]): Span[] {
	const spans: Span[] = [];
	// Comments sit between tokens, and say nothing of what is around them
	const code = tokens.filter((token) => token.kind !== 'comment');
	let index = 0;
	// Brackets open so far, with where each one's span is
	const open: { kind: TokenKind | 'comment'; span: number }[] = [];

	for (const token of tokens) {
		const { kind, from, to } = token;
		if (kind === 'comment') {
			spans.push({ from, to, style: 'comment' });
			continue;
		}
		const previous = code[index - 1];
		const next = code[index + 1];
		index++;

		if (isWord(kind)) {
			spans.push({ from, to, style: wordStyle(previous, token, next) });
		} else if (kind === TokenKind.Number) {
			spans.push({ from, to, style: 'number' });
		} else if (
			kind === TokenKind.String ||
			kind === TokenKind.TemplateHead ||
			kind === TokenKind.TemplateMiddle ||
			kind === TokenKind.TemplateTail
		) {
			stringSpans(source, token, spans);
		} else if (OPERATORS.has(kind)) {
			spans.push({ from, to, style: 'operator' });
		} else if (OPENERS.has(kind)) {
			open.push({ kind, span: spans.length });
			spans.push({ from, to, style: 'punctuation', depth: open.length - 1 });
		} else if (PAIRS.has(kind)) {
			const paired = open.at(-1)?.kind === PAIRS.get(kind);
			if (paired) open.pop();
			spans.push({ from, to, style: 'punctuation', depth: paired ? open.length : -1 });
		} else if (!KEYWORDS.has(kind)) {
			spans.push({ from, to, style: 'punctuation' });
		}
	}
	// A bracket never closed has no pair either
	for (const { span } of open) spans[span] = { ...spans[span]!, depth: -1 };
	return spans;
}
