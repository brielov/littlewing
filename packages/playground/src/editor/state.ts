import { type EditorState, StateEffect, StateField } from '@codemirror/state';
import { parse, type TypeDescription } from 'littlewing';
import {
	type LoopName,
	loopsAround,
	type NameSymbol,
	resolve,
	symbolAt,
} from '../language/scope.ts';
import { elementOf, pathType } from '../language/types.ts';
import { highlight, lex, type Span, type Token, TokenKind } from '../language/tokens.ts';

/** The document as tokens, and how each is shown, kept in step with every edit. */
export interface Syntax {
	readonly tokens: readonly Token[];
	readonly spans: readonly Span[];
}

function read(source: string): Syntax {
	const tokens = lex(source);
	return { tokens, spans: highlight(source, tokens) };
}

export const syntaxField = StateField.define<Syntax>({
	create: (state) => read(state.doc.toString()),
	update: (value, transaction) =>
		transaction.docChanged ? read(transaction.state.doc.toString()) : value,
});

/** The names of the document, found when a feature first asks for them. */
export interface Names {
	readonly symbols: readonly NameSymbol[];
	/** Whether the parser left statements out, whose names are then missing. */
	readonly broken: boolean;
	/** Where the statements the parser read are, in order. */
	readonly statements: readonly { readonly from: number; readonly to: number }[];
}

/**
 * Whether `position` is in a statement the parser read, where the tree says what
 * names there are, rather than in one it left out, where only tokens can.
 */
export function inParsed(state: EditorState, position: number): boolean {
	return namesOf(state).statements.some(({ from, to }) => from <= position && position <= to);
}

/**
 * The loops around `position` in a statement the parser left out, from tokens. A
 * loop in a statement it read, which ended before the position, is not one.
 */
export function brokenLoops(state: EditorState, position: number): LoopName[] {
	if (inParsed(state, position)) return [];
	const { statements } = namesOf(state);
	const read = (from: number, to: number) => state.sliceDoc(from, to);
	return loopsAround(state.field(syntaxField).tokens, position, read).filter(
		({ definition }) =>
			!statements.some(({ from, to }) => from <= definition.from && to < position),
	);
}

const names = new WeakMap<Syntax, Names>();

/** The names of the document, parsed once for each version of it. */
export function namesOf(state: EditorState): Names {
	const syntax = state.field(syntaxField);
	let found = names.get(syntax);
	if (found === undefined) {
		const { program, diagnostics } = parse(state.doc.toString());
		found = {
			symbols: resolve(program, syntax.tokens),
			broken: diagnostics.length > 0,
			statements: program.statements.map(({ start, end }) => ({ from: start, to: end })),
		};
		names.set(syntax, found);
	}
	return found;
}

/** What compiling the program found out, which lags the document. */
export interface Analysis {
	/** The type of each top-level name, kept from the last program types were found for. */
	readonly types: ReadonlyMap<string, TypeDescription>;
	/** Whether those types are of the program as it is, rather than an earlier one. */
	readonly current: boolean;
}

export const setAnalysis = StateEffect.define<Analysis>();

export const analysisField = StateField.define<Analysis>({
	create: () => ({ types: new Map(), current: true }),
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

/**
 * The type of a name: a top-level one's from compiling, and a loop variable's
 * from what it loops over, when that is a path whose type is known.
 */
export function symbolType(
	state: EditorState,
	symbol: NameSymbol,
	depth = 0,
): TypeDescription | undefined {
	if (symbol.kind === 'accumulator') return undefined;
	if (symbol.kind !== 'loop') return state.field(analysisField).types.get(symbol.name);
	// What a loop reads is outside it, so this ends, but a hostile source can nest deep
	if (symbol.iterable === undefined || depth > 64) return undefined;
	const { tokens } = state.field(syntaxField);
	const read = (from: number, to: number) => state.sliceDoc(from, to);
	const iterable = pathType(tokens, symbol.iterable, read, (token) =>
		nameType(state, token, depth + 1),
	);
	return iterable && elementOf(iterable);
}

/** The type of the name a token is, where the program reads it. */
export function nameType(state: EditorState, token: Token, depth = 0): TypeDescription | undefined {
	const { tokens } = state.field(syntaxField);
	const found = symbolAt(namesOf(state).symbols, token.from);
	if (found !== undefined) return symbolType(state, found.symbol, depth);

	// In a statement the parser could not read, a loop variable is found from tokens
	const name = state.sliceDoc(token.from, token.to);
	const read = (from: number, to: number) => state.sliceDoc(from, to);
	const loop = brokenLoops(state, token.from).findLast((around) => around.name === name);
	const iterable = depth > 64 ? undefined : loop?.iterable;
	if (loop?.kind === 'accumulator') return undefined;
	if (iterable !== undefined) {
		const type = pathType(tokens, iterable, read, (inner) => nameType(state, inner, depth + 1));
		return type && elementOf(type);
	}
	return state.field(analysisField).types.get(name);
}
