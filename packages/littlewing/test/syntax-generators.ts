import type { Expression, Program, RecordMember, Statement } from '../src/syntax/ast.ts';

/** A small seeded generator, so a failure can be reproduced. */
export function random(seed: number): (limit: number) => number {
	let state = seed >>> 0 || 1;
	return (limit) => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		state >>>= 0;
		return state % limit;
	};
}

const NAMES = ['a', 'b', 'total', 'año', '_x', 'tax_rate', 'Ω', 'x1', 'type'];
const FIELDS = ['price', 'if', 'null', 'then', 'type', 'é', 'x'];
const KEYS = ['tax id', 'a"b', 'line\nbreak', '#{x}', '', '\\', 'e\u0301', 'a'.repeat(1025)];
const NUMBERS = [
	'0',
	'1',
	'42',
	'3.14',
	'0.5',
	'1e6',
	'2.5E-3',
	'1_000_000',
	'1_000.000_1',
	'1.50',
];
const STRINGS = [
	'',
	'hello',
	'a"b',
	'back\\slash',
	'line\nbreak',
	'tab\t',
	'#{x}',
	'# {',
	'😀',
	'r\r',
];
const OPERATORS = [
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
] as const;

const SPAN = { start: 0, end: 0 };

export function randomExpression(next: (limit: number) => number, depth: number): Expression {
	const pick = <T>(items: readonly T[]): T => items[next(items.length)] as T;
	const sub = (): Expression => randomExpression(next, depth - 1);

	if (depth <= 0) {
		switch (next(4)) {
			case 0:
				return { kind: 'number', text: pick(NUMBERS), ...SPAN };
			case 1:
				return { kind: 'string', value: pick(STRINGS), ...SPAN };
			case 2:
				return { kind: 'boolean', value: next(2) === 0, ...SPAN };
			default:
				return { kind: 'name', name: pick(NAMES), ...SPAN };
		}
	}

	const path = (steps: number): Expression => {
		let node: Expression = { kind: 'name', name: pick(NAMES), ...SPAN };
		for (let i = 0; i < steps; i++) {
			node =
				next(2) === 0
					? { kind: 'member', object: node, name: pick(FIELDS), ...SPAN }
					: { kind: 'index', object: node, index: sub(), ...SPAN };
		}
		return node;
	};

	switch (next(15)) {
		case 0:
			return { kind: 'binary', operator: pick(OPERATORS), left: sub(), right: sub(), ...SPAN };
		case 1:
			return { kind: 'unary', operator: next(2) === 0 ? '-' : '!', argument: sub(), ...SPAN };
		case 2:
			return { kind: 'fallback', path: path(next(3)), fallback: sub(), ...SPAN };
		case 3:
			return { kind: 'range', from: sub(), to: sub(), inclusive: next(2) === 0, ...SPAN };
		case 4:
			return { kind: 'array', elements: Array.from({ length: next(3) }, sub), ...SPAN };
		case 5: {
			const members: RecordMember[] = [];
			const used = new Set<string>();
			for (let i = next(4); i > 0; i--) {
				if (next(3) === 0) {
					members.push({ kind: 'spread', value: sub(), ...SPAN });
					continue;
				}
				const shorthand = next(3) === 0;
				const name = shorthand ? pick(NAMES) : next(2) === 0 ? pick(FIELDS) : pick(KEYS);
				if (used.has(name)) continue;
				used.add(name);
				const value: Expression = shorthand ? { kind: 'name', name, ...SPAN } : sub();
				members.push({ kind: 'field', name, value, shorthand, ...SPAN });
			}
			return { kind: 'record', members, ...SPAN };
		}
		case 6:
			return { kind: 'member', object: sub(), name: pick(FIELDS), ...SPAN };
		case 7:
			return { kind: 'index', object: sub(), index: sub(), ...SPAN };
		case 8:
			return {
				kind: 'call',
				name: pick(NAMES),
				args: Array.from({ length: next(3) }, sub),
				...SPAN,
			};
		case 9: {
			if (next(2) === 0)
				return { kind: 'pipe', value: sub(), name: pick(NAMES), stepStart: 0, args: null, ...SPAN };
			const args: Expression[] = [{ kind: 'placeholder', ...SPAN }];
			for (let i = next(3); i > 0; i--) {
				const arg: Expression = next(2) === 0 ? { kind: 'placeholder', ...SPAN } : sub();
				args.splice(next(args.length + 1), 0, arg);
			}
			return { kind: 'pipe', value: sub(), name: pick(NAMES), stepStart: 0, args, ...SPAN };
		}
		case 10:
			return { kind: 'if', condition: sub(), consequent: sub(), alternate: sub(), ...SPAN };
		case 11:
			return {
				kind: 'for',
				variable: pick(NAMES),
				iterable: sub(),
				guard: next(2) === 0 ? sub() : null,
				accumulator: next(2) === 0 ? { name: pick(NAMES), initial: sub() } : null,
				body: sub(),
				...SPAN,
			};
		case 12: {
			const parts: (string | Expression)[] = [pick(STRINGS)];
			for (let i = next(3) + 1; i > 0; i--) parts.push(sub(), pick(STRINGS));
			return { kind: 'template', parts, ...SPAN };
		}
		default:
			return randomExpression(next, 0);
	}
}

export function randomProgram(next: (limit: number) => number, depth: number): Program {
	const statements: Statement[] = [];
	for (let i = next(3) + 1; i > 0; i--) {
		const value = randomExpression(next, depth);
		statements.push(
			next(2) === 0
				? value
				: {
						kind: 'binding',
						name: NAMES[next(NAMES.length)] as string,
						input: next(2) === 0,
						value,
						...SPAN,
					},
		);
	}
	return { kind: 'program', statements, ...SPAN };
}

const SOUP = [
	'if',
	'then',
	'else',
	'for',
	'in',
	'when',
	'into',
	'x',
	'y',
	'1',
	'2.5',
	'"a"',
	'"#{',
	'}',
	'{',
	'[',
	']',
	'(',
	')',
	',',
	';',
	'\n',
	':',
	'.',
	'..',
	'..=',
	'...',
	'?',
	'??',
	'?=',
	'=',
	'==',
	'+',
	'-',
	'*',
	'^',
	'!',
	'|>',
	'&&',
	'||',
	'null',
	'let',
	'#',
	'\\',
	'"',
	'_',
	'1_',
	'0x',
	'é',
	'\ud83d',
	'//c\n',
	'&',
	'|',
	'@',
	'.5',
];

/** Tokens in no order, which is where a parser hangs if it can. */
export function randomSoup(next: (limit: number) => number, length: number): string {
	let text = '';
	for (let i = 0; i < length; i++) {
		text += SOUP[next(SOUP.length)];
		if (next(3) === 0) text += ' ';
	}
	return text;
}
