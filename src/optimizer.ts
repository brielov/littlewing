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
	const statements = program[1]
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
			const name = stmt[1]
			const value = stmt[2]
			if (liveVars.has(name)) {
				keptIndices.push(i)
				const identifiers = collectAllIdentifiers(value)
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
			const elements = n[1].map(recurse)
			return ast.array(elements)
		},

		Identifier: (n) => n,

		BinaryOp: (n, recurse) => {
			const leftNode = n[1]
			const operator = n[2]
			const rightNode = n[3]

			const left = recurse(leftNode)
			const right = recurse(rightNode)

			// Both sides are number literals: fold arithmetic and comparison
			if (isNumberLiteral(left) && isNumberLiteral(right)) {
				const result = evaluateBinaryOperation(operator, left[1], right[1])
				if (typeof result === 'number') return ast.number(result)
				if (typeof result === 'boolean') return ast.boolean(result)
			}

			// Both sides are string literals
			if (isStringLiteral(left) && isStringLiteral(right)) {
				if (operator === '+') return ast.string(left[1] + right[1])
				if (
					operator === '<' ||
					operator === '>' ||
					operator === '<=' ||
					operator === '>='
				) {
					const result = evaluateBinaryOperation(operator, left[1], right[1])
					return ast.boolean(result as boolean)
				}
				if (operator === '==') return ast.boolean(left[1] === right[1])
				if (operator === '!=') return ast.boolean(left[1] !== right[1])
			}

			// Both sides are boolean literals
			if (isBooleanLiteral(left) && isBooleanLiteral(right)) {
				if (operator === '&&') return ast.boolean(left[1] && right[1])
				if (operator === '||') return ast.boolean(left[1] || right[1])
				if (operator === '==') return ast.boolean(left[1] === right[1])
				if (operator === '!=') return ast.boolean(left[1] !== right[1])
			}

			// Cross-type literal pairs: == is false, != is true
			if (isLiteral(left) && isLiteral(right)) {
				// Different types (we've already handled same-type above)
				if (left[0] !== right[0]) {
					if (operator === '==') return ast.boolean(false)
					if (operator === '!=') return ast.boolean(true)
				}
			}

			return ast.binaryOp(left, operator, right)
		},

		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const argumentNode = n[2]
			const argument = recurse(argumentNode)

			if (operator === '-' && isNumberLiteral(argument)) {
				return ast.number(-argument[1])
			}

			if (operator === '!' && isBooleanLiteral(argument)) {
				return ast.boolean(!argument[1])
			}

			return ast.unaryOp(operator, argument)
		},

		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const optimizedArgs = args.map(recurse)
			return ast.functionCall(name, optimizedArgs)
		},

		Assignment: (n, recurse) => {
			const name = n[1]
			const value = n[2]
			return ast.assign(name, recurse(value))
		},

		ConditionalExpression: (n, recurse) => {
			const conditionNode = n[1]
			const consequentNode = n[2]
			const alternateNode = n[3]

			const condition = recurse(conditionNode)

			if (isBooleanLiteral(condition)) {
				return condition[1] ? recurse(consequentNode) : recurse(alternateNode)
			}

			const consequent = recurse(consequentNode)
			const alternate = recurse(alternateNode)

			return ast.conditional(condition, consequent, alternate)
		},

		Program: (n, recurse) => {
			const statements = n[1]
			const optimizedStatements = statements.map(recurse)
			return ast.program(optimizedStatements)
		},
	})

	if (isProgram(folded) && folded[1].length > 0) {
		return eliminateDeadCode(folded)
	}

	return folded
}
