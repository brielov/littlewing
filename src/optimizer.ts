import * as ast from './ast'
import {
	type ASTNode,
	isAssignment,
	isNumberLiteral,
	isProgram,
	type Program,
} from './ast'
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
	const statements = program[1]
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
		// Tuple: [kind, name, value]
		if (isAssignment(stmt)) {
			const name = stmt[1]
			const value = stmt[2]
			if (liveVars.has(name)) {
				// Variable is used later, keep the assignment
				keptStatements.push(stmt)
				// Add identifiers from the RHS to live set
				const identifiers = collectAllIdentifiers(value)
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
		// Tuple: [kind, value]
		NumberLiteral: (n) => n,

		// Identifiers cannot be optimized (may be overridden by context)
		// Tuple: [kind, name]
		Identifier: (n) => n,

		// Binary operations: try to fold if both operands are literals
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			const leftNode = n[1]
			const operator = n[2]
			const rightNode = n[3]

			const left = recurse(leftNode)
			const right = recurse(rightNode)

			// If both sides are literals, fold the operation
			if (isNumberLiteral(left) && isNumberLiteral(right)) {
				const result = evaluateBinaryOperation(operator, left[1], right[1])
				return ast.number(result)
			}

			// Return optimized binary operation (even if not fully foldable)
			return ast.binaryOp(left, operator, right)
		},

		// Unary operations: fold if argument is a literal
		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const argumentNode = n[2]

			const argument = recurse(argumentNode)

			if (isNumberLiteral(argument)) {
				const value = argument[1]
				if (operator === '-') {
					return ast.number(-value)
				}
				if (operator === '!') {
					return ast.number(value === 0 ? 1 : 0)
				}
			}

			return ast.unaryOp(operator, argument)
		},

		// Function calls: optimize arguments recursively
		// Tuple: [kind, name, arguments]
		// We cannot evaluate the function itself (runtime-dependent)
		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const optimizedArgs = args.map(recurse)
			return ast.functionCall(name, optimizedArgs)
		},

		// Assignments: optimize the right-hand side
		// Tuple: [kind, name, value]
		// We cannot eliminate the assignment (the variable might be read from context)
		Assignment: (n, recurse) => {
			const name = n[1]
			const value = n[2]
			return ast.assign(name, recurse(value))
		},

		// Conditional expressions: fold if condition is a constant
		// Tuple: [kind, condition, consequent, alternate]
		ConditionalExpression: (n, recurse) => {
			const conditionNode = n[1]
			const consequentNode = n[2]
			const alternateNode = n[3]

			const condition = recurse(conditionNode)

			// If condition is a constant, choose the branch at compile-time
			if (isNumberLiteral(condition)) {
				const value = condition[1]
				return value !== 0 ? recurse(consequentNode) : recurse(alternateNode)
			}

			// Otherwise, optimize all three parts
			const consequent = recurse(consequentNode)
			const alternate = recurse(alternateNode)

			return ast.conditional(condition, consequent, alternate)
		},

		// Programs: optimize each statement independently
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1]
			const optimizedStatements = statements.map(recurse)
			return ast.program(optimizedStatements)
		},
	})

	// Step 2: Apply dead code elimination if the result is a Program
	if (isProgram(folded) && folded[1].length > 0) {
		return eliminateDeadCode(folded)
	}

	return folded
}
