import * as ast from './ast'
import type { ASTNode } from './types'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'

/**
 * Optimize an AST by performing constant folding
 * Recursively evaluates expressions with only literal values
 *
 * @param node - The AST node to optimize
 * @returns Optimized AST node
 */
export function optimize(node: ASTNode): ASTNode {
	// Program: optimize all statements
	if (isProgram(node)) {
		return {
			...node,
			statements: node.statements.map((stmt) => optimize(stmt)),
		}
	}

	// Assignment: optimize the value being assigned
	if (isAssignment(node)) {
		return {
			...node,
			value: optimize(node.value),
		}
	}

	// Binary operation: optimize operands, then fold if both are literals
	if (isBinaryOp(node)) {
		const left = optimize(node.left)
		const right = optimize(node.right)

		// If both operands are number literals, evaluate the operation
		if (isNumberLiteral(left) && isNumberLiteral(right)) {
			const result = evaluateBinaryOp(node.operator, left.value, right.value)
			return ast.number(result)
		}

		// Return optimized binary operation
		return {
			...node,
			left,
			right,
		}
	}

	// Unary operation: optimize argument, then fold if it's a literal
	if (isUnaryOp(node)) {
		const argument = optimize(node.argument)

		// If argument is a number literal, evaluate the negation
		if (isNumberLiteral(argument)) {
			return ast.number(-argument.value)
		}

		// Return optimized unary operation
		return {
			...node,
			argument,
		}
	}

	// Function call: optimize all arguments recursively
	if (isFunctionCall(node)) {
		return {
			...node,
			arguments: node.arguments.map((arg) => optimize(arg)),
		}
	}

	// Other node types (identifiers) can't be optimized
	return node
}

/**
 * Evaluate a binary operation on two numbers
 */
function evaluateBinaryOp(
	operator: '+' | '-' | '*' | '/' | '%' | '^',
	left: number,
	right: number,
): number {
	switch (operator) {
		case '+':
			return left + right
		case '-':
			return left - right
		case '*':
			return left * right
		case '/':
			if (right === 0) {
				throw new Error('Division by zero in constant folding')
			}
			return left / right
		case '%':
			if (right === 0) {
				throw new Error('Modulo by zero in constant folding')
			}
			return left % right
		case '^':
			return left ** right
		default:
			throw new Error(`Unknown operator: ${operator}`)
	}
}
