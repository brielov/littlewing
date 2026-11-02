import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension, Prec } from '@codemirror/state';
import {
	crosshairCursor,
	drawSelection,
	EditorView,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection,
} from '@codemirror/view';
import { completion } from './completion.ts';
import { highlighting } from './highlight.ts';
import { hover } from './hover.ts';
import { nameKeymap, names } from './names.ts';
import { signatureHelp } from './signature.ts';
import { analysisField, inText, syntaxField } from './state.ts';
import { theme } from './theme.ts';

export { showProblems } from './diagnostics.ts';
export { formatDocument } from './names.ts';
export { setAnalysis, syntaxField, tokenBefore, type Analysis } from './state.ts';

/**
 * In a string or comment, a typed `"` is just that rather than opening a pair, which is what
 * closing brackets would do with no syntax tree to say it is in a string. On a
 * `"` it was going to step over, closing brackets keeps it.
 */
const quoteInString = Prec.high(
	EditorView.inputHandler.of((view, from, to, text) => {
		if (text !== '"' || from !== to || view.state.selection.ranges.length > 1) return false;
		if (view.state.sliceDoc(from, from + 1) === '"') return false;
		if (!inText(view.state.field(syntaxField).tokens, from)) return false;
		view.dispatch({
			changes: { from, insert: '"' },
			selection: { anchor: from + 1 },
			userEvent: 'input.type',
		});
		return true;
	}),
);

/** Everything the editor knows about littlewing, and how it looks. */
export function littlewing(): Extension {
	return [
		syntaxField,
		analysisField,
		highlighting,
		hover,
		signatureHelp,
		names,
		completion,
		EditorState.languageData.of(() => [
			{ commentTokens: { line: '//' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
		]),
		quoteInString,
		indentUnit.of('  '),
		EditorState.tabSize.of(2),
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		EditorState.allowMultipleSelections.of(true),
		bracketMatching(),
		closeBrackets(),
		rectangularSelection(),
		crosshairCursor(),
		highlightActiveLine(),
		highlightSelectionMatches(),
		keymap.of([
			...nameKeymap,
			...closeBracketsKeymap,
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			...completionKeymap,
			...lintKeymap,
			indentWithTab,
		]),
		theme,
	];
}
