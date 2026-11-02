import {
	EditorSelection,
	type EditorState,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	type KeyBinding,
	showTooltip,
	type Tooltip,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { generate, parse } from 'littlewing';
import { renameEdits } from '../language/rename.ts';
import { type NameSymbol, type Occurrence, symbolAt } from '../language/scope.ts';
import { TokenKind } from '../language/tokens.ts';
import { namesOf, syntaxField, tokenAt } from './state.ts';

/** The name at `position`, if a name token is there, which spares parsing anywhere else. */
function nameAt(
	state: EditorState,
	position: number,
): { symbol: NameSymbol; occurrence: Occurrence } | undefined {
	const { tokens } = state.field(syntaxField);
	const before = tokenAt(tokens, position, -1);
	const after = tokenAt(tokens, position, 1);
	if (before?.kind !== TokenKind.Identifier && after?.kind !== TokenKind.Identifier)
		return undefined;
	return symbolAt(namesOf(state).symbols, position);
}

/** The name at the cursor, if the selection is just a cursor. */
function nameAtCursor(state: EditorState) {
	const { main } = state.selection;
	return main.empty ? nameAt(state, main.head) : undefined;
}

function occurrences(symbol: NameSymbol): Occurrence[] {
	const all = symbol.definition
		? [symbol.definition, ...symbol.references]
		: [...symbol.references];
	return all.sort((a, b) => a.from - b.from);
}

const reference = Decoration.mark({ class: 'lw-reference' });
const definition = Decoration.mark({ class: 'lw-reference lw-definition' });

/** Every place the name at the cursor is written, its binding apart. */
function decorate(state: EditorState): DecorationSet {
	const found = nameAtCursor(state);
	if (found === undefined) return Decoration.none;
	const builder = new RangeSetBuilder<Decoration>();
	for (const occurrence of occurrences(found.symbol)) {
		const mark = occurrence === found.symbol.definition ? definition : reference;
		builder.add(occurrence.from, occurrence.to, mark);
	}
	return builder.finish();
}

const referenceHighlight = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = decorate(view.state);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet) this.decorations = decorate(update.state);
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);

/** Move to where `symbol` is bound, if it is bound anywhere. */
function jumpTo(view: EditorView, symbol: NameSymbol): boolean {
	if (symbol.definition === undefined) return false;
	const { from, to } = symbol.definition;
	view.dispatch({
		selection: EditorSelection.range(from, to),
		effects: EditorView.scrollIntoView(from, { y: 'center' }),
		userEvent: 'select',
	});
	return true;
}

/** Go to where the name at the cursor is bound. */
function goToDefinition(view: EditorView): boolean {
	const found = nameAtCursor(view.state);
	return found !== undefined && jumpTo(view, found.symbol);
}

// --- Rename ---

/** A rename being asked for: of the name written at `occurrence`, and why the last try failed. */
interface Renaming {
	readonly occurrence: Occurrence;
	readonly error: string | undefined;
	/** What was typed, which a failed try keeps. */
	readonly typed: string | undefined;
}

const openRename = StateEffect.define<Renaming>();
const failRename = StateEffect.define<{ error: string; typed: string }>();
const closeRename = StateEffect.define<null>();

const renameField = StateField.define<Renaming | null>({
	create: () => null,
	update: (value, transaction) => {
		// Any edit makes what was being renamed something else
		if (transaction.docChanged) value = null;
		for (const effect of transaction.effects) {
			if (effect.is(openRename)) value = effect.value;
			else if (effect.is(failRename) && value !== null) value = { ...value, ...effect.value };
			else if (effect.is(closeRename)) value = null;
		}
		return value;
	},
	provide: (field) =>
		showTooltip.compute([field], (state) => {
			const renaming = state.field(field);
			return renaming === null ? null : renameTooltip(state, renaming);
		}),
});

/** A box under the name to type its new name in. */
function renameTooltip(state: EditorState, { occurrence, error, typed }: Renaming): Tooltip {
	const name = state.sliceDoc(occurrence.from, occurrence.to);
	return {
		pos: occurrence.from,
		above: false,
		create: (view) => {
			const dom = document.createElement('form');
			dom.className = 'lw-rename';
			const input = document.createElement('input');
			input.value = typed ?? name;
			input.spellcheck = false;
			input.setAttribute('aria-label', `New name for ${name}`);
			const message = document.createElement('p');
			message.textContent = error ?? 'Enter to rename, Escape to cancel';
			if (error !== undefined) message.className = 'lw-rename-error';
			dom.append(input, message);

			const close = () => {
				if (view.state.field(renameField) !== null)
					view.dispatch({ effects: closeRename.of(null) });
				view.focus();
			};
			dom.addEventListener('submit', (event) => {
				event.preventDefault();
				applyRename(view, occurrence, input.value);
			});
			input.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				close();
			});
			// Leaving the box gives up, unless a failed try is drawing it again
			input.addEventListener('blur', (event) => {
				if (event.relatedTarget === null || !dom.contains(event.relatedTarget as Node)) {
					queueMicrotask(() => {
						if (dom.isConnected) close();
					});
				}
			});
			return {
				dom,
				mount: () => {
					input.focus();
					input.select();
				},
			};
		},
	};
}

function applyRename(view: EditorView, occurrence: Occurrence, name: string): void {
	const { symbols, broken } = namesOf(view.state);
	const found = symbolAt(symbols, occurrence.from);
	if (found === undefined) return;
	// Uses of the name in statements the parser left out would be left behind
	if (broken) {
		const error = 'Fix the syntax errors first, so no use is missed';
		view.dispatch({ effects: failRename.of({ error, typed: name }) });
		return;
	}
	const result = renameEdits(symbols, found.symbol, name.trim());
	if ('error' in result) {
		view.dispatch({ effects: failRename.of({ error: result.error, typed: name }) });
		return;
	}
	view.dispatch({ changes: result.edits, effects: closeRename.of(null), userEvent: 'rename' });
	view.focus();
}

/** Ask for a new name for the name at the cursor. */
function startRename(view: EditorView): boolean {
	const found = nameAtCursor(view.state);
	if (found === undefined) return false;
	const error = namesOf(view.state).broken
		? 'Fix the syntax errors first, so no use is missed'
		: undefined;
	view.dispatch({
		effects: openRename.of({ occurrence: found.occurrence, error, typed: undefined }),
	});
	return true;
}

// --- Format ---

/** Write the program out as `generate` does, if it has no syntax error to lose. */
export function formatDocument(view: EditorView): boolean {
	const source = view.state.doc.toString();
	const { program, diagnostics } = parse(source);
	if (diagnostics.length > 0) return false;
	const formatted = generate(program);
	if (formatted !== source) {
		view.dispatch({
			changes: { from: 0, to: source.length, insert: formatted },
			userEvent: 'format',
		});
	}
	return true;
}

export const nameKeymap: KeyBinding[] = [
	{ key: 'F12', run: goToDefinition },
	{ key: 'F2', run: startRename },
	{ key: 'Shift-Alt-f', run: formatDocument },
];

/** Ctrl or Cmd and a click on a name goes to its binding, as in other editors. */
const definitionClick = EditorView.domEventHandlers({
	mousedown: (event, view) => {
		if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
		const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
		if (position === null) return false;
		const { tokens } = view.state.field(syntaxField);
		const token = tokenAt(tokens, position, 1) ?? tokenAt(tokens, position, -1);
		if (token?.kind !== TokenKind.Identifier) return false;
		// Only a click on the name itself, not one past the end of its line
		const start = view.coordsAtPos(token.from, 1);
		const end = view.coordsAtPos(token.to, -1);
		if (start === null || end === null || event.clientX < start.left || event.clientX > end.right) {
			return false;
		}
		const found = symbolAt(namesOf(view.state).symbols, token.from);
		if (found === undefined) return false;
		// A name bound nowhere has nowhere to go, and is no place for another cursor
		jumpTo(view, found.symbol);
		event.preventDefault();
		return true;
	},
});

/** Uses of names, going to where they are bound, and renaming them. */
export const names = [referenceHighlight, renameField, definitionClick];
