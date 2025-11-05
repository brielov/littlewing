import type {
	ASTNode,
	Assignment,
	BinaryOp,
	FunctionCall,
	Identifier,
	NumberLiteral,
	Operator,
	UnaryOp,
} from './types'

/**
 * Builder functions for creating AST nodes manually
 */

/**
 * Create a number literal node
 */
export function number(value: number): NumberLiteral {
	return {
		type: 'NumberLiteral',
		value,
	}
}

/**
 * Create an identifier node
 */
export function identifier(name: string): Identifier {
	return {
		type: 'Identifier',
		name,
	}
}

/**
 * Create a binary operation node
 */
export function binaryOp(
	left: ASTNode,
	operator: Operator,
	right: ASTNode,
): BinaryOp {
	return {
		type: 'BinaryOp',
		left,
		operator,
		right,
	}
}

/**
 * Create a unary operation node (unary minus)
 */
export function unaryOp(argument: ASTNode): UnaryOp {
	return {
		type: 'UnaryOp',
		operator: '-',
		argument,
	}
}

/**
 * Create a function call node
 */
export function functionCall(name: string, args: ASTNode[] = []): FunctionCall {
	return {
		type: 'FunctionCall',
		name,
		arguments: args,
	}
}

/**
 * Create a variable assignment node
 */
export function assign(name: string, value: ASTNode): Assignment {
	return {
		type: 'Assignment',
		name,
		value,
	}
}

/**
 * Convenience functions for common operations
 */

/**
 * Create an addition operation
 */
export function add(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '+', right)
}

/**
 * Create a subtraction operation
 */
export function subtract(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '-', right)
}

/**
 * Create a multiplication operation
 */
export function multiply(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '*', right)
}

/**
 * Create a division operation
 */
export function divide(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '/', right)
}

/**
 * Create a modulo operation
 */
export function modulo(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '%', right)
}

/**
 * Create an exponentiation operation
 */
export function exponentiate(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '^', right)
}

/**
 * Create a negation operation
 */
export function negate(argument: ASTNode): UnaryOp {
	return unaryOp(argument)
}
