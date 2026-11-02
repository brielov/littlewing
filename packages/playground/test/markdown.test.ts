import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { inline, parseMarkdown, plain } from '../src/learn/markdown.ts';

describe('parseMarkdown', () => {
	test('the blocks a guide has', () => {
		const blocks = parseMarkdown(
			'# Title\n\nSome `code` and a [link](./SPEC.md).\nMore.\n\n```littlewing\n1 + 1\n// => 2\n```\n\n| A | B |\n| - | - |\n| `\\|\\|` | or |\n\n- one\n- two',
		);
		expect(blocks.map((block) => block.kind)).toEqual([
			'heading',
			'paragraph',
			'code',
			'table',
			'list',
		]);
		expect(blocks[0]).toMatchObject({ level: 1, id: 'title' });
		const [, paragraph, code, table] = blocks;
		if (paragraph?.kind !== 'paragraph' || table?.kind !== 'table') throw new Error('blocks');
		expect(plain(paragraph.text)).toBe('Some code and a link. More.');
		expect(code).toEqual({ kind: 'code', language: 'littlewing', text: '1 + 1\n// => 2' });
		expect(table.rows[0]![0]).toEqual([{ kind: 'code', text: '||' }]);
	});

	test('inline markup', () => {
		expect(inline('a **b** [`c`](d) e')).toEqual([
			{ kind: 'text', text: 'a ' },
			{ kind: 'strong', text: [{ kind: 'text', text: 'b' }] },
			{ kind: 'text', text: ' ' },
			{ kind: 'link', text: [{ kind: 'code', text: 'c' }], href: 'd' },
			{ kind: 'text', text: ' e' },
		]);
	});

	test('every line is read, whatever it is', () => {
		// Each of these once stopped the reader where it stood, for good
		expect(parseMarkdown('| not a table\nnext')).toEqual([
			{ kind: 'paragraph', text: [{ kind: 'text', text: '| not a table next' }] },
		]);
		expect(parseMarkdown('```js title="x"\n1\n```')).toEqual([
			{ kind: 'code', language: 'js', text: '1' },
		]);
		expect(parseMarkdown('- a\n```\n```\n|').map(({ kind }) => kind)).toEqual([
			'list',
			'code',
			'paragraph',
		]);
	});

	test('heading ids as GitHub makes them', () => {
		const ids = parseMarkdown('# INDEX_OF and Friends\n## Values\n## Values ##').flatMap((block) =>
			block.kind === 'heading' ? [block.id] : [],
		);
		expect(ids).toEqual(['index_of-and-friends', 'values', 'values-1']);
		const repeated = parseMarkdown('# A\n# A\n# A-1').flatMap((b) =>
			b.kind === 'heading' ? [b.id] : [],
		);
		expect(repeated).toEqual(['a', 'a-1', 'a-1-1']);
	});

	test('a bar in a table cell, and markup in strong text', () => {
		const [table] = parseMarkdown('| a |\n| - |\n| `x \\|\\| y` |');
		expect(table?.kind === 'table' && table.rows[0]![0]).toEqual([
			{ kind: 'code', text: 'x || y' },
		]);
		expect(inline('**a `**` b**')).toEqual([
			{
				kind: 'strong',
				text: [
					{ kind: 'text', text: 'a ' },
					{ kind: 'code', text: '**' },
					{ kind: 'text', text: ' b' },
				],
			},
		]);
		expect(inline('**a `b`**')).toEqual([
			{
				kind: 'strong',
				text: [
					{ kind: 'text', text: 'a ' },
					{ kind: 'code', text: 'b' },
				],
			},
		]);
	});

	test('the language guide reads as these blocks, and nothing is lost', async () => {
		const guide = await Bun.file(join(import.meta.dir, '../../../LANGUAGE.md')).text();
		const blocks = parseMarkdown(guide);
		const fences = guide.match(/^```/gm)?.length ?? 0;
		expect(blocks.filter((block) => block.kind === 'code').length * 2).toBe(fences);
		// Outside fences, every heading is one
		const outside = guide.replace(/^```[\s\S]*?^```$/gm, '');
		expect(blocks.filter((block) => block.kind === 'heading').length).toBe(
			outside.match(/^#{1,6}\s/gm)?.length ?? 0,
		);
		// The guide only uses what the reader reads: no ordered or indented lists
		expect(outside).not.toMatch(/^\s*\d+\.\s|^\s+[-*]\s/m);
	});
});
