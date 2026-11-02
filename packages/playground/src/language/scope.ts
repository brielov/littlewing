/**
 * What each name in a program refers to, from the tree `parse` gives, which holds
 * every statement it could read while the source is broken. Scopes are those of
 * the language spec, sections 5.2 and 5.9.
 */
import type { syntax } from 'littlewing';
import { startsStatement, type Token, TokenKind } from './tokens.ts';

/** Where a name is written. */
export interface Occurrence {
	readonly from: number;
	readonly to: number;
	/** A read written as a shorthand field, `{ total }`, whose field keeps the name. */
	readonly shorthand?: true;
}

export type SymbolKind =
	/** `name = value` */
	| 'binding'
	/** `name ?= default` */
	| 'input'
	/** A name read and bound nowhere, which the host supplies. */
	| 'free'
	/** The `x` of `for x in ...` */
	| 'loop'
	/** The `acc` of `into acc = ...` */
	| 'accumulator';

/** A name and every place it is written, which renaming it changes together. */
export interface NameSymbol {
	readonly name: string;
	readonly kind: SymbolKind;
	/** Where it is bound, which a free name has nowhere. */
	readonly definition: Occurrence | undefined;
	readonly references: Occurrence[];
	/** For a loop's names, the code that sees them: its guard and its body. */
	readonly scope?: readonly Span[];
	/** For a loop variable, what it loops over, whose elements it takes. */
	readonly iterable?: Span;
	/** For a top-level binding, its whole statement, which cannot read it. */
	readonly statement?: Span;
}

export interface Span {
	readonly from: number;
	readonly to: number;
}

/** The index of the first token that ends after `position`, which tokens in order allow. */
export function tokenIndexAt(tokens: readonly Token[], position: number): number {
	let low = 0;
	let high = tokens.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (tokens[middle]!.to <= position) low = middle + 1;
		else high = middle;
	}
	return low;
}

class Resolver {
	readonly symbols: NameSymbol[] = [];
	/** Top-level bindings, which are read anywhere, even before them as an error. */
	private readonly bindings = new Map<string, NameSymbol>();
	private readonly free = new Map<string, NameSymbol>();
	/** The variables of the loops around what is being read, innermost last. */
	private readonly loops: Map<string, NameSymbol>[] = [];

	constructor(private readonly tokens: readonly Token[]) {}

	/** The index of the token that starts at `from`, or -1. */
	private index(from: number): number {
		const i = tokenIndexAt(this.tokens, from);
		return this.tokens[i]?.from === from ? i : -1;
	}

	private symbol(
		name: string,
		kind: SymbolKind,
		definition: Occurrence | undefined,
		extra?: Pick<NameSymbol, 'scope' | 'iterable' | 'statement'>,
	): NameSymbol {
		const symbol: NameSymbol = { name, kind, definition, references: [], ...extra };
		this.symbols.push(symbol);
		return symbol;
	}

	/** The name token that starts at `from`, where the tree says a name is. */
	private nameAt(from: number): Occurrence {
		const token = this.tokens[this.index(from)];
		return { from, to: token?.to ?? from };
	}

	/** The next name token after `from`, as the variable after `for`. */
	private nameAfter(from: number): Occurrence | undefined {
		for (let i = this.index(from) + 1; i > 0 && i < this.tokens.length; i++) {
			const token = this.tokens[i]!;
			if (token.kind === TokenKind.Identifier) return { from: token.from, to: token.to };
			if (token.kind !== 'comment') return undefined;
		}
		return undefined;
	}

	/** The accumulator's name: the name before the `=` before its initial value. */
	private accumulatorBefore(initial: number): Occurrence | undefined {
		let i = this.index(initial);
		if (i < 0) return undefined;
		// Parentheses around the initial value are not part of its node
		while (--i >= 0 && this.tokens[i]!.kind !== TokenKind.Eq);
		while (--i >= 0) {
			const token = this.tokens[i]!;
			if (token.kind === TokenKind.Identifier) return { from: token.from, to: token.to };
			if (token.kind !== 'comment') return undefined;
		}
		return undefined;
	}

	program(program: syntax.Program): void {
		// Bindings first, as a read before one still refers to it
		for (const statement of program.statements) {
			if (statement.kind !== 'binding' || this.bindings.has(statement.name)) continue;
			const kind = statement.input ? 'input' : 'binding';
			const extent = { statement: { from: statement.start, to: statement.end } };
			this.bindings.set(
				statement.name,
				this.symbol(statement.name, kind, this.nameAt(statement.start), extent),
			);
		}
		for (const statement of program.statements) {
			if (statement.kind === 'binding') {
				// A second binding of a name is its own symbol, and an error
				const first = this.bindings.get(statement.name)!;
				if (first.definition?.from !== statement.start) {
					const kind = statement.input ? 'input' : 'binding';
					const extent = { statement: { from: statement.start, to: statement.end } };
					this.symbol(statement.name, kind, this.nameAt(statement.start), extent);
				}
				this.expression(statement.value);
			} else {
				this.expression(statement);
			}
		}
	}

	private read(name: string, occurrence: Occurrence): void {
		for (let i = this.loops.length - 1; i >= 0; i--) {
			const symbol = this.loops[i]!.get(name);
			if (symbol !== undefined) {
				symbol.references.push(occurrence);
				return;
			}
		}
		let symbol = this.bindings.get(name) ?? this.free.get(name);
		if (symbol === undefined) {
			symbol = this.symbol(name, 'free', undefined);
			this.free.set(name, symbol);
		}
		symbol.references.push(occurrence);
	}

	private expression(node: syntax.Expression): void {
		switch (node.kind) {
			case 'name':
				this.read(node.name, { from: node.start, to: node.end });
				return;
			case 'template':
				for (const part of node.parts) if (typeof part !== 'string') this.expression(part);
				return;
			case 'binary':
				this.expression(node.left);
				this.expression(node.right);
				return;
			case 'unary':
				this.expression(node.argument);
				return;
			case 'fallback':
				this.expression(node.path);
				this.expression(node.fallback);
				return;
			case 'range':
				this.expression(node.from);
				this.expression(node.to);
				return;
			case 'array':
				for (const element of node.elements) this.expression(element);
				return;
			case 'record':
				for (const member of node.members) {
					if (member.kind === 'field' && member.shorthand && member.value.kind === 'name') {
						const { start, end, name } = member.value;
						this.read(name, { from: start, to: end, shorthand: true });
					} else {
						this.expression(member.value);
					}
				}
				return;
			case 'member':
				this.expression(node.object);
				return;
			case 'index':
				this.expression(node.object);
				this.expression(node.index);
				return;
			case 'call':
				for (const arg of node.args) this.expression(arg);
				return;
			case 'pipe':
				this.expression(node.value);
				for (const arg of node.args ?? []) this.expression(arg);
				return;
			case 'if':
				this.expression(node.condition);
				this.expression(node.consequent);
				this.expression(node.alternate);
				return;
			case 'for':
				this.loop(node);
				return;
			default:
		}
	}

	/** A loop, whose variables only its guard and body see. */
	private loop(node: syntax.For): void {
		this.expression(node.iterable);
		if (node.accumulator !== null) this.expression(node.accumulator.initial);

		// Not the initial value between them, which cannot see the loop's names
		const body = { from: node.body.start, to: node.body.end };
		const scope =
			node.guard === null ? [body] : [{ from: node.guard.start, to: node.guard.end }, body];
		const frame = new Map<string, NameSymbol>();
		const iterable = { from: node.iterable.start, to: node.iterable.end };
		const variable = this.symbol(node.variable, 'loop', this.nameAfter(node.start), {
			scope,
			iterable,
		});
		frame.set(node.variable, variable);
		if (node.accumulator !== null) {
			const { name, initial } = node.accumulator;
			const definition = this.accumulatorBefore(initial.start);
			frame.set(name, this.symbol(name, 'accumulator', definition, { scope }));
		}
		this.loops.push(frame);
		if (node.guard !== null) this.expression(node.guard);
		this.expression(node.body);
		this.loops.pop();
	}
}

/** Every name in `program`, with where it is bound and read. */
export function resolve(program: syntax.Program, tokens: readonly Token[]): NameSymbol[] {
	const resolver = new Resolver(tokens);
	resolver.program(program);
	return resolver.symbols;
}

/** The symbol of the name written at `position`, touching it from either side. */
export function symbolAt(
	symbols: readonly NameSymbol[],
	position: number,
): { symbol: NameSymbol; occurrence: Occurrence } | undefined {
	for (const symbol of symbols) {
		const all = symbol.definition ? [symbol.definition, ...symbol.references] : symbol.references;
		for (const occurrence of all) {
			if (occurrence.from <= position && position <= occurrence.to) return { symbol, occurrence };
		}
	}
	return undefined;
}

/** A loop name the tokens before a position show, for code the parser could not read. */
export interface LoopName {
	readonly name: string;
	readonly kind: 'loop' | 'accumulator';
	readonly definition: Span;
	/** What the loop goes over, for its variable. */
	readonly iterable: Span | undefined;
}

/**
 * The names of the loops around `position`, innermost last, read from tokens, for
 * a loop the parser could not read, as one whose body is being typed. A loop is
 * around a position in its guard or body, until a bracket it is in closes, or a
 * line that starts a statement, or a `;`, ends its statement.
 */
export function loopsAround(
	tokens: readonly Token[],
	position: number,
	read: (from: number, to: number) => string,
): LoopName[] {
	const code = tokens.slice(0, tokenIndexAt(tokens, position)).filter((t) => t.kind !== 'comment');
	const names: LoopName[] = [];
	for (let i = 0; i < code.length; i++) {
		if (code[i]!.kind !== TokenKind.For) continue;
		const variable = code[i + 1];
		if (variable?.kind !== TokenKind.Identifier || code[i + 2]?.kind !== TokenKind.In) continue;

		// Where the position is in this loop, followed at its own bracket depth. An
		// `if` or `for` inside it takes the next `then`, and an `if` the next `else`.
		let part: 'iterable' | 'guard' | 'initial' | 'body' | 'outside' = 'iterable';
		let iterableEnd: Token | undefined;
		let accumulator: Token | undefined;
		let depth = 0;
		const inner: ('if' | 'if then' | 'for')[] = [];
		for (let j = i + 3; j < code.length && part !== 'outside'; j++) {
			const token = code[j]!;
			const { kind } = token;
			const top = depth === 0 && inner.length === 0;
			if (kind === TokenKind.LParen || kind === TokenKind.LBracket || kind === TokenKind.LBrace) {
				depth++;
			} else if (
				kind === TokenKind.RParen ||
				kind === TokenKind.RBracket ||
				kind === TokenKind.RBrace
			) {
				if (--depth < 0) part = 'outside';
			} else if (depth > 0) {
				// Inside brackets, nothing ends or divides this loop
			} else if ((token.startsLine && startsStatement(kind)) || kind === TokenKind.Semicolon) {
				part = 'outside';
			} else if (kind === TokenKind.If) {
				inner.push('if');
			} else if (kind === TokenKind.For) {
				inner.push('for');
			} else if (kind === TokenKind.Then && !top) {
				if (inner.at(-1) === 'for') inner.pop();
				else if (inner.at(-1) === 'if') inner[inner.length - 1] = 'if then';
			} else if (kind === TokenKind.Else && !top) {
				// An `if` inside ends with its `else` expression, which no token marks
				if (inner.at(-1) === 'if then') inner.pop();
			} else if (
				top &&
				(kind === TokenKind.Comma ||
					kind === TokenKind.Else ||
					kind === TokenKind.Colon ||
					(part === 'body' && kind === TokenKind.Then))
			) {
				// What this loop is an element, argument or branch of goes on past it
				part = 'outside';
			} else if (top && part === 'iterable' && kind === TokenKind.When) {
				part = 'guard';
			} else if (top && (part === 'iterable' || part === 'guard') && kind === TokenKind.Into) {
				part = 'initial';
				const name = code[j + 1];
				if (name?.kind === TokenKind.Identifier) accumulator = name;
			} else if (top && part !== 'body' && kind === TokenKind.Then) {
				part = 'body';
			}
			if (part === 'iterable') iterableEnd = token;
		}
		if (part !== 'guard' && part !== 'body') continue;

		const start = code[i + 3];
		const iterable =
			start !== undefined && iterableEnd !== undefined
				? { from: start.from, to: iterableEnd.to }
				: undefined;
		const span = (token: Token) => ({ from: token.from, to: token.to });
		names.push({
			name: read(variable.from, variable.to),
			kind: 'loop',
			definition: span(variable),
			iterable,
		});
		if (accumulator !== undefined) {
			const name = read(accumulator.from, accumulator.to);
			names.push({ name, kind: 'accumulator', definition: span(accumulator), iterable: undefined });
		}
	}
	return names;
}
