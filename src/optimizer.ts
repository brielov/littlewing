import * as ast from './ast'
import type { ASTNode } from './types'
import {
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	isFunctionCall,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'
import { evaluateBinaryOperation } from './utils'

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
	// Number literals are already optimal
	if (isNumberLiteral(node)) {
		return node
	}

	// Identifiers cannot be optimized (may be overridden by context)
	if (node.type === 'Identifier') {
		return node
	}

	// Binary operations: try to fold if both operands are literals
	if (isBinaryOp(node)) {
		const left = optimize(node.left)
		const right = optimize(node.right)

		// If both sides are literals, fold the operation
		if (isNumberLiteral(left) && isNumberLiteral(right)) {
			const result = evaluateBinaryOperation(
				node.operator,
				left.value,
				right.value,
			)
			return ast.number(result)
		}

		// Return optimized binary operation (even if not fully foldable)
		return ast.binaryOp(left, node.operator, right)
	}

	// Unary operations: fold if argument is a literal
	if (isUnaryOp(node)) {
		const argument = optimize(node.argument)

		if (isNumberLiteral(argument)) {
			if (node.operator === '-') {
				return ast.number(-argument.value)
			}
			if (node.operator === '!') {
				return ast.number(argument.value === 0 ? 1 : 0)
			}
		}

		return ast.unaryOp(node.operator, argument)
	}

	// Function calls: optimize arguments recursively
	// We cannot evaluate the function itself (runtime-dependent)
	if (isFunctionCall(node)) {
		const optimizedArgs = node.arguments.map((arg) => optimize(arg))
		return ast.functionCall(node.name, optimizedArgs)
	}

	// Assignments: optimize the right-hand side
	// We cannot eliminate the assignment (the variable might be read from context)
	if (isAssignment(node)) {
		return ast.assign(node.name, optimize(node.value))
	}

	// Conditional expressions: fold if condition is a constant
	if (isConditionalExpression(node)) {
		const condition = optimize(node.condition)

		// If condition is a constant, choose the branch at compile-time
		if (isNumberLiteral(condition)) {
			return condition.value !== 0
				? optimize(node.consequent)
				: optimize(node.alternate)
		}

		// Otherwise, optimize all three parts
		const consequent = optimize(node.consequent)
		const alternate = optimize(node.alternate)

		return ast.conditional(condition, consequent, alternate)
	}

	// Programs: optimize each statement independently
	if (isProgram(node)) {
		const optimizedStatements = node.statements.map((stmt) => optimize(stmt))
		return ast.program(optimizedStatements)
	}

	// Unknown node type (should never happen with correct types)
	return node
}
