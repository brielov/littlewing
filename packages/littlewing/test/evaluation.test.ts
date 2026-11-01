import { describe, expect, test } from 'bun:test';
import * as ast from '../src/ast';
import { EvaluationError, ParseError } from '../src/errors';
import { evaluate, evaluateScope, evaluateWithScope } from '../src/interpreter';
import { LimitExceededError } from '../src/limits';
import { parse } from '../src/parser';
import { defaultContext } from '../src/stdlib';
import type { ExecutionContext, HostFunction, RuntimeValue } from '../src/types';
import { stepsOf } from './helpers';

function failure(run: () => unknown): EvaluationError {
	try {
		run();
	} catch (err) {
		expect(err).toBeInstanceOf(EvaluationError);
		return err as EvaluationError;
	}
	throw new Error('expected evaluation to fail');
}

function failedText(source: string, context?: ExecutionContext): string {
	const err = failure(() => evaluate(source, context));
	expect(err.start).toBeNumber();
	expect(err.end).toBeNumber();
	return source.slice(err.start, err.end);
}

describe('Evaluation errors', () => {
	test('locate the failing expression', () => {
		expect(failedText('0 + (-"a")')).toBe('-"a"');
		expect(failedText('0 + [1, "a"][0]')).toBe('[1, "a"]');
		expect(failedText('(if 1 then 2 else 3) + 1')).toBe('if 1 then 2 else 3');
		expect(failedText('[0] + (1..2.5)')).toBe('1..2.5');
		expect(failedText('[(for x in 1 then x)]')).toBe('for x in 1 then x');
		expect(failedText('1 + (1 && true)')).toBe('1 && true');
		expect(failedText('1 + (true && 1)')).toBe('true && 1');
		expect(failedText('0 + (1 |> NOPE(?))')).toBe('1 |> NOPE(?)');
		expect(failedText('0 + NOPE(1 + 1)')).toBe('NOPE(1 + 1)');
		expect(failedText('for x in [1] when if true then 1 else 2 then x')).toBe(
			'if true then 1 else 2',
		);
		expect(failedText('1 + missing * 2')).toBe('missing');
		expect(failedText('a = 1\nb = a + "x"\nb')).toBe('a + "x"');
		expect(failedText('x = 1\nx[0] + 1')).toBe('x[0]');
		expect(failedText('NOPE(1)')).toBe('NOPE(1)');
		expect(failedText('[1, "a"]')).toBe('[1, "a"]');
		expect(failedText('-"a"')).toBe('-"a"');
		expect(failedText('!1')).toBe('!1');
		expect(failedText('1..2.5')).toBe('1..2.5');
		expect(failedText('if 1 then 2 else 3')).toBe('if 1 then 2 else 3');
		expect(failedText('1 && true')).toBe('1 && true');
		expect(failedText('true && 1')).toBe('true && 1');
		expect(failedText('for x in 1 then x')).toBe('for x in 1 then x');
		expect(failedText('for x in [1, 2] when x then x')).toBe('x');
		expect(failedText('for x in [1, 2] then if x > 1 then "a" else 0')).toBe(
			'for x in [1, 2] then if x > 1 then "a" else 0',
		);
	});

	test('locate the failing call in a host function', () => {
		const context = {
			functions: {
				FAIL: (() => {
					throw new Error('boom');
				}) as HostFunction,
			},
		};
		expect(failedText('1 + FAIL()', context)).toBe('FAIL()');
		expect(failedText('1 |> FAIL(?)', context)).toBe('1 |> FAIL(?)');
		expect(failedText('FAIL(1 + 1)', context)).toBe('FAIL(1 + 1)');
		expect(failedText('(1 + 1) |> FAIL(?, 2 + 2)', context)).toBe('(1 + 1) |> FAIL(?, 2 + 2)');
	});

	test('do not point at a child that evaluated fine', () => {
		expect(failedText('(1 + 1) / (2 - 2)')).toBe('(1 + 1) / (2 - 2)');
	});

	test('keep the message and original error', () => {
		const err = failure(() => evaluate('1 + "a"'));
		expect(err.message).toBe("Operator '+' not supported for number and string");
		expect(err.cause).toBeInstanceOf(TypeError);
		expect(failure(() => evaluate('[1][5]')).cause).toBeInstanceOf(RangeError);
	});

	test('keep what a host function threw', () => {
		class HostError extends Error {}
		const thrown = new HostError('nope');
		const context = {
			functions: {
				FAIL: (() => {
					throw thrown;
				}) as HostFunction,
			},
		};
		expect(failure(() => evaluate('FAIL()', context)).cause).toBe(thrown);
	});

	test('survive whatever a host throws', () => {
		const throwing = (value: unknown): ExecutionContext => ({
			functions: {
				FAIL: (() => {
					throw value;
				}) as HostFunction,
			},
		});
		expect(failure(() => evaluate('FAIL()', throwing(Object.create(null)))).message).toBe(
			'Unknown error',
		);
		const symbolic = Object.assign(new Error(), { message: Symbol('x') });
		expect(failure(() => evaluate('FAIL()', throwing(symbolic))).message).toBe('Symbol(x)');
	});

	test('accept hosts that throw non-errors', () => {
		const context = {
			functions: {
				FAIL: (() => {
					throw 'text';
				}) as HostFunction,
			},
		};
		const err = failure(() => evaluate('FAIL()', context));
		expect(err.message).toBe('text');
		expect(err.cause).toBe('text');
	});

	test('have no location on hand-built nodes', () => {
		const err = failure(() => evaluate(ast.identifier('x')));
		expect(err.start).toBeUndefined();
		expect(err.end).toBeUndefined();
	});

	test('parse errors stay parse errors', () => {
		expect(() => evaluate('1 +')).toThrow(ParseError);
	});

	test('a stack overflow on a hand-built tree is an evaluation error', () => {
		let node: ast.ASTNode = ast.number(1);
		for (let i = 0; i < 2_000_000; i++) node = ast.negate(node);
		expect(
			failure(() => evaluate(node, { limits: { maxSteps: Number.POSITIVE_INFINITY } })).cause,
		).toBeInstanceOf(RangeError);
	});
});

describe('Function lookup', () => {
	test.each([['constructor'], ['toString'], ['hasOwnProperty'], ['valueOf'], ['__proto__']])(
		'%s is not inherited from Object.prototype',
		(name) => {
			expect(() => evaluate(`${name}()`, defaultContext)).toThrow(`Undefined function: ${name}`);
			expect(() => evaluate(`1 |> ${name}(?)`, { functions: {} })).toThrow(
				`Undefined function: ${name}`,
			);
		},
	);

	test('calls fail cleanly with no functions at all', () => {
		expect(() => evaluate('F()')).toThrow('Undefined function: F');
	});

	test('an own function may shadow those names', () => {
		const functions = Object.assign(Object.create(null), { constructor: () => 1 });
		expect(evaluate('constructor()', { functions })).toBe(1);
	});

	test('a non-function is reported', () => {
		const functions = { F: 1 } as unknown as Record<string, HostFunction>;
		expect(() => evaluate('F()', { functions })).toThrow('F is not a function');
	});
});

describe('Host values', () => {
	const returning = (value: unknown): ExecutionContext => ({
		functions: { F: (() => value) as HostFunction },
	});

	test.each([
		['undefined', undefined],
		['null', null],
		['object', { a: 1 }],
		['function', () => 1],
		['nested', [[null]]],
	])('a function cannot return %s', (_, value) => {
		expect(() => evaluate('F()', returning(value))).toThrow('Function F');
	});

	test('a function cannot return a heterogeneous array', () => {
		expect(() => evaluate('F()', returning([1, 'a']))).toThrow('heterogeneous array');
		expect(() => evaluate('F()', returning([[1], ['a']]))).toThrow('heterogeneous array');
	});

	test('valid results pass through', () => {
		expect(evaluate('F()', returning([[1], [], [2]]))).toEqual([[1], [], [2]]);
		expect(evaluate('F()', returning(Number.NaN))).toBeNaN();
	});

	test('variables are validated', () => {
		const bad = (value: unknown) => ({ variables: { x: value as RuntimeValue } });
		expect(() => evaluate('1', bad(null))).toThrow('Variable x');
		expect(() => evaluate('1', bad({}))).toThrow('Variable x');
		expect(() => evaluate('1', bad([1, 'a']))).toThrow('Variable x');
	});

	test('undefined variables count as absent', () => {
		const context = { variables: { x: undefined as unknown as RuntimeValue } };
		expect(() => evaluate('x', context)).toThrow('Undefined variable: x');
		expect(evaluate('x = 1\nx', context)).toBe(1);
	});

	test('a value aliasing an array exponentially validates in linear time', () => {
		let value: RuntimeValue = [1];
		for (let i = 0; i < 200; i++) value = [value, value];
		expect(evaluate('1', { variables: { x: value } })).toBe(1);
	});

	test('aliased empty arrays validate in linear time too', () => {
		let value: RuntimeValue = [];
		for (let i = 0; i < 200; i++) value = [value, value];
		expect(evaluate('1', { variables: { x: value } })).toBe(1);
	});
});

describe('Homogeneous arrays', () => {
	test.each([
		['[[1], ["a"]]'],
		['[[[1]], [["a"]]]'],
		['[[1], [[2]]]'],
		['[[], [1], ["a"]]'],
		['[[1], [], ["a"]]'],
		['[[[]], [1]]'],
		['[[true], [1]]'],
		['[[1], [[]]]'],
		['[[], [[]], [1]]'],
		['[[[[]], []], [[1]]]'],
		['[[1]] + [["a"]]'],
		['[[1]] + [[[1]]]'],
		['[[]] + [1]'],
		['[DATE(2024, 1, 1)] + [TIME(1, 2, 3)]'],
		['[DATE(2024, 1, 1), "a"]'],
		['for x in [1, 2] then if x > 1 then [1] else ["a"]'],
	])('%s is rejected', (source) => {
		expect(() => evaluate(source, defaultContext)).toThrow(EvaluationError);
	});

	test.each([
		['[[], []]'],
		['[[], [1]]'],
		['[[1], []]'],
		['[[], [[]], [[1]]]'],
		['[[[]], [], [[1]]]'],
		['[[1], [2, 3]]'],
		['[] + []'],
		['[] + [1]'],
		['[1] + []'],
		['[[]] + [[1]]'],
		['[[1]] + [[]]'],
		['[[], [[1]]] + [[[2]]]'],
		['[DATE(2024, 1, 1), DATE(2024, 1, 2)]'],
	])('%s is accepted', (source) => {
		expect(() => evaluate(source, defaultContext)).not.toThrow();
	});

	test('host arrays follow the same rules in either order', () => {
		const returning = (value: unknown): ExecutionContext => ({
			functions: { F: (() => value) as HostFunction },
		});
		const rejected = [
			[[1], [[]]],
			[[[]], [1]],
			[[], [[]], [1]],
			[[1], [], ['a']],
			[[[1]], [], [[['a']]]],
		];
		for (const value of rejected) {
			expect(() => evaluate('F()', returning(value))).toThrow('heterogeneous array');
		}
		const accepted = [
			[[], [1]],
			[[1], []],
			[[], [[]], [[1]]],
			[[[1]], [[]], []],
			[[[]], [], [[1]]],
		];
		for (const value of accepted) {
			expect(evaluate('F()', returning(value))).toEqual(value as RuntimeValue);
		}
	});

	test('errors name the nested types', () => {
		expect(() => evaluate('[[1], ["a"]]')).toThrow(
			'Heterogeneous array: expected array<number>, got array<string> at index 1',
		);
		expect(() => evaluate('[1, "a"]')).toThrow(
			'Heterogeneous array: expected number, got string at index 1',
		);
		expect(() => evaluate('[1] + ["a"]')).toThrow(
			'Cannot concatenate array<number> with array<string>',
		);
	});
});

describe('For loops', () => {
	test('the guard sees the accumulator', () => {
		expect(evaluate('for x in [1, 2, 3, 4] when acc < 3 into acc = 0 then acc + x')).toBe(3);
		expect(
			evaluate('acc = 100\nfor x in [1, 2, 3, 4] when acc < 3 into acc = 0 then acc + x'),
		).toBe(3);
	});

	test('bindings are restored afterwards', () => {
		const scope = evaluateScope('x = 1\nacc = 2\nr = for x in [5] into acc = 0 then acc + x');
		expect(scope).toEqual({ x: 1, acc: 2, r: 5 });
	});

	test('bindings disappear if they did not exist', () => {
		expect(evaluateScope('r = for x in [5] into acc = 0 then acc + x')).toEqual({ r: 5 });
	});

	test('the initial value is computed outside the loop bindings', () => {
		expect(evaluate('x = 10\nfor x in [1, 2] into t = x then t + x')).toBe(13);
		expect(evaluateScope('for x in [1] into t = (x = 7) then t')).toEqual({ x: 7 });
	});

	test('an accumulator or loop variable shadows an external of the same name', () => {
		const context = { variables: { x: 100 } };
		expect(evaluate('for i in [1, 2, 3] into x = 0 then x = x + i', context)).toBe(6);
		expect(evaluate('for x in [1, 2] then x = x * 2', context)).toEqual([2, 4]);
	});

	test('externals are back in force after the loop', () => {
		const context = { variables: { x: 100 } };
		expect(evaluate('for x in [1] then x\nx = 5\nx', context)).toBe(100);
		expect(evaluate('for i in [1] into x = 0 then x\nx = 5\nx', context)).toBe(100);
	});

	test('nested loops shadow correctly', () => {
		expect(
			evaluate('for x in [1, 2] into t = 0 then t + (for x in [10] into u = x then u + 1)'),
		).toBe(5);
	});

	test('strings iterate by code point', () => {
		expect(evaluate('for c in "a😀b" then c')).toEqual(['a', '😀', 'b']);
	});
});

describe('Assignment', () => {
	test('an external variable wins over an assignment', () => {
		expect(evaluate('x = 1\nx + 1', { variables: { x: 10 } })).toBe(11);
	});

	test('the right side still runs', () => {
		let calls = 0;
		const context: ExecutionContext = {
			variables: { x: 10 },
			functions: {
				F: () => {
					calls++;
					return 1;
				},
			},
		};
		expect(evaluate('x = F()', context)).toBe(10);
		expect(calls).toBe(1);
	});
});

describe('String indexing', () => {
	test('indexes by code point', () => {
		expect(evaluate('"a😀b"[1]')).toBe('😀');
		expect(evaluate('"a😀b"[2]')).toBe('b');
		expect(evaluate('"a😀b"[-1]')).toBe('b');
		expect(evaluate('"a😀b"[-2]')).toBe('😀');
		expect(() => evaluate('"a😀b"[3]')).toThrow('Index 3 out of bounds for length 3');
	});

	test('keeps lone surrogates', () => {
		expect(evaluate('s[1]', { variables: { s: 'a\ud83db' } })).toBe('\ud83d');
		expect(evaluate('s[1]', { variables: { s: 'a\udc00b' } })).toBe('\udc00');
	});

	test('expressions are not confused with one another', () => {
		expect(evaluate('[("ab" + "c")[0], ("xy" + "z")[0]]')).toEqual(['a', 'x']);
	});

	test('alternating strings do not confuse the cache', () => {
		const context = { ...defaultContext, variables: { a: 'x😀', b: 'yz' } };
		expect(evaluate('[a[1], b[1], a[0], b[0]]', context)).toEqual(['😀', 'z', 'x', 'y']);
	});

	test('reassigning a variable replaces what indexing sees', () => {
		expect(evaluate('s = "😀b"\na = s[1]\ns = "xyz"\na + s[1]')).toBe('by');
		expect(evaluate('s = "ab"\na = s[0]\ns = "😀😀"\na + s[1]')).toBe('a😀');
	});

	test('an assignment inside the index takes effect after the object is read', () => {
		expect(evaluate('s = "ab"\nx = s[if (s = "😀😀") == "" then 0 else 1]\nx + s[1]')).toBe('b😀');
	});

	test('a loop variable is reindexed on each iteration', () => {
		expect(evaluate('for w in ["😀b", "cd", "😀"] then w[0]')).toEqual(['😀', 'c', '😀']);
	});

	test('a shadowed variable indexes as itself', () => {
		expect(evaluate('s = "😀b"\na = s[1]\nb = for s in ["xy"] then s[1]\na + b[0] + s[1]')).toBe(
			'byb',
		);
	});

	test('a restored variable indexes as itself after a loop', () => {
		expect(evaluate('s = "ab"\nx = s[0]\nfor s in ["😀😀"] then s[1]\ns[1]')).toBe('b');
		expect(evaluate('for s in ["😀😀"] then s[1]\ns = "ab"\ns[1]')).toBe('b');
		expect(() => evaluate('for s in ["ab"] then s[1]\ns[1]')).toThrow('Undefined variable: s');
	});

	test('an accumulator is reindexed as it changes', () => {
		expect(evaluate('for i in 0..3 into s = "a" then s[0] + s')).toBe('aaaa');
	});

	test('an index does not outlive its evaluation', () => {
		expect(evaluate('s[1]', { variables: { s: '😀😀' } })).toBe('😀');
		expect(evaluate('s[1]', { variables: { s: 'ab' } })).toBe('b');
	});

	test('visiting every position is linear', () => {
		const text = 'x'.repeat(400_000);
		const context = { variables: { s: text }, limits: { maxSteps: 5_000_000 } };
		const source = 'for i in 0..200000 into t = 0 then if s[i] == "x" then t + 1 else t';
		expect(evaluate(source, context)).toBe(200_000);
	});
});

describe('Execution limits', () => {
	// Each program overruns a small budget but stays small in absolute terms, so a
	// bug in the metering fails these tests instead of exhausting the machine.
	const maxSteps = 100_000;
	const hostile: [string, string][] = [
		['doubling an array', 'for i in 0..22 into a = [1] then a + a'],
		['doubling a string', 'for i in 0..24 into s = "ab" then s + s'],
		['a large range', '0..3000000'],
		['many ranges', 'for i in 0..20 then 0..200000'],
		[
			'nested loops',
			'for i in 0..1000 into t = 0 then t + (for j in 0..1000 into u = 0 then u + 1)',
		],
		[
			'comparing aliased arrays',
			'a = for i in 0..20 into a = [1] then [a, a]\nb = for i in 0..20 into b = [1] then [b, b]\na == b',
		],
		['repeated comparison of arrays', 'a = 0..20000\nb = 0..20000\nfor i in 0..200 then a == b'],
		['repeated string scans', 's = STR_REPEAT("a", 20000)\nfor i in 0..200 then LEN(s)'],
		['repeatedly searching an array', 'a = 0..20000\nfor i in 0..200 then CONTAINS(a, -1)'],
		[
			'comparing long equal strings',
			'a = STR_REPEAT("x", 40000)\nb = STR_REPEAT("x", 40000)\nfor i in 0..50000 then a == b',
		],
		[
			'ordering long equal strings',
			'a = STR_REPEAT("x", 40000)\nb = STR_REPEAT("x", 40000)\nfor i in 0..50000 then a < b',
		],
		[
			'flattening a new string each time',
			's = STR_REPEAT("x", 200000)\nfor i in 0..1000 then (s + "y") < "a"',
		],
		[
			'indexing a new string each time',
			's = STR_REPEAT("x", 200000)\nfor i in 0..1000 then (s + "y")[0]',
		],
		[
			'validating a nested result',
			'a = for i in 0..200 then 0..100\nfor i in 0..500 then REVERSE(a)',
		],
		['allocating small arrays', 'for i in 0..1000 then for j in 0..1000 then [0]'],
		['a giant repeat', 'for i in 0..1000 then STR_REPEAT("ab", 100000)'],
		['flattening aliased arrays', 'a = 0..2000\nfor i in 0..17 into t = [a] then ARR_FLAT([t, t])'],
	];

	test.each(hostile)('%s stops', (_, source) => {
		const err = failure(() => evaluate(source, { ...defaultContext, limits: { maxSteps } }));
		expect(err.cause).toBeInstanceOf(LimitExceededError);
		expect(err.message).toBe('Evaluation exceeded its step limit');
	});

	test('the default budget applies without any configuration', () => {
		const err = failure(() => evaluate('0..20000001'));
		expect(err.cause).toBeInstanceOf(LimitExceededError);
		expect(evaluate('LEN(0..1000000)', defaultContext)).toBe(1_000_000);
	});

	test('a program within budget is unaffected', () => {
		expect(
			evaluate('for i in 0..1000 into t = 0 then t + i', { limits: { maxSteps: 10_000 } }),
		).toBe(499500);
	});

	test('a budget is exact', () => {
		expect(evaluate('1', { limits: { maxSteps: 1 } })).toBe(1);
		expect(() => evaluate('1', { limits: { maxSteps: 0 } })).toThrow('step limit');
		expect(stepsOf('1 + 2')).toBe(3);
	});

	test('the budget can be tightened', () => {
		const context = { limits: { maxSteps: 100 } };
		expect(() => evaluate('for i in 0..1000 into t = 0 then t + i', context)).toThrow('step limit');
	});

	test('the budget can be disabled', () => {
		const context = { limits: { maxSteps: Number.POSITIVE_INFINITY } };
		expect(
			evaluate('for i in 0..30 into a = [1] then if i < 20 then a + a else a', context),
		).toHaveLength(1 << 20);
	});

	test.each([[Number.NaN], ['abc'], [{}]])(
		'a budget of %p is an error, not a free pass',
		(value) => {
			const limits = { maxSteps: value as number };
			expect(() => evaluate('1', { limits })).toThrow(TypeError);
		},
	);

	test('the error points at the running expression', () => {
		const source = 'x = 0..1000\nx + x';
		const err = failure(() => evaluate(source, { limits: { maxSteps: 1500 } }));
		expect(source.slice(err.start, err.end)).toBe('x + x');
	});

	test('running out on an array or a loop points at it', () => {
		const array = 'x = 1\n  [1, 2]';
		const inArray = failure(() => evaluate(array, { limits: { maxSteps: 4 } }));
		expect(array.slice(inArray.start, inArray.end)).toBe('[1, 2]');

		const loop = 'for x in [1, 2, 3] into t = 0 then t';
		const inLoop = failure(() => evaluate(loop, { limits: { maxSteps: 8 } }));
		expect(loop.slice(inLoop.start, inLoop.end)).toBe(loop);
	});

	test('running out on a plain node points at that node', () => {
		const source = 'x = 1 + 2\nb = 2\nc = 3';
		const err = failure(() => evaluate(source, { limits: { maxSteps: 6 } }));
		expect(source.slice(err.start, err.end)).toBe('2');
		expect(err.start).toBe(14);
		expect(failure(() => evaluate('a = 1', { limits: { maxSteps: 0 } })).start).toBe(0);
	});

	test('each evaluation gets a fresh budget', () => {
		const context = { limits: { maxSteps: 50 } };
		for (let i = 0; i < 100; i++) {
			expect(evaluate('1 + 2', context)).toBe(3);
		}
	});

	test('a nested evaluation hands the outer budget back', () => {
		const context: ExecutionContext = {
			limits: { maxSteps: 1500 },
			functions: { INNER: () => evaluate('1', { limits: { maxSteps: 1e9 } }) },
		};
		expect(() => evaluate('for i in 0..1000 into t = 0 then t + INNER()', context)).toThrow(
			'step limit',
		);
	});

	test('a failed nested evaluation hands the outer budget back', () => {
		const failing: HostFunction = () => {
			try {
				return evaluate('1 + "a"', { limits: { maxSteps: 1e9 } });
			} catch {
				return 0;
			}
		};
		const context: ExecutionContext = { limits: { maxSteps: 1500 }, functions: { INNER: failing } };
		expect(() => evaluate('for i in 0..1000 into t = 0 then t + INNER()', context)).toThrow(
			'step limit',
		);
	});

	test('a nested evaluation has its own budget', () => {
		const context: ExecutionContext = {
			limits: { maxSteps: 100 },
			functions: { INNER: () => evaluate('for i in 0..1000 into t = 0 then t + 1') },
		};
		expect(evaluate('INNER() + 1', context)).toBe(1001);
	});

	test('the budget does not leak out of an evaluation', () => {
		expect(() => evaluate('0..1000', { limits: { maxSteps: 1 } })).toThrow(EvaluationError);
		expect(evaluate('LEN(0..100000)', defaultContext)).toBe(100000);
	});

	test('a host variable does not count against the budget', () => {
		const context = { variables: { x: Array.from({ length: 10_000 }, () => 1) } };
		expect(evaluate('1', { ...context, limits: { maxSteps: 1 } })).toBe(1);
		const nested = (): RuntimeValue => evaluate('1', { ...context, limits: { maxSteps: 1 } });
		expect(evaluate('F()', { functions: { F: nested }, limits: { maxSteps: 10 } })).toBe(1);
	});

	describe('step costs', () => {
		const strings = { a: 'x'.repeat(8000), b: 'x'.repeat(8000), c: 'y'.repeat(8000), d: 'y' };
		const date = Temporal.PlainDate.from('2024-01-01');
		const cost = (source: string, base: string, variables: Record<string, RuntimeValue> = {}) =>
			stepsOf(source, { ...defaultContext, variables }) -
			stepsOf(base, { ...defaultContext, variables });

		test('reading equal-length strings costs an eighth of a step per character', () => {
			expect(cost('a == b', 'a == d', strings)).toBe(2000);
			expect(cost('a == c', 'a == d', strings)).toBe(2000);
			expect(cost('a != b', 'a != d', strings)).toBe(2000);
		});

		test('strings of different lengths compare free', () => {
			expect(cost('a == d', '1 == 1', strings)).toBe(0);
		});

		test('ordering reads both strings', () => {
			expect(cost('a < b', '1 < 2', strings)).toBe(2000);
			expect(cost('a >= d', '1 >= 2', strings)).toBe(1000);
		});

		test('concatenating costs the shorter side', () => {
			expect(cost('x = a + d\n1', 'x = 1 + 2\n1', strings)).toBe(1);
			expect(cost('x = a + b\n1', 'x = 1 + 2\n1', strings)).toBe(8000);
		});

		test('dates cost 64 steps wherever they are used', () => {
			expect(cost('d == e', '1 == 2', { d: date, e: date })).toBe(64);
			expect(cost('d < e', '1 < 2', { d: date, e: date })).toBe(64);
			const variables = { d: date };
			expect(cost('YEAR(d)', 'ABS(1)', variables)).toBe(64);
			expect(cost('ADD_DAYS(d, 1)', 'MIN(1, 1)', variables)).toBe(128);
		});

		test('an array costs 2 steps on top of its elements', () => {
			expect(stepsOf('[1, 2]')).toBe(5);
			expect(stepsOf('[]')).toBe(3);
			expect(cost('for i in [] then i', '[]')).toBe(3);
		});

		test('a loop costs a step per iteration on top of its body', () => {
			expect(cost('for i in [1, 2, 3] then 1', 'for i in [] then 1')).toBe(3 * 2 + 3);
		});

		test('indexing a string by value pays its length each time', () => {
			expect(cost('(a + "")[0]', '(1 + 1)', strings)).toBeGreaterThanOrEqual(8000);
		});

		test('indexing a variable pays its length once', () => {
			const once = cost('a[0]', '1', strings);
			expect(once).toBeGreaterThanOrEqual(8000);
			expect(cost('[a[0], a[1], a[2]]', '[1, 1, 1]', strings) - once).toBeLessThan(20);
		});

		test('a string with surrogates pays again to split', () => {
			const variables = { s: '😀'.repeat(1000), t: 'x'.repeat(2000) };
			expect(cost('s[0]', 't[0]', variables)).toBe(2000);
		});

		test('shape checks are charged', () => {
			let deep: RuntimeValue = [];
			for (let i = 0; i < 100; i++) deep = [deep];
			expect(cost('[x, x]', '[1, 1]', { x: deep })).toBeGreaterThanOrEqual(200);
		});

		test('checking a host result is charged by its unique size', () => {
			const inner = [1, 2, 3];
			const shared: HostFunction = () => Array.from({ length: 100 }, () => inner);
			const distinct: HostFunction = () => Array.from({ length: 100 }, () => [1, 2, 3]);
			const steps = (F: HostFunction) => stepsOf('x = F()\n1', { functions: { F } });
			expect(steps(distinct) - steps(shared)).toBe(99 * 4);
		});

		test('an array argument costs what a reader of it would walk', () => {
			const inner = Array.from({ length: 100 }, () => 1);
			const ignore: HostFunction = () => 0;
			const steps = (x: RuntimeValue) =>
				stepsOf('F(x)', { functions: { F: ignore }, variables: { x } });
			expect(steps([inner, inner]) - steps([inner])).toBeGreaterThanOrEqual(101);
		});

		test('comparing arrays is charged per element', () => {
			const variables = { a: Array.from({ length: 1000 }, () => 1) };
			expect(cost('a == a', '1 == 1', variables)).toBe(1001);
		});
	});

	test('strings of different lengths compare without being read', () => {
		const context = {
			variables: { a: 'x'.repeat(1_000_000), b: 'y' },
			limits: { maxSteps: 1000 },
		};
		expect(evaluate('for i in 0..100 then a == b', context)).toHaveLength(100);
	});

	test('the library is unmetered outside an evaluation', () => {
		const { REVERSE } = defaultContext.functions as Record<string, HostFunction>;
		expect((REVERSE as HostFunction)(Array.from({ length: 1000 }, () => 1))).toHaveLength(1000);
	});
});

describe('Result size', () => {
	const maxSteps = 100_000;

	test.each([
		['serializing', (x: unknown) => JSON.stringify(x).length],
		['flattening', (x: unknown) => (x as unknown[]).flat(Number.POSITIVE_INFINITY).length],
	])('a host function %s an aliased argument is never reached', (_, read) => {
		let reached = false;
		const SAVE = ((x: unknown) => {
			reached = true;
			return read(x);
		}) as HostFunction;
		const source = 'a = for i in 0..60 into a = [1] then [a, a]\nSAVE(a)';
		const err = failure(() => evaluate(source, { functions: { SAVE }, limits: { maxSteps } }));
		expect(err.cause).toBeInstanceOf(LimitExceededError);
		expect(reached).toBe(false);
	});

	test.each([
		['an aliased array', 'for i in 0..60 into a = [1] then [a, a]'],
		['aliased strings', 's = STR_REPEAT("ab", 20000)\nfor i in 0..40 then s'],
		['a nested alias', 'a = 0..1000\nb = for i in 0..1000 then a\n[b]'],
	])('%s too large to read fails inside evaluate', (_, source) => {
		const err = failure(() => evaluate(source, { ...defaultContext, limits: { maxSteps } }));
		expect(err.cause).toBeInstanceOf(LimitExceededError);
		expect(err.message).toBe('Evaluation result exceeds the step limit');
		expect(source.slice(err.start, err.end)).toBe(source);
	});

	test('a scope is measured as well', () => {
		const source = 'x = for i in 0..60 into a = [1] then [a, a]\n1';
		const context = { limits: { maxSteps } };
		expect(evaluate(source, context)).toBe(1);
		expect(() => evaluateScope(source, context)).toThrow('result exceeds the step limit');
		expect(() => evaluateWithScope(source, context)).toThrow('result exceeds the step limit');
	});

	test('a scope does not count host variables', () => {
		const context = {
			variables: { big: Array.from({ length: 5000 }, () => 1) },
			limits: { maxSteps: 100 },
		};
		expect(evaluateScope('x = 1', context)).toEqual({ ...context.variables, x: 1 });
	});

	test('an array counts each alias', () => {
		const context = { limits: { maxSteps: 1000 } };
		expect(evaluate('a = 0..100\n[a, a, a]', context)).toHaveLength(3);
		expect(() => evaluate('a = 0..400\n[a, a, a]', context)).toThrow('result exceeds');
	});

	test('an array counts itself as well as its elements', () => {
		const empties = { x: [[], [], []] };
		expect(evaluate('x', { variables: empties, limits: { maxSteps: 4 } })).toEqual(empties.x);
		expect(() => evaluate('x', { variables: empties, limits: { maxSteps: 3 } })).toThrow(
			'result exceeds',
		);
	});

	test('a variable holding the result counts once', () => {
		const context = { limits: { maxSteps: 1500 } };
		expect(evaluateWithScope('x = 0..1000\nx', context).value).toHaveLength(1000);
	});

	test('every variable aliasing another counts in full', () => {
		const source = 'x = 0..100\na = x\nb = x\n1';
		const context = { limits: { maxSteps: 250 } };
		expect(evaluate(source, context)).toBe(1);
		expect(() => evaluateScope(source, context)).toThrow('result exceeds the step limit');
	});

	test('a result as large as the limit passes', () => {
		expect(evaluate('"abc"', { limits: { maxSteps: 3 } })).toBe('abc');
		expect(() => evaluate('"abcd"', { limits: { maxSteps: 3 } })).toThrow('result exceeds');
	});

	test('a result too deep to walk fails inside evaluate', () => {
		const source = 'for i in 0..2000000 into a = [] then [a]';
		const err = failure(() => evaluate(source, { limits: { maxSteps: Number.POSITIVE_INFINITY } }));
		expect(err.cause).toBeInstanceOf(RangeError);
	});
});

describe('Reusing an AST', () => {
	test('a replaced function takes effect on the next evaluation', () => {
		const functions: Record<string, HostFunction> = { f: () => 1 };
		const node = parse('f()');
		expect(evaluate(node, { functions })).toBe(1);
		functions.f = () => 2;
		expect(evaluate(node, { functions })).toBe(2);
	});

	test('a deleted function is gone on the next evaluation', () => {
		const functions: Record<string, HostFunction> = { f: () => 1 };
		const node = parse('f()');
		evaluate(node, { functions });
		delete functions.f;
		expect(() => evaluate(node, { functions })).toThrow('Undefined function: f');
	});

	test('trust is not remembered for a replaced function', () => {
		const functions = { ...defaultContext.functions };
		const node = parse('LEN(0..1000)');
		const context = { functions, limits: { maxSteps: 1005 } };
		expect(evaluate(node, context)).toBe(1000);
		functions.LEN = ((x: RuntimeValue[]) => x.length) as HostFunction;
		expect(() => evaluate(node, context)).toThrow('step limit');
	});

	test('alternating contexts each get their own functions', () => {
		const node = parse('f() + (1 |> f(?))');
		const one = { functions: { f: (() => 1) as HostFunction } };
		const two = { functions: { f: (() => 2) as HostFunction } };
		for (let i = 0; i < 3; i++) {
			expect(evaluate(node, one)).toBe(2);
			expect(evaluate(node, two)).toBe(4);
		}
	});

	test('a nested evaluation of the same AST with other functions', () => {
		const node = parse('f() + f()');
		let depth = 0;
		const outer: Record<string, HostFunction> = {
			f: () => {
				if (depth === 0) {
					depth = 1;
					const inner = evaluate(node, { functions: { f: () => 10 } }) as number;
					depth = 0;
					return inner;
				}
				return 1;
			},
		};
		expect(evaluate(node, { functions: outer })).toBe(40);
	});

	test('nodes shared by a hand-built AST compile once', () => {
		let shared: ast.ASTNode = ast.number(1);
		for (let i = 0; i < 40; i++) shared = ast.add(shared, shared);
		expect(() => evaluate(shared, { limits: { maxSteps: 1000 } })).toThrow('step limit');
	});

	test('shared nodes evaluate like separate ones', () => {
		const x = ast.assign('x', ast.add(ast.identifier('y'), ast.number(1)));
		const node = ast.program([
			ast.assign('y', ast.number(1)),
			x,
			ast.assign('y', ast.number(5)),
			x,
		]);
		expect(evaluate(node)).toBe(6);
	});
});

describe('Scope', () => {
	test('includes variables from the context', () => {
		expect(evaluateScope('x = 1', { variables: { y: 2 } })).toEqual({ x: 1, y: 2 });
	});

	test('__proto__ is an ordinary name', () => {
		const scope = evaluateScope('__proto__ = 5');
		expect(Object.getPrototypeOf(scope)).toBe(Object.prototype);
		expect(Object.keys(scope)).toEqual(['__proto__']);
		expect(({} as { polluted?: number }).polluted).toBeUndefined();
	});

	test('holds the host variables as they were at the start', () => {
		const variables: Record<string, RuntimeValue> = { x: 1, y: 2 };
		const functions: Record<string, HostFunction> = {
			f: () => {
				variables.x = 10;
				variables.y = 20;
				variables.z = 30;
				return 0;
			},
		};
		expect(evaluateScope('f()\nx', { functions, variables })).toEqual({ x: 1, y: 2 });
	});

	test('reads each host variable once', () => {
		let reads = 0;
		const variables = {
			get x() {
				reads++;
				return 1;
			},
		};
		evaluateScope('x', { variables });
		expect(reads).toBe(1);
	});

	test('reports the value and scope together', () => {
		expect(evaluateWithScope('x = 1\nx + 1')).toEqual({ value: 2, scope: { x: 1 } });
	});
});

test('an empty program evaluates to zero', () => {
	expect(evaluate(ast.program([]))).toBe(0);
});

test('a placeholder outside a pipe fails', () => {
	expect(() => evaluate(ast.placeholder())).toThrow('Placeholder outside pipe expression');
	expect(() => evaluate(ast.placeholder(), { limits: { maxSteps: 0 } })).toThrow('step limit');
});

test('parsing happens once for a reused AST', () => {
	const node = parse('x * 2');
	expect(evaluate(node, { variables: { x: 2 } })).toBe(4);
	expect(evaluate(node, { variables: { x: 3 } })).toBe(6);
});
