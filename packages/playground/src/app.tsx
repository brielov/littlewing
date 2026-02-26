import { generate, parse } from "littlewing";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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

// --- URL hash encoding (gzip + base64url) ---

async function compress(input: string): Promise<string> {
	const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decompress(encoded: string): Promise<string> {
	const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	return new Response(stream).text();
}

async function readSourceFromHash(): Promise<string | null> {
	const hash = window.location.hash.slice(1);
	if (!hash) return null;
	try {
		return await decompress(hash);
	} catch {
		return null;
	}
}

// --- Dark mode ---

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
	const [ready, setReady] = useState(false);
	const isDark = useSyncExternalStore(subscribeToDarkMode, getIsDark);

	// Restore source from URL hash on mount
	useEffect(() => {
		void readSourceFromHash().then((decoded) => {
			if (decoded !== null) {
				setSource(decoded);
			}
			setReady(true);
		});
	}, []);

	// Sync source to URL hash (debounced to avoid thrashing during typing)
	useEffect(() => {
		if (!ready) return;
		const id = setTimeout(() => {
			if (source.trim() === "") {
				history.replaceState(null, "", window.location.pathname + window.location.search);
			} else {
				void compress(source).then((hash) => {
					history.replaceState(null, "", `#${hash}`);
				});
			}
		}, 500);
		return () => clearTimeout(id);
	}, [source, ready]);

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
