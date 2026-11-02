import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { TypeDescription } from 'littlewing';
import { useEffect, useRef } from 'react';
import { littlewing, setAnalysis, showProblems } from './editor/index.ts';
import type { Problem } from './evaluation/protocol.ts';

interface EditorProps {
	/** The source, with `\n` line breaks, as the editor keeps it. */
	value: string;
	onChange: (value: string) => void;
	/** The source the problems and input types are about, which lags `value`. */
	analyzed: string;
	problems: readonly Problem[];
	types: ReadonlyMap<string, TypeDescription>;
	/** Whether `types` are of the analyzed source. */
	typesCurrent: boolean;
	/** Told of the view once it is made, and of null once it is gone. */
	onView?: (view: EditorView | null) => void;
}

interface Analyzed {
	readonly source: string;
	readonly problems: readonly Problem[];
	readonly types: ReadonlyMap<string, TypeDescription>;
	readonly typesCurrent: boolean;
}

/** Show what was found about a source, if it is what the editor holds. */
function apply(view: EditorView, analyzed: Analyzed): void {
	if (view.state.doc.toString() !== analyzed.source) return;
	showProblems(
		view,
		analyzed.problems,
		setAnalysis.of({ types: analyzed.types, current: analyzed.typesCurrent }),
	);
}

export function Editor({
	value,
	onChange,
	analyzed,
	problems,
	types,
	typesCurrent,
	onView,
}: EditorProps) {
	const parent = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const changed = useRef(onChange);
	changed.current = onChange;
	const viewed = useRef(onView);
	viewed.current = onView;
	const latest = useRef<Analyzed>({ source: analyzed, problems, types, typesCurrent });
	latest.current = { source: analyzed, problems, types, typesCurrent };

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
		viewed.current?.(editor);
		return () => {
			viewed.current?.(null);
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
		if (view.current !== null)
			apply(view.current, { source: analyzed, problems, types, typesCurrent });
	}, [analyzed, problems, types, typesCurrent]);

	return <div ref={parent} className="h-full min-w-0 flex-1 overflow-hidden" />;
}
