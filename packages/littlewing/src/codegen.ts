import * as ast from './ast.js';
import {
	type ASTNode,
	type Identifier,
	NodeKind,
	type NumberLiteral,
	type Program,
} from './ast.js';
import { getOperatorPrecedence, Precedence } from './utils.js';

/**
 * Escape a string value for code generation
 */
function escapeString(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

/**
 * Rewrite a number the language has no literal for as the expression it reads as.
 */
function spellNumber(node: NumberLiteral): ASTNode {
	const { value } = node;
	if (Number.isNaN(value)) {
		return ast.exponentiate(ast.negate(ast.number(1)), ast.number(0.5));
	}
	if (value === Number.POSITIVE_INFINITY) {
		return ast.exponentiate(ast.number(0), ast.negate(ast.number(1)));
	}
	return value < 0 || Object.is(value, -0) ? ast.negate(ast.number(-value)) : node;
}

/**
 * Get the expression a nested Program stands for. Statements have no spelling
 * inside an expression, so only a Program of at most one statement can nest.
 */
function nestedExpression(node: Program): ASTNode {
	if (node.statements.length > 1) {
		throw new TypeError('A Program with multiple statements cannot be nested in an expression');
	}
	return node.statements[0] ?? ast.number(0);
}

/**
 * Get the grammar level of a node's source text, which decides where it needs
 * parentheses.
 */
function precedenceOf(node: ASTNode): Precedence {
	switch (node.kind) {
		case NodeKind.Assignment:
			return Precedence.Assignment;
		case NodeKind.PipeExpression:
			return Precedence.Pipe;
		case NodeKind.BinaryOp:
			return getOperatorPrecedence(node.operator);
		case NodeKind.RangeExpression:
			return Precedence.Range;
		case NodeKind.UnaryOp:
			return Precedence.Exponent;
		case NodeKind.IndexAccess:
			return Precedence.Postfix;
		default:
			return Precedence.Atom;
	}
}

/**
 * Generate source for `node` in a position that accepts `minPrecedence` or
 * tighter, adding parentheses if it needs them.
 *
 * `isTail` says that nothing an expression could absorb follows this position.
 * `if` and `for` end in an open expression that swallows any operator after it,
 * so they stay bare only at the tail, as in `1 + if a then b else c`.
 */
function emit(node: ASTNode, minPrecedence: number, isTail: boolean): string {
	switch (node.kind) {
		case NodeKind.Identifier:
			return node.name;

		case NodeKind.Program:
			return emit(nestedExpression(node), minPrecedence, isTail);

		case NodeKind.NumberLiteral: {
			const spelled = spellNumber(node);
			return spelled === node ? String(node.value) : emit(spelled, minPrecedence, isTail);
		}

		case NodeKind.IfExpression:
		case NodeKind.ForExpression:
			return isTail ? emitBare(node, true) : `(${emitBare(node, true)})`;

		default:
			if (precedenceOf(node) < minPrecedence) return `(${emitBare(node, true)})`;
			return emitBare(node, isTail);
	}
}

/**
 * Generate a complete expression closed by a delimiter
 */
function emitEnclosed(node: ASTNode): string {
	return emit(node, Precedence.None, true);
}

function emitBare(
	node: Exclude<ASTNode, Program | NumberLiteral | Identifier>,
	isTail: boolean,
): string {
	switch (node.kind) {
		case NodeKind.StringLiteral:
			return `"${escapeString(node.value)}"`;

		case NodeKind.BooleanLiteral:
			return node.value ? 'true' : 'false';

		case NodeKind.ArrayLiteral:
			return `[${node.elements.map(emitEnclosed).join(', ')}]`;

		case NodeKind.BinaryOp: {
			const precedence = getOperatorPrecedence(node.operator);
			const isRightAssociative = node.operator === '^';
			const left = emit(node.left, isRightAssociative ? precedence + 1 : precedence, false);
			const right = emit(node.right, isRightAssociative ? precedence : precedence + 1, isTail);
			return `${left} ${node.operator} ${right}`;
		}

		case NodeKind.UnaryOp:
			return `${node.operator}${emit(node.argument, Precedence.Exponent, isTail)}`;

		case NodeKind.FunctionCall:
			return `${node.name}(${node.args.map(emitEnclosed).join(', ')})`;

		case NodeKind.Assignment:
			return `${node.name} = ${emit(node.value, Precedence.Assignment, isTail)}`;

		case NodeKind.IfExpression:
			return `if ${emitEnclosed(node.condition)} then ${emitEnclosed(node.consequent)} else ${emitEnclosed(node.alternate)}`;

		case NodeKind.ForExpression: {
			let code = `for ${node.variable} in ${emitEnclosed(node.iterable)}`;
			if (node.guard) {
				code += ` when ${emitEnclosed(node.guard)}`;
			}
			if (node.accumulator) {
				code += ` into ${node.accumulator.name} = ${emitEnclosed(node.accumulator.initial)}`;
			}
			return `${code} then ${emitEnclosed(node.body)}`;
		}

		case NodeKind.IndexAccess:
			return `${emit(node.object, Precedence.Postfix, false)}[${emitEnclosed(node.index)}]`;

		case NodeKind.RangeExpression: {
			const from = emit(node.from, Precedence.Range, false);
			const to = emit(node.to, Precedence.Range + 1, isTail);
			return `${from}${node.inclusive ? '..=' : '..'}${to}`;
		}

		case NodeKind.PipeExpression: {
			const value = emit(node.value, Precedence.Pipe, false);
			return `${value} |> ${node.name}(${node.args.map(emitEnclosed).join(', ')})`;
		}

		case NodeKind.Placeholder:
			return '?';
	}
}

/**
 * Spell a comment as whole `//` lines, so that its text cannot become code.
 */
function commentLines(comment: string): string[] {
	return comment.split(/\r\n?|\n/).map((line) => (line.startsWith('//') ? line : `// ${line}`));
}

/**
 * Append a statement to `lines` with its comments: leading comments on their own
 * lines before the code, trailing comments on the same line after it. A nested
 * Program contributes its statements in place.
 */
function emitStatement(node: ASTNode, lines: string[]): void {
	const { leadingComments, trailingComments } = node;
	if (leadingComments) {
		for (const comment of leadingComments) lines.push(...commentLines(comment));
	}

	if (node.kind === NodeKind.Program) {
		if (node.statements.length === 0) lines.push('0');
		for (const statement of node.statements) {
			emitStatement(statement, lines);
		}
		if (trailingComments) {
			for (const comment of trailingComments) lines.push(...commentLines(comment));
		}
		return;
	}

	const code = emitEnclosed(node);
	lines.push(trailingComments ? [code, ...trailingComments.flatMap(commentLines)].join(' ') : code);
}

/**
 * Generate source code from an AST node.
 *
 * For any AST the parser can produce, the result evaluates identically and parses
 * back to an equal AST, within the parser's limits. Trailing comments on one
 * statement merge into one comment, and comments on nested expressions are
 * dropped, as the language can only place them around statements.
 *
 * Hand-built ASTs may step outside the grammar: names that are not identifiers
 * are emitted as they are, and so are pipes with no placeholder.
 *
 * Parentheses appear only where needed, except that a pipe used as an operand of
 * a tighter operator is always parenthesized. Statements are separated by line
 * breaks.
 *
 * @throws {TypeError} if a Program with multiple statements is nested in an
 * expression, which the language has no spelling for
 */
export function generate(node: ASTNode): string {
	const lines: string[] = [];
	emitStatement(node, lines);
	return lines.join('\n');
}
