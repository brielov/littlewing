import { describe, expect, test } from 'bun:test';
import type { TypeDescription } from '../src/check/schema.js';
import type { CompileOptions, Program } from '../src/compile.js';
import { compile, evaluate, run } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import type { Type } from '../src/define.js';
import { define, defineType, t } from '../src/define.js';
import { EvaluationError } from '../src/errors.js';
import * as std from '../src/std.js';
import { random } from './syntax-generators.ts';

/** How many programs each property runs on. A deep run sets this far higher. */
const ROUNDS = Number(process.env.FUZZ_ROUNDS ?? 3000);

/** Every code a program with no host code can fail with: Appendix B of the language spec. */
const RUNTIME_CODES = new Set([
	'missing-input',
	'invalid-input',
	'division-by-zero',
	'modulo-by-zero',
	'overflow',
	'invalid-power',
	'not-an-integer',
	'invalid-range',
	'missing-value',
	'invalid-argument',
	'limit-exceeded',
]);

type Next = (limit: number) => number;

const NUMBERS = [
	'0',
	'1',
	'2',
	'3',
	'10',
	'100',
	'0.1',
	'1.5',
	'2.5',
	'9007199254740991',
	'9007199254740993',
	'1e16',
	'1e33',
	'1e34',
	'1e-5',
	'3.333333333333333333333333333333333',
	'1e6144',
	'9.999999999999999999999999999999999e6144',
	'1e-6176',
];
const STRINGS = ['""', '"a"', '"abc"', '"😀b"', '"é"', '"\\u{10FFFF}z"', '"key"', '" x "', '"a,b"'];

/** A type of the generator. Each has one spelling, and a generated program is well typed. */
type Kind = 'number' | 'string' | 'boolean' | 'numbers' | 'strings' | 'record' | 'money';

/** A program twice: with its literals in place, and with each one as an input. */
interface Pair {
	readonly shown: string;
	readonly hidden: string;
}

class Generator {
	/** The inputs of the hidden form, as source text, so that a number keeps its digits. */
	readonly literals = new Map<string, string>();
	private loop = 0;

	constructor(private readonly next: Next) {}

	private pick<T>(items: readonly T[]): T {
		return items[this.next(items.length)] as T;
	}

	private literal(text: string): Pair {
		const name = `v${this.literals.size}`;
		this.literals.set(name, text);
		return { shown: text, hidden: name };
	}

	/**
	 * A small integer, where anything else would fail at once. Now and then it is not,
	 * as what a fraction or a huge bound does has to stay the same too.
	 */
	private small(): Pair {
		if (this.next(10) === 0) return this.literal(this.pick(['0.5', '1e6', '1e33']));
		return this.literal(this.pick(['0', '1', '2', '3', '5']));
	}

	private both(parts: readonly Pair[], form: (...texts: string[]) => string): Pair {
		return {
			shown: form(...parts.map((part) => part.shown)),
			hidden: form(...parts.map((part) => part.hidden)),
		};
	}

	private leaf(kind: Kind, names: readonly (readonly [string, Kind])[]): Pair {
		const inScope = names.filter(([, type]) => type === kind);
		if (inScope.length > 0 && this.next(2) === 0) {
			const [name] = this.pick(inScope);
			return { shown: name, hidden: name };
		}
		switch (kind) {
			case 'number':
				return this.literal(this.pick(NUMBERS));
			case 'string':
				return this.literal(this.pick(STRINGS));
			case 'boolean':
				return this.literal(this.pick(['true', 'false']));
			case 'numbers':
				return this.both([this.leaf('number', [])], (a) => `[${a}]`);
			case 'strings':
				return this.both([this.leaf('string', [])], (a) => `[${a}]`);
			case 'record':
				return this.both(
					[this.leaf('number', []), this.leaf('string', [])],
					(a, b) => `{ n: ${a}, s: ${b} }`,
				);
			case 'money':
				return this.both([this.leaf('number', [])], (a) => `USD(${a})`);
		}
	}

	/** A whole program: some bindings, which later ones can read, then an expression. */
	program(kind: Kind, depth: number): Pair {
		const names: (readonly [string, Kind])[] = [];
		const statements: Pair[] = [];
		const kinds: readonly Kind[] = ['number', 'string', 'numbers', 'strings', 'record', 'money'];
		for (let i = this.next(4); i > 0; i--) {
			const type = this.pick(kinds);
			const name = `b${names.length}`;
			if (type === 'number' && this.next(3) === 0) {
				// A default is not constant, as a host could supply the input
				const value = this.expression(type, depth - 1, names);
				statements.push(this.both([value], (a) => `${name} ?= ${a}`));
			} else {
				const value = this.expression(type, depth - 1, names);
				statements.push(this.both([value], (a) => `${name} = ${a}`));
			}
			names.push([name, type]);
		}
		const result = this.expression(kind, depth, names);
		return this.both([...statements, result], (...lines) => lines.join('\n'));
	}

	expression(kind: Kind, depth: number, names: readonly (readonly [string, Kind])[]): Pair {
		if (depth <= 0) return this.leaf(kind, names);
		const sub = (type: Kind, scope = names): Pair => this.expression(type, depth - 1, scope);
		if (this.next(10) === 0) {
			return this.both(
				[sub('boolean'), sub(kind), sub(kind)],
				(c, a, b) => `(if ${c} then ${a} else ${b})`,
			);
		}
		switch (kind) {
			case 'number':
				return this.number(depth, names);
			case 'string':
				return this.text(depth, names);
			case 'boolean':
				return this.truth(depth, names);
			case 'numbers':
				return this.list(depth, names);
			case 'strings':
				return this.next(2) === 0
					? this.both([sub('string'), sub('string')], (a, b) => `[${a}, ${b}]`)
					: this.both([sub('string'), sub('string')], (a, b) => `SPLIT(${a}, ${b})`);
			case 'record':
				if (this.next(2) === 0) {
					return this.both([sub('record'), sub('number')], (a, b) => `{ ...${a}, n: ${b} }`);
				}
				return this.both([sub('number'), sub('string')], (a, b) => `{ n: ${a}, s: ${b} }`);
			case 'money': {
				const operator = this.pick(['+', '-']);
				if (this.next(2) === 0) return this.both([sub('number')], (a) => `USD(${a})`);
				return this.both([sub('money'), sub('money')], (a, b) => `(${a} ${operator} ${b})`);
			}
		}
	}

	/** `b[i] ?? fallback` on a list in a name, as a path has to start from one. */
	private fallback(depth: number, names: readonly (readonly [string, Kind])[]): Pair | undefined {
		const lists = names.filter(([, type]) => type === 'numbers');
		if (lists.length === 0) return undefined;
		const [name] = this.pick(lists);
		const parts = [this.small(), this.expression('number', depth - 1, names)];
		return this.both(parts, (i, f) => `(${name}[${i}] ?? ${f})`);
	}

	private number(depth: number, names: readonly (readonly [string, Kind])[]): Pair {
		const sub = (type: Kind, scope = names): Pair => this.expression(type, depth - 1, scope);
		switch (this.next(15)) {
			case 11:
				return this.fallback(depth, names) ?? this.leaf('number', names);
			case 12:
				return this.both([sub('money')], (a) => `CENTS(${a})`);
			case 13: {
				const mode = this.pick(['half_away', 'half_even', 'floor', 'ceil', 'trunc']);
				return this.both([sub('number'), this.small()], (a, d) => `ROUND(${a}, ${d}, "${mode}")`);
			}
			case 14:
				return this.both([sub('numbers'), sub('number')], (a, b) => `(${a} |> INDEX_OF(?, ${b}))`);
			case 0:
			case 1: {
				const operator = this.pick(['+', '-', '*', '/', '%', '^']);
				return this.both([sub('number'), sub('number')], (a, b) => `(${a} ${operator} ${b})`);
			}
			case 2:
				return this.both([sub('number')], (a) => `(-${a})`);
			case 3:
				return this.both([sub('numbers'), this.small()], (a, i) => `(${a})[${i}]`);
			case 4:
				return this.both([sub('record')], (a) => `(${a}).n`);
			case 5: {
				const item = `x${this.loop++}`;
				const total = `t${this.loop++}`;
				const inner: (readonly [string, Kind])[] = [...names, [item, 'number'], [total, 'number']];
				const parts = [sub('numbers'), sub('number'), sub('number', inner)];
				return this.both(
					parts,
					(a, i, b) => `(for ${item} in ${a} into ${total} = ${i} then ${b})`,
				);
			}
			case 6:
				return this.both([sub('number')], (a) => `LOUD(${a})`);
			case 7:
				return this.both([sub('number')], (a) => `QUIET(${a})`);
			case 8: {
				const fn = this.pick(['FLOOR', 'CEIL', 'ROUND', 'ABS']);
				return this.both([sub('number')], (a) => `${fn}(${a})`);
			}
			case 9: {
				const fn = this.pick(['LEN', 'NUM']);
				return this.both([sub('string')], (a) => `${fn}(${a})`);
			}
			default: {
				const fn = this.pick(['SUM', 'MIN', 'MAX', 'LEN']);
				return this.both([sub('numbers')], (a) => `${fn}(${a})`);
			}
		}
	}

	private text(depth: number, names: readonly (readonly [string, Kind])[]): Pair {
		const sub = (type: Kind): Pair => this.expression(type, depth - 1, names);
		switch (this.next(12)) {
			case 7:
				return this.both([sub('money')], (a) => `"#{${a}}"`);
			case 8: {
				const mode = this.pick(['half_away', 'half_even', 'floor', 'ceil', 'trunc']);
				return this.both([sub('number'), this.small()], (a, d) => `FIXED(${a}, ${d}, "${mode}")`);
			}
			case 9:
				return this.both([sub('number')], (a) => `STR(${a})`);
			case 10:
				return this.both(
					[sub('string'), sub('string'), sub('string')],
					(a, b, c) => `REPLACE(${a}, ${b}, ${c})`,
				);
			case 11: {
				const item = `c${this.loop++}`;
				const total = `s${this.loop++}`;
				return this.both(
					[sub('string')],
					(a) => `(for ${item} in ${a} into ${total} = "" then ${item} + ${total})`,
				);
			}
			case 0:
				return this.both([sub('string'), sub('string')], (a, b) => `(${a} + ${b})`);
			case 1:
				return this.both([sub('number')], (a) => `"n#{${a}}"`);
			case 2:
				return this.both([sub('string'), this.small()], (a, i) => `(${a})[${i}]`);
			case 3:
				return this.both([sub('record')], (a) => `(${a}).s`);
			case 4:
				return this.both(
					[sub('string'), this.small(), this.small()],
					(a, i, j) => `SLICE(${a}, ${i}, ${j})`,
				);
			case 5: {
				const fn = this.pick(['UPPER', 'LOWER', 'TRIM']);
				return this.both([sub('string')], (a) => `${fn}(${a})`);
			}
			default:
				return this.both([sub('strings'), sub('string')], (a, b) => `JOIN(${a}, ${b})`);
		}
	}

	private truth(depth: number, names: readonly (readonly [string, Kind])[]): Pair {
		const sub = (type: Kind): Pair => this.expression(type, depth - 1, names);
		switch (this.next(13)) {
			case 9:
				return this.both([sub('numbers'), sub('number')], (a, b) => `CONTAINS(${a}, ${b})`);
			case 10:
				return this.both([sub('record'), sub('record')], (a, b) => `(${a} != ${b})`);
			case 11:
				return this.both(
					[sub('money'), sub('money')],
					(a, b) => `CONTAINS(SORT([${a}, ${b}]), ${a})`,
				);
			case 12: {
				// A name of its own, as one name has one type
				const path = this.pick(['absent', 'absent.n', 'absent.n.m', 'absent[0]']);
				const name = path.replace('absent', `absent${this.loop++}`);
				return this.both([sub('boolean')], (a) => `(${name} ?? ${a})`);
			}
			case 6:
				return this.both([sub('money'), sub('money')], (a, b) => `(${a} < ${b})`);
			case 7:
				return this.both([sub('money'), sub('money')], (a, b) => `(${a} == ${b})`);
			case 8:
				return this.both([sub('record'), sub('record')], (a, b) => `(${a} == ${b})`);
			case 0: {
				const operator = this.pick(['&&', '||']);
				return this.both([sub('boolean'), sub('boolean')], (a, b) => `(${a} ${operator} ${b})`);
			}
			case 1: {
				const operator = this.pick(['<', '>', '<=', '>=', '==', '!=']);
				return this.both([sub('number'), sub('number')], (a, b) => `(${a} ${operator} ${b})`);
			}
			case 2:
				return this.both([sub('string'), sub('string')], (a, b) => `(${a} < ${b})`);
			case 3:
				return this.both([sub('boolean')], (a) => `(!${a})`);
			case 4:
				return this.both([sub('numbers'), sub('numbers')], (a, b) => `(${a} == ${b})`);
			default:
				return this.both([sub('string'), sub('string')], (a, b) => `CONTAINS(${a}, ${b})`);
		}
	}

	private list(depth: number, names: readonly (readonly [string, Kind])[]): Pair {
		const sub = (type: Kind, scope = names): Pair => this.expression(type, depth - 1, scope);
		switch (this.next(8)) {
			case 6:
				return this.both([this.small(), this.small()], (a, b) => `((${a})..=(${b}))`);
			case 7:
				return this.both([sub('numbers'), sub('numbers')], (a, b) => `SORT_BY(${a}, ${b})`);
			case 0:
				return this.both([sub('number'), sub('number')], (a, b) => `[${a}, ${b}]`);
			case 1:
				return this.both([sub('numbers'), sub('numbers')], (a, b) => `(${a} + ${b})`);
			case 2: {
				const fn = this.pick(['SORT', 'REVERSE', 'UNIQUE']);
				return this.both([sub('numbers')], (a) => `${fn}(${a})`);
			}
			case 3:
				return this.both([this.small(), this.small()], (a, b) => `((${a})..(${b}))`);
			case 4: {
				const item = `x${this.loop++}`;
				const inner: (readonly [string, Kind])[] = [...names, [item, 'number']];
				return this.both(
					[sub('numbers'), sub('boolean', inner), sub('number', inner)],
					(a, g, b) => `(for ${item} in ${a} when ${g} then ${b})`,
				);
			}
			default:
				return this.both([sub('numbers'), this.small()], (a, i) => `SLICE(${a}, ${i})`);
		}
	}
}

/**
 * A value as text, so that two runs compare by what they hold. A field carried unread
 * is the host's own, and can hold itself.
 */
function shownOf(value: unknown, open: Set<unknown> = new Set()): string {
	if (value instanceof Decimal) return value.toString();
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value !== 'object' || value === null) return String(value);
	if (open.has(value)) return '(cycle)';
	open.add(value);
	let shown: string;
	if (Array.isArray(value)) {
		shown = `[${value.map((item) => shownOf(item, open)).join(',')}]`;
	} else {
		const record = value as Record<string, unknown>;
		const fields = Object.keys(record)
			.sort()
			.map((key) => `${key}:${shownOf(record[key], open)}`);
		shown = `{${fields.join(',')}}`;
	}
	open.delete(value);
	return shown;
}

/** Whether a value is what a type says, which is the promise of language section 6.7. */
function conforms(value: unknown, type: TypeDescription): boolean {
	switch (type.kind) {
		case 'number':
			return value instanceof Decimal;
		case 'string':
			return typeof value === 'string';
		case 'boolean':
			return typeof value === 'boolean';
		case 'array':
			return Array.isArray(value) && value.every((item) => conforms(item, type.element));
		case 'record': {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
			const record = value as Record<string, unknown>;
			const named = Object.entries(type.fields).every(([name, field]) =>
				record[name] === undefined ? !field.required : conforms(record[name], field.type),
			);
			const others = Object.keys(record).filter((name) => !(name in type.fields));
			if (type.uniform !== undefined) {
				const { uniform } = type;
				return named && others.every((name) => conforms(record[name], uniform));
			}
			return named && (type.open || others.length === 0);
		}
		default:
			return true;
	}
}

/** The type of an input that stands for a literal, as inference alone may settle on another. */
function typeOfLiteral(text: string): Type {
	if (text.startsWith('"')) return t.string();
	return text === 'true' || text === 'false' ? t.boolean() : t.number();
}

interface Outcome {
	/** Where it ended: compiling, which also folds, or evaluating. */
	readonly stage: 'compile' | 'run';
	readonly value?: string;
	readonly failure?: string;
	readonly calls: readonly string[];
}

const SEED_STEP = 2_654_435_761;

describe('at random', () => {
	const log: string[] = [];
	const LOUD = define({
		args: [t.number()],
		returns: t.number(),
		run: (value) => {
			log.push(value.toString());
			return value;
		},
	});
	const QUIET = define({
		args: [t.number()],
		returns: t.number(),
		pure: true,
		run: (value) => value.plus(1),
	});

	class Money {
		constructor(readonly amount: Decimal) {}
	}
	/** Hooks of a type log their calls, so that one folded away would show. */
	const logged = <T>(name: string, value: T): T => {
		log.push(name);
		return value;
	};
	const money = defineType<Money>({
		name: 'money',
		is: (value) => value instanceof Money,
		equals: (a, b) => logged('equals', a.amount.equals(b.amount)),
		compare: (a, b) => logged('compare', a.amount.compare(b.amount)),
		add: (a, b) => logged('add', new Money(a.amount.plus(b.amount))),
		subtract: (a, b) => logged('subtract', new Money(a.amount.minus(b.amount))),
		show: (a) => logged('show', a.amount.toString()),
	});
	const USD = define({
		args: [t.number()],
		returns: money,
		pure: true,
		run: (amount) => new Money(amount),
	});
	const CENTS = define({
		args: [money],
		returns: t.number(),
		pure: true,
		run: (value) => value.amount,
	});
	const functions = { ...std, LOUD, QUIET, USD, CENTS };
	const limits = { maxSteps: 200_000 };

	/** Throw an error that says how to get it again. */
	function report(problem: string, round: number, source: string, inputs: unknown): never {
		const open = new Set<unknown>();
		const given = JSON.stringify(inputs, function replacer(this: unknown, _, value: unknown) {
			if (value instanceof Decimal) return value.toString();
			if (typeof value === 'bigint' || typeof value === 'symbol') return String(value);
			if (typeof value !== 'object' || value === null) return value;
			if (open.has(value)) return '(seen)';
			open.add(value);
			return value;
		});
		throw new Error(`${problem}, in round ${round} of:\n${source}\nwith inputs ${given}`);
	}

	/** Evaluate, and hold what happens to the promises of an evaluation. */
	function evaluated(
		program: Program,
		variables: Record<string, unknown>,
		round: number,
		source: string,
		hasHostCode: boolean,
	): Outcome {
		try {
			const options = { variables, limits, numbers: 'decimal' } as const;
			const value = evaluate(program, options);
			if (!conforms(value, program.output)) report('Not of its type', round, source, variables);
			return { stage: 'run', value: shownOf(value), calls: [...log] };
		} catch (error) {
			if (!(error instanceof EvaluationError)) {
				report(`Threw ${String(error)}`, round, source, variables);
			}
			const expected =
				RUNTIME_CODES.has(error.code) || (hasHostCode && error.code === 'host-error');
			if (!expected) {
				const problem = `Unexpected ${error.code} (${error.message})`;
				report(problem, round, source, variables);
			}
			return { stage: 'run', failure: error.code, calls: [...log] };
		}
	}

	/** Run a program in full, with literals given as declared inputs if there are any. */
	function outcomeOf(source: string, inputs: ReadonlyMap<string, string>, round: number): Outcome {
		log.length = 0;
		const declared: Record<string, Type> = {};
		for (const [name, text] of inputs) declared[name] = typeOfLiteral(text);
		const options: CompileOptions = { functions, limits, inputs: declared };
		const compiled = compile(source, options);
		if (!compiled.ok) {
			if (log.length > 0) report('A call ran while compiling', round, source, log);
			const errors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
			return { stage: 'compile', failure: errors[0]?.code ?? 'compile', calls: [] };
		}
		if (log.length > 0) report('A call ran while compiling', round, source, log);

		const variables: Record<string, unknown> = {};
		for (const [name, text] of inputs) variables[name] = run(text, { numbers: 'decimal' });
		return evaluated(compiled.program, variables, round, source, true);
	}

	/** Enough time for a deep run, which `FUZZ_ROUNDS` asks for. */
	const timeout = Math.max(5000, ROUNDS);

	test(
		'folding never changes what a program does, and no type is ever broken',
		() => {
			const kinds: readonly Kind[] = [
				'number',
				'string',
				'boolean',
				'numbers',
				'strings',
				'record',
				'money',
			];
			let compared = 0;
			for (let round = 0; round < ROUNDS; round++) {
				const next = random((round + 1) * SEED_STEP);
				const generator = new Generator(next);
				const pair = generator.program(kinds[round % kinds.length] as Kind, 2 + next(3));
				const shown = outcomeOf(pair.shown, new Map(), round);
				const hidden = outcomeOf(pair.hidden, generator.literals, round);
				const label = `${pair.shown}\n--- as inputs:\n${pair.hidden}`;
				const results = JSON.stringify({ shown, hidden });

				// Running out while folding never fails compilation: language section 8.2
				if (shown.stage === 'compile' && shown.failure === 'limit-exceeded') {
					report(`Folding ran out and failed: ${results}`, round, label, null);
				}
				if (hidden.stage === 'compile') {
					report(`Not well typed: ${results}`, round, label, null);
				}
				if (hidden.failure === 'limit-exceeded' || shown.failure === 'limit-exceeded') continue;

				if (shown.stage === 'compile') {
					// A constant failure, which only counts if it would have failed
					if (hidden.value !== undefined) {
						report(`Failed only when folded: ${results}`, round, label, null);
					}
					continue;
				}
				const same =
					shown.value === hidden.value &&
					shown.failure === hidden.failure &&
					shown.calls.join() === hidden.calls.join();
				if (!same) report(`A fold changed the outcome: ${results}`, round, label, null);
				if (shown.value !== undefined) compared++;
			}
			expect(compared).toBeGreaterThan(ROUNDS / 4);
		},
		timeout,
	);

	test(
		'a checked program takes any input at all without a broken promise',
		() => {
			const shared = { x: 1 };
			const cyclic: unknown[] = [];
			cyclic.push(cyclic);
			const inPlace: readonly unknown[] = [
				0,
				1,
				-1,
				0.5,
				1e21,
				Decimal.from('1e400'),
				'',
				'a',
				'😀',
				'key',
				true,
				false,
				[],
				[1, 2],
				['a'],
				[[1]],
				{},
				{ x: 1 },
				{ x: 'a', y: 2 },
				{ x: { x: 1 } },
				[shared, shared],
			];
			const hostile: readonly unknown[] = [
				null,
				Number.NaN,
				Number.POSITIVE_INFINITY,
				'\ud800',
				[undefined],
				[Number.NaN],
				new Date(0),
				new Map(),
				() => 1,
				Symbol('s'),
				10n,
				cyclic,
				Object.create({ x: 1 }),
				new Proxy([], {}),
			];
			const anyValue = (next: Next): unknown =>
				next(4) === 0 ? hostile[next(hostile.length)] : inPlace[next(inPlace.length)];
			const inputFor = (type: TypeDescription, next: Next): unknown => {
				// Now and then, anything at all, which the boundary has to turn away
				if (next(6) === 0) return anyValue(next);
				switch (type.kind) {
					case 'number':
						return [0, 1, -1, 0.5, 1e21, Decimal.from('1e400')][next(6)];
					case 'string':
						return ['', 'a', '😀', 'key'][next(4)];
					case 'boolean':
						return next(2) === 0;
					case 'array':
						return Array.from({ length: next(3) }, () => inputFor(type.element, next));
					case 'record': {
						const record: Record<string, unknown> = {};
						for (const [name, field] of Object.entries(type.fields)) {
							if (field.required || next(2) === 0) record[name] = inputFor(field.type, next);
						}
						if (type.open && next(2) === 0) record.extra = anyValue(next);
						return record;
					}
					default:
						return anyValue(next);
				}
			};
			const lines = [
				'a + b',
				'a.x + 1',
				'a[0]',
				'a[k]',
				'for x in a then x + 1',
				'for x in a into t = 0 then t + x',
				'{ ...a, y: 1 }',
				'a == b',
				'"#{a}"',
				'a ?? b',
				'a.x ?? b',
				'a[k] ?? b',
				'LEN(a)',
				'SORT(a)',
				'CONTAINS(a, b)',
				'SLICE(a, k)',
				'if a then b else c',
				'a < b',
				'a |> ROUND(?, k)',
				'NUM(a)',
				'{ a, b }',
				'[a, b]',
				'[a] == [b]',
			];
			let evaluatedAll = 0;
			for (let round = 0; round < ROUNDS; round++) {
				const next = random((round + 1) * SEED_STEP);
				const picked = Array.from(
					{ length: 1 + next(3) },
					() => lines[next(lines.length)] as string,
				);
				const source = picked.join('\n');
				const compiled = compile(source);
				if (!compiled.ok) continue;
				const { inputs } = compiled.program;
				const variables: Record<string, unknown> = {};
				for (const [name, input] of Object.entries(inputs)) {
					if (input.required || next(2) === 0) variables[name] = inputFor(input.type, next);
				}
				log.length = 0;
				const { failure } = evaluated(compiled.program, variables, round, source, false);
				if (failure === undefined) evaluatedAll++;
			}
			expect(evaluatedAll).toBeGreaterThan(ROUNDS / 10);
		},
		timeout,
	);

	test(
		'UNIQUE agrees with comparing every pair',
		() => {
			for (let round = 0; round < ROUNDS; round++) {
				const next = random((round + 1) * SEED_STEP);
				const numbers = Array.from({ length: next(30) }, () => next(8) / 2);
				const strings = Array.from({ length: next(30) }, () => 'ab'.repeat(next(3)) + 'c'[next(1)]);
				const lists = Array.from({ length: next(12) }, () =>
					Array.from({ length: next(3) }, () => next(2)),
				);
				for (const items of [numbers, strings, lists]) {
					const kept: unknown[] = [];
					for (const item of items) {
						const text = JSON.stringify(item);
						if (!kept.some((other) => JSON.stringify(other) === text)) kept.push(item);
					}
					expect(run('UNIQUE(a)', { functions: std, variables: { a: items } })).toEqual(kept);
				}
			}
		},
		timeout,
	);
});

describe('values that print alike', () => {
	test('UNIQUE tells them apart', () => {
		const functions = std;
		expect(run('UNIQUE(a)', { functions, variables: { a: [['a,b'], ['a', 'b']] } })).toEqual([
			['a,b'],
			['a', 'b'],
		]);
		expect(run('UNIQUE(a)', { functions, variables: { a: ['1', '01', '1.0'] } })).toEqual([
			'1',
			'01',
			'1.0',
		]);
		expect(run('UNIQUE(["e\\u{301}", "\\u{E9}"])', { functions })).toHaveLength(2);
	});
});

describe('pipes and host functions', () => {
	test('the value runs first and once, then the arguments in order', () => {
		const order: string[] = [];
		const named = (name: string) =>
			define({
				args: [],
				returns: t.number(),
				run: () => {
					order.push(name);
					return 1;
				},
			});
		const ADD = define({
			args: [t.number(), t.number(), t.number(), t.number()],
			returns: t.number(),
			run: (a, b, c, d) => {
				order.push('ADD');
				return a.plus(b).plus(c).plus(d);
			},
		});
		const functions = { A: named('A'), B: named('B'), C: named('C'), ADD };
		expect(run('A() |> ADD(B(), ?, C(), ?)', { functions })).toBe(4);
		expect(order).toEqual(['A', 'B', 'C', 'ADD']);
	});

	test('a failure in a step points at that step', () => {
		const failed = (source: string, variables: Record<string, unknown>): EvaluationError => {
			try {
				run(source, { variables });
			} catch (error) {
				return error as EvaluationError;
			}
			throw new Error('Expected a failure');
		};
		const inStep = failed('x |> SLICE(?, 0.5)', { x: 'a' });
		expect(inStep.code).toBe('invalid-argument');
		expect('x |> SLICE(?, 0.5)'.slice(inStep.start, inStep.end)).toContain('SLICE');

		const inValue = failed('1 / x |> STR', { x: 0 });
		expect(inValue.code).toBe('division-by-zero');
		expect('1 / x |> STR'.slice(inValue.start, inValue.end)).toBe('1 / x');
	});

	test('a host value that is not a number of the language stops at the step', () => {
		const NAN = define({ args: [t.number()], returns: t.number(), run: () => Number.NaN });
		const error = (() => {
			try {
				run('1 |> NAN |> STR', { functions: { NAN } });
			} catch (caught) {
				return caught as EvaluationError;
			}
			throw new Error('Expected a failure');
		})();
		expect(error.code).toBe('host-error');
	});
});

describe('abstract types through every core path', () => {
	const tag = defineType<string>({
		name: 'tag',
		is: (value) => typeof value === 'string' && value.startsWith('#'),
		equals: (a, b) => a === b,
		compare: (a, b) => a.localeCompare(b),
		show: (a) => a,
	});

	test('at known and at generic positions', () => {
		const inputs = { a: t.array(tag) };
		const variables = { a: ['#b', '#a'] };
		expect(run('SORT(a)', { inputs, variables })).toEqual(['#a', '#b']);
		expect(run('LEN(a)', { inputs, variables })).toBe(2);
	});
});
