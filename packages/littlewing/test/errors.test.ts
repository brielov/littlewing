import { describe, expect, test } from 'bun:test';
import { toLineColumn } from '../src/errors';
import { parse } from '../src/syntax/parser';

/** The first problem `parse` finds in `source`. */
function first(source: string) {
	const [diagnostic] = parse(source).diagnostics;
	if (diagnostic === undefined) throw new Error(`no problem in ${source}`);
	return diagnostic;
}

describe('parse diagnostics', () => {
	test('unexpected character after an operator has correct span', () => {
		expect(first('1 + @')).toMatchObject({ code: 'invalid-character', start: 4, end: 5 });
	});

	test('missing closing parenthesis is reported at the end', () => {
		expect(first('(1 + 2')).toMatchObject({ code: 'unexpected-token', start: 6 });
	});

	test("missing 'then' in if expression has correct span", () => {
		expect(first('if true 2')).toMatchObject({ code: 'unexpected-token', start: 8, end: 9 });
	});

	test("missing 'else' in if expression", () => {
		expect(first('if true then 1').code).toBe('unexpected-token');
	});

	test('unterminated string is reported from its start', () => {
		expect(first('"hello')).toMatchObject({ message: 'Unterminated string', start: 0 });
	});

	test('unexpected character has correct span', () => {
		expect(first('&')).toMatchObject({ message: "Unexpected character '&'", start: 0, end: 1 });
	});

	test('invalid assignment target', () => {
		expect(first('5 = 10').code).toBe('unexpected-token');
	});

	test('a source that is not a string is a mistake of the host', () => {
		expect(() => parse(42 as unknown as string)).toThrow(TypeError);
	});

	test('every problem is an error', () => {
		expect(parse('if x').diagnostics.every((d) => d.severity === 'error')).toBe(true);
	});
});

describe('toLineColumn', () => {
	test('offset 0 is line 1, column 1', () => {
		expect(toLineColumn('hello', 0)).toEqual({ line: 1, column: 1 });
	});

	test('offset at start of second line', () => {
		// "ab\ncd"
		//  0123 4
		// offset 3 is start of line 2, column 1
		expect(toLineColumn('ab\ncd', 3)).toEqual({ line: 2, column: 1 });
	});

	test('offset in middle of second line', () => {
		expect(toLineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
	});

	test('multiple newlines', () => {
		// "a\nb\nc"
		//  01 23 4
		expect(toLineColumn('a\nb\nc', 4)).toEqual({ line: 3, column: 1 });
	});

	test('line endings match the lexer', () => {
		expect(toLineColumn('a\r\nb', 3)).toEqual({ line: 2, column: 1 });
		expect(toLineColumn('a\rb', 2)).toEqual({ line: 2, column: 1 });
		expect(toLineColumn('a\r\r\nb', 4)).toEqual({ line: 3, column: 1 });
	});

	test('offset beyond source length clamps', () => {
		expect(toLineColumn('abc', 100)).toEqual({ line: 1, column: 4 });
	});

	test('empty source', () => {
		expect(toLineColumn('', 0)).toEqual({ line: 1, column: 1 });
	});

	test('offset at end of single line', () => {
		expect(toLineColumn('hello', 5)).toEqual({ line: 1, column: 6 });
	});
});
