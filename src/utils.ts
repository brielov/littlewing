import type { ASTNode, Operator } from './ast'
import { TokenKind } from './lexer'
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
 * const ast = parse('x + y * z')
 * const identifiers = collectAllIdentifiers(ast)
 * // Returns: Set(['x', 'y', 'z'])
 * ```
 */
export function collectAllIdentifiers(node: ASTNode): Set<string> {
	const identifiers = new Set<string>()

	visit<void>(node, {
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1]
			for (const stmt of statements) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		// Tuple: [kind, name]
		Identifier: (n) => {
			identifiers.add(n[1])
		},
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			recurse(n[1])
			recurse(n[3])
		},
		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			recurse(n[2])
		},
		// Tuple: [kind, name, arguments]
		FunctionCall: (n, recurse) => {
			const args = n[2]
			for (const arg of args) {
				recurse(arg)
			}
		},
		// Tuple: [kind, name, value]
		Assignment: (n, recurse) => {
			// Collect from RHS only (LHS is the variable being assigned)
			recurse(n[2])
		},
		// Tuple: [kind, condition, consequent, alternate]
		ConditionalExpression: (n, recurse) => {
			recurse(n[1])
			recurse(n[2])
			recurse(n[3])
		},
	})

	return identifiers
}

/**
 * Get token precedence for parsing
 * Maps TokenKind to operator precedence values
 */
export function getTokenPrecedence(kind: TokenKind): number {
	switch (kind) {
		case TokenKind.Eq:
			return 1 // Assignment has lowest precedence
		case TokenKind.Question:
			return 2 // Ternary conditional
		case TokenKind.Or:
			return 3 // Logical OR
		case TokenKind.And:
			return 4 // Logical AND (binds tighter than OR)
		case TokenKind.EqEq:
		case TokenKind.NotEq:
		case TokenKind.Lt:
		case TokenKind.Gt:
		case TokenKind.Le:
		case TokenKind.Ge:
			return 5 // Comparison operators
		case TokenKind.Plus:
		case TokenKind.Minus:
			return 6
		case TokenKind.Star:
		case TokenKind.Slash:
		case TokenKind.Percent:
			return 7
		case TokenKind.Caret:
			return 8 // Exponentiation has highest precedence
		default:
			return 0
	}
}
