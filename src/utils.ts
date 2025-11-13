import type { ASTNode, Operator } from './types'
import { TokenType } from './types'
import { visit } from './visitor'

/**
 * Evaluate a binary operation on two numbers
 * Shared implementation used by both executor and optimizer to ensure consistent semantics
 * All operations run in O(1) time
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
 * Collect all identifier names from an AST node.
 *
 * Traverses the entire AST tree and collects the names of all Identifier nodes.
 * This is a general-purpose utility used by both the optimizer (for liveness analysis)
 * and analyzer (for dependency detection).
 *
 * Time complexity: O(n) where n is the number of AST nodes
 * Space complexity: O(d) where d is the max depth (recursion stack)
 *
 * @param node - The AST node to traverse
 * @returns Set of all identifier names found in the tree
 *
 * @example
 * ```typescript
 * const ast = parseSource('x + y * z')
 * const identifiers = collectAllIdentifiers(ast)
 * // Returns: Set(['x', 'y', 'z'])
 * ```
 */
export function collectAllIdentifiers(node: ASTNode): Set<string> {
	const identifiers = new Set<string>()

	visit<void>(node, {
		Program: (n, recurse) => {
			for (const stmt of n.statements) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		Identifier: (n) => {
			identifiers.add(n.name)
		},
		BinaryOp: (n, recurse) => {
			recurse(n.left)
			recurse(n.right)
		},
		UnaryOp: (n, recurse) => {
			recurse(n.argument)
		},
		FunctionCall: (n, recurse) => {
			for (const arg of n.arguments) {
				recurse(arg)
			}
		},
		Assignment: (n, recurse) => {
			// Collect from RHS only (LHS is the variable being assigned)
			recurse(n.value)
		},
		ConditionalExpression: (n, recurse) => {
			recurse(n.condition)
			recurse(n.consequent)
			recurse(n.alternate)
		},
	})

	return identifiers
}

/**
 * Get token precedence for parsing
 * Maps TokenType to operator precedence values
 */
export function getTokenPrecedence(type: TokenType): number {
	switch (type) {
		case TokenType.EQUALS:
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
