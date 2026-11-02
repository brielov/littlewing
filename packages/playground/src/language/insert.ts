import type { FunctionDescription } from 'littlewing';
import { type Token, TokenKind } from './tokens.ts';

/** What inserting a function writes, and where the cursor goes, from the start of it. */
export interface Insertion {
	readonly text: string;
	readonly cursor: number;
}

/**
 * How to write a call of `name` where `selected` is, after `before`: a selection
 * becomes its argument; after `|>` it is a pipe step, bare if the piped value can
 * be its only argument and with `?` for it if not; and a function that takes
 * nothing leaves the cursor after it.
 */
export function insertion(
	name: string,
	description: FunctionDescription,
	selected: string,
	before: Token | undefined,
): Insertion {
	const required = (args: FunctionDescription['overloads'][number]['args']) =>
		args.filter((arg) => !arg.optional).length;
	if (before?.kind === TokenKind.Pipe) {
		// A step gives the function the piped value, which one that takes nothing cannot take
		if (description.overloads.some(({ args }) => args.length >= 1 && required(args) <= 1)) {
			return { text: name, cursor: name.length };
		}
		return { text: `${name}(?, )`, cursor: name.length + 4 };
	}
	if (selected !== '') {
		const text = `${name}(${selected})`;
		return { text, cursor: text.length };
	}
	const nothing = description.overloads.every(({ args }) => args.length === 0);
	return { text: `${name}()`, cursor: nothing ? name.length + 2 : name.length + 1 };
}
