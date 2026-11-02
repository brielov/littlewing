import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import * as clock from '../src/clock.js';
import { compile, evaluate } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import { CompileError } from '../src/errors.js';
import * as std from '../src/std.js';
import { date, datetime, temporalFunctions, time } from '../src/temporal.js';
import { examples, INITIAL_SOURCE } from '../../playground/src/examples.ts';

const functions = { ...std, ...temporalFunctions, ...clock };
const types = [date, time, datetime];

function run(source: string): unknown {
	const result = compile(source, { functions, types });
	if (!result.ok) throw new CompileError(result.diagnostics);
	return evaluate(result.program);
}

const root = join(import.meta.dir, '..', '..', '..');

function blocksOf(file: string, language: string): string[] {
	const text = readFileSync(join(root, file), 'utf8');
	const fence = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g');
	return Array.from(text.matchAll(fence), (match) => match[1] as string);
}

/** A value as the docs write it. */
function written(value: unknown): string {
	if (value instanceof Decimal) return value.toString();
	if (Array.isArray(value)) return `[${value.map(written).join(', ')}]`;
	if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === null) {
		const fields = Object.entries(value).map(([name, field]) => `${name}: ${written(field)}`);
		return `{ ${fields.join(', ')} }`;
	}
	return JSON.stringify(value);
}

describe.each(['README.md', 'LANGUAGE.md'])('the formulas in %s', (file) => {
	test.each(blocksOf(file, 'littlewing'))('%s', (block) => {
		const expected = /\/\/ => (.*)\n$/.exec(block)?.[1];
		expect(expected).toBeDefined();
		const result = compile(block, { functions, types });
		if (!result.ok) throw new CompileError(result.diagnostics);
		expect(written(evaluate(result.program, { numbers: 'decimal' }))).toBe(expected as string);
	});
});

interface Checked {
	readonly source: string;
	/** How many claims the block makes, each of which has to run. */
	readonly claims: number;
}

/**
 * Turn a block of TypeScript into a module that checks itself: a statement whose comment
 * gives a value has to come to that value, and a line naming a `Decimal` to its text.
 * Text printed is a claim too, and a comment in a `console.log` is what it prints.
 */
function checked(block: string): Checked {
	// A URL, as a Windows path in an import would have its backslashes read as escapes
	const source = pathToFileURL(join(root, 'packages', 'littlewing', 'src')).href;
	let claims = 0;
	const lines = block
		.replace(/from 'littlewing'/g, `from '${source}/index.ts'`)
		.replace(/from 'littlewing\/(\w+)'/g, `from '${source}/$1.ts'`)
		.split('\n')
		.map((line) => {
			const match = /^(\s*)(.+); \/\/ (.+)$/.exec(line);
			if (match === null) return line;
			const [, indent, statement, comment] = match as unknown as [string, string, string, string];
			claims++;
			const printed = /^(.*)console\.log\((.*)\)$/.exec(statement);
			if (printed !== null) {
				const text = comment.replace(/^'(.*)'$/, '$1');
				return `${indent}${printed[1]}__same(${printed[2]}, ${JSON.stringify(text)});`;
			}
			const decimal = /^Decimal (.*)$/.exec(comment);
			if (decimal !== null) {
				return `${indent}__same(String(${statement}), ${JSON.stringify(decimal[1])});`;
			}
			return `${indent}__same(${statement}, ${comment});`;
		});
	return { source: `const __same = (globalThis as any).__same;\n${lines.join('\n')}\n`, claims };
}

describe('the code in the README', () => {
	test.each(blocksOf('README.md', 'ts'))('%s', async (block) => {
		const seen: unknown[] = [];
		const global = globalThis as { __same?: (actual: unknown, expected: unknown) => void };
		global.__same = (actual, expected) => {
			seen.push(actual);
			expect(actual).toEqual(expected);
		};
		const { source, claims } = checked(block);
		expect(claims).toBeGreaterThan(0);
		const directory = mkdtempSync(join(tmpdir(), 'littlewing-docs-'));
		try {
			const file = join(directory, 'block.ts');
			writeFileSync(file, source);
			await import(file);
			// Every claim ran, so none sat behind a branch that was not taken
			expect(seen.length).toBeGreaterThanOrEqual(claims);
		} finally {
			rmSync(directory, { recursive: true, force: true });
			delete global.__same;
		}
	});

	test('no block goes unchecked by being fenced another way', () => {
		const known = new Set(['littlewing', 'ts', 'bash']);
		for (const file of ['README.md', 'LANGUAGE.md']) {
			const text = readFileSync(join(root, file), 'utf8');
			const opening = text.split('```').filter((_, i) => i % 2 === 1);
			for (const block of opening) {
				expect(known.has(block.slice(0, block.indexOf('\n')))).toBe(true);
			}
		}
	});
});

describe('the examples of the playground', () => {
	const programs = [
		...examples.map((example) => [example.title, example.source] as const),
		['The first program', INITIAL_SOURCE] as const,
	];
	test.each(programs)('%s', (_, source) => {
		const result = compile(source, { functions, types });
		expect(result.diagnostics).toEqual([]);
		expect(run(source)).toBeDefined();
	});
});
