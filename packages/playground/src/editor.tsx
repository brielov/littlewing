import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { littlewing, type Problem, setAnalysis, showProblems } from './editor/index.ts';

interface EditorProps {
	/** The source, with `\n` line breaks, as the editor keeps it. */
	value: string;
	onChange: (value: string) => void;
	/** The source the problems and input types are about, which lags `value`. */
	analyzed: string;
	problems: readonly Problem[];
	inputTypes: ReadonlyMap<string, string>;
}

interface Analyzed {
	readonly source: string;
	readonly problems: readonly Problem[];
	readonly inputTypes: ReadonlyMap<string, string>;
}

/** Show what was found about a source, if it is what the editor holds. */
function apply(view: EditorView, analyzed: Analyzed): void {
	if (view.state.doc.toString() !== analyzed.source) return;
	showProblems(view, analyzed.problems, setAnalysis.of({ inputTypes: analyzed.inputTypes }));
}

export function Editor({ value, onChange, analyzed, problems, inputTypes }: EditorProps) {
	const parent = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const changed = useRef(onChange);
	changed.current = onChange;
	const latest = useRef<Analyzed>({ source: analyzed, problems, inputTypes });
	latest.current = { source: analyzed, problems, inputTypes };

	useEffect(() => {
		const editor = new EditorView({
			parent: parent.current!,
			state: EditorState.create({
				doc: value,
				extensions: [
					littlewing(),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged) return;
						changed.current(update.state.doc.toString());
						// An edit undone before the analysis caught up brings its problems back,
						// once this update is over, as no transaction can start inside one
						queueMicrotask(() => {
							if (view.current === update.view) apply(update.view, latest.current);
						});
					}),
				],
			}),
		});
		view.current = editor;
		apply(editor, latest.current);
		editor.focus();
		return () => {
			editor.destroy();
			view.current = null;
		};
		// The view is made once; `value` and the analysis reach it below
	}, []);

	// A source from outside, as an example or a shared link, replaces the document
	useEffect(() => {
		const editor = view.current;
		if (editor === null || editor.state.doc.toString() === value) return;
		editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
	}, [value]);

	useEffect(() => {
		if (view.current !== null) apply(view.current, { source: analyzed, problems, inputTypes });
	}, [analyzed, problems, inputTypes]);

	return <div ref={parent} className="h-full min-w-0 flex-1 overflow-hidden" />;
}
