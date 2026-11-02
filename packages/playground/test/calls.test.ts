import { describe, expect, test } from 'bun:test';
import { callAt } from '../src/language/calls.ts';
import { closest } from '../src/language/catalog.ts';
import { lex } from '../src/language/tokens.ts';

/** The call at the `‸` in `marked`, as `NAME argument`. */
function at(marked: string): string | undefined {
	const position = marked.indexOf('‸');
	const source = marked.slice(0, position) + marked.slice(position + 1);
	const call = callAt(lex(source), position, (from, to) => source.slice(from, to));
	return call && `${call.name} ${call.argument}`;
}

describe('callAt', () => {
	test('the argument the cursor is in', () => {
		expect(at('ROUND(‸')).toBe('ROUND 0');
		expect(at('ROUND(x, ‸')).toBe('ROUND 1');
		expect(at('ROUND(x, 2‸)')).toBe('ROUND 1');
		expect(at('ROUND(x, 2)‸')).toBeUndefined();
		expect(at('ROUND‸(x)')).toBeUndefined();
	});

	test('nesting counts in its own brackets', () => {
		expect(at('MAX(a, [1, 2, ‸')).toBe('MAX 1');
		expect(at('MAX(a, ABS(b, ‸), c')).toBe('ABS 1');
		expect(at('MAX(a, ABS(b), ‸')).toBe('MAX 2');
		expect(at('MAX(a, { x: 1, y: ‸')).toBe('MAX 1');
		expect(at('(a, ‸')).toBeUndefined();
	});

	test('strings and comments are not code', () => {
		expect(at('LEN("(,", ‸')).toBe('LEN 1');
		expect(at('LEN(a, // ),(\n‸')).toBe('LEN 1');
		expect(at('LEN("#{ MAX(a, ‸')).toBe('MAX 1');
		expect(at('LEN("#{ a }, #{ b ‸')).toBe('LEN 0');
		expect(at('LEN("x‸")')).toBe('LEN 0');
	});

	test('a name and `(` on separate lines are no call', () => {
		expect(at('x = F\n(1, ‸')).toBeUndefined();
		expect(at('F(a,\n‸')).toBe('F 1');
		// Enclosed code goes on across lines, as the parser reads it
		expect(at('y = MAX(\n  ABS\n  (1, ‸), 2)')).toBe('ABS 1');
		expect(at('y = if c then ABS\n(‸1) else 2')).toBe('ABS 0');
		expect(at('y = for x in xs then F\n(‸')).toBeUndefined();
		expect(at('y = "#{F\n(‸')).toBe('F 0');
	});

	test('across lines and pipes', () => {
		expect(at('xs\n  |> ROUND(?,\n  ‸')).toBe('ROUND 1');
	});
});

describe('closest', () => {
	test('slips, closest first', () => {
		const names = ['ROUND', 'FLOOR', 'LEN', 'LOWER'];
		expect(closest('round', names)).toEqual(['ROUND']);
		expect(closest('LOWR', names)).toEqual(['LOWER', 'FLOOR']);
		expect(closest('ROUDN', names)).toEqual(['ROUND']);
		expect(closest('X', names)).toEqual([]);
	});
});
