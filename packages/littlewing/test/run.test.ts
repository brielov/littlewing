import { describe, expect, test } from 'bun:test';
import { compile, evaluate, Program, run } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import { define, defineType, once, t } from '../src/define.js';
import { CompileError, EvaluationError } from '../src/errors.js';

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

function program(source: string, options: Parameters<typeof compile>[1] = {}): Program {
	const result = compile(source, options);
	if (!result.ok) throw new CompileError(result.diagnostics);
	return result.program;
}

function warnings(source: string, options: Parameters<typeof compile>[1] = {}): string[] {
	return compile(source, options).diagnostics.map((diagnostic) => diagnostic.code);
}

describe('expressions', () => {
	test('arithmetic is exact decimal', () => {
		expect(run('0.1 + 0.2')).toBe(0.3);
		expect(run('2 ^ -1 * 3')).toBe(1.5);
		expect(run('-2 ^ 2')).toBe(-4);
		expect(run('7 % -2')).toBe(1);
		expect(run('-7 % 2')).toBe(-1);
		expect(run('1 / 3', { numbers: 'decimal' })).toEqual(
			Decimal.from('0.3333333333333333333333333333333333'),
		);
	});

	test('integers past the safe range stay exact', () => {
		const big = run('9007199254740991 + 2', { numbers: 'decimal' }) as Decimal;
		expect(big.toString()).toBe('9007199254740993');
		const product = run('94906267 * 94906267', { numbers: 'decimal' }) as Decimal;
		expect(product.toString()).toBe('9007199515875289');
	});

	test('the fast paths agree with the exact ones', () => {
		expect(Object.is(run('-4 % 2'), 0)).toBe(true);
		expect(run('-7 % 3')).toBe(-1);
		expect(run('7 % 2.5')).toBe(2);
		expect(codeOf(() => run('x % 0', { variables: { x: 1 } }))).toBe('modulo-by-zero');
		expect(run('x == 0.1 + 0.2', { variables: { x: 0.3 } })).toBe(true);
		expect(run('x != 1', { variables: { x: 1 } })).toBe(false);
		expect(run('x != 1.5', { variables: { x: 1 } })).toBe(true);
	});

	test('no negative zero', () => {
		expect(Object.is(run('0 * -1'), 0)).toBe(true);
		expect(Object.is(run('x = 0\n-x'), 0)).toBe(true);
	});

	test('strings, arrays and records', () => {
		expect(run('"a" + "b"')).toBe('ab');
		expect(run('[1, 2] + [3]')).toEqual([1, 2, 3]);
		expect(run('r = { a: 1, "b c": 2 }\nr.a + r["b c"]')).toBe(3);
		expect(run('{ ...{ a: 1 }, b: 2 }')).toEqual(
			Object.assign(Object.create(null), { a: 1, b: 2 }),
		);
		expect(run('"é😀x"[1]')).toBe('😀');
		expect(run('"é😀x"[-1]')).toBe('x');
		expect(run('"a#{1 + 1}b#{true}"')).toBe('a2btrue');
	});

	test('equality and order', () => {
		expect(run('[[1], [2]] == [[1], [2]]')).toBe(true);
		expect(run('{ a: 1 } == { a: 2 }')).toBe(false);
		expect(run('{ a: 1 } != { a: 2 }')).toBe(true);
		expect(run('"a" < "b"')).toBe(true);
		expect(run('"\u{10000}" > "￿"')).toBe(true);
		expect(run('1.5 >= 1.5')).toBe(true);
	});

	test('short circuit, if, for', () => {
		const calls: number[] = [];
		const SEE = define({
			args: [t.number()],
			returns: t.boolean(),
			run: (value) => {
				calls.push(value.toNumber());
				return true;
			},
		});
		const functions = { SEE };
		expect(run('false && SEE(1)', { functions })).toBe(false);
		expect(run('true || SEE(2)', { functions })).toBe(true);
		expect(run('c = SEE(3)\nif c then 1 else 2', { functions })).toBe(1);
		expect(calls).toEqual([3]);

		expect(run('for x in 1..=3 then x * 2')).toEqual([2, 4, 6]);
		expect(run('for x in 1..=4 when x % 2 == 0 then x')).toEqual([2, 4]);
		expect(run('for x in 1..=4 into acc = 0 then acc + x')).toBe(10);
		expect(run('for c in "a😀" then c + "!"')).toEqual(['a!', '😀!']);
	});

	test('ranges at the edge of the numbers', () => {
		expect(run('0..0')).toEqual([]);
		expect(run('1e40..1e40')).toEqual([]);
		expect(run('5..=5')).toEqual([5]);
		expect((run('1e33..(1e33 + 3)', { numbers: 'decimal' }) as Decimal[]).length).toBe(3);
		expect(codeOf(() => run('(1e34 + 10)..(1e34 + 20)'))).toBe('compile:invalid-range');
		expect((run('(1e34 - 2)..=1e34', { numbers: 'decimal' }) as Decimal[]).length).toBe(3);
		expect(codeOf(() => run('2..1'))).toBe('compile:invalid-range');
		expect(codeOf(() => run('1.5..3'))).toBe('compile:not-an-integer');
	});

	test('pipes evaluate their value once, first', () => {
		const order: string[] = [];
		const A = define({
			args: [],
			returns: t.number(),
			run: () => {
				order.push('A');
				return 1;
			},
		});
		const B = define({
			args: [],
			returns: t.number(),
			run: () => {
				order.push('B');
				return 2;
			},
		});
		const ADD = define({
			args: [t.number(), t.number(), t.number()],
			returns: t.number(),
			run: (a, b, c) => a.plus(b).plus(c),
		});
		expect(run('A() |> ADD(B(), ?, ?)', { functions: { A, B, ADD } })).toBe(4);
		expect(order).toEqual(['A', 'B']);
	});
});

describe('missing values', () => {
	test('?? catches each kind of missing', () => {
		expect(run('a ?? 1')).toBe(1);
		expect(run('a ?? 1', { variables: { a: 2 } })).toBe(2);
		expect(run('o.a.b ?? 1', { variables: {} })).toBe(1);
		expect(run('o.a.b ?? 1', { variables: { o: {} } })).toBe(1);
		expect(run('o.a.b ?? 1', { variables: { o: { a: { b: 5 } } } })).toBe(5);
		expect(run('r = [1]\nr[5] ?? 9')).toBe(9);
		expect(run('r = { a: 1 }\nk = "a" + "b"\nr[k] ?? 9')).toBe(9);
	});

	test('the first missing step ends the path', () => {
		let calls = 0;
		const K = define({
			args: [],
			returns: t.string(),
			run: () => {
				calls++;
				return 'x';
			},
		});
		expect(run('o[K()] ?? 1', { functions: { K } })).toBe(1);
		expect(calls).toBe(0);
	});

	test('bare, they fail', () => {
		expect(codeOf(() => run('r = [1]\nr[5]'))).toBe('compile:missing-value');
		expect(codeOf(() => run('r[5]', { variables: { r: [1] } }))).toBe('missing-value');
		expect(codeOf(() => run('r[0.5]', { variables: { r: [1] } }))).toBe('not-an-integer');
	});

	test('an abstract null is a value, not a missing one', () => {
		const nothing = defineType<null>({ name: 'nothing', is: (value) => value === null });
		const options = { inputs: { a: nothing } };
		expect(
			run('a ?? b', {
				...options,
				inputs: { a: nothing, b: nothing },
				variables: { a: null, b: null },
			}),
		).toBe(null);
		expect(
			run('a ?= NOTHING()\na', {
				functions: { NOTHING: define({ args: [], returns: nothing, run: () => null }) },
				inputs: { a: nothing },
				variables: { a: null },
			}),
		).toBe(null);
	});
});

describe('compile', () => {
	test('constant failures', () => {
		expect(codeOf(() => run('x = 1 / 0\nx'))).toBe('compile:division-by-zero');
		expect(warnings('y = if c then 1 / 0 else 2\ny')).toContain('may-fail');
		expect(program('y = if c then 1 / 0 else 2\ny')).toBeInstanceOf(Program);
		expect(warnings('c && 1 / 0 == 1')).toContain('may-fail');
		expect(warnings('a ?= 1 / 0\na')).toContain('may-fail');
		expect(warnings('a ?? 1 / 0')).toContain('may-fail');
		expect(warnings('o[1 / 0] ?? 1')).toContain('may-fail');
		expect(warnings('for x in 1..3 then 1 / 0')).toContain('may-fail');
		expect(codeOf(() => run('for x in [1 / 0] then x'))).toBe('compile:division-by-zero');
		expect(codeOf(() => run('{ a: 1 }.a + [1][3]'))).toBe('compile:missing-value');
		expect(warnings('x = [1]\nif c then x[0] else 0')).not.toContain('may-fail');
	});

	test('a constant condition warns', () => {
		expect(warnings('if 1 > 2 then 1 else 2')).toContain('constant-condition');
		expect(warnings('for x in a when true then x')).toContain('constant-condition');
		expect(warnings('if a then 1 else 2')).not.toContain('constant-condition');
	});

	test('pure functions fold, others do not', () => {
		let calls = 0;
		const P = define({
			args: [],
			returns: t.number(),
			pure: true,
			run: () => {
				calls++;
				return 1;
			},
		});
		const prepared = program('P() + 1', { functions: { P } });
		expect(calls).toBe(1);
		expect(evaluate(prepared)).toBe(2);
		expect(calls).toBe(1);

		const N = define({
			args: [],
			returns: t.number(),
			run: () => {
				calls++;
				return 1;
			},
		});
		calls = 0;
		const unfolded = program('N() + 1', { functions: { N } });
		expect(calls).toBe(0);
		expect(evaluate(unfolded)).toBe(2);
		expect(calls).toBe(1);
	});

	test('a pure function that throws is a constant failure', () => {
		const cause = new Error('no');
		const BOOM = define({
			args: [],
			returns: t.number(),
			pure: true,
			run: () => {
				throw cause;
			},
		});
		const result = compile('BOOM()', { functions: { BOOM } });
		expect(result.ok).toBe(false);
		expect(result.diagnostics[0]?.code).toBe('host-error');
		expect(result.diagnostics[0]?.cause).toBe(cause);
		expect(Object.keys(result.diagnostics[0] as object)).not.toContain('cause');
	});

	test('running out while folding never fails compilation', () => {
		const result = compile('x = 0..=100000\nx[2]', { limits: { maxSteps: 20000 } });
		expect(result.ok).toBe(true);
		if (result.ok) expect(evaluate(result.program)).toBe(2);
		const late = compile('x = 1 / 0\ny = 0..=100000\ny[0]', { limits: { maxSteps: 5000 } });
		expect(late.ok).toBe(false);
	});

	test('outside folding, the budget fails compilation', () => {
		const result = compile('1 + 1', { limits: { maxSteps: 0 } });
		expect(result.ok).toBe(false);
		expect(result.diagnostics[0]?.code).toBe('limit-exceeded');
	});

	test('a big constant stays out of the program', () => {
		const big = program('x = 0..=5000\nx[1]');
		expect(evaluate(big)).toBe(1);
		expect(codeOf(() => evaluate(big, { limits: { maxSteps: 100 } }))).toBe('limit-exceeded');
		const small = program('x = 0..=10\nx[1]');
		expect(evaluate(small, { limits: { maxSteps: 5 } })).toBe(1);
	});

	test('the schema carries kept defaults', () => {
		const { inputs, output } = program(
			'a ?= 1.50\nb ?= "x"\nc ?= true\nd ?= 1 + 2\ne ?= [1]\n a + d + LEN2(b) + e[0]',
			{
				functions: { LEN2: define({ args: [t.string()], returns: t.number(), run: () => 1 }) },
			},
		);
		expect(inputs.a?.default).toBe('1.5');
		expect(inputs.b?.default).toBe('x');
		expect(inputs.d?.default).toBe('3');
		expect(inputs.e?.default).toBeUndefined();
		expect(output.kind).toBe('number');
		expect(Object.isFrozen(inputs)).toBe(true);
	});

	test('host mistakes throw', () => {
		const F = define({ args: [], returns: t.number(), run: () => 1 });
		expect(() => compile('1', { functions: { 'not a name': F } })).toThrow(TypeError);
		expect(() => compile('1', { functions: { é: F } })).toThrow(TypeError);
		expect(() => compile('1', { functions: { F: (() => 1) as never } })).toThrow(TypeError);
		expect(() => compile('1', { types: [{}] as never })).toThrow(TypeError);
		expect(() => compile('1', { limits: { maxSteps: Number.NaN } })).toThrow(TypeError);
		expect(() => compile('1', { limits: { maxSteps: -1 } })).toThrow(TypeError);
		const one = defineType<string>({ name: 'x', is: () => false });
		const two = defineType<string>({ name: 'x', is: () => false });
		expect(() => compile('1', { types: [one, two] })).toThrow(TypeError);
	});
});

describe('evaluate', () => {
	test('a Program only comes from compile', () => {
		expect(() => evaluate({} as Program)).toThrow(TypeError);
		expect(() => new (Program as unknown as new () => Program)()).toThrow(TypeError);
	});

	test('options are checked', () => {
		const p = program('1');
		expect(() => evaluate(p, { numbers: 'text' as never })).toThrow(TypeError);
		expect(() => evaluate(p, { limits: { maxSteps: -1 } })).toThrow(TypeError);
		expect(() => evaluate(p, { variables: new Map() as never })).toThrow(TypeError);
		expect(() => evaluate(p, { variables: [] as never })).toThrow(TypeError);
		expect(() => evaluate(p, { variables: null as never })).toThrow(TypeError);
	});

	test('missing comes before invalid', () => {
		const p = program('a + 1 + b');
		expect(codeOf(() => evaluate(p, { variables: { a: 'x' } }))).toBe('missing-input');
		expect(codeOf(() => evaluate(p, { variables: { a: 'x', b: 1 } }))).toBe('invalid-input');
	});

	test('only own enumerable inputs count', () => {
		const p = program('toString + 1');
		expect(codeOf(() => evaluate(p, { variables: {} }))).toBe('missing-input');
		const hidden = Object.defineProperty({}, 'toString', { value: 1, enumerable: false });
		expect(codeOf(() => evaluate(p, { variables: hidden }))).toBe('missing-input');
		expect(evaluate(p, { variables: { toString: 1 } as never })).toBe(2);
	});

	test('a variable that throws is invalid-input', () => {
		const p = program('a + 1');
		const variables = {
			get a(): number {
				throw new Error('no');
			},
		};
		expect(codeOf(() => evaluate(p, { variables }))).toBe('invalid-input');
		const deep = program('a.b + 1');
		const nested = {
			a: {
				get b(): number {
					throw new Error('no');
				},
			},
		};
		expect(codeOf(() => evaluate(deep, { variables: nested }))).toBe('invalid-input');
		const proxy = new Proxy(
			{},
			{
				getOwnPropertyDescriptor() {
					throw new Error('no');
				},
			},
		);
		expect(codeOf(() => evaluate(p, { variables: proxy }))).toBe('invalid-input');
	});

	test('numbers come back as asked', () => {
		const p = program('a * 3');
		expect(evaluate(p, { variables: { a: 0.1 } })).toBe(0.3);
		expect(evaluate(p, { variables: { a: Decimal.from('0.1') }, numbers: 'decimal' })).toEqual(
			Decimal.from('0.3'),
		);
		expect(codeOf(() => evaluate(p, { variables: { a: Number.NaN } }))).toBe('invalid-input');
		expect(codeOf(() => evaluate(p, { variables: { a: Decimal.from('1e400') } }))).toBe('overflow');
		const nested = program('{ a: x, b: [x] }').output;
		expect(nested.kind).toBe('record');
	});

	test('a program cannot change what the host gave, or the reverse', () => {
		const list = [1, 2];
		const p = program('a + [3]');
		const result = evaluate(p, { variables: { a: list } }) as number[];
		expect(result).toEqual([1, 2, 3]);
		expect(list).toEqual([1, 2]);
		const folded = program('[1, 2]');
		const first = evaluate(folded) as number[];
		first.push(3);
		expect(evaluate(folded)).toEqual([1, 2]);
	});

	test('sharing survives, so a tower of pairs is fine to read', () => {
		let source = 'a0 = [1]\n';
		for (let i = 1; i < 25; i++) source += `a${i} = [a${i - 1}, a${i - 1}]\n`;
		const p = program(`${source}a24[0]`, { limits: { maxSteps: 1e6 } });
		expect(codeOf(() => evaluate(p, { limits: { maxSteps: 1e6 } }))).toBe('limit-exceeded');
		const small = program('a0 = [1]\na1 = [a0, a0]\na1');
		const out = evaluate(small) as number[][];
		expect(out[0]).toBe(out[1] as number[]);
	});

	test('open records carry the rest along, unread and by reference', () => {
		const unread = { deep: 1 };
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const p = program('{ ...r, x: r.a + 1 }');
		const result = evaluate(p, { variables: { r: { a: 1, unread, cyclic } } }) as Record<
			string,
			unknown
		>;
		expect(result.x).toBe(2);
		expect(result.unread).toBe(unread);
		expect(result.cyclic).toBe(cyclic);
		expect(Object.getPrototypeOf(result)).toBe(null);
	});

	test('a hostile getter gives one value to the check and the program', () => {
		let reads = 0;
		const variables = {
			r: {
				get a(): number {
					reads++;
					return reads === 1 ? 1 : Number.NaN;
				},
			},
		};
		expect(evaluate(program('r.a + r.a'), { variables })).toBe(2);
		expect(reads).toBe(1);
	});
});

describe('generic inputs', () => {
	test('an operation is chosen when the program runs', () => {
		const p = program('a == b');
		expect(evaluate(p, { variables: { a: 1, b: 1 } })).toBe(true);
		expect(evaluate(p, { variables: { a: 'x', b: 'y' } })).toBe(false);
		expect(evaluate(p, { variables: { a: [1], b: [1] } })).toBe(true);
		expect(evaluate(p, { variables: { a: { x: 1 }, b: { x: 1 } } })).toBe(true);
		expect(evaluate(p, { variables: { a: true, b: true } })).toBe(true);
		expect(codeOf(() => evaluate(p, { variables: { a: 1, b: 'x' } }))).toBe('invalid-input');
	});

	test('+ left generic joins strings or arrays', () => {
		const SIZED = define({
			args: [t.class('sized', 'T')],
			returns: t.boolean(),
			run: () => true,
		});
		const p = program('s = SIZED(a)\nif s then a + a else a', { functions: { SIZED } });
		expect(p.output.kind).toBe('generic');
		expect(evaluate(p, { variables: { a: 'x' } })).toBe('xx');
		expect(evaluate(p, { variables: { a: [1] } })).toEqual([1, 1]);
		expect(codeOf(() => evaluate(p, { variables: { a: 1 } }))).toBe('invalid-input');
	});

	test('numbers cross as numbers through a generic', () => {
		const p = program('[a]');
		expect(evaluate(p, { variables: { a: 2 } })).toEqual([2]);
		expect(evaluate(p, { variables: { a: { b: 2 } }, numbers: 'decimal' })).toEqual([
			Object.assign(Object.create(null), { b: Decimal.from(2) }),
		]);
	});
});

describe('abstract types', () => {
	class Money {
		constructor(readonly cents: number) {}
	}
	const money = defineType<Money>({
		name: 'money',
		is: (value) => value instanceof Money,
		equals: (a, b) => a.cents === b.cents,
		compare: (a, b) => a.cents - b.cents,
		add: (a, b) => new Money(a.cents + b.cents),
		subtract: (a, b) => new Money(a.cents - b.cents),
		show: (a) => `$${a.cents / 100}`,
	});
	const inputs = { a: money, b: money };
	const variables = { a: new Money(100), b: new Money(250) };

	test('operators use the hooks', () => {
		expect((run('a + b', { inputs, variables }) as Money).cents).toBe(350);
		expect((run('a - b', { inputs, variables }) as Money).cents).toBe(-150);
		expect(run('a < b', { inputs, variables })).toBe(true);
		expect(run('a == b', { inputs, variables })).toBe(false);
		expect(run('"#{a}"', { inputs, variables })).toBe('$1');
		expect(run('[a] == [a]', { inputs, variables })).toBe(true);
		expect(run('{ x: a } == { x: b }', { inputs, variables })).toBe(false);
	});

	test('values are untouched', () => {
		expect(run('a', { inputs, variables })).toBe(variables.a);
		expect(run('[a]', { inputs, variables })).toEqual([variables.a]);
	});

	test('at a generic position, found by test', () => {
		const p = program('a == b', { types: [money] });
		expect(evaluate(p, { variables })).toBe(false);
		const r = program('"#{a}"', { types: [money] });
		expect(evaluate(r, { variables: { a: new Money(100) } })).toBe('$1');
	});

	test('a type made of strings or numbers still uses its hooks', () => {
		const tag = defineType<string>({
			name: 'tag',
			is: (value) => typeof value === 'string',
			equals: (a, b) => a.toLowerCase() === b.toLowerCase(),
			compare: (a, b) => b.localeCompare(a),
			add: (a, b) => `${a}/${b}`,
			show: (a) => `#${a}`,
		});
		const count = defineType<number>({
			name: 'count',
			is: (value) => typeof value === 'number',
			add: () => 42,
			subtract: () => 7,
			show: () => 'n',
		});
		const tags = { inputs: { a: tag, b: tag }, variables: { a: 'A', b: 'a' } };
		expect(run('a == b', tags)).toBe(true);
		expect(run('a + b', tags)).toBe('A/a');
		expect(run('a < b', tags)).toBe(true);
		expect(run('"#{a}"', tags)).toBe('#A');
		const counts = { inputs: { a: count, b: count }, variables: { a: 1, b: 2 } };
		expect(run('a + b', counts)).toBe(42);
		expect(run('a - b', counts)).toBe(7);
		expect(run('"#{a}"', counts)).toBe('n');
	});

	test('an abstract value at a generic position cannot pose as a built-in', () => {
		const weird = defineType<string>({
			name: 'w',
			is: (value) => typeof value === 'string',
			equals: () => true,
		});
		const p = program('a == b', { types: [weird] });
		expect(codeOf(() => evaluate(p, { variables: { a: 'x', b: 'y' } }))).toBe('invalid-input');
	});

	test('hooks are held to their promises', () => {
		const make = (hooks: object) =>
			defineType<Money>({ name: 'm', is: (value) => value instanceof Money, ...hooks });
		const check = (source: string, hooks: object): string => {
			const type = make(hooks);
			return codeOf(() => run(source, { inputs: { a: type, b: type }, variables }));
		};
		expect(check('a + b', { add: () => 1 })).toBe('host-error');
		expect(check('a + b', { add: () => undefined })).toBe('host-error');
		expect(
			check('a + b', {
				add: () => {
					throw new Error('no');
				},
			}),
		).toBe('host-error');
		expect(check('a == b', { equals: () => 1 })).toBe('host-error');
		expect(check('a < b', { compare: () => Number.NaN })).toBe('host-error');
		expect(check('"#{a}"', { show: () => 1 })).toBe('host-error');
		expect(check('"#{a}"', { show: () => '\ud800' })).toBe('host-error');
	});

	test('an operation never folds', () => {
		let calls = 0;
		const counted = defineType<Money>({
			name: 'c',
			is: (value) => value instanceof Money,
			add: (a) => {
				calls++;
				return a;
			},
		});
		const M = define({ args: [], returns: counted, pure: true, run: () => new Money(1) });
		const p = program('M() + M()', { functions: { M } });
		expect(calls).toBe(0);
		evaluate(p);
		expect(calls).toBe(1);
	});

	test('a failing hook has a location in the program, and none at the boundary', () => {
		const bad = defineType<Money>({
			name: 'b',
			is: (value) => value instanceof Money,
			add: () => {
				throw new Error('no');
			},
		});
		try {
			run('x = 1\na + b', { inputs: { a: bad, b: bad }, variables });
			expect.unreachable();
		} catch (error) {
			expect((error as EvaluationError).start).toBe(6);
			expect((error as Error & { cause: Error }).cause.message).toBe('no');
		}
	});
});

describe('functions', () => {
	test('run receives Decimals in frozen copies', () => {
		let seen: unknown;
		const F = define({
			args: [t.array(t.record({ a: t.number() }))],
			returns: t.number(),
			run: (list) => {
				seen = list;
				return list[0]?.a.plus(1) ?? 0;
			},
		});
		expect(run('F([{ a: 1 }])', { functions: { F } })).toBe(2);
		expect(Object.isFrozen(seen)).toBe(true);
		expect(Object.isFrozen((seen as object[])[0])).toBe(true);
	});

	test('cost sees what run sees, and is validated', () => {
		const pairs: unknown[] = [];
		const F = define({
			args: [t.array(t.number())],
			returns: t.number(),
			cost: (list) => {
				pairs.push(list);
				return 0;
			},
			run: (list) => {
				pairs.push(list);
				return 1;
			},
		});
		run('F(a)', { functions: { F }, inputs: { a: t.array(t.number()) }, variables: { a: [1] } });
		expect(pairs[0]).toBe(pairs[1]);

		const costing = (cost: unknown): string =>
			codeOf(() =>
				run('F()', {
					functions: {
						F: define({ args: [], returns: t.number(), cost: cost as never, run: () => 1 }),
					},
				}),
			);
		expect(costing(() => Number.NaN)).toBe('host-error');
		expect(costing(() => -1)).toBe('host-error');
		expect(costing(() => 'x')).toBe('host-error');
		expect(
			costing(() => {
				throw new Error('no');
			}),
		).toBe('host-error');
		expect(costing(() => Number.POSITIVE_INFINITY)).toBe('limit-exceeded');
		expect(costing(() => 1)).toBe('no failure');
	});

	test('Infinity from cost exhausts even a disabled budget', () => {
		const F = define({
			args: [],
			returns: t.number(),
			cost: () => Number.POSITIVE_INFINITY,
			run: () => 1,
		});
		const p = program('F()', { functions: { F } });
		expect(codeOf(() => evaluate(p, { limits: { maxSteps: Number.POSITIVE_INFINITY } }))).toBe(
			'limit-exceeded',
		);
	});

	test('results are read against the type at the call', () => {
		const F = define({ args: [], returns: t.var('T'), run: () => 'x' as never });
		expect(codeOf(() => run('F() + 1', { functions: { F } }))).toBe('host-error');
		const G = define({ args: [], returns: t.number(), run: () => Number.NaN });
		expect(codeOf(() => run('G()', { functions: { G } }))).toBe('host-error');
		const H = define({
			args: [],
			returns: t.array(t.number()),
			run: () => [1, undefined as never],
		});
		expect(codeOf(() => run('H()', { functions: { H } }))).toBe('host-error');
	});

	test('a result that throws while read is host-error', () => {
		const F = define({
			args: [],
			returns: t.record({ a: t.number() }),
			run: () =>
				({
					get a(): number {
						throw new Error('no');
					},
				}) as never,
		});
		expect(codeOf(() => run('F().a', { functions: { F } }))).toBe('host-error');
	});

	test('oneOf is checked at the call', () => {
		const F = define({ args: [t.oneOf(['a', 'b'])], returns: t.number(), run: () => 1 });
		expect(run('F(x)', { functions: { F }, variables: { x: 'a' } })).toBe(1);
		expect(codeOf(() => run('F(x)', { functions: { F }, variables: { x: 'c' } }))).toBe(
			'invalid-argument',
		);
	});

	test('an optional argument left out is undefined', () => {
		const F = define({
			args: [t.number(), t.optional(t.number())],
			returns: t.number(),
			run: (a, b) => (b === undefined ? a : a.plus(b)),
		});
		expect(run('F(1)', { functions: { F } })).toBe(1);
		expect(run('F(1, 2)', { functions: { F } })).toBe(3);
	});

	test('once gives one value per evaluation', () => {
		let readings = 0;
		const read = once(() => ++readings);
		const R = define({ args: [], returns: t.number(), run: () => read() });
		const p = program('R() + R()', { functions: { R } });
		expect(evaluate(p)).toBe(2);
		expect(evaluate(p)).toBe(4);
	});
});

describe('budgets', () => {
	test('a loop stops', () => {
		const p = program('for x in 0..1000 into a = 0 then a + x');
		expect(codeOf(() => evaluate(p, { limits: { maxSteps: 100 } }))).toBe('limit-exceeded');
		expect(evaluate(p)).toBe(499500);
	});

	test('Infinity disables the budget', () => {
		const p = program('for x in 0..1000 into a = 0 then a + x');
		expect(evaluate(p, { limits: { maxSteps: Number.POSITIVE_INFINITY } })).toBe(499500);
	});

	test('the budget stops at the result too', () => {
		const p = program('a + a + a + a', { inputs: { a: t.string() } });
		const variables = { a: 'x'.repeat(1000) };
		expect(codeOf(() => evaluate(p, { variables, limits: { maxSteps: 100 } }))).toBe(
			'limit-exceeded',
		);
	});

	test('reading outermost inputs is free, and nested reads are not', () => {
		const data = Array.from({ length: 10_000 }, (_, i) => i);
		const p = program('LEN1(a)', {
			inputs: { a: t.array(t.number()) },
			functions: {
				LEN1: define({ args: [t.array(t.number())], returns: t.number(), run: (a) => a.length }),
			},
		});
		expect(codeOf(() => evaluate(p, { variables: { a: data }, limits: { maxSteps: 100 } }))).toBe(
			'limit-exceeded',
		);

		const q = program('a[0]', { inputs: { a: t.array(t.number()) } });
		expect(evaluate(q, { variables: { a: data }, limits: { maxSteps: 100 } })).toBe(0);
		const inner = q;
		const N = define({
			args: [],
			returns: t.number(),
			run: () => evaluate(inner, { variables: { a: data } }) as number,
		});
		const outer = program('N()', { functions: { N } });
		expect(codeOf(() => evaluate(outer, { limits: { maxSteps: 100 } }))).toBe('limit-exceeded');
		expect(evaluate(outer, { limits: { maxSteps: 100_000 } })).toBe(0);
	});

	test('a nested evaluation runs on what is left, and counts', () => {
		const spin = program('for x in 0..1000 into a = 0 then a + x');
		let caught: unknown;
		const N = define({
			args: [],
			returns: t.number(),
			run: () => {
				try {
					return evaluate(spin) as number;
				} catch (error) {
					caught = error;
					return 1;
				}
			},
		});
		const outer = program('N()', { functions: { N } });
		expect(codeOf(() => evaluate(outer, { limits: { maxSteps: 50 } }))).toBe('limit-exceeded');
		expect((caught as EvaluationError).code).toBe('limit-exceeded');
	});

	test('a lower nested budget is the business of who set it', () => {
		const spin = program('for x in 0..1000 into a = 0 then a + x');
		const N = define({
			args: [],
			returns: t.number(),
			run: () => {
				try {
					return evaluate(spin, { limits: { maxSteps: 10 } }) as number;
				} catch {
					return 1;
				}
			},
		});
		expect(run('N()', { functions: { N } })).toBe(1);

		const P = define({
			args: [],
			returns: t.number(),
			run: () => evaluate(spin, { limits: { maxSteps: 10 } }) as number,
		});
		expect(codeOf(() => run('P()', { functions: { P } }))).toBe('host-error');
	});

	test('budget lost during folding does not become a constant failure', () => {
		const spin = program('for x in 0..1000 into a = 0 then a + x');
		const N = define({
			args: [],
			returns: t.number(),
			pure: true,
			run: () => evaluate(spin) as number,
		});
		const result = compile('N()', { functions: { N }, limits: { maxSteps: 200 } });
		expect(result.ok).toBe(true);
		if (result.ok) expect(evaluate(result.program)).toBe(499500);
	});

	test('a nested compile runs on what is left', () => {
		const C = define({
			args: [],
			returns: t.boolean(),
			run: () => compile(`1${' + 1'.repeat(200)}`).ok,
		});
		expect(codeOf(() => run('C()', { functions: { C }, limits: { maxSteps: 25 } }))).toBe(
			'limit-exceeded',
		);
		expect(run('C()', { functions: { C } })).toBe(true);
	});

	test('one program can be evaluated reentrantly', () => {
		const holder: { program?: Program } = {};
		const R = define({
			args: [t.number()],
			returns: t.number(),
			run: (n) => {
				const value = n.toNumber();
				if (value === 0) return 0;
				return (
					(evaluate(holder.program as Program, { variables: { n: value - 1 } }) as number) + value
				);
			},
		});
		holder.program = program('x = n * 1\nR(x)', { functions: { R } });
		expect(evaluate(holder.program, { variables: { n: 5 } })).toBe(15);
	});
});

describe('locations', () => {
	test('a failure points at its expression', () => {
		try {
			run('x = 1\ny = 2\nx / (y - a)', { variables: { a: 2 } });
			expect.unreachable();
		} catch (error) {
			const { code, start, end } = error as EvaluationError;
			expect(code).toBe('division-by-zero');
			expect(start).toBe(12);
			expect(end).toBe(23);
		}
	});

	test('nothing to point at outside the program', () => {
		try {
			run('a', { inputs: { a: t.number() }, variables: { a: 'x' } });
			expect.unreachable();
		} catch (error) {
			const { start, end } = error as EvaluationError;
			expect([start, end]).toEqual([0, 0]);
		}
		try {
			run('x = 1\na', { inputs: { a: t.number() }, variables: { a: Decimal.from('1e400') } });
			expect.unreachable();
		} catch (error) {
			const { code, start, end } = error as EvaluationError;
			expect(code).toBe('overflow');
			expect([start, end]).toEqual([0, 0]);
		}
	});
});
