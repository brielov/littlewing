import {
	autocompletion,
	type Completion,
	type CompletionContext,
	type CompletionResult,
	snippetCompletion,
} from '@codemirror/autocomplete';
import { FUNCTION_DESCRIPTIONS, signatureText } from '../language/catalog.ts';
import { TokenKind } from '../language/tokens.ts';
import type { EditorState } from '@codemirror/state';
import { typeBefore, typeText } from '../language/types.ts';
import type { TypeDescription } from 'littlewing';
import {
	brokenLoops,
	inText,
	namesOf,
	nameType,
	symbolType,
	syntaxField,
	tokenBefore,
} from './state.ts';

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
const NAME = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

/** Whether `position` is in one of `spans`. */
function within(spans: readonly { from: number; to: number }[], position: number): boolean {
	return spans.some(({ from, to }) => from <= position && position <= to);
}

/**
 * The names that can be read at `position`: top-level bindings before its
 * statement, inputs, and the names of loops around it, not the word being typed.
 */
function names(state: EditorState, position: number): Completion[] {
	const { symbols } = namesOf(state);
	const seen = new Set<string>();
	const options: Completion[] = [];
	const offer = (name: string, type: TypeDescription | undefined) => {
		if (seen.has(name)) return;
		seen.add(name);
		options.push({
			label: name,
			type: 'variable',
			detail: type === undefined ? '' : typeText(type),
			// Above functions and keywords, as a program reads its own names most
			boost: 1,
		});
	};
	for (const symbol of symbols) {
		const { kind, definition, references, scope, statement } = symbol;
		const occurrences = definition ? [definition, ...references] : references;
		// The word being typed parses as a name too, and is no suggestion
		if (occurrences.every((o) => o.from <= position && position <= o.to)) continue;
		// A binding is read only after it, and not in its own statement
		if (statement !== undefined && position <= statement.to) continue;
		if ((kind === 'loop' || kind === 'accumulator') && !within(scope ?? [], position)) continue;
		offer(symbol.name, symbolType(state, symbol));
	}
	// The loops of a statement the parser could not read, as one being typed
	for (const loop of brokenLoops(state, position)) {
		const token = { kind: TokenKind.Identifier, ...loop.definition, startsLine: false } as const;
		offer(loop.name, loop.kind === 'loop' ? nameType(state, token) : undefined);
	}
	return options;
}

/** The fields of what the `.` just before `from` follows, from the types compiling found. */
function fields(state: EditorState, from: number): Completion[] {
	const { tokens } = state.field(syntaxField);
	const read = (start: number, end: number) => state.sliceDoc(start, end);
	const type = typeBefore(tokens, from, read, (token) => nameType(state, token));
	if (type?.kind !== 'record') return [];
	return Object.entries(type.fields)
		.filter(([name]) => NAME.test(name))
		.map(([name, field]) => ({
			label: name,
			type: 'property',
			detail: `${field.required ? '' : '?'}${typeText(field.type)}`,
		}));
}

function complete(context: CompletionContext): CompletionResult | null {
	const { state, pos, explicit } = context;
	const { tokens } = state.field(syntaxField);
	const word = context.matchBefore(WORD);
	const from = word?.from ?? pos;
	if (inText(tokens, pos)) return null;
	const previous = tokenBefore(tokens, from);
	const dotted = previous?.kind === TokenKind.Dot;
	if (from === pos && !explicit && !dotted) return null;
	// A name never starts with a digit, so this is a number
	if (word !== null && /^\p{Nd}/u.test(word.text)) return null;

	const validFor = /^[\p{XID_Continue}]*$/u;
	if (dotted) {
		const options = fields(state, from);
		return options.length === 0 ? null : { from, options, validFor };
	}
	if (previous?.kind === TokenKind.Pipe) return { from, options: steps, validFor };
	return { from, options: [...names(state, pos), ...keywords, ...calls], validFor };
}

export const completion = autocompletion({ override: [complete], icons: false });
