import { describe, expect, test } from 'bun:test';
import * as ast from '../src/ast';
import { type ASTNode, isPipeExpression } from '../src/ast';
import { generate } from '../src/codegen';
import { evaluate } from '../src/interpreter';
import { optimize } from '../src/optimizer';
import { parse } from '../src/parser';
import { defaultContext } from '../src/stdlib';
import type { ExecutionContext } from '../src/types';
import { createRandom, randomAst, randomNumericAst, randomProgram } from './generators';
import { withoutSpans } from './helpers';

function expectRoundTrip(node: ASTNode): void {
	const code = generate(node);
	const reparsed = parse(code);
	expect(withoutSpans(reparsed)).toEqual(withoutSpans(node));
	expect(generate(reparsed)).toBe(code);
}

function outcome(run: () => unknown): unknown {
	try {
		return { value: run() };
	} catch {
		return 'error';
	}
}

const context = (): ExecutionContext => ({
	...defaultContext,
	variables: {
		a: 2,
		b: -3,
		c: 0.5,
		flag: true,
		off: false,
		text: 'hey',
		list: [1, 2, 3],
	},
});

/**
 * Offsets of every pair of grouping parentheses in `code`. Call parentheses
 * follow a name. The generators put no parentheses inside strings or comments.
 */
function groupingPairs(code: string): [number, number][] {
	const pairs: [number, number][] = [];
	const open: number[] = [];
	for (let i = 0; i < code.length; i++) {
		if (code[i] === '(') open.push(i);
		if (code[i] === ')') {
			const start = open.pop() as number;
			if (!/\w/.test(code[start - 1] ?? ' ')) pairs.push([start, i]);
		}
	}
	return pairs;
}

function parsesTo(code: string, expected: ASTNode): boolean {
	try {
		expect(withoutSpans(parse(code))).toEqual(expected);
		return true;
	} catch {
		return false;
	}
}

describe('Round trip', () => {
	test('any parseable AST survives generate and parse unchanged', () => {
		const random = createRandom(1);
		for (let i = 0; i < 20_000; i++) {
			expectRoundTrip(randomAst(random, 5));
		}
	});

	test('any list of statements stays separated', () => {
		const random = createRandom(2);
		for (let i = 0; i < 5_000; i++) {
			expectRoundTrip(
				ast.program([randomAst(random, 3), randomAst(random, 3), randomAst(random, 3)]),
			);
		}
	});

	test('comments never change what a statement means', () => {
		const random = createRandom(3);
		const comment = (text: string): string[] | undefined =>
			random() < 0.5 ? [`// ${text}`] : undefined;
		const statement = (): ASTNode => {
			const leading = comment('lead');
			const trailing = comment('trail');
			return {
				...randomAst(random, 2),
				...(leading ? { leadingComments: leading } : {}),
				...(trailing ? { trailingComments: trailing } : {}),
			};
		};
		for (let i = 0; i < 5_000; i++) {
			expectRoundTrip(ast.program([statement(), statement(), statement()]));
		}
	});

	test('every parenthesis is needed', () => {
		const random = createRandom(4);
		for (let i = 0; i < 2_000; i++) {
			const node = withoutSpans(parse(generate(randomAst(random, 4))));
			const code = generate(node);
			for (const [start, end] of groupingPairs(code)) {
				const inner = withoutSpans(parse(code.slice(start + 1, end)));
				if (isPipeExpression(inner)) continue; // always parenthesized as an operand
				const stripped = code.slice(0, start) + code.slice(start + 1, end) + code.slice(end + 1);
				expect(parsesTo(stripped, node)).toBe(false);
			}
		}
	});

	test('special numbers keep their value in every position', () => {
		const random = createRandom(5);
		const context = { functions: { ABS: (x: unknown) => Math.abs(x as number) } };
		for (let i = 0; i < 20_000; i++) {
			const node = randomNumericAst(random, 4);
			expect(evaluate(parse(generate(node)), context)).toBe(evaluate(node, context));
		}
	});

	test('optimized programs generate code that evaluates identically', () => {
		const random = createRandom(6);
		for (let i = 0; i < 5_000; i++) {
			const optimized = optimize(parse(randomProgram(random)));
			expect(outcome(() => evaluate(parse(generate(optimized)), context()))).toEqual(
				outcome(() => evaluate(optimized, context())),
			);
		}
	});
});

describe('Number generation', () => {
	test.each([
		[1e21, '1e+21'],
		[1e-7, '1e-7'],
		[1.5e300, '1.5e+300'],
		[0.1, '0.1'],
		[123456789012, '123456789012'],
	])('%d', (value, code) => {
		expect(generate(ast.number(value))).toBe(code);
		expect(evaluate(generate(ast.number(value)))).toBe(value);
	});

	test('negative literals read as negation', () => {
		const x = ast.identifier('x');
		expect(generate(ast.exponentiate(ast.number(-2), x))).toBe('(-2) ^ x');
		expect(generate(ast.indexAccess(ast.number(-2), x))).toBe('(-2)[x]');
		expect(generate(ast.exponentiate(x, ast.number(-2)))).toBe('x ^ -2');
		expect(generate(ast.subtract(x, ast.number(-2)))).toBe('x - -2');
		expect(evaluate(generate(ast.exponentiate(ast.number(-2), ast.number(2))))).toBe(4);
	});

	test('negative zero keeps its sign', () => {
		expect(generate(ast.number(-0))).toBe('-0');
		expect(Object.is(evaluate(generate(ast.number(-0))), -0)).toBe(true);
	});

	test('negative zero is parenthesized like any negation', () => {
		const x = ast.identifier('x');
		expect(generate(ast.exponentiate(ast.number(-0), x))).toBe('(-0) ^ x');
		expect(generate(ast.indexAccess(ast.number(-0), x))).toBe('(-0)[x]');
	});

	test.each([
		[Number.POSITIVE_INFINITY, '0 ^ -1'],
		[Number.NEGATIVE_INFINITY, '-0 ^ -1'],
		[Number.NaN, '(-1) ^ 0.5'],
	])('%d is spelled as an expression', (value, code) => {
		expect(generate(ast.number(value))).toBe(code);
		expect(evaluate(code)).toBe(value);
	});

	test('non-finite values are parenthesized by position', () => {
		const inf = ast.number(Number.POSITIVE_INFINITY);
		const negInf = ast.number(Number.NEGATIVE_INFINITY);
		const nan = ast.number(Number.NaN);
		const x = ast.identifier('x');
		expect(generate(ast.assign('x', inf))).toBe('x = 0 ^ -1');
		expect(generate(ast.functionCall('F', [inf]))).toBe('F(0 ^ -1)');
		expect(generate(ast.array([nan]))).toBe('[(-1) ^ 0.5]');
		expect(generate(ast.exponentiate(inf, ast.number(-1)))).toBe('(0 ^ -1) ^ -1');
		expect(evaluate(generate(ast.exponentiate(inf, ast.number(-1))))).toBe(0);
		expect(generate(ast.exponentiate(negInf, x))).toBe('(-0 ^ -1) ^ x');
		expect(generate(ast.indexAccess(nan, x))).toBe('((-1) ^ 0.5)[x]');
		expect(generate(ast.negate(nan))).toBe('-(-1) ^ 0.5');
		expect(generate(ast.negate(inf))).toBe('-0 ^ -1');
	});

	test('generated output is stable for special numbers', () => {
		for (const value of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, -0, -2]) {
			const code = generate(ast.number(value));
			expect(generate(parse(code))).toBe(code);
		}
	});
});

describe('String generation', () => {
	test('escapes what the lexer unescapes', () => {
		expect(generate(ast.string('"\\\n\r\t'))).toBe('"\\"\\\\\\n\\r\\t"');
	});

	test('round trips every code unit', () => {
		let all = '';
		for (let i = 0; i < 0x10000; i++) all += String.fromCharCode(i);
		expect(evaluate(generate(ast.string(all)))).toBe(all);
	});
});

describe('Nested programs', () => {
	const a = ast.identifier('a');
	const one = ast.number(1);

	test('a single statement stands for its expression', () => {
		const sum = ast.program([ast.add(one, one)]);
		expect(generate(ast.multiply(sum, ast.number(3)))).toBe('(1 + 1) * 3');
		expect(evaluate(generate(ast.multiply(sum, ast.number(3))))).toBe(6);
	});

	test('a comment on a nested expression cannot swallow what follows', () => {
		const node = ast.multiply(parse('1 + 2\n// note'), ast.number(3));
		expect(evaluate(generate(node))).toBe(evaluate(node));
	});

	test('a nested program takes the position of its expression', () => {
		const ifNode = ast.ifExpr(a, a, a);
		expect(generate(ast.add(one, ast.program([ifNode])))).toBe('1 + if a then a else a');
		expect(generate(ast.add(ast.program([ifNode]), one))).toBe('(if a then a else a) + 1');
	});

	test('an empty program evaluates to zero', () => {
		expect(generate(ast.program([]))).toBe('0');
		expect(evaluate(generate(ast.program([])))).toBe(evaluate(ast.program([])));
		expect(generate(ast.add(ast.program([]), one))).toBe('0 + 1');
	});

	test('multiple statements have no expression spelling', () => {
		expect(() => generate(ast.add(parse('a\nb'), one))).toThrow(
			'cannot be nested in an expression',
		);
		expect(() => generate(ast.array([ast.program([a, a])]))).toThrow(TypeError);
	});

	test('nested statements flatten in place', () => {
		const inner = { ...ast.program([a]), trailingComments: ['// t'] };
		expect(generate(ast.program([inner, one]))).toBe('a\n// t\n1');
	});

	test('leading comments on a program are kept', () => {
		const node = { ...ast.program([a]), leadingComments: ['// top'] };
		expect(generate(node)).toBe('// top\na');
	});
});

describe('Comment generation', () => {
	const a = ast.identifier('a');

	test('text without a comment marker gets one', () => {
		expect(generate({ ...a, leadingComments: ['note'] })).toBe('// note\na');
		expect(generate({ ...a, trailingComments: ['note'] })).toBe('a // note');
	});

	test('text cannot escape its comment', () => {
		const leading = generate({ ...a, leadingComments: ['// c\nb = 2'] });
		expect(leading).toBe('// c\n// b = 2\na');
		const trailing = { ...ast.number(1), trailingComments: ['// c\n2'] };
		expect(generate(trailing)).toBe('1 // c // 2');
		expect(evaluate(generate(trailing))).toBe(1);
		const carriageReturn = { ...ast.number(1), trailingComments: ['// c\r2'] };
		expect(evaluate(generate(carriageReturn))).toBe(1);
	});

	test('multiple trailing comments share one line', () => {
		expect(generate(parse('x = [ // a\n1 ] // b'))).toBe('x = [1] // a // b');
	});
});

describe('Open-ended expressions', () => {
	const a = ast.identifier('a');
	const b = ast.identifier('b');
	const c = ast.identifier('c');
	const ifNode = ast.ifExpr(a, b, c);

	test('stay bare where nothing follows', () => {
		expect(generate(ifNode)).toBe('if a then b else c');
		expect(generate(ast.add(a, ifNode))).toBe('a + if a then b else c');
		expect(generate(ast.negate(ifNode))).toBe('-if a then b else c');
		expect(generate(ast.assign('x', ifNode))).toBe('x = if a then b else c');
		expect(generate(ast.array([ifNode, a]))).toBe('[if a then b else c, a]');
		expect(generate(ast.functionCall('F', [ifNode, a]))).toBe('F(if a then b else c, a)');
		expect(generate(ast.ifExpr(ifNode, ifNode, ifNode))).toBe(
			'if if a then b else c then if a then b else c else if a then b else c',
		);
	});

	test('are parenthesized where something follows', () => {
		expect(generate(ast.indexAccess(ifNode, a))).toBe('(if a then b else c)[a]');
		expect(generate(ast.add(ifNode, a))).toBe('(if a then b else c) + a');
		expect(generate(ast.add(ast.add(a, ifNode), b))).toBe('a + (if a then b else c) + b');
		expect(generate(ast.add(ast.negate(ifNode), b))).toBe('-(if a then b else c) + b');
		expect(generate(ast.pipeExpr(ast.add(a, ifNode), 'F', [ast.placeholder()]))).toBe(
			'a + (if a then b else c) |> F(?)',
		);
		expect(generate(ast.rangeExpr(ifNode, a, false))).toBe('(if a then b else c)..a');
		expect(generate(ast.indexAccess(ast.forExpr('i', a, null, null, b), c))).toBe(
			'(for i in a then b)[c]',
		);
	});
});

describe('Parentheses', () => {
	test('generated output parses wherever the source did', () => {
		const nested = (n: number) => `${'-x ^ '.repeat(n)}x`;
		expect(() => parse(generate(parse(nested(120))))).not.toThrow();
		const bounds = (n: number) => `${'('.repeat(n)}a${' + b..c)'.repeat(n)}`;
		expect(() => parse(generate(parse(bounds(200))))).not.toThrow();
	});

	test.each([
		['(1 + 2) * 3'],
		['1 + 2 * 3'],
		['2 ^ 3 ^ 2'],
		['(2 ^ 3) ^ 2'],
		['(-x) ^ 2'],
		['-x ^ 2'],
		['-(x ^ 2)'],
		['1 + 2..3 + 4'],
		['8 / -x * 4'],
		['a - (b - c)'],
		['(a == b) == c'],
		['a == (b == c)'],
		['(a |> F(?)) + 1'],
		['1 + (a |> F(?)) * 2'],
		['x == (a |> F(?)) + 1'],
		['(x = 1) + 1'],
		['(x = 1)[0]'],
		['(a |> F(?))[0]'],
		['(1..3)[0]'],
		['(a..b)..c'],
		['a..(b..c)'],
		['-(a..b)'],
		['!(a && b)'],
		['(a || b) && c'],
		['a || b && c'],
	])('%s keeps its meaning', (source) => {
		expectRoundTrip(parse(source));
	});
});
