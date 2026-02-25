import * as ast from './ast'
import {
	type ASTNode,
	isAssignment,
	isBooleanLiteral,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	type Program,
} from './ast'
import { collectAllIdentifiers, evaluateBinaryOperation } from './utils'
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
 * Optimize an AST using constant folding, expression simplification, and dead code elimination.
 */
export function optimize(node: ASTNode): ASTNode {
	const folded = visit<ASTNode>(node, {
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

		Program: (n, recurse) => {
			const optimizedStatements = n.statements.map(recurse)
			return ast.program(optimizedStatements)
		},
	})

	if (isProgram(folded) && folded.statements.length > 0) {
		return eliminateDeadCode(folded)
	}

	return folded
}
