import * as ast from './ast'
import type { ASTNode } from './types'
import { isNumberLiteral } from './types'
import { evaluateBinaryOperation } from './utils'
import { visit } from './visitor'

/**
 * Optimize an AST using constant folding and expression simplification.
 *
 * This optimizer performs LOCAL, SAFE optimizations that preserve program semantics:
 * - Constant folding: Evaluates arithmetic with literal operands at compile-time
 * - Function argument pre-evaluation: Simplifies expressions passed to functions
 * - Conditional folding: Evaluates ternary with constant condition
 *
 * Optimizations that are NOT performed (because they're unsafe with context variables):
 * - Variable propagation: Variables can be overridden by ExecutionContext
 * - Dead code elimination: Cannot determine if variables are "dead" without knowing context
 * - Cross-statement analysis: Each statement may affect external state
 *
 * Time complexity: O(n) where n is the number of AST nodes
 * Space complexity: O(d) where d is the max depth (recursion stack)
 *
 * Algorithm properties:
 * - Sound: Preserves program semantics exactly
 * - Safe: No assumptions about variable values or liveness
 * - Local: Only optimizes within individual expressions
 *
 * @param node - The AST node to optimize
 * @returns Optimized AST node
 */
export function optimize(node: ASTNode): ASTNode {
	return visit<ASTNode>(node, {
		// Number literals are already optimal
		NumberLiteral: (n) => n,

		// Identifiers cannot be optimized (may be overridden by context)
		Identifier: (n) => n,

		// Binary operations: try to fold if both operands are literals
		BinaryOp: (n, recurse) => {
			const left = recurse(n.left)
			const right = recurse(n.right)

			// If both sides are literals, fold the operation
			if (isNumberLiteral(left) && isNumberLiteral(right)) {
				const result = evaluateBinaryOperation(
					n.operator,
					left.value,
					right.value,
				)
				return ast.number(result)
			}

			// Return optimized binary operation (even if not fully foldable)
			return ast.binaryOp(left, n.operator, right)
		},

		// Unary operations: fold if argument is a literal
		UnaryOp: (n, recurse) => {
			const argument = recurse(n.argument)

			if (isNumberLiteral(argument)) {
				if (n.operator === '-') {
					return ast.number(-argument.value)
				}
				if (n.operator === '!') {
					return ast.number(argument.value === 0 ? 1 : 0)
				}
			}

			return ast.unaryOp(n.operator, argument)
		},

		// Function calls: optimize arguments recursively
		// We cannot evaluate the function itself (runtime-dependent)
		FunctionCall: (n, recurse) => {
			const optimizedArgs = n.arguments.map(recurse)
			return ast.functionCall(n.name, optimizedArgs)
		},

		// Assignments: optimize the right-hand side
		// We cannot eliminate the assignment (the variable might be read from context)
		Assignment: (n, recurse) => {
			return ast.assign(n.name, recurse(n.value))
		},

		// Conditional expressions: fold if condition is a constant
		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n.condition)

			// If condition is a constant, choose the branch at compile-time
			if (isNumberLiteral(condition)) {
				return condition.value !== 0
					? recurse(n.consequent)
					: recurse(n.alternate)
			}

			// Otherwise, optimize all three parts
			const consequent = recurse(n.consequent)
			const alternate = recurse(n.alternate)

			return ast.conditional(condition, consequent, alternate)
		},

		// Programs: optimize each statement independently
		Program: (n, recurse) => {
			const optimizedStatements = n.statements.map(recurse)
			return ast.program(optimizedStatements)
		},
	})
}
