import { describe, expect, test } from 'bun:test';
import * as ast from '../src/ast';
import { type ASTNode, isProgram, NodeKind, type Program } from '../src/ast';
import { ParseError } from '../src/errors';
import { evaluate, evaluateScope } from '../src/interpreter';
import { parse } from '../src/parser';
import { withoutSpans } from './helpers';

function statementCount(source: string): number {
	const node = parse(source);
	return isProgram(node) ? node.statements.length : 1;
}

describe('Unary operator precedence', () => {
	test.each([
		['8 / -2 * 4', -16],
		['8 / -2 / 2', -2],
		['10 % -3 * 2', 2],
		['2 ^ -1 * 3', 1.5],
		['2 * -3 * 4', -24],
		['-2 * 3', -6],
		['-2 + 3', 1],
	])('%s', (source, expected) => {
		expect(evaluate(source)).toBe(expected);
	});

	test('exponentiation binds tighter than a leading minus', () => {
		expect(evaluate('-2 ^ 2')).toBe(-4);
		expect(evaluate('(-2) ^ 2')).toBe(4);
		expect(evaluate('2 ^ -3 ^ 2')).toBe(2 ** -9);
	});

	test('negation applies to the left operand only', () => {
		expect(withoutSpans(parse('-a * b'))).toEqual(
			withoutSpans(ast.multiply(ast.negate(ast.identifier('a')), ast.identifier('b'))),
		);
	});

	test('postfix indexing binds tighter than unary', () => {
		expect(evaluate('-[1, 2][1]')).toBe(-2);
	});

	test('logical not works with comparisons', () => {
		expect(evaluate('!true == false')).toBe(true);
	});
});

describe('Statement separators', () => {
	test('a semicolon always ends a statement', () => {
		expect(evaluate('a = 5; -1')).toBe(-1);
		expect(evaluateScope('a = 5; -1')).toEqual({ a: 5 });
		expect(evaluate('x = 3; y = x; (1 + 2)')).toBe(3);
		expect(evaluate('a = [1, 2]; [3, 4]')).toEqual([3, 4]);
		expect(evaluate('a = [1, 2]; [0]')).toEqual([0]);
	});

	test('repeated and trailing semicolons are harmless', () => {
		expect(evaluate(';;1;;;2;;')).toBe(2);
		expect(() => parse(';;;')).toThrow('Empty program');
	});

	test('a very long run of semicolons does not exhaust the stack', () => {
		expect(evaluate(`1${';'.repeat(1_000_000)}`)).toBe(1);
	});

	test('statements on one line need a semicolon', () => {
		expect(() => parse('1 2')).toThrow('Expected end of statement');
		expect(() => parse('x = 1 y = 2')).toThrow('Expected end of statement');
		expect(() => parse('a[0] (1)')).toThrow('Expected end of statement');
		expect(() => parse('true (1)')).toThrow('Expected end of statement');
	});

	test('a semicolon is not valid inside an expression', () => {
		expect(() => parse('(1; 2)')).toThrow('Expected closing parenthesis');
		expect(() => parse('[1; 2]')).toThrow('Expected closing bracket');
		expect(() => parse('MAX(1; 2)')).toThrow('Expected closing parenthesis');
	});

	test('a line break ends a statement before an ambiguous token', () => {
		expect(evaluate('a = 5\n-1')).toBe(-1);
		expect(evaluateScope('a = 5\n-1')).toEqual({ a: 5 });
		expect(evaluate('x = 3\ny = x\n(1 + 2)')).toBe(3);
		expect(evaluate('a = [1, 2]\n[1]')).toEqual([1]);
		expect(evaluate('a = 1\n[a]')).toEqual([1]);
		expect(evaluate('a = 5 // note\n// more\n-1')).toBe(-1);
		expect(evaluate('a = 5\r\n-1')).toBe(-1);
		expect(evaluate('a = 5\r-1')).toBe(-1);
	});

	test('a line break ends if and for tails', () => {
		expect(evaluate('x = if true then 1 else 2\n-1')).toBe(-1);
		expect(evaluate('x = for i in [1] then i\n[0]')).toEqual([0]);
	});

	test('binary operators continue onto the next line', () => {
		expect(evaluate('1\n+ 2')).toBe(3);
		expect(evaluate('2\n* 3\n/ 3')).toBe(2);
		expect(evaluate('true\n&& false')).toBe(false);
		expect(evaluate('1\n== 1')).toBe(true);
		expect(evaluate('-5\n|> ABS(?)', { functions: { ABS: Math.abs as never } })).toBe(5);
	});

	test('a trailing operator continues onto the next line', () => {
		expect(evaluate('5 -\n1')).toBe(4);
		expect(evaluate('x =\n-1')).toBe(-1);
	});

	test('line breaks are insignificant inside delimiters', () => {
		expect(evaluate('(5\n-1)')).toBe(4);
		expect(evaluate('[5\n-1]')).toEqual([4]);
		expect(evaluate('a = [1, 2]\n(a\n[1])')).toBe(2);
		expect(evaluate('ABS(5\n-1)', { functions: { ABS: Math.abs as never } })).toBe(4);
		expect(evaluate('[1, 2][0\n+ 1]')).toBe(2);
		expect(evaluate('x = 1\n[x\n-1, x]')).toEqual([0, 1]);
	});

	test('line breaks are insignificant between keyword pairs', () => {
		expect(evaluate('if 1\n-1 == 0\nthen 2\n-1\nelse 9')).toBe(1);
		expect(evaluate('for x in [[1, 2]]\n[0]\nthen x')).toEqual([1, 2]);
		expect(evaluate('for x in [1, 2]\nwhen x\n-1 > 0\ninto s = 0\n+ 1\nthen s + x')).toBe(3);
	});

	test('else and for bodies inherit the surrounding context', () => {
		expect(evaluate('(if false then 1 else 5\n-1)')).toBe(4);
		expect(evaluate('[for x in [1] then x\n-1]')).toEqual([[0]]);
	});

	test('a call must start on the same line as its name', () => {
		expect(statementCount('f\n(1)')).toBe(2);
		expect(statementCount('(f\n(1))')).toBe(1);
	});

	test('statements still separate without blank lines or semicolons', () => {
		expect(statementCount('a = 1\nb = 2\na + b')).toBe(3);
		expect(statementCount('a\n!b')).toBe(2);
		expect(statementCount('a\n"s"')).toBe(2);
		expect(statementCount('a\nif b then c else d')).toBe(2);
	});
});

describe('Number literals', () => {
	test.each([
		['1e3', 1000],
		['1E3', 1000],
		['1e+3', 1000],
		['25e-1', 2.5],
		['1.5e2', 150],
		['1e21', 1e21],
	])('%s', (source, expected) => {
		expect(evaluate(source)).toBe(expected);
	});

	test('an identifier cannot be glued to a number', () => {
		expect(() => parse('x = 2; 3x')).toThrow(ParseError);
		expect(() => parse('e5 = 7; 1e5e5')).toThrow(ParseError);
	});

	test('literals that overflow are rejected', () => {
		expect(() => parse('1e999')).toThrow('Number out of range');
		expect(() => parse('1'.repeat(400))).toThrow('Number out of range');
	});

	test('literals may underflow to zero', () => {
		expect(evaluate('1e-999')).toBe(0);
	});
});

describe('Reserved words', () => {
	test('true and false cannot be bound', () => {
		expect(() => parse('for true in [1] then 1')).toThrow('Expected identifier after "for"');
		expect(() => parse('for x in [1] into false = 0 then 1')).toThrow(
			'Expected identifier after "into"',
		);
		expect(() => parse('true = 1')).toThrow('Invalid assignment target');
		expect(() => parse('1 |> true(?)')).toThrow('Expected function name');
	});

	test('names may merely start with a keyword', () => {
		expect(evaluate('trueish = 1; intoView = 2; trueish + intoView')).toBe(3);
	});
});

describe('Else-if chains', () => {
	const chain = (branches: number): string => {
		let source = '';
		for (let i = 0; i < branches; i++) source += `if x == ${i} then ${i * 2} else `;
		return `${source}-1`;
	};

	test('long chains parse and evaluate in order', () => {
		const source = chain(1000);
		expect(evaluate(source, { variables: { x: 0 } })).toBe(0);
		expect(evaluate(source, { variables: { x: 999 } })).toBe(1998);
		expect(evaluate(source, { variables: { x: 5000 } })).toBe(-1);
	});

	test('match nested ifs exactly', () => {
		expect(withoutSpans(parse('if a then 1 else if b then 2 else 3 + 4'))).toEqual(
			withoutSpans(
				ast.ifExpr(
					ast.identifier('a'),
					ast.number(1),
					ast.ifExpr(ast.identifier('b'), ast.number(2), ast.add(ast.number(3), ast.number(4))),
				),
			),
		);
	});

	test('every branch spans to the end of the chain', () => {
		const source = 'x = if a then 1 else if b then 2 else 3';
		const node = parse(source) as ast.Assignment;
		const outer = node.value as ast.IfExpression;
		expect(source.slice(outer.start, outer.end)).toBe('if a then 1 else if b then 2 else 3');
		expect(source.slice(outer.alternate.start, outer.alternate.end)).toBe('if b then 2 else 3');
	});

	test('a parenthesized if is not part of the chain', () => {
		expect(evaluate('if false then 1 else (if false then 2 else 3) + 10')).toBe(13);
	});

	test('a line break ends the chain at statement level', () => {
		expect(evaluate('x = if false then 1 else if false then 2 else 3\n-1')).toBe(-1);
	});
});

describe('Identifier length', () => {
	test('names may be long, within reason', () => {
		expect(evaluate(`${'x'.repeat(1024)} = 1`)).toBe(1);
		expect(() => parse('x'.repeat(1025))).toThrow('Identifier is too long');
	});

	test('the error spans the name', () => {
		try {
			parse(`1 + ${'x'.repeat(2000)}`);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect((err as ParseError).start).toBe(4);
			expect((err as ParseError).end).toBe(2004);
		}
	});
});

describe('Binding rules', () => {
	test('the loop variable and accumulator must differ', () => {
		expect(() => parse('for x in [1] into x = 0 then x')).toThrow(
			'must not share its name with the loop variable',
		);
	});

	test('a parenthesized name is not an assignment target', () => {
		expect(() => parse('(x) = 5')).toThrow('Invalid assignment target');
	});
});

describe('Depth limit', () => {
	const nested: [string, (n: number) => string][] = [
		['parentheses', (n) => `${'('.repeat(n)}1${')'.repeat(n)}`],
		['arrays', (n) => `${'['.repeat(n)}${']'.repeat(n)}`],
		['calls', (n) => `${'F('.repeat(n)}1${')'.repeat(n)}`],
		['pipe arguments', (n) => `${'1 |> F(?, '.repeat(n)}1${')'.repeat(n)}`],
		['indexes', (n) => `${'a['.repeat(n)}0${']'.repeat(n)}`],
		['unary operators', (n) => `${'-'.repeat(n)}1`],
		['exponents', (n) => `${'2^'.repeat(n)}1`],
		['assignments', (n) => `${'a = '.repeat(n)}1`],
		['for bodies', (n) => `${'for i in a then '.repeat(n)}1`],
	];

	test.each(nested)('%s nest up to the limit', (_, build) => {
		expect(() => parse(build(200))).not.toThrow();
		expect(() => parse(build(100_000))).toThrow('too deeply nested');
	});

	const chains: [string, (n: number) => string][] = [
		['operators', (n) => `${'1+'.repeat(n)}1`],
		['indexes', (n) => `a${'[0]'.repeat(n)}`],
		['pipes', (n) => `1${' |> F(?)'.repeat(n)}`],
		['ranges', (n) => `${'1..'.repeat(n)}1`],
		['else branches', (n) => `${'if a then 1 else '.repeat(n)}1`],
	];

	test.each(chains)('%s chain up to the limit', (_, build) => {
		expect(() => parse(build(1000))).not.toThrow();
		expect(() => parse(build(100_000))).toThrow('too deeply nested');
	});

	test('the limits are exact', () => {
		const parens = (n: number) => `${'('.repeat(n)}1${')'.repeat(n)}`;
		expect(() => parse(parens(255))).not.toThrow();
		expect(() => parse(parens(256))).toThrow('too deeply nested');

		const chain = (n: number) => `${'1+'.repeat(n)}1`;
		expect(() => parse(chain(1023))).not.toThrow();
		expect(() => parse(chain(1024))).toThrow('too deeply nested');
	});

	test('a chain built on a chain is as tall as both together', () => {
		const chain = '+1'.repeat(600);
		expect(() => parse(`(1${chain})${chain}`)).toThrow('too deeply nested');
		expect(() => parse(`(1${'+1'.repeat(400)})${'+1'.repeat(400)}`)).not.toThrow();
	});

	test('chains stacked through nesting cannot evade the limit', () => {
		const chain = '+1'.repeat(900);
		expect(() => parse(`${'('.repeat(9)}1${`${chain})`.repeat(9)}${chain}`)).toThrow(
			'too deeply nested',
		);
	});

	test('an index chain counts the object it applies to', () => {
		expect(() => parse(`(1${'+1'.repeat(1000)})${'[0]'.repeat(100)}`)).toThrow('too deeply nested');
	});

	test('an else-if chain counts the branches it wraps', () => {
		const chain = (n: number, last: string) => `${'if a then 1 else '.repeat(n)}${last}`;
		expect(() => parse(chain(800, `1${'+1'.repeat(100)}`))).not.toThrow();
		expect(() => parse(chain(800, `1${'+1'.repeat(300)}`))).toThrow('too deeply nested');
		expect(() =>
			parse(`${'if a then 1 else '.repeat(800)}if ${`1${'+1'.repeat(300)}`} then 1 else 2`),
		).toThrow('too deeply nested');
	});

	test('sibling subtrees do not add up', () => {
		const deep = `${'('.repeat(200)}1${')'.repeat(200)}`;
		const chain = `1${'+1'.repeat(900)}`;
		expect(() => parse(`[${deep}, ${chain}]`)).not.toThrow();
		expect(() => parse(`${chain} == (${chain})`)).not.toThrow();
		expect(() => parse(`[${chain}, ${chain}, ${chain}]`)).not.toThrow();
	});

	test('every accepted AST stays within the height limit', () => {
		const height = (node: ASTNode): number => {
			let tallest = 0;
			ast.forEachChild(node, (child) => {
				tallest = Math.max(tallest, height(child));
			});
			return tallest + 1;
		};
		const chain = '+1'.repeat(500);
		expect(height(parse(`(1${chain})${chain}`))).toBeLessThanOrEqual(1024);
	});
});

describe('Source spans', () => {
	function spanText(source: string, node: ASTNode): string {
		return source.slice(node.start, node.end);
	}

	test('expressions cover their full text', () => {
		const source = '  1 + MAX(2, 3) * x[0]  ';
		const node = parse(source);
		expect(spanText(source, node)).toBe('1 + MAX(2, 3) * x[0]');
		if (node.kind !== NodeKind.BinaryOp) throw new Error('expected BinaryOp');
		expect(spanText(source, node.right)).toBe('MAX(2, 3) * x[0]');
	});

	test.each([
		['"text"'],
		['true'],
		['[1, 2]'],
		['-x'],
		['x = 1 + 2'],
		['if a then b else c'],
		['for i in a when b into c = 0 then d'],
		['1..=3'],
		['1 |> F(?)'],
	])('%s', (source) => {
		expect(spanText(source, parse(source))).toBe(source);
	});

	test('parentheses are not part of the inner expression', () => {
		const source = '(1 + 2)';
		expect(spanText(source, parse(source))).toBe('1 + 2');
	});

	test('a parenthesized left operand starts the outer span at the parenthesis', () => {
		const source = '(1 + 2) * 3';
		expect(spanText(source, parse(source))).toBe(source);
	});

	test('a program covers its statements', () => {
		const source = '\n  a = 1; b = 2 ; \n';
		expect(spanText(source, parse(source))).toBe('a = 1; b = 2');
	});

	test('a program includes the parentheses around its last statement', () => {
		const source = '(a)\n(b);';
		expect(spanText(source, parse(source))).toBe('(a)\n(b)');
	});

	test('a program keeps its span alongside trailing comments', () => {
		const source = 'a\n// done';
		const program = parse(source);
		expect(spanText(source, program)).toBe('a');
		expect(program.trailingComments).toEqual(['// done']);
	});

	test('statements keep their spans when comments attach', () => {
		const source = '// lead\nx = 1 // trail\ny = 2';
		const program = parse(source) as Program;
		expect(spanText(source, program.statements[0] as ASTNode)).toBe('x = 1');
	});

	test('errors report their position', () => {
		try {
			parse('1 + then');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect((err as ParseError).start).toBe(4);
			expect((err as ParseError).end).toBe(8);
		}
	});
});

describe('Comment attachment', () => {
	test('routes comments to the nearest statement', () => {
		const node = parse('// a\n// b\nx = 1 // c\n// d\ny = 2 // e\n// f') as Program;
		expect(node.statements[0]?.leadingComments).toEqual(['// a', '// b']);
		expect(node.statements[0]?.trailingComments).toEqual(['// c']);
		expect(node.statements[1]?.leadingComments).toEqual(['// d']);
		expect(node.statements[1]?.trailingComments).toEqual(['// e']);
		expect(node.trailingComments).toEqual(['// f']);
	});

	test('a comment after a semicolon stays inline', () => {
		const node = parse('x = 1; // a\ny = 2') as Program;
		expect(node.statements[0]?.trailingComments).toEqual(['// a']);
	});

	test('handles many commented statements in one pass', () => {
		let source = '';
		for (let i = 0; i < 20_000; i++) source += `// note ${i}\nv${i} = ${i}\n`;
		const node = parse(source) as Program;
		expect(node.statements).toHaveLength(20_000);
		expect(node.statements[19_999]?.leadingComments).toEqual(['// note 19999']);
	});
});
