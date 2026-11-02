import MonacoEditor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type monaco from 'monaco-editor';
import type { editor as MonacoEditorNs } from 'monaco-editor';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from './use-evaluation.ts';
import {
	registerLittlewingLanguage,
	registerLittlewingThemes,
	setLanguageAnalysis,
} from './language.ts';

interface EditorProps {
	value: string;
	onChange: (value: string) => void;
	theme: 'tomorrow' | 'tomorrow-night';
	diagnostics?: readonly Diagnostic[];
	inputTypes?: ReadonlyMap<string, string>;
}

/**
 * Module-level Monaco initialization. `registerLittlewingLanguage` internally
 * disposes previous providers before re-registering, so calling it once here
 * is safe even after Vite HMR reloads this module.
 */
let initialized = false;

function ensureInitialized(m: Parameters<BeforeMount>[0]): void {
	if (initialized) return;
	initialized = true;
	registerLittlewingLanguage(m);
	registerLittlewingThemes(m);
}

// Vite HMR: when this module is replaced, reset the flag so
// the next Editor mount re-registers with dispose-and-replace.
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		initialized = false;
	});
}

const NO_INPUTS: ReadonlyMap<string, string> = new Map();

export function Editor({
	value,
	onChange,
	theme,
	diagnostics = [],
	inputTypes = NO_INPUTS,
}: EditorProps) {
	const monacoRef = useRef<typeof monaco | null>(null);
	const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);

	// Store diagnostics and input types in refs so that the `onMount` callback
	// (which may be captured by @monaco-editor/react from an earlier render)
	// always reads the latest values.
	const diagnosticsRef = useRef(diagnostics);
	diagnosticsRef.current = diagnostics;

	const inputTypesRef = useRef(inputTypes);
	inputTypesRef.current = inputTypes;

	const applyDiagnostics = () => {
		const m = monacoRef.current;
		const editor = editorRef.current;
		if (!m || !editor) return;

		const model = editor.getModel();
		if (!model) return;

		const current = diagnosticsRef.current;
		const markers: MonacoEditorNs.IMarkerData[] = current.map((d) => ({
			severity: d.severity === 'error' ? m.MarkerSeverity.Error : m.MarkerSeverity.Warning,
			code: d.code,
			message: d.message,
			startLineNumber: d.startLine,
			startColumn: d.startCol,
			endLineNumber: d.endLine,
			endColumn: d.endLine === d.startLine ? Math.max(d.endCol, d.startCol + 1) : d.endCol,
		}));

		m.editor.setModelMarkers(model, 'littlewing', markers);
	};

	const handleBeforeMount: BeforeMount = (m) => {
		ensureInitialized(m);
		monacoRef.current = m;
	};

	const handleMount: OnMount = (editor) => {
		editorRef.current = editor;
		setLanguageAnalysis({ inputTypes: inputTypesRef.current });
		applyDiagnostics();
		editor.focus();
	};

	// Sync compiler-derived editor metadata as the evaluation result changes.
	useEffect(() => {
		const m = monacoRef.current;
		if (m) ensureInitialized(m);
		setLanguageAnalysis({ inputTypes });
	}, [inputTypes]);

	useEffect(() => {
		applyDiagnostics();
	}, [diagnostics]);

	return (
		<MonacoEditor
			language="littlewing"
			theme={theme}
			value={value}
			onChange={(v) => onChange(v ?? '')}
			beforeMount={handleBeforeMount}
			onMount={handleMount}
			options={{
				fontFamily: '"Maple Mono", monospace',
				fontSize: 14,
				lineHeight: 22,
				fontLigatures: true,
				minimap: { enabled: false },
				padding: { top: 16, bottom: 16 },
				scrollBeyondLastLine: false,
				automaticLayout: true,
				renderLineHighlight: 'line',
				overviewRulerLanes: 0,
				hideCursorInOverviewRuler: true,
				scrollbar: {
					verticalScrollbarSize: 8,
					horizontalScrollbarSize: 8,
				},
				bracketPairColorization: { enabled: true },
				tabSize: 2,
			}}
		/>
	);
}
