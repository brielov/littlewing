import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import type { StateEffect } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Problem } from '../evaluation/protocol.ts';
import { closest, FUNCTION_DESCRIPTIONS } from '../language/catalog.ts';

/** Warnings about code that does nothing, which is shown faded. */
const UNNECESSARY = new Set(['unused-binding', 'unused-statement']);

function toDiagnostic(view: EditorView, problem: Problem): Diagnostic {
	const { code, message, severity } = problem;
	const length = view.state.doc.length;
	const from = Math.min(problem.from, length);
	const to = Math.min(Math.max(problem.to, from), length);
	// Code that does nothing is faded, not underlined, as it is no mistake
	const shown = UNNECESSARY.has(code) ? 'hint' : severity;
	const diagnostic: Diagnostic = { from, to, severity: shown, message, source: code };

	// The function a name is most likely a slip for
	if (code === 'unknown-function') {
		const name = view.state.sliceDoc(from, to);
		diagnostic.actions = closest(name, FUNCTION_DESCRIPTIONS.keys()).map((candidate) => ({
			name: `Use ${candidate}`,
			apply: (target, start, end) => {
				target.dispatch({ changes: { from: start, to: end, insert: candidate } });
			},
		}));
	}
	return diagnostic;
}

/** Show `problems`, which must be about the document as it is now, with `effects` in the same transaction. */
export function showProblems(
	view: EditorView,
	problems: readonly Problem[],
	...effects: StateEffect<unknown>[]
): void {
	const diagnostics = problems.map((problem) => toDiagnostic(view, problem));
	view.dispatch(setDiagnostics(view.state, diagnostics), { effects });
}
