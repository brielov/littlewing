import type { ASTNode } from './types'
import { isAssignment, isProgram } from './types'
import { visitPartial } from './visitor'

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
 * const ast = parseSource('price = 100; tax = price * 0.08')
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
 * Uses the visitor pattern to traverse the AST. Returns true if any Identifier node is found.
 *
 * @param node - The AST node to check
 * @returns true if the node or any of its children contain an Identifier
 */
function containsVariableReference(node: ASTNode): boolean {
	let hasIdentifier = false

	visitPartial(
		node,
		{
			// If we find an identifier, we're done
			Identifier: () => {
				hasIdentifier = true
				return undefined
			},
		},
		(n, recurse) => {
			// Early exit if we already found an identifier
			if (hasIdentifier) {
				return undefined
			}

			// Default: recurse into all children
			switch (n.type) {
				case 'NumberLiteral':
					// Leaf node, no recursion needed
					return undefined
				case 'BinaryOp':
					recurse(n.left)
					recurse(n.right)
					return undefined
				case 'UnaryOp':
					recurse(n.argument)
					return undefined
				case 'FunctionCall':
					for (const arg of n.arguments) {
						recurse(arg)
						if (hasIdentifier) break // Early exit
					}
					return undefined
				case 'ConditionalExpression':
					recurse(n.condition)
					if (!hasIdentifier) recurse(n.consequent)
					if (!hasIdentifier) recurse(n.alternate)
					return undefined
				case 'Program':
					for (const stmt of n.statements) {
						recurse(stmt)
						if (hasIdentifier) break // Early exit
					}
					return undefined
				case 'Assignment':
					recurse(n.value)
					return undefined
				default:
					return undefined
			}
		},
	)

	return hasIdentifier
}
