import { StateEffect, StateField } from '@codemirror/state';
import { highlight, lex, type Span, type Token, TokenKind } from '../language/tokens.ts';

/** The document as tokens, and how each is shown, kept in step with every edit. */
export interface Lexed {
	readonly tokens: readonly Token[];
	readonly spans: readonly Span[];
}

function lexed(source: string): Lexed {
	const tokens = lex(source);
	return { tokens, spans: highlight(source, tokens) };
}

export const lexedField = StateField.define<Lexed>({
	create: (state) => lexed(state.doc.toString()),
	update: (value, transaction) =>
		transaction.docChanged ? lexed(transaction.state.doc.toString()) : value,
});

/** What compiling the program found out, which lags the document. */
export interface Analysis {
	/** The type of each input, as `number`. */
	readonly inputTypes: ReadonlyMap<string, string>;
}

export const setAnalysis = StateEffect.define<Analysis>();

export const analysisField = StateField.define<Analysis>({
	create: () => ({ inputTypes: new Map() }),
	update: (value, transaction) => {
		for (const effect of transaction.effects) if (effect.is(setAnalysis)) value = effect.value;
		return value;
	},
});

/**
 * The token at `position`: with `side` -1 the one that has a character just
 * before it, and with 1 the one that has a character just after it.
 */
export function tokenAt(
	tokens: readonly Token[],
	position: number,
	side: -1 | 1 = -1,
): Token | undefined {
	const offset = side < 0 ? position - 1 : position;
	let low = 0;
	let high = tokens.length;
	// The first token that ends after `offset`
	while (low < high) {
		const middle = (low + high) >> 1;
		if (tokens[middle]!.to <= offset) low = middle + 1;
		else high = middle;
	}
	const token = tokens[low];
	return token !== undefined && token.from <= offset ? token : undefined;
}

/** The last token, other than a comment, that ends at or before `position`. */
export function tokenBefore(tokens: readonly Token[], position: number): Token | undefined {
	let low = 0;
	let high = tokens.length;
	// The first token that ends past `position`
	while (low < high) {
		const middle = (low + high) >> 1;
		if (tokens[middle]!.to <= position) low = middle + 1;
		else high = middle;
	}
	for (let i = low - 1; i >= 0; i--) {
		if (tokens[i]!.kind !== 'comment') return tokens[i];
	}
	return undefined;
}

/** Whether `position` is in text, a comment's or a string's, rather than code. */
export function inText(tokens: readonly Token[], position: number): boolean {
	const token = tokenAt(tokens, position);
	if (token === undefined) return false;
	if (token.kind === 'comment') return true;
	const piece =
		token.kind === TokenKind.String ||
		token.kind === TokenKind.TemplateHead ||
		token.kind === TokenKind.TemplateMiddle ||
		token.kind === TokenKind.TemplateTail;
	// The end of a piece is past its closing `"`, or just inside an interpolation,
	// unless the string never closes
	return piece && (position < token.to || token.unterminated === true);
}
