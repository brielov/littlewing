import { describe, expect, test } from 'bun:test';
import type { Diagnostic } from '../src/diagnostics.ts';
import { ParseError } from '../src/errors.ts';
import type { Expression, Program } from '../src/syntax/ast.ts';
import { generate } from '../src/syntax/generate.ts';
import { parse, parseProgram } from '../src/syntax/parser.ts';
import { random, randomProgram, randomSoup } from './syntax-generators.ts';

function shape(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(shape);
	if (typeof value !== 'object' || value === null) return value;
	const copy: Record<string, unknown> = {};
	for (const [key, field] of Object.entries(value)) {
		if (key !== 'start' && key !== 'end' && key !== 'stepStart') copy[key] = shape(field);
	}
	return copy;
}

function codes(source: string): string[] {
	return parseProgram(source).diagnostics.map((d) => d.code);
}

function only(source: string): Expression {
	const program = parse(source);
	expect(program.statements.length).toBe(1);
	return program.statements[0] as Expression;
}

/** A compact spelling of how an expression grouped. */
function grouped(source: string): string {
	return generateGrouped(only(source));
}

function generateGrouped(node: Expression): string {
	switch (node.kind) {
		case 'binary':
			return `(${generateGrouped(node.left)} ${node.operator} ${generateGrouped(node.right)})`;
		case 'unary':
			return `(${node.operator}${generateGrouped(node.argument)})`;
		case 'fallback':
			return `(${generateGrouped(node.path)} ?? ${generateGrouped(node.fallback)})`;
		case 'range':
			return `(${generateGrouped(node.from)}${node.inclusive ? '..=' : '..'}${generateGrouped(node.to)})`;
		case 'member':
			return `(${generateGrouped(node.object)}.${node.name})`;
		case 'index':
			return `(${generateGrouped(node.object)}[${generateGrouped(node.index)}])`;
		case 'pipe':
			return `(${generateGrouped(node.value)} |> ${node.name})`;
		case 'if':
			return `(if ${generateGrouped(node.condition)} then ${generateGrouped(node.consequent)} else ${generateGrouped(node.alternate)})`;
		case 'name':
			return node.name;
		case 'number':
			return node.text;
		default:
			return node.kind;
	}
}

describe('precedence', () => {
	const cases: [string, string][] = [
		['2 + 3 * 4', '(2 + (3 * 4))'],
		['2 ^ 3 ^ 2', '(2 ^ (3 ^ 2))'],
		['-2 ^ 2', '(-(2 ^ 2))'],
		['-2 * 3', '((-2) * 3)'],
		['8 / -2 * 4', '((8 / (-2)) * 4)'],
		['2 ^ -1 * 3', '((2 ^ (-1)) * 3)'],
		['1 + 2..3 + 4', '((1 + 2)..(3 + 4))'],
		['a ?? b ?? c', '(a ?? (b ?? c))'],
		['x ?? 0 > 5', '((x ?? 0) > 5)'],
		['a ?? 1 + 2', '(a ?? (1 + 2))'],
		['a ?? 0..5', '(a ?? (0..5))'],
		['a == b == c', '((a == b) == c)'],
		['a && b || c', '((a && b) || c)'],
		['a || b |> F', '((a || b) |> F)'],
		['a |> F |> G', '((a |> F) |> G)'],
		['!a == b', '((!a) == b)'],
		['-x.y[0]', '(-((x.y)[0]))'],
		['a.b.c', '((a.b).c)'],
		['1 + if c then 2 else 3 + 4', '(1 + (if c then 2 else (3 + 4)))'],
		['if a then b else c |> F', '(if a then b else (c |> F))'],
	];
	for (const [source, want] of cases) {
		test(source, () => expect(grouped(source)).toBe(want));
	}
});

describe('what a grammar production can be followed by', () => {
	test('a pipe step is followed only by a pipe', () => {
		for (const bad of [
			'x |> F + 1',
			'x |> F.y',
			'x |> F[0]',
			'x |> F(?)[0]',
			'x |> F ^ 2',
			'x |> F == 2',
			'x |> F && y',
			'x |> F .. 3',
		]) {
			expect(codes(bad)).toEqual(['unexpected-token']);
		}
	});

	test('ranges do not chain, however they are reached', () => {
		for (const bad of [
			'1..2..3',
			'a == 1..2..3',
			'a && 1..2..3',
			'a || 1..2..3',
			'a ?? 1..2..3',
			'[a ?? 1..2..3]',
		]) {
			expect(codes(bad)).toEqual(['unexpected-token']);
		}
	});

	test('what ends an `if` is left to what holds it', () => {
		expect(grouped('if a then b else c |> F + 1')).toBe('((if a then b else (c |> F)) + 1)');
		expect(grouped('if a then b else c..d..e')).toBe('((if a then b else (c..d))..e)');
	});
});

describe('statements', () => {
	test('a line break ends a statement before -, ( and [', () => {
		expect(parse('a = 5\n-1').statements.length).toBe(2);
		expect(parse('a\n(b)').statements.length).toBe(2);
		expect(parse('a\n[1]').statements.length).toBe(2);
		expect(parse('a\n!b').statements.length).toBe(2);
		expect(parse('F\n(1)').statements.length).toBe(2);
	});

	test('other operators continue from the line before', () => {
		expect(parse('a\n  + 1').statements.length).toBe(1);
		expect(parse('a -\n  1').statements.length).toBe(1);
		expect(parse('a\n  .b\n  .c').statements.length).toBe(1);
		expect(parse('a\n  |> F').statements.length).toBe(1);
		expect(parse('a\n  ?? 1').statements.length).toBe(1);
	});

	test('enclosed code ignores line breaks', () => {
		expect(parse('(a\n  - 1)').statements.length).toBe(1);
		expect(parse('[a\n  -1]').statements.length).toBe(1);
		expect(parse('{ a: b\n  -1 }').statements.length).toBe(1);
		expect(parse('"#{a\n  -1}"').statements.length).toBe(1);
		expect(parse('if a\n-1 > 0 then b\n-1 else c').statements.length).toBe(1);
		expect(parse('for x in a\n-1 then x').statements.length).toBe(1);
		// The tail of a `for` is not enclosed
		expect(parse('for x in a then x\n- 1').statements.length).toBe(2);
		expect(parse('if a then b else c\n- 1').statements.length).toBe(2);
	});

	test('separators', () => {
		expect(parse('a = 1; b = 2; a + b').statements.length).toBe(3);
		expect(parse(';;a;;\n\n;b;').statements.length).toBe(2);
		expect(parse('a = 1\n\n// note\n\nb').statements.length).toBe(2);
		expect(codes('1 2')).toEqual(['unexpected-token']);
		expect(codes('x = 1 y = 2')).toEqual(['unexpected-token']);
	});

	test('bindings', () => {
		const statement = parse('rate ?= 0.1').statements[0];
		expect(statement?.kind).toBe('binding');
		expect(statement?.kind === 'binding' && statement.input).toBe(true);
		expect(parse('a\n= 1').statements[0]?.kind).toBe('binding');
		expect(codes('a = b = 1')).toEqual(['unexpected-token']);
		expect(codes('(x) = 5')).toEqual(['unexpected-token']);
	});
});

describe('tokens', () => {
	test('numbers', () => {
		for (const good of ['0', '0.5', '1_000', '1_000.000_1', '1e5', '1E+5', '2.5e-3', '1e1_0']) {
			expect(codes(good)).toEqual([]);
		}
		for (const bad of [
			'007',
			'1__0',
			'1_',
			'3x',
			'1e',
			'5.',
			'1.e5',
			'5.x',
			'.5',
			'x.5',
			'1 .5',
			'0_1',
			'1e+',
		]) {
			expect(codes(bad)).toContain('invalid-number');
		}
		expect(codes('1234567890123456789012345678901234')).toEqual([]);
		expect(codes('12345678901234567890123456789012345')).toEqual(['invalid-number']);
		expect(codes('1e999999')).toEqual(['invalid-number']);
		expect(codes('1e-6177')).toEqual(['invalid-number']);
		// Trailing zeros are not significant, however many there are
		expect(codes(`1.${'0'.repeat(2_000_000)}`)).toEqual([]);
		expect(codes('1.5000000000000000000000000000000000000')).toEqual([]);
	});

	test('dots', () => {
		expect(only('1..5').kind).toBe('range');
		expect(only('1.5..2.5').kind).toBe('range');
		expect(only('1..=5').kind).toBe('range');
		expect(codes('1..2..3')).toEqual(['unexpected-token']);
		expect(codes('1..2 == a')).toEqual([]);
		expect(codes('1..5 |> F')).toEqual([]);
		expect(codes('{ ...a }')).toEqual([]);
		expect(codes('...a')).toEqual(['unexpected-token']);
	});

	test('identifiers', () => {
		expect(codes('año = 1\nprecio_total\nΩ\n_x')).toEqual([]);
		const composed = parse('é'.normalize('NFD')).statements[0];
		expect(composed?.kind === 'name' && composed.name).toBe('é');
		expect(codes('precio_€')).toEqual(['invalid-character']);
		expect(codes('a\u00a0b')).toContain('invalid-character');
	});

	test('keywords', () => {
		for (const word of ['if', 'then', 'for', 'in', 'null', 'let', 'fn', 'match']) {
			expect(codes(`${word} = 1`)).not.toEqual([]);
			expect(codes(`x.${word}`)).toEqual([]);
			expect(codes(`{ ${word}: 1 }`)).toEqual([]);
		}
		expect(codes('type = 1\nitem.type')).toEqual([]);
	});

	test('strings', () => {
		const value = (source: string): string => {
			const node = only(source);
			return node.kind === 'string' ? node.value : 'not a string';
		};
		expect(value('"a\\nb\\tc\\r"')).toBe('a\nb\tc\r');
		expect(value('"\\"\\\\\\#"')).toBe('"\\#');
		expect(value('"\\u{41}\\u{1F600}\\u{10FFFF}"')).toBe('A😀\u{10ffff}');
		expect(value('"a#b"')).toBe('a#b');
		expect(value('"\\#{x}"')).toBe('#{x}');
		expect(value('"line\nbreak"')).toBe('line\nbreak');
		expect(codes('"\\q"')).toEqual(['invalid-escape']);
		expect(codes('"\\u{D800}"')).toEqual(['invalid-escape']);
		expect(codes('"\\u{110000}"')).toEqual(['invalid-escape']);
		expect(codes('"\\u{}"')).toEqual(['invalid-escape']);
		expect(codes('"\\u{1234567}"')).toEqual(['invalid-escape']);
		expect(codes('"\\u0041"')).toEqual(['invalid-escape']);
		expect(codes('"abc')).toEqual(['unterminated-string']);
		expect(codes('"abc\\')).toEqual(['unterminated-string']);
		expect(codes('"#{"a')).toEqual(['unterminated-string']);
	});

	test('unpaired surrogates are invalid anywhere', () => {
		expect(codes('\ud83d')).toEqual(['invalid-character']);
		expect(codes('"\ud83d"')).toEqual(['invalid-character']);
		expect(codes('x // \ude00')).toEqual(['invalid-character']);
		expect(codes('"😀" // 😀')).toEqual([]);
	});

	test('a byte order mark', () => {
		expect(codes('\ufeff1')).toEqual([]);
		expect(codes('1\ufeff')).toEqual(['invalid-character']);
	});

	test('line endings', () => {
		expect(parse('a\r\nb\rc\nd').statements.length).toBe(4);
	});
});

describe('interpolation', () => {
	test('text and expressions take turns', () => {
		const node = only('"a#{x}b#{y + 1}"');
		expect(node.kind === 'template' && node.parts.length).toBe(5);
		const empty = only('"#{x}"');
		expect(empty.kind === 'template' && empty.parts[0]).toBe('');
		expect(empty.kind === 'template' && empty.parts[2]).toBe('');
	});

	test('nests', () => {
		expect(codes('"#{if paid then "paid" else "due"}"')).toEqual([]);
		expect(codes('"#{"#{"#{x}"}"}"')).toEqual([]);
		expect(codes('"#{ { a: 1 }.a }"')).toEqual([]);
		expect(codes('"#{ { a }.a }"')).toEqual([]);
		expect(parse('"a#{x}" + "b"').statements.length).toBe(1);
	});

	test('does not end the string early', () => {
		expect(codes('"#{x')).toEqual(['unterminated-string']);
		expect(codes('"#{')).toEqual(['unterminated-string']);
		expect(codes('"#{x}')).toEqual(['unterminated-string']);
		expect(codes('"#{x} y')).toEqual(['unterminated-string']);
		expect(codes('"#{"a')).toContain('unterminated-string');
	});
});

describe('records', () => {
	test('members', () => {
		const node = only('{ name: "Ana", "tax id": 12, total, ...rest, if: 1, }');
		expect(node.kind === 'record' && node.members.length).toBe(5);
		expect(codes('{}')).toEqual([]);
	});

	test('explicit fields are unique, and spreads replace', () => {
		expect(codes('{ a: 1, a: 2 }')).toEqual(['duplicate-field']);
		expect(codes('{ a: 1, "a": 2 }')).toEqual(['duplicate-field']);
		expect(codes('{ a, a: 2 }')).toEqual(['duplicate-field']);
		expect(codes('{ a: 1, ...b, a: 2 }')).toEqual(['duplicate-field']);
		expect(codes('{ ...a, ...b, x: 1 }')).toEqual([]);
	});

	test('what a key can be', () => {
		expect(codes('{ "a#{b}": 1 }')).not.toEqual([]);
		expect(codes('{ 1: 2 }')).not.toEqual([]);
		expect(codes('{ if }')).not.toEqual([]);
		expect(codes('{ "a" }')).not.toEqual([]);
	});
});

describe('pipes', () => {
	test('steps', () => {
		expect(codes('x |> ABS')).toEqual([]);
		expect(codes('x |> ROUND(?, 2)')).toEqual([]);
		expect(codes('x |> MIN(?, ?)')).toEqual([]);
		expect(codes('x |> F((?), 2)')).toEqual([]);
		expect(codes('x |> F(?,)')).toEqual([]);
	});

	test('? is only a whole argument of a step', () => {
		expect(codes('x |> F()')).toEqual(['invalid-placeholder']);
		expect(codes('x |> F(1)')).toEqual(['invalid-placeholder']);
		expect(codes('?')).toEqual(['invalid-placeholder']);
		expect(codes('x |> F(? + 1)')).toEqual(['invalid-placeholder', 'invalid-placeholder']);
		expect(codes('x |> F(G(?), ?)')).toEqual(['invalid-placeholder']);
		expect(codes('F(?)')).toEqual(['invalid-placeholder']);
	});
});

describe('fallbacks', () => {
	test('take paths', () => {
		for (const good of [
			'a ?? 0',
			'a.b ?? 0',
			'a[0] ?? 0',
			'a.b[c].d ?? 0',
			'a[(i + 1) * 2] ?? 0',
		]) {
			expect(codes(good)).toEqual([]);
		}
	});

	test('reject anything else', () => {
		for (const bad of [
			'(a) ?? 0',
			'(a.b).c ?? 0',
			'(a / b) ?? 0',
			'F(x) ?? 0',
			'1 ?? 0',
			'("a") ?? 0',
			'a().b ?? 0',
		]) {
			expect(codes(bad)).toEqual(['invalid-fallback']);
		}
	});
});

describe('limits', () => {
	const nested = (n: number): string => `${'('.repeat(n)}1${')'.repeat(n)}`;

	test('nesting', () => {
		expect(codes(nested(256))).toEqual([]);
		expect(codes(nested(257))).toEqual(['too-deep']);
		expect(codes(`${'['.repeat(256)}${']'.repeat(256)}`)).toEqual([]);
		expect(codes(`${'['.repeat(257)}${']'.repeat(257)}`)).toEqual(['too-deep']);
	});

	test('an else if chain does not nest', () => {
		const chain = `${'if a then 1 else '.repeat(500)}2`;
		expect(codes(chain)).toEqual([]);
	});

	test('a keyword pair nests until it closes', () => {
		const condition = `${'if '.repeat(256)}a${' then 1 else 2'.repeat(256)}`;
		expect(codes(condition)).toEqual([]);
		const tooMany = `${'if '.repeat(257)}a${' then 1 else 2'.repeat(257)}`;
		expect(codes(tooMany)).toEqual(['too-deep']);
	});

	test('height', () => {
		const chain = (n: number): string => Array.from({ length: n }, () => '1').join(' + ');
		expect(codes(chain(1024))).toEqual([]);
		expect(codes(chain(1025))).toEqual(['too-deep']);
		expect(codes(`${'- '.repeat(1023)}1`)).toEqual([]);
		expect(codes(`${'- '.repeat(1024)}1`)).toEqual(['too-deep']);
		expect(codes(`x${' |> F'.repeat(1023)}`)).toEqual([]);
		expect(codes(`x${' |> F'.repeat(1024)}`)).toEqual(['too-deep']);
		expect(codes(`x${'.a'.repeat(1023)}`)).toEqual([]);
		expect(codes(`x${'.a'.repeat(1024)}`)).toEqual(['too-deep']);
	});

	test('parentheses add no height', () => {
		const sum = Array.from({ length: 1024 }, () => '1').join(' + ');
		expect(codes(`(((${sum})))`)).toEqual([]);
	});

	test('interpolation counts as its chain of +', () => {
		// "" + STR(a) + STR(a) + ...: the first join is over a call of a name, so
		// n interpolations have a height of n + 2
		expect(codes(`"${'#{a}'.repeat(1022)}"`)).toEqual([]);
		expect(codes(`"${'#{a}'.repeat(1023)}"`)).toEqual(['too-deep']);
		// Each piece of text is one more join
		expect(codes(`"${'#{a}b'.repeat(511)}"`)).toEqual([]);
		expect(codes(`"${'#{a}b'.repeat(512)}"`)).toEqual(['too-deep']);
	});

	test('identifiers', () => {
		expect(codes('a'.repeat(1024))).toEqual([]);
		expect(codes('a'.repeat(1025))).toEqual(['identifier-too-long']);
		expect(codes('é'.repeat(1024))).toEqual([]);
		expect(codes('𝐚'.repeat(1024))).toEqual([]);
		expect(codes('𝐚'.repeat(1025))).toEqual(['identifier-too-long']);
	});

	test('a deep program costs a report, not the stack', () => {
		for (const deep of [
			'('.repeat(100000),
			'['.repeat(100000),
			'- '.repeat(100000),
			'{a:'.repeat(100000),
			'"#{'.repeat(100000),
			'if '.repeat(100000),
			'2 ^ '.repeat(100000),
		]) {
			expect(codes(deep)[0]).toBe('too-deep');
		}
	});
});

describe('hostile sources stay linear', () => {
	test('names with many combining marks', () => {
		const name = `a${'\u0301'.repeat(150_000)}${'\u0323'.repeat(150_000)}`;
		expect(codes(name)).toEqual(['identifier-too-long']);
		const program = parse(`{ "${name}": 1 }`);
		expect(generate(program).length).toBeGreaterThan(300_000);
	});

	test('escapes with no end', () => {
		expect(parseProgram(`"${'\\u'.repeat(1_000_000)}"`).diagnostics.length).toBe(100);
		expect(parseProgram(`"${'\\u{4'.repeat(500_000)}"`).diagnostics.length).toBe(100);
	});

	test('errors are capped', () => {
		expect(codes('@'.repeat(1_000_000)).length).toBe(100);
		expect(codes('€'.repeat(1_000_000)).length).toBe(100);
		expect(codes('1 2\n'.repeat(1_000_000)).length).toBe(100);
	});

	test('messages stay short', () => {
		const longest = (source: string): number =>
			Math.max(...parseProgram(source).diagnostics.map((d) => d.message.length));
		expect(longest('1'.repeat(1_000_000))).toBeLessThan(100);
		expect(longest(`1 ${'a'.repeat(100_000)}`)).toBeLessThan(120);
		expect(longest(`{ ${'a'.repeat(1000)}: 1, ${'a'.repeat(1000)}: 2 }`)).toBeLessThan(100);
		expect(longest(`0${'😀'.repeat(100)}`)).toBeLessThan(100);
	});

	test('many comments', () => {
		const source = `${'//x\n'.repeat(500_000)}1`;
		expect(generate(parse(source)).length).toBe(source.length);
	});
});

describe('recovery', () => {
	test('reports each broken statement', () => {
		expect(codes('a = )\nb = ]\nc = 1\nd = (')).toEqual([
			'unexpected-token',
			'unexpected-token',
			'unexpected-token',
		]);
	});

	test('keeps the statements it can read', () => {
		const { program, diagnostics } = parseProgram('a = 1\nb = ]\nc = 2');
		expect(diagnostics.length).toBe(1);
		expect(program?.statements.length).toBe(2);
	});

	test('a stray closing token does not loop', () => {
		expect(codes('1\n)\n2')).toEqual(['unexpected-token']);
		expect(codes(')')).toEqual(['unexpected-token']);
		expect(codes(')))')).toEqual(['unexpected-token']);
		expect(codes('let x = 1\nlet y = 2')).toEqual(['unexpected-token', 'unexpected-token']);
	});

	test('an open bracket swallows line breaks while it is open', () => {
		expect(codes('F(1,\n 2 3,\n 4)\nx = ]')).toEqual(['unexpected-token', 'unexpected-token']);
	});

	test('a broken interpolation does not derail what follows', () => {
		expect(codes('"#{ ) } rest"\nx = ]')).toEqual(['unexpected-token', 'unexpected-token']);
		expect(codes('"#{ ) } a #{ 1 } b"\ny')).toEqual(['unexpected-token']);
		expect(codes('"#{ "#{ ) }" }"\ny')).toEqual(['unexpected-token']);
	});

	test('lexical errors do not stop the parser', () => {
		expect(codes('a = 007\nb = @ 1\nc = "\\q"\nd = ]')).toEqual([
			'invalid-number',
			'invalid-character',
			'invalid-escape',
			'unexpected-token',
		]);
	});

	test('one mistake is one error', () => {
		for (const source of ['x.5', '1 .5', 'a & b', 'a | b', 'a @ b']) {
			expect(codes(source).length).toBe(1);
		}
		expect(codes('x |> F(?, 1 2)')).toEqual(['unexpected-token']);
		expect(codes('a b\n  + c')).toEqual(['unexpected-token']);
	});

	test('recovery from a broken string finds its end', () => {
		expect(codes(`"${'#{a}'.repeat(2000)}"\nx`)).toEqual(['too-deep']);
		expect(codes(`${'"#{'.repeat(257)}1${'}"'.repeat(257)}`)).toEqual(['too-deep']);
		expect(codes('"#{ { 1 } + "\\"" }"\nx')).toEqual(['unexpected-token']);
	});

	test('a record too deep to open still counts as open', () => {
		const source = `"#{${'['.repeat(255)}{a:1} + "\\"" }"\nx = "t @ @"\ny = "@"`;
		expect(codes(source)).toEqual(['too-deep']);
	});

	test('an unterminated string is reported from its start', () => {
		const [first] = parseProgram('x = "#{').diagnostics;
		expect(first?.code).toBe('unterminated-string');
		expect(first?.start).toBe(4);
	});

	test('an invalid fallback is reported with its parentheses', () => {
		const [first] = parseProgram('(a) ?? 0').diagnostics;
		expect([first?.start, first?.end]).toEqual([0, 3]);
	});

	test('an empty program', () => {
		expect(codes('')).toEqual(['empty-program']);
		expect(codes('// nothing\n;;\n')).toEqual(['empty-program']);
	});

	test('diagnostics are in source order with exact spans', () => {
		const { diagnostics } = parseProgram('a = )\nb = 007');
		const spans = diagnostics.map((d: Diagnostic) => [d.code, d.start, d.end]);
		expect(spans).toEqual([
			['unexpected-token', 4, 5],
			['invalid-number', 10, 13],
		]);
	});

	test('parse throws the first error', () => {
		expect(() => parse('a = )')).toThrow(ParseError);
		try {
			parse('\n\n007');
		} catch (error) {
			expect(error).toBeInstanceOf(ParseError);
			expect((error as ParseError).code).toBe('invalid-number');
			expect((error as ParseError).start).toBe(2);
		}
	});

	test('token soup always ends, with a report', () => {
		for (let seed = 1; seed <= 4000; seed++) {
			const next = random(seed);
			const source = randomSoup(next, 1 + next(40));
			const { diagnostics } = parseProgram(source);
			for (const d of diagnostics) {
				expect(d.start).toBeLessThanOrEqual(d.end);
				expect(d.end).toBeLessThanOrEqual(source.length);
			}
		}
	});
});

describe('spans', () => {
	test('cover what was written', () => {
		const source = 'total = (a + b) * 2';
		const statement = parse(source).statements[0];
		expect(statement?.start).toBe(0);
		expect(statement?.end).toBe(source.length);
		if (statement?.kind !== 'binding') throw new Error('expected a binding');
		expect(source.slice(statement.value.start, statement.value.end)).toBe('(a + b) * 2');
	});
});

describe('generate', () => {
	const roundTrip = (source: string): string => generate(parse(source));

	test('parentheses appear only where needed', () => {
		const cases: [string, string][] = [
			['(a + b) * c', '(a + b) * c'],
			['(a * b) + c', 'a * b + c'],
			['a - (b - c)', 'a - (b - c)'],
			['(a ^ b) ^ c', '(a ^ b) ^ c'],
			['a ^ (b ^ c)', 'a ^ b ^ c'],
			['(-a) ^ 2', '(-a) ^ 2'],
			['(if a then b else c) + 1', '(if a then b else c) + 1'],
			['1 + (if a then b else c)', '1 + if a then b else c'],
			['(a |> F) + 1', '(a |> F) + 1'],
			['(a ?? b).c', '(a ?? b).c'],
			['a ?? (b ?? c)', 'a ?? b ?? c'],
			['(1..2)[0]', '(1..2)[0]'],
			['(a..b)..c', '(a..b)..c'],
		];
		for (const [source, want] of cases) expect(roundTrip(source)).toBe(want);
	});

	test('keeps what the author wrote', () => {
		expect(roundTrip('x = 1_000.50')).toBe('x = 1_000.50');
		expect(roundTrip('rate ?= 0.1')).toBe('rate ?= 0.1');
		expect(roundTrip('x |> ABS')).toBe('x |> ABS');
		expect(roundTrip('{ total, "tax id": 1, ...a }')).toBe('{ total, "tax id": 1, ...a }');
		expect(roundTrip('"a#{x}\\#{b}"')).toBe('"a#{x}\\#{b}"');
	});

	test('a number before a field keeps its nesting', () => {
		expect(roundTrip('1 .x')).toBe('1 .x');
		const nested = `${'['.repeat(256)}1 .x${']'.repeat(256)}`;
		expect(codes(roundTrip(nested))).toEqual([]);
	});

	test('a key too long to be a name stays quoted', () => {
		const key = 'a'.repeat(1025);
		expect(codes(roundTrip(`{ "${key}": 1 }`))).toEqual([]);
	});

	test('a comment inside a statement moves before it, and stays there', () => {
		const source = 'x = [1, // one\n  2] // two';
		const printed = roundTrip(source);
		expect(printed).toBe('// one\nx = [1, 2] // two');
		expect(roundTrip(printed)).toBe(printed);
	});

	test('a statement in parentheses holds its comments like any other', () => {
		const printed = roundTrip('(a // one\n) // two');
		expect(printed).toBe('// one\na // two');
		expect(roundTrip(printed)).toBe(printed);
	});

	test('keeps comments', () => {
		const source = '// first\na = 1 // inline\n\n// second\nb\n// last';
		expect(roundTrip(source)).toBe('// first\na = 1 // inline\n// second\nb\n// last');
		expect(generate(parse(roundTrip(source)))).toBe(roundTrip(source));
	});

	test('any tree survives a round trip', () => {
		for (let seed = 1; seed <= 3000; seed++) {
			const next = random(seed * 7919);
			const program: Program = randomProgram(next, 1 + next(4));
			const text = generate(program);
			const { program: back, diagnostics } = parseProgram(text);
			if (diagnostics.length > 0)
				throw new Error(`seed ${seed}: ${text}\n${diagnostics[0]?.message}`);
			expect(shape(back)).toEqual(shape(program));
		}
	});
});
