import type { ASTNode, Operator } from './ast'
import { isAssignment, isBinaryOp, isUnaryOp } from './ast'
import { getOperatorPrecedence } from './utils'
import { visit } from './visitor'

/**
 * Check if operand needs parentheses based on operator precedence and position
 */
function needsParens(
	node: ASTNode,
	operator: Operator,
	isLeft: boolean,
): boolean {
	if (!isBinaryOp(node)) return false

	const nodePrecedence = getOperatorPrecedence(node.operator)
	const operatorPrecedence = getOperatorPrecedence(operator)
	const isRightAssociative = operator === '^'

	if (isRightAssociative) {
		return isLeft
			? nodePrecedence <= operatorPrecedence
			: nodePrecedence < operatorPrecedence
	}

	return isLeft
		? nodePrecedence < operatorPrecedence
		: nodePrecedence <= operatorPrecedence
}

/**
 * Escape a string value for code generation
 */
function escapeString(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\t/g, '\\t')
}

/**
 * Generate source code from an AST node
 */
export function generate(node: ASTNode): string {
	return visit(node, {
		Program: (n, recurse) => {
			return n.statements.map(recurse).join('; ')
		},

		NumberLiteral: (n) => {
			return String(n.value)
		},

		StringLiteral: (n) => {
			return `"${escapeString(n.value)}"`
		},

		BooleanLiteral: (n) => {
			return n.value ? 'true' : 'false'
		},

		ArrayLiteral: (n, recurse) => {
			return `[${n.elements.map(recurse).join(', ')}]`
		},

		Identifier: (n) => {
			return n.name
		},

		BinaryOp: (n, recurse) => {
			const left = recurse(n.left)
			const right = recurse(n.right)

			const leftNeedsParens =
				needsParens(n.left, n.operator, true) ||
				(n.operator === '^' && isUnaryOp(n.left))
			const leftCode = leftNeedsParens ? `(${left})` : left

			const rightNeedsParens = needsParens(n.right, n.operator, false)
			const rightCode = rightNeedsParens ? `(${right})` : right

			return `${leftCode} ${n.operator} ${rightCode}`
		},

		UnaryOp: (n, recurse) => {
			const arg = recurse(n.argument)

			const parensNeeded = isBinaryOp(n.argument) || isAssignment(n.argument)
			const argCode = parensNeeded ? `(${arg})` : arg

			return `${n.operator}${argCode}`
		},

		FunctionCall: (n, recurse) => {
			const argsCode = n.args.map(recurse).join(', ')
			return `${n.name}(${argsCode})`
		},

		Assignment: (n, recurse) => {
			const value = recurse(n.value)
			return `${n.name} = ${value}`
		},

		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n.condition)
			const consequent = recurse(n.consequent)
			const alternate = recurse(n.alternate)

			const conditionNeedsParens =
				isAssignment(n.condition) ||
				(isBinaryOp(n.condition) &&
					getOperatorPrecedence(n.condition.operator) <= 2)
			const conditionCode = conditionNeedsParens ? `(${condition})` : condition

			return `${conditionCode} ? ${consequent} : ${alternate}`
		},
	})
}
