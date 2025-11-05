import { type Operator, TokenType } from './types'

/**
 * Evaluate a binary operation on two numbers
 * Shared implementation used by both executor and optimizer
 */
export function evaluateBinaryOperation(
	operator: Operator,
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
				throw new Error('Division by zero')
			}
			return left / right
		case '%':
			if (right === 0) {
				throw new Error('Modulo by zero')
			}
			return left % right
		case '^':
			return left ** right
		case '==':
			return left === right ? 1 : 0
		case '!=':
			return left !== right ? 1 : 0
		case '<':
			return left < right ? 1 : 0
		case '>':
			return left > right ? 1 : 0
		case '<=':
			return left <= right ? 1 : 0
		case '>=':
			return left >= right ? 1 : 0
		case '&&':
			return left !== 0 && right !== 0 ? 1 : 0
		case '||':
			return left !== 0 || right !== 0 ? 1 : 0
		default:
			throw new Error(`Unknown operator: ${operator}`)
	}
}

/**
 * Get operator precedence (higher number = higher precedence)
 *
 * Precedence hierarchy:
 * - 0: None
 * - 1: Assignment (=, ??=)
 * - 2: Ternary conditional (? :)
 * - 3: Logical OR (||)
 * - 4: Logical AND (&&)
 * - 5: Comparison (==, !=, <, >, <=, >=)
 * - 6: Addition/Subtraction (+, -)
 * - 7: Multiplication/Division/Modulo (*, /, %)
 * - 8: Exponentiation (^)
 */
export function getOperatorPrecedence(operator: Operator): number {
	switch (operator) {
		case '^':
			return 8 // Exponentiation
		case '*':
		case '/':
		case '%':
			return 7 // Multiplication/Division/Modulo
		case '+':
		case '-':
			return 6 // Addition/Subtraction
		case '==':
		case '!=':
		case '<':
		case '>':
		case '<=':
		case '>=':
			return 5 // Comparison
		case '&&':
			return 4 // Logical AND
		case '||':
			return 3 // Logical OR
		default:
			return 0
	}
}

/**
 * Get token precedence for parsing
 * Maps TokenType to operator precedence values
 */
export function getTokenPrecedence(type: TokenType): number {
	switch (type) {
		case TokenType.EQUALS:
		case TokenType.NULLISH_ASSIGN:
			return 1 // Assignment has lowest precedence
		case TokenType.QUESTION:
			return 2 // Ternary conditional
		case TokenType.LOGICAL_OR:
			return 3 // Logical OR
		case TokenType.LOGICAL_AND:
			return 4 // Logical AND (binds tighter than OR)
		case TokenType.DOUBLE_EQUALS:
		case TokenType.NOT_EQUALS:
		case TokenType.LESS_THAN:
		case TokenType.GREATER_THAN:
		case TokenType.LESS_EQUAL:
		case TokenType.GREATER_EQUAL:
			return 5 // Comparison operators
		case TokenType.PLUS:
		case TokenType.MINUS:
			return 6
		case TokenType.STAR:
		case TokenType.SLASH:
		case TokenType.PERCENT:
			return 7
		case TokenType.CARET:
			return 8 // Exponentiation has highest precedence
		default:
			return 0
	}
}
