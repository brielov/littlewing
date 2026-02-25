import type { ASTNode, Operator } from './ast'
import { isAssignment, isBinaryOp, isRangeExpression, isUnaryOp } from './ast'
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

		IfExpression: (n, recurse) => {
			const condition = recurse(n.condition)
			const consequent = recurse(n.consequent)
			const alternate = recurse(n.alternate)
			return `if ${condition} then ${consequent} else ${alternate}`
		},

		ForExpression: (n, recurse) => {
			const iterable = recurse(n.iterable)
			const body = recurse(n.body)
			if (n.guard) {
				const guard = recurse(n.guard)
				return `for ${n.variable} in ${iterable} when ${guard} then ${body}`
			}
			return `for ${n.variable} in ${iterable} then ${body}`
		},

		IndexAccess: (n, recurse) => {
			const object = recurse(n.object)
			const index = recurse(n.index)
			// Wrap object in parens if it's a binary op, unary op, range, or assignment
			const needsParens =
				isBinaryOp(n.object) ||
				isUnaryOp(n.object) ||
				isAssignment(n.object) ||
				isRangeExpression(n.object)
			const objectCode = needsParens ? `(${object})` : object
			return `${objectCode}[${index}]`
		},

		RangeExpression: (n, recurse) => {
			const start = recurse(n.start)
			const end = recurse(n.end)
			const op = n.inclusive ? '..=' : '..'
			// Wrap operands in parens if they are binary ops or ranges
			const startNeedsParens = isBinaryOp(n.start) || isRangeExpression(n.start)
			const endNeedsParens = isBinaryOp(n.end) || isRangeExpression(n.end)
			const startCode = startNeedsParens ? `(${start})` : start
			const endCode = endNeedsParens ? `(${end})` : end
			return `${startCode}${op}${endCode}`
		},
	})
}
