import type { ASTNode } from "./ast";
import { isAssignment, isProgram, NodeKind } from "./ast";

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
	collectAssignedVariables(ast, seen, names);
	return names;
}

/**
 * Walk the AST collecting assignment names in definition order.
 */
function collectAssignedVariables(node: ASTNode, seen: Set<string>, names: string[]): void {
	switch (node.kind) {
		case NodeKind.Program:
			for (const statement of node.statements) {
				collectAssignedVariables(statement, seen, names);
			}
			break;
		case NodeKind.Assignment:
			if (!seen.has(node.name)) {
				seen.add(node.name);
				names.push(node.name);
			}
			// Recurse into the value in case of nested assignments
			collectAssignedVariables(node.value, seen, names);
			break;
		case NodeKind.BinaryOp:
			collectAssignedVariables(node.left, seen, names);
			collectAssignedVariables(node.right, seen, names);
			break;
		case NodeKind.UnaryOp:
			collectAssignedVariables(node.argument, seen, names);
			break;
		case NodeKind.ArrayLiteral:
			for (const e of node.elements) collectAssignedVariables(e, seen, names);
			break;
		case NodeKind.FunctionCall:
			for (const a of node.args) collectAssignedVariables(a, seen, names);
			break;
		case NodeKind.IfExpression:
			collectAssignedVariables(node.condition, seen, names);
			collectAssignedVariables(node.consequent, seen, names);
			collectAssignedVariables(node.alternate, seen, names);
			break;
		case NodeKind.ForExpression:
			collectAssignedVariables(node.iterable, seen, names);
			if (node.guard) collectAssignedVariables(node.guard, seen, names);
			if (node.accumulator) collectAssignedVariables(node.accumulator.initial, seen, names);
			collectAssignedVariables(node.body, seen, names);
			break;
		case NodeKind.IndexAccess:
			collectAssignedVariables(node.object, seen, names);
			collectAssignedVariables(node.index, seen, names);
			break;
		case NodeKind.RangeExpression:
			collectAssignedVariables(node.start, seen, names);
			collectAssignedVariables(node.end, seen, names);
			break;
		case NodeKind.PipeExpression:
			collectAssignedVariables(node.value, seen, names);
			for (const arg of node.args) collectAssignedVariables(arg, seen, names);
			break;
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Identifier:
		case NodeKind.Placeholder:
			break;
	}
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
	const recurse = (n: ASTNode): boolean => containsExternalReference(n, boundVars);

	switch (node.kind) {
		case NodeKind.Program:
			return node.statements.some(recurse);
		case NodeKind.Identifier:
			return !boundVars.has(node.name);
		case NodeKind.ArrayLiteral:
			return node.elements.some(recurse);
		case NodeKind.BinaryOp:
			return recurse(node.left) || recurse(node.right);
		case NodeKind.UnaryOp:
			return recurse(node.argument);
		case NodeKind.FunctionCall:
			return node.args.some(recurse);
		case NodeKind.Assignment:
			return recurse(node.value);
		case NodeKind.IfExpression:
			return recurse(node.condition) || recurse(node.consequent) || recurse(node.alternate);
		case NodeKind.ForExpression: {
			const innerBound = new Set(boundVars);
			innerBound.add(node.variable);
			if (node.accumulator) innerBound.add(node.accumulator.name);

			return (
				recurse(node.iterable) ||
				(node.guard ? containsExternalReference(node.guard, innerBound) : false) ||
				(node.accumulator ? recurse(node.accumulator.initial) : false) ||
				containsExternalReference(node.body, innerBound)
			);
		}
		case NodeKind.IndexAccess:
			return recurse(node.object) || recurse(node.index);
		case NodeKind.RangeExpression:
			return recurse(node.start) || recurse(node.end);
		case NodeKind.PipeExpression:
			return recurse(node.value) || node.args.some(recurse);
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Placeholder:
			return false;
	}
}

/**
 * Checks if an AST node contains any variable references (Identifier nodes).
 * Scope-aware: for-loop bindings are not counted as external references.
 */
function containsVariableReference(node: ASTNode): boolean {
	return containsExternalReference(node, new Set());
}
