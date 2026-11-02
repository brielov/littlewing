import { describe, expect, test } from 'bun:test';
import { lex } from '../src/language/tokens.ts';
import { elementOf, namesTypes, pathType, typeBefore, typeText } from '../src/language/types.ts';
import { FUNCTIONS, TYPES } from '../src/environment.ts';

const options = { functions: FUNCTIONS, types: TYPES };

describe('namesTypes', () => {
	test('bindings, inputs and free names', () => {
		const source =
			'rate ?= 0.1\nitems = [{ price: 1, note: "a" }]\nfor i in items then i.price * rate * qty';
		const types = namesTypes(source, ['rate', 'items'], options)!;
		const text = Object.fromEntries([...types].map(([name, type]) => [name, typeText(type)]));
		expect(text).toEqual({
			rate: 'number',
			qty: 'number',
			items: 'array<{ price: number, note: string }>',
		});
	});

	test('a program that ends in a binding still has types', () => {
		const types = namesTypes('a = 1', ['a'], options)!;
		expect(typeText(types.get('a')!)).toBe('number');
	});

	test('names whose record together is too large, asked for in halves', () => {
		const lines = ['r0 = 1'];
		for (let i = 1; i <= 14; i++) lines.push(`r${i} = { x: r${i - 1}, y: r${i - 1} }`);
		lines.push('copy = r14', 'copy');
		const names = Array.from({ length: 15 }, (_, i) => `r${i}`).concat('copy');
		const types = namesTypes(lines.join('\n'), names, options)!;
		expect(typeText(types.get('r1')!)).toBe('{ x: number, y: number }');
		expect(types.has('copy')).toBe(true);
	});

	test('no halves when the program itself is too large, which would take long', () => {
		const lines = ['a0 = [1]'];
		for (let i = 1; i <= 300; i++) lines.push(`a${i} = [a${i - 1}]`);
		lines.push('a300');
		const names = Array.from({ length: 301 }, (_, i) => `a${i}`);
		const started = performance.now();
		expect(namesTypes(lines.join('\n'), names, options)).toBeUndefined();
		expect(performance.now() - started).toBeLessThan(500);
	});

	test('nothing for a program that does not compile', () => {
		expect(namesTypes('a = 1 +', ['a'], options)).toBeUndefined();
	});
});

describe('typeText', () => {
	test('type variables are named in order, and shared', () => {
		const types = namesTypes('f = x\ng = [y, x]', ['f', 'g'], options)!;
		expect(typeText(types.get('g')!)).toMatch(/^array<.+>$/);
		const named = typeText({ kind: 'array', element: { kind: 'generic', id: 7 } });
		expect(named).toBe('array<T>');
	});
});

describe('typeBefore', () => {
	const types = namesTypes(
		'order ?= { items: [{ price: 1, tags: ["a"] }], if: { then: 2 } }\norder',
		['order'],
		options,
	)!;

	/** The type before the `.` at the end of `source`. */
	function before(source: string): string | undefined {
		const read = (f: number, t: number) => source.slice(f, t);
		const type = typeBefore(lex(source), source.length, read, (token) =>
			types.get(read(token.from, token.to)),
		);
		return type && typeText(type);
	}

	test('names, fields and indexes', () => {
		expect(before('order.')).toBe(
			'{ items: array<{ price: number, tags: array<string> }>, if: { then: number } }',
		);
		expect(before('order.items[0].')).toBe('{ price: number, tags: array<string> }');
		expect(before('order.items[LEN(order.items) - 1].')).toBe(
			'{ price: number, tags: array<string> }',
		);
		expect(before('order.if.')).toBe('{ then: number }');
		expect(before('order["if"].')).toBe('{ then: number }');
	});

	test('nothing it cannot follow', () => {
		expect(before('order')).toBeUndefined();
		expect(before('(order).')).toBeUndefined();
		expect(before('unknown.')).toBeUndefined();
		expect(before('order.nope.')).toBeUndefined();
		expect(before('order\n[0].')).toBeUndefined();
	});
});

describe('pathType', () => {
	const types = namesTypes('order ?= { items: [{ price: 1 }] }\norder', ['order'], options)!;

	/** The type of all of `source` as a path, or of its element when looped over. */
	function path(source: string): string | undefined {
		const read = (f: number, t: number) => source.slice(f, t);
		const span = { from: source.indexOf('order'), to: source.length };
		const type = pathType(lex(source), span, read, (token) =>
			types.get(read(token.from, token.to)),
		);
		return type && typeText(type);
	}

	test('a whole path', () => {
		expect(path('order.items')).toBe('array<{ price: number }>');
		expect(path('(order.items')).toBe('array<{ price: number }>');
	});

	test('not part of one', () => {
		expect(path('order.items + x.items')).toBeUndefined();
		expect(path('order.items[0].price')).toBe('number');
	});

	test('what a loop takes', () => {
		expect(typeText(elementOf({ kind: 'array', element: { kind: 'number' } })!)).toBe('number');
		expect(typeText(elementOf({ kind: 'string' })!)).toBe('string');
		expect(elementOf({ kind: 'number' })).toBeUndefined();
	});
});
