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

	const nodePrecedence = getOperatorPrecedence(node[2])
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
			return n[1].map(recurse).join('; ')
		},

		NumberLiteral: (n) => {
			return String(n[1])
		},

		StringLiteral: (n) => {
			return `"${escapeString(n[1])}"`
		},

		BooleanLiteral: (n) => {
			return n[1] ? 'true' : 'false'
		},

		ArrayLiteral: (n, recurse) => {
			return `[${n[1].map(recurse).join(', ')}]`
		},

		Identifier: (n) => {
			return n[1]
		},

		BinaryOp: (n, recurse) => {
			const leftNode = n[1]
			const operator = n[2]
			const rightNode = n[3]

			const left = recurse(leftNode)
			const right = recurse(rightNode)

			const leftNeedsParens =
				needsParens(leftNode, operator, true) ||
				(operator === '^' && isUnaryOp(leftNode))
			const leftCode = leftNeedsParens ? `(${left})` : left

			const rightNeedsParens = needsParens(rightNode, operator, false)
			const rightCode = rightNeedsParens ? `(${right})` : right

			return `${leftCode} ${operator} ${rightCode}`
		},

		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const argumentNode = n[2]
			const arg = recurse(argumentNode)

			const parensNeeded =
				isBinaryOp(argumentNode) || isAssignment(argumentNode)
			const argCode = parensNeeded ? `(${arg})` : arg

			return `${operator}${argCode}`
		},

		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const argsCode = args.map(recurse).join(', ')
			return `${name}(${argsCode})`
		},

		Assignment: (n, recurse) => {
			const name = n[1]
			const value = recurse(n[2])
			return `${name} = ${value}`
		},

		ConditionalExpression: (n, recurse) => {
			const conditionNode = n[1]
			const condition = recurse(conditionNode)
			const consequent = recurse(n[2])
			const alternate = recurse(n[3])

			const conditionNeedsParens =
				isAssignment(conditionNode) ||
				(isBinaryOp(conditionNode) &&
					getOperatorPrecedence(conditionNode[2]) <= 2)
			const conditionCode = conditionNeedsParens ? `(${condition})` : condition

			return `${conditionCode} ? ${consequent} : ${alternate}`
		},
	})
}
