import { describe, expect, test } from 'bun:test';
import { parse } from 'littlewing';
import { renameEdits } from '../src/language/rename.ts';
import { loopsAround, resolve, symbolAt } from '../src/language/scope.ts';
import { lex } from '../src/language/tokens.ts';

/** Each symbol as `kind name: definition | references`, with offsets as source text positions. */
function symbols(source: string): string[] {
	return resolve(parse(source).program, lex(source)).map(
		({ kind, name, definition, references }) => {
			const where = (o: { from: number; to: number; shorthand?: true }) =>
				`${o.from}-${o.to}${o.shorthand ? 's' : ''}`;
			const defined = definition ? where(definition) : '-';
			return `${kind} ${name}: ${defined} | ${references.map(where).join(' ')}`;
		},
	);
}

describe('resolve', () => {
	test('bindings, inputs and free names', () => {
		expect(symbols('a ?= 1\nb = a + c\nb * c')).toEqual([
			'input a: 0-1 | 11-12',
			'binding b: 7-8 | 17-18',
			'free c: - | 15-16 21-22',
		]);
	});

	test('a read before its binding still refers to it', () => {
		expect(symbols('a = b\nb = 1\na')).toEqual(['binding a: 0-1 | 12-13', 'binding b: 6-7 | 4-5']);
	});

	test('loop variables are seen only in the guard and body', () => {
		const source = 'for x in xs when x > 0 into s = x then s + x';
		expect(symbols(source)).toEqual([
			'free xs: - | 9-11',
			'free x: - | 32-33',
			'loop x: 4-5 | 17-18 43-44',
			'accumulator s: 28-29 | 39-40',
		]);
	});

	test('loops side by side bind separately, and nested ones shadow nothing', () => {
		const names = symbols('[for i in a then i, for i in b then for j in i then j]');
		expect(names.filter((name) => name.startsWith('loop'))).toEqual([
			'loop i: 5-6 | 17-18',
			'loop i: 24-25 | 45-46',
			'loop j: 40-41 | 52-53',
		]);
	});

	test('parentheses around an initial value', () => {
		expect(symbols('for x in xs into acc = (0) then acc')[2]).toBe(
			'accumulator acc: 17-20 | 32-35',
		);
	});

	test('shorthand fields are reads that keep their field', () => {
		expect(symbols('total = 1\n{ total, t: total }')).toEqual([
			'binding total: 0-5 | 12-17s 22-27',
		]);
	});

	test('a broken statement leaves the others resolved', () => {
		expect(symbols('a = 1\nb = )\nc = a')).toEqual([
			'binding a: 0-1 | 16-17',
			'binding c: 12-13 | ',
		]);
	});
});

describe('symbolAt', () => {
	test('touching a name from either side', () => {
		const source = 'price = 1\nprice * 2';
		const found = resolve(parse(source).program, lex(source));
		expect(symbolAt(found, 10)?.symbol.name).toBe('price');
		expect(symbolAt(found, 15)?.occurrence).toEqual({ from: 10, to: 15 });
		expect(symbolAt(found, 16)).toBeUndefined();
	});
});

describe('loopsAround', () => {
	/** The loop names around the end of `source`, as `name<-iterable`. */
	function around(source: string): string[] {
		const read = (f: number, t: number) => source.slice(f, t);
		return loopsAround(lex(source), source.length, read).map(
			({ name, iterable }) => `${name}<-${iterable ? read(iterable.from, iterable.to) : ''}`,
		);
	}

	test('loops whose guard or body the position is in', () => {
		expect(around('for item in order.items then item.')).toEqual(['item<-order.items']);
		expect(around('for x in [a, b] when x > 0 then x.')).toEqual(['x<-[a, b]']);
		expect(around('for x in a then for y in F(x, b) then y.')).toEqual(['x<-a', 'y<-F(x, b)']);
		expect(around('for x in xs into s = 0 then s + ')).toEqual(['x<-xs', 's<-']);
		expect(around('a = for x in xs then x\n  + x.')).toEqual(['x<-xs']);
	});

	test('not loops it is outside of', () => {
		expect(around('for x in a')).toEqual([]);
		expect(around('for x in xs into s = ')).toEqual([]);
		expect(around('ys = for item in xs then item.price\nitem.')).toEqual([]);
		expect(around('[for x in a then x]; x.')).toEqual([]);
		expect(around('F(for x in a then x) + x.')).toEqual([]);
		expect(around('ys = [for item in items then item, it')).toEqual([]);
		expect(around('r = if c then for x in xs then x else x')).toEqual([]);
		expect(around('if for x in xs then x then x.')).toEqual([]);
	});

	test('an if or for inside takes its own then and else', () => {
		expect(around('for x in if c then a else b then x.')).toEqual(['x<-if c then a else b']);
		expect(around('for x in xs then if x then 1 else x.')).toEqual(['x<-xs']);
		expect(around('for x in [for y in ys then y] then x.')).toEqual(['x<-[for y in ys then y]']);
	});
});

describe('renameEdits', () => {
	function rename(source: string, at: number, name: string): string {
		const symbols = resolve(parse(source).program, lex(source));
		const result = renameEdits(symbols, symbolAt(symbols, at)!.symbol, name);
		if ('error' in result) return `error: ${result.error}`;
		let text = source;
		for (const { from, to, insert } of [...result.edits].reverse()) {
			text = text.slice(0, from) + insert + text.slice(to);
		}
		return text;
	}

	test('every occurrence, shorthand fields keeping theirs', () => {
		expect(rename('total = 1\n{ total, t: total }', 0, 'sum')).toBe(
			'sum = 1\n{ total: sum, t: sum }',
		);
		expect(rename('for x in xs then x + 1', 4, 'item')).toBe('for item in xs then item + 1');
	});

	test('names compare in NFC', () => {
		const composed = 'for x in xs then x + \u00f1';
		expect(rename(composed, 4, 'n\u0303')).toBe('error: \u00f1 is already a name here');
	});

	test('never a name in use, which could capture or be captured', () => {
		expect(rename('for x in xs then x + a', 4, 'a')).toBe('error: a is already a name here');
		expect(rename('for x in xs then a', 17, 'x')).toBe('error: x is already a name here');
	});

	test('only names', () => {
		expect(rename('a = 1\na', 0, 'if')).toBe("error: 'if' is not a name");
		expect(rename('a = 1\na', 0, 'b c')).toBe("error: 'b c' is not a name");
		expect(rename('a = 1\na', 0, '')).toBe('error: Nothing is not a name');
		expect(rename('a = 1\na', 0, 'año')).toBe('año = 1\naño');
	});
});
