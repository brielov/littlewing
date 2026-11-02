import { describe, expect, test } from 'bun:test';
import type { CompileOptions } from '../src/compile.js';
import { compile, evaluate, Program, run } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import { define, defineType, t } from '../src/define.js';
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

function failureOf(body: () => unknown): EvaluationError {
	try {
		body();
	} catch (error) {
		return error as EvaluationError;
	}
	throw new Error('Expected a failure');
}

function program(source: string, options: CompileOptions = {}): Program {
	const result = compile(source, options);
	if (!result.ok) throw new CompileError(result.diagnostics);
	return result.program;
}

/** What one call of a host function costs to compile, whose signature has 102 nodes. */
const CALL_STEPS = 4580;

/** The fewest steps a nested evaluation takes, found by bisection. */
function stepsOf(body: (maxSteps: number) => void): number {
	let low = 0;
	let high = 1 << 24;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (codeOf(() => body(middle)) === 'no failure') high = middle;
		else low = middle + 1;
	}
	return low;
}

/** The steps a program takes when it reads `variables` inside another evaluation. */
function nestedSteps(inner: Program, variables: Record<string, unknown>): number {
	const F = define({
		args: [],
		returns: t.number(),
		run: () => evaluate(inner, { variables }) as number,
	});
	const outer = program('F()', { functions: { F } });
	return stepsOf((maxSteps) => evaluate(outer, { limits: { maxSteps } }));
}

/** The compile budget it takes for folding to reach the end of a program. */
function stepsToFold(source: string): number {
	return stepsOf((maxSteps) => {
		const { diagnostics } = compile(`${source}\nz = 1 / 0\nz`, { limits: { maxSteps } });
		if (!diagnostics.some((diagnostic) => diagnostic.code === 'division-by-zero')) {
			throw new CompileError(diagnostics);
		}
	});
}

describe('reading at a generic position', () => {
	test('a value is read once, and the copy is what was checked', () => {
		let reads = 0;
		const variables = {
			a: {
				get x(): unknown {
					reads++;
					return reads === 1 ? true : { evil: 1 };
				},
			},
		};
		const result = evaluate(program('a'), { variables }) as Record<string, unknown>;
		expect(result.x).toBe(true);
		expect(reads).toBe(1);
	});

	test('sharing survives', () => {
		const shared = [1];
		let same = false;
		const G = define({
			args: [t.var('T')],
			returns: t.boolean(),
			run: (value) => {
				const pair = value as readonly unknown[];
				same = pair[0] === pair[1];
				return same;
			},
		});
		run('G(a)', { functions: { G }, variables: { a: [shared, shared] } });
		expect(same).toBe(true);
	});

	test('a tower of shared arrays is walked once per object', () => {
		let tower: unknown = [1];
		for (let i = 0; i < 200; i++) tower = [tower, tower];
		expect(evaluate(program('x = a\n1'), { variables: { a: tower } })).toBe(1);
	});

	test('a type repeated across an array is merged once per pair', () => {
		const record = (value: number): Record<string, number> =>
			Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`f${i}`, value]));
		const first = record(1);
		const second = record(2);
		const a = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? first : second));
		expect(nestedSteps(program('x = a\n1'), { a })).toBeLessThan(10_000);

		const nest = (value: number): unknown => {
			let nested: unknown = value;
			for (let i = 0; i < 250; i++) nested = [nested];
			return nested;
		};
		const left = nest(1);
		const right = nest(2);
		const b = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? left : right));
		expect(nestedSteps(program('x = a\n1'), { a: b })).toBeLessThan(20_000);
	});

	test('a cycle is past the limit at once', () => {
		const cycle: unknown[] = [];
		cycle.push(cycle, cycle);
		const error = failureOf(() => evaluate(program('x = a\n1'), { variables: { a: cycle } }));
		expect(error.code).toBe('invalid-input');
		expect(error.message).toContain('itself');
	});

	test('reads are charged for every field and character, a shared object once', () => {
		const inner = program('x = a\n1');
		const fields = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`f${i}`, i]));
		const characters = Object.keys(fields).join('').length;
		expect(nestedSteps(inner, { a: fields })).toBeGreaterThan(500 + characters);

		const shared = Array.from({ length: 100 }, (_, i) => i);
		const once = nestedSteps(inner, { a: [shared] });
		const twice = nestedSteps(inner, { a: [shared, shared] });
		expect(twice).toBeLessThan(once + 10);
	});

	test('a nested read pays for all it walks', () => {
		const generic = program('x = a\n1');
		const list = Array.from({ length: 1000 }, () => true);
		expect(nestedSteps(generic, { a: list })).toBeGreaterThanOrEqual(1000);
		expect(nestedSteps(generic, { a: 'x'.repeat(10_000) })).toBeGreaterThanOrEqual(10_000);

		const open = program('a.x', { inputs: { a: t.openRecord({ x: t.number() }) } });
		const unread = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`f${i}`, i]));
		expect(nestedSteps(open, { a: { ...unread, x: 1 } })).toBeGreaterThanOrEqual(1000);

		const typed = Object.fromEntries(
			Array.from({ length: 1000 }, (_, i) => [`f${i}`, t.optional(t.number())]),
		);
		const closed = program('x = a\n1', { inputs: { a: t.record(typed) } });
		expect(nestedSteps(closed, { a: {} })).toBeGreaterThanOrEqual(1000);
	});

	test('what an array holds counts toward its class', () => {
		const date = defineType<Date>({ name: 'date', is: (value) => value instanceof Date });
		const p = program('a == b', { types: [date] });
		const now = new Date();
		const code = (a: unknown, b: unknown): EvaluationError =>
			failureOf(() => evaluate(p, { variables: { a, b } }));
		expect(code(now, now).code).toBe('invalid-input');
		expect(code([now], [now]).code).toBe('invalid-input');
		expect(code([now], [now]).start).toBe(0);
		expect(code({ x: now }, { x: now }).code).toBe('invalid-input');
		expect(code({ x: [now] }, { x: [now] }).code).toBe('invalid-input');
	});

	test('undefined is not a value, even one a test accepts', () => {
		const nil = defineType<unknown>({ name: 'nil', is: (value) => value == null });
		const F = define({ args: [], returns: t.var('T'), run: () => undefined as never });
		const options = { functions: { F }, types: [nil] };
		expect(codeOf(() => run('F()', options))).toBe('host-error');
		expect(codeOf(() => run('x = F()\n[x]', options))).toBe('host-error');
	});

	test('a field name has no unpaired surrogates', () => {
		expect(codeOf(() => evaluate(program('a'), { variables: { a: { '\ud800': 1 } } }))).toBe(
			'invalid-input',
		);
	});

	test('a value past the limits of a type is rejected', () => {
		const wide = (length: number): Record<string, number> =>
			Object.fromEntries(Array.from({ length }, (_, i) => [`f${i}`, 1]));
		expect(codeOf(() => evaluate(program('a'), { variables: { a: wide(70_000) } }))).toBe(
			'invalid-input',
		);

		let deep: unknown = 1;
		for (let i = 0; i < 300; i++) deep = [deep];
		expect(codeOf(() => evaluate(program('a'), { variables: { a: deep } }))).toBe('invalid-input');
	});

	test('a value passing two tests has no single type', () => {
		const one = defineType<Date>({ name: 'one', is: (value) => value instanceof Date });
		const two = defineType<Date>({ name: 'two', is: (value) => value instanceof Date });
		const p = program('x = a\n1', { types: [one, two] });
		const error = failureOf(() => evaluate(p, { variables: { a: new Date() } }));
		expect(error.code).toBe('invalid-input');
		expect(error.message).toContain('more than one');
	});

	test('the limits are exact', () => {
		const wide = (length: number): Record<string, number> =>
			Object.fromEntries(Array.from({ length }, (_, i) => [`f${i}`, 1]));
		const nest = (levels: number): unknown => {
			let value: unknown = 1;
			for (let i = 0; i < levels; i++) value = [value];
			return value;
		};
		const bare = program('a');
		const reads = (a: unknown): string => codeOf(() => evaluate(bare, { variables: { a } }));
		// A record is one more than its fields, and a leaf is 1
		expect(reads(wide(65_535))).toBe('no failure');
		expect(reads(wide(65_536))).toBe('invalid-input');
		expect(reads(nest(255))).toBe('no failure');
		expect(reads(nest(256))).toBe('invalid-input');

		const inArray = { inputs: { a: t.array(t.var('T')) } };
		const held = (a: unknown): string => codeOf(() => run('a', { ...inArray, variables: { a } }));
		expect(held([wide(65_534)])).toBe('no failure');
		expect(held([wide(65_535)])).toBe('invalid-input');
		expect(held([nest(254)])).toBe('no failure');
		expect(held([nest(255)])).toBe('invalid-input');
	});

	test('objects already read cannot be stacked past the limit', () => {
		// Each input is shallow where it is read, as the one before it is already known
		const wrap = (value: unknown): unknown => {
			let wrapped = value;
			for (let i = 0; i < 250; i++) wrapped = [wrapped];
			return wrapped;
		};
		const variables: Record<string, unknown> = { p0: wrap(1), q0: wrap(2) };
		let source = 'a0 = p0\nb0 = q0\n';
		for (let i = 1; i <= 240; i++) {
			variables[`p${i}`] = wrap(variables[`p${i - 1}`]);
			variables[`q${i}`] = wrap(variables[`q${i - 1}`]);
			source += `a${i} = p${i}\nb${i} = q${i}\n`;
		}
		const p = program(`${source}c = [p240, q240]\n1`);
		const error = failureOf(() => evaluate(p, { variables }));
		expect(error.code).toBe('invalid-input');
		expect(error.message).toContain('too deep');
	});

	test('a value far too deep is a mistake in the value, not a stack that ran out', () => {
		let deep: unknown = 1;
		for (let i = 0; i < 100_000; i++) deep = [deep];
		expect(codeOf(() => evaluate(program('a'), { variables: { a: deep } }))).toBe('invalid-input');
	});

	test('a function result is held to the limits', () => {
		let type = t.var('T');
		let value: unknown = 1;
		for (let i = 0; i < 100; i++) value = [value];
		const fine = value;
		for (let i = 0; i < 200; i++) {
			type = t.array(type) as typeof type;
			value = [value];
		}
		const F = define({ args: [], returns: type, run: () => value as never });
		expect(codeOf(() => run('F()', { functions: { F } }))).toBe('host-error');
		const G = define({ args: [], returns: t.var('T'), run: () => fine as never });
		expect(codeOf(() => run('G()', { functions: { G } }))).toBe('no failure');
	});

	test('a later input can put an earlier one past the limits', () => {
		const nested = (element: ReturnType<typeof t.var>, levels: number) => {
			let type = element;
			for (let i = 0; i < levels; i++) type = t.array(type) as typeof type;
			return type;
		};
		const T = t.var('T');
		const inputs = { a: nested(T, 200), b: T };
		let deep: unknown = 1;
		for (let i = 0; i < 100; i++) deep = [deep];
		const first = codeOf(() => run('x = a\ny = b\n1', { inputs, variables: { a: [], b: deep } }));
		const second = codeOf(() => run('y = b\nx = a\n1', { inputs, variables: { a: [], b: deep } }));
		expect(first).toBe('invalid-input');
		expect(second).toBe('invalid-input');

		// A result at the same type gets the same answer as an input
		const R = define({ args: [], returns: inputs.a, run: () => [] as never });
		const source = 'y = b\nx = R()\nz = [x, a]\n1';
		const options = { functions: { R }, inputs: { a: inputs.a, b: T } };
		expect(codeOf(() => run(source, { ...options, variables: { a: [[]], b: deep } }))).toBe(
			'invalid-input',
		);
		expect(
			codeOf(() => run('y = b\nR()', { functions: { R }, inputs: { b: T }, variables: { b: 1 } })),
		).toBe('no failure');
	});

	test('a uniform record counts toward the limits', () => {
		let type = t.var('T');
		for (let i = 0; i < 200; i++) type = t.array(type) as typeof type;
		let value: unknown = 1;
		for (let i = 0; i < 260; i++) value = [value];
		// 200 typed levels, then a value of 60 levels and a leaf, in a record
		const inputs = { a: t.uniformRecord(type) };
		expect(codeOf(() => run('x = a\n1', { inputs, variables: { a: { k: value } } }))).toBe(
			'invalid-input',
		);
	});

	test('what surrounds a generic position counts toward the limits', () => {
		let declared = t.var('T');
		let value: unknown = 1;
		for (let i = 0; i < 100; i++) value = [value];
		const fine = value;
		for (let i = 0; i < 200; i++) {
			declared = t.array(declared) as typeof declared;
			value = [value];
		}
		expect(codeOf(() => run('a', { inputs: { a: declared }, variables: { a: value } }))).toBe(
			'invalid-input',
		);
		expect(codeOf(() => evaluate(program('a'), { variables: { a: fine } }))).toBe('no failure');

		// One variable in two places is written out twice
		const twice = { a: t.record({ x: t.var('T'), y: t.var('T') }) };
		const wide = (length: number): Record<string, number> =>
			Object.fromEntries(Array.from({ length }, (_, i) => [`f${i}`, 1]));
		const sized = (length: number): string => {
			const a = { x: wide(length), y: wide(length) };
			return codeOf(() => run('a', { inputs: twice, variables: { a } }));
		};
		expect(sized(40_000)).toBe('invalid-input');
		expect(sized(30_000)).toBe('no failure');
	});

	test('the limits do not depend on the order of fields or on sharing', () => {
		let o: unknown = [1];
		for (let i = 0; i < 253; i++) o = [o];
		const copy = structuredClone(o);
		const p = program('a = i.p\nb = i.q[0]\nc = if k then a else b\nd = for e in c then e\nd');
		const outcome = (i: unknown): string =>
			codeOf(() => evaluate(p, { variables: { i, k: true } }));
		const inOrder = outcome({ p: o, q: [copy] });
		expect(outcome({ p: o, q: [o] })).toBe(inOrder);
		expect(outcome({ q: [o], p: o })).toBe(inOrder);

		// `[]` at the very bottom is one level deeper than its elements would be
		const nest = (bottom: unknown): unknown => {
			let value = bottom;
			for (let i = 0; i < 254; i++) value = [value];
			return value;
		};
		const empty: unknown[] = [];
		const separate = codeOf(() => evaluate(program('a'), { variables: { a: nest([[], []]) } }));
		const shared = codeOf(() => evaluate(program('a'), { variables: { a: nest([empty, empty]) } }));
		expect(separate).toBe('invalid-input');
		expect(shared).toBe('invalid-input');
	});
});

describe('reading at a known type', () => {
	test('a required field has to be there, an optional one does not', () => {
		const inputs = { a: t.record({ x: t.number(), y: t.optional(t.number()) }) };
		const missing = failureOf(() => run('a', { inputs, variables: { a: { y: 1 } } }));
		expect(missing.code).toBe('invalid-input');
		expect(missing.message).toContain('Missing field x');
		expect(codeOf(() => run('a', { inputs, variables: { a: { x: 1 } } }))).toBe('no failure');
		const open = { a: t.openRecord({ x: t.number() }) };
		expect(codeOf(() => run('a', { inputs: open, variables: { a: {} } }))).toBe('invalid-input');
	});

	test('a string has no unpaired surrogates, coming in or back', () => {
		const inputs = { a: t.string() };
		expect(codeOf(() => run('a', { inputs, variables: { a: 'x\ud800' } }))).toBe('invalid-input');
		expect(run('a', { inputs, variables: { a: 'x\u{1f600}' } })).toBe('x\u{1f600}');
		const F = define({ args: [], returns: t.string(), run: () => '\ud800' });
		expect(codeOf(() => run('F()', { functions: { F } }))).toBe('host-error');
	});

	test('undefined is not a value of a type whose test accepts it', () => {
		const nil = defineType<unknown>({ name: 'nil', is: (value) => value == null });
		const F = define({ args: [], returns: nil, run: () => undefined });
		expect(codeOf(() => run('F()', { functions: { F } }))).toBe('host-error');
		const G = define({ args: [], returns: nil, run: () => null });
		expect(run('G()', { functions: { G } })).toBe(null);
	});

	test('unread fields are carried as they are, whatever they are', () => {
		const list = [1, 2];
		const a = { x: 1, number: 2.5, list };
		const result = run('{ ...a, y: a.x + 1 }', { variables: { a }, numbers: 'decimal' }) as Record<
			string,
			unknown
		>;
		expect(result.number).toBe(2.5);
		expect(result.list).toBe(list);
		expect(result.x).toEqual(Decimal.from(1));
		expect(result.y).toEqual(Decimal.from(2));
	});

	test('one object is read once, and comes out one object', () => {
		let reads = 0;
		const shared = {
			get x(): number {
				reads++;
				return 1;
			},
		};
		const inputs = { a: t.array(t.record({ x: t.number() })) };
		const result = run('a', { inputs, variables: { a: [shared, shared] } }) as object[];
		expect(reads).toBe(1);
		expect(result[0]).toBe(result[1] as object);

		const inner = [1];
		const nested = { a: t.array(t.array(t.number())) };
		const lists = run('a', { inputs: nested, variables: { a: [inner, inner] } }) as number[][];
		expect(lists[0]).toBe(lists[1] as number[]);
	});
});

describe('throws during a read', () => {
	const throwing = (thrown: () => unknown): object => ({
		get x(): unknown {
			throw thrown();
		},
	});
	const P = define({
		args: [],
		returns: t.record({ x: t.number() }),
		run: () => throwing(() => new Error('no')) as never,
	});

	test('keep the code of the crossing, whatever was thrown', () => {
		const p = program('a.x + 1');
		for (const thrown of [
			() => new Error('no'),
			() => new RangeError('no'),
			() => failureOf(() => Decimal.from(1).div(0)),
		]) {
			expect(codeOf(() => evaluate(p, { variables: { a: throwing(thrown) } }))).toBe(
				'invalid-input',
			);
			const F = define({
				args: [],
				returns: t.record({ x: t.number() }),
				run: () => throwing(thrown) as never,
			});
			expect(codeOf(() => run('F().x', { functions: { F } }))).toBe('host-error');
		}
		expect(codeOf(() => run('P().x', { functions: { P } }))).toBe('host-error');
	});

	test('throwing undefined is still a throw', () => {
		const a = throwing(() => undefined);
		expect(codeOf(() => evaluate(program('a.x + 1'), { variables: { a } }))).toBe('invalid-input');

		const F = define({
			args: [],
			returns: t.record({ x: t.number() }),
			run: () => a as never,
		});
		const error = failureOf(() => run('y = 1\nF().x', { functions: { F } }));
		expect(error.code).toBe('host-error');
		expect(error.start).toBe(6);

		const G = define({
			args: [],
			returns: t.record({ x: t.number() }),
			pure: true,
			run: () => a as never,
		});
		expect(compile('G().x', { functions: { G } }).diagnostics[0]?.code).toBe('host-error');
		expect(compile('if c then G().x else 1', { functions: { G } }).ok).toBe(true);
	});

	test('the stack running out while reading is a limit', () => {
		const recurse = (): number => recurse() + 1;
		const a = {
			get x(): number {
				return recurse();
			},
		};
		expect(codeOf(() => evaluate(program('a.x'), { variables: { a } }))).toBe('limit-exceeded');
	});

	test('a missing input still comes first', () => {
		const variables = {
			get a(): number {
				throw new Error('no');
			},
		};
		expect(codeOf(() => evaluate(program('a + b'), { variables }))).toBe('missing-input');
	});

	test('messages hold no host value, and the cause keeps what was thrown', () => {
		const secret = 'SECRET';
		const check = (body: () => unknown): void => {
			expect(failureOf(body).message).not.toContain(secret);
		};
		const thrower = (thrown: unknown) =>
			define({
				args: [],
				returns: t.number(),
				run: () => {
					throw thrown;
				},
			});
		check(() => run('F()', { functions: { F: thrower(secret) } }));
		check(() => run('F()', { functions: { F: thrower(new Error(secret)) } }));
		check(() => run('F()', { functions: { F: thrower({ toString: () => secret }) } }));
		check(() => evaluate(program('a.x'), { variables: { a: throwing(() => secret) } }));
		const closed = { inputs: { a: t.record({}) }, variables: { a: { [secret]: 1 } } };
		check(() => run('a', closed));
		check(() => run('[1][a]', { variables: { a: 1.5 } }));

		const cause = new Error(secret);
		const error = failureOf(() => run('F()', { functions: { F: thrower(cause) } }));
		expect((error as Error & { cause: unknown }).cause).toBe(cause);
	});

	test('a thrown Proxy with traps of its own changes nothing', () => {
		const trap = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw 'from the trap';
				},
			},
		);
		const F = define({
			args: [],
			returns: t.number(),
			pure: true,
			run: () => {
				throw trap;
			},
		});
		const result = compile('F()', { functions: { F } });
		expect(result.diagnostics[0]?.code).toBe('host-error');
		const G = define({
			args: [],
			returns: t.number(),
			run: () => {
				throw trap;
			},
		});
		expect(codeOf(() => run('G()', { functions: { G } }))).toBe('host-error');
		const a = {
			get x(): number {
				throw trap;
			},
		};
		expect(codeOf(() => evaluate(program('a.x'), { variables: { a } }))).toBe('invalid-input');
	});
});

describe('absent fields', () => {
	const F = define({
		args: [],
		returns: t.record({ a: t.optional(t.number()) }),
		run: () => ({}),
	});

	test('reading one is a missing value, where the read is', () => {
		const error = failureOf(() => run('x = 1\nF().a', { functions: { F } }));
		expect(error.code).toBe('missing-value');
		expect([error.start, error.end]).toEqual([6, 11]);
		expect(run('r = F()\nr.a ?? 2', { functions: { F } })).toBe(2);
	});

	test('the schema and the check agree', () => {
		const p = program('x = if c then a else F()\nx.a', { functions: { F } });
		expect(p.inputs.a?.type).toMatchObject({ kind: 'record' });
		const type = p.inputs.a?.type as { fields: Record<string, { required: boolean }> };
		const { fields } = type;
		expect(fields.a?.required).toBe(false);
		const failure = failureOf(() => evaluate(p, { variables: { a: {}, c: true } }));
		expect(failure.code).toBe('missing-value');
		expect(evaluate(p, { variables: { a: { a: 1 }, c: true } })).toBe(1);
	});
});

describe('budgets', () => {
	const spin = (): Program => program('for x in 0..1000 into a = 0 then a + x');

	test('a rope as a key pays for being read', () => {
		let source = 's0 = "abcdefghijklmnop"\n';
		for (let i = 1; i <= 16; i++) source += `s${i} = s${i - 1} + s${i - 1}\n`;
		source += 'for i in 0..20000 into acc = 0 then acc + (r[s16 + "x"] ?? 1)';
		const p = program(source, { inputs: { r: t.uniformRecord(t.number()) } });
		const variables = { r: {} };
		expect(codeOf(() => evaluate(p, { variables, limits: { maxSteps: 1_500_000 } }))).toBe(
			'limit-exceeded',
		);
	});

	test('a lower nested budget costs what it allowed, however far it overran', () => {
		const huge = program('0..100000000');
		const F = define({
			args: [],
			returns: t.number(),
			run: () => {
				try {
					return evaluate(huge, { limits: { maxSteps: 1000 } }) as number;
				} catch {
					return 1;
				}
			},
		});
		expect(run('x = F()\nx + 1', { functions: { F } })).toBe(2);

		const costly = define({ args: [], returns: t.number(), cost: () => 1e12, run: () => 1 });
		const inner = program('C()', { functions: { C: costly } });
		const G = define({
			args: [],
			returns: t.number(),
			run: () => {
				try {
					return evaluate(inner, { limits: { maxSteps: 1000 } }) as number;
				} catch {
					return 1;
				}
			},
		});
		expect(run('x = G()\nx + 1', { functions: { G } })).toBe(2);
	});

	test('running out in host code stays that, whatever the host does next', () => {
		const inner = spin();
		const exhaust = (): void => {
			try {
				evaluate(inner);
			} catch {
				// Caught, and the budget is still gone
			}
		};
		const limits = { maxSteps: 100 };
		const check = (source: string, options: CompileOptions): void => {
			const p = program(source, options);
			expect(codeOf(() => evaluate(p, { limits }))).toBe('limit-exceeded');
		};

		const junk = define({
			args: [],
			returns: t.number(),
			run: () => {
				exhaust();
				return 'junk' as never;
			},
		});
		check('J()', { functions: { J: junk } });

		const junkCost = define({
			args: [],
			returns: t.number(),
			cost: () => {
				exhaust();
				return -1;
			},
			run: () => 1,
		});
		check('J()', { functions: { J: junkCost } });

		const value = {};
		const hooked = defineType<object>({
			name: 'h',
			is: (candidate) => candidate === value,
			equals: () => {
				exhaust();
				return 1 as never;
			},
		});
		const M = define({ args: [], returns: hooked, run: () => value });
		check('M() == M()', { functions: { M } });
	});

	test('Infinity from cost exhausts a nested budget too', () => {
		const F = define({
			args: [],
			returns: t.number(),
			cost: () => Number.POSITIVE_INFINITY,
			run: () => 1,
		});
		const inner = program('F()', { functions: { F } });
		const N = define({
			args: [],
			returns: t.number(),
			run: () => evaluate(inner) as number,
		});
		expect(codeOf(() => run('N()', { functions: { N } }))).toBe('limit-exceeded');

		// Under a disabled budget the default one is lower, so its end is the host's to see
		const limits = { maxSteps: Number.POSITIVE_INFINITY };
		expect(codeOf(() => run('N()', { functions: { N }, limits }))).toBe('host-error');

		// With both disabled there is one budget, and it stays used up
		const M = define({
			args: [],
			returns: t.number(),
			run: () => {
				try {
					return evaluate(inner, { limits }) as number;
				} catch {
					return 1;
				}
			},
		});
		expect(codeOf(() => run('M()', { functions: { M }, limits }))).toBe('limit-exceeded');
		expect(run('1 + 1')).toBe(2);
	});

	test('reads under a budget pay for tests and field names', () => {
		class Thing {}
		const thing = defineType<Thing>({ name: 'thing', is: (value) => value instanceof Thing });
		const things = Array.from({ length: 100 }, () => new Thing());
		const F = define({
			args: [],
			returns: t.array(thing),
			run: () => things,
		});
		const p = program('F()', { functions: { F } });
		expect(stepsOf((maxSteps) => evaluate(p, { limits: { maxSteps } }))).toBeGreaterThan(1600);

		const named = program('a.x', { inputs: { a: t.uniformRecord(t.number()) } });
		const key = 'k'.repeat(10_000);
		const N = define({
			args: [],
			returns: t.number(),
			run: () => evaluate(named, { variables: { a: { [key]: 1, x: 2 } } }) as number,
		});
		const outer = program('N()', { functions: { N } });
		expect(stepsOf((maxSteps) => evaluate(outer, { limits: { maxSteps } }))).toBeGreaterThan(
			10_000,
		);
	});

	test('a large optional record type is worked out once per crossing', () => {
		const fields = Object.fromEntries(
			Array.from({ length: 30_000 }, (_, i) => [`f${i}`, t.optional(t.number())]),
		);
		const F = define({
			args: [],
			returns: t.array(t.record(fields)),
			run: () => Array.from({ length: 2000 }, () => ({})) as never,
		});
		const p = program('F()', { functions: { F } });
		expect(stepsOf((maxSteps) => evaluate(p, { limits: { maxSteps } }))).toBeLessThan(100_000);
	});

	test('folding pays for walking a type, once however often it comes up', () => {
		const fields = Array.from({ length: 2000 }, (_, i) => `a${i}: x`).join(', ');
		const base = `x = 0 + y\nr = { ${fields} }`;
		const none = stepsToFold(base);
		const once = stepsToFold(`${base}\nq = r == r`);
		const often = stepsToFold(`${base}\n${'r == r\n'.repeat(1000)}q = r == r`);
		expect(often - once).toBeLessThan(200_000);
		expect(once).toBeGreaterThan(none);

		// Each new type around the record costs the same either way, so only the fold differs
		const joined = stepsToFold(`${base}\nq = [r] + [r]`);
		const built = stepsToFold(`${base}\nq = [r]\np = [r]`);
		expect(joined - built).toBeGreaterThanOrEqual(2000);
	});

	test('folding pays for walking a type it cannot keep', () => {
		const held = defineType<object>({ name: 'held', is: (value) => typeof value === 'object' });
		const fields = Object.fromEntries(
			Array.from({ length: 2000 }, (_, i) => [`f${i}`, t.number()]),
		);
		const value = { ...Object.fromEntries(Object.keys(fields).map((key) => [key, 1])), z: {} };
		const MAKE = define({
			args: [],
			returns: t.record({ ...fields, z: held }),
			pure: true,
			run: () => value as never,
		});
		const functions = { MAKE };
		const steps = (source: string): number =>
			stepsOf((maxSteps) => {
				const { diagnostics } = compile(`${source}\nz = 1 / 0\nz`, {
					functions,
					limits: { maxSteps },
				});
				if (!diagnostics.some((diagnostic) => diagnostic.code === 'division-by-zero')) {
					throw new CompileError(diagnostics);
				}
			});
		const none = steps('r = MAKE()');
		expect(steps('r = MAKE()\nq = [r]') - none).toBeGreaterThanOrEqual(2000);

		// Reading an existing type back makes no new one for the checker to pay for
		const reads = 'r = MAKE()\ns = { big: r }\ns.big';
		expect(steps(`${reads}\ns.big`) - steps(reads)).toBeGreaterThanOrEqual(2000);
	});

	test('folding pays for walking what it might keep', () => {
		const strings = Array.from({ length: 2000 }, () => '"x"').join(', ');
		const list = `a = [${strings}]`;
		const none = stepsToFold(list);
		expect(stepsToFold(`${list}\nq = [a]`) - none).toBeGreaterThanOrEqual(4000);

		const fields = Array.from({ length: 2000 }, (_, i) => `a${i}: 1`).join(', ');
		const record = `r = { ${fields} }`;
		const bare = stepsToFold(record);
		expect(stepsToFold(`${record}\nq = [r]`) - bare).toBeGreaterThanOrEqual(6000);
	});

	describe('signatures', () => {
		// Fields that are records themselves, which is what costs: a number allocates nothing
		const fields = Object.fromEntries(
			Array.from({ length: 100 }, (_, i) => [`f${i}`, t.openRecord({})]),
		);
		const record = t.record(fields);
		const F = define({ args: [record], returns: t.number(), run: () => 1 });
		const G = define({
			overloads: [
				{ args: [record], returns: t.number() },
				{ args: [t.array(record)], returns: t.number() },
			],
			run: () => 1,
		});
		const functions = { F, G };

		/** The compile budget a program takes, found by bisection. */
		const stepsToCompile = (source: string): number =>
			stepsOf((maxSteps) => {
				const result = compile(source, { functions, limits: { maxSteps } });
				if (!result.ok) throw new CompileError(result.diagnostics);
			});

		test('a call pays for what its signature allocates, each time', () => {
			const call = stepsToCompile('F(a)\nF(b)\n1') - stepsToCompile('F(a)\n1');
			expect(call).toBe(CALL_STEPS);
		});

		test('trying an overload builds its parameters once, however often it is tried', () => {
			const once = stepsToCompile('G(a)\nG(b)\n1') - stepsToCompile('G(a)\n1');
			const again = stepsToCompile('G(a)\nG(b)\nG(c)\n1') - stepsToCompile('G(a)\nG(b)\n1');
			// A second build of the parameters would cost two signatures at 32 steps a node
			expect(again - once).toBeLessThan(1000);
		});
	});

	test('a type pays to be written out', () => {
		const a = t.record({ x: t.record({ y: t.record({ z: t.number() }) }) });
		const steps = (source: string): number =>
			stepsOf((maxSteps) => {
				const result = compile(source, { inputs: { a }, limits: { maxSteps } });
				if (!result.ok) throw new CompileError(result.diagnostics);
			});
		const read = steps('a.x.y.z');
		const none = steps('1');
		// Four types, at 8 steps each, on top of the rest of the program
		expect(read - none).toBe(75);
	});

	test('comparing records pays for reading their keys', () => {
		const fields = Object.fromEntries(
			Array.from({ length: 500 }, (_, i) => [`f${i}`, t.optional(t.number())]),
		);
		const p = program('a == b', {
			inputs: { a: t.record(fields), b: t.record(fields) },
		});
		const a = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`f${i}`, i]));
		const steps = stepsOf((maxSteps) =>
			evaluate(p, { variables: { a, b: {} }, limits: { maxSteps } }),
		);
		expect(steps).toBeGreaterThanOrEqual(500);
	});

	test('a hook and the test of what it returned each pay', () => {
		const value = {};
		const thing = defineType<object>({
			name: 'thing',
			is: (candidate) => candidate === value,
			add: (first) => first,
		});
		const p = program('a + b', { inputs: { a: thing, b: thing } });
		const variables = { a: value, b: value };
		const steps = stepsOf((maxSteps) => evaluate(p, { variables, limits: { maxSteps } }));
		expect(steps).toBeGreaterThanOrEqual(32);
	});

	test('a result pays for its size, for the walk and for the copy', () => {
		const p = program('a', { inputs: { a: t.array(t.number()) } });
		const a = Array.from({ length: 1000 }, (_, i) => i);
		const steps = stepsOf((maxSteps) => evaluate(p, { variables: { a }, limits: { maxSteps } }));
		expect(steps).toBeGreaterThanOrEqual(3000);

		const q = program('a', { inputs: { a: t.uniformRecord(t.number()) } });
		const fields = Object.fromEntries(a.map((value) => [`f${value}`, value]));
		const paid = stepsOf((maxSteps) =>
			evaluate(q, { variables: { a: fields }, limits: { maxSteps } }),
		);
		expect(paid).toBeGreaterThanOrEqual(3000);
	});

	test('a function pays for the size of what it takes and gives', () => {
		const list = Array.from({ length: 1000 }, (_, i) => i);
		const type = t.array(t.number());
		const TAKE = define({ args: [type], returns: t.number(), run: () => 1 });
		const taking = program('TAKE(a)', { functions: { TAKE }, inputs: { a: type } });
		const variables = { a: list };
		const took = stepsOf((maxSteps) => evaluate(taking, { variables, limits: { maxSteps } }));
		expect(took).toBeGreaterThanOrEqual(3000);

		const GIVE = define({ args: [], returns: type, run: () => list });
		const giving = program('x = GIVE()\n1', { functions: { GIVE } });
		const gave = stepsOf((maxSteps) => evaluate(giving, { limits: { maxSteps } }));
		expect(gave).toBeGreaterThanOrEqual(3000);
	});

	test('an unmeasured budget is never a constant failure', () => {
		const N = define({
			args: [],
			returns: t.number(),
			pure: true,
			run: () => evaluate(spin()) as number,
		});
		const result = compile('N()', { functions: { N }, limits: { maxSteps: 300 } });
		expect(result.diagnostics.filter((d) => d.code === 'host-error')).toEqual([]);
	});

	test('the location of a limit is the expression that hit it', () => {
		const p = program('x = a / 3\ny = [x, x, x, x, x, x, x, x, x, x]\n{ y, x }');
		const variables = { a: 1 };
		const total = stepsOf((maxSteps) => evaluate(p, { variables, limits: { maxSteps } }));
		const inResult = failureOf(() => evaluate(p, { variables, limits: { maxSteps: total - 1 } }));
		expect([inResult.start, inResult.end]).toEqual([0, 0]);

		const places = new Set<string>();
		for (let maxSteps = 0; maxSteps < total; maxSteps++) {
			const { start, end, code } = failureOf(() =>
				evaluate(p, { variables, limits: { maxSteps } }),
			);
			expect(code).toBe('limit-exceeded');
			places.add(`${start}-${end}`);
		}
		// The array and record literals answer for themselves, not for what came before
		expect(places).toContain('14-44');
		expect(places).toContain('45-53');
	});
});

describe('abstract values inside other values', () => {
	const near = defineType<number>({
		name: 'near',
		is: (value) => typeof value === 'number',
		equals: (a, b) => Math.abs(a - b) < 1,
	});
	const inputs = { a: near, b: near };
	const variables = { a: 1, b: 1.5 };

	test('use their equals at any depth', () => {
		expect(run('a == b', { inputs, variables })).toBe(true);
		expect(run('[a] == [b]', { inputs, variables })).toBe(true);
		expect(run('[[a]] == [[b]]', { inputs, variables })).toBe(true);
		expect(run('{ x: a } == { x: b }', { inputs, variables })).toBe(true);
		expect(run('{ x: [{ y: a }] } == { x: [{ y: b }] }', { inputs, variables })).toBe(true);
		expect(run('[a] != [b]', { inputs, variables })).toBe(false);
	});

	test('are not walked, whatever they are made of', () => {
		const pair = defineType<readonly number[]>({
			name: 'pair',
			is: (value) => Array.isArray(value),
			equals: () => true,
		});
		const options = { inputs: { a: pair, b: pair }, variables: { a: [1], b: [2, 3] } };
		expect(run('[a] == [b]', options)).toBe(true);
		expect(run('{ x: a } == { x: b }', options)).toBe(true);
	});
});

describe('programs keep nothing they do not need', () => {
	/** How many runs it takes to tell a leak from what the collector finds on the stack. */
	const RUNS = 20;

	/** Compile many times, and report whether what folding made outlives it. */
	function retained(source: string): boolean {
		const holder = defineType<object>({ name: 'held', is: (value) => typeof value === 'object' });
		const refs: WeakRef<object>[] = [];
		const MAKE = define({
			args: [],
			returns: holder,
			pure: true,
			run: () => {
				const made = {};
				refs.push(new WeakRef(made));
				return made;
			},
		});
		const USE = define({ args: [holder], returns: t.number(), run: () => 1 });
		const ID = define({ args: [holder], returns: holder, pure: true, run: (value) => value });
		const results = Array.from({ length: RUNS }, () =>
			compile(source, { functions: { MAKE, USE, ID } }),
		);
		Bun.gc(true);
		expect(results.every((result) => result.ok)).toBe(true);
		expect(refs.length).toBe(RUNS);
		return refs.filter((ref) => ref.deref() !== undefined).length > RUNS / 2;
	}

	test('constants that were not kept are dropped', () => {
		expect(retained('USE(MAKE())')).toBe(false);
		expect(retained('MAKE() |> USE')).toBe(false);
		expect(retained('x = MAKE()\nUSE(x)')).toBe(false);
		expect(retained('ID(MAKE())')).toBe(false);
		expect(retained('if c then USE(MAKE()) else 2')).toBe(false);
	});

	test('a program does not hold on to its compiler', () => {
		const F = define({ args: [t.array(t.number())], returns: t.number(), run: () => 1 });
		/** A function no program calls is held by the compiler and nothing else. */
		const compilerSurvives = (source: string): boolean => {
			const refs: WeakRef<object>[] = [];
			const results = Array.from({ length: RUNS }, () => {
				const UNUSED = define({ args: [], returns: t.number(), run: () => 1 });
				refs.push(new WeakRef(UNUSED));
				return compile(source, { functions: { F, UNUSED } });
			});
			Bun.gc(true);
			expect(results.every((result) => result.ok)).toBe(true);
			return refs.filter((ref) => ref.deref() !== undefined).length > RUNS / 2;
		};
		expect(compilerSurvives('a = 1 + x\nb = [a, 2]\nF(b) + 1')).toBe(false);
		expect(compilerSurvives('r = { a: x }\nr.a + 1')).toBe(false);
		expect(compilerSurvives('[x] |> F(?)')).toBe(false);
		expect(compilerSurvives('[x] |> F')).toBe(false);
		expect(compilerSurvives('for i in xs then i + 1')).toBe(false);
	});

	test('a long literal is not a default', () => {
		const text = 'x'.repeat(2000);
		expect(program(`a ?= "${text}"\na`).inputs.a?.default).toBeUndefined();
		const short = 'x'.repeat(1000);
		expect(program(`a ?= "${short}"\na`).inputs.a?.default).toBe(short);
	});
});

describe('host mistakes', () => {
	const F = define({ args: [], returns: t.number(), run: () => 1 });

	test('keywords and long names are not function names', () => {
		expect(() => compile('1', { functions: { if: F } })).toThrow(TypeError);
		expect(() => compile('1', { functions: { null: F } })).toThrow(TypeError);
		expect(() => compile('1', { functions: { ['f'.repeat(1025)]: F } })).toThrow(TypeError);
		expect(compile('1', { functions: { ['f'.repeat(1024)]: F } }).ok).toBe(true);
	});

	test('two types of one name are found wherever they are', () => {
		const one = defineType<string>({ name: 'x', is: () => false });
		const two = defineType<string>({ name: 'x', is: () => false });
		const uses = (type: typeof one) => define({ args: [type], returns: t.number(), run: () => 1 });
		expect(() => compile('1', { types: [one], functions: { F: uses(two) } })).toThrow(TypeError);
		expect(() => compile('1', { functions: { F: uses(one), G: uses(two) } })).toThrow(TypeError);
		expect(() => compile('1', { inputs: { a: one, b: two } })).toThrow(TypeError);
		expect(compile('1', { types: [one], functions: { F: uses(one) } }).ok).toBe(true);
		expect(compile('1', { types: [one, one] }).ok).toBe(true);
	});
});

describe('smaller promises', () => {
	test('overflow at the result says what to do', () => {
		const error = failureOf(() =>
			run('a', { inputs: { a: t.number() }, variables: { a: Decimal.from('1e400') } }),
		);
		expect(error.code).toBe('overflow');
		expect(error.message).toContain('Decimal');
	});

	test('an abstract string counts as one value', () => {
		const tag = defineType<string>({ name: 'tag', is: (value) => typeof value === 'string' });
		const p = program('a', { inputs: { a: tag } });
		expect(
			evaluate(p, { variables: { a: 'x'.repeat(100_000) }, limits: { maxSteps: 100 } }),
		).toHaveLength(100_000);
	});

	test('a loop answers for reading its string', () => {
		const p = program('a = n / 3\nfor c in s then c', { inputs: { s: t.string() } });
		const variables = { n: 1, s: 'x'.repeat(100_000) };
		const error = failureOf(() => evaluate(p, { variables, limits: { maxSteps: 50 } }));
		expect(error.code).toBe('limit-exceeded');
		expect(error.start).toBe(10);
	});

	test('?? on a string in a name splits it once', () => {
		const p = program(
			's = a + "x"\nfor i in 0..1000 into n = 0 then n + (if (s[i] ?? "") == "" then 0 else 1)',
			{ inputs: { a: t.string() } },
		);
		const variables = { a: 'y'.repeat(999) };
		expect(evaluate(p, { variables, limits: { maxSteps: 40_000 } })).toBe(1000);
	});
});
