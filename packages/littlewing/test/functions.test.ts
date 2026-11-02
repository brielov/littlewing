import { describe, expect, test } from 'bun:test';
import type { CompileOptions } from '../src/compile.js';
import { compile, evaluate, run } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import type { FunctionDefinition, Type } from '../src/define.js';
import { define, defineType, describeFunction, t } from '../src/define.js';
import { CompileError, EvaluationError } from '../src/errors.js';
import * as clock from '../src/clock.js';
import { coreFunctions } from '../src/functions/core.js';
import { findSubstring, splitOn } from '../src/functions/search.js';
import * as std from '../src/std.js';
import { temporalFunctions } from '../src/temporal.js';

const STEPS_TABLE: Record<string, number> = {
	'UPPER(s)': 6002,
	'LOWER(s)': 6002,
	'TRIM(s)': 6002,
	'LEN(s)': 378,
	'SLICE(s, 1)': 6378,
	'CONTAINS(s, ",")': 379,
	'INDEX_OF(s, "z")': 379,
	'SPLIT(s, ",")': 5383,
	'SPLIT(s, "")': 12383,
	'REPLACE(s, ",", ";;")': 10379,
	'REPEAT(s, 2)': 12003,
	'REVERSE(s)': 6377,
	'STARTS_WITH(s + s, "a")': 3756,
	'ENDS_WITH(s + s, ",")': 3756,
	'STR(s)': 3002,
	'LEN(a)': 3,
	'SLICE(a, 1)': 4004,
	'CONTAINS(a, 0)': 1004,
	'SORT(a)': 14007,
	'SORT_BY(a, a)': 14008,
	'MIN(a)': 1002,
	'MAX(a)': 1002,
	'SUM(a)': 1003,
	'REVERSE(a)': 4007,
	'UNIQUE(a)': 14007,
	'UNIQUE(n)': 4013,
	'FLAT(n)': 8009,
	'JOIN(w, ",")': 10782,
	'JOIN(w, ",,,,")': 16779,
	'SORT(w)': 17796,
	'UNIQUE(w)': 18606,
	'NUM(x)': 3,
	'FLOOR(x)': 11,
	'CEIL(x)': 11,
	'ROUND(x, 1)': 12,
	'FIXED(x, 2)': 24,
	'ABS(x)': 3,
	'CLAMP(x, 1, 2)': 5,
	'SQRT(x)': 11,
	'SIN(x)': 11,
	'COS(x)': 11,
	'TAN(x)': 11,
	'EXP(x)': 11,
	'LOG(x)': 11,
	'LOG10(x)': 11,
	'NUM(s)': 33,
};

function codeOf(body: () => unknown): string {
	try {
		body();
	} catch (error) {
		if (error instanceof EvaluationError) return error.code;
		if (error instanceof CompileError) return `compile:${error.diagnostics[0]?.code}`;
		return `other:${String(error)}`;
	}
	return 'no failure';
}

/** Run with a value the optimizer cannot see, so a function really runs. */
function live(source: string, variables: Record<string, unknown>, options: CompileOptions = {}) {
	return run(source, { ...options, variables });
}

function stepsOf(source: string, variables: Record<string, unknown>, options: CompileOptions = {}) {
	const result = compile(source, options);
	if (!result.ok) throw new CompileError(result.diagnostics);
	const { program } = result;
	let low = 0;
	let high = 1 << 26;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (
			codeOf(() => evaluate(program, { variables, limits: { maxSteps: middle } })) === 'no failure'
		) {
			high = middle;
		} else low = middle + 1;
	}
	return low;
}

describe('STR and NUM', () => {
	test('STR', () => {
		expect(run('STR(1.50)')).toBe('1.5');
		expect(run('STR(1e34)')).toBe('1e34');
		expect(run('STR(true)')).toBe('true');
		expect(run('STR("x")')).toBe('x');
	});

	test('NUM', () => {
		expect(run('NUM(5)')).toBe(5);
		expect(run('NUM(true)')).toBe(1);
		expect(run('NUM(false)')).toBe(0);
		expect(run('NUM("  -1.5e2\\n")')).toBe(-150);
		expect(run('NUM("+.5")')).toBe(0.5);
		expect(run('NUM("5.")')).toBe(5);
		expect(run('NUM("\\u{a0}7\\u{85}")')).toBe(7);
		for (const text of ['', ' ', '.', '1_000', 'abc', '0x10', '1e', 'Infinity', 'NaN', '1e7000']) {
			expect(codeOf(() => live('NUM(x)', { x: text }, { inputs: { x: t.string() } }))).toBe(
				'invalid-argument',
			);
		}
		const digits = '1'.repeat(35);
		expect(codeOf(() => live('NUM(x)', { x: digits }, { inputs: { x: t.string() } }))).toBe(
			'invalid-argument',
		);
	});
});

describe('strings and arrays', () => {
	test('LEN counts code points or elements', () => {
		expect(run('LEN("a😀é")')).toBe(3);
		expect(run('LEN("")')).toBe(0);
		expect(run('LEN([1, 2])')).toBe(2);
		expect(live('LEN(x)', { x: 'a😀' })).toBe(2);
		expect(live('LEN(x)', { x: [1, 2, 3] })).toBe(3);
	});

	test('SLICE', () => {
		expect(run('SLICE("a😀cd", 1, 3)')).toBe('😀c');
		expect(run('SLICE("abcd", 1)')).toBe('bcd');
		expect(run('SLICE("abcd", -2)')).toBe('cd');
		expect(run('SLICE("abcd", 0, -1)')).toBe('abc');
		expect(run('SLICE("abcd", -100, 100)')).toBe('abcd');
		expect(run('SLICE("abcd", 3, 1)')).toBe('');
		expect(run('SLICE("abcd", 1e30)')).toBe('');
		expect(run('SLICE("abcd", -1e30)')).toBe('abcd');
		expect(run('SLICE([1, 2, 3], 1)')).toEqual([2, 3]);
		expect(run('SLICE([1, 2, 3], 1, 2)')).toEqual([2]);
		expect(run('SLICE([1, 2, 3], 2, 1)')).toEqual([]);
		expect(codeOf(() => run('SLICE("ab", 0.5)'))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('SLICE("ab", 0, 1.5)'))).toBe('compile:invalid-argument');
	});

	test('CONTAINS and INDEX_OF', () => {
		expect(run('CONTAINS("hello", "ell")')).toBe(true);
		expect(run('CONTAINS("hello", "z")')).toBe(false);
		expect(run('CONTAINS("hello", "")')).toBe(true);
		expect(run('CONTAINS("", "")')).toBe(true);
		expect(run('CONTAINS([1, 2], 2)')).toBe(true);
		expect(run('CONTAINS([[1], [2]], [2])')).toBe(true);
		expect(run('CONTAINS([{ a: 1 }], { a: 2 })')).toBe(false);
		expect(run('INDEX_OF("a😀b", "b")')).toBe(2);
		expect(run('INDEX_OF("hello", "")')).toBe(0);
		expect(run('INDEX_OF("hello", "z")')).toBe(-1);
		expect(run('INDEX_OF([1, 2], 2)')).toBe(1);
		expect(run('INDEX_OF([1, 2], 3)')).toBe(-1);
	});

	test('a long search takes linear time and finds the same', () => {
		const pattern = 'ab'.repeat(100);
		const text = `${'a'.repeat(1000)}${pattern}`;
		const inputs = { s: t.string(), p: t.string() };
		expect(live('INDEX_OF(s, p)', { s: text, p: pattern }, { inputs })).toBe(1000);
		expect(
			live('INDEX_OF(s, p)', { s: 'a'.repeat(50_000), p: `${'a'.repeat(100)}b` }, { inputs }),
		).toBe(-1);
		expect(
			live('INDEX_OF(s, p)', { s: 'abcabcabd', p: 'abcabd'.padEnd(70, 'x') }, { inputs }),
		).toBe(-1);
	});
});

describe('strings', () => {
	test('case', () => {
		expect(run('UPPER("straße")')).toBe('STRASSE');
		expect(run('LOWER("ΑΣ")')).toBe('ας');
		expect(run('LOWER("I")')).toBe('i');
	});

	test('TRIM takes White_Space, and no more', () => {
		expect(run('TRIM("  x\\n")')).toBe('x');
		expect(run('TRIM("\\u{85}x\\u{a0}")')).toBe('x');
		expect(run('TRIM("\\u{feff}x")')).toBe('\ufeffx');
	});

	test('SPLIT', () => {
		expect(run('SPLIT("a,b,,c", ",")')).toEqual(['a', 'b', '', 'c']);
		expect(run('SPLIT("", ",")')).toEqual(['']);
		expect(run('SPLIT("", "")')).toEqual([]);
		expect(run('SPLIT("a😀", "")')).toEqual(['a', '😀']);
		expect(run('SPLIT("abc", "")')).toEqual(['a', 'b', 'c']);
		expect(run('SPLIT("aaa", "aa")')).toEqual(['', 'a']);
	});

	test('REPLACE', () => {
		expect(run('REPLACE("a-b-c", "-", "+")')).toBe('a+b+c');
		expect(run('REPLACE("aaa", "aa", "b")')).toBe('ba');
		expect(run('REPLACE("a", "a", "$&")')).toBe('$&');
		expect(run('REPLACE("a", "z", "b")')).toBe('a');
		expect(codeOf(() => run('REPLACE("a", "", "b")'))).toBe('compile:invalid-argument');
	});
});

describe('arrays', () => {
	test('SORT is ascending', () => {
		expect(run('SORT([3, 1, 2])')).toEqual([1, 2, 3]);
		expect(run('SORT(["b", "a"])')).toEqual(['a', 'b']);
		expect(run('SORT([1e20, 0.5, 3])')).toEqual([0.5, 3, 1e20]);
		expect(run('SORT(["\\u{10000}", "\\u{ffff}"])')).toEqual(['\uffff', '\u{10000}']);
	});

	test('SORT_BY is stable, and checks lengths first', () => {
		expect(run('SORT_BY(["a", "b", "c"], [2, 1, 2])')).toEqual(['b', 'a', 'c']);
		expect(
			run(
				'items = [{ p: 2 }, { p: 1 }]\nfor i in SORT_BY(items, for i in items then i.p) then i.p',
			),
		).toEqual([1, 2]);
		expect(codeOf(() => run('SORT_BY([1], [1, 2])'))).toBe('compile:invalid-argument');
	});

	test('JOIN', () => {
		expect(run('JOIN(["a", "b"], ", ")')).toBe('a, b');
		expect(run('JOIN([], ",")')).toBe('');
	});
});

describe('numbers', () => {
	test('FLOOR and CEIL', () => {
		expect(run('FLOOR(1.5)')).toBe(1);
		expect(run('FLOOR(-1.5)')).toBe(-2);
		expect(run('CEIL(1.5)')).toBe(2);
		expect(run('CEIL(-1.5)')).toBe(-1);
		expect(run('FLOOR(3)')).toBe(3);
		expect(Object.is(run('CEIL(-0.5)'), 0)).toBe(true);
	});

	test('ROUND and its modes', () => {
		expect(run('ROUND(1.005, 2)')).toBe(1.01);
		expect(run('ROUND(1234, -2)')).toBe(1200);
		const rows: [string, number, number][] = [
			['half_away', 3, -3],
			['half_even', 2, -2],
			['floor', 2, -3],
			['ceil', 3, -2],
			['trunc', 2, -2],
		];
		for (const [mode, up, down] of rows) {
			expect(run(`ROUND(2.5, 0, "${mode}")`)).toBe(up);
			expect(run(`ROUND(-2.5, 0, "${mode}")`)).toBe(down);
		}
		expect(run('ROUND(2.5)')).toBe(3);
		expect(run('ROUND(-2.5)')).toBe(-3);
		expect(codeOf(() => run('ROUND(1, 0.5)'))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('ROUND(1, 0, "up")'))).toBe('compile:type-mismatch');
		const inputs = { m: t.string() };
		expect(codeOf(() => live('ROUND(1, 0, m)', { m: 'up' }, { inputs }))).toBe('invalid-argument');
		expect(codeOf(() => run('ROUND(9.6e6144, -6145)'))).toBe('compile:overflow');
	});

	test('FIXED', () => {
		expect(run('FIXED(1.1, 2)')).toBe('1.10');
		expect(run('FIXED(-2.5, 0)')).toBe('-3');
		expect(run('FIXED(-2.5, 0, "trunc")')).toBe('-2');
		expect(run('FIXED(1e3, 1)')).toBe('1000.0');
		expect(codeOf(() => run('FIXED(1, -1)'))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('FIXED(1, 0.5)'))).toBe('compile:invalid-argument');
	});
});

describe('as functions of a program', () => {
	const near = defineType<number>({
		name: 'near',
		is: (value) => typeof value === 'number',
		equals: (a, b) => Math.abs(a - b) < 1,
		compare: (a, b) => b - a,
		show: (a) => `~${a}`,
	});

	test('pipes work', () => {
		expect(run('"a,b" |> SPLIT(?, ",") |> JOIN(?, "-")')).toBe('a-b');
		expect(run('"  x " |> TRIM')).toBe('x');
	});

	test('a host definition replaces a core function, but not in interpolation', () => {
		const STR = define({ args: [t.number()], returns: t.string(), run: () => 'mine' });
		const functions = { STR };
		expect(run('STR(1)', { functions })).toBe('mine');
		expect(run('"#{1}"', { functions })).toBe('1');
	});

	test('types are inferred from them', () => {
		const input = (source: string): unknown => {
			const result = compile(source);
			return result.ok ? result.program.inputs.x?.type : result.diagnostics[0]?.code;
		};
		expect(input('UPPER(x)')).toEqual({ kind: 'string' });
		expect(input('ROUND(x)')).toEqual({ kind: 'number' });
		expect(input('SORT(x)')).toMatchObject({ kind: 'array', element: { kind: 'number' } });
		expect(input('JOIN(x, ",")')).toMatchObject({ kind: 'array', element: { kind: 'string' } });
		expect(input('LEN(x) + 1')).toMatchObject({ kind: 'generic', classes: ['sized'] });
		expect(input('CONTAINS(x, "a")')).toEqual({ kind: 'string' });
		expect(codeOfCompile('UPPER(1)')).toBe('type-mismatch');
		expect(codeOfCompile('LEN(1)')).toBe('type-mismatch');
		expect(codeOfCompile('LEN()')).toBe('wrong-argument-count');
	});

	function codeOfCompile(source: string): string | undefined {
		return compile(source).diagnostics[0]?.code;
	}

	test('they reach the hooks of an abstract type', () => {
		const inputs = { a: t.array(near), x: near };
		const variables = { a: [1, 3, 2], x: 2.5 };
		expect(run('SORT(a)', { inputs, variables })).toEqual([3, 2, 1]);
		expect(run('CONTAINS(a, x)', { inputs, variables })).toBe(true);
		expect(run('INDEX_OF(a, x)', { inputs, variables })).toBe(1);
		expect(run('STR(x)', { inputs, variables })).toBe('~2.5');
		expect(run('MIN(a)', { inputs, variables, functions: std })).toBe(3);
		expect(run('MAX(a)', { inputs, variables, functions: std })).toBe(1);
		expect(run('UNIQUE(a)', { inputs, variables: { a: [1, 1.5, 3] }, functions: std })).toEqual([
			1, 3,
		]);
	});

	test('they fold unless a hook is in reach', () => {
		let calls = 0;
		const counted = defineType<number>({
			name: 'counted',
			is: (value) => typeof value === 'number',
			compare: (a, b) => {
				calls++;
				return a - b;
			},
		});
		const M = define({ args: [], returns: t.array(counted), pure: true, run: () => [2, 1] });
		const hooked = compile('SORT(M())', { functions: { M } });
		expect(hooked.ok).toBe(true);
		expect(calls).toBe(0);
		const plain = compile('x = SORT([2, 1])\nx[0]');
		expect(plain.ok).toBe(true);
		if (plain.ok) expect(evaluate(plain.program, { limits: { maxSteps: 3 } })).toBe(1);
	});

	test('a constant failure is found', () => {
		expect(compile('NUM("x")').diagnostics[0]?.code).toBe('invalid-argument');
		expect(compile('if c then NUM("x") else 1').diagnostics[0]?.code).toBe('may-fail');
	});

	test('nothing a function returns shares with what it was given', () => {
		const list = [3, 1];
		const result = live('SORT(a)', { a: list }) as number[];
		result.push(9);
		expect(list).toEqual([3, 1]);
		expect(live('x = SORT(a)\nx + SORT(a)', { a: list })).toEqual([1, 3, 1, 3]);
	});
});

describe('budgets', () => {
	const strings = { inputs: { s: t.string() } };

	test('each function pays for its input', () => {
		const long = 'ab,'.repeat(10_000);
		const variables = { s: long };
		const atLeast = (source: string, steps: number): void => {
			expect(stepsOf(source, variables, strings)).toBeGreaterThanOrEqual(steps);
		};
		atLeast('UPPER(s)', 30_000);
		atLeast('LOWER(s)', 30_000);
		atLeast('SPLIT(s, ",")', 10_000);
		atLeast('SPLIT(s, "")', 30_000);
		atLeast('REPLACE(s, ",", ";;")', 40_000);
		atLeast('x = SPLIT(s, ",")\nJOIN(x, ",")', 40_000);
		atLeast('SLICE(s, 1)', 29_000);
		atLeast('TRIM(s)', 3000);
		atLeast('LEN(s)', 3000);
		atLeast('CONTAINS(s, "z")', 3000);
		atLeast('NUM(s) == 0 || true', 0);
	});

	test('a sort pays for its comparisons', () => {
		const a = Array.from({ length: 1024 }, (_, i) => 1024 - i);
		const inputs = { a: t.array(t.number()) };
		expect(stepsOf('SORT(a)', { a }, { inputs })).toBeGreaterThanOrEqual(10_240);
		expect(stepsOf('SORT_BY(a, a)', { a }, { inputs })).toBeGreaterThanOrEqual(10_240);
		const sum = { inputs, functions: std };
		expect(stepsOf('SUM(a)', { a }, sum)).toBeGreaterThanOrEqual(1024);
		expect(stepsOf('UNIQUE(a)', { a }, sum)).toBeGreaterThanOrEqual(10_240);
		expect(stepsOf('FLAT([a, a])', { a }, sum)).toBeGreaterThanOrEqual(2048);
		expect(stepsOf('REVERSE(a)', { a }, sum)).toBeGreaterThanOrEqual(2048);
	});

	test('work that would build something huge stops first', () => {
		const limits = { maxSteps: 10_000 };
		const options = { functions: std, limits, inputs: { n: t.number(), s: t.string() } };
		const variables = { n: 1e15, s: 'x' };
		const p = (source: string) => {
			const result = compile(source, options);
			if (!result.ok) throw new CompileError(result.diagnostics);
			return result.program;
		};
		expect(codeOf(() => evaluate(p('REPEAT(s, n)'), { variables, limits }))).toBe('limit-exceeded');
		expect(codeOf(() => evaluate(p('FIXED(1, n)'), { variables, limits }))).toBe('limit-exceeded');
		const text = 'a'.repeat(1000);
		const replaced = p(
			'x = REPEAT(s, 2000)\nREPLACE(x, "x", s + s + s + s + s + s + s + s + s + s)',
		);
		expect(codeOf(() => evaluate(replaced, { variables: { ...variables, s: text }, limits }))).toBe(
			'limit-exceeded',
		);
	});
});

describe('describing functions', () => {
	const all = { ...coreFunctions, ...std, ...temporalFunctions, ...clock };

	test('every function has a doc and named parameters', () => {
		for (const [name, definition] of Object.entries(all)) {
			const description = describeFunction(definition);
			expect(`${name}: ${description.doc}`).toMatch(/^[A-Z_0-9]+: [A-Za-z]/);
			for (const overload of description.overloads) {
				for (const arg of overload.args) expect(`${name} ${arg.name}`).not.toMatch(/arg\d/);
			}
		}
	});

	test('types read as they are written', () => {
		expect(describeFunction(coreFunctions.ROUND)).toEqual({
			doc: 'Rounded to a number of places',
			overloads: [
				{
					args: [
						{ name: 'value', type: 'number', optional: false },
						{ name: 'digits', type: 'number', optional: true },
						{
							name: 'mode',
							type: '"half_away" | "half_even" | "floor" | "ceil" | "trunc"',
							optional: true,
						},
					],
					returns: 'number',
				},
			],
		});
		const { overloads } = describeFunction(coreFunctions.CONTAINS);
		expect(overloads.length).toBe(2);
		expect(overloads[1]?.args[0]?.type).toBe('array<equatable>');
		expect(describeFunction(std.SUM).overloads[0]?.args[0]?.type).toBe('array<number>');
		expect(describeFunction(temporalFunctions.YEAR as FunctionDefinition).overloads[1]).toEqual({
			args: [{ name: 'value', type: 'datetime', optional: false }],
			returns: 'number',
		});

		const money = defineType<object>({ name: 'money', is: () => false });
		const F = define({
			doc: 'A description',
			args: [
				t.record({ a: t.number(), b: t.optional(t.string()) }),
				t.openRecord({ c: money }),
				t.uniformRecord(t.boolean()),
				t.var('T'),
			],
			returns: t.array(t.var('T')),
			run: () => [],
		});
		const description = describeFunction(F);
		expect(description.doc).toBe('A description');
		expect(description.overloads[0]?.args.map((arg) => arg.type)).toEqual([
			'{ a: number, b?: string }',
			'{ c: money, ... }',
			'{ [key]: boolean }',
			'T',
		]);
		expect(description.overloads[0]?.args[0]?.name).toBe('arg1');
		expect(description.overloads[0]?.returns).toBe('array<T>');
	});

	test('an empty record reads as one', () => {
		const F = define({ args: [t.record({})], returns: t.number(), run: () => 1 });
		expect(describeFunction(F).overloads[0]?.args[0]?.type).toBe('{}');
	});

	test('a type past the size limit is a mistake in the host', () => {
		const doubled = (levels: number): Type => {
			let type: Type = t.number();
			for (let i = 0; i < levels; i++) type = t.record({ a: type, b: type }) as Type;
			return type;
		};
		const define_ = (type: Type) => define({ args: [type], returns: t.number(), run: () => 1 });
		// Each level doubles what is under it, so 15 levels write out to 65,535
		expect(() => define_(doubled(15))).not.toThrow();
		expect(() => define_(doubled(16))).toThrow(TypeError);
		expect(() => define({ args: [], returns: doubled(64), run: () => 1 })).toThrow(TypeError);
		expect(() => compile('1', { inputs: { a: doubled(64) } })).toThrow(TypeError);
	});

	test('only a definition can be described', () => {
		expect(() => describeFunction({} as never)).toThrow(TypeError);
	});
});

describe('nothing is mutated', () => {
	test('a function leaves its arguments as they were', () => {
		const a = [3, 1, 2];
		const inputs = { a: t.array(t.number()) };
		const source = 's = SORT(a)\nb = SORT_BY(a, a)\nr = REVERSE(a)\nu = UNIQUE(a)\n[s, b, r, u, a]';
		expect(live(source, { a }, { inputs, functions: std })).toEqual([
			[1, 2, 3],
			[1, 2, 3],
			[2, 1, 3],
			[3, 1, 2],
			[3, 1, 2],
		]);
	});
});

describe('the first and the last', () => {
	const inputs = { a: t.array(t.number()), x: t.number() };

	test('a search finds the first element and the last', () => {
		const variables = { a: [5, 6, 7] };
		expect(live('INDEX_OF(a, x)', { ...variables, x: 5 }, { inputs })).toBe(0);
		expect(live('INDEX_OF(a, x)', { ...variables, x: 7 }, { inputs })).toBe(2);
		expect(live('CONTAINS(a, x)', { ...variables, x: 5 }, { inputs })).toBe(true);
		expect(live('CONTAINS(a, x)', { ...variables, x: 8 }, { inputs })).toBe(false);
	});

	test('CLAMP on a single point', () => {
		const clamp = { inputs: { x: t.number() }, functions: std };
		expect(live('CLAMP(x, 2, 2)', { x: 5 }, clamp)).toBe(2);
		expect(live('CLAMP(x, 2, 2)', { x: 1 }, clamp)).toBe(2);
		expect(live('CLAMP(x, 2, 2)', { x: 2 }, clamp)).toBe(2);
	});
});

describe('integers past any double', () => {
	test('positions clamp', () => {
		expect(run('SLICE("abc", 1e400)')).toBe('');
		expect(run('SLICE("abc", 0, 1e400)')).toBe('abc');
		expect(run('SLICE("abc", -1e400)')).toBe('abc');
		expect(run('SLICE([1, 2], 0, -1e400)')).toEqual([]);
	});

	test('digits have their meaning', () => {
		expect(run('ROUND(1.5, 1e400)')).toBe(1.5);
		expect(run('ROUND(1.5, -1e400)')).toBe(0);
		expect(codeOf(() => run('ROUND(1.5, -1e400, "ceil")'))).toBe('compile:overflow');
		expect(codeOf(() => run('FIXED(1.5, -1e400)'))).toBe('compile:invalid-argument');
	});

	test('counts stay counts', () => {
		const functions = std;
		expect(codeOf(() => run('REPEAT("a", -1e400)', { functions }))).toBe(
			'compile:invalid-argument',
		);
		expect(run('REPEAT("", 1e400)', { functions })).toBe('');
		expect(codeOf(() => run('REPEAT("a", 1e400)', { functions }))).toBe('limit-exceeded');
	});

	test('text too long to make is a limit, not a constant failure', () => {
		expect(compile('FIXED(1, 1000000000)').ok).toBe(true);
		expect(codeOf(() => run('FIXED(1, 1000000000)'))).toBe('limit-exceeded');
		expect(codeOf(() => run('FIXED(1, 1e400)'))).toBe('limit-exceeded');
	});
});

describe('searches past the engine', () => {
	test('the long search agrees with the engine', () => {
		// Partial matches everywhere, so that a search has to fall back and carry on
		let state = 12_345;
		const next = (limit: number): number => {
			state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
			return (state >>> 8) % limit;
		};
		for (let round = 0; round < 40_000; round++) {
			const unit = Array.from({ length: 1 + next(5) }, () => 'ab'[next(2)]).join('');
			const pattern = (unit.repeat(40) + 'ab'[next(2)]).slice(0, 65 + next(10));
			let text = '';
			while (text.length < 300) {
				if (next(3) === 0) text += pattern.slice(0, next(pattern.length));
				else text += next(2) === 0 ? pattern : 'ab'[next(2)];
			}
			expect(findSubstring(text, pattern)).toBe(text.indexOf(pattern));
			expect(splitOn(text, pattern)).toEqual(text.split(pattern));
		}
	});
});

describe('what folds', () => {
	test.each([
		['NUM(STR(true) + "x")', 'invalid-argument'],
		['NUM(CONTAINS("a", "a")) / 0 == 1', 'division-by-zero'],
		['NUM(CONTAINS("a", "z")) / 0 == 1', 'division-by-zero'],
		['INDEX_OF("abc", "b") / 0 == 1', 'division-by-zero'],
		['INDEX_OF([1, 2], 2) / 0 == 1', 'division-by-zero'],
		['LEN(UNIQUE([1, 1])) / 0 == 1', 'division-by-zero'],
		['LEN(SORT([2, 1])) / 0 == 1', 'division-by-zero'],
		['LEN(SORT_BY([1], [1])) / 0 == 1', 'division-by-zero'],
		['MIN([1]) / 0 == 1', 'division-by-zero'],
	])('%s fails to compile', (source, code) => {
		expect(compile(source, { functions: std }).diagnostics[0]?.code).toBe(code);
	});
});

describe('what stays out of folding', () => {
	/** Compile with a hook that counts, and report how often it ran. */
	function hooksDuringCompile(source: string): number {
		let calls = 0;
		const counted = <T>(value: T): T => {
			calls++;
			return value;
		};
		class Tag {
			constructor(readonly value: number) {}
		}
		const tag = defineType<Tag>({
			name: 'tag',
			is: (value) => value instanceof Tag,
			equals: (a, b) => counted(a.value === b.value),
			compare: (a, b) => counted(a.value - b.value),
			show: (a) => counted(`${a.value}`),
		});
		const one = define({ args: [], returns: tag, pure: true, run: () => new Tag(1) });
		const all = define({
			args: [],
			returns: t.array(tag),
			pure: true,
			run: () => [new Tag(1), new Tag(2)],
		});
		const nested = define({
			args: [],
			returns: t.array(t.record({ a: tag })),
			pure: true,
			run: () => [{ a: new Tag(1) }, { a: new Tag(2) }],
		});
		const result = compile(source, { functions: { ...std, ONE: one, ALL: all, NESTED: nested } });
		expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
		return calls;
	}

	test.each([
		'STR(ONE())',
		'"#{ONE()}"',
		'CONTAINS(ALL(), ONE())',
		'INDEX_OF(ALL(), ONE())',
		'SORT(ALL())',
		'SORT_BY([1, 2], ALL())',
		'MIN(ALL())',
		'MAX(ALL())',
		'UNIQUE(ALL())',
		'UNIQUE(NESTED())',
		'CONTAINS(NESTED(), NESTED()[0])',
		'ALL() == ALL()',
	])('%s runs no hook', (source) => {
		expect(hooksDuringCompile(source)).toBe(0);
	});

	test('SORT_BY orders by the hook of its keys', () => {
		const backwards = defineType<number>({
			name: 'backwards',
			is: (value) => typeof value === 'number',
			compare: (a, b) => b - a,
		});
		const inputs = { keys: t.array(backwards) };
		const variables = { keys: [1, 2] };
		expect(run('SORT_BY(["low", "high"], keys)', { inputs, variables })).toEqual(['high', 'low']);
	});

	test('SORT_BY folds if only its items are abstract', () => {
		const tag = defineType<object>({ name: 'tag', is: (value) => typeof value === 'object' });
		const M = define({ args: [], returns: t.array(tag), pure: true, run: () => [] });
		expect(compile('SORT_BY(M(), [1])', { functions: { M } }).diagnostics[0]?.code).toBe(
			'invalid-argument',
		);
	});
});

describe('every function has a price', () => {
	const string = { inputs: { s: t.string() }, functions: std };
	const list = { inputs: { a: t.array(t.number()) }, functions: std };
	const words = { inputs: { w: t.array(t.string()) }, functions: std };
	const nested = { inputs: { n: t.array(t.array(t.number())) }, functions: std };
	const number = { inputs: { x: t.number() }, functions: std };
	const onString = { s: 'ab,'.repeat(1000) };
	const onList = { a: Array.from({ length: 1000 }, (_, i) => 1000 - i) };
	const onWords = { w: Array.from({ length: 1000 }, (_, i) => `w${i}`) };
	const onNested = { n: [onList.a, onList.a] };
	const onNumber = { x: 2.5 };

	test('in steps, exactly', () => {
		// Each number was read off once and checked by hand, so a change here is a change of price
		const table: Record<string, number> = {};
		const measure = (
			source: string,
			options: CompileOptions,
			variables: Record<string, unknown>,
		) => {
			table[source] = stepsOf(source, variables, options);
		};
		for (const source of [
			'UPPER(s)',
			'LOWER(s)',
			'TRIM(s)',
			'LEN(s)',
			'NUM(s) == 0',
			'SLICE(s, 1)',
			'CONTAINS(s, ",")',
			'INDEX_OF(s, "z")',
			'SPLIT(s, ",")',
			'SPLIT(s, "")',
			'REPLACE(s, ",", ";;")',
			'REPEAT(s, 2)',
			'REVERSE(s)',
			'STARTS_WITH(s + s, "a")',
			'ENDS_WITH(s + s, ",")',
			'STR(s)',
		]) {
			if (!source.startsWith('NUM')) measure(source, string, onString);
		}
		for (const source of [
			'LEN(a)',
			'SLICE(a, 1)',
			'CONTAINS(a, 0)',
			'SORT(a)',
			'SORT_BY(a, a)',
			'MIN(a)',
			'MAX(a)',
			'SUM(a)',
			'REVERSE(a)',
			'UNIQUE(a)',
		]) {
			measure(source, list, onList);
		}
		measure('UNIQUE(n)', nested, onNested);
		measure('FLAT(n)', nested, onNested);
		measure('JOIN(w, ",")', words, onWords);
		measure('JOIN(w, ",,,,")', words, onWords);
		measure('SORT(w)', words, onWords);
		measure('UNIQUE(w)', words, onWords);
		for (const source of [
			'NUM(x)',
			'FLOOR(x)',
			'CEIL(x)',
			'ROUND(x, 1)',
			'FIXED(x, 2)',
			'ABS(x)',
			'CLAMP(x, 1, 2)',
			'SQRT(x)',
			'SIN(x)',
			'COS(x)',
			'TAN(x)',
			'EXP(x)',
			'LOG(x)',
			'LOG10(x)',
		]) {
			measure(source, number, onNumber);
		}
		measure('NUM(s)', string, { s: '1'.repeat(30) });
		expect(table).toEqual(STEPS_TABLE);
	});

	test('reading a rope costs what flattening it does, on any engine', () => {
		const long = 'a'.repeat(100_000);
		const variables = { s: long };
		expect(stepsOf('STARTS_WITH(s + "b", "a")', variables, string)).toBeGreaterThan(12_000);
		expect(stepsOf('ENDS_WITH(s + "b", "b")', variables, string)).toBeGreaterThan(12_000);
	});
});

describe('logarithms and roots of any number', () => {
	const functions = std;

	test('past the range of a double', () => {
		expect(run('LOG(1e-400)', { functions })).toBeCloseTo(-921.0340371976183, 9);
		expect(run('LOG(1e400)', { functions })).toBeCloseTo(921.0340371976183, 9);
		expect(run('LOG10(1e-400)', { functions })).toBe(-400);
		expect(run('LOG10(1e400)', { functions })).toBe(400);
		expect(run('SQRT(1e-400)', { functions })).toBe(1e-200);
		expect((run('SQRT(1e400)', { functions, numbers: 'decimal' }) as Decimal).toString()).toBe(
			'1e200',
		);
		expect((run('SQRT(1e401)', { functions, numbers: 'decimal' }) as Decimal).toString()).toContain(
			'e200',
		);
		expect(run('SQRT(0)', { functions })).toBe(0);
		expect(run('SQRT(2.25)', { functions })).toBe(1.5);
	});

	test('LOG and LOG10 are not each other', () => {
		expect(run('LOG(2)', { functions })).toBeCloseTo(Math.LN2, 12);
		expect(run('LOG10(2)', { functions })).toBeCloseTo(Math.LOG10E * Math.LN2, 12);
		expect(run('LOG(2e40)', { functions })).toBeCloseTo(Math.log(2e40), 9);
		expect(run('LOG10(2e40)', { functions })).toBeCloseTo(Math.log10(2e40), 9);
	});

	test('EXP stays where the language has numbers', () => {
		expect(run('EXP(-1e400)', { functions })).toBe(0);
		expect(run('EXP(-30000)', { functions })).toBe(0);
		expect(run('EXP(1)', { functions })).toBe(Math.E);
		expect(run('EXP(709)', { functions })).toBe(Math.exp(709));
		const above = run('EXP(710)', { functions, numbers: 'decimal' }) as Decimal;
		expect(above.toString().startsWith('2.2339947661')).toBe(true);
		expect(above.toString()).toContain('e308');
		// Below the normal doubles, a double would keep too few digits
		const edge = run('EXP(-709)', { functions, numbers: 'decimal' }) as Decimal;
		expect(edge.toString().startsWith('1.2167807506234230655')).toBe(true);
		const small = run('EXP(-1000)', { functions, numbers: 'decimal' }) as Decimal;
		expect(small.toString().startsWith('5.07')).toBe(true);
		expect(small.toString()).toContain('e-435');
		const tiny = run('EXP(-14000)', { functions, numbers: 'decimal' }) as Decimal;
		expect(tiny.compare(0)).toBe(1);
		const back = run('EXP(LOG(1e-400))', { functions, numbers: 'decimal' }) as Decimal;
		expect(back.minus('1e-400').compare('1e-412')).toBeLessThan(1);
		expect(back.minus('1e-400').compare('-1e-412')).toBeGreaterThan(-1);
		const large = run('EXP(1000)', { functions, numbers: 'decimal' }) as Decimal;
		expect(large.toString().startsWith('1.97')).toBe(true);
		expect(codeOf(() => run('EXP(1e400)', { functions }))).toBe('compile:overflow');
	});
});

describe('littlewing/std', () => {
	const functions = std;

	test('numbers', () => {
		expect(run('ABS(-1.5)', { functions })).toBe(1.5);
		expect(run('ABS(2)', { functions })).toBe(2);
		expect(Object.is(run('ABS(0)', { functions }), 0)).toBe(true);
		expect(run('CLAMP(5, 1, 3)', { functions })).toBe(3);
		expect(run('CLAMP(0, 1, 3)', { functions })).toBe(1);
		expect(run('CLAMP(2, 1, 3)', { functions })).toBe(2);
		expect(codeOf(() => run('CLAMP(1, 3, 1)', { functions }))).toBe('compile:invalid-argument');
	});

	test('through doubles', () => {
		expect(run('SQRT(4)', { functions })).toBe(2);
		expect(run('SQRT(2)', { functions })).toBe(Math.SQRT2);
		expect(run('COS(0)', { functions })).toBe(1);
		expect(run('SIN(0)', { functions })).toBe(0);
		expect(run('TAN(0)', { functions })).toBe(0);
		expect(run('EXP(0)', { functions })).toBe(1);
		expect(run('LOG(1)', { functions })).toBe(0);
		expect(run('LOG10(1000)', { functions })).toBe(3);
		expect(codeOf(() => run('SQRT(-1)', { functions }))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('LOG(0)', { functions }))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('LOG10(-1)', { functions }))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('EXP(1000)', { functions }))).toBe('overflow');
		expect(codeOf(() => run('SIN(1e400)', { functions }))).toBe('compile:overflow');
	});

	test('MIN, MAX and SUM', () => {
		expect(run('MIN([3, 1, 2])', { functions })).toBe(1);
		expect(run('MAX([3, 1, 2])', { functions })).toBe(3);
		expect(run('MIN(["b", "a"])', { functions })).toBe('a');
		expect(codeOf(() => run('MIN([])', { functions }))).toBe('compile:invalid-argument');
		expect(codeOf(() => live('MAX(a)', { a: [] }, { functions }))).toBe('invalid-argument');
		expect(run('SUM([0.1, 0.2])', { functions })).toBe(0.3);
		expect(run('SUM([])', { functions })).toBe(0);
		expect(run('SUM([1.5, 1e20])', { functions, numbers: 'decimal' })).toEqual(
			Decimal.from('100000000000000000001.5'),
		);
	});

	test('strings', () => {
		expect(run('STARTS_WITH("hello", "he")', { functions })).toBe(true);
		expect(run('ENDS_WITH("hello", "lo")', { functions })).toBe(true);
		expect(run('STARTS_WITH("hello", "lo")', { functions })).toBe(false);
		expect(run('STARTS_WITH("x", "")', { functions })).toBe(true);
		expect(run('REPEAT("ab", 2)', { functions })).toBe('abab');
		expect(run('REPEAT("ab", 0)', { functions })).toBe('');
		expect(run('REPEAT("", 1e30)', { functions })).toBe('');
		expect(codeOf(() => run('REPEAT("a", -1)', { functions }))).toBe('compile:invalid-argument');
		expect(codeOf(() => run('REPEAT("a", 0.5)', { functions }))).toBe('compile:invalid-argument');
	});

	test('REVERSE, FLAT and UNIQUE', () => {
		expect(run('REVERSE("a😀b")', { functions })).toBe('b😀a');
		expect(run('REVERSE("abc")', { functions })).toBe('cba');
		expect(run('REVERSE([1, 2])', { functions })).toEqual([2, 1]);
		expect(run('FLAT([[1], [], [2, 3]])', { functions })).toEqual([1, 2, 3]);
		expect(run('UNIQUE([2, 1, 2, 1, 3])', { functions })).toEqual([2, 1, 3]);
		expect(run('UNIQUE(["b", "a", "b"])', { functions })).toEqual(['b', 'a']);
		expect(run('UNIQUE([1, 1.0, 1e0])', { functions })).toEqual([1]);
		expect(run('UNIQUE([[1], [1], [2]])', { functions })).toEqual([[1], [2]]);
		expect(run('UNIQUE([{ a: 1 }, { a: 1 }])', { functions })).toHaveLength(1);
	});

	test('picking one is enough, and without it there is none', () => {
		expect(run('ABS(-1)', { functions: { ABS: std.ABS } })).toBe(1);
		expect(codeOf(() => run('ABS(-1)'))).toBe('compile:unknown-function');
		expect(run('ABS(x)', { functions: { ABS: std.ABS }, variables: { x: -2 } })).toBe(2);
	});

	test('a library function cannot be called as a host function', () => {
		expect(() => std.ABS.run()).toThrow(TypeError);
	});
});
