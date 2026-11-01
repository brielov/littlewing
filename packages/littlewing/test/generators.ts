import * as ast from '../src/ast';
import type { ASTNode, Operator } from '../src/ast';

/**
 * Seeded pseudo-random generator (mulberry32), so failures reproduce.
 */
export function createRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const OPERATORS: readonly Operator[] = [
	'+',
	'-',
	'*',
	'/',
	'%',
	'^',
	'==',
	'!=',
	'<',
	'>',
	'<=',
	'>=',
	'&&',
	'||',
];
const NAMES = ['a', 'b', 'c', 'flag', 'text', 'list'];
// Names that collide with variables, so that loops shadow them
const LOOP_NAMES = ['i', 'a', 'b', 'v'];
const TOTAL_NAMES = ['t', 'c', 'u'];

/**
 * Build a random AST of arbitrary shape. It need not evaluate, since it exists
 * to exercise every way one node can nest inside another.
 */
export function randomAst(random: () => number, depth: number): ASTNode {
	const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
	const node = (): ASTNode => randomAst(random, depth - 1);
	const name = (): string => pick(NAMES);
	const literal = (): ASTNode =>
		pick<() => ASTNode>([
			() => ast.number(pick([0, 1, 2.5, 1e21, 1e-7, 123456789012])),
			() => ast.string(pick(['', 'x', 'a"b', 'back\\slash', 'line\nbreak', '\ttab', 'cr\r'])),
			() => ast.boolean(random() < 0.5),
			() => ast.identifier(name()),
		])();

	if (depth <= 0) return literal();

	return pick<() => ASTNode>([
		literal,
		() => ast.binaryOp(node(), pick(OPERATORS), node()),
		() => ast.binaryOp(node(), pick(OPERATORS), node()),
		() => ast.unaryOp(pick(['-', '!'] as const), node()),
		() => ast.array(random() < 0.2 ? [] : [node(), node()]),
		() => ast.functionCall('F', random() < 0.2 ? [] : [node(), node()]),
		() => ast.assign(name(), node()),
		() => ast.ifExpr(node(), node(), node()),
		() =>
			ast.forExpr(
				'i',
				node(),
				random() < 0.5 ? node() : null,
				random() < 0.5 ? { name: 'acc', initial: node() } : null,
				node(),
			),
		() => ast.indexAccess(node(), node()),
		() => ast.rangeExpr(node(), node(), random() < 0.5),
		() =>
			ast.pipeExpr(node(), 'F', random() < 0.5 ? [ast.placeholder()] : [node(), ast.placeholder()]),
	])();
}

/**
 * Build a random numeric expression over values with no plain literal spelling.
 * All of it evaluates, which makes it a test of what those values mean in
 * every operand position.
 */
export function randomNumericAst(random: () => number, depth: number): ASTNode {
	const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
	const node = (): ASTNode => randomNumericAst(random, depth - 1);

	if (depth <= 0) {
		return ast.number(
			pick([
				0,
				-0,
				1,
				-1,
				-2,
				0.5,
				-0.5,
				1e21,
				-1e21,
				Number.POSITIVE_INFINITY,
				Number.NEGATIVE_INFINITY,
				Number.NaN,
			]),
		);
	}

	return pick<() => ASTNode>([
		() => ast.binaryOp(node(), pick(['+', '-', '*', '^'] as const), node()),
		() => ast.binaryOp(node(), pick(['+', '-', '*', '^'] as const), node()),
		() => ast.negate(node()),
		() => ast.indexAccess(ast.array([node(), node()]), ast.number(pick([0, 1]))),
		() => ast.ifExpr(ast.boolean(random() < 0.5), node(), node()),
		() => ast.pipeExpr(node(), 'ABS', [ast.placeholder()]),
		() => ast.functionCall('ABS', [node()]),
		() => ast.assign('v', node()),
	])();
}

/**
 * Build the source of a random, mostly well-typed program. Every sub-expression
 * is parenthesized so that its meaning cannot depend on code generation.
 */
export function randomProgram(random: () => number): string {
	const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
	const paren = (source: string): string => `(${source})`;

	const num = (d: number): string => {
		if (d <= 0)
			return pick([
				'0',
				'1',
				'2',
				'3',
				'10',
				'0.5',
				'a',
				'b',
				'c',
				'i',
				't',
				'LEN(text)',
				'list[0]',
			]);
		const n = (): string => num(d - 1);
		return pick<() => string>([
			() => paren(`${n()} ${pick(['+', '-', '*', '/', '%', '^'])} ${n()}`),
			() => paren(`-${n()}`),
			() => paren(`if ${bool(d - 1)} then ${n()} else ${n()}`),
			() => paren(`${arr(d - 1)}[${pick(['0', '-1', '1'])}]`),
			() => `ABS(${n()})`,
			() => paren(`${n()} |> ABS(?)`),
			() => paren(`${n()} |> MAX(?, ${n()})`),
			() => {
				const item = pick(LOOP_NAMES);
				const total = pick(TOTAL_NAMES);
				return paren(
					`for ${item} in ${arr(d - 1)} into ${total} = ${n()} then ${total} + ${pick([item, '1'])}`,
				);
			},
			() => paren(`v = ${n()}`),
			() => `LEN(${str(d - 1)})`,
		])();
	};
	const bool = (d: number): string => {
		if (d <= 0) return pick(['true', 'false', 'flag', 'off']);
		return pick<() => string>([
			() => paren(`${num(d - 1)} ${pick(['<', '>', '<=', '>=', '==', '!='])} ${num(d - 1)}`),
			() => paren(`${bool(d - 1)} ${pick(['&&', '||'])} ${bool(d - 1)}`),
			() => paren(`!${bool(d - 1)}`),
			() => paren(`if ${bool(d - 1)} then ${bool(d - 1)} else ${bool(d - 1)}`),
			() => paren(`${str(d - 1)} == ${str(d - 1)}`),
		])();
	};
	const str = (d: number): string => {
		if (d <= 0) return pick(['"x"', '"yz"', '""', 'text', '"a\\nb"', '"q\\"r"']);
		return pick<() => string>([
			() => paren(`${str(d - 1)} + ${str(d - 1)}`),
			() => paren(`if ${bool(d - 1)} then ${str(d - 1)} else ${str(d - 1)}`),
			() => paren(`${str(d - 1)} |> STR_UPPER(?)`),
			() => `STR(${num(d - 1)})`,
		])();
	};
	const arr = (d: number): string => {
		if (d <= 0) return pick(['[1, 2]', '[0]', 'list', '(1..4)', '(0..=2)']);
		return pick<() => string>([
			() => `[${num(d - 1)}, ${num(d - 1)}]`,
			() => paren(`${arr(d - 1)} + ${arr(d - 1)}`),
			() => paren(`if ${bool(d - 1)} then ${arr(d - 1)} else ${arr(d - 1)}`),
			() =>
				paren(
					`for i in ${arr(d - 1)} ${random() < 0.3 ? 'when i > 0 ' : ''}then ${pick(['i', 'i + 1', num(d - 1)])}`,
				),
			() => paren(`${pick(['0', '1'])}..${pick(['2', '3', 'LEN(text)'])}`),
			() => paren(`${arr(d - 1)} |> REVERSE(?)`),
		])();
	};

	const statements: string[] = [];
	const count = Math.floor(random() * 3);
	for (let i = 0; i < count; i++) {
		statements.push(`${pick(['v', 'i', 't', 'u'])} = ${pick([num, bool, str, arr])(3)}`);
	}
	statements.push(pick([num, bool, str, arr])(3));
	return statements.join('\n');
}
