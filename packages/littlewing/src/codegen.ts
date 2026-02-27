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
import { NodeKind } from "./ast";
import { getOperatorPrecedence } from "./utils";

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
	const recurse = generateNode;

	switch (node.kind) {
		case NodeKind.Program:
			return generateProgram(node, recurse);

		case NodeKind.NumberLiteral:
			return String(node.value);

		case NodeKind.StringLiteral:
			return `"${escapeString(node.value)}"`;

		case NodeKind.BooleanLiteral:
			return node.value ? "true" : "false";

		case NodeKind.ArrayLiteral:
			return `[${node.elements.map(recurse).join(", ")}]`;

		case NodeKind.Identifier:
			return node.name;

		case NodeKind.BinaryOp: {
			const left = recurse(node.left);
			const right = recurse(node.right);

			const opPrec = getOperatorPrecedence(node.operator);
			// Left needs parens if:
			// - BinaryOp with lower precedence (standard Pratt rule)
			// - Unary before right-associative ^ (preserves -(2^3) grouping)
			// - Greedy-tail node whose trailing syntax captures the parent operator
			// - Range whose right side would absorb the parent operator (when parent prec >= 7)
			const leftNeedsParens =
				needsParens(node.left, node.operator, true) ||
				(node.operator === "^" && isUnaryOp(node.left)) ||
				isIfExpression(node.left) ||
				isForExpression(node.left) ||
				isAssignment(node.left) ||
				(isRangeExpression(node.left) && opPrec >= 7);
			const leftCode = leftNeedsParens ? `(${left})` : left;

			// Right needs parens if:
			// - BinaryOp with lower/equal precedence (standard Pratt rule)
			// - Low-precedence infix (pipe prec 2, assignment prec 1) that would
			//   not bind inside the parent's right-side minPrec context
			// - Range (prec 6) when parent prec >= 6
			const rightNeedsParens =
				needsParens(node.right, node.operator, false) ||
				isPipeExpression(node.right) ||
				isAssignment(node.right) ||
				(isRangeExpression(node.right) && opPrec >= 6);
			const rightCode = rightNeedsParens ? `(${right})` : right;

			return `${leftCode} ${node.operator} ${rightCode}`;
		}

		case NodeKind.UnaryOp: {
			const arg = recurse(node.argument);

			// Wrap argument if it's an infix expression that would split under
			// the unary's high binding power (effectively minPrec ~8)
			const parensNeeded =
				isBinaryOp(node.argument) ||
				isAssignment(node.argument) ||
				isPipeExpression(node.argument) ||
				isRangeExpression(node.argument);
			const argCode = parensNeeded ? `(${arg})` : arg;

			return `${node.operator}${argCode}`;
		}

		case NodeKind.FunctionCall: {
			const argsCode = node.args.map(recurse).join(", ");
			return `${node.name}(${argsCode})`;
		}

		case NodeKind.Assignment: {
			const value = recurse(node.value);
			return `${node.name} = ${value}`;
		}

		case NodeKind.IfExpression: {
			const condition = recurse(node.condition);
			const consequent = recurse(node.consequent);
			const alternate = recurse(node.alternate);
			return `if ${condition} then ${consequent} else ${alternate}`;
		}

		case NodeKind.ForExpression: {
			const parts = [`for ${node.variable} in ${recurse(node.iterable)}`];
			if (node.guard) {
				parts.push(`when ${recurse(node.guard)}`);
			}
			if (node.accumulator) {
				parts.push(`into ${node.accumulator.name} = ${recurse(node.accumulator.initial)}`);
			}
			parts.push(`then ${recurse(node.body)}`);
			return parts.join(" ");
		}

		case NodeKind.IndexAccess: {
			const object = recurse(node.object);
			const index = recurse(node.index);
			// Wrap object in parens if it's a binary op, unary op, range, assignment, or pipe
			const objNeedsParens =
				isBinaryOp(node.object) ||
				isUnaryOp(node.object) ||
				isAssignment(node.object) ||
				isRangeExpression(node.object) ||
				isPipeExpression(node.object);
			const objectCode = objNeedsParens ? `(${object})` : object;
			return `${objectCode}[${index}]`;
		}

		case NodeKind.RangeExpression: {
			const start = recurse(node.start);
			const end = recurse(node.end);
			const op = node.inclusive ? "..=" : "..";
			// Start needs parens for: binary ops, nested ranges, and greedy-tail
			// nodes (if/for/assignment) whose trailing syntax would absorb the `..`
			const startNeedsParens =
				isBinaryOp(node.start) ||
				isRangeExpression(node.start) ||
				isIfExpression(node.start) ||
				isForExpression(node.start) ||
				isAssignment(node.start);
			// End needs parens for: binary ops, nested ranges, and low-precedence
			// infix (pipe prec 2, assignment prec 1) that won't bind in range's
			// right-side context (minPrec 7)
			const endNeedsParens =
				isBinaryOp(node.end) ||
				isRangeExpression(node.end) ||
				isPipeExpression(node.end) ||
				isAssignment(node.end);
			const startCode = startNeedsParens ? `(${start})` : start;
			const endCode = endNeedsParens ? `(${end})` : end;
			return `${startCode}${op}${endCode}`;
		}

		case NodeKind.PipeExpression: {
			const value = recurse(node.value);
			const argsCode = node.args.map(recurse).join(", ");
			// Wrap value in parens if it has greedy-tail syntax (assignment,
			// if/for) that would absorb the `|>` into the trailing branch
			const valueNeedsParens =
				isAssignment(node.value) || isIfExpression(node.value) || isForExpression(node.value);
			const valueCode = valueNeedsParens ? `(${value})` : value;
			return `${valueCode} |> ${node.name}(${argsCode})`;
		}

		case NodeKind.Placeholder:
			return "?";
	}
}
