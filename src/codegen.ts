import type {
	ASTNode,
	Assignment,
	BinaryOp,
	FunctionCall,
	Identifier,
	NumberLiteral,
	Operator,
	Program,
	UnaryOp,
} from './types'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'

/**
 * CodeGenerator - converts AST nodes back to source code
 */
export class CodeGenerator {
	/**
	 * Generate source code from an AST node
	 */
	generate(node: ASTNode): string {
		if (isProgram(node)) return this.generateProgram(node)
		if (isNumberLiteral(node)) return this.generateNumberLiteral(node)
		if (isIdentifier(node)) return this.generateIdentifier(node)
		if (isBinaryOp(node)) return this.generateBinaryOp(node)
		if (isUnaryOp(node)) return this.generateUnaryOp(node)
		if (isFunctionCall(node)) return this.generateFunctionCall(node)
		if (isAssignment(node)) return this.generateAssignment(node)
		throw new Error(`Unknown node type`)
	}

	/**
	 * Generate code for a program (multiple statements)
	 */
	private generateProgram(node: Program): string {
		return node.statements.map((stmt) => this.generate(stmt)).join('; ')
	}

	/**
	 * Generate code for a number literal
	 */
	private generateNumberLiteral(node: NumberLiteral): string {
		return String(node.value)
	}

	/**
	 * Generate code for an identifier
	 */
	private generateIdentifier(node: Identifier): string {
		return node.name
	}

	/**
	 * Generate code for a binary operation
	 */
	private generateBinaryOp(node: BinaryOp): string {
		const left = this.generate(node.left)
		const right = this.generate(node.right)

		// Add parentheses to left side if it's a lower precedence operation
		const leftNeedsParens = this.needsParensLeft(node.left, node.operator)
		const leftCode = leftNeedsParens ? `(${left})` : left

		// Add parentheses to right side if it's a lower precedence operation
		const rightNeedsParens = this.needsParensRight(node.right, node.operator)
		const rightCode = rightNeedsParens ? `(${right})` : right

		return `${leftCode} ${node.operator} ${rightCode}`
	}

	/**
	 * Generate code for a unary operation
	 */
	private generateUnaryOp(node: UnaryOp): string {
		const arg = this.generate(node.argument)

		// Add parentheses around binary/assignment operations
		const needsParens = isBinaryOp(node.argument) || isAssignment(node.argument)
		const argCode = needsParens ? `(${arg})` : arg

		return `-${argCode}`
	}

	/**
	 * Generate code for a function call
	 */
	private generateFunctionCall(node: FunctionCall): string {
		const args = node.arguments.map((arg) => this.generate(arg)).join(', ')
		return `${node.name}(${args})`
	}

	/**
	 * Generate code for a variable assignment
	 */
	private generateAssignment(node: Assignment): string {
		const value = this.generate(node.value)
		return `${node.name} = ${value}`
	}

	/**
	 * Check if left operand needs parentheses based on operator precedence
	 * - For left-associative operators: parens only if strictly lower precedence
	 * - For right-associative operators (^): parens if lower or equal precedence
	 */
	private needsParensLeft(node: ASTNode, operator: Operator): boolean {
		if (!isBinaryOp(node)) return false

		const nodePrecedence = this.getPrecedence(node.operator)
		const operatorPrecedence = this.getPrecedence(operator)

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

		const nodePrecedence = this.getPrecedence(node.operator)
		const operatorPrecedence = this.getPrecedence(operator)

		// For right-associative operators (^), only need parens if strictly lower precedence
		if (operator === '^') {
			return nodePrecedence < operatorPrecedence
		}

		// For left-associative operators (+ - * / %), need parens if lower or equal precedence
		// This prevents reordering: a - (b - c) is different from a - b - c
		return nodePrecedence <= operatorPrecedence
	}

	/**
	 * Get precedence of an operator (higher number = higher precedence)
	 */
	private getPrecedence(operator: Operator): number {
		switch (operator) {
			case '^':
				return 4
			case '*':
			case '/':
			case '%':
				return 3
			case '+':
			case '-':
				return 2
			default:
				return 0
		}
	}
}

/**
 * Generate source code from an AST node
 */
export function generate(node: ASTNode): string {
	const generator = new CodeGenerator()
	return generator.generate(node)
}
