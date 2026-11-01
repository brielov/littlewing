import type { Expression, Program, RecordMember, Statement } from './ast.js';
import { Precedence } from './ast.js';

const BINARY_PRECEDENCE = {
	'||': Precedence.Or,
	'&&': Precedence.And,
	'==': Precedence.Compare,
	'!=': Precedence.Compare,
	'<': Precedence.Compare,
	'>': Precedence.Compare,
	'<=': Precedence.Compare,
	'>=': Precedence.Compare,
	'+': Precedence.Add,
	'-': Precedence.Add,
	'*': Precedence.Multiply,
	'/': Precedence.Multiply,
	'%': Precedence.Multiply,
	'^': Precedence.Power,
} as const;

/** Write string text so it reads back the same, as a whole string or a piece of one. */
function escapeText(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('"', '\\"')
		.replaceAll('\n', '\\n')
		.replaceAll('\r', '\\r')
		.replaceAll('\t', '\\t')
		.replaceAll('#{', '\\#{');
}

/** The grammar level of a node's text, which decides where it needs parentheses. */
function precedenceOf(node: Expression): number {
	switch (node.kind) {
		case 'pipe':
			return Precedence.Pipe;
		case 'binary':
			return BINARY_PRECEDENCE[node.operator];
		case 'fallback':
			return Precedence.Fallback;
		case 'range':
			return Precedence.Range;
		case 'unary':
			return Precedence.Power;
		case 'member':
		case 'index':
			return Precedence.Postfix;
		default:
			return Precedence.Atom;
	}
}

/**
 * Write `node` where the grammar accepts `minimum` or tighter, with parentheses if
 * it needs them. `tail` says that nothing follows that an open expression could
 * absorb: `if` and `for` end in one, so they stay bare only there.
 */
function emit(node: Expression, minimum: number, tail: boolean): string {
	if (node.kind === 'if' || node.kind === 'for') {
		return tail ? emitBare(node, true) : `(${emitBare(node, true)})`;
	}
	if (precedenceOf(node) < minimum) return `(${emitBare(node, true)})`;
	return emitBare(node, tail);
}

function enclosed(node: Expression): string {
	return emit(node, Precedence.None, true);
}

function emitList(nodes: readonly Expression[]): string {
	return nodes.map(enclosed).join(', ');
}

function emitMember(member: RecordMember): string {
	if (member.kind === 'spread') return `...${enclosed(member.value)}`;
	if (member.shorthand) return member.name;
	return `${emitFieldKey(member.name)}: ${enclosed(member.value)}`;
}

const PLAIN_KEY = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;

function emitFieldKey(name: string): string {
	// A key stays bare only if it reads back as the same name, and within the limit
	const fits = name.length <= 2048 && Array.from(name).length <= 1024;
	if (fits && PLAIN_KEY.test(name) && name === name.normalize('NFC')) return name;
	return `"${escapeText(name)}"`;
}

function emitBare(node: Expression, tail: boolean): string {
	switch (node.kind) {
		case 'number':
			return node.text;
		case 'string':
			return `"${escapeText(node.value)}"`;
		case 'template':
			return `"${node.parts
				.map((part) => (typeof part === 'string' ? escapeText(part) : `#{${enclosed(part)}}`))
				.join('')}"`;
		case 'boolean':
			return node.value ? 'true' : 'false';
		case 'name':
			return node.name;
		case 'placeholder':
			return '?';
		case 'binary': {
			const precedence = BINARY_PRECEDENCE[node.operator];
			const right = node.operator === '^';
			const leftText = emit(node.left, right ? precedence + 1 : precedence, false);
			const rightText = emit(node.right, right ? precedence : precedence + 1, tail);
			return `${leftText} ${node.operator} ${rightText}`;
		}
		case 'unary':
			return `${node.operator}${emit(node.argument, Precedence.Power, tail)}`;
		case 'fallback':
			return `${emit(node.path, Precedence.Postfix, false)} ?? ${emit(node.fallback, Precedence.Fallback, tail)}`;
		case 'range': {
			const operator = node.inclusive ? '..=' : '..';
			return `${emit(node.from, Precedence.Range + 1, false)}${operator}${emit(node.to, Precedence.Range + 1, tail)}`;
		}
		case 'array':
			return `[${emitList(node.elements)}]`;
		case 'record':
			return node.members.length === 0 ? '{}' : `{ ${node.members.map(emitMember).join(', ')} }`;
		case 'member':
			// A `.` straight after a number would read as part of it
			return node.object.kind === 'number'
				? `${node.object.text} .${node.name}`
				: `${emit(node.object, Precedence.Postfix, false)}.${node.name}`;
		case 'index':
			return `${emit(node.object, Precedence.Postfix, false)}[${enclosed(node.index)}]`;
		case 'call':
			return `${node.name}(${emitList(node.args)})`;
		case 'pipe': {
			const step = node.args === null ? node.name : `${node.name}(${emitList(node.args)})`;
			return `${emit(node.value, Precedence.Pipe, false)} |> ${step}`;
		}
		case 'if':
			return `if ${enclosed(node.condition)} then ${enclosed(node.consequent)} else ${enclosed(node.alternate)}`;
		case 'for': {
			let code = `for ${node.variable} in ${enclosed(node.iterable)}`;
			if (node.guard) code += ` when ${enclosed(node.guard)}`;
			if (node.accumulator) {
				code += ` into ${node.accumulator.name} = ${enclosed(node.accumulator.initial)}`;
			}
			return `${code} then ${enclosed(node.body)}`;
		}
	}
}

function emitStatement(statement: Statement): string {
	if (statement.kind === 'binding') {
		return `${statement.name} ${statement.input ? '?=' : '='} ${enclosed(statement.value)}`;
	}
	return enclosed(statement);
}

/**
 * Write a program as source. For any tree the parser gives, the result parses
 * back to an equal tree, apart from offsets, unless the text itself passes a limit
 * of the language: it can add parentheses at the nesting limit, and normalizing a
 * name to NFC can lengthen it. Parentheses appear only where needed, and statements
 * are separated by line breaks.
 */
export function generate(program: Program): string {
	const lines: string[] = [];
	for (const statement of program.statements) {
		for (const comment of statement.leadingComments ?? []) lines.push(comment);
		const code = emitStatement(statement);
		lines.push(
			statement.trailingComments ? `${code} ${statement.trailingComments.join(' ')}` : code,
		);
	}
	for (const comment of program.trailingComments ?? []) lines.push(comment);
	return lines.join('\n');
}
