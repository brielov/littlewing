import type { NameSymbol } from './scope.ts';
import { lex, TokenKind } from './tokens.ts';

export interface Edit {
	readonly from: number;
	readonly to: number;
	readonly insert: string;
}

/**
 * The edits that rename `symbol` to `name`, or why it cannot be. A name already
 * in use anywhere is refused, as it could capture reads of the other one, or be
 * captured, and leave a program that runs and means something else.
 */
export function renameEdits(
	symbols: readonly NameSymbol[],
	symbol: NameSymbol,
	written: string,
): { edits: Edit[] } | { error: string } {
	// Names are compared as the language does, in NFC
	const name = written.normalize('NFC');
	const tokens = lex(name);
	const [token] = tokens;
	if (tokens.length !== 1 || token?.kind !== TokenKind.Identifier || token.to !== name.length) {
		return { error: `${name.trim() === '' ? 'Nothing' : `'${name}'`} is not a name` };
	}
	if (name === symbol.name) return { edits: [] };
	if (symbols.some((other) => other.name === name))
		return { error: `${name} is already a name here` };

	const occurrences = symbol.definition
		? [symbol.definition, ...symbol.references]
		: symbol.references;
	// A shorthand field keeps its field name, which only the value takes the new name in
	const edits = occurrences.map(({ from, to, shorthand }) => ({
		from,
		to,
		insert: shorthand ? `${symbol.name}: ${name}` : name,
	}));
	return { edits: edits.sort((a, b) => a.from - b.from) };
}
