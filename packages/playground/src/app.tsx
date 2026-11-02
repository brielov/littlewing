import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
	lazy,
	type ReactNode,
	Suspense,
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

import { formatDocument, syntaxField, tokenBefore } from './editor/index.ts';
import { FUNCTION_DESCRIPTIONS } from './language/catalog.ts';
import { insertion } from './language/insert.ts';
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

// The guide and the reference load when first opened, off the playground's way
const Learn = lazy(() => import('./learn/learn.tsx').then(({ Learn }) => ({ default: Learn })));
const Reference = lazy(() =>
	import('./learn/reference.tsx').then(({ Reference }) => ({ default: Reference })),
);

/** The pages, which the address keeps in `?page=`, as its hash holds the program. */
const PAGES = ['playground', 'learn', 'functions'] as const;
type Page = (typeof PAGES)[number];

function pageOf(search: string): Page {
	const page = new URLSearchParams(search).get('page');
	return PAGES.find((candidate) => candidate === page) ?? 'playground';
}

function subscribeToHistory(callback: () => void): () => void {
	window.addEventListener('popstate', callback);
	return () => window.removeEventListener('popstate', callback);
}

export function App() {
	const [source, setSource] = useState(INITIAL_SOURCE);
	// The editor keeps `\n` line breaks, so a source from elsewhere is given them first
	const replaceSource = useCallback((text: string) => setSource(text.replace(/\r\n?/g, '\n')), []);
	const [ready, setReady] = useState(false);
	const [mobileView, setMobileView] = useState<MobileView>('editor');
	const isDesktop = useSyncExternalStore(subscribeToDesktop, getIsDesktop);
	const search = useSyncExternalStore(subscribeToHistory, () => window.location.search);
	const page = pageOf(search);
	// The pages opened so far, which stay mounted from then on
	const [seen, setSeen] = useState<ReadonlySet<Page>>(() => new Set([page]));
	if (!seen.has(page)) setSeen(new Set([...seen, page]));
	const go = useCallback((next: Page) => {
		if (next === pageOf(window.location.search)) return;
		const url = new URL(window.location.href);
		if (next === 'playground') url.searchParams.delete('page');
		else url.searchParams.set('page', next);
		history.pushState(null, '', url);
		// pushState is not an event, so what reads the address is told
		window.dispatchEvent(new PopStateEvent('popstate'));
	}, []);

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
					history.replaceState(null, '', `${window.location.search}#${hash}`);
				});
			}
		}, 500);
		return () => clearTimeout(id);
		// A new page is a new entry in the history, which takes the program as it is now
	}, [source, ready, search]);

	const evaluation = useEvaluation(source);

	// The editor, once it exists, and a place to show in it once it does
	const view = useRef<EditorView | null>(null);
	const [jump, setJump] = useState<{ from: number; to: number } | null>(null);
	// Whether the editor has had the focus, which says whether its cursor is somewhere chosen
	const touched = useRef(false);
	const onView = useCallback((editor: EditorView | null) => {
		view.current = editor;
		if (editor === null) return;
		editor.contentDOM.addEventListener('focusin', () => {
			touched.current = true;
		});
		setJump((pending) => (pending === null ? null : { ...pending }));
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

	// An example from the guide replaces the program, and a function goes in at the cursor
	const tryExample = useCallback(
		(example: string) => {
			replaceSource(example);
			setMobileView('editor');
			go('playground');
		},
		[replaceSource, go],
	);
	// A function to put in the editor once it shows, as it cannot take the focus hidden
	const [inserting, setInserting] = useState<string | null>(null);
	const insertFunction = useCallback(
		(name: string) => {
			go('playground');
			setMobileView('editor');
			setInserting(name);
		},
		[go],
	);
	useEffect(() => {
		const editor = view.current;
		const description = inserting === null ? undefined : FUNCTION_DESCRIPTIONS.get(inserting);
		if (editor === null || inserting === null || page !== 'playground' || description === undefined)
			return;
		setInserting(null);
		const { state } = editor;
		// Where the cursor is, if one was put somewhere, or else on a line of its own at the end
		let { from, to } = state.selection.main;
		let prefix = '';
		if (!touched.current) {
			from = to = state.doc.length;
			prefix = state.doc.length > 0 && !state.doc.toString().endsWith('\n') ? '\n' : '';
		}
		const before = tokenBefore(state.field(syntaxField).tokens, from);
		const { text, cursor } = insertion(inserting, description, state.sliceDoc(from, to), before);
		editor.dispatch({
			changes: { from, to, insert: prefix + text },
			selection: { anchor: from + prefix.length + cursor },
			scrollIntoView: true,
			userEvent: 'input',
		});
		editor.focus();
	}, [inserting, page, mobileView]);

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
			<header className="flex h-11 shrink-0 items-center gap-2 border-b border-(--color-border) px-2 sm:gap-4 sm:px-4">
				<a
					href={window.location.pathname}
					className="hidden text-sm font-semibold tracking-tight sm:block"
				>
					littlewing
				</a>
				<nav className="flex items-center text-xs" aria-label="Pages">
					{PAGES.map((name) => (
						<a
							key={name}
							href={`${window.location.pathname}${name === 'playground' ? '' : `?page=${name}`}${window.location.hash}`}
							// The program in the address changes without a render, so a link opened
							// elsewhere takes it as it is when it is pressed
							onPointerDown={(event) => {
								event.currentTarget.hash = window.location.hash;
							}}
							onClick={(event) => {
								// A click with a modifier opens the page elsewhere, as for any link
								const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
								if (modified || event.button !== 0) return;
								event.preventDefault();
								go(name);
							}}
							aria-current={page === name ? 'page' : undefined}
							className={`rounded px-2 py-1 capitalize ${
								page === name
									? 'bg-(--color-bg-secondary) text-(--color-fg)'
									: 'text-(--color-fg-muted) hover:text-(--color-fg)'
							}`}
						>
							{name}
						</a>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-3 text-xs text-(--color-fg-muted)">
					{page === 'playground' && (
						<>
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
						</>
					)}
					<a
						href="https://github.com/brielov/littlewing"
						target="_blank"
						rel="noopener noreferrer"
						className="hidden hover:text-(--color-fg) sm:inline"
					>
						GitHub
					</a>
				</div>
			</header>

			{/* Every page stays mounted once seen, so what is typed, scrolled or searched stays */}
			<div hidden={page !== 'playground'} className="flex min-h-0 flex-1 flex-col">
				{isDesktop ? (
					<main className="flex min-h-0 flex-1">
						<div className="flex min-h-0 min-w-0 flex-[7_1_0%]">{editor}</div>
						<div className="flex min-h-0 flex-[3_1_0%] border-l border-(--color-border)">
							{results}
						</div>
					</main>
				) : (
					<>
						<main className="relative flex min-h-0 flex-1">
							<div hidden={mobileView !== 'editor'} className="flex min-h-0 min-w-0 flex-1">
								{editor}
							</div>
							<div hidden={mobileView !== 'results'} className="flex min-h-0 min-w-0 flex-1">
								{results}
							</div>
						</main>
						<nav aria-label="Views" className="flex h-11 shrink-0 border-t border-(--color-border)">
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
			{/* A page that cannot load says so where it would be, and leaves the rest as it was */}
			{seen.has('learn') && (
				<div hidden={page !== 'learn'} className="flex min-h-0 flex-1">
					<ErrorBoundary resetKey="learn" message="This page could not load. Reload to try again.">
						<Suspense fallback={null}>
							<Learn onTry={tryExample} />
						</Suspense>
					</ErrorBoundary>
				</div>
			)}
			{seen.has('functions') && (
				<div hidden={page !== 'functions'} className="flex min-h-0 flex-1">
					<ErrorBoundary
						resetKey="functions"
						message="This page could not load. Reload to try again."
					>
						<Suspense fallback={null}>
							<Reference onInsert={insertFunction} />
						</Suspense>
					</ErrorBoundary>
				</div>
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
