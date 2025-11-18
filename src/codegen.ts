import type { ASTNode, Operator } from './ast'
import { isAssignment, isBinaryOp, isUnaryOp } from './ast'
import { getOperatorPrecedence } from './utils'
import { visit } from './visitor'

/**
 * Check if left operand needs parentheses based on operator precedence
 * - For left-associative operators: parens only if strictly lower precedence
 * - For right-associative operators (^): parens if lower or equal precedence
 */
function needsParensLeft(node: ASTNode, operator: Operator): boolean {
	if (!isBinaryOp(node)) return false

	const nodePrecedence = getOperatorPrecedence(node[2])
	const operatorPrecedence = getOperatorPrecedence(operator)

	// For right-associative operators (^), need parens if lower or equal precedence
	if (operator === '^') {
		return nodePrecedence <= operatorPrecedence
	}

	// For left-associative operators, only need parens if strictly lower precedence
	return nodePrecedence < operatorPrecedence
}

/**
 * Check if right operand needs parentheses based on operator precedence and associativity
 * - For right-associative operators (^): parens if strictly lower precedence
 * - For left-associative operators: parens if lower or equal precedence
 */
function needsParensRight(node: ASTNode, operator: Operator): boolean {
	if (!isBinaryOp(node)) return false

	const nodePrecedence = getOperatorPrecedence(node[2])
	const operatorPrecedence = getOperatorPrecedence(operator)

	// For right-associative operators (^), only need parens if strictly lower precedence
	if (operator === '^') {
		return nodePrecedence < operatorPrecedence
	}

	// For left-associative operators (+ - * / %), need parens if lower or equal precedence
	// This prevents reordering: a - (b - c) is different from a - b - c
	return nodePrecedence <= operatorPrecedence
}

/**
 * Generate source code from an AST node
 */
export function generate(node: ASTNode): string {
	return visit(node, {
		// Generate code for a program (multiple statements)
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1]
			return statements.map(recurse).join('; ')
		},

		// Generate code for a number literal
		// Tuple: [kind, value]
		NumberLiteral: (n) => {
			return String(n[1])
		},

		// Generate code for an identifier
		// Tuple: [kind, name]
		Identifier: (n) => {
			return n[1]
		},

		// Generate code for a binary operation
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			const leftNode = n[1]
			const operator = n[2]
			const rightNode = n[3]

			const left = recurse(leftNode)
			const right = recurse(rightNode)

			// Add parentheses to left side if it's a lower precedence operation
			// Special case: UnaryOp on left of ^ needs parentheses
			// (-2) ^ 2 = 4, but -2 ^ 2 = -4
			const leftNeedsParens =
				needsParensLeft(leftNode, operator) ||
				(operator === '^' && isUnaryOp(leftNode))
			const leftCode = leftNeedsParens ? `(${left})` : left

			// Add parentheses to right side if it's a lower precedence operation
			const rightNeedsParens = needsParensRight(rightNode, operator)
			const rightCode = rightNeedsParens ? `(${right})` : right

			return `${leftCode} ${operator} ${rightCode}`
		},

		// Generate code for a unary operation
		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const argumentNode = n[2]
			const arg = recurse(argumentNode)

			// Add parentheses around binary/assignment operations
			const needsParens = isBinaryOp(argumentNode) || isAssignment(argumentNode)
			const argCode = needsParens ? `(${arg})` : arg

			return `${operator}${argCode}`
		},

		// Generate code for a function call
		// Tuple: [kind, name, arguments]
		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const argsCode = args.map(recurse).join(', ')
			return `${name}(${argsCode})`
		},

		// Generate code for a variable assignment
		// Tuple: [kind, name, value]
		Assignment: (n, recurse) => {
			const name = n[1]
			const valueNode = n[2]
			const value = recurse(valueNode)
			return `${name} = ${value}`
		},

		// Generate code for a conditional expression (ternary operator)
		// Tuple: [kind, condition, consequent, alternate]
		ConditionalExpression: (n, recurse) => {
			const conditionNode = n[1]
			const consequentNode = n[2]
			const alternateNode = n[3]

			const condition = recurse(conditionNode)
			const consequent = recurse(consequentNode)
			const alternate = recurse(alternateNode)

			// Add parentheses to condition if it's an assignment or lower-precedence operation
			const conditionNeedsParens =
				isAssignment(conditionNode) ||
				(isBinaryOp(conditionNode) &&
					getOperatorPrecedence(conditionNode[2]) <= 2)
			const conditionCode = conditionNeedsParens ? `(${condition})` : condition

			return `${conditionCode} ? ${consequent} : ${alternate}`
		},
	})
}
