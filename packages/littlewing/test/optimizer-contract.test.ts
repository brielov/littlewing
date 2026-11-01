import { describe, expect, test } from 'bun:test';
import * as ast from '../src/ast';
import { type ASTNode, isProgram } from '../src/ast';
import { generate } from '../src/codegen';
import { EvaluationError } from '../src/errors';
import { evaluate, evaluateScope } from '../src/interpreter';
import { type OptimizeOptions, optimize } from '../src/optimizer';
import { parse } from '../src/parser';
import { defaultContext } from '../src/stdlib';
import type { ExecutionContext, HostFunction, RuntimeValue } from '../src/types';
import { createRandom, randomProgram } from './generators';

const VARIABLES: Record<string, RuntimeValue> = {
	a: 2,
	b: -3,
	c: 0.5,
	flag: true,
	off: false,
	text: 'hey',
	list: [1, 2, 3],
};
const EXTERNAL = new Set(Object.keys(VARIABLES));

/**
 * Run a program, recording its value or failure along with every function call
 * it makes, in order.
 */
function observe(node: ASTNode, scope = false): unknown {
	const calls: unknown[] = [];
	const context: ExecutionContext = {
		functions: {
			...defaultContext.functions,
			ABS: (x) => {
				calls.push(x);
				return Math.abs(x as number);
			},
		},
		variables: { ...VARIABLES },
	};
	try {
		const value = scope ? evaluateScope(node, context) : evaluate(node, context);
		return { value, calls };
	} catch (err) {
		return { failure: (err as Error).message, calls };
	}
}

describe('An optimized program behaves like the original', () => {
	const modes: [string, OptimizeOptions][] = [
		['by default', {}],
		['with propagation', { externalVariables: EXTERNAL }],
		['preserving scope', { preserveScope: true }],
		['with propagation, preserving scope', { externalVariables: EXTERNAL, preserveScope: true }],
	];

	test.each(modes)('%s', (_, options) => {
		const random = createRandom(11);
		for (let i = 0; i < 8_000; i++) {
			const node = parse(randomProgram(random));
			expect(observe(optimize(node, options))).toEqual(observe(node));
		}
	});

	test.each(modes.filter(([, options]) => options.preserveScope))(
		'and reports the same variables %s',
		(_, options) => {
			const random = createRandom(12);
			for (let i = 0; i < 4_000; i++) {
				const node = parse(randomProgram(random));
				expect(observe(optimize(node, options), true)).toEqual(observe(node, true));
			}
		},
	);

	test('and a second pass finds nothing more in generated programs', () => {
		const random = createRandom(13);
		for (let i = 0; i < 4_000; i++) {
			const once = optimize(parse(randomProgram(random)), { externalVariables: EXTERNAL });
			const twice = optimize(once, { externalVariables: EXTERNAL });
			expect(generate(twice)).toBe(generate(once));
		}
	});
});

describe('Code that fails stays code that fails', () => {
	const context: ExecutionContext = {
		...defaultContext,
		variables: { x: false },
	};

	test.each([
		['if x then 1 / 0 else 2', 2],
		['for i in [] then 1 / 0', []],
		['x && 1 % 0', false],
		['if x then [1, "a"] else 2', 2],
		['if x then "a"[9] else 2', 2],
		['if x then 1 + "a" else 2', 2],
		['if x then 2.5..3 else 2', 2],
	])('%s does not fail unless it runs', (source, expected) => {
		expect(evaluate(optimize(parse(source)), context)).toEqual(expected);
	});

	test.each([
		['1 / 0'],
		['1 % 0'],
		['1 + "a"'],
		['[1, "a"][0]'],
		['[1, 2 + "a"][0]'],
		['[1, UNKNOWN][0]'],
		['x = UNKNOWN; 5'],
		['x = 1 + "a"; 5'],
		['y = x; x = 1; y'],
		['-true'],
		['!0'],
		['UNKNOWN; 5'],
		['1 + "a"; 5'],
		['"a"[9]'],
		['[1][9]'],
		['1 && true'],
		['true && 1'],
		['if 1 then 2 else 3'],
		['!1'],
		['-"a"'],
		['2.5..3'],
		['3..1'],
	])('%s still fails', (source) => {
		const optimized = optimize(parse(source), { externalVariables: new Set() });
		expect(() => evaluate(optimized)).toThrow(EvaluationError);
	});
});

describe('Side effects survive', () => {
	const counting = (): ExecutionContext & { calls: number } => {
		const context = {
			calls: 0,
			functions: {
				F: (() => {
					context.calls++;
					return 1;
				}) as HostFunction,
			},
		};
		return context;
	};

	test.each([
		['[F(), 2][1]'],
		['[2, F()][0]'],
		['x = F(); 5'],
		['F(); 5'],
		['if true then F() else 0'],
		['true && F() == 1'],
		['1 + F()'],
	])('%s still calls F once', (source) => {
		const context = counting();
		evaluate(optimize(parse(source)), context);
		expect(context.calls).toBe(1);
	});

	test('an assignment inside an array keeps running', () => {
		expect(evaluate(optimize(parse('[y = 5, 2][1]; y')))).toBe(5);
	});

	test('a branch that cannot run does not', () => {
		const context = counting();
		evaluate(optimize(parse('if false then F() else 0')), context);
		evaluate(optimize(parse('false && F() == 1')), context);
		expect(context.calls).toBe(0);
	});
});

describe('Constant propagation', () => {
	const none = { externalVariables: new Set<string>() };
	const output = (source: string, options: OptimizeOptions = none): string =>
		generate(optimize(parse(source), options));

	test('chains through statements in one pass', () => {
		expect(output('a = 1; b = a + 1; c = b * 2; c')).toBe('4');
	});

	test('only reaches statements after the assignment', () => {
		expect(output('a = b; b = 1; a')).toBe('a = b\na');
	});

	test('is off without externalVariables', () => {
		expect(output('x = 1; y = x + 1; y', {})).toBe('x = 1\ny = x + 1\ny');
	});

	test('leaves externals alone', () => {
		expect(output('x = 1; x + 1', { externalVariables: new Set(['x']) })).toBe('x = 1\nx + 1');
	});

	test.each([
		['a variable assigned in a nested expression', 'x = 1; y = (x = 2); x'],
		['a variable assigned in a branch', 'x = 1; if c then (x = 2) else 0; x'],
		['a variable assigned in a loop', 'x = 1; for i in [1] then (x = i); x'],
		['a variable reassigned at the top level', 'x = 1; x = F(); x'],
		['a loop variable of the same name', 'x = 1; for x in [2] then x'],
		['an accumulator of the same name', 'x = 1; for i in [2] into x = 0 then x'],
	])('stays out of %s', (_, source) => {
		const node = parse(source);
		const context = { functions: { F: () => 7 }, variables: { c: true } };
		expect(evaluate(optimize(node, none), context)).toEqual(evaluate(node, context));
	});

	test('propagates into loops', () => {
		expect(output('x = 2; for i in list then i * x + (x + 1)')).toBe(
			'for i in list then i * 2 + 3',
		);
	});

	test('reports errors where the value is used', () => {
		const source = 'x = 2\ny = x + "a"\ny';
		try {
			evaluate(optimize(parse(source), none));
			expect.unreachable('should have thrown');
		} catch (err) {
			const { start, end } = err as EvaluationError;
			expect(source.slice(start, end)).toBe('x + "a"');
		}
	});

	test('a propagated value reports errors at the read', () => {
		const source = 'x = 1\nfor i in [1] when x then i';
		try {
			evaluate(optimize(parse(source), none));
			expect.unreachable('should have thrown');
		} catch (err) {
			const { start, end } = err as EvaluationError;
			expect(source.slice(start, end)).toBe('x');
		}
	});

	test('a long string stays in its variable, where indexing is cheap', () => {
		const text = 'x'.repeat(20_000);
		const source = `s = "${text}"\nfor i in 0..20000 into t = 0 then t + (if s[i] == "x" then 1 else 0)`;
		expect(evaluate(optimize(parse(source), none))).toBe(20_000);
	});

	test('a short string stays in its variable when indexed dynamically', () => {
		const text = `a${'b'.repeat(63)}`;
		const source = `s = "${text}"\nfor i in 0..500000 into t = 0 then t + (if s[i % 64] == "a" then 1 else 0)`;
		expect(evaluate(optimize(parse(source), none))).toBe(evaluate(source));
		expect(evaluate(source)).toBe(7813);
		expect(output(`s = "${text}"\ns[j]`)).toBe(`s = "${text}"\ns[j]`);
	});

	test('a constant index into a short string still folds', () => {
		expect(output('s = "abc"; [s[0], s[-1], s + "d"]')).toBe('["a", "c", "abcd"]');
	});

	test('a short string still propagates', () => {
		expect(output(`a = "${'x'.repeat(64)}"; a + "y"`)).toBe(`"${'x'.repeat(64)}y"`);
		expect(output(`a = "${'x'.repeat(65)}"; a + "y"`)).toContain('a + "y"');
	});

	test('copies of a long string do not multiply the output', () => {
		const text = 'x'.repeat(100_000);
		const list = Array.from({ length: 2000 }, () => 's').join(', ');
		expect(output(`s = "${text}"\n[${list}]`).length).toBeLessThan(120_000);
	});

	test('a dead branch that writes a variable blocks propagation, safely', () => {
		expect(output('x = 1; if false then (x = 2) else 0; x')).toBe('x = 1\nx');
	});

	test('a chain of thousands of statements stays fast', () => {
		let source = 'a0 = 1\n';
		for (let i = 1; i < 30_000; i++) source += `a${i} = a${i - 1} + 1\n`;
		source += 'a29999';
		const start = performance.now();
		expect(generate(optimize(parse(source), none))).toBe('30000');
		expect(performance.now() - start).toBeLessThan(3000);
	});
});

describe('Dead code', () => {
	const output = (source: string, options: OptimizeOptions = {}): string =>
		generate(optimize(parse(source), options));

	test('an unread constant goes', () => {
		expect(output('x = 1; y = 2; y')).toBe('y = 2\ny');
	});

	test('an overwritten constant goes', () => {
		expect(output('x = 1; x = 2; x')).toBe('x = 2\nx');
	});

	test('a read constant stays', () => {
		expect(output('x = 1; y = x; x = 2; y')).toBe('x = 1\ny = x\ny');
	});

	test('a value read by the next assignment stays', () => {
		expect(output('x = 1; x = x + 1; x')).toBe('x = 1\nx = x + 1\nx');
	});

	test('a pure statement goes', () => {
		expect(output('1; "a"; [1, 2]; 3')).toBe('3');
	});

	test('the last statement always stays', () => {
		expect(output('1')).toBe('1');
		expect(output('x = 1')).toBe('x = 1');
	});

	test('an assigned variable can be copied away', () => {
		expect(output('x = 1; y = x; 2')).toBe('2');
	});

	test('the first assignment makes a variable safe to copy', () => {
		expect(output('x = 1; y = x; x = 2; 5')).toBe('5');
	});

	test('an unassigned variable cannot', () => {
		expect(output('y = x; 2')).toBe('y = x\n2');
		expect(output('y = x; x = 1; 2')).toBe('y = x\n2');
	});

	test('a read in the same statement keeps the old value alive', () => {
		expect(output('x = [1, 2]; for x in x then x')).toBe('x = [1, 2]\nfor x in x then x');
		expect(output('x = 1; for i in [1] into x = x then x')).toBe(
			'x = 1\nfor i in [1] into x = x then x',
		);
	});

	test('a removed assignment leaves the scope behind', () => {
		const context = { functions: { F: () => 9 } };
		const optimized = optimize(parse('x = F(); x = 3; 0'));
		expect(evaluateScope(optimized, context)).toEqual({ x: 9 });
	});

	test('preserveScope keeps every assignment', () => {
		const source = 'x = 1; y = 2; x = 3; y';
		const optimized = optimize(parse(source), { preserveScope: true });
		expect(evaluateScope(optimized)).toEqual({ x: 3, y: 2 });
		expect(output('1; x = 2; 3', { preserveScope: true })).toBe('x = 2\n3');
	});

	test('the guard reads the accumulator, not an outer variable', () => {
		const source = 'acc = 5; for i in [1, 2] when acc > 0 into acc = 1 then acc + i';
		expect(output(source)).toBe('for i in [1, 2] when acc > 0 into acc = 1 then acc + i');
		expect(evaluate(optimize(parse(source)))).toBe(evaluate(source));
	});
});

describe('Folding limits', () => {
	test('values without a literal stay expressions', () => {
		expect(generate(optimize(parse('2 ^ 2000')))).toBe('2 ^ 2000');
		expect(generate(optimize(parse('(-8) ^ 0.5')))).toBe('(-8) ^ 0.5');
		expect(generate(optimize(parse('-(2 ^ 2000)')))).toBe('-2 ^ 2000');
	});

	test('negative zero folds', () => {
		expect(Object.is(evaluate(optimize(parse('0 * -1'))), -0)).toBe(true);
		expect(Object.is(evaluate(optimize(parse('-0'))), -0)).toBe(true);
	});

	test('a short program cannot fold into an enormous string', () => {
		let source = 's0 = "xx"\n';
		for (let i = 1; i < 60; i++) source += `s${i} = s${i - 1} + s${i - 1}\n`;
		source += 'LEN(s59)';
		const optimized = optimize(parse(source), { externalVariables: new Set() });
		expect(generate(optimized).length).toBeLessThan(20_000);
	});

	test('strings fold up to the limit', () => {
		const half = 'x'.repeat(2048);
		expect(generate(optimize(parse(`"${half}" + "${half}"`)))).toBe(`"${half}${half}"`);
		expect(generate(optimize(parse(`"${half}" + "${half}" + "x"`)))).toContain(' + ');
	});

	test('short ranges expand, long ones stay ranges', () => {
		expect(generate(optimize(parse('1..=3')))).toBe('[1, 2, 3]');
		expect(generate(optimize(parse('(1..=3)[1]')))).toBe('2');
		expect(generate(optimize(parse('0..64')))).toBe(
			`[${Array.from({ length: 64 }, (_, i) => i).join(', ')}]`,
		);
		expect(generate(optimize(parse('0..65')))).toBe('0..65');
		expect(generate(optimize(parse('0..1000000')))).toBe('0..1000000');
	});

	test('the range limit counts an inclusive end', () => {
		expect(generate(optimize(parse('0..=63')))).toStartWith('[0, 1');
		expect(generate(optimize(parse('0..=64')))).toBe('0..=64');
	});

	test('strings index by code point', () => {
		expect(generate(optimize(parse('"a😀b"[1]')))).toBe('"😀"');
		expect(generate(optimize(parse('"a😀b"[-1]')))).toBe('"b"');
	});

	test('an array of literals of mixed kinds does not fold', () => {
		expect(generate(optimize(parse('[1, "a"][0]')))).toBe('[1, "a"][0]');
	});

	test('a fractional index does not fold', () => {
		expect(generate(optimize(parse('[1, 2][0.5]')))).toBe('[1, 2][0.5]');
	});
});

describe('Comments', () => {
	test('stay with the statement that folds', () => {
		const source = '// lead\nx = 1 + 2 // trail\nx';
		expect(generate(optimize(parse(source)))).toBe('// lead\nx = 3 // trail\nx');
	});

	test('stay with a folded expression statement', () => {
		expect(generate(optimize(parse('// lead\n1 + 2 // trail')))).toBe('// lead\n3 // trail');
	});

	test('stay when a branch replaces its if', () => {
		expect(generate(optimize(parse('// lead\nif true then 1 else 2')))).toBe('// lead\n1');
	});

	test('merge when a program shrinks to one statement', () => {
		const optimized = optimize(parse('x = 1\ny = 2 // inline\n// end'));
		expect(generate(optimized)).toBe('y = 2 // inline // end');
	});

	test.each([
		['// c\ntrue || x', '// c\ntrue'],
		['// c\nfalse && x', '// c\nfalse'],
		['// c\ntrue && false', '// c\nfalse'],
		['// c\n0..3', '// c\n[0, 1, 2]'],
		['// c\n[1, 2][0]', '// c\n1'],
		['// c\n-(1 + 2)', '// c\n-3'],
	])('stay when %j folds', (source, expected) => {
		expect(generate(optimize(parse(source)))).toBe(expected);
	});

	test('a constant does not carry its comments to its reads', () => {
		const constant = { ...ast.number(1), trailingComments: ['// c'] };
		const node = ast.program([ast.assign('x', constant), ast.identifier('x')]);
		expect(generate(optimize(node, { externalVariables: new Set() }))).toBe('1');
	});

	test('a branch keeps its comments inside those of the if', () => {
		const branch = { ...ast.number(1), leadingComments: ['// b'], trailingComments: ['// y'] };
		const node = {
			...ast.ifExpr(ast.boolean(true), branch, ast.number(2)),
			leadingComments: ['// a'],
			trailingComments: ['// z'],
		};
		expect(generate(optimize(node))).toBe('// a\n// b\n1 // y // z');
	});

	test('a program keeps its leading comments when it unwraps', () => {
		const node = { ...ast.program([ast.number(1)]), leadingComments: ['// top'] };
		expect(generate(optimize(node))).toBe('// top\n1');
	});

	test('a propagated value keeps the comments of what it replaces', () => {
		const source = 'x = 1\n// note\nx // tail';
		const optimized = optimize(parse(source), { externalVariables: new Set() });
		expect(generate(optimized)).toBe('// note\n1 // tail');
	});
});

describe('Structure', () => {
	test('a placeholder stays in place, even under a constant condition', () => {
		const node = ast.pipeExpr(ast.number(1), 'F', [
			ast.ifExpr(ast.boolean(true), ast.placeholder(), ast.number(2)),
		]);
		const context = { functions: { F: (x: RuntimeValue) => x } };
		expect(() => evaluate(optimize(node), context)).toThrow('Placeholder outside pipe expression');
	});

	test.each([
		['after it succeeds', () => optimize(parse('1 + 1'))],
		[
			'after it throws',
			() => {
				try {
					optimize(null as unknown as ASTNode);
				} catch {
					// the budget must survive this
				}
			},
		],
	])('the budget of a running evaluation comes back %s', (_, run) => {
		const F: HostFunction = () => {
			run();
			return 1;
		};
		const context: ExecutionContext = { functions: { F }, limits: { maxSteps: 50 } };
		expect(() => evaluate('F()\nfor i in 0..100000 into t = 0 then t + 1', context)).toThrow(
			'exceeded its step limit',
		);
	});

	test('the result does not depend on the budget of a running evaluation', () => {
		const expected = generate(optimize(parse('"abcdefgh" + "ijklmnop"')));
		let inside = '';
		const context: ExecutionContext = {
			limits: { maxSteps: 8 },
			functions: {
				F: () => {
					inside = generate(optimize(parse('"abcdefgh" + "ijklmnop"')));
					return 1;
				},
			},
		};
		evaluate('F()', context);
		expect(inside).toBe(expected);
	});

	test('a single statement unwraps', () => {
		expect(isProgram(optimize(parse('x = 1; y = 2; y'), { externalVariables: new Set() }))).toBe(
			false,
		);
	});

	test('an unchanged node is returned as is', () => {
		const node = ast.identifier('x');
		expect(optimize(node)).toBe(node);
	});

	test('an empty program stays empty', () => {
		const node = ast.program([]);
		expect(optimize(node)).toBe(node);
	});

	test('spans survive folding', () => {
		const source = 'y + (1 + 2)';
		const node = optimize(parse(source));
		if (node.kind !== ast.NodeKind.BinaryOp) throw new Error('expected BinaryOp');
		expect(source.slice(node.right.start, node.right.end)).toBe('1 + 2');
	});
});
