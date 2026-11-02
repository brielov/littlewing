import { describe, expect, test } from 'bun:test';
import type { InputSchema, TypeDescription } from '../src/check/schema.ts';
import { check } from '../src/check/check.ts';
import type { FunctionDefinition, Type } from '../src/define.ts';
import { define, defineType, t } from '../src/define.ts';
import { desugarProgram } from '../src/syntax/desugar.ts';
import type { Program } from '../src/syntax/ast.ts';
import { parse } from '../src/syntax/parser.ts';

/** The tree of a source that parses, as a test of checking needs. */
function tree(source: string): Program {
	const { program, diagnostics } = parse(source);
	if (diagnostics.length > 0) throw new Error(`${source}: ${diagnostics[0]?.message}`);
	return program;
}

class Money {
	constructor(readonly cents: number) {}
}

const usd = defineType<Money>({
	name: 'usd',
	is: (value) => value instanceof Money,
	equals: () => true,
	compare: () => 0,
	add: (a) => a,
	subtract: (a) => a,
	show: () => '',
});
const eur = defineType<Money>({ name: 'eur', is: () => false, add: (a) => a });
const opaque = defineType<Money>({ name: 'opaque', is: () => false });

const run = (): never => {
	throw new Error('not called');
};

const functions = new Map<string, FunctionDefinition>(
	Object.entries({
		STR: define({ args: [t.class('showable', 'T')], returns: t.string(), run }),
		NUM: define({ args: [t.class('convertible', 'T')], returns: t.number(), run }),
		LEN: define({ args: [t.class('sized', 'S')], returns: t.number(), run }),
		UPPER: define({ args: [t.string()], returns: t.string(), run }),
		SORT: define({
			args: [t.array(t.class('ordered', 'T'))],
			returns: t.array(t.class('ordered', 'T')),
			run,
		}),
		ROUND: define({
			args: [t.number(), t.optional(t.number()), t.optional(t.oneOf(['floor', 'ceil']))],
			returns: t.number(),
			run,
		}),
		CONTAINS: define({
			overloads: [
				{
					args: [t.array(t.class('equatable', 'T')), t.class('equatable', 'T')],
					returns: t.boolean(),
				},
				{ args: [t.string(), t.string()], returns: t.boolean() },
			],
			run,
		}),
		USD: define({ args: [t.number()], returns: usd, pure: true, run }),
		EUR: define({ args: [t.number()], returns: eur, run }),
		OPAQUE: define({ args: [], returns: opaque, run }),
		PAIR: define({
			args: [],
			returns: t.record({ a: t.number(), b: t.optional(t.string()) }),
			run,
		}),
		OPENPAIR: define({
			args: [],
			returns: t.openRecord({ a: t.number(), b: t.optional(t.string()) }),
			run,
		}),
		F: define({
			overloads: [
				{ args: [t.string()], returns: t.string() },
				{ args: [t.number()], returns: t.number() },
			],
			run,
		}),
		G: define({
			overloads: [
				{ args: [t.number()], returns: t.number() },
				{ args: [t.string()], returns: t.string() },
			],
			run,
		}),
	}),
);

interface Outcome {
	readonly codes: string[];
	readonly warnings: string[];
	readonly inputs: InputSchema;
	readonly output: TypeDescription;
}

function run_(source: string, inputs?: Record<string, Type>): Outcome {
	const program = desugarProgram(tree(source));
	const result = check(program, inputs ? { functions, inputs } : { functions });
	return {
		codes: result.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code),
		warnings: result.diagnostics.filter((d) => d.severity === 'warning').map((d) => d.code),
		inputs: result.inputs,
		output: result.output,
	};
}

const codes = (source: string): string[] => run_(source).codes;

function kindOf(type: TypeDescription | undefined): string {
	if (type === undefined) return 'none';
	switch (type.kind) {
		case 'array':
			return `array<${kindOf(type.element)}>`;
		case 'record': {
			const fields = Object.keys(type.fields)
				.sort()
				.map((name) => {
					const field = type.fields[name];
					return `${name}${field?.required ? '' : '?'}: ${kindOf(field?.type)}`;
				});
			if (type.uniform !== undefined) fields.push(`*: ${kindOf(type.uniform)}`);
			return `{${[...fields, ...(type.open ? ['...'] : [])].join(', ')}}`;
		}
		case 'generic':
			return type.classes === undefined ? 'any' : type.classes.join('&');
		case 'abstract':
			return type.name;
		default:
			return type.kind;
	}
}

const output = (source: string): string => {
	const result = run_(source);
	expect(result.codes).toEqual([]);
	return kindOf(result.output);
};

function schema(source: string): Record<string, string> {
	const result = run_(source);
	expect(result.codes).toEqual([]);
	const summary: Record<string, string> = {};
	for (const name of Object.keys(result.inputs)) {
		const input = result.inputs[name];
		summary[name] = `${input?.required ? '' : '?'}${kindOf(input?.type)}`;
	}
	return summary;
}

describe('names', () => {
	test('a name is bound once', () => {
		expect(codes('a = 1\na = 2\na')).toEqual(['duplicate-binding']);
		expect(codes('a ?= 1\na = 2\na')).toEqual(['duplicate-binding']);
	});

	test('a name is read after its binding', () => {
		expect(codes('b = a\na = 1\nb')).toEqual(['used-before-binding']);
		expect(codes('a = a + 1\na')).toEqual(['used-before-binding']);
		expect(codes('a = 1\nb = a\nb')).toEqual([]);
	});

	test('a loop name is new', () => {
		expect(codes('x = 1\nfor x in [1] then x')).toEqual(['duplicate-binding']);
		expect(codes('for x in [1] then x\nx = 1\nx')).toEqual(['duplicate-binding']);
		expect(codes('for x in [1] then for x in [2] then x')).toEqual(['duplicate-binding']);
		expect(codes('for x in [1] into x = 0 then x')).toEqual(['duplicate-binding']);
		expect(codes('y = x\nfor x in [1] then x\ny')).toEqual(['duplicate-binding']);
		expect(codes('for x in [1] then x\nfor x in ["a"] then x')).toEqual([]);
	});

	test('a loop encloses only its guard and body', () => {
		expect(codes('for x in [1] into s = (for x in [2] then x) then s')).toEqual([]);
		expect(codes('for x in (for x in [1] then x) then x')).toEqual([]);
	});

	test('a program ends in an expression', () => {
		expect(codes('x = 1')).toEqual(['missing-result']);
		expect(codes('x ?= 1')).toEqual(['missing-result']);
	});

	test('functions', () => {
		expect(codes('NOPE(1)')).toEqual(['unknown-function']);
		expect(codes('1 |> NOPE')).toEqual(['unknown-function']);
		expect(codes('LEN()')).toEqual(['wrong-argument-count']);
		expect(codes('LEN("a", "b")')).toEqual(['wrong-argument-count']);
		expect(codes('ROUND(1)\nROUND(1, 2)\nROUND(1, 2, "floor")')).toEqual([]);
		expect(codes('ROUND(1, 2, "up", 4)')).toEqual(['wrong-argument-count']);
	});

	test('functions and variables have separate namespaces', () => {
		expect(codes('LEN = 1\nLEN + LEN("a")')).toEqual([]);
	});
});

describe('expressions', () => {
	test('literals', () => {
		expect(output('1')).toBe('number');
		expect(output('"a"')).toBe('string');
		expect(output('true')).toBe('boolean');
		expect(output('[1]')).toBe('array<number>');
		expect(output('[]')).toBe('array<any>');
		expect(output('{ a: 1, b: "x" }')).toBe('{a: number, b: string}');
		expect(output('{}')).toBe('{}');
		expect(output('1..5')).toBe('array<number>');
	});

	test('one type where the rules say so', () => {
		expect(codes('if true then 1 else "a"')).toEqual(['type-mismatch']);
		expect(codes('[1, "a"]')).toEqual(['type-mismatch']);
		expect(codes('[[1], ["a"]]')).toEqual(['type-mismatch']);
		expect(codes('[[], [1]]')).toEqual([]);
		expect(codes('1 == "1"')).toEqual(['type-mismatch']);
		expect(codes('x ?= 1\nx ?? "a"')).toEqual(['type-mismatch']);
		expect(codes('a.b ?? 0\na.b + "x"')).toEqual(['type-mismatch']);
	});

	test('operators', () => {
		expect(output('1 + 2')).toBe('number');
		expect(output('"a" + "b"')).toBe('string');
		expect(output('[1] + [2]')).toBe('array<number>');
		expect(codes('{} + {}')).toEqual(['type-mismatch']);
		expect(codes('true + true')).toEqual(['type-mismatch']);
		expect(codes('"a" - "b"')).toEqual(['type-mismatch']);
		expect(codes('[1] - [2]')).toEqual(['type-mismatch']);
		expect(codes('"a" * 2')).toEqual(['type-mismatch']);
		expect(codes('1 < "a"')).toEqual(['type-mismatch']);
		expect(codes('true < false')).toEqual(['type-mismatch']);
		expect(codes('[1] < [2]')).toEqual(['type-mismatch']);
		expect(output('"a" < "b"')).toBe('boolean');
		expect(codes('1 && true')).toEqual(['type-mismatch']);
		expect(codes('!1')).toEqual(['type-mismatch']);
		expect(codes('-"a"')).toEqual(['type-mismatch']);
		expect(codes('if 1 then 2 else 3')).toEqual(['type-mismatch']);
		expect(codes('1.5.."a"')).toEqual(['type-mismatch']);
	});

	test('equality reaches inside', () => {
		expect(codes('[1] == [2]')).toEqual([]);
		expect(codes('{ a: 1 } == { a: 2 }')).toEqual([]);
		expect(codes('{ a: 1 } == { b: 2 }')).toEqual(['type-mismatch']);
		expect(codes('OPAQUE() == OPAQUE()')).toEqual(['type-mismatch']);
		expect(codes('[OPAQUE()] == [OPAQUE()]')).toEqual(['type-mismatch']);
		expect(codes('{ a: OPAQUE() } == { a: OPAQUE() }')).toEqual(['type-mismatch']);
	});

	test('loops', () => {
		expect(output('for x in [1] then x + 1')).toBe('array<number>');
		expect(output('for c in "abc" then UPPER(c)')).toBe('array<string>');
		expect(output('for x in [1] into s = 0 then s + x')).toBe('number');
		expect(output('for x in [1] when x > 0 then "a"')).toBe('array<string>');
		expect(codes('for x in 5 then x')).toEqual(['type-mismatch']);
		expect(codes('for x in {} then x')).toEqual(['type-mismatch']);
		expect(codes('for x in [1] when x then x')).toEqual(['type-mismatch']);
		expect(codes('for x in [1] into s = "" then x')).toEqual(['type-mismatch']);
	});

	test('fields', () => {
		expect(output('{ a: 1 }.a')).toBe('number');
		expect(codes('{ a: 1 }.b')).toEqual(['type-mismatch']);
		expect(codes('r = { a: 1 }\nr.b ?? 0')).toEqual(['type-mismatch']);
		expect(codes('5.5 .x')).toEqual(['type-mismatch']);
		expect(codes('"a".length')).toEqual(['type-mismatch']);
		expect(codes('[1].x')).toEqual(['type-mismatch']);
		expect(codes('USD(1).x')).toEqual(['type-mismatch']);
	});

	test('indexing', () => {
		expect(output('[1][0]')).toBe('number');
		expect(output('"abc"[0]')).toBe('string');
		expect(output('{ a: 1 }["a"]')).toBe('number');
		expect(codes('{ a: 1 }["b"]')).toEqual(['type-mismatch']);
		expect(codes('[1]["a"]')).toEqual(['type-mismatch']);
		expect(codes('"abc"["a"]')).toEqual(['type-mismatch']);
		expect(codes('5[0]')).toEqual(['type-mismatch']);
		expect(codes('USD(1)[0]')).toEqual(['type-mismatch']);
		expect(codes('r = { a: 1, b: "x" }\nk = "a"\nr[k]')).toEqual(['type-mismatch']);
		expect(output('r = { a: 1, b: 2 }\nk = "a"\nr[k]')).toBe('number');
	});

	test('calls', () => {
		expect(codes('UPPER(1)')).toEqual(['type-mismatch']);
		expect(output('LEN("a") + LEN([1])')).toBe('number');
		expect(codes('LEN(1)')).toEqual(['type-mismatch']);
		expect(codes('STR([1])')).toEqual(['type-mismatch']);
		expect(codes('STR({})')).toEqual(['type-mismatch']);
		expect(codes('STR(OPAQUE())')).toEqual(['type-mismatch']);
		expect(output('STR(USD(1))')).toBe('string');
		expect(codes('NUM([1])')).toEqual(['type-mismatch']);
		expect(output('SORT([3, 1])')).toBe('array<number>');
		expect(output('SORT(["a"])')).toBe('array<string>');
		expect(codes('SORT([true])')).toEqual(['type-mismatch']);
	});

	test('restricted strings', () => {
		expect(codes('ROUND(1, 2, "floor")')).toEqual([]);
		expect(codes('ROUND(1, 2, "up")')).toEqual(['type-mismatch']);
		expect(codes('m = "up"\nROUND(1, 2, m)')).toEqual([]);
		expect(codes('ROUND(1, 2, 3)')).toEqual(['type-mismatch']);
	});

	test('interpolation', () => {
		expect(output('"a#{1}b#{true}"')).toBe('string');
		expect(codes('"#{[1]}"')).toEqual(['type-mismatch']);
		expect(codes('"#{OPAQUE()}"')).toEqual(['type-mismatch']);
		expect(output('"#{USD(1)}"')).toBe('string');
	});

	test('pipes', () => {
		expect(output('"a" |> UPPER')).toBe('string');
		expect(output('"a" |> UPPER |> LEN')).toBe('number');
		expect(output('1.5 |> ROUND(?, 2)')).toBe('number');
		expect(codes('1 |> UPPER')).toEqual(['type-mismatch']);
		expect(output('x = 1\nx |> ROUND(?, ?)')).toBe('number');
	});

	test('abstract types', () => {
		expect(output('USD(1) + USD(2)')).toBe('usd');
		expect(output('USD(1) - USD(2)')).toBe('usd');
		expect(output('USD(1) < USD(2)')).toBe('boolean');
		expect(codes('USD(1) * 2')).toEqual(['type-mismatch']);
		expect(codes('USD(1) + EUR(2)')).toEqual(['type-mismatch']);
		expect(codes('OPAQUE() + OPAQUE()')).toEqual(['type-mismatch']);
		expect(codes('EUR(1) - EUR(2)')).toEqual(['type-mismatch']);
		expect(codes('USD(1) + 1')).toEqual(['type-mismatch']);
		expect(output('[USD(1)]')).toBe('array<usd>');
		expect(output('SORT([USD(1)])')).toBe('array<usd>');
	});

	test('one mistake reports once', () => {
		expect(codes('x = 1 + "a"\ny = x + 1\ny')).toEqual(['type-mismatch']);
		expect(codes('x = NOPE()\nx + 1')).toEqual(['unknown-function']);
	});

	test('several mistakes all report', () => {
		expect(codes('a = 1 + "a"\nb = !1\nc = NOPE()\nd = LEN()\n0')).toEqual([
			'type-mismatch',
			'type-mismatch',
			'unknown-function',
			'wrong-argument-count',
		]);
	});

	test('types are finite', () => {
		expect(codes('for x in xs into a = [] then [a]')).toEqual(['type-mismatch']);
		expect(codes('[x, [x]]')).toEqual(['type-mismatch']);
		expect(codes('a.x == a')).toEqual(['type-mismatch']);
	});
});

describe('inputs', () => {
	test('are inferred', () => {
		expect(schema('price * quantity')).toEqual({ price: 'number', quantity: 'number' });
		expect(schema('UPPER(name)')).toEqual({ name: 'string' });
		expect(schema('if flag then 1 else 2')).toEqual({ flag: 'boolean' });
		expect(schema('a + 1')).toEqual({ a: 'number' });
		expect(schema('a + "x"')).toEqual({ a: 'string' });
	});

	test('with a default are optional', () => {
		expect(schema('rate ?= 0.1\nrate * 2')).toEqual({ rate: '?number' });
		expect(schema('x ?= "a"\nx')).toEqual({ x: '?string' });
	});

	test('?? makes a name or field optional, unless it is read elsewhere too', () => {
		expect(schema('rate ?? 0.1')).toEqual({ rate: '?number' });
		expect(schema('rate ?? 0.1\nrate')).toEqual({ rate: 'number' });
		expect(schema('order.note ?? "x"')).toEqual({ order: '?{note?: string, ...}' });
		expect(schema('order.note ?? "x"\norder.total + 1')).toEqual({
			order: '{note?: string, total: number, ...}',
		});
		expect(schema('a.b.c ?? 0')).toEqual({ a: '?{b?: {c?: number, ...}, ...}' });
		expect(schema('a[b.c] ?? 0')).toEqual({ a: '?array<number>', b: '{c: number, ...}' });
	});

	test('fields make an open record', () => {
		expect(schema('order.total + order.tax')).toEqual({
			order: '{tax: number, total: number, ...}',
		});
		expect(schema('order.customer.name + "x"')).toEqual({
			order: '{customer: {name: string, ...}, ...}',
		});
		expect(schema('for i in items then i.price * 2')).toEqual({
			items: 'array<{price: number, ...}>',
		});
	});

	test('a computed key makes a uniform record', () => {
		expect(schema('rates[country + "x"] ?? 0')).toEqual({
			country: 'string',
			rates: '?{*: number, ...}',
		});
	});

	test('defaults of what is left', () => {
		expect(schema('x + y')).toEqual({ x: 'number', y: 'number' });
		expect(schema('x < y')).toEqual({ x: 'number', y: 'number' });
		expect(schema('x - y')).toEqual({ x: 'number', y: 'number' });
		expect(schema('x[0]')).toEqual({ x: 'array<any>' });
		expect(schema('x[0] + 1')).toEqual({ x: 'array<number>' });
		expect(schema('for c in x then c')).toEqual({ x: 'array<any>' });
		expect(schema('x[i]')).toEqual({ i: 'number', x: 'array<any>' });
	});

	test('what stays generic', () => {
		expect(schema('x == y')).toEqual({ x: 'equatable', y: 'equatable' });
		expect(schema('STR(x)')).toEqual({ x: 'showable' });
		expect(schema('LEN(x)')).toEqual({ x: 'sized' });
		expect(schema('NUM(x)')).toEqual({ x: 'convertible' });
		expect(schema('"#{x}"')).toEqual({ x: 'showable' });
		expect(schema('x')).toEqual({ x: 'any' });
	});

	test('classes narrow to what is left', () => {
		expect(schema('LEN(x)\nx < y')).toEqual({ x: 'string', y: 'string' });
		expect(schema('LEN(x + y)')).toEqual({ x: 'addable&sized', y: 'addable&sized' });
		expect(schema('"#{name} starts with #{name[0]}"')).toEqual({ name: 'string' });
		expect(schema('x[0]\nx < y')).toEqual({ x: 'string', y: 'string' });
		expect(schema('for c in x then c\nSTR(x)')).toEqual({ x: 'string' });
		expect(schema('NUM(x)\nLEN(x)')).toEqual({ x: 'string' });
	});

	test('a class with nothing left is a mismatch', () => {
		expect(codes('x - y\nLEN(x)')).toEqual(['type-mismatch']);
		expect(codes('x * 2\nLEN(x)')).toEqual(['type-mismatch']);
		expect(codes('x.a\nLEN(x)')).toEqual(['type-mismatch']);
	});

	test('a host can declare them', () => {
		const declared = run_('x + y', { x: t.string() });
		expect(declared.codes).toEqual([]);
		expect(kindOf(declared.inputs['y']?.type)).toBe('string');

		expect(run_('x * 2', { x: t.string() }).codes).toEqual(['type-mismatch']);
		expect(Object.keys(run_('1', { x: t.string() }).inputs)).toEqual([]);

		const closed = run_('a.b', { a: t.record({ b: t.number() }) });
		expect(kindOf(closed.inputs['a']?.type)).toBe('{b: number}');
		expect(run_('a.c', { a: t.record({ b: t.number() }) }).codes).toEqual(['type-mismatch']);

		const shared = run_('x == y', { x: t.var('T'), y: t.var('T') });
		expect(shared.codes).toEqual([]);
		const { x, y } = shared.inputs;
		expect(x?.type).toEqual(y?.type as TypeDescription);
	});

	test('names are not confused by the object they sit on', () => {
		const schemaOf = run_('__proto__ + constructor + toString').inputs;
		expect(Object.getPrototypeOf(schemaOf)).toBe(null);
		expect(Object.keys(schemaOf).sort()).toEqual(['__proto__', 'constructor', 'toString']);
	});
});

describe('records', () => {
	test('literals and inputs meet', () => {
		expect(schema('r = if c then order else { a: 1 }\nr.a')).toEqual({
			c: 'boolean',
			order: '{a: number}',
		});
		expect(codes('v = order.b\nw = if c then order else { a: 1 }\nw')).toEqual(['type-mismatch']);
		expect(codes('w = if c then order else { a: 1 }\nv = order.b\nw')).toEqual(['type-mismatch']);
		expect(codes('v = order.b ?? 0\nw = if c then order else { a: 1 }\nw')).toEqual([
			'type-mismatch',
		]);
		expect(codes('w = if c then order else { a: 1 }\nv = order.b ?? 0\nw')).toEqual([
			'type-mismatch',
		]);
	});

	test('open types unify into one', () => {
		expect(schema('r = if c then a else b\nx = a.p + 1\ny = b.q + 1\nr')).toEqual({
			a: '{p: number, q: number, ...}',
			b: '{p: number, q: number, ...}',
			c: 'boolean',
		});
	});

	test('a required read on either side makes it required', () => {
		expect(schema('x = a.f ?? 0\ny = b.f + 1\nc = if k then a else b\nc').a).toBe(
			'{f: number, ...}',
		);
	});

	test('a dynamic index needs one type of field', () => {
		expect(codes('k = "a"\nr = { a: 1, b: "x" }\nr[k]')).toEqual(['type-mismatch']);
		expect(codes('a = x[k + "s"] + 1\nc = if p then x else { n: 1, s: "text" }\na')).toEqual([
			'type-mismatch',
		]);
	});

	test('a record with unknown fields has no equality', () => {
		expect(codes('ok = a.id == b.id\na == b')).toEqual(['type-mismatch']);
		expect(codes('[a.id, a.id]\n[a] == [b]')).toEqual(['type-mismatch']);
		// Unless something closes it, in either order
		expect(codes('a = x.a\nb = x == y\nc = if p then x else { a: 1 }\nc')).toEqual([]);
		expect(codes('c = if p then x else { a: 1 }\na = x.a\nb = x == y\nc')).toEqual([]);
	});
});

describe('spreads', () => {
	test('of closed records', () => {
		expect(output('{ ...{ a: 1 }, b: 2 }')).toBe('{a: number, b: number}');
		expect(output('{ a: 1, ...{ a: "x" } }')).toBe('{a: string}');
		expect(output('{ ...{ a: 1 }, ...{ a: "x" }, a: true }')).toBe('{a: boolean}');
		expect(output('{ ...{ a: 1 }, ...{ b: 2 } }')).toBe('{a: number, b: number}');
	});

	test('of an input', () => {
		expect(schema('{ ...item, total: item.price * 2 }')).toEqual({
			item: '{price: number, ...}',
		});
		expect(output('item ?= { a: 1 }\n{ ...item, b: 2 }')).toBe('{a: number, b: number}');
	});

	test('reading through the result reads the operand', () => {
		expect(schema('r = { ...x, a: 1 }\nr.b + 1')).toEqual({ x: '{b: number, ...}' });
		expect(codes('r = { ...x, a: "s" }\nr.a + 1')).toEqual(['type-mismatch']);
		expect(schema('r = { ...x, a: "s" }\nUPPER(r.a)')).toEqual({ x: '{...}' });
	});

	test('a field the literal sets does not constrain the operand', () => {
		expect(schema('r = { ...x, a: 1 }\ny = x.a + "s"\nr')).toEqual({ x: '{a: string, ...}' });
	});

	test('waits for its operand', () => {
		const source = 'r = { ...x, f: 1 }\ny = if c then x else { g: 2 }\nr.g + r.f';
		expect(codes(source)).toEqual([]);
		const swapped = 'y = if c then x else { g: 2 }\nr = { ...x, f: 1 }\nr.g + r.f';
		expect(codes(swapped)).toEqual([]);
	});

	test('an open operand is first and alone', () => {
		expect(codes('{ a: 1, ...x }')).toEqual(['type-mismatch']);
		expect(codes('{ ...x, ...y }')).toEqual(['type-mismatch']);
		expect(codes('{ ...{ a: 1 }, ...x }')).toEqual(['type-mismatch']);
	});

	test('position does not matter once the operand is closed', () => {
		const source = 'r = { f: 1, ...e }\ny = UPPER(r.f)\nz = if c then e else { f: "s" }\ny';
		expect(codes(source)).toEqual([]);
	});

	test('neither side of an open spread can close', () => {
		expect(codes('r = { ...x, a: 1 }\ns = if c then r else { a: 2 }\ns')).toEqual([
			'type-mismatch',
		]);
	});

	test('only records spread', () => {
		expect(codes('{ ...5 }')).toEqual(['type-mismatch']);
		expect(codes('{ ..."a" }')).toEqual(['type-mismatch']);
		expect(schema('{ ...x }')).toEqual({ x: '{...}' });
	});

	test('optional fields do not spread', () => {
		expect(codes('y = x.a ?? 0\n{ ...x }')).toEqual(['type-mismatch']);
		expect(codes('{ ...PAIR() }')).toEqual(['type-mismatch']);
	});

	test('uniformity passes between result and operand', () => {
		expect(schema('s = { ...r, a: 1 }\ns[k + "x"]')).toEqual({
			k: 'string',
			r: '{*: number, ...}',
		});
	});

	test('a loop meeting a spread of its own accumulator', () => {
		expect(codes('for i in xs into a = {} then { ...a, n: 1 }')).toEqual(['type-mismatch']);
		expect(codes('for i in [1] into a = x then { ...a }')).toEqual([]);
	});
});

describe('overloads', () => {
	test('arguments decide', () => {
		expect(output('CONTAINS("abc", "a")')).toBe('boolean');
		expect(output('CONTAINS([1], 1)')).toBe('boolean');
		expect(codes('CONTAINS("abc", 1)')).toEqual(['type-mismatch']);
		expect(codes('CONTAINS([1], "a")')).toEqual(['type-mismatch']);
		expect(codes('CONTAINS(1, 1)')).toEqual(['type-mismatch']);
	});

	test('wait for what is known later', () => {
		expect(schema('CONTAINS(x, y)\nUPPER(x)')).toEqual({ x: 'string', y: 'string' });
		expect(schema('UPPER(x)\nCONTAINS(x, y)')).toEqual({ x: 'string', y: 'string' });
		expect(schema('CONTAINS(x, y)\ny + 1')).toEqual({ x: 'array<number>', y: 'number' });
	});

	test('undecided, the first that fits', () => {
		expect(schema('CONTAINS(x, y)')).toEqual({ x: 'array<equatable>', y: 'equatable' });
		expect(schema('CONTAINS(x, "a")')).toEqual({ x: 'array<string>' });
	});

	test('undecided calls go in source order', () => {
		expect(schema('F(x)\nG(x)')).toEqual({ x: 'string' });
		expect(schema('G(x)\nF(x)')).toEqual({ x: 'number' });
	});

	test('a step counts from its own position', () => {
		expect(schema('x |> G |> F')).toEqual({ x: 'number' });
	});
});

describe('order', () => {
	const programs = [
		['a = x[k]', 'b = UPPER(k)', 'a'],
		['a = x[0]', 'b = x', 'a'],
		['a = LEN(x)', 'b = x < y', 'a'],
		['a = y.p', 'b = if c then y else { p: 1 }', 'a'],
		['a = CONTAINS(x, y)', 'b = y + 1', 'a'],
		['a = u == v', 'b = u.id', 'c = if p then u else { id: 1 }', 'a'],
		['a = { ...w, n: 1 }', 'b = if p then w else { m: 2 }', 'a'],
		['a = q.m ?? 0', 'b = q.m + 1', 'a'],
	];

	test('a program means the same with its constraints in any order', () => {
		for (const statements of programs) {
			const result = statements[statements.length - 1] as string;
			const first = statements.slice(0, -1);
			const forward = run_([...first, result].join('\n'));
			const backward = run_([...first.toReversed(), result].join('\n'));
			expect(backward.codes).toEqual(forward.codes);
			const summary = (outcome: Outcome): string[] =>
				Object.keys(outcome.inputs)
					.sort()
					.map((name) => `${name}: ${kindOf(outcome.inputs[name]?.type)}`);
			expect(summary(backward)).toEqual(summary(forward));
		}
	});
});

describe('found in review', () => {
	test('warnings never hide an error', () => {
		expect(codes(`${'1\n'.repeat(120)}1 + "a"\n0`)).toEqual(['type-mismatch']);
	});

	test('a uniform promise survives a merge, in either order', () => {
		expect(codes('a = x[k + "s"] + 1\nb = y.f + "s"\nc = if p then y else x\nc')).toEqual([
			'type-mismatch',
		]);
		expect(codes('a = x[k + "s"] + 1\nb = y.f + "s"\nc = if p then x else y\nc')).toEqual([
			'type-mismatch',
		]);
	});

	test('a result can meet its operand through any number of spreads', () => {
		expect(codes('if c then x else {...{...x}}')).toEqual([]);
		expect(codes('r1 = {...x}\nr2 = {...r1}\ny = if c then r2 else x\ny.q')).toEqual([]);
		expect(schema('r2 = {...{...x, a: 1}, a: "s"}\ny = if c then r2 else x\nz = y.q\ny').x).toBe(
			'{a: string, q: any, ...}',
		);
	});

	test('what a spread masks stays masked', () => {
		const r1 = 'r1 = {...x, a: 1}\nr2 = {...r1, a: "s"}\nv = r1.a + 1\nw = UPPER(r2.a)\nv';
		expect(codes(r1)).toEqual([]);
	});

	test('infinite types are mismatches', () => {
		for (const source of [
			'[{ ...x, a: 1 }, y]\nif c then x.n else y',
			'for l0 in [v] into l1 = v.b then { ...{ ...k, b: v }, a: w }',
			'a.b.c\nif p then a else a.b',
			'x.a\nif p then x else {a: x}',
			'r = {...x, a: y}\nz = if c then y else r\nz',
		]) {
			expect(codes(source)).toEqual(['type-mismatch']);
		}
	});

	test('a narrowed class can decide a waiting call, in any order', () => {
		expect(codes('F(s)\ns[0]')).toEqual([]);
		expect(codes('s[0]\nF(s)')).toEqual([]);
		expect(codes('CONTAINS(x, y)\nx < z\nr = y[0]\nr')).toEqual([]);
		expect(codes('x < z\nCONTAINS(x, y)\nr = y[0]\nr')).toEqual([]);
		expect(codes('(if CONTAINS(s, k) then 1 else NUM(s)) + m[k]')).toEqual([]);
	});

	test('overloads are fit as a whole', () => {
		const local = new Map<string, FunctionDefinition>([
			[
				'TT',
				define({
					overloads: [
						{ args: [t.var('T'), t.var('T')], returns: t.number() },
						{ args: [t.number(), t.string()], returns: t.string() },
					],
					run,
				}),
			],
			[
				'UO',
				define({
					overloads: [
						{ args: [t.uniformRecord(t.number())], returns: t.number() },
						{ args: [t.uniformRecord(t.string())], returns: t.string() },
					],
					run,
				}),
			],
			[
				'OV',
				define({
					overloads: [
						{ args: [t.oneOf(['a'])], returns: t.number() },
						{ args: [t.oneOf(['b'])], returns: t.string() },
					],
					run,
				}),
			],
			[
				'R1',
				define({
					overloads: [
						{ args: [t.openRecord({ a: t.number() })], returns: t.string() },
						{ args: [t.openRecord({ a: t.string() })], returns: t.array(t.number()) },
					],
					run,
				}),
			],
		]);
		const local_ = (source: string): string[] =>
			check(desugarProgram(tree(source)), { functions: local })
				.diagnostics.filter((d) => d.severity === 'error')
				.map((d) => d.code);
		expect(local_('TT(1, "a")')).toEqual([]);
		expect(local_('UO({a: "s"})')).toEqual([]);
		expect(local_('OV("b")')).toEqual([]);
		expect(local_('x.b\nr = R1(x)\nx.a + 1\nr[0]')).toEqual(
			local_('x.a + 1\nx.b\nr = R1(x)\nr[0]'),
		);
	});

	test('a piped literal is checked like any other', () => {
		expect(codes('"up" |> ROUND(1, 2, ?)')).toEqual(['type-mismatch']);
	});

	test('open records that meet have one row', () => {
		expect(
			schema('r1 = {...x, a: 1}\nr2 = {...y, a: 2}\nw = if c then r1 else r2\nw.q + 1').y,
		).toBe('{q: number, ...}');
		expect(schema('z.a + 1\ns = if c then z else {...y, b: 2}\ns.a + 1').y).toBe(
			'{a: number, ...}',
		);
		expect(
			codes('w.f + 1\nx.f + "s"\nr = {...w, a: 1}\nm = if c then x else r\nUPPER(m.f)'),
		).toContain('type-mismatch');
		expect(
			schema('r1 = {...x, a: 1}\nr3 = {...y, c: 2}\nm = if p then r1 else r3\nx.d + 1\nm').y,
		).toContain('d: number');
		expect(codes('z.c ?? ""\nif c then {...y, b: 2} else z')).toEqual(['type-mismatch']);
		// So what a literal hides has to agree between the two rows
		expect(
			codes('q = x.a + "s"\nr1 = {...x, a: 1}\nr2 = {...y, b: 2}\nif c then r1 else r2'),
		).toEqual(['type-mismatch']);
	});

	test('a plain record meeting a result does not constrain what the literal sets', () => {
		const a = 'y.q\nw = [{...x, a: 1}, y]\nx.a + "s"\n0';
		const b = 'w = [{...x, a: 1}, y]\ny.q\nx.a + "s"\n0';
		expect(codes(a)).toEqual([]);
		expect(codes(b)).toEqual([]);
		expect(schema(a)).toEqual(schema(b));

		const guest =
			'UPPER(customer.name)\nc = if known then customer else { ...guest, discount: 0 }\nc.discount * 2';
		expect(schema(guest).guest).toBe('{name: string, ...}');
	});

	test('a field that can be absent is written as optional', () => {
		const result = run_('x = PAIR()\ny = if c then x.b else ""\nx');
		expect(kindOf(result.output)).toBe('{a: number, b?: string}');
	});

	test('a long chain of waiting records stays linear', () => {
		// Each result hides one more name from the rest, which costs more with each line,
		// but that work is paid for: the waiting itself adds nothing
		let source = 'm0 = {...x0, a0: 1}\n';
		for (let i = 1; i < 600; i++) {
			source += `m${i} = if c then m${i - 1} else {...x${i}, a${i}: 1}\n`;
		}
		expect(codes(`${source}0`)).toEqual([]);
	});

	test('a waiting operand known to be closed does not wait', () => {
		const rest = 's6 = if y == { a: 1, b: q0 } then { ...y, a: 2 } else w\n0';
		const late = `s1 = if c then y else { ...w }\ns3 = y.a\n${rest}`;
		const early = `s3 = y.a\ns1 = if c then y else { ...w }\n${rest}`;
		expect(codes(late)).toEqual([]);
		expect(codes(early)).toEqual([]);
		expect(schema(late)).toEqual(schema(early));
	});

	test('an operand that met a waiting record waits for it', () => {
		const spread = 's0 = { ...if qs then m else { ...x, p: x }, a: s }';
		expect(schema(`${spread}\ns2 = m["a"]\n0`)).toEqual(schema(`s2 = m["a"]\n${spread}\n0`));
	});

	test('meetings of waiting records stay linear in memory', () => {
		let source = '{...p}\n'.repeat(2000);
		for (let i = 0; i < 2000; i++) {
			source += `t${i} = {...y${i}}\nu${i} = {...t${i}}\nv${i} = if c then t${i} else p\n`;
		}
		expect(codes(`${source}0`).length).toBeLessThanOrEqual(100);
	});

	test('a failed meeting is reported where it met', () => {
		const source = 'r = {...x, a: 1}\ns = if c then r else {a: 2}\ns';
		const program = desugarProgram(tree(source));
		const [first] = check(program, { functions }).diagnostics;
		expect(source.slice(first?.start, first?.end)).toBe('{a: 2}');
	});

	test('whatever meets a waiting result is one type already', () => {
		const first =
			'z = if c then x else y\nr = {...x, a: 1}\nw = if c then r else y\nv = if c then y else {a: 1, b: "s"}\n0';
		const second =
			'r = {...x, a: 1}\nw = if c then r else y\nz = if c then x else y\nv = if c then y else {a: 1, b: "s"}\n0';
		expect(codes(first)).toEqual(codes(second));
	});

	test('whether a returned field is optional does not depend on reads', () => {
		expect(codes('y.b\nx = if c then PAIR() else y\n{...x}')).toEqual(['type-mismatch']);
		expect(codes('x = if c then PAIR() else y\ny.b\n{...x}')).toEqual(['type-mismatch']);
		expect(codes('x = OPENPAIR()\ny = if c then x.b else ""\n{ ...x }')).toEqual(['type-mismatch']);
	});

	test('a failed literal reports once', () => {
		expect(codes('r = {a: 1, ...x}\nr.a + 1')).toEqual(['type-mismatch']);
		expect(codes('r = {...x, ...y}\nr.q')).toEqual(['type-mismatch']);
		// A record plus a number is a second mistake, however the spread turns out
		expect(codes('r = {a: 1, ...x}\nr + 1').length).toBe(2);
		expect(codes('r = {a: 1, ...x}\n{...r}.a')).toEqual(['type-mismatch']);
		// And so is a record where no overload takes one
		expect(codes('r = {a: 1, ...x}\nF(r)').length).toBe(2);
	});

	test('a read does not make a returned field required', () => {
		expect(codes('x = PAIR()\ny = if c then x.b else ""\n{ ...x }')).toEqual(['type-mismatch']);
	});

	test('uniformity shows through a spread', () => {
		expect(output('s = {...r, a: 1}\nv = r[k + "x"] + 1\ns')).toContain('*: number');
	});

	test('one mistake, one report', () => {
		for (const source of [
			'true + 1',
			'"a" - 1',
			'OPAQUE() == 1',
			'x ?= 1\nfor x in [1] then x',
			'{...5}.a',
			'r = {...x}\nr == r',
			'for v in x then v + 1\nUPPER(x)',
		]) {
			expect(codes(source).length).toBe(1);
		}
	});
});

describe('order, at random', () => {
	const POOL = [
		'x[k]',
		'x[0]',
		'x[1] + 1',
		'UPPER(k)',
		'k + 1',
		'LEN(x)',
		'x < y',
		'x + y',
		'x == y',
		'y.p',
		'y.q + 1',
		'y.p ?? 0',
		'y.r ?? ""',
		'x.p',
		'for c in x then c',
		'for c in y then c',
		'if c then x else y',
		'if c then y else { p: 1 }',
		'if c then y else { p: 1, q: 2 }',
		'if c then y else { p: "s", q: 2, r: "t" }',
		'{ ...y, n: 1 }',
		'{ ...w, n: 1 }',
		'w.a + 1',
		'w == y',
		'if c then w else { m: 2 }',
		'{ ...w, m: "s" }.m',
		'STR(x)',
		'NUM(k)',
		'k == 1',
		'y == w',
		'[x, y]',
		'[y, { p: 1 }]',
		'[w, w]',
		'x[k] + 1',
		'k < x',
	];

	const summary = (outcome: Outcome): string =>
		JSON.stringify([
			[...new Set(outcome.codes)].sort(),
			outcome.codes.length > 0
				? []
				: Object.keys(outcome.inputs)
						.sort()
						.map((name) => {
							const input = outcome.inputs[name];
							return [name, input?.required, kindOf(input?.type)];
						}),
		]);

	test(
		'statements in any order mean the same',
		() => {
			let next = 12345;
			const random = (limit: number): number => {
				next = (next * 1103515245 + 12345) & 0x7fffffff;
				return (next >>> 8) % limit;
			};

			const shuffled = <T>(items: readonly T[]): T[] => {
				const copy = [...items];
				for (let i = copy.length - 1; i > 0; i--) {
					const j = random(i + 1);
					[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
				}
				return copy;
			};

			const rounds = Number(process.env.FUZZ_ROUNDS ?? 3000);
			for (let i = 0; i < rounds; i++) {
				const chosen = Array.from(
					{ length: 2 + random(5) },
					() => POOL[random(POOL.length)] as string,
				);
				const named = chosen.map((line, n) => `s${n} = ${line}`);
				const base = run_(`${named.join('\n')}\n0`);
				const other = run_(`${shuffled(named).join('\n')}\n0`);
				if (summary(base) !== summary(other)) {
					throw new Error(`${named.join(' ; ')}\n${summary(base)}\n${summary(other)}`);
				}
			}
		},
		Math.max(5000, Number(process.env.FUZZ_ROUNDS ?? 0)),
	);
});

describe('limits', () => {
	test('a type can only get so deep', () => {
		let source = 'a0 = [1]\n';
		for (let i = 1; i < 255; i++) source += `a${i} = [a${i - 1}]\n`;
		expect(codes(`${source}a254`)).toEqual([]);
		expect(codes(`${source}a255 = [a254]\na255`)).toEqual(['type-too-large']);
	});

	test('a type can only get so large, however it is shared', () => {
		const build = (n: number): string => {
			let source = 'a0 = 1\n';
			for (let i = 1; i <= n; i++) source += `a${i} = { x: a${i - 1}, y: a${i - 1} }\n`;
			return `${source}a${n}`;
		};
		expect(codes(build(14))).toEqual([]);
		expect(codes(build(16))).toEqual(['type-too-large']);
		expect(codes(build(64))).toEqual(['type-too-large']);
	});

	test('two equal shared types unify without walking every path', () => {
		let source = 'a0 = 1\nb0 = 1\n';
		for (let i = 1; i <= 13; i++) {
			source += `a${i} = { x: a${i - 1}, y: a${i - 1} }\nb${i} = { x: b${i - 1}, y: b${i - 1} }\n`;
		}
		expect(codes(`${source}[a13, b13]`)).toEqual([]);
	});

	test('a long chain through inputs ends in a report, not the stack', () => {
		let source = '';
		for (let i = 4000; i > 0; i--) source += `c${i} = x${i} == [x${i + 1}]\n`;
		expect(codes(`${source}0`)).toContain('type-too-large');
	});

	test('errors are capped', () => {
		let source = '';
		for (let i = 0; i < 1000; i++) source += `v${i} = 1 + "a"\n`;
		expect(codes(`${source}0`).length).toBeLessThanOrEqual(100);
	});
});

describe('warnings', () => {
	test('of what a program does not use', () => {
		expect(run_('a = 1\n2').warnings).toContain('unused-binding');
		expect(run_('1\n2').warnings).toEqual(['unused-statement']);
		expect(run_('a = 1\na').warnings).toEqual([]);
	});

	test('of what can never be missing', () => {
		expect(run_('a = 1\na ?? 2').warnings).toEqual(['never-missing']);
	});
});
