import type { ASTNode } from './ast.js';
import { forEachChild, isAssignment, isProgram, NodeKind } from './ast.js';
import { collectFreeIdentifiers } from './utils.js';

/**
 * Extracts input variables from an AST.
 *
 * Input variables are those whose first top-level assignment can be computed
 * without knowing any other variable. This includes:
 * - Literals (10, -5, 3.14)
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
	const seen = new Set<string>();
	const inputs: string[] = [];

	for (const statement of isProgram(ast) ? ast.statements : [ast]) {
		if (!isAssignment(statement) || seen.has(statement.name)) continue;
		seen.add(statement.name);

		const references = new Set<string>();
		collectFreeIdentifiers(statement.value, references);
		if (references.size === 0) inputs.push(statement.name);
	}

	return inputs;
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
	const names = new Set<string>();
	const visit = (node: ASTNode): void => {
		if (node.kind === NodeKind.Assignment) names.add(node.name);
		forEachChild(node, visit);
	};
	visit(ast);
	return Array.from(names);
}
