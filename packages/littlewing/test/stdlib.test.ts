import { describe, expect, test } from 'bun:test';
import { evaluate } from '../src/interpreter';
import { array, core, defaultContext, string } from '../src/stdlib';
import type { HostFunction, RuntimeValue } from '../src/types';
import { deepEquals } from '../src/utils';
import { createRandom } from './generators';
import { stepsOf } from './helpers';

const run = (source: string, variables: Record<string, RuntimeValue> = {}): RuntimeValue =>
	evaluate(source, { ...defaultContext, variables });

const date = (text: string) => Temporal.PlainDate.from(text);

describe('STR_REPLACE', () => {
	test.each([['[$&]'], ['$$'], ['$`'], ["$'"], ['$1']])('takes %s literally', (replacement) => {
		expect(string.STR_REPLACE('a-b', '-', replacement)).toBe(`a${replacement}b`);
	});

	test('replaces only the first match', () => {
		expect(string.STR_REPLACE('aa', 'a', 'b')).toBe('ba');
	});
});

describe('STR_SPLIT', () => {
	test('an empty separator splits by code point', () => {
		expect(string.STR_SPLIT('a😀b', '')).toEqual(['a', '😀', 'b']);
		expect(run('LEN(STR_SPLIT(s, "")) == LEN(s)', { s: 'a😀b' })).toBe(true);
	});

	test('a separator splits as usual', () => {
		expect(string.STR_SPLIT('a,b', ',')).toEqual(['a', 'b']);
	});
});

describe('NUM', () => {
	test.each([
		['42', 42],
		['-1.5', -1.5],
		['+3', 3],
		['  7  ', 7],
		['1e3', 1000],
		['.5', 0.5],
		['5.', 5],
	])('reads %j', (text, expected) => {
		expect(core.NUM(text)).toBe(expected);
	});

	test.each([
		[''],
		['   '],
		['0x10'],
		['0b11'],
		['Infinity'],
		['-Infinity'],
		['NaN'],
		['1e999'],
		['1 2'],
		['abc'],
	])('rejects %j', (text) => {
		expect(() => core.NUM(text)).toThrow(`cannot convert string "${text}"`);
	});

	test('rejects a malformed long string in linear time', () => {
		const start = performance.now();
		expect(() => core.NUM(`${'1'.repeat(2_000_000)}x`)).toThrow('cannot convert');
		expect(performance.now() - start).toBeLessThan(500);
	});

	test('rejects arrays and dates', () => {
		expect(() => core.NUM([1])).toThrow('cannot convert array to number');
		expect(() => core.NUM(date('2024-01-01'))).toThrow('cannot convert date to number');
	});

	test('reads booleans and numbers', () => {
		expect(core.NUM(true)).toBe(1);
		expect(core.NUM(false)).toBe(0);
		expect(core.NUM(5)).toBe(5);
	});
});

describe('STR', () => {
	test('converts every scalar type', () => {
		expect(core.STR('a')).toBe('a');
		expect(core.STR(1.5)).toBe('1.5');
		expect(core.STR(true)).toBe('true');
		expect(core.STR(date('2024-01-02'))).toBe('2024-01-02');
	});

	test('rejects arrays', () => {
		expect(() => core.STR([1])).toThrow('cannot convert array to string');
	});
});

describe('Code points', () => {
	test('LEN counts them', () => {
		expect(core.LEN('a😀b')).toBe(3);
		expect(core.LEN('abc')).toBe(3);
		expect(core.LEN('')).toBe(0);
	});

	test('SLICE cuts between them', () => {
		expect(core.SLICE('a😀b', 1, 2)).toBe('😀');
		expect(core.SLICE('a😀b', 1)).toBe('😀b');
		expect(core.SLICE('a😀b', -1)).toBe('b');
		expect(core.SLICE('abc', 1, 2)).toBe('b');
		expect(core.SLICE('abc', 1)).toBe('bc');
	});

	test('SLICE works on arrays', () => {
		expect(core.SLICE([1, 2, 3], 1)).toEqual([2, 3]);
		expect(core.SLICE([1, 2, 3], 0, -1)).toEqual([1, 2]);
	});

	test('SLICE takes integers only', () => {
		expect(() => core.SLICE('abc', 0.5)).toThrow('expected integer');
		expect(() => core.SLICE('abc', 0, 1.5)).toThrow('expected integer');
		expect(() => core.SLICE('abc', Number.NaN)).toThrow('expected integer');
	});

	test('INDEX_OF counts them', () => {
		expect(core.INDEX_OF('😀a', 'a')).toBe(1);
		expect(core.INDEX_OF('😀😀a', 'a')).toBe(2);
		expect(core.INDEX_OF('a😀', '😀')).toBe(1);
		expect(core.INDEX_OF('abc', 'z')).toBe(-1);
		expect(core.INDEX_OF('abc', '')).toBe(0);
		expect(core.INDEX_OF('😀', '')).toBe(0);
	});

	test('half a character never matches', () => {
		const emoji = '😀';
		const [high, low] = [emoji.charAt(0), emoji.charAt(1)];
		expect(core.INDEX_OF(emoji, high)).toBe(-1);
		expect(core.INDEX_OF(emoji, low)).toBe(-1);
		expect(core.CONTAINS(emoji, high)).toBe(false);
		expect(core.CONTAINS(emoji, low)).toBe(false);
		expect(core.INDEX_OF(`${emoji}${low}`, low)).toBe(1);
		expect(core.INDEX_OF(`${high}${emoji}`, high)).toBe(0);
	});

	test('CONTAINS finds substrings and elements', () => {
		expect(core.CONTAINS('a😀b', '😀b')).toBe(true);
		expect(core.CONTAINS('abc', '')).toBe(true);
		expect(core.CONTAINS([[1], [2]], [2])).toBe(true);
		expect(core.CONTAINS([1], 2)).toBe(false);
		expect(core.INDEX_OF([[1], [2]], [2])).toBe(1);
	});

	test('REVERSE keeps them whole', () => {
		expect(core.REVERSE('a😀b')).toBe('b😀a');
		const input = [1, 2];
		expect(core.REVERSE(input)).toEqual([2, 1]);
		expect(input).toEqual([1, 2]);
	});
});

describe('Substring search', () => {
	const naive = (value: string, search: string): number => {
		const points = Array.from(value);
		const needle = Array.from(search);
		for (let i = 0; i <= points.length - needle.length; i++) {
			if (needle.every((point, j) => points[i + j] === point)) return i;
		}
		return -1;
	};

	test('agrees with a plain search, for short and long patterns alike', () => {
		const random = createRandom(21);
		const pieces = ['a', 'b', 'ab', '😀', '\ud83d', '\ude00'];
		const text = (length: number): string => {
			let out = '';
			for (let i = 0; i < length; i++) out += pieces[Math.floor(random() * pieces.length)];
			return out;
		};
		for (let i = 0; i < 20_000; i++) {
			const value = text(1 + Math.floor(random() * 60));
			const start = Math.floor(random() * 30);
			const search =
				random() < 0.5 ? value.slice(start, start + 1 + Math.floor(random() * 90)) : text(70);
			const expected = naive(value, search);
			expect(core.INDEX_OF(value, search)).toBe(expected);
			expect(core.CONTAINS(value, search)).toBe(expected !== -1);
		}
	});

	test('agrees with a plain search on periodic text, where matches overlap', () => {
		const random = createRandom(22);
		const pieces = ['😀', '\ude00', '\ud83d', 'a', 'b'];
		const pick = (): string => pieces[Math.floor(random() * pieces.length)] as string;
		for (let i = 0; i < 20_000; i++) {
			let unit = '';
			for (let j = 1 + Math.floor(random() * 3); j > 0; j--) unit += pick();
			const value = pick() + unit.repeat(10 + Math.floor(random() * 40));
			const start = Math.floor(random() * 6);
			const search = value.slice(start, start + 66 + Math.floor(random() * 40));
			expect(core.INDEX_OF(value, search)).toBe(naive(value, search));
		}
	});

	test('half a character never matches in a long pattern', () => {
		const emoji = '😀'.repeat(100);
		const search = emoji.slice(1, 141);
		expect(core.INDEX_OF(emoji, search)).toBe(-1);
		expect(core.CONTAINS(emoji, search)).toBe(false);
		expect(core.INDEX_OF(`${emoji}\ude00${emoji.slice(0, 139)}`, search)).toBe(100);
	});

	test('half a character never matches with a lone surrogate in front', () => {
		const emoji = '😀'.repeat(50);
		const search = `\ude00${emoji.slice(0, 20)}`;
		expect(core.INDEX_OF(emoji, search)).toBe(-1);
		expect(string.STR_SPLIT(emoji, search)).toEqual([emoji]);
		expect(string.STR_REPLACE(emoji, search, 'x')).toBe(emoji);
	});

	test('a pattern of repeats falls back correctly', () => {
		const long = 'ab'.repeat(40);
		expect(core.INDEX_OF(`x${'ab'.repeat(39)}a${long}`, long)).toBe(80);
		expect(core.INDEX_OF(`${'a'.repeat(100)}b`, `${'a'.repeat(70)}b`)).toBe(30);
	});

	test('a worst-case pattern stays linear', () => {
		const a = 'a'.repeat(100_000);
		const start = performance.now();
		const value = a + a + a + a;
		const search = `${a}b${a}`;
		expect(core.CONTAINS(value, search)).toBe(false);
		expect(core.INDEX_OF(value, search)).toBe(-1);
		expect(string.STR_REPLACE(value, search, 'x')).toBe(value);
		expect(string.STR_SPLIT(value, search)).toEqual([value]);
		expect(performance.now() - start).toBeLessThan(1000);
	});

	test('repeated long separators split in linear time', () => {
		const sep = `${'a'.repeat(99)}b`;
		const parts = string.STR_SPLIT(`x${sep}y${sep}z`.repeat(2), sep);
		expect(parts).toEqual(['x', 'y', 'zx', 'y', 'z']);
	});

	test('STR_SPLIT handles edges', () => {
		expect(string.STR_SPLIT('', ',')).toEqual(['']);
		expect(string.STR_SPLIT(',', ',')).toEqual(['', '']);
		expect(string.STR_SPLIT('a,,b', ',')).toEqual(['a', '', 'b']);
		expect(string.STR_SPLIT('', '')).toEqual([]);
	});

	test('STR_REPLACE handles edges', () => {
		expect(string.STR_REPLACE('abc', 'z', 'y')).toBe('abc');
		expect(string.STR_REPLACE('abc', '', 'y')).toBe('yabc');
		expect(string.STR_REPLACE('😀', '\ude00', 'y')).toBe('😀');
	});
});

describe('ARR_SORT', () => {
	test('sorts every ordered type', () => {
		expect(array.ARR_SORT([3, 1, 2])).toEqual([1, 2, 3]);
		expect(array.ARR_SORT(['b', 'a'])).toEqual(['a', 'b']);
		const [a, b] = [date('2024-01-01'), date('2024-02-01')];
		expect(array.ARR_SORT([b, a])).toEqual([a, b]);
	});

	test('puts NaN last, consistently', () => {
		expect(array.ARR_SORT([Number.NaN, 2, 1])).toEqual([1, 2, Number.NaN]);
		expect(array.ARR_SORT([2, Number.NaN, 1, Number.NaN, 0])).toEqual([
			0,
			1,
			2,
			Number.NaN,
			Number.NaN,
		]);
	});

	test('sorts infinities', () => {
		const inf = Number.POSITIVE_INFINITY;
		expect(array.ARR_SORT([inf, 1, inf, -inf])).toEqual([-inf, 1, inf, inf]);
	});

	test('leaves its input alone', () => {
		const input = [2, 1];
		array.ARR_SORT(input);
		expect(input).toEqual([2, 1]);
	});

	test('rejects unordered types whatever the length', () => {
		expect(() => array.ARR_SORT([true, false])).toThrow('cannot compare boolean');
		expect(() => array.ARR_SORT([true])).toThrow('cannot compare boolean');
		expect(() => array.ARR_SORT([[1]])).toThrow('cannot compare array');
		expect(array.ARR_SORT([])).toEqual([]);
	});
});

describe('ARR_MIN and ARR_MAX', () => {
	test('find extremes of every ordered type', () => {
		expect(array.ARR_MIN([2, 1, 3])).toBe(1);
		expect(array.ARR_MAX([2, 1, 3])).toBe(3);
		expect(array.ARR_MIN(['b', 'a'])).toBe('a');
		expect(array.ARR_MAX(['b', 'a'])).toBe('b');
	});

	test('NaN wins wherever it is, like Math.min and Math.max', () => {
		for (const input of [
			[Number.NaN, 1, 2],
			[1, Number.NaN, 0],
			[1, 0, Number.NaN],
		]) {
			expect(array.ARR_MIN(input)).toBeNaN();
			expect(array.ARR_MAX(input)).toBeNaN();
		}
	});

	test('reject empty arrays and unordered types', () => {
		expect(() => array.ARR_MIN([])).toThrow('ARR_MIN: array is empty');
		expect(() => array.ARR_MAX([])).toThrow('ARR_MAX: array is empty');
		expect(() => array.ARR_MIN([true])).toThrow('cannot compare boolean');
		expect(() => array.ARR_MAX([[1]])).toThrow('cannot compare array');
	});
});

describe('ARR_UNIQUE', () => {
	test('removes duplicates and keeps the first', () => {
		expect(array.ARR_UNIQUE([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
		expect(array.ARR_UNIQUE(['a', 'b', 'a'])).toEqual(['a', 'b']);
		expect(array.ARR_UNIQUE([true, false, true])).toEqual([true, false]);
	});

	test('uses deep equality', () => {
		expect(
			array.ARR_UNIQUE([
				[1, 2],
				[1, 2],
				[2, 1],
			]),
		).toEqual([
			[1, 2],
			[2, 1],
		]);
		expect(array.ARR_UNIQUE([[[1]], [[1]]])).toEqual([[[1]]]);
		const a = date('2024-01-01');
		expect(array.ARR_UNIQUE([a, date('2024-01-01'), date('2024-01-02')])).toHaveLength(2);
	});

	test('agrees with == on every edge', () => {
		expect(array.ARR_UNIQUE([0, -0])).toEqual([0]);
		expect(array.ARR_UNIQUE([Number.NaN, Number.NaN])).toHaveLength(2);
		expect(array.ARR_UNIQUE([[Number.NaN], [Number.NaN]])).toHaveLength(2);
	});

	test('separates values that would print alike', () => {
		expect(array.ARR_UNIQUE([['a,b'], ['a', 'b']])).toHaveLength(2);
		expect(array.ARR_UNIQUE([['a"'], ['a\\"']])).toHaveLength(2);
		expect(array.ARR_UNIQUE([[[1], [2]], [[1, 2]]])).toHaveLength(2);
		expect(array.ARR_UNIQUE([[[]], [[], []]])).toHaveLength(2);
		const text = Temporal.PlainDateTime.from('2024-01-01T00:00:00');
		expect(array.ARR_UNIQUE([[text], [text.toPlainDate()]])).toHaveLength(2);
	});

	test('keeps first occurrences in their original order, with NaN in place', () => {
		const nan = Number.NaN;
		expect(array.ARR_UNIQUE([3, nan, 1, 3, nan, 2, 1])).toEqual([3, nan, 1, nan, 2]);
		expect(array.ARR_UNIQUE([[2], [1], [2]])).toEqual([[2], [1]]);
		expect(array.ARR_UNIQUE([])).toEqual([]);
		expect(array.ARR_UNIQUE([1])).toEqual([1]);
	});

	test('agrees with a quadratic scan on random arrays', () => {
		const random = createRandom(23);
		const pools: RuntimeValue[][] = [
			[0, -0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY],
			['', 'a', 'b', 'ab', '😀'],
			[true, false],
			[[], [1], [1, 2], [Number.NaN]],
		];
		for (let i = 0; i < 5_000; i++) {
			const pool = pools[Math.floor(random() * pools.length)] as RuntimeValue[];
			const input = Array.from(
				{ length: Math.floor(random() * 12) },
				() => pool[Math.floor(random() * pool.length)] as RuntimeValue,
			);
			const expected: RuntimeValue[] = [];
			for (const element of input) {
				if (!expected.some((kept) => deepEquals(kept, element))) expected.push(element);
			}
			expect(array.ARR_UNIQUE(input)).toEqual(expected);
		}
	});

	test('does not depend on hashing long strings', () => {
		const stem = 'a'.repeat(20_000);
		const input = Array.from({ length: 3000 }, (_, i) => `${stem}${10_000 + i}`);
		const start = performance.now();
		expect(array.ARR_UNIQUE(input)).toHaveLength(3000);
		expect(performance.now() - start).toBeLessThan(1000);
	});

	test('handles large arrays', () => {
		const input = Array.from({ length: 300_000 }, (_, i) => i * 7);
		const start = performance.now();
		expect(array.ARR_UNIQUE(input)).toHaveLength(300_000);
		expect(performance.now() - start).toBeLessThan(2000);
	});
});

describe('ARR_FLAT and ARR_JOIN', () => {
	test('ARR_FLAT flattens one level', () => {
		expect(array.ARR_FLAT([[1], [2, 3], []])).toEqual([1, 2, 3]);
		expect(array.ARR_FLAT([[[1]], [[2]]])).toEqual([[1], [2]]);
	});

	test('ARR_FLAT rejects what would not be homogeneous', () => {
		expect(() => array.ARR_FLAT([[1], ['a']])).toThrow('Heterogeneous');
		expect(() => array.ARR_FLAT([1])).toThrow('expected array element');
	});

	test('ARR_JOIN joins strings only', () => {
		expect(array.ARR_JOIN(['a', 'b'], '-')).toBe('a-b');
		expect(() => array.ARR_JOIN([1], '-')).toThrow('expected string element');
	});
});

describe('Calendars', () => {
	const chinese = date('2024-01-01').withCalendar('chinese');
	const datetime = Temporal.PlainDateTime.from('2024-01-01T00:00:00').withCalendar('hebrew');

	test('variables must use the ISO calendar', () => {
		expect(() => run('1', { c: chinese })).toThrow('expected an ISO date, got calendar chinese');
		expect(() => run('1', { c: datetime })).toThrow('expected an ISO date, got calendar hebrew');
		expect(() => run('1', { c: [chinese] })).toThrow('expected an ISO date');
	});

	test('host functions must return the ISO calendar', () => {
		const functions: Record<string, HostFunction> = { F: () => chinese };
		expect(() => evaluate('F()', { functions })).toThrow('expected an ISO date');
	});

	test('ISO dates pass', () => {
		expect(run('YEAR(d)', { d: date('2024-01-01') })).toBe(2024);
	});
});

describe('Other Temporal implementations', () => {
	test('are named in the error', () => {
		const foreign = { [Symbol.toStringTag]: 'Temporal.PlainDate' };
		expect(() => run('1', { d: foreign as unknown as RuntimeValue })).toThrow(
			'Temporal.PlainDate is not from the global Temporal',
		);
	});

	test('do not explain the Temporal classes that are simply not values', () => {
		const instant = Temporal.Now.instant();
		expect(() => run('1', { i: instant as unknown as RuntimeValue })).toThrow(
			'expected a language value, got object',
		);
	});
});

describe('Missing arguments', () => {
	test.each([
		['STR()', 'STR requires an argument'],
		['TYPE()', 'TYPE requires an argument'],
		['CONTAINS([1])', 'CONTAINS requires an argument'],
		['INDEX_OF([1])', 'INDEX_OF requires an argument'],
		['CONTAINS("a")', 'CONTAINS requires an argument'],
	])('%s is an error', (source, message) => {
		expect(() => run(source)).toThrow(message);
	});
});

describe('Date and time arithmetic', () => {
	test.each([
		['ADD_DAYS(DATE(2024, 1, 1), 1.5)', 'ADD_DAYS (days) expected integer'],
		['ADD_MONTHS(DATE(2024, 1, 1), 0.5)', 'ADD_MONTHS (months) expected integer'],
		['ADD_YEARS(DATE(2024, 1, 1), 0.5)', 'ADD_YEARS (years) expected integer'],
		['ADD_HOURS(TIME(1, 0, 0), 0.5)', 'ADD_HOURS (hours) expected integer'],
		['ADD_MINUTES(TIME(1, 0, 0), 0.5)', 'ADD_MINUTES (minutes) expected integer'],
		['ADD_SECONDS(TIME(1, 0, 0), 0.5)', 'ADD_SECONDS (seconds) expected integer'],
	])('%s reports a clear error', (source, message) => {
		expect(() => run(source)).toThrow(message);
	});

	test.each([
		['DIFFERENCE_IN_DAYS', '2024-01-01', '2024-03-01', 60],
		['DIFFERENCE_IN_WEEKS', '2024-01-01', '2024-01-16', 2],
		['DIFFERENCE_IN_MONTHS', '2024-01-01', '2026-03-01', 26],
		['DIFFERENCE_IN_YEARS', '2024-01-01', '2026-03-01', 2],
	])('%s of dates and datetimes, in either order', (name, a, b, expected) => {
		const variables = {
			a: date(a),
			b: date(b),
			c: Temporal.PlainDateTime.from(`${a}T12:00:00`),
			d: Temporal.PlainDateTime.from(`${b}T12:00:00`),
		};
		expect(run(`${name}(a, b)`, variables)).toBe(expected);
		expect(run(`${name}(b, a)`, variables)).toBe(expected);
		expect(run(`${name}(c, d)`, variables)).toBe(expected);
		expect(run(`${name}(d, c)`, variables)).toBe(expected);
		expect(() => run(`${name}(a, d)`, variables)).toThrow('requires same type');
	});

	test.each([
		['DIFFERENCE_IN_HOURS', 3],
		['DIFFERENCE_IN_MINUTES', 3 * 60 + 15],
		['DIFFERENCE_IN_SECONDS', (3 * 60 + 15) * 60],
	])('%s of times and datetimes, in either order', (name, expected) => {
		const variables = {
			a: Temporal.PlainTime.from('10:00:00'),
			b: Temporal.PlainTime.from('13:15:00'),
			c: Temporal.PlainDateTime.from('2024-01-01T10:00:00'),
			d: Temporal.PlainDateTime.from('2024-01-01T13:15:00'),
		};
		expect(run(`${name}(a, b)`, variables)).toBe(expected);
		expect(run(`${name}(b, a)`, variables)).toBe(expected);
		expect(run(`${name}(c, d)`, variables)).toBe(expected);
		expect(() => run(`${name}(a, d)`, variables)).toThrow('requires same type');
	});
});

describe('Metering', () => {
	const cost = (source: string, base: string, variables: Record<string, RuntimeValue> = {}) =>
		stepsOf(source, { ...defaultContext, variables }) -
		stepsOf(base, { ...defaultContext, variables });
	const big = Array.from({ length: 1000 }, (_, i) => i);
	const text = 'x'.repeat(1000);

	test('LEN of an array is free, however large', () => {
		expect(cost('LEN(xs)', 'ABS(1)', { xs: big })).toBe(0);
		const context = {
			...defaultContext,
			variables: { xs: Array.from({ length: 50_000 }, () => 1) },
			limits: { maxSteps: 2_000_000 },
		};
		expect(evaluate('for i in 0..1000 into t = 0 then t + LEN(xs)', context)).toBe(50_000_000);
	});

	test('LEN of a string costs its length', () => {
		expect(cost('LEN(s)', 'ABS(1)', { s: text })).toBe(1000);
	});

	test.each([
		['CONTAINS(xs, -1)'],
		['INDEX_OF(xs, -1)'],
		['ARR_SUM(xs)'],
		['ARR_SORT(xs)'],
		['REVERSE(xs)'],
		['ARR_MIN(xs)'],
		['ARR_MAX(xs)'],
		['ARR_UNIQUE(xs)'],
	])('%s costs at least its input', (call) => {
		expect(cost(`x = ${call}\n1`, 'x = ABS(1)\n1', { xs: big })).toBeGreaterThanOrEqual(999);
	});

	test.each([
		['STR_UPPER(s)'],
		['STR_LOWER(s)'],
		['STR_TRIM(s)'],
		['STR_STARTS_WITH(s, "y")'],
		['STR_ENDS_WITH(s, "y")'],
		['STR_REPLACE(s, "y", "z")'],
		['CONTAINS(s, "y")'],
		['INDEX_OF(s, "y")'],
		['STR(s)'],
	])('%s costs at least its input', (call) => {
		expect(cost(`x = ${call}\n1`, 'x = ABS(1)\n1', { s: text })).toBeGreaterThanOrEqual(999);
	});

	test('NUM costs its input', () => {
		expect(cost('NUM(s)', 'ABS(1)', { s: '0'.repeat(1000) })).toBe(1000);
	});

	const callCost = (call: string, variables: Record<string, RuntimeValue> = {}) =>
		cost(`x = ${call}\n1`, 'x = ABS(1)\n1', variables);

	test('ARR_JOIN pays for every character before joining, then for the result', () => {
		const strings = Array.from({ length: 100 }, () => text);
		// the extra argument, reading xs and the separator, the charge up front, the result
		expect(callCost('ARR_JOIN(xs, ",")', { xs: strings })).toBe(
			1 + 100 + 1 + 100 * 1001 + (100 * 1000 + 99),
		);
	});

	test('STR_REPEAT pays before repeating, then for the result', () => {
		expect(callCost('STR_REPEAT("ab", 1000)')).toBe(1 + 2 + 2000 + 2000);
	});

	test('ARR_FLAT pays before flattening, then for the result', () => {
		const nested = Array.from({ length: 10 }, () => big);
		expect(callCost('ARR_FLAT(xs)', { xs: nested })).toBe(10 + 10_000 + 10_000);
	});

	test('ARR_UNIQUE pays for the keys of nested arrays', () => {
		const pairs = {
			xs: [
				[1, 2],
				[3, 4],
			],
		};
		// reading xs, sorting 2, a key of 2 * 2 + 1 for each, two comparisons, the result
		expect(callCost('ARR_UNIQUE(xs)', pairs)).toBe(2 + 2 * 2 + 2 * 5 + 2 + 2);
	});

	test('ARR_UNIQUE pays to read strings', () => {
		const strings = { xs: ['x'.repeat(16), 'y'.repeat(16)] };
		// reading xs, sorting 2, two comparisons of 32 characters, the result
		expect(callCost('ARR_UNIQUE(xs)', strings)).toBe(2 + 2 * 2 + 2 * 4 + 2);
		const nested = { xs: [['x'.repeat(16)]] };
		expect(callCost('ARR_UNIQUE(xs)', nested)).toBe(1 + 1 + 3 + 2 + 1);
	});

	test('ARR_UNIQUE pays for nested dates', () => {
		expect(callCost('ARR_UNIQUE(xs)', { xs: [[date('2024-01-01')]] })).toBe(1 + 1 + 3 + 64 + 1);
	});

	test('STR and REVERSE pay to read as well as for their result', () => {
		expect(callCost('STR(s)', { s: text })).toBe(2000);
		expect(callCost('REVERSE(s)', { s: text })).toBe(2000);
		expect(callCost('REVERSE(xs)', { xs: big })).toBe(2000);
	});

	test.each([
		['TO_DATE(dt)', 64 + 64],
		['TO_TIME(dt)', 64 + 64],
		['HOUR(t)', 64],
		['HOUR(dt)', 64],
		['YEAR(d)', 64],
		['YEAR(dt)', 64],
	])('%s pays for each date or time', (call, expected) => {
		const variables = {
			d: date('2024-01-01'),
			t: Temporal.PlainTime.from('10:00:00'),
			dt: Temporal.PlainDateTime.from('2024-01-01T10:00:00'),
		};
		expect(callCost(call, variables)).toBe(expected);
	});

	test('COMBINE pays for both arguments and its result', () => {
		const variables = { d: date('2024-01-01'), t: Temporal.PlainTime.from('10:00:00') };
		expect(cost('x = COMBINE(d, t)\n1', 'x = MIN(1, 1)\n1', variables)).toBe(3 * 64);
	});

	test.each([
		['DIFFERENCE_IN_DAYS(a, a)'],
		['DIFFERENCE_IN_YEARS(a, a)'],
		['DIFFERENCE_IN_SECONDS(b, b)'],
		['DIFFERENCE_IN_HOURS(b, b)'],
		['AGE(a, a)'],
	])('%s pays for a duration', (call) => {
		const variables = { a: date('2024-01-01'), b: Temporal.PlainTime.from('10:00:00') };
		expect(cost(call, 'MIN(1, 1)', variables)).toBe(2 * 64 + 1024);
	});

	test('ARR_UNIQUE stops on aliased arrays', () => {
		const source = 'a = for i in 0..30 into a = [1] then [a, a]\nARR_UNIQUE(a)';
		expect(() => evaluate(source, { ...defaultContext, limits: { maxSteps: 100_000 } })).toThrow(
			'step limit',
		);
	});

	test('sorting strings pays to compare them', () => {
		const strings = Array.from({ length: 50 }, () => text);
		expect(cost('x = ARR_SORT(xs)\n1', 'x = REVERSE(xs)\n1', { xs: strings })).toBeGreaterThan(
			5000,
		);
	});

	test('sorting pays n log n, on top of reading and returning', () => {
		expect(callCost('ARR_SORT(xs)', { xs: big })).toBe(1000 + 1000 * 10 + 1000);
	});

	test('STR_SPLIT pays for every part', () => {
		expect(cost('x = STR_SPLIT(s, "")\n1', 'x = STR_UPPER(s)\n1', { s: text })).toBe(1001);
	});

	test('a date argument is charged by the function reading it', () => {
		const variables = { d: date('2024-01-01') };
		expect(cost('YEAR(d)', 'ABS(1)', variables)).toBe(64);
		expect(cost('x = ADD_DAYS(d, 1)\n1', 'x = MIN(1, 1)\n1', variables)).toBe(128);
		expect(cost('IS_SAME_DAY(d, d)', 'MIN(1, 1)', variables)).toBe(128);
	});

	test('reading the clock costs what it takes', () => {
		for (const source of ['TODAY()', 'NOW()', 'NOW_TIME()']) {
			expect(stepsOf(`x = ${source}\n1`, defaultContext)).toBeGreaterThan(2000);
		}
		expect(cost('AGE(d)', 'AGE(d, d)', { d: date('2020-01-01') })).toBeGreaterThan(1900);
	});

	test('a host function is charged for what it might read, a stdlib one is not', () => {
		const LEN2: HostFunction = (x) => (x as RuntimeValue[]).length;
		const variables = { xs: big };
		const host = stepsOf('LEN2(xs)', { functions: { LEN2 }, variables });
		const stdlib = stepsOf('LEN(xs)', { ...defaultContext, variables });
		expect(host - stdlib).toBe(1001);
	});

	test('namespace exports are charged like host functions, unlike the default table', () => {
		const variables = { xs: big };
		const namespaced = { functions: { LEN: core.LEN }, variables };
		expect(stepsOf('LEN(xs)', namespaced)).toBeGreaterThan(1000);
		expect(stepsOf('LEN(xs)', { ...defaultContext, variables })).toBe(2);
	});

	test('a stdlib function copied into a context stays trusted', () => {
		const functions = { ...defaultContext.functions };
		expect(stepsOf('LEN(xs)', { functions, variables: { xs: big } })).toBe(2);
	});

	test('a host function that wraps a stdlib one is not', () => {
		const functions: Record<string, HostFunction> = { LEN: (x) => core.LEN(x) };
		expect(stepsOf('LEN(xs)', { functions, variables: { xs: big } })).toBeGreaterThan(1000);
	});

	test('a host function is checked, a stdlib one needs no checking', () => {
		const functions = { ...defaultContext.functions, BAD: (() => null) as unknown as HostFunction };
		expect(() => evaluate('BAD()', { functions })).toThrow('Function BAD');
	});
});
