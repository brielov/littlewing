import type { ASTNode } from "./ast";
import { isAssignment, isProgram } from "./ast";
import { visit, visitPartial } from "./visitor";

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
				if (n.accumulator) recurse(n.accumulator.initial);
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
 * Recursively checks if an AST node references any external variables.
 *
 * Scope-aware: for-loop variables and accumulator names are treated as local bindings
 * and excluded from the check. Only identifiers not bound by an enclosing for-expression
 * are considered external references.
 *
 * @param node - The AST node to check
 * @param boundVars - Set of variable names bound by enclosing scopes
 * @returns true if the node or any of its children reference an external variable
 */
function containsExternalReference(node: ASTNode, boundVars: ReadonlySet<string>): boolean {
	return visit<boolean>(node, {
		Program: (n, recurse) => n.statements.some(recurse),
		NumberLiteral: () => false,
		StringLiteral: () => false,
		BooleanLiteral: () => false,
		Identifier: (n) => !boundVars.has(n.name),
		ArrayLiteral: (n, recurse) => n.elements.some(recurse),
		BinaryOp: (n, recurse) => recurse(n.left) || recurse(n.right),
		UnaryOp: (n, recurse) => recurse(n.argument),
		FunctionCall: (n, recurse) => n.args.some(recurse),
		Assignment: (n, recurse) => recurse(n.value),
		IfExpression: (n, recurse) =>
			recurse(n.condition) || recurse(n.consequent) || recurse(n.alternate),
		ForExpression: (n, recurse) => {
			const innerBound = new Set(boundVars);
			innerBound.add(n.variable);
			if (n.accumulator) innerBound.add(n.accumulator.name);

			return (
				recurse(n.iterable) ||
				(n.guard ? containsExternalReference(n.guard, innerBound) : false) ||
				(n.accumulator ? recurse(n.accumulator.initial) : false) ||
				containsExternalReference(n.body, innerBound)
			);
		},
		IndexAccess: (n, recurse) => recurse(n.object) || recurse(n.index),
		RangeExpression: (n, recurse) => recurse(n.start) || recurse(n.end),
	});
}

/**
 * Checks if an AST node contains any variable references (Identifier nodes).
 * Scope-aware: for-loop bindings are not counted as external references.
 */
function containsVariableReference(node: ASTNode): boolean {
	return containsExternalReference(node, new Set());
}
