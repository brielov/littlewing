import type { ASTNode } from './types'
import { isAssignment, isProgram } from './types'
import { collectAllIdentifiers } from './utils'

/**
 * Extracts input variables from an AST.
 *
 * Input variables are those whose values can be determined without knowing
 * the values of other variables in the script. This includes:
 * - Literals (10, -5, 3.14)
 * - Unary minus of literals (-10)
 * - Constant expressions (2 + 3, -5 * 2)
 * - Function calls with constant arguments (MAX(10, 20), NOW())
 *
 * Computed variables (those that reference other variables) are excluded.
 *
 * @param ast - The AST to analyze (can be a single statement or Program node)
 * @returns Array of input variable names
 *
 * @example
 * ```typescript
 * const ast = parse('price = 100; tax = price * 0.08')
 * extractInputVariables(ast) // ['price']
 * ```
 */
export function extractInputVariables(ast: ASTNode): string[] {
	const inputVars = new Set<string>()

	// Handle both single statements and Program nodes
	const statements = isProgram(ast) ? ast.statements : [ast]

	for (const statement of statements) {
		if (isAssignment(statement)) {
			// Check if the assignment value contains any variable references
			if (!containsVariableReference(statement.value)) {
				inputVars.add(statement.name)
			}
		}
	}

	return Array.from(inputVars)
}

/**
 * Recursively checks if an AST node contains any variable references (Identifier nodes).
 *
 * Uses the shared collectAllIdentifiers utility to check for any identifiers in the tree.
 *
 * @param node - The AST node to check
 * @returns true if the node or any of its children contain an Identifier
 */
function containsVariableReference(node: ASTNode): boolean {
	return collectAllIdentifiers(node).size > 0
}
