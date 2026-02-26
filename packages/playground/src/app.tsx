import { generate, parse } from "littlewing";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Editor } from "./editor.tsx";
import { Sidebar } from "./sidebar.tsx";
import { useEvaluation } from "./use-evaluation.ts";

const INITIAL_SOURCE = `// littlewing playground
price = 100
tax_rate = 0.08
discount = 15

subtotal = price - discount
tax = subtotal * tax_rate
total = subtotal + tax

if total > 100 then "expensive" else "affordable"`;

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function subscribeToDarkMode(callback: () => void): () => void {
	darkQuery.addEventListener("change", callback);
	return () => darkQuery.removeEventListener("change", callback);
}

function getIsDark(): boolean {
	return darkQuery.matches;
}

export function App() {
	const [source, setSource] = useState(INITIAL_SOURCE);
	const isDark = useSyncExternalStore(subscribeToDarkMode, getIsDark);
	const evaluation = useEvaluation(source);

	const formatSource = useCallback(() => {
		try {
			setSource(generate(parse(source)));
		} catch {
			// Source has parse errors — silently ignore
		}
	}, [source]);

	const monacoTheme = isDark ? "tomorrow-night" : "tomorrow";

	return (
		<div className="flex h-full flex-col" style={{ backgroundColor: "var(--color-bg)" }}>
			<header
				className="flex shrink-0 items-center justify-between px-4"
				style={{
					height: 44,
					borderBottom: "1px solid var(--color-border)",
				}}
			>
				<span
					className="text-sm font-semibold tracking-tight"
					style={{
						fontFamily: '"Maple Mono", monospace',
						color: "var(--color-fg)",
					}}
				>
					littlewing
				</span>
				<button
					type="button"
					onClick={formatSource}
					className="cursor-pointer text-xs"
					style={{ color: "var(--color-fg-muted)" }}
					title="Format code"
				>
					Format
				</button>
			</header>
			<main className="flex min-h-0 flex-1">
				<div className="flex min-h-0 min-w-0" style={{ flex: "7 1 0%" }}>
					<Editor value={source} onChange={setSource} theme={monacoTheme} />
				</div>
				<div className="min-h-0" style={{ flex: "3 1 0%" }}>
					<Sidebar evaluation={evaluation} />
				</div>
			</main>
		</div>
	);
}
