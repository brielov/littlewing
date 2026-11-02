/**
 * The Markdown the language guide is written in, read into blocks a page can
 * draw: headings, paragraphs, fenced code, tables and lists. Nothing more is
 * read, as the guide uses nothing more, and a test keeps it that way.
 */

export type Inline =
	| { readonly kind: 'text'; readonly text: string }
	| { readonly kind: 'code'; readonly text: string }
	| { readonly kind: 'strong'; readonly text: readonly Inline[] }
	| { readonly kind: 'link'; readonly text: readonly Inline[]; readonly href: string };

export type Block =
	| {
			readonly kind: 'heading';
			readonly level: number;
			readonly text: readonly Inline[];
			readonly id: string;
	  }
	| { readonly kind: 'paragraph'; readonly text: readonly Inline[] }
	| { readonly kind: 'code'; readonly language: string; readonly text: string }
	| {
			readonly kind: 'table';
			readonly header: readonly Inline[][];
			readonly rows: readonly Inline[][][];
	  }
	| { readonly kind: 'list'; readonly items: readonly Inline[][] };

/** Text with `code`, **strong** and [links](href) in it. */
export function inline(text: string): Inline[] {
	const parts: Inline[] = [];
	// Strong text runs to the next `**` outside a code span in it
	const pattern = /`([^`]+)`|\*\*((?:`[^`]*`|[^`])+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
	let last = 0;
	for (const match of text.matchAll(pattern)) {
		if (match.index > last)
			parts.push({ kind: 'text', text: unescape(text.slice(last, match.index)) });
		const [whole, code, strong, label, href] = match;
		if (code !== undefined) parts.push({ kind: 'code', text: code });
		else if (strong !== undefined) parts.push({ kind: 'strong', text: inline(strong) });
		else parts.push({ kind: 'link', text: inline(label!), href: href! });
		last = match.index + whole.length;
	}
	if (last < text.length) parts.push({ kind: 'text', text: unescape(text.slice(last)) });
	return parts;
}

function unescape(text: string): string {
	return text.replace(/\\([\\`*_[\]()#|])/g, '$1');
}

/** The text of inline content, without its markup. */
export function plain(parts: readonly Inline[]): string {
	return parts
		.map((part) => (part.kind === 'link' || part.kind === 'strong' ? plain(part.text) : part.text))
		.join('');
}

/** An id for a heading, as GitHub makes them, so links to sections keep working. */
export function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/\s/g, '-');
}

/** The cells of a table row, where `\|` is a bar inside a cell, code spans included. */
function cells(line: string): string[] {
	const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
	return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll('\\|', '|'));
}

export function parseMarkdown(source: string): Block[] {
	const lines = source.replace(/\r\n?/g, '\n').split('\n');
	const blocks: Block[] = [];
	// Repeated headings get `-1`, `-2` and so on, as GitHub numbers them
	const repeats = new Map<string, number>();
	const taken = new Set<string>();
	let i = 0;
	while (i < lines.length) {
		const line = lines[i]!;
		if (line.trim() === '') {
			i++;
			continue;
		}
		const fence = /^```(\S*).*$/.exec(line);
		if (fence !== null) {
			const body: string[] = [];
			i++;
			while (i < lines.length && !/^```\s*$/.test(lines[i]!)) body.push(lines[i++]!);
			i++;
			blocks.push({ kind: 'code', language: fence[1] ?? '', text: body.join('\n') });
			continue;
		}
		const heading = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
		if (heading !== null) {
			const text = inline(heading[2]!);
			// A repeat gets a number, the next one no id has taken, as GitHub's slugger does
			const base = slug(plain(text));
			let n = repeats.get(base) ?? 0;
			let id = n === 0 ? base : `${base}-${n}`;
			while (taken.has(id)) id = `${base}-${++n}`;
			repeats.set(base, n + 1);
			taken.add(id);
			blocks.push({ kind: 'heading', level: heading[1]!.length, text, id });
			i++;
			continue;
		}
		if (line.trimStart().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
			const header = cells(line).map(inline);
			i += 2;
			const rows: Inline[][][] = [];
			while (i < lines.length && lines[i]!.trimStart().startsWith('|'))
				rows.push(cells(lines[i++]!).map(inline));
			blocks.push({ kind: 'table', header, rows });
			continue;
		}
		if (/^[-*]\s+/.test(line)) {
			const items: Inline[][] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i]!))
				items.push(inline(lines[i++]!.replace(/^[-*]\s+/, '')));
			blocks.push({ kind: 'list', items });
			continue;
		}
		// A paragraph runs to a blank line or the start of another block, and holds
		// at least this line, which no block above could read
		const text: string[] = [line.trim()];
		i++;
		while (
			i < lines.length &&
			lines[i]!.trim() !== '' &&
			!/^(```|#{1,6}\s|\||[-*]\s)/.test(lines[i]!)
		) {
			text.push(lines[i++]!.trim());
		}
		blocks.push({ kind: 'paragraph', text: inline(text.join(' ')) });
	}
	return blocks;
}
