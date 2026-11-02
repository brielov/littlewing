import { type EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import { keymap, showTooltip, type Tooltip } from '@codemirror/view';
import { callAt, type CallSite } from '../language/calls.ts';
import { FUNCTION_DESCRIPTIONS } from '../language/catalog.ts';
import { functionInfo } from './info.ts';
import { syntaxField } from './state.ts';

interface SignatureState {
	/** The call the cursor is in, by where its name starts and which argument. */
	readonly call: CallSite | undefined;
	readonly tooltip: Tooltip | null;
	/** Where the name of a call starts whose help was closed, until the cursor leaves it. */
	readonly dismissed: number | undefined;
}

const dismiss = StateEffect.define<null>();

function callOf(state: EditorState): CallSite | undefined {
	const { main } = state.selection;
	if (!main.empty) return undefined;
	const { tokens } = state.field(syntaxField);
	const call = callAt(tokens, main.head, (from, to) => state.sliceDoc(from, to));
	return call !== undefined && FUNCTION_DESCRIPTIONS.has(call.name) ? call : undefined;
}

/** The ways to call a function, with the argument being typed standing out. */
function tooltipFor(call: CallSite): Tooltip {
	const description = FUNCTION_DESCRIPTIONS.get(call.name)!;
	// Only the ways to call it that have that argument
	const overloads = description.overloads.filter(({ args }) => args.length > call.argument);
	const shown = {
		...description,
		overloads: overloads.length > 0 ? overloads : description.overloads,
	};
	return {
		// At the name, so it stays put while the arguments are typed
		pos: call.from,
		above: true,
		create: () => ({ dom: functionInfo(call.name, shown, { argument: call.argument }) }),
	};
}

function same(a: CallSite | undefined, b: CallSite | undefined): boolean {
	return a?.from === b?.from && a?.name === b?.name && a?.argument === b?.argument;
}

function next(previous: SignatureState, state: EditorState, closing: boolean): SignatureState {
	const call = callOf(state);
	const dismissed = closing
		? call?.from
		: call?.from === previous.dismissed
			? previous.dismissed
			: undefined;
	if (call === undefined || dismissed !== undefined) return { call, tooltip: null, dismissed };
	// The same call keeps its tooltip, which is then not drawn again
	if (same(call, previous.call) && previous.tooltip !== null) return { ...previous, dismissed };
	return { call, tooltip: tooltipFor(call), dismissed };
}

const signatureField = StateField.define<SignatureState>({
	create: (state) => next({ call: undefined, tooltip: null, dismissed: undefined }, state, false),
	update: (value, transaction) => {
		const closing = transaction.effects.some((effect) => effect.is(dismiss));
		if (!closing && !transaction.docChanged && !transaction.selection) return value;
		return next(value, transaction.state, closing);
	},
	provide: (field) => showTooltip.from(field, (value) => value.tooltip),
});

/** Escape closes the help until the cursor leaves the call, after closing any completion. */
const dismissKey = Prec.low(
	keymap.of([
		{
			key: 'Escape',
			run: (view) => {
				if (view.state.field(signatureField).tooltip === null) return false;
				view.dispatch({ effects: dismiss.of(null) });
				return true;
			},
		},
	]),
);

export const signatureHelp = [signatureField, dismissKey];
