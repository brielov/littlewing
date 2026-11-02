import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import { Editor } from './editor.tsx';
import { ErrorBoundary } from './error-boundary.tsx';
import { INITIAL_SOURCE } from './examples.ts';
import { ExamplesDialog } from './examples-dialog.tsx';
import { HelpDialog } from './help-dialog.tsx';
import { formatDocument } from './editor/index.ts';
import { useEvaluation } from './evaluation/hook.ts';
import { Panel } from './results/panel.tsx';

// --- URL hash encoding (gzip + base64url) ---

async function compress(input: string): Promise<string> {
	const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompress(encoded: string): Promise<string> {
	const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
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

// --- Desktop breakpoint (matches Tailwind md: = 768px) ---

const desktopQuery = window.matchMedia('(min-width: 768px)');

function subscribeToDesktop(callback: () => void): () => void {
	desktopQuery.addEventListener('change', callback);
	return () => desktopQuery.removeEventListener('change', callback);
}

function getIsDesktop(): boolean {
	return desktopQuery.matches;
}

type MobileView = 'editor' | 'results';

export function App() {
	const [source, setSource] = useState(INITIAL_SOURCE);
	// The editor keeps `\n` line breaks, so a source from elsewhere is given them first
	const replaceSource = useCallback((text: string) => setSource(text.replace(/\r\n?/g, '\n')), []);
	const [ready, setReady] = useState(false);
	const [mobileView, setMobileView] = useState<MobileView>('editor');
	const isDesktop = useSyncExternalStore(subscribeToDesktop, getIsDesktop);

	// Restore source from URL hash on mount
	useEffect(() => {
		void readSourceFromHash().then((decoded) => {
			if (decoded !== null) replaceSource(decoded);
			setReady(true);
		});
	}, [replaceSource]);

	// Sync source to URL hash (debounced to avoid thrashing during typing)
	useEffect(() => {
		if (!ready) return;
		const id = setTimeout(() => {
			if (source.trim() === '') {
				history.replaceState(null, '', window.location.pathname + window.location.search);
			} else {
				void compress(source).then((hash) => {
					history.replaceState(null, '', `#${hash}`);
				});
			}
		}, 500);
		return () => clearTimeout(id);
	}, [source, ready]);

	const evaluation = useEvaluation(source);

	// The editor, once it exists, and a place to show in it once it does
	const view = useRef<EditorView | null>(null);
	const [jump, setJump] = useState<{ from: number; to: number } | null>(null);
	const onView = useCallback((editor: EditorView | null) => {
		view.current = editor;
		if (editor !== null) setJump((pending) => (pending === null ? null : { ...pending }));
	}, []);
	useEffect(() => {
		const editor = view.current;
		if (jump === null || editor === null) return;
		const length = editor.state.doc.length;
		const from = Math.min(jump.from, length);
		editor.dispatch({
			selection: EditorSelection.range(from, Math.min(Math.max(jump.to, from), length)),
			effects: EditorView.scrollIntoView(from, { y: 'center' }),
		});
		editor.focus();
		setJump(null);
	}, [jump]);
	const onJump = useCallback((from: number, to: number) => {
		setMobileView('editor');
		setJump({ from, to });
	}, []);

	// In the editor, so that formatting can be undone
	const formatSource = useCallback(() => {
		if (view.current !== null) formatDocument(view.current);
	}, []);

	const editor = (
		<Editor
			value={source}
			onChange={setSource}
			analyzed={evaluation.problemsSource}
			problems={evaluation.problems}
			types={evaluation.types}
			typesCurrent={evaluation.typesCurrent}
			onView={onView}
		/>
	);
	const results = (
		<ErrorBoundary resetKey={evaluation.source}>
			<Panel evaluation={evaluation} onJump={onJump} />
		</ErrorBoundary>
	);

	return (
		<div className="flex h-full flex-col bg-(--color-bg)">
			<header className="flex h-11 shrink-0 items-center justify-between border-b border-(--color-border) px-4">
				<a href={window.location.pathname} className="text-sm font-semibold tracking-tight">
					littlewing
				</a>
				<nav className="flex items-center gap-3 text-xs text-(--color-fg-muted)">
					<ExamplesDialog onSelect={replaceSource} />
					<button
						type="button"
						onClick={formatSource}
						className="cursor-pointer hover:text-(--color-fg)"
						title="Format (Shift+Alt+F)"
					>
						Format
					</button>
					<HelpDialog />
					<a
						href="https://github.com/brielov/littlewing"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-(--color-fg)"
					>
						GitHub
					</a>
				</nav>
			</header>

			{isDesktop ? (
				<main className="flex min-h-0 flex-1">
					<div className="flex min-h-0 min-w-0 flex-[7_1_0%]">{editor}</div>
					<div className="flex min-h-0 flex-[3_1_0%] border-l border-(--color-border)">
						{results}
					</div>
				</main>
			) : (
				<>
					{/* Both stay mounted, so that switching keeps undo history and what is typed */}
					<main className="relative flex min-h-0 flex-1">
						<div
							className={`min-h-0 min-w-0 flex-1 ${mobileView === 'editor' ? 'flex' : 'hidden'}`}
						>
							{editor}
						</div>
						<div
							className={`min-h-0 min-w-0 flex-1 ${mobileView === 'results' ? 'flex' : 'hidden'}`}
						>
							{results}
						</div>
					</main>
					<nav className="flex h-11 shrink-0 border-t border-(--color-border)">
						<TabButton active={mobileView === 'editor'} onClick={() => setMobileView('editor')}>
							Editor
						</TabButton>
						<TabButton active={mobileView === 'results'} onClick={() => setMobileView('results')}>
							Results
						</TabButton>
					</nav>
				</>
			)}
		</div>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-1 cursor-pointer items-center justify-center text-xs font-medium ${
				active ? 'text-(--color-accent)' : 'text-(--color-fg-muted)'
			}`}
		>
			{children}
		</button>
	);
}
