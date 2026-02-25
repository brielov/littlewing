import * as ast from './ast'
import {
	type ASTNode,
	isArrayLiteral,
	isAssignment,
	isBooleanLiteral,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	type Program,
} from './ast'
import {
	buildRange,
	collectAllIdentifiers,
	evaluateBinaryOperation,
	resolveIndex,
} from './utils'
import { visit } from './visitor'

/**
 * Eliminate dead code (unused variable assignments) from a Program.
 */
function eliminateDeadCode(program: Program): Program {
	const statements = program.statements
	const liveVars = new Set<string>()
	const keptIndices: number[] = []

	for (let i = statements.length - 1; i >= 0; i--) {
		const stmt = statements[i]
		if (!stmt) continue

		if (i === statements.length - 1) {
			keptIndices.push(i)
			const identifiers = collectAllIdentifiers(stmt)
			for (const id of Array.from(identifiers)) {
				liveVars.add(id)
			}
			continue
		}

		if (isAssignment(stmt)) {
			if (liveVars.has(stmt.name)) {
				keptIndices.push(i)
				const identifiers = collectAllIdentifiers(stmt.value)
				for (const id of Array.from(identifiers)) {
					liveVars.add(id)
				}
			}
		} else {
			keptIndices.push(i)
			const identifiers = collectAllIdentifiers(stmt)
			for (const id of Array.from(identifiers)) {
				liveVars.add(id)
			}
		}
	}

	const keptStatements: ASTNode[] = []
	for (let i = keptIndices.length - 1; i >= 0; i--) {
		const idx = keptIndices[i]
		if (idx !== undefined) {
			const stmt = statements[idx]
			if (stmt) {
				keptStatements.push(stmt)
			}
		}
	}

	return ast.program(keptStatements)
}

/**
 * Check if a node is any kind of literal (number, string, boolean)
 */
function isLiteral(node: ASTNode): boolean {
	return (
		isNumberLiteral(node) || isStringLiteral(node) || isBooleanLiteral(node)
	)
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
	const statements = program.statements

	// Collect for-loop variable names (they shadow any top-level assignment)
	const forLoopVars = new Set<string>()
	for (const stmt of statements) {
		collectForLoopVars(stmt, forLoopVars)
	}

	// Build map of variables assigned exactly once to a literal value
	const knownValues = new Map<string, ASTNode>()
	const reassigned = new Set<string>()

	for (const stmt of statements) {
		if (!isAssignment(stmt)) continue
		if (externalVariables.has(stmt.name)) continue
		if (forLoopVars.has(stmt.name)) continue

		if (knownValues.has(stmt.name) || reassigned.has(stmt.name)) {
			// Assigned more than once — unsafe to propagate
			knownValues.delete(stmt.name)
			reassigned.add(stmt.name)
			continue
		}

		if (isLiteral(stmt.value)) {
			knownValues.set(stmt.name, stmt.value)
		}
	}

	if (knownValues.size === 0) return null

	// Check if any identifier in the program actually references a known value.
	// If not, substitution would be a no-op — return null to terminate iteration.
	const referencedIds = new Set<string>()
	for (const stmt of statements) {
		if (isAssignment(stmt)) {
			// Only collect identifiers from the RHS of assignments and non-assignment stmts
			collectReferencedIdentifiers(stmt.value, referencedIds)
		} else {
			collectReferencedIdentifiers(stmt, referencedIds)
		}
	}

	let hasSubstitution = false
	for (const name of knownValues.keys()) {
		if (referencedIds.has(name)) {
			hasSubstitution = true
			break
		}
	}

	if (!hasSubstitution) return null

	// Substitute known values throughout the AST
	return ast.program(
		statements.map((stmt) => substituteIdentifiers(stmt, knownValues)),
	)
}

/**
 * Collect all identifier names referenced (read) in an AST node.
 * Unlike `collectAllIdentifiers` from utils, this does NOT collect
 * assignment LHS names — only identifiers used in expressions.
 */
function collectReferencedIdentifiers(node: ASTNode, ids: Set<string>): void {
	visit<void>(node, {
		Program: (n, recurse) => {
			for (const s of n.statements) recurse(s)
		},
		NumberLiteral: () => {},
		StringLiteral: () => {},
		BooleanLiteral: () => {},
		ArrayLiteral: (n, recurse) => {
			for (const e of n.elements) recurse(e)
		},
		Identifier: (n) => {
			ids.add(n.name)
		},
		BinaryOp: (n, recurse) => {
			recurse(n.left)
			recurse(n.right)
		},
		UnaryOp: (n, recurse) => {
			recurse(n.argument)
		},
		FunctionCall: (n, recurse) => {
			for (const a of n.args) recurse(a)
		},
		Assignment: (n, recurse) => {
			recurse(n.value)
		},
		IfExpression: (n, recurse) => {
			recurse(n.condition)
			recurse(n.consequent)
			recurse(n.alternate)
		},
		ForExpression: (n, recurse) => {
			recurse(n.iterable)
			if (n.guard) recurse(n.guard)
			recurse(n.body)
		},
		IndexAccess: (n, recurse) => {
			recurse(n.object)
			recurse(n.index)
		},
		RangeExpression: (n, recurse) => {
			recurse(n.start)
			recurse(n.end)
		},
	})
}

/**
 * Collect all `for` loop variable names from an AST node (recursive).
 */
function collectForLoopVars(node: ASTNode, vars: Set<string>): void {
	visit<void>(node, {
		Program: (n, recurse) => {
			for (const s of n.statements) recurse(s)
		},
		NumberLiteral: () => {},
		StringLiteral: () => {},
		BooleanLiteral: () => {},
		ArrayLiteral: (n, recurse) => {
			for (const e of n.elements) recurse(e)
		},
		Identifier: () => {},
		BinaryOp: (n, recurse) => {
			recurse(n.left)
			recurse(n.right)
		},
		UnaryOp: (n, recurse) => {
			recurse(n.argument)
		},
		FunctionCall: (n, recurse) => {
			for (const a of n.args) recurse(a)
		},
		Assignment: (n, recurse) => {
			recurse(n.value)
		},
		IfExpression: (n, recurse) => {
			recurse(n.condition)
			recurse(n.consequent)
			recurse(n.alternate)
		},
		ForExpression: (n, recurse) => {
			vars.add(n.variable)
			recurse(n.iterable)
			if (n.guard) recurse(n.guard)
			recurse(n.body)
		},
		IndexAccess: (n, recurse) => {
			recurse(n.object)
			recurse(n.index)
		},
		RangeExpression: (n, recurse) => {
			recurse(n.start)
			recurse(n.end)
		},
	})
}

/**
 * Replace Identifier nodes whose names are in `knownValues` with their literal values.
 */
function substituteIdentifiers(
	node: ASTNode,
	knownValues: ReadonlyMap<string, ASTNode>,
): ASTNode {
	return visit<ASTNode>(node, {
		Program: (n, recurse) => ast.program(n.statements.map(recurse)),
		NumberLiteral: (n) => n,
		StringLiteral: (n) => n,
		BooleanLiteral: (n) => n,
		ArrayLiteral: (n, recurse) => ast.array(n.elements.map(recurse)),
		Identifier: (n) => knownValues.get(n.name) ?? n,
		BinaryOp: (n, recurse) =>
			ast.binaryOp(recurse(n.left), n.operator, recurse(n.right)),
		UnaryOp: (n, recurse) => ast.unaryOp(n.operator, recurse(n.argument)),
		FunctionCall: (n, recurse) => ast.functionCall(n.name, n.args.map(recurse)),
		Assignment: (n, recurse) => ast.assign(n.name, recurse(n.value)),
		IfExpression: (n, recurse) =>
			ast.ifExpr(
				recurse(n.condition),
				recurse(n.consequent),
				recurse(n.alternate),
			),
		ForExpression: (n, recurse) => {
			// Do not substitute the loop variable inside for body/guard
			const innerKnown = new Map(knownValues)
			innerKnown.delete(n.variable)
			const iterable = recurse(n.iterable)
			const guard = n.guard ? substituteIdentifiers(n.guard, innerKnown) : null
			const body = substituteIdentifiers(n.body, innerKnown)
			return ast.forExpr(n.variable, iterable, guard, body)
		},
		IndexAccess: (n, recurse) =>
			ast.indexAccess(recurse(n.object), recurse(n.index)),
		RangeExpression: (n, recurse) =>
			ast.rangeExpr(recurse(n.start), recurse(n.end), n.inclusive),
	})
}

/**
 * Optimize an AST using constant folding, constant propagation, and dead code elimination.
 *
 * When `externalVariables` is provided, the optimizer can safely propagate variables
 * that are not in the set — since they cannot be overridden by `ExecutionContext.variables`.
 * Without this parameter, no variables are propagated (backward-compatible behavior).
 */
export function optimize(
	node: ASTNode,
	externalVariables?: ReadonlySet<string>,
): ASTNode {
	let propagated = fold(node)

	// Constant propagation: iterate until no more substitutions are possible.
	// Each round may create new literal assignments that enable further propagation.
	if (externalVariables !== undefined) {
		while (isProgram(propagated) && propagated.statements.length > 0) {
			const substituted = propagateConstants(propagated, externalVariables)
			if (substituted === null) break
			propagated = fold(substituted)
		}
	}

	if (isProgram(propagated) && propagated.statements.length > 0) {
		const dce = eliminateDeadCode(propagated)
		// Unwrap single-statement Programs, consistent with how parse() works
		if (dce.statements.length === 1) {
			return dce.statements[0] as ASTNode
		}
		return dce
	}

	return propagated
}

/**
 * Constant-fold an AST node, evaluating pure expressions at compile time.
 */
function fold(node: ASTNode): ASTNode {
	return visit<ASTNode>(node, {
		NumberLiteral: (n) => n,
		StringLiteral: (n) => n,
		BooleanLiteral: (n) => n,

		ArrayLiteral: (n, recurse) => {
			const elements = n.elements.map(recurse)
			return ast.array(elements)
		},

		Identifier: (n) => n,

		BinaryOp: (n, recurse) => {
			const left = recurse(n.left)
			const right = recurse(n.right)

			// Both sides are number literals: fold arithmetic and comparison
			if (isNumberLiteral(left) && isNumberLiteral(right)) {
				const result = evaluateBinaryOperation(
					n.operator,
					left.value,
					right.value,
				)
				if (typeof result === 'number') return ast.number(result)
				if (typeof result === 'boolean') return ast.boolean(result)
			}

			// Both sides are string literals
			if (isStringLiteral(left) && isStringLiteral(right)) {
				if (n.operator === '+') return ast.string(left.value + right.value)
				if (
					n.operator === '<' ||
					n.operator === '>' ||
					n.operator === '<=' ||
					n.operator === '>='
				) {
					const result = evaluateBinaryOperation(
						n.operator,
						left.value,
						right.value,
					)
					return ast.boolean(result as boolean)
				}
				if (n.operator === '==') return ast.boolean(left.value === right.value)
				if (n.operator === '!=') return ast.boolean(left.value !== right.value)
			}

			// Both sides are boolean literals
			if (isBooleanLiteral(left) && isBooleanLiteral(right)) {
				if (n.operator === '&&') return ast.boolean(left.value && right.value)
				if (n.operator === '||') return ast.boolean(left.value || right.value)
				if (n.operator === '==') return ast.boolean(left.value === right.value)
				if (n.operator === '!=') return ast.boolean(left.value !== right.value)
			}

			// Cross-type literal pairs: == is false, != is true
			if (isLiteral(left) && isLiteral(right)) {
				// Different types (we've already handled same-type above)
				if (left.kind !== right.kind) {
					if (n.operator === '==') return ast.boolean(false)
					if (n.operator === '!=') return ast.boolean(true)
				}
			}

			return ast.binaryOp(left, n.operator, right)
		},

		UnaryOp: (n, recurse) => {
			const argument = recurse(n.argument)

			if (n.operator === '-' && isNumberLiteral(argument)) {
				return ast.number(-argument.value)
			}

			if (n.operator === '!' && isBooleanLiteral(argument)) {
				return ast.boolean(!argument.value)
			}

			return ast.unaryOp(n.operator, argument)
		},

		FunctionCall: (n, recurse) => {
			const optimizedArgs = n.args.map(recurse)
			return ast.functionCall(n.name, optimizedArgs)
		},

		Assignment: (n, recurse) => {
			return ast.assign(n.name, recurse(n.value))
		},

		IfExpression: (n, recurse) => {
			const condition = recurse(n.condition)

			if (isBooleanLiteral(condition)) {
				return condition.value ? recurse(n.consequent) : recurse(n.alternate)
			}

			const consequent = recurse(n.consequent)
			const alternate = recurse(n.alternate)

			return ast.ifExpr(condition, consequent, alternate)
		},

		ForExpression: (n, recurse) => {
			const iterable = recurse(n.iterable)
			const guard = n.guard ? recurse(n.guard) : null
			const body = recurse(n.body)
			return ast.forExpr(n.variable, iterable, guard, body)
		},

		IndexAccess: (n, recurse) => {
			const object = recurse(n.object)
			const index = recurse(n.index)

			// Fold array[number] at compile time
			if (isArrayLiteral(object) && isNumberLiteral(index)) {
				const idx = index.value
				if (Number.isInteger(idx)) {
					const len = object.elements.length
					const resolved = idx < 0 ? len + idx : idx
					if (resolved >= 0 && resolved < len) {
						return object.elements[resolved] as ASTNode
					}
				}
			}

			// Fold string[number] at compile time
			if (isStringLiteral(object) && isNumberLiteral(index)) {
				try {
					const char = resolveIndex(object.value, index.value)
					return ast.string(char as string)
				} catch {
					// Out of bounds — leave unfoldable
				}
			}

			return ast.indexAccess(object, index)
		},

		RangeExpression: (n, recurse) => {
			const start = recurse(n.start)
			const end = recurse(n.end)

			// Fold constant ranges at compile time (cap at 10000 elements)
			if (isNumberLiteral(start) && isNumberLiteral(end)) {
				try {
					const limit = n.inclusive ? end.value + 1 : end.value
					const count = limit - start.value
					if (count >= 0 && count <= 10000) {
						const values = buildRange(start.value, end.value, n.inclusive)
						return ast.array(values.map(ast.number))
					}
				} catch {
					// Invalid range — leave unfoldable
				}
			}

			return ast.rangeExpr(start, end, n.inclusive)
		},

		Program: (n, recurse) => {
			const optimizedStatements = n.statements.map(recurse)
			return ast.program(optimizedStatements)
		},
	})
}
