import { describe, expect, test } from 'bun:test';
import { analyze, show } from '../src/evaluation/analyze.ts';
import type { Given, Shown } from '../src/evaluation/protocol.ts';
import { typeText } from '../src/language/types.ts';

function run(source: string, given: Record<string, Given> = {}) {
	return analyze({ id: 1, source, given });
}

/** A shown value as littlewing would write it. */
function text(value: Shown | undefined): string {
	if (value === undefined) return '?';
	switch (value.kind) {
		case 'number':
		case 'date':
		case 'time':
		case 'datetime':
		case 'other':
			return value.text;
		case 'string':
			return JSON.stringify(value.value);
		case 'boolean':
			return String(value.value);
		case 'array':
			return `[${value.items.map(text).join(', ')}]`;
		case 'record':
			return `{ ${value.fields.map(([name, field]) => `${name}: ${text(field)}`).join(', ')} }`;
		case 'elided':
			return '…';
	}
}

describe('analyze', () => {
	test('the result and the value of every binding, in one run', () => {
		const response = run('price ?= 100\nnet = price - 15\ntax = ROUND(net * 0.08)\nnet + tax');
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('92');
		expect(response.scope.map(({ name, value }) => `${name} = ${text(value)}`)).toEqual([
			'price = 100',
			'net = 85',
			'tax = 7',
		]);
		expect(response.scope.map(({ type }) => type && typeText(type))).toEqual([
			'number',
			'number',
			'number',
		]);
	});

	test('a last statement in parentheses, and a name taken by the program', () => {
		const response = run('result = 2\n(result * 3)');
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('6');
		expect(response.scope.map(({ name }) => name)).toEqual(['result']);
	});

	test('inputs, with what was typed for them', () => {
		const response = run('note ?= "x"\nday + LEN(note)', { day: { kind: 'number', text: '0.1' } });
		expect(response.inputs?.map(({ name, required }) => `${name} ${required}`)).toEqual([
			'note false',
			'day true',
		]);
		expect(response.inputs?.[0]?.default).toEqual({ kind: 'string', value: 'x' });
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('1.1');
	});

	test('an expression typed for an input', () => {
		const response = run('SUM(xs)', { xs: { kind: 'expression', source: '[1, 2, 3]' } });
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('6');
	});

	test('a failure where the source has it, not where the scope run had it', () => {
		const source = 'x ?= 0\na = 1 / x\na + 1';
		const response = run(source);
		expect(response.outcome).toMatchObject({ ok: false, code: 'division-by-zero' });
		const problem = response.problems.find(({ code }) => code === 'division-by-zero')!;
		expect(source.slice(problem.from, problem.to)).toBe('1 / x');
	});

	test('a program that ends in a binding does not compile, and keeps its types', () => {
		const response = run('a = 1\nb = a + 1');
		expect(response.inputs).toBeUndefined();
		expect(response.problems.map(({ code }) => code)).toContain('missing-result');
		expect(Object.fromEntries((response.types ?? []).map(([n, t]) => [n, typeText(t)]))).toEqual({
			a: 'number',
			b: 'number',
		});
	});

	test('a broken line leaves the types of the others', () => {
		const response = run('a = "x"\nb = (\n');
		expect(response.types?.map(([name]) => name)).toEqual(['a']);
	});

	test('nothing for an empty source', () => {
		expect(run('  \n').outcome).toBeUndefined();
	});
});

describe('inputs', () => {
	test('what each ran with, defaults that are computed included', () => {
		const response = run('x ?= 5\nb ?= x > 1\nd ?= DATE(2026, 1, 2)\nif b then n else 0');
		const inputs = Object.fromEntries((response.inputs ?? []).map((input) => [input.name, input]));
		expect(text(inputs.b?.current)).toBe('true');
		expect(text(inputs.d?.current)).toBe('2026-01-02');
		expect(text(inputs.n?.current)).toBe('0');
		expect([inputs.b?.defaulted, inputs.n?.defaulted]).toEqual([true, false]);
	});

	test('a value that cannot be read is set aside, and said why', () => {
		const response = run('n + 1', { n: { kind: 'expression', source: '1 +' } });
		expect(response.rejected.map(({ name }) => name)).toEqual(['n']);
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('1');
	});

	test('a value typed for what an input was before is dropped quietly', () => {
		const response = run('x ?= "a"\nx + "b"', { x: { kind: 'number', text: '7' } });
		expect(response.rejected).toEqual([]);
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('"ab"');
	});

	test('an expression of the wrong type is set aside by name', () => {
		const response = run('xs ?= [1]\nr ?= { a: 1 }\nSUM(xs) + r.a', {
			xs: { kind: 'expression', source: '"abc"' },
			r: { kind: 'expression', source: '[1, 2]' },
		});
		expect(response.rejected.map(({ name }) => name)).toEqual(['xs', 'r']);
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('2');
	});

	test('a value outside the class of its input is set aside', () => {
		const response = run('"#{a}"', { a: { kind: 'expression', source: '[1]' } });
		expect(response.rejected.map(({ name, message }) => `${name}: ${message}`)).toEqual([
			'a: Not a value of type T: showable',
		]);
	});

	test('numbers are written as the language writes them', () => {
		const response = run('n * 2', { n: { kind: 'number', text: '1_000' } });
		expect(response.outcome?.ok && text(response.outcome.value)).toBe('2000');
	});
});

describe('phases', () => {
	test('what compiling found comes before the run', () => {
		const phases: string[] = [];
		const done = analyze({ id: 1, source: 'a = 1\nunused = 2\na', given: {} }, (early) => {
			phases.push(`${early.phase} ${early.problems.map(({ code }) => code).join()}`);
		});
		phases.push(done.phase);
		expect(phases).toEqual(['compiled unused-binding', 'done']);
	});

	test('one budget for every value in a response', () => {
		const response = run('xs = for i in 1..=50000 then i\nys = xs\nLEN(xs)');
		const counted = response.scope.reduce(
			(sum, { value }) => sum + (value?.kind === 'array' ? value.items.length : 0),
			0,
		);
		expect(counted).toBeLessThan(10_000);
	});
});

describe('show', () => {
	test('a long string is cut, with how much is left', () => {
		const long = show('x'.repeat(5_000));
		expect(long).toEqual({ kind: 'string', value: 'x'.repeat(2_000), more: 3_000 });
		const emoji = show(`${'x'.repeat(1_999)}😀`);
		expect(emoji.kind === 'string' && emoji.value.length).toBe(1_999);
	});

	test('values the panel can draw', () => {
		const record = Object.assign(Object.create(null), { a: [1, 'x', true] });
		expect(text(show(record))).toBe('{ a: [1, "x", true] }');
		expect(text(show(Temporal.PlainDate.from('2026-11-02')))).toBe('2026-11-02');
	});

	test('a value nested past the limit is cut short', () => {
		let deep: unknown = 1;
		for (let i = 0; i < 100; i++) deep = [deep];
		expect(text(show(deep))).toContain('…');
		const huge = show(Array.from({ length: 50_000 }, () => 1));
		expect(huge.kind === 'array' && [huge.items.length, huge.more]).toEqual([9_999, 40_001]);
	});
});
