import type { Expression, Field, Program, RecordMember, Spread, Statement } from './ast.js';

function list(nodes: readonly Expression[]): Expression[] {
	return nodes.map(desugar);
}

/**
 * `"a#{e}b"` becomes `"a" + STR(e) + "b"`, with empty text dropped, except that it
 * always begins with a string. Everything keeps the location of what it came from.
 */
function desugarTemplate(
	parts: readonly (string | Expression)[],
	start: number,
	end: number,
): Expression {
	let result: Expression = { kind: 'string', value: parts[0] as string, start, end };
	for (let i = 1; i < parts.length; i++) {
		const part = parts[i] as string | Expression;
		if (part === '') continue;

		let right: Expression;
		if (typeof part === 'string') {
			right = { kind: 'string', value: part, start, end };
		} else {
			right = {
				kind: 'call',
				name: 'STR',
				args: [desugar(part)],
				core: true,
				start: part.start,
				end: part.end,
			};
		}
		result = { kind: 'binary', operator: '+', left: result, right, start, end };
	}
	return result;
}

function desugarMember(member: RecordMember): Field | Spread {
	return { ...member, value: desugar(member.value) };
}

/**
 * Rewrite pipes and interpolation. A pipe becomes a call that evaluates its value
 * first, with placeholders for where it goes, so one value can fill several.
 */
export function desugar(node: Expression): Expression {
	switch (node.kind) {
		case 'number':
		case 'string':
		case 'boolean':
		case 'name':
		case 'placeholder':
			return node;
		case 'template':
			return desugarTemplate(node.parts, node.start, node.end);
		case 'binary':
			return { ...node, left: desugar(node.left), right: desugar(node.right) };
		case 'unary':
			return { ...node, argument: desugar(node.argument) };
		case 'fallback':
			return { ...node, path: desugar(node.path), fallback: desugar(node.fallback) };
		case 'range':
			return { ...node, from: desugar(node.from), to: desugar(node.to) };
		case 'array':
			return { ...node, elements: list(node.elements) };
		case 'record':
			return { ...node, members: node.members.map(desugarMember) };
		case 'member':
			return { ...node, object: desugar(node.object) };
		case 'index':
			return { ...node, object: desugar(node.object), index: desugar(node.index) };
		case 'call':
			return { ...node, args: list(node.args) };
		case 'pipe': {
			const { start, end, name, stepStart } = node;
			const piped = desugar(node.value);
			const args: Expression[] =
				node.args === null ? [{ kind: 'placeholder', start, end }] : list(node.args);
			return { kind: 'call', name, args, piped, stepStart, start, end };
		}
		case 'if':
			return {
				...node,
				condition: desugar(node.condition),
				consequent: desugar(node.consequent),
				alternate: desugar(node.alternate),
			};
		case 'for':
			return {
				...node,
				iterable: desugar(node.iterable),
				guard: node.guard && desugar(node.guard),
				accumulator: node.accumulator && {
					name: node.accumulator.name,
					initial: desugar(node.accumulator.initial),
				},
				body: desugar(node.body),
			};
	}
}

function desugarStatement(statement: Statement): Statement {
	if (statement.kind === 'binding') {
		return { ...statement, value: desugar(statement.value) };
	}
	return desugar(statement);
}

export function desugarProgram(program: Program): Program {
	return { ...program, statements: program.statements.map(desugarStatement) };
}
