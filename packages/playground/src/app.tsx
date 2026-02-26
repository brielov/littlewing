import { defaultContext, evaluate } from "littlewing";
import { type ChangeEvent, useCallback, useState } from "react";

const INITIAL_SOURCE = `// Try littlewing expressions here
x = 10
y = 20
x + y`;

function formatResult(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(formatResult).join(", ")}]`;
	}
	if (typeof value === "string") {
		return `"${value}"`;
	}
	return String(value);
}

export function App() {
	const [source, setSource] = useState(INITIAL_SOURCE);
	const [result, setResult] = useState(() => run(INITIAL_SOURCE));

	function run(code: string): { ok: true; value: string } | { ok: false; error: string } {
		try {
			const value = evaluate(code, defaultContext);
			return { ok: true, value: formatResult(value) };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		const code = e.target.value;
		setSource(code);
		setResult(run(code));
	}, []);

	return (
		<div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
			<header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
				<h1 className="text-lg font-semibold tracking-tight">littlewing playground</h1>
			</header>
			<main className="flex min-h-0 flex-1">
				<div className="flex flex-1 flex-col border-r border-zinc-800">
					<div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
						Input
					</div>
					<textarea
						className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
						value={source}
						onChange={handleChange}
						placeholder="Enter an expression..."
						spellCheck={false}
						autoFocus
					/>
				</div>
				<div className="flex flex-1 flex-col">
					<div className="border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
						Output
					</div>
					<div className="flex-1 p-4 font-mono text-sm leading-relaxed">
						{result.ok ? (
							<span className="text-emerald-400">{result.value}</span>
						) : (
							<span className="text-red-400">{result.error}</span>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
