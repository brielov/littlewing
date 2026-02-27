import * as ast from "./ast";
import {
	type ASTNode,
	isArrayLiteral,
	isAssignment,
	isBooleanLiteral,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	NodeKind,
	type Program,
} from "./ast";
import { buildRange, collectAllIdentifiers, evaluateBinaryOperation, resolveIndex } from "./utils";

/**
 * Copy leadingComments and trailingComments from original node to replacement node when present.
 * Returns the replacement unchanged if there are no comments to preserve.
 */
function preserveComments<T extends ASTNode>(original: ASTNode, replacement: T): T {
	const hasLeading = original.leadingComments && original.leadingComments.length > 0;
	const hasTrailing = original.trailingComments && original.trailingComments.length > 0;
	if (!hasLeading && !hasTrailing) return replacement;
	return {
		...replacement,
		...(hasLeading ? { leadingComments: original.leadingComments } : {}),
		...(hasTrailing ? { trailingComments: original.trailingComments } : {}),
	};
}

/**
 * Eliminate dead code (unused variable assignments) from a Program.
 */
function eliminateDeadCode(program: Program): Program {
	const statements = program.statements;
	const liveVars = new Set<string>();
	const keptIndices: number[] = [];

	for (let i = statements.length - 1; i >= 0; i--) {
		const stmt = statements[i];
		if (!stmt) continue;

		if (i === statements.length - 1) {
			keptIndices.push(i);
			const identifiers = collectAllIdentifiers(stmt);
			for (const id of identifiers) {
				liveVars.add(id);
			}
			continue;
		}

		if (isAssignment(stmt)) {
			if (liveVars.has(stmt.name) || mightHaveSideEffects(stmt.value)) {
				keptIndices.push(i);
				const identifiers = collectAllIdentifiers(stmt.value);
				for (const id of identifiers) {
					liveVars.add(id);
				}
			}
		} else {
			keptIndices.push(i);
			const identifiers = collectAllIdentifiers(stmt);
			for (const id of identifiers) {
				liveVars.add(id);
			}
		}
	}

	const keptStatements: ASTNode[] = [];
	for (let i = keptIndices.length - 1; i >= 0; i--) {
		const idx = keptIndices[i];
		if (idx !== undefined) {
			const stmt = statements[idx];
			if (stmt) {
				keptStatements.push(stmt);
			}
		}
	}

	const result = ast.program(keptStatements);
	if (program.trailingComments && program.trailingComments.length > 0) {
		return { ...result, trailingComments: program.trailingComments };
	}
	return result;
}

/**
 * Check if a node is any kind of literal (number, string, boolean)
 */
function isLiteral(node: ASTNode): boolean {
	return isNumberLiteral(node) || isStringLiteral(node) || isBooleanLiteral(node);
}

/**
 * Check if a node might have side effects (contains function calls or nested assignments).
 * Function calls may invoke user-provided functions with side effects.
 * Nested assignments write to variables as a side effect.
 *
 * Uses direct recursion with switch dispatch to avoid visitor object and closure allocation.
 */
function mightHaveSideEffects(node: ASTNode): boolean {
	switch (node.kind) {
		case NodeKind.Program:
			return node.statements.some(mightHaveSideEffects);
		case NodeKind.ArrayLiteral:
			return node.elements.some(mightHaveSideEffects);
		case NodeKind.BinaryOp:
			return mightHaveSideEffects(node.left) || mightHaveSideEffects(node.right);
		case NodeKind.UnaryOp:
			return mightHaveSideEffects(node.argument);
		case NodeKind.IfExpression:
			return (
				mightHaveSideEffects(node.condition) ||
				mightHaveSideEffects(node.consequent) ||
				mightHaveSideEffects(node.alternate)
			);
		case NodeKind.ForExpression:
			return (
				mightHaveSideEffects(node.iterable) ||
				(node.guard !== null && mightHaveSideEffects(node.guard)) ||
				(node.accumulator !== null && mightHaveSideEffects(node.accumulator.initial)) ||
				mightHaveSideEffects(node.body)
			);
		case NodeKind.IndexAccess:
			return mightHaveSideEffects(node.object) || mightHaveSideEffects(node.index);
		case NodeKind.RangeExpression:
			return mightHaveSideEffects(node.start) || mightHaveSideEffects(node.end);
		case NodeKind.FunctionCall:
		case NodeKind.PipeExpression:
		case NodeKind.Assignment:
			return true;
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Identifier:
		case NodeKind.Placeholder:
			return false;
	}
}

/**
 * Propagate constants by substituting single-assignment literal variables.
 *
 * Only variables that are:
 * - Assigned exactly once at the program top level
 * - Assigned a literal value (number, string, boolean) after initial folding
 * - Not in the externalVariables set (those can be overridden by context)
 * - Not used as a `for` loop variable (those are rebound per iteration)
 *
 * are eligible for propagation.
 */
function propagateConstants(
	program: Program,
	externalVariables: ReadonlySet<string>,
): Program | null {
	const statements = program.statements;

	// Collect for-loop variable names (they shadow any top-level assignment)
	const forLoopVars = new Set<string>();
	for (const stmt of statements) {
		collectForLoopVars(stmt, forLoopVars);
	}

	// Count all assignments at every depth to detect nested reassignment
	const allAssignmentCounts = new Map<string, number>();
	for (const stmt of statements) {
		countAssignments(stmt, allAssignmentCounts);
	}

	// Build map of variables assigned exactly once (globally) to a literal value
	const knownValues = new Map<string, ASTNode>();

	for (const stmt of statements) {
		if (!isAssignment(stmt)) continue;
		if (externalVariables.has(stmt.name)) continue;
		if (forLoopVars.has(stmt.name)) continue;

		const totalCount = allAssignmentCounts.get(stmt.name) ?? 0;
		if (totalCount > 1) continue;

		if (isLiteral(stmt.value)) {
			knownValues.set(stmt.name, stmt.value);
		}
	}

	if (knownValues.size === 0) return null;

	// Check if any identifier in the program actually references a known value.
	// If not, substitution would be a no-op — return null to terminate iteration.
	const referencedIds = new Set<string>();
	for (const stmt of statements) {
		if (isAssignment(stmt)) {
			// Only collect identifiers from the RHS of assignments and non-assignment stmts
			collectReferencedIdentifiers(stmt.value, referencedIds);
		} else {
			collectReferencedIdentifiers(stmt, referencedIds);
		}
	}

	let hasSubstitution = false;
	for (const name of knownValues.keys()) {
		if (referencedIds.has(name)) {
			hasSubstitution = true;
			break;
		}
	}

	if (!hasSubstitution) return null;

	// Substitute known values throughout the AST
	const result = ast.program(statements.map((stmt) => substituteIdentifiers(stmt, knownValues)));
	if (program.trailingComments && program.trailingComments.length > 0) {
		return { ...result, trailingComments: program.trailingComments };
	}
	return result;
}

/**
 * Collect all identifier names referenced (read) in an AST node.
 * Unlike `collectAllIdentifiers` from utils, this does NOT collect
 * assignment LHS names — only identifiers used in expressions.
 *
 * Uses direct recursion with switch dispatch to avoid visitor object and closure allocation.
 */
function collectReferencedIdentifiers(node: ASTNode, ids: Set<string>): void {
	switch (node.kind) {
		case NodeKind.Program:
			for (const s of node.statements) collectReferencedIdentifiers(s, ids);
			break;
		case NodeKind.Identifier:
			ids.add(node.name);
			break;
		case NodeKind.ArrayLiteral:
			for (const e of node.elements) collectReferencedIdentifiers(e, ids);
			break;
		case NodeKind.BinaryOp:
			collectReferencedIdentifiers(node.left, ids);
			collectReferencedIdentifiers(node.right, ids);
			break;
		case NodeKind.UnaryOp:
			collectReferencedIdentifiers(node.argument, ids);
			break;
		case NodeKind.FunctionCall:
			for (const a of node.args) collectReferencedIdentifiers(a, ids);
			break;
		case NodeKind.Assignment:
			collectReferencedIdentifiers(node.value, ids);
			break;
		case NodeKind.IfExpression:
			collectReferencedIdentifiers(node.condition, ids);
			collectReferencedIdentifiers(node.consequent, ids);
			collectReferencedIdentifiers(node.alternate, ids);
			break;
		case NodeKind.ForExpression:
			collectReferencedIdentifiers(node.iterable, ids);
			if (node.guard) collectReferencedIdentifiers(node.guard, ids);
			if (node.accumulator) collectReferencedIdentifiers(node.accumulator.initial, ids);
			collectReferencedIdentifiers(node.body, ids);
			break;
		case NodeKind.IndexAccess:
			collectReferencedIdentifiers(node.object, ids);
			collectReferencedIdentifiers(node.index, ids);
			break;
		case NodeKind.RangeExpression:
			collectReferencedIdentifiers(node.start, ids);
			collectReferencedIdentifiers(node.end, ids);
			break;
		case NodeKind.PipeExpression:
			collectReferencedIdentifiers(node.value, ids);
			for (const a of node.args) collectReferencedIdentifiers(a, ids);
			break;
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Placeholder:
			break;
	}
}

/**
 * Collect all `for` loop variable names from an AST node (recursive).
 *
 * Uses direct recursion with switch dispatch to avoid visitor object and closure allocation.
 */
function collectForLoopVars(node: ASTNode, vars: Set<string>): void {
	switch (node.kind) {
		case NodeKind.Program:
			for (const s of node.statements) collectForLoopVars(s, vars);
			break;
		case NodeKind.ArrayLiteral:
			for (const e of node.elements) collectForLoopVars(e, vars);
			break;
		case NodeKind.BinaryOp:
			collectForLoopVars(node.left, vars);
			collectForLoopVars(node.right, vars);
			break;
		case NodeKind.UnaryOp:
			collectForLoopVars(node.argument, vars);
			break;
		case NodeKind.FunctionCall:
			for (const a of node.args) collectForLoopVars(a, vars);
			break;
		case NodeKind.Assignment:
			collectForLoopVars(node.value, vars);
			break;
		case NodeKind.IfExpression:
			collectForLoopVars(node.condition, vars);
			collectForLoopVars(node.consequent, vars);
			collectForLoopVars(node.alternate, vars);
			break;
		case NodeKind.ForExpression:
			vars.add(node.variable);
			if (node.accumulator) vars.add(node.accumulator.name);
			collectForLoopVars(node.iterable, vars);
			if (node.guard) collectForLoopVars(node.guard, vars);
			if (node.accumulator) collectForLoopVars(node.accumulator.initial, vars);
			collectForLoopVars(node.body, vars);
			break;
		case NodeKind.IndexAccess:
			collectForLoopVars(node.object, vars);
			collectForLoopVars(node.index, vars);
			break;
		case NodeKind.RangeExpression:
			collectForLoopVars(node.start, vars);
			collectForLoopVars(node.end, vars);
			break;
		case NodeKind.PipeExpression:
			collectForLoopVars(node.value, vars);
			for (const a of node.args) collectForLoopVars(a, vars);
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
 * Count all assignments at every depth in an AST node.
 * Used to detect nested reassignment that the top-level scan would miss.
 *
 * Uses direct recursion with switch dispatch to avoid visitor object and closure allocation.
 */
function countAssignments(node: ASTNode, counts: Map<string, number>): void {
	switch (node.kind) {
		case NodeKind.Program:
			for (const s of node.statements) countAssignments(s, counts);
			break;
		case NodeKind.Assignment:
			counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
			countAssignments(node.value, counts);
			break;
		case NodeKind.ArrayLiteral:
			for (const e of node.elements) countAssignments(e, counts);
			break;
		case NodeKind.BinaryOp:
			countAssignments(node.left, counts);
			countAssignments(node.right, counts);
			break;
		case NodeKind.UnaryOp:
			countAssignments(node.argument, counts);
			break;
		case NodeKind.FunctionCall:
			for (const a of node.args) countAssignments(a, counts);
			break;
		case NodeKind.IfExpression:
			countAssignments(node.condition, counts);
			countAssignments(node.consequent, counts);
			countAssignments(node.alternate, counts);
			break;
		case NodeKind.ForExpression:
			countAssignments(node.iterable, counts);
			if (node.guard) countAssignments(node.guard, counts);
			if (node.accumulator) countAssignments(node.accumulator.initial, counts);
			countAssignments(node.body, counts);
			break;
		case NodeKind.IndexAccess:
			countAssignments(node.object, counts);
			countAssignments(node.index, counts);
			break;
		case NodeKind.RangeExpression:
			countAssignments(node.start, counts);
			countAssignments(node.end, counts);
			break;
		case NodeKind.PipeExpression:
			countAssignments(node.value, counts);
			for (const a of node.args) countAssignments(a, counts);
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
 * Returns true if all elements in original and mapped are reference-equal.
 * Used to detect when a recursive map produced no changes, enabling identity return.
 */
function unchangedArray(original: readonly ASTNode[], mapped: readonly ASTNode[]): boolean {
	for (let i = 0; i < original.length; i++) {
		if (original[i] !== mapped[i]) return false;
	}
	return true;
}

/**
 * Replace Identifier nodes whose names are in `knownValues` with their literal values.
 * Returns the original node unchanged when no substitution occurs (identity optimization).
 */
function substituteIdentifiers(node: ASTNode, knownValues: ReadonlyMap<string, ASTNode>): ASTNode {
	const recurse = (n: ASTNode): ASTNode => substituteIdentifiers(n, knownValues);

	switch (node.kind) {
		case NodeKind.Program: {
			const stmts = node.statements.map(recurse);
			if (unchangedArray(node.statements, stmts)) return node;
			const result = ast.program(stmts);
			if (node.trailingComments && node.trailingComments.length > 0) {
				return { ...result, trailingComments: node.trailingComments };
			}
			return result;
		}
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Placeholder:
			return node;
		case NodeKind.ArrayLiteral: {
			const elements = node.elements.map(recurse);
			if (unchangedArray(node.elements, elements)) return node;
			return preserveComments(node, ast.array(elements));
		}
		case NodeKind.Identifier: {
			const replacement = knownValues.get(node.name);
			return replacement ? preserveComments(node, replacement) : node;
		}
		case NodeKind.BinaryOp: {
			const left = recurse(node.left);
			const right = recurse(node.right);
			if (left === node.left && right === node.right) return node;
			return preserveComments(node, ast.binaryOp(left, node.operator, right));
		}
		case NodeKind.UnaryOp: {
			const argument = recurse(node.argument);
			if (argument === node.argument) return node;
			return preserveComments(node, ast.unaryOp(node.operator, argument));
		}
		case NodeKind.FunctionCall: {
			const args = node.args.map(recurse);
			if (unchangedArray(node.args, args)) return node;
			return preserveComments(node, ast.functionCall(node.name, args));
		}
		case NodeKind.Assignment: {
			const value = recurse(node.value);
			if (value === node.value) return node;
			return preserveComments(node, ast.assign(node.name, value));
		}
		case NodeKind.IfExpression: {
			const condition = recurse(node.condition);
			const consequent = recurse(node.consequent);
			const alternate = recurse(node.alternate);
			if (
				condition === node.condition &&
				consequent === node.consequent &&
				alternate === node.alternate
			)
				return node;
			return preserveComments(node, ast.ifExpr(condition, consequent, alternate));
		}
		case NodeKind.ForExpression: {
			// Do not substitute the loop variable or accumulator name inside for body/guard
			const innerKnown = new Map(knownValues);
			innerKnown.delete(node.variable);
			if (node.accumulator) innerKnown.delete(node.accumulator.name);
			const iterable = recurse(node.iterable);
			const guard = node.guard ? substituteIdentifiers(node.guard, innerKnown) : null;
			// Accumulator initial is evaluated in outer scope, so use outer knownValues
			const initial = node.accumulator ? recurse(node.accumulator.initial) : null;
			const body = substituteIdentifiers(node.body, innerKnown);
			if (
				iterable === node.iterable &&
				guard === node.guard &&
				(node.accumulator === null || initial === node.accumulator.initial) &&
				body === node.body
			)
				return node;
			const accumulator = node.accumulator
				? { name: node.accumulator.name, initial: initial as ASTNode }
				: null;
			return preserveComments(node, ast.forExpr(node.variable, iterable, guard, accumulator, body));
		}
		case NodeKind.IndexAccess: {
			const object = recurse(node.object);
			const index = recurse(node.index);
			if (object === node.object && index === node.index) return node;
			return preserveComments(node, ast.indexAccess(object, index));
		}
		case NodeKind.RangeExpression: {
			const start = recurse(node.start);
			const end = recurse(node.end);
			if (start === node.start && end === node.end) return node;
			return preserveComments(node, ast.rangeExpr(start, end, node.inclusive));
		}
		case NodeKind.PipeExpression: {
			const value = recurse(node.value);
			const args = node.args.map(recurse);
			if (value === node.value && unchangedArray(node.args, args)) return node;
			return preserveComments(node, ast.pipeExpr(value, node.name, args));
		}
	}
}

/**
 * Optimize an AST using constant folding, constant propagation, and dead code elimination.
 *
 * When `externalVariables` is provided, the optimizer can safely propagate variables
 * that are not in the set — since they cannot be overridden by `ExecutionContext.variables`.
 * Without this parameter, no variables are propagated (backward-compatible behavior).
 */
export function optimize(node: ASTNode, externalVariables?: ReadonlySet<string>): ASTNode {
	let propagated = fold(node);

	// Constant propagation: iterate until no more substitutions are possible.
	// Each round may create new literal assignments that enable further propagation.
	if (externalVariables !== undefined) {
		while (isProgram(propagated) && propagated.statements.length > 0) {
			const substituted = propagateConstants(propagated, externalVariables);
			if (substituted === null) break;
			propagated = fold(substituted);
		}
	}

	if (isProgram(propagated) && propagated.statements.length > 0) {
		const dce = eliminateDeadCode(propagated);
		// Unwrap single-statement Programs, consistent with how parse() works
		if (dce.statements.length === 1) {
			const stmt = dce.statements[0] as ASTNode;
			// Merge Program's trailing comments into the single statement's trailing
			if (dce.trailingComments && dce.trailingComments.length > 0) {
				const existing = stmt.trailingComments
					? [...stmt.trailingComments, ...dce.trailingComments]
					: dce.trailingComments;
				return { ...stmt, trailingComments: existing };
			}
			return stmt;
		}
		return dce;
	}

	return propagated;
}

/**
 * Constant-fold an AST node, evaluating pure expressions at compile time.
 * Returns the original node unchanged when no folding occurs (identity optimization).
 */
function fold(node: ASTNode): ASTNode {
	const recurse = fold;

	switch (node.kind) {
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Identifier:
		case NodeKind.Placeholder:
			return node;

		case NodeKind.Program: {
			const optimizedStatements = node.statements.map(recurse);
			if (unchangedArray(node.statements, optimizedStatements)) return node;
			const result = ast.program(optimizedStatements);
			if (node.trailingComments && node.trailingComments.length > 0) {
				return { ...result, trailingComments: node.trailingComments };
			}
			return result;
		}

		case NodeKind.ArrayLiteral: {
			const elements = node.elements.map(recurse);
			if (unchangedArray(node.elements, elements)) return node;
			return preserveComments(node, ast.array(elements));
		}

		case NodeKind.BinaryOp: {
			const left = recurse(node.left);
			const right = recurse(node.right);

			// Both sides are number literals: fold arithmetic and comparison
			if (isNumberLiteral(left) && isNumberLiteral(right)) {
				const result = evaluateBinaryOperation(node.operator, left.value, right.value);
				if (typeof result === "number") return preserveComments(node, ast.number(result));
				if (typeof result === "boolean") return preserveComments(node, ast.boolean(result));
			}

			// Both sides are string literals
			if (isStringLiteral(left) && isStringLiteral(right)) {
				if (node.operator === "+")
					return preserveComments(node, ast.string(left.value + right.value));
				if (
					node.operator === "<" ||
					node.operator === ">" ||
					node.operator === "<=" ||
					node.operator === ">="
				) {
					const result = evaluateBinaryOperation(node.operator, left.value, right.value);
					return preserveComments(node, ast.boolean(result as boolean));
				}
				if (node.operator === "==")
					return preserveComments(node, ast.boolean(left.value === right.value));
				if (node.operator === "!=")
					return preserveComments(node, ast.boolean(left.value !== right.value));
			}

			// Both sides are boolean literals
			if (isBooleanLiteral(left) && isBooleanLiteral(right)) {
				if (node.operator === "&&")
					return preserveComments(node, ast.boolean(left.value && right.value));
				if (node.operator === "||")
					return preserveComments(node, ast.boolean(left.value || right.value));
				if (node.operator === "==")
					return preserveComments(node, ast.boolean(left.value === right.value));
				if (node.operator === "!=")
					return preserveComments(node, ast.boolean(left.value !== right.value));
			}

			// Cross-type literal pairs: == is false, != is true
			if (isLiteral(left) && isLiteral(right)) {
				// Different types (we've already handled same-type above)
				if (left.kind !== right.kind) {
					if (node.operator === "==") return preserveComments(node, ast.boolean(false));
					if (node.operator === "!=") return preserveComments(node, ast.boolean(true));
				}
			}

			if (left === node.left && right === node.right) return node;
			return preserveComments(node, ast.binaryOp(left, node.operator, right));
		}

		case NodeKind.UnaryOp: {
			const argument = recurse(node.argument);

			if (node.operator === "-" && isNumberLiteral(argument)) {
				return preserveComments(node, ast.number(-argument.value));
			}

			if (node.operator === "!" && isBooleanLiteral(argument)) {
				return preserveComments(node, ast.boolean(!argument.value));
			}

			if (argument === node.argument) return node;
			return preserveComments(node, ast.unaryOp(node.operator, argument));
		}

		case NodeKind.FunctionCall: {
			const optimizedArgs = node.args.map(recurse);
			if (unchangedArray(node.args, optimizedArgs)) return node;
			return preserveComments(node, ast.functionCall(node.name, optimizedArgs));
		}

		case NodeKind.Assignment: {
			const value = recurse(node.value);
			if (value === node.value) return node;
			return preserveComments(node, ast.assign(node.name, value));
		}

		case NodeKind.IfExpression: {
			const condition = recurse(node.condition);

			if (isBooleanLiteral(condition)) {
				const result = condition.value ? recurse(node.consequent) : recurse(node.alternate);
				return preserveComments(node, result);
			}

			const consequent = recurse(node.consequent);
			const alternate = recurse(node.alternate);

			if (
				condition === node.condition &&
				consequent === node.consequent &&
				alternate === node.alternate
			)
				return node;
			return preserveComments(node, ast.ifExpr(condition, consequent, alternate));
		}

		case NodeKind.ForExpression: {
			const iterable = recurse(node.iterable);
			const guard = node.guard ? recurse(node.guard) : null;
			const initial = node.accumulator ? recurse(node.accumulator.initial) : null;
			const body = recurse(node.body);

			if (
				iterable === node.iterable &&
				guard === node.guard &&
				(node.accumulator === null || initial === node.accumulator.initial) &&
				body === node.body
			)
				return node;

			const accumulator = node.accumulator
				? { name: node.accumulator.name, initial: initial as ASTNode }
				: null;
			return preserveComments(node, ast.forExpr(node.variable, iterable, guard, accumulator, body));
		}

		case NodeKind.IndexAccess: {
			const object = recurse(node.object);
			const index = recurse(node.index);

			// Fold array[number] at compile time
			if (isArrayLiteral(object) && isNumberLiteral(index)) {
				const idx = index.value;
				if (Number.isInteger(idx)) {
					const len = object.elements.length;
					const resolved = idx < 0 ? len + idx : idx;
					if (resolved >= 0 && resolved < len) {
						return preserveComments(node, object.elements[resolved] as ASTNode);
					}
				}
			}

			// Fold string[number] at compile time
			if (isStringLiteral(object) && isNumberLiteral(index)) {
				try {
					const char = resolveIndex(object.value, index.value);
					return preserveComments(node, ast.string(char as string));
				} catch {
					// Out of bounds — leave unfoldable
				}
			}

			if (object === node.object && index === node.index) return node;
			return preserveComments(node, ast.indexAccess(object, index));
		}

		case NodeKind.RangeExpression: {
			const start = recurse(node.start);
			const end = recurse(node.end);

			// Fold constant ranges at compile time (cap at 10000 elements)
			if (isNumberLiteral(start) && isNumberLiteral(end)) {
				try {
					const limit = node.inclusive ? end.value + 1 : end.value;
					const count = limit - start.value;
					if (count >= 0 && count <= 10000) {
						const values = buildRange(start.value, end.value, node.inclusive);
						return preserveComments(node, ast.array(values.map(ast.number)));
					}
				} catch {
					// Invalid range — leave unfoldable
				}
			}

			if (start === node.start && end === node.end) return node;
			return preserveComments(node, ast.rangeExpr(start, end, node.inclusive));
		}

		case NodeKind.PipeExpression: {
			const value = recurse(node.value);
			const optimizedArgs = node.args.map(recurse);
			if (value === node.value && unchangedArray(node.args, optimizedArgs)) return node;
			return preserveComments(node, ast.pipeExpr(value, node.name, optimizedArgs));
		}
	}
}
