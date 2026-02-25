import type { ASTNode } from "./ast";
import { isAssignment, isProgram } from "./ast";
import { collectAllIdentifiers } from "./utils";
import { visitPartial } from "./visitor";

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
	const inputVars = new Set<string>();

	const statements = isProgram(ast) ? ast.statements : [ast];

	for (const statement of statements) {
		if (isAssignment(statement)) {
			if (!containsVariableReference(statement.value)) {
				inputVars.add(statement.name);
			}
		}
	}

	return Array.from(inputVars);
}

/**
 * Extracts the names of all assigned variables from an AST.
 *
 * Walks the AST and collects the left-hand side name from every
 * `Assignment` node. Returns deduplicated names in definition order.
 *
 * @param ast - The AST to analyze (can be a single statement or Program node)
 * @returns Array of assigned variable names in definition order
 *
 * @example
 * ```typescript
 * const node = parse('totalTime = hours * 60; hoursRecovered = saved / 60')
 * extractAssignedVariables(node) // ['totalTime', 'hoursRecovered']
 * ```
 */
export function extractAssignedVariables(ast: ASTNode): string[] {
	const seen = new Set<string>();
	const names: string[] = [];

	visitPartial(
		ast,
		{
			Program: (n, recurse) => {
				for (const statement of n.statements) {
					recurse(statement);
				}
			},
			Assignment: (n, recurse) => {
				if (!seen.has(n.name)) {
					seen.add(n.name);
					names.push(n.name);
				}
				// Recurse into the value in case of nested assignments
				recurse(n.value);
			},
			IfExpression: (n, recurse) => {
				recurse(n.condition);
				recurse(n.consequent);
				recurse(n.alternate);
			},
			ForExpression: (n, recurse) => {
				recurse(n.iterable);
				if (n.guard) recurse(n.guard);
				recurse(n.body);
			},
			IndexAccess: (n, recurse) => {
				recurse(n.object);
				recurse(n.index);
			},
			RangeExpression: (n, recurse) => {
				recurse(n.start);
				recurse(n.end);
			},
		},
		// Default handler: no-op for all other node types
		() => {},
	);

	return names;
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
	return collectAllIdentifiers(node).size > 0;
}
