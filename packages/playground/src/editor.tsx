import MonacoEditor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useRef } from "react";
import { registerLittlewingLanguage, registerLittlewingThemes } from "./language.ts";

interface EditorProps {
	value: string;
	onChange: (value: string) => void;
	theme: "tomorrow" | "tomorrow-night";
}

export function Editor({ value, onChange, theme }: EditorProps) {
	const registeredRef = useRef(false);

	const handleBeforeMount: BeforeMount = (monaco) => {
		if (!registeredRef.current) {
			registerLittlewingLanguage(monaco);
			registerLittlewingThemes(monaco);
			registeredRef.current = true;
		}
	};

	const handleMount: OnMount = (editor) => {
		editor.focus();
	};

	return (
		<MonacoEditor
			language="littlewing"
			theme={theme}
			value={value}
			onChange={(v) => onChange(v ?? "")}
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
				renderLineHighlight: "line",
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
