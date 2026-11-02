import { TokenKind, type Token } from './tokens.ts';

/** A call the cursor is in the arguments of. */
export interface CallSite {
	readonly name: string;
	/** Where the name starts. */
	readonly from: number;
	/** Which argument the cursor is in, from 0. */
	readonly argument: number;
}

/** Something open before the cursor: a bracket, or an interpolation. */
interface Open {
	readonly call: { name: string; from: number } | undefined;
	commas: number;
}

/**
 * The innermost call whose parentheses hold `position`, read from the tokens
 * before it, so strings, comments and nesting cannot confuse it.
 */
export function callAt(
	tokens: readonly Token[],
	position: number,
	read: (from: number, to: number) => string,
): CallSite | undefined {
	const open: Open[] = [];
	let previous: Token | undefined;

	for (const token of tokens) {
		if (token.to > position) break;
		if (token.kind === 'comment') continue;
		switch (token.kind) {
			case TokenKind.LParen: {
				// A name whose `(` starts a line ends its expression, and is no call
				const name =
					previous?.kind === TokenKind.Identifier && !token.startsLine ? previous : undefined;
				const call = name && { name: read(name.from, name.to), from: name.from };
				open.push({ call, commas: 0 });
				break;
			}
			case TokenKind.LBracket:
			case TokenKind.LBrace:
			case TokenKind.TemplateHead:
				open.push({ call: undefined, commas: 0 });
				break;
			case TokenKind.RParen:
			case TokenKind.RBracket:
			case TokenKind.RBrace:
			case TokenKind.TemplateTail:
				open.pop();
				break;
			case TokenKind.TemplateMiddle:
				// One interpolation ends where the next begins
				open.pop();
				open.push({ call: undefined, commas: 0 });
				break;
			case TokenKind.Comma: {
				const top = open.at(-1);
				if (top !== undefined) top.commas++;
				break;
			}
			default:
		}
		previous = token;
	}

	// The argument is counted in the call's own parentheses, not in anything nested
	for (let i = open.length - 1; i >= 0; i--) {
		const { call, commas } = open[i]!;
		if (call !== undefined) return { ...call, argument: commas };
	}
	return undefined;
}
