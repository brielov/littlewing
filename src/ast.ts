import type {
	ASTNode,
	Assignment,
	BinaryOp,
	ConditionalExpression,
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
 * Create a conditional expression node (ternary operator)
 */
export function conditional(
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
): ConditionalExpression {
	return {
		type: 'ConditionalExpression',
		condition,
		consequent,
		alternate,
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

/**
 * Comparison operator convenience functions
 */

/**
 * Create an equality comparison (==)
 */
export function equals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '==', right)
}

/**
 * Create a not-equals comparison (!=)
 */
export function notEquals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '!=', right)
}

/**
 * Create a less-than comparison (<)
 */
export function lessThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<', right)
}

/**
 * Create a greater-than comparison (>)
 */
export function greaterThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>', right)
}

/**
 * Create a less-than-or-equal comparison (<=)
 */
export function lessEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<=', right)
}

/**
 * Create a greater-than-or-equal comparison (>=)
 */
export function greaterEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>=', right)
}

/**
 * Logical operator convenience functions
 */

/**
 * Create a logical AND operation (&&)
 */
export function logicalAnd(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '&&', right)
}

/**
 * Create a logical OR operation (||)
 */
export function logicalOr(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '||', right)
}
