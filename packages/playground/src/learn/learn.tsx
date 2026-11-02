import guide from '../../../../LANGUAGE.md?raw';
import { Fragment, type ReactNode } from 'react';
import { Code } from './code.tsx';
import { type Block, type Inline, parseMarkdown, plain } from './markdown.ts';

const REPOSITORY = 'https://github.com/brielov/littlewing/blob/master/';

const blocks = parseMarkdown(guide);

/** The guide's sections, which its contents list. */
const sections = blocks.flatMap((block) =>
	block.kind === 'heading' && block.level === 2 ? [{ id: block.id, title: plain(block.text) }] : [],
);

/**
 * Go to a section, as a link to `#id` would, without touching the address, whose
 * hash holds the program being shared. Its heading takes the focus, so what reads
 * the page aloud goes there too.
 */
function scrollTo(event: React.MouseEvent, id: string): void {
	event.preventDefault();
	const heading = document.getElementById(id);
	if (heading === null) return;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	heading.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
	heading.focus({ preventScroll: true });
}

/**
 * Where a link in the guide goes: a section of it, a page on the web, or a file
 * next to it in the repository. Nothing else is a link.
 */
function hrefOf(href: string): { href: string; external: boolean } | undefined {
	if (href.startsWith('#')) return { href, external: false };
	if (/^https?:/i.test(href)) return { href, external: true };
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return undefined;
	return { href: REPOSITORY + href.replace(/^\.\//, ''), external: true };
}

function InlineText({ parts }: { parts: readonly Inline[] }) {
	return (
		<>
			{parts.map((part, i) => {
				switch (part.kind) {
					case 'text':
						return <Fragment key={i}>{part.text}</Fragment>;
					case 'code':
						return (
							<code key={i} className="rounded bg-(--color-bg-secondary) px-1 py-px">
								{part.text}
							</code>
						);
					case 'strong':
						return (
							<strong key={i}>
								<InlineText parts={part.text} />
							</strong>
						);
					case 'link': {
						const target = hrefOf(part.href);
						if (target === undefined) return <InlineText key={i} parts={part.text} />;
						const { href, external } = target;
						return (
							<a
								key={i}
								href={href}
								onClick={external ? undefined : (event) => scrollTo(event, href.slice(1))}
								className="text-(--color-accent) underline-offset-2 hover:underline"
								{...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
							>
								<InlineText parts={part.text} />
							</a>
						);
					}
				}
			})}
		</>
	);
}

/** An example from the guide, with what it gives and a way to run it. */
function Example({ source, onTry }: { source: string; onTry: (source: string) => void }) {
	// The value an example gives is its last line, a comment of its own
	const expected = /(?:^|\n)\/\/ => (.*)$/.exec(source);
	const program = expected === null ? source : source.slice(0, expected.index);
	return (
		<figure className="my-4 overflow-hidden rounded-md border border-(--color-border)">
			<pre className="overflow-x-auto bg-(--color-bg-secondary) px-4 py-3 text-[13px] leading-[22px]">
				<Code source={program} />
			</pre>
			<figcaption className="flex items-center justify-between gap-3 border-t border-(--color-border) px-4 py-1.5 text-xs">
				<span className="text-(--color-fg-muted)">
					{expected !== null && (
						<>
							gives <Code source={expected[1]!} />
						</>
					)}
				</span>
				<button
					type="button"
					className="cursor-pointer text-(--color-accent) hover:underline"
					onClick={() => onTry(program)}
					aria-label={`Try it: ${program.split('\n')[0]}`}
				>
					Try it
				</button>
			</figcaption>
		</figure>
	);
}

function BlockView({ block, onTry }: { block: Block; onTry: (source: string) => void }): ReactNode {
	switch (block.kind) {
		case 'heading': {
			const size =
				['', 'text-2xl mb-4', 'text-lg mt-10 mb-3', 'text-base mt-6 mb-2'][block.level] ?? 'mt-4';
			const Tag = `h${Math.min(block.level, 6)}` as 'h1';
			return (
				<Tag
					id={block.id}
					tabIndex={-1}
					className={`scroll-mt-4 font-semibold outline-none ${size}`}
				>
					<InlineText parts={block.text} />
				</Tag>
			);
		}
		case 'paragraph':
			return (
				<p className="my-3 leading-relaxed">
					<InlineText parts={block.text} />
				</p>
			);
		case 'code':
			return block.language === 'littlewing' ? (
				<Example source={block.text} onTry={onTry} />
			) : (
				<pre className="my-4 overflow-x-auto rounded-md bg-(--color-bg-secondary) px-4 py-3 text-[13px]">
					{block.text}
				</pre>
			);
		case 'list':
			return (
				<ul className="my-3 list-disc pl-5 leading-relaxed">
					{block.items.map((item, i) => (
						<li key={i}>
							<InlineText parts={item} />
						</li>
					))}
				</ul>
			);
		case 'table':
			return (
				<div className="my-4 overflow-x-auto">
					<table className="w-full border-collapse text-left text-xs">
						<thead>
							<tr className="border-b border-(--color-border) text-(--color-fg-muted)">
								{block.header.map((cell, i) => (
									<th key={i} className="py-1.5 pr-4 font-medium">
										<InlineText parts={cell} />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row, i) => (
								<tr key={i} className="border-b border-(--color-border) align-top last:border-0">
									{row.map((cell, j) => (
										<td key={j} className="py-1.5 pr-4 leading-relaxed">
											<InlineText parts={cell} />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
	}
}

/** The links to the guide's sections. */
function Contents() {
	return (
		<ul className="flex flex-col gap-1.5">
			{sections.map(({ id, title }) => (
				<li key={id}>
					<a
						href={`#${id}`}
						onClick={(event) => scrollTo(event, id)}
						className="text-(--color-fg-muted) hover:text-(--color-fg)"
					>
						{title}
					</a>
				</li>
			))}
		</ul>
	);
}

/** The language guide, with every example runnable in the playground. */
export function Learn({ onTry }: { onTry: (source: string) => void }) {
	return (
		<div className="flex h-full min-h-0 w-full">
			<nav
				aria-label="Sections"
				className="hidden w-56 shrink-0 overflow-y-auto border-r border-(--color-border) px-4 py-6 text-xs lg:block"
			>
				<Contents />
			</nav>
			<article className="min-w-0 flex-1 overflow-y-auto px-4 py-6 text-sm sm:px-10">
				<div className="mx-auto max-w-2xl">
					{/* Where the side list has no room, the sections open from the top */}
					<details className="mb-4 rounded-md border border-(--color-border) px-3 py-2 text-xs lg:hidden">
						<summary className="cursor-pointer text-(--color-fg-muted)">Contents</summary>
						<nav aria-label="Sections" className="mt-2">
							<Contents />
						</nav>
					</details>
					{blocks.map((block, i) => (
						<BlockView key={i} block={block} onTry={onTry} />
					))}
				</div>
			</article>
		</div>
	);
}
