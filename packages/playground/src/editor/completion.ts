import {
	autocompletion,
	type Completion,
	type CompletionContext,
	type CompletionResult,
	snippetCompletion,
} from '@codemirror/autocomplete';
import { FUNCTION_DESCRIPTIONS, signatureText } from '../language/catalog.ts';
import { TokenKind } from '../language/tokens.ts';
import { inText, lexedField, tokenBefore } from './state.ts';

const KEYWORDS = ['if', 'then', 'else', 'for', 'in', 'when', 'into', 'true', 'false'];

const keywords: Completion[] = KEYWORDS.map((label) => ({ label, type: 'keyword' }));

/** A function where a call is written, with the cursor between its parentheses. */
const calls: Completion[] = [...FUNCTION_DESCRIPTIONS].map(([name, description]) =>
	snippetCompletion(`${name}(\${})`, {
		label: name,
		type: 'function',
		detail: description.overloads.length > 1 ? `+${description.overloads.length - 1}` : '',
		info: [...description.overloads.map((o) => signatureText(name, o)), description.doc]
			.filter(Boolean)
			.join('\n'),
	}),
);

/**
 * A function as a pipe step: bare when it can take the piped value alone, or else
 * with `?` for it, as a step with parentheses needs one.
 */
const steps: Completion[] = [...FUNCTION_DESCRIPTIONS].map(([name, description], i) => {
	const alone = description.overloads.some(
		({ args }) => args.filter((a) => !a.optional).length <= 1,
	);
	const call = calls[i]!;
	return alone ? { ...call, apply: name } : snippetCompletion(`${name}(?, \${})`, call);
});

const WORD = /[\p{XID_Continue}]*$/u;

function complete(context: CompletionContext): CompletionResult | null {
	const { state, pos, explicit } = context;
	const { tokens } = state.field(lexedField);
	const word = context.matchBefore(WORD);
	const from = word?.from ?? pos;
	if (from === pos && !explicit) return null;
	// A name never starts with a digit, so this is a number
	if (word !== null && /^\p{Nd}/u.test(word.text)) return null;

	if (inText(tokens, pos)) return null;
	// After a `.` goes a field, which compiling has to say
	const previous = tokenBefore(tokens, from);
	if (previous?.kind === TokenKind.Dot) return null;

	const piped = previous?.kind === TokenKind.Pipe;
	return {
		from,
		options: piped ? steps : [...keywords, ...calls],
		validFor: /^[\p{XID_Continue}]*$/u,
	};
}

export const completion = autocompletion({ override: [complete], icons: false });
