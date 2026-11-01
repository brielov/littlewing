import { describe, expect, test } from 'bun:test';
import type { Decimal } from '../src/decimal.ts';
import type { AbstractType, Type } from '../src/define.ts';
import {
	checkInputTypes,
	define,
	defineType,
	isAbstractType,
	isFunctionDefinition,
	once,
	t,
} from '../src/define.ts';
import { setEvaluation } from '../src/limits.ts';

class Money {
	constructor(readonly cents: number) {}
	plus(other: Money): Money {
		return new Money(this.cents + other.cents);
	}
}

const money = defineType<Money>({
	name: 'money',
	is: (value) => value instanceof Money,
	add: (a, b) => a.plus(b),
	show: (a) => String(a.cents),
});

describe('t', () => {
	test('types are frozen data', () => {
		const number = t.number('price');
		expect(number.kind).toBe('number');
		expect(number.label).toBe('price');
		expect(Object.isFrozen(number)).toBe(true);
		expect(Object.isFrozen(t.array(t.string()))).toBe(true);
	});

	test('t itself cannot be changed', () => {
		expect(Object.isFrozen(t)).toBe(true);
	});

	test('a record takes plain objects only', () => {
		expect(() => t.record(Object.create({ a: t.number() }) as never)).toThrow('plain object');
		const fields = { ['__proto__']: t.number() };
		expect(Object.keys((t.record(fields) as unknown as { fields: object }).fields)).toEqual([
			'__proto__',
		]);
	});

	test('builders reject what they cannot use', () => {
		expect(() => t.var(7 as never)).toThrow(TypeError);
		expect(() => t.oneOf([1, null] as never)).toThrow(TypeError);
		expect(() => t.oneOf('abc' as never)).toThrow(TypeError);
		expect(() => t.oneOf(undefined as never)).toThrow(TypeError);
		expect(() => t.number({} as never)).toThrow(TypeError);
	});

	test('a record keeps its own fields, whatever they are called', () => {
		const fields = JSON.parse('{"__proto__": 1, "a": 2}') as Record<string, unknown>;
		fields['__proto__'] = t.number();
		const type = t.record(fields as never) as unknown as { fields: object };
		expect(Object.getPrototypeOf(type.fields)).toBe(null);
		expect(Object.keys(type.fields).sort()).toEqual(['__proto__', 'a']);
	});
});

describe('define', () => {
	test('makes a definition', () => {
		const definition = define({
			args: [t.number('price'), t.number('percent')],
			returns: t.number(),
			pure: true,
			doc: 'Take a percentage off a price',
			run: (price, percent) => price.times(percent.div(100)),
		});
		expect(isFunctionDefinition(definition)).toBe(true);
		expect(definition.pure).toBe(true);
		expect(definition.overloads.length).toBe(1);
		expect(Object.isFrozen(definition)).toBe(true);
	});

	test('nothing else counts as a definition', () => {
		expect(isFunctionDefinition({ overloads: [], run: () => 1 })).toBe(false);
		expect(isFunctionDefinition(() => 1)).toBe(false);
		expect(isFunctionDefinition(null)).toBe(false);
	});

	test('takes optional trailing arguments', () => {
		const definition = define({
			args: [t.number(), t.optional(t.number()), t.optional(t.oneOf(['a', 'b']))],
			returns: t.number(),
			run: (a, b, c) => (b === undefined || c === undefined ? a : a.plus(b)),
		});
		expect(definition.overloads[0]?.args.length).toBe(3);
	});

	test('takes overloads', () => {
		const definition = define({
			overloads: [
				{ args: [t.string()], returns: t.number() },
				{ args: [t.array(t.var('T'))], returns: t.number() },
			],
			run: (value) => Array.from(value).length,
		});
		expect(definition.overloads.length).toBe(2);
	});

	test('cannot change after it is made', () => {
		const args = [t.number()];
		const definition = define({ args, returns: t.number(), run: () => 1 });
		args.push(t.string() as never);
		const [signature] = definition.overloads;
		expect(signature?.args.length).toBe(1);
		expect(Object.isFrozen(signature?.args)).toBe(true);
		expect(Object.isFrozen(signature)).toBe(true);
		expect(Object.isFrozen(definition.overloads)).toBe(true);

		const values = ['a'];
		const oneOf = t.oneOf(values) as unknown as { values: string[] };
		values.push('b');
		expect(oneOf.values).toEqual(['a']);
		expect(Object.isFrozen(oneOf.values)).toBe(true);
	});

	test('stores what it checked, not a later answer', () => {
		let reads = 0;
		const lying = {
			get args() {
				return reads++ === 0 ? [] : ['junk'];
			},
			returns: t.number(),
			run: () => 1,
		};
		expect(define(lying as never).overloads[0]?.args).toEqual([]);

		const iterates = ['junk'] as unknown[];
		(iterates as unknown as Record<symbol, unknown>)[Symbol.iterator] = function* () {};
		expect(() => define({ args: iterates, returns: t.number(), run: () => 1 } as never)).toThrow(
			TypeError,
		);

		const inherited = Object.create({ args: [], returns: t.number() }) as object;
		expect(define({ overloads: [inherited], run: () => 1 } as never).overloads[0]?.args).toEqual(
			[],
		);
	});

	test('nothing but a type made with t is a type', () => {
		for (const forged of [
			{ kind: 'number' },
			{ kind: 'abstract' },
			{ kind: 'oneOf' },
			{ kind: 'var', variable: 7 },
		]) {
			expect(() => define({ args: [forged], returns: t.number(), run: () => 1 } as never)).toThrow(
				TypeError,
			);
			expect(() => checkInputTypes({ a: forged as never })).toThrow(TypeError);
		}
	});

	test('shared types are checked once, and too deep is an error', () => {
		let shared: Type = t.number();
		for (let i = 0; i < 64; i++) shared = t.record({ a: shared, b: shared }) as Type;
		expect(() => define({ args: [shared], returns: t.number(), run: () => 1 })).not.toThrow();

		let deep: Type = t.number();
		for (let i = 0; i < 300; i++) deep = t.array(deep) as Type;
		expect(() => define({ args: [deep], returns: t.number(), run: () => 1 })).toThrow('too deep');

		let huge: Type = t.number();
		for (let i = 0; i < 200_000; i++) huge = t.array(huge) as Type;
		expect(() => define({ args: [huge], returns: t.number(), run: () => 1 })).toThrow('too deep');
	});

	const invalid =
		(spec: unknown): (() => unknown) =>
		() =>
			define(spec as never);
	const run = (): number => 1;

	test('rejects an invalid definition', () => {
		expect(invalid({ args: [], returns: t.number() })).toThrow(TypeError);
		expect(invalid({ returns: t.number(), run })).toThrow(TypeError);
		expect(invalid({ args: [], run })).toThrow(TypeError);
		expect(invalid({ args: [1], returns: t.number(), run })).toThrow(TypeError);
		expect(invalid({ args: [], returns: t.number(), run: 1 })).toThrow(TypeError);
		expect(invalid({ args: [], returns: t.number(), run, cost: 1 })).toThrow(TypeError);
		expect(invalid({ args: [], returns: t.number(), run, pure: 'yes' })).toThrow(TypeError);
		expect(invalid({ args: [], returns: t.number(), run, doc: 1 })).toThrow(TypeError);
		expect(invalid({ overloads: [], run })).toThrow(TypeError);
		expect(invalid({ overloads: [{ args: [], returns: t.number() }], args: [], run })).toThrow(
			TypeError,
		);
	});

	test('a required parameter cannot follow an optional one', () => {
		const args = [t.optional(t.number()), t.number()];
		expect(invalid({ args, returns: t.number(), run })).toThrow('required parameter');
	});

	test('t.optional is only for fields and trailing arguments', () => {
		const inArray = t.array(t.optional(t.number()) as never);
		expect(invalid({ args: [inArray], returns: t.number(), run })).toThrow('t.optional');
		expect(invalid({ args: [], returns: t.optional(t.number()), run })).toThrow('t.optional');
		const field = t.record({ a: t.optional(t.number()) });
		expect(invalid({ args: [field], returns: t.number(), run })).not.toThrow();
	});

	test('t.optional does not nest', () => {
		const twice = t.optional(t.optional(t.number()) as never);
		expect(invalid({ args: [twice], returns: t.number(), run })).toThrow('t.optional');

		let chain: unknown = t.number();
		for (let i = 0; i < 200_000; i++) chain = t.optional(chain as never);
		expect(invalid({ args: [chain], returns: t.number(), run })).toThrow(TypeError);
	});

	test('a huge sparse list fails at once', () => {
		const huge: unknown[] = [];
		huge.length = 2 ** 32 - 1;
		expect(invalid({ args: huge, returns: t.number(), run })).toThrow(TypeError);
		expect(() => t.oneOf(huge as never)).toThrow(TypeError);
	});

	test('t.oneOf is only for parameters', () => {
		const oneOf = t.oneOf(['a']);
		expect(invalid({ args: [oneOf], returns: t.number(), run })).not.toThrow();
		expect(invalid({ args: [], returns: oneOf, run })).toThrow('t.oneOf');
		expect(invalid({ args: [t.array(oneOf)], returns: t.number(), run })).toThrow('t.oneOf');
		expect(invalid({ args: [t.record({ a: oneOf })], returns: t.number(), run })).toThrow(
			't.oneOf',
		);
	});

	test('a variable has one class', () => {
		const clash = [t.var('T'), t.class('ordered', 'T')];
		expect(invalid({ args: clash, returns: t.number(), run })).toThrow('two different classes');
		const classes = [t.class('ordered', 'T'), t.class('showable', 'T')];
		expect(invalid({ args: classes, returns: t.number(), run })).toThrow('two different classes');
		const same = [t.class('ordered', 'T'), t.class('ordered', 'T')];
		expect(invalid({ args: same, returns: t.number(), run })).not.toThrow();
		const other = [t.var('T'), t.class('ordered', 'U')];
		expect(invalid({ args: other, returns: t.number(), run })).not.toThrow();
	});

	test('a class must exist', () => {
		for (const name of ['orderd', undefined, null]) {
			const unknown = [t.class(name as never, 'T')];
			expect(invalid({ args: unknown, returns: t.number(), run })).toThrow('Unknown type class');
		}
	});

	test('each signature has its own variables', () => {
		const overloads = [
			{ args: [t.var('T')], returns: t.number() },
			{ args: [t.class('ordered', 'T')], returns: t.number() },
		];
		expect(invalid({ overloads, run })).not.toThrow();
	});
});

describe('inputs', () => {
	test('are one signature', () => {
		expect(() => checkInputTypes({ a: t.var('T'), b: t.class('ordered', 'T') })).toThrow(
			'two different classes',
		);
		expect(() => checkInputTypes({ a: t.number(), b: money })).not.toThrow();
	});

	test('cannot be optional or restricted', () => {
		expect(() => checkInputTypes({ a: t.optional(t.number()) as never })).toThrow('t.optional');
		expect(() => checkInputTypes({ a: t.oneOf(['x']) as never })).toThrow('t.oneOf');
	});
});

describe('defineType', () => {
	test('is a type, and names a parameter', () => {
		expect(money.kind).toBe('abstract');
		expect(money.definition.name).toBe('money');
		expect(money.label).toBeUndefined();
		const labelled = money('price');
		expect(labelled.kind).toBe('abstract');
		expect(labelled.label).toBe('price');
		expect(() =>
			define({ args: [money, money('b')], returns: money, run: (a, b) => a.plus(b) }),
		).not.toThrow();
	});

	test('its name is its name', () => {
		expect(money.name).toBe('money');
		expect(isAbstractType(money)).toBe(true);
		expect(isAbstractType(money('x'))).toBe(false);
		expect(isAbstractType(t.number())).toBe(false);
	});

	test('stores what it checked', () => {
		let reads = 0;
		const lying = {
			name: 'x',
			is: () => true,
			get add() {
				return reads++ === 0 ? undefined : 'junk';
			},
		};
		const type = defineType(lying as never);
		expect(Reflect.get(type.definition, 'add')).toBeUndefined();
		class Inherited {
			name = 'x';
			is(): boolean {
				return true;
			}
		}
		expect(() => defineType(new Inherited())).toThrow(TypeError);
	});

	test('a hook on a prototype is an error, not a missing hook', () => {
		class Hooked {
			name = 'x';
			is = (): boolean => true;
			add(a: unknown): unknown {
				return a;
			}
		}
		expect(() => defineType(new Hooked() as never)).toThrow('plain object');
	});

	test('needs a name and a test', () => {
		expect(() => defineType({ name: '', is: () => true })).toThrow(TypeError);
		expect(() => defineType({ name: 'x' } as never)).toThrow(TypeError);
		expect(() => defineType({ is: () => true } as never)).toThrow(TypeError);
	});

	test('rejects an operation that is not a function', () => {
		expect(() => defineType({ name: 'x', is: () => true, add: 1 } as never)).toThrow('add');
	});
});

describe('once', () => {
	test('calls once per evaluation', () => {
		let calls = 0;
		const read = once(() => ++calls);

		const first = {};
		const outside = setEvaluation(first);
		try {
			expect(read()).toBe(1);
			expect(read()).toBe(1);

			// A nested evaluation has its own reading, and does not disturb this one
			const previous = setEvaluation({});
			expect(read()).toBe(2);
			setEvaluation(previous);
			expect(read()).toBe(1);
		} finally {
			setEvaluation(outside);
		}
	});

	test('calls every time outside an evaluation', () => {
		let calls = 0;
		const read = once(() => ++calls);
		expect(read()).toBe(1);
		expect(read()).toBe(2);
	});

	test('keeps nothing from a throw', () => {
		let calls = 0;
		const read = once(() => {
			if (++calls === 1) throw new Error('first');
			return calls;
		});
		const outside = setEvaluation({});
		try {
			expect(read).toThrow('first');
			expect(read()).toBe(2);
			expect(read()).toBe(2);
		} finally {
			setEvaluation(outside);
		}
	});

	test('cannot call itself', () => {
		const read: () => number = once(() => read());
		const outside = setEvaluation({});
		try {
			expect(read).toThrow('called itself');
		} finally {
			setEvaluation(outside);
		}
	});

	test('needs a function', () => {
		expect(() => once(1 as never)).toThrow(TypeError);
	});

	test('keeps undefined', () => {
		let calls = 0;
		const read = once(() => {
			calls++;
			return undefined;
		});
		const outside = setEvaluation({});
		try {
			read();
			read();
			expect(calls).toBe(1);
		} finally {
			setEvaluation(outside);
		}
	});
});

/** These only have to compile, or fail to, under `tsc`. */
describe('types', () => {
	test('run is typed from args', () => {
		define({
			args: [t.number(), t.string(), t.boolean()],
			returns: t.number(),
			run: (a, b, c) => {
				const decimal: Decimal = a;
				const text: string = b;
				const flag: boolean = c;
				return flag ? decimal : text.length;
			},
		});
	});

	test('a number can return as either form', () => {
		define({ args: [], returns: t.number(), run: () => 1 });
		define({ args: [t.number()], returns: t.number(), run: (a) => a });
	});

	test('a wrong result does not compile', () => {
		// @ts-expect-error a string is not a number
		define({ args: [], returns: t.number(), run: () => 'a' });
		// @ts-expect-error a number is not a string
		define({ args: [], returns: t.string(), run: () => 1 });
	});

	test('arrays arrive read-only', () => {
		define({
			args: [t.array(t.number())],
			returns: t.array(t.number()),
			run: (values) => {
				// @ts-expect-error the argument is frozen
				values.push(1);
				const first: Decimal | undefined = values[0];
				return first === undefined ? [] : [first, 1];
			},
		});
	});

	test('records are typed field by field', () => {
		define({
			args: [t.record({ price: t.number(), note: t.optional(t.string()) })],
			returns: t.record({ total: t.number(), note: t.optional(t.string()) }),
			run: (item) => {
				const note: string | undefined = item.note;
				return note === undefined ? { total: item.price } : { total: 1, note };
			},
		});
	});

	test('optional arguments can be undefined', () => {
		define({
			args: [t.number(), t.optional(t.string())],
			returns: t.string(),
			run: (a, b) => {
				const maybe: string | undefined = b;
				return maybe ?? a.toString();
			},
		});
	});

	test('t.oneOf narrows', () => {
		define({
			args: [t.oneOf(['up', 'down'])],
			returns: t.string(),
			run: (mode) => {
				const known: 'up' | 'down' = mode;
				return known;
			},
		});
	});

	test('abstract types flow through', () => {
		define({
			args: [money('a'), money],
			returns: money,
			run: (a, b) => {
				const both: Money = a.plus(b);
				return both;
			},
		});
		// @ts-expect-error a number is not money
		define({ args: [], returns: money, run: () => 1 });
	});

	test('cost sees the arguments', () => {
		define({
			args: [t.string(), t.number()],
			returns: t.string(),
			cost: (text, count) => text.length * count.toNumber(),
			run: (text) => text,
		});
	});

	test('types are assignable to the plain Type', () => {
		const types: Type[] = [t.number(), t.array(t.string()), money];
		expect(types.length).toBe(3);
		const abstract: AbstractType[] = [money];
		expect(abstract.length).toBe(1);
	});

	test('overloads of different lengths take a normal list of parameters', () => {
		define({
			overloads: [
				{ args: [t.string()], returns: t.number() },
				{ args: [t.number(), t.string()], returns: t.number() },
			],
			cost: (a, b) => (b === undefined ? 1 : 2),
			run: (a, b) => {
				const first: string | Decimal = a;
				const second: string | undefined = b;
				return second === undefined ? 1 : typeof first === 'string' ? 2 : 3;
			},
		});
	});

	test('a record result must be a record', () => {
		// @ts-expect-error a number is not a record
		define({ args: [], returns: t.record({ a: t.optional(t.number()) }), run: () => 5 });
		// @ts-expect-error a number is not a record
		define({ args: [], returns: t.record({}), run: () => 5 });
		// @ts-expect-error a string is not a record
		define({ args: [], returns: t.openRecord({}), run: () => 'x' });
	});

	test('an optional field can be undefined going out', () => {
		define({
			args: [t.optional(t.string())],
			returns: t.record({ a: t.optional(t.string()) }),
			run: (x) => ({ a: x }),
		});
	});

	test('a uniform record can leave a key out', () => {
		define({
			args: [t.uniformRecord(t.number())],
			returns: t.uniformRecord(t.number()),
			run: (rates) => ({ usd: rates['usd'], eur: undefined }),
		});
	});

	test('a mistake is reported against the signature', () => {
		// @ts-expect-error a Decimal is not a string
		define({ args: [t.number()], returns: t.string(), run: (a) => a });
	});
});
