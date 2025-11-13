import * as ast from './ast'
import type { ASTNode, Program } from './types'
import { isNumberLiteral, isProgram } from './types'
import { collectAllIdentifiers, evaluateBinaryOperation } from './utils'
import { visit } from './visitor'

/**
 * Eliminate dead code (unused variable assignments) from a Program.
 *
 * Uses a single backwards pass to remove assignments to variables that are
 * never read anywhere in the program. The last statement is always preserved
 * as it represents the program's return value.
 *
 * Algorithm:
 * 1. Start with an empty live set
 * 2. Process statements backwards (from last to first)
 * 3. For each statement:
 *    - If it's the last statement: always keep it
 *    - If it's an assignment: keep only if the variable is live
 *    - Add all identifiers in the statement to the live set
 * 4. Reverse the result (since we processed backwards)
 *
 * This handles transitive dependencies automatically:
 * - `x=1; y=x; z=5; z` processes as: z is live → y is dead → x is dead
 *
 * Time complexity: O(n) where n is the number of statements
 * Space complexity: O(v) where v is the number of variables
 *
 * @param program - The program node to optimize
 * @returns Program with dead assignments removed
 */
function eliminateDeadCode(program: Program): Program {
	const statements = program.statements
	const liveVars = new Set<string>()
	const keptStatements: ASTNode[] = []

	// Process statements backwards to handle transitive dependencies in one pass
	for (let i = statements.length - 1; i >= 0; i--) {
		const stmt = statements[i]
		if (!stmt) continue

		// Always keep the last statement (it's the return value)
		if (i === statements.length - 1) {
			keptStatements.push(stmt)
			// Add identifiers from the last statement to live set
			const identifiers = collectAllIdentifiers(stmt)
			for (const id of identifiers) {
				liveVars.add(id)
			}
			continue
		}

		// For assignments, check if the variable is live
		if (stmt.type === 'Assignment') {
			if (liveVars.has(stmt.name)) {
				// Variable is used later, keep the assignment
				keptStatements.push(stmt)
				// Add identifiers from the RHS to live set
				const identifiers = collectAllIdentifiers(stmt.value)
				for (const id of identifiers) {
					liveVars.add(id)
				}
			}
			// If not live, skip this assignment (dead code)
		} else {
			// Non-assignment statements are always kept
			keptStatements.push(stmt)
			// Add all identifiers to live set
			const identifiers = collectAllIdentifiers(stmt)
			for (const id of identifiers) {
				liveVars.add(id)
			}
		}
	}

	// Reverse the statements since we processed backwards
	return ast.program(keptStatements.reverse())
}

/**
 * Optimize an AST using constant folding, expression simplification, and dead code elimination.
 *
 * This optimizer performs SAFE optimizations that preserve program semantics:
 * - Constant folding: Evaluates arithmetic with literal operands at compile-time
 * - Function argument pre-evaluation: Simplifies expressions passed to functions
 * - Conditional folding: Evaluates ternary with constant condition
 * - Dead code elimination: Removes unused variable assignments
 *
 * Optimizations that are NOT performed (because they're unsafe with context variables):
 * - Variable propagation: Variables can be overridden by ExecutionContext
 * - Cross-statement analysis: Each statement may affect external state
 *
 * Time complexity: O(n) where n is the number of AST nodes
 * Space complexity: O(d) where d is the max depth (recursion stack)
 *
 * Algorithm properties:
 * - Sound: Preserves program semantics exactly
 * - Safe: No assumptions about variable values
 * - Local: Only optimizes within individual expressions
 *
 * @param node - The AST node to optimize
 * @returns Optimized AST node
 */
export function optimize(node: ASTNode): ASTNode {
	// Step 1: Apply constant folding and expression simplification
	const folded = visit<ASTNode>(node, {
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

	// Step 2: Apply dead code elimination if the result is a Program
	if (isProgram(folded) && folded.statements.length > 0) {
		return eliminateDeadCode(folded)
	}

	return folded
}
