import type { ASTNode, Operator, Program } from "./ast";
import {
	isAssignment,
	isBinaryOp,
	isForExpression,
	isIfExpression,
	isPipeExpression,
	isProgram,
	isRangeExpression,
	isUnaryOp,
} from "./ast";
import { getOperatorPrecedence } from "./utils";
import { visit } from "./visitor";

/**
 * Check if operand needs parentheses based on operator precedence and position
 */
function needsParens(node: ASTNode, operator: Operator, isLeft: boolean): boolean {
	if (!isBinaryOp(node)) return false;

	const nodePrecedence = getOperatorPrecedence(node.operator);
	const operatorPrecedence = getOperatorPrecedence(operator);
	const isRightAssociative = operator === "^";

	if (isRightAssociative) {
		return isLeft ? nodePrecedence <= operatorPrecedence : nodePrecedence < operatorPrecedence;
	}

	return isLeft ? nodePrecedence < operatorPrecedence : nodePrecedence <= operatorPrecedence;
}

/**
 * Escape a string value for code generation
 */
function escapeString(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\t/g, "\\t");
}

/**
 * Emit a statement line with its leading and trailing comments.
 * Leading comments appear on their own lines before the code.
 * Trailing comments appear on the same line after the code.
 */
function emitStatement(code: string, node: ASTNode, lines: string[]): void {
	if (node.leadingComments) {
		for (const comment of node.leadingComments) {
			lines.push(comment);
		}
	}
	if (node.trailingComments && node.trailingComments.length > 0) {
		lines.push(`${code} ${node.trailingComments.join(" ")}`);
	} else {
		lines.push(code);
	}
}

/**
 * Generate source code for a Program node, handling comments and multi-line output.
 */
function generateProgram(n: Program, recurse: (node: ASTNode) => string): string {
	const lines: string[] = [];
	for (const stmt of n.statements) {
		emitStatement(recurse(stmt), stmt, lines);
	}
	if (n.trailingComments) {
		for (const comment of n.trailingComments) {
			lines.push(comment);
		}
	}
	return lines.join("\n");
}

/**
 * Generate source code from an AST node
 */
export function generate(node: ASTNode): string {
	const code = generateNode(node);
	const parts: string[] = [];

	if (!isProgram(node)) {
		if (node.leadingComments) {
			for (const comment of node.leadingComments) {
				parts.push(comment);
			}
		}
		if (node.trailingComments && node.trailingComments.length > 0) {
			parts.push(`${code} ${node.trailingComments.join(" ")}`);
		} else {
			parts.push(code);
		}
		if (parts.length > 1 || (node.leadingComments && node.leadingComments.length > 0)) {
			return parts.join("\n");
		}
		return parts[0] ?? code;
	}

	return code;
}

function generateNode(node: ASTNode): string {
	return visit(node, {
		Program: generateProgram,

		NumberLiteral: (n) => {
			return String(n.value);
		},

		StringLiteral: (n) => {
			return `"${escapeString(n.value)}"`;
		},

		BooleanLiteral: (n) => {
			return n.value ? "true" : "false";
		},

		ArrayLiteral: (n, recurse) => {
			return `[${n.elements.map(recurse).join(", ")}]`;
		},

		Identifier: (n) => {
			return n.name;
		},

		BinaryOp: (n, recurse) => {
			const left = recurse(n.left);
			const right = recurse(n.right);

			const opPrec = getOperatorPrecedence(n.operator);
			// Left needs parens if:
			// - BinaryOp with lower precedence (standard Pratt rule)
			// - Unary before right-associative ^ (preserves -(2^3) grouping)
			// - Greedy-tail node whose trailing syntax captures the parent operator
			// - Range whose right side would absorb the parent operator (when parent prec >= 7)
			const leftNeedsParens =
				needsParens(n.left, n.operator, true) ||
				(n.operator === "^" && isUnaryOp(n.left)) ||
				isIfExpression(n.left) ||
				isForExpression(n.left) ||
				isAssignment(n.left) ||
				(isRangeExpression(n.left) && opPrec >= 7);
			const leftCode = leftNeedsParens ? `(${left})` : left;

			// Right needs parens if:
			// - BinaryOp with lower/equal precedence (standard Pratt rule)
			// - Low-precedence infix (pipe prec 2, assignment prec 1) that would
			//   not bind inside the parent's right-side minPrec context
			// - Range (prec 6) when parent prec >= 6
			const rightNeedsParens =
				needsParens(n.right, n.operator, false) ||
				isPipeExpression(n.right) ||
				isAssignment(n.right) ||
				(isRangeExpression(n.right) && opPrec >= 6);
			const rightCode = rightNeedsParens ? `(${right})` : right;

			return `${leftCode} ${n.operator} ${rightCode}`;
		},

		UnaryOp: (n, recurse) => {
			const arg = recurse(n.argument);

			// Wrap argument if it's an infix expression that would split under
			// the unary's high binding power (effectively minPrec ~8)
			const parensNeeded =
				isBinaryOp(n.argument) ||
				isAssignment(n.argument) ||
				isPipeExpression(n.argument) ||
				isRangeExpression(n.argument);
			const argCode = parensNeeded ? `(${arg})` : arg;

			return `${n.operator}${argCode}`;
		},

		FunctionCall: (n, recurse) => {
			const argsCode = n.args.map(recurse).join(", ");
			return `${n.name}(${argsCode})`;
		},

		Assignment: (n, recurse) => {
			const value = recurse(n.value);
			return `${n.name} = ${value}`;
		},

		IfExpression: (n, recurse) => {
			const condition = recurse(n.condition);
			const consequent = recurse(n.consequent);
			const alternate = recurse(n.alternate);
			return `if ${condition} then ${consequent} else ${alternate}`;
		},

		ForExpression: (n, recurse) => {
			const parts = [`for ${n.variable} in ${recurse(n.iterable)}`];
			if (n.guard) {
				parts.push(`when ${recurse(n.guard)}`);
			}
			if (n.accumulator) {
				parts.push(`into ${n.accumulator.name} = ${recurse(n.accumulator.initial)}`);
			}
			parts.push(`then ${recurse(n.body)}`);
			return parts.join(" ");
		},

		IndexAccess: (n, recurse) => {
			const object = recurse(n.object);
			const index = recurse(n.index);
			// Wrap object in parens if it's a binary op, unary op, range, assignment, or pipe
			const needsParens =
				isBinaryOp(n.object) ||
				isUnaryOp(n.object) ||
				isAssignment(n.object) ||
				isRangeExpression(n.object) ||
				isPipeExpression(n.object);
			const objectCode = needsParens ? `(${object})` : object;
			return `${objectCode}[${index}]`;
		},

		RangeExpression: (n, recurse) => {
			const start = recurse(n.start);
			const end = recurse(n.end);
			const op = n.inclusive ? "..=" : "..";
			// Start needs parens for: binary ops, nested ranges, and greedy-tail
			// nodes (if/for/assignment) whose trailing syntax would absorb the `..`
			const startNeedsParens =
				isBinaryOp(n.start) ||
				isRangeExpression(n.start) ||
				isIfExpression(n.start) ||
				isForExpression(n.start) ||
				isAssignment(n.start);
			// End needs parens for: binary ops, nested ranges, and low-precedence
			// infix (pipe prec 2, assignment prec 1) that won't bind in range's
			// right-side context (minPrec 7)
			const endNeedsParens =
				isBinaryOp(n.end) ||
				isRangeExpression(n.end) ||
				isPipeExpression(n.end) ||
				isAssignment(n.end);
			const startCode = startNeedsParens ? `(${start})` : start;
			const endCode = endNeedsParens ? `(${end})` : end;
			return `${startCode}${op}${endCode}`;
		},

		PipeExpression: (n, recurse) => {
			const value = recurse(n.value);
			const argsCode = n.args.map(recurse).join(", ");
			// Wrap value in parens if it has greedy-tail syntax (assignment,
			// if/for) that would absorb the `|>` into the trailing branch
			const valueNeedsParens =
				isAssignment(n.value) || isIfExpression(n.value) || isForExpression(n.value);
			const valueCode = valueNeedsParens ? `(${value})` : value;
			return `${valueCode} |> ${n.name}(${argsCode})`;
		},

		Placeholder: () => "?",
	});
}
