import type { ASTNode, Operator } from './types'
import { isAssignment, isBinaryOp, isUnaryOp } from './types'
import { getOperatorPrecedence } from './utils'
import { visit } from './visitor'

/**
 * CodeGenerator - converts AST nodes back to source code
 */
export class CodeGenerator {
	/**
	 * Generate source code from an AST node
	 */
	generate(node: ASTNode): string {
		return visit(node, {
			// Generate code for a program (multiple statements)
			Program: (n, recurse) => {
				return n.statements.map(recurse).join('; ')
			},

			// Generate code for a number literal
			NumberLiteral: (n) => {
				return String(n.value)
			},

			// Generate code for an identifier
			Identifier: (n) => {
				return n.name
			},

			// Generate code for a binary operation
			BinaryOp: (n, recurse) => {
				const left = recurse(n.left)
				const right = recurse(n.right)

				// Add parentheses to left side if it's a lower precedence operation
				// Special case: UnaryOp on left of ^ needs parentheses
				// (-2) ^ 2 = 4, but -2 ^ 2 = -4
				const leftNeedsParens =
					this.needsParensLeft(n.left, n.operator) ||
					(n.operator === '^' && isUnaryOp(n.left))
				const leftCode = leftNeedsParens ? `(${left})` : left

				// Add parentheses to right side if it's a lower precedence operation
				const rightNeedsParens = this.needsParensRight(n.right, n.operator)
				const rightCode = rightNeedsParens ? `(${right})` : right

				return `${leftCode} ${n.operator} ${rightCode}`
			},

			// Generate code for a unary operation
			UnaryOp: (n, recurse) => {
				const arg = recurse(n.argument)

				// Add parentheses around binary/assignment operations
				const needsParens = isBinaryOp(n.argument) || isAssignment(n.argument)
				const argCode = needsParens ? `(${arg})` : arg

				return `${n.operator}${argCode}`
			},

			// Generate code for a function call
			FunctionCall: (n, recurse) => {
				const args = n.arguments.map(recurse).join(', ')
				return `${n.name}(${args})`
			},

			// Generate code for a variable assignment
			Assignment: (n, recurse) => {
				const value = recurse(n.value)
				return `${n.name} = ${value}`
			},

			// Generate code for a conditional expression (ternary operator)
			ConditionalExpression: (n, recurse) => {
				const condition = recurse(n.condition)
				const consequent = recurse(n.consequent)
				const alternate = recurse(n.alternate)

				// Add parentheses to condition if it's an assignment or lower-precedence operation
				const conditionNeedsParens =
					isAssignment(n.condition) ||
					(isBinaryOp(n.condition) &&
						getOperatorPrecedence(n.condition.operator) <= 2)
				const conditionCode = conditionNeedsParens
					? `(${condition})`
					: condition

				return `${conditionCode} ? ${consequent} : ${alternate}`
			},
		})
	}

	/**
	 * Check if left operand needs parentheses based on operator precedence
	 * - For left-associative operators: parens only if strictly lower precedence
	 * - For right-associative operators (^): parens if lower or equal precedence
	 */
	private needsParensLeft(node: ASTNode, operator: Operator): boolean {
		if (!isBinaryOp(node)) return false

		const nodePrecedence = getOperatorPrecedence(node.operator)
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
	private needsParensRight(node: ASTNode, operator: Operator): boolean {
		if (!isBinaryOp(node)) return false

		const nodePrecedence = getOperatorPrecedence(node.operator)
		const operatorPrecedence = getOperatorPrecedence(operator)

		// For right-associative operators (^), only need parens if strictly lower precedence
		if (operator === '^') {
			return nodePrecedence < operatorPrecedence
		}

		// For left-associative operators (+ - * / %), need parens if lower or equal precedence
		// This prevents reordering: a - (b - c) is different from a - b - c
		return nodePrecedence <= operatorPrecedence
	}
}

/**
 * Generate source code from an AST node
 */
export function generate(node: ASTNode): string {
	const generator = new CodeGenerator()
	return generator.generate(node)
}
