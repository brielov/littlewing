import { generate, parse } from 'littlewing';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Editor } from './editor.tsx';
import { ErrorBoundary } from './error-boundary.tsx';
import { INITIAL_SOURCE } from './examples.ts';
import { ExamplesDialog } from './examples-dialog.tsx';
import { HelpDialog } from './help-dialog.tsx';
import { Sidebar } from './sidebar.tsx';
import { useEvaluation } from './use-evaluation.ts';

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
			if (decoded !== null) {
				replaceSource(decoded);
			}
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

	const formatSource = useCallback(() => {
		const { program, diagnostics } = parse(source);
		// A tree with errors has lost what they are in
		if (diagnostics.length === 0) setSource(generate(program));
	}, [source]);

	return (
		<div className="flex h-full flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
			<header
				className="flex shrink-0 items-center justify-between px-4"
				style={{
					height: 44,
					borderBottom: '1px solid var(--color-border)',
				}}
			>
				<a
					href={window.location.pathname}
					className="text-sm font-semibold tracking-tight no-underline"
					style={{
						fontFamily: '"Maple Mono", monospace',
						color: 'var(--color-fg)',
					}}
				>
					littlewing
				</a>
				<div className="flex items-center gap-3">
					<ExamplesDialog onSelect={replaceSource} />
					<button
						type="button"
						onClick={formatSource}
						className="cursor-pointer text-xs"
						style={{ color: 'var(--color-fg-muted)' }}
						title="Format code"
					>
						Format
					</button>
					<HelpDialog />
					<a
						href="https://github.com/brielov/littlewing"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs"
						style={{ color: 'var(--color-fg-muted)' }}
						title="GitHub repository"
					>
						GitHub
					</a>
				</div>
			</header>

			{isDesktop ? (
				<main className="flex min-h-0 flex-1 flex-row">
					<div className="flex min-h-0 min-w-0 flex-[7_1_0%]">
						<Editor
							value={source}
							onChange={setSource}
							analyzed={evaluation.source}
							problems={evaluation.diagnostics}
							types={evaluation.types}
							typesCurrent={evaluation.typesCurrent}
						/>
					</div>
					<div
						className="flex min-h-0 flex-[3_1_0%] border-l"
						style={{ borderColor: 'var(--color-border)' }}
					>
						<ErrorBoundary resetKey={evaluation.source}>
							<Sidebar evaluation={evaluation} />
						</ErrorBoundary>
					</div>
				</main>
			) : (
				<>
					<main className="flex min-h-0 flex-1">
						{mobileView === 'editor' ? (
							<Editor
								value={source}
								onChange={setSource}
								analyzed={evaluation.source}
								problems={evaluation.diagnostics}
								types={evaluation.types}
								typesCurrent={evaluation.typesCurrent}
							/>
						) : (
							<ErrorBoundary resetKey={evaluation.source}>
								<Sidebar evaluation={evaluation} />
							</ErrorBoundary>
						)}
					</main>
					<nav
						className="flex shrink-0"
						style={{
							height: 44,
							borderTop: '1px solid var(--color-border)',
							backgroundColor: 'var(--color-bg)',
						}}
					>
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
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-1 cursor-pointer items-center justify-center text-xs font-medium"
			style={{
				color: active ? 'var(--color-accent)' : 'var(--color-fg-muted)',
			}}
		>
			{children}
		</button>
	);
}
