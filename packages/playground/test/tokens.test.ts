import { describe, expect, test } from 'bun:test';
import { parse } from 'littlewing';
import { highlight, lex } from '../src/language/tokens.ts';

/** Each span as `style text`, which reads like the source it covers. */
function styles(source: string): string[] {
	return highlight(source, lex(source)).map(
		({ from, to, style }) => `${style} ${source.slice(from, to)}`,
	);
}

describe('highlight', () => {
	test('bindings, inputs and calls', () => {
		expect(styles('rate ?= 0.1\ntotal = ROUND(price * rate, 2)')).toEqual([
			'input rate',
			'operator ?=',
			'number 0.1',
			'definition total',
			'operator =',
			'function ROUND',
			'punctuation (',
			'variable price',
			'operator *',
			'variable rate',
			'punctuation ,',
			'number 2',
			'punctuation )',
		]);
	});

	test('pipes, placeholders and fallbacks', () => {
		expect(styles('xs |> SUM |> ROUND(?, 2) ?? 0')).toEqual([
			'variable xs',
			'operator |>',
			'function SUM',
			'operator |>',
			'function ROUND',
			'punctuation (',
			'operator ?',
			'punctuation ,',
			'number 2',
			'punctuation )',
			'operator ??',
			'number 0',
		]);
	});

	test('fields can be any word, keywords included', () => {
		expect(styles('{ if: 1, a, ...b }.if')).toEqual([
			'punctuation {',
			'property if',
			'punctuation :',
			'number 1',
			'punctuation ,',
			'variable a',
			'punctuation ,',
			'operator ...',
			'variable b',
			'punctuation }',
			'punctuation .',
			'property if',
		]);
	});

	test('loops name what they bind', () => {
		expect(styles('for x in xs when x > 0 into s = 0 then s + x')).toEqual([
			'keyword for',
			'definition x',
			'keyword in',
			'variable xs',
			'keyword when',
			'variable x',
			'operator >',
			'number 0',
			'keyword into',
			'definition s',
			'operator =',
			'number 0',
			'keyword then',
			'variable s',
			'operator +',
			'variable x',
		]);
	});

	test('reserved words and booleans', () => {
		expect(styles('let x = true')).toEqual([
			'keyword let',
			'definition x',
			'operator =',
			'boolean true',
		]);
	});

	test('numbers as the lexer reads them', () => {
		expect(styles('1_000.5e-3 .5')).toEqual(['number 1_000.5e-3', 'number .5']);
	});

	test('Unicode names', () => {
		expect(styles('año = 1')).toEqual(['definition año', 'operator =', 'number 1']);
	});

	test('comments, between and after tokens', () => {
		expect(styles('a // one\n// two\nb')).toEqual([
			'variable a',
			'comment // one',
			'comment // two',
			'variable b',
		]);
	});
});

describe('strings', () => {
	test('only escapes the lexer accepts', () => {
		expect(styles(String.raw`"\q\u{110000}\u{D800}"`)).toEqual([
			String.raw`string "\q\u{110000}\u{D800}"`,
		]);
	});

	test('escapes', () => {
		expect(styles(String.raw`"a\n\u{1F600}\"b"`)).toEqual([
			'string "a',
			String.raw`escape \n`,
			String.raw`escape \u{1F600}`,
			String.raw`escape \"`,
			'string b"',
		]);
	});

	test('interpolations, nested and with records inside', () => {
		expect(styles('"a#{ {b: "c#{d}"}.b }e"')).toEqual([
			'string "a',
			'interpolation #{',
			'punctuation {',
			'property b',
			'punctuation :',
			'string "c',
			'interpolation #{',
			'variable d',
			'interpolation }',
			'string "',
			'punctuation }',
			'punctuation .',
			'property b',
			'interpolation }',
			'string e"',
		]);
	});

	test('a string can span lines', () => {
		expect(styles('"a\nb" + 1')).toEqual(['string "a\nb"', 'operator +', 'number 1']);
	});

	test('an unterminated string runs to the end', () => {
		expect(styles('x = "a#{b} c')).toEqual([
			'definition x',
			'operator =',
			'string "a',
			'interpolation #{',
			'variable b',
			'interpolation }',
			'string  c',
		]);
	});
});

describe('lex', () => {
	test('keeps going past the hundredth problem', () => {
		expect(styles(`${'@'.repeat(150)}\nx = 1`)).toEqual(['definition x', 'operator =', 'number 1']);
	});

	test('a name before `(` on the next line is no call', () => {
		expect(styles('F\n(1)')).toEqual(['variable F', 'punctuation (', 'number 1', 'punctuation )']);
		expect(styles('[F\n(1)]')[1]).toBe('function F');
		expect(styles('if a then F\n(1) else b')[3]).toBe('function F');
		expect(styles('if a then b else F\n(1)')[5]).toBe('variable F');
	});

	test('strings that never close are marked', () => {
		for (const source of ['x = "hel', 'x = "a\\', 'x = "a#{1}b', '"']) {
			expect(lex(source).at(-1)?.unterminated).toBe(true);
		}
		expect(lex('x = "a"').at(-1)?.unterminated).toBeUndefined();
	});

	test('spans are in order and cover every token', () => {
		const sources = ['', '@@@', '"#{', '"#{"#{"#{', '}}}', 'a = )\n"x', '﻿a', '"\\'];
		for (const source of sources) {
			const spans = highlight(source, lex(source));
			for (let i = 1; i < spans.length; i++) {
				expect(spans[i]!.from).toBeGreaterThanOrEqual(spans[i - 1]!.to);
			}
			for (const { from, to } of spans) {
				expect(from).toBeLessThan(to);
				expect(to).toBeLessThanOrEqual(source.length);
			}
		}
	});
});

describe('agrees with the parser', () => {
	/** Whether the parser reads a call of F anywhere in `source`. */
	function parsesCall(source: string): boolean {
		return JSON.stringify(parse(source).program).includes('"kind":"call","name":"F"');
	}

	test('on where a line break ends a call', () => {
		const sources = [
			'F\n(1)',
			'x = F\n(1)',
			'[F\n(1)]',
			'{ a: F\n(1) }',
			'(F\n(1))',
			'"#{F\n(1)}"',
			'if a then F\n(1) else b',
			'if a then b else F\n(1)',
			'if F\n(1) then a else b',
			'for x in F\n(1) then x',
			'for x in xs then F\n(1)',
			'for x in xs when F\n(1) then x',
			'[if a then b else F\n(1)]',
			'G(if a then b else c, F\n(1))',
			'x = F(1)',
		];
		for (const source of sources) {
			const styled = styles(source).includes('function F');
			expect([source, styled]).toEqual([source, parsesCall(source)]);
		}
	});
});
