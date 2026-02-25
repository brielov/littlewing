import type { ASTNode } from './ast'
import { parse } from './parser'
import type { ExecutionContext, RuntimeValue } from './types'
import {
	assertBoolean,
	assertNumber,
	evaluateBinaryOperation,
	typeOf,
} from './utils'
import { visit } from './visitor'

/**
 * Evaluate an AST node with given context
 */
function evaluateNode(
	node: ASTNode,
	context: ExecutionContext,
	variables: Map<string, RuntimeValue>,
	externalVariables: Set<string>,
): RuntimeValue {
	return visit(node, {
		Program: (n, recurse) => {
			let result: RuntimeValue = 0
			for (const statement of n.statements) {
				result = recurse(statement)
			}
			return result
		},

		NumberLiteral: (n) => n.value,

		StringLiteral: (n) => n.value,

		BooleanLiteral: (n) => n.value,

		ArrayLiteral: (n, recurse) => {
			const elements = n.elements.map(recurse)
			// Validate homogeneity
			if (elements.length > 0) {
				const firstType = typeOf(elements[0] as RuntimeValue)
				for (let i = 1; i < elements.length; i++) {
					const elemType = typeOf(elements[i] as RuntimeValue)
					if (elemType !== firstType) {
						throw new TypeError(
							`Heterogeneous array: expected ${firstType}, got ${elemType} at index ${i}`,
						)
					}
				}
			}
			return elements
		},

		Identifier: (n) => {
			const value = variables.get(n.name)
			if (value === undefined) {
				throw new Error(`Undefined variable: ${n.name}`)
			}
			return value
		},

		BinaryOp: (n, recurse) => {
			// Short-circuit && and ||
			if (n.operator === '&&') {
				const left = recurse(n.left)
				assertBoolean(left, "Operator '&&'", 'left')
				if (!left) return false
				const right = recurse(n.right)
				assertBoolean(right, "Operator '&&'", 'right')
				return right
			}

			if (n.operator === '||') {
				const left = recurse(n.left)
				assertBoolean(left, "Operator '||'", 'left')
				if (left) return true
				const right = recurse(n.right)
				assertBoolean(right, "Operator '||'", 'right')
				return right
			}

			const left = recurse(n.left)
			const right = recurse(n.right)
			return evaluateBinaryOperation(n.operator, left, right)
		},

		UnaryOp: (n, recurse) => {
			const arg = recurse(n.argument)

			if (n.operator === '-') {
				assertNumber(arg, "Operator '-' (unary)")
				return -arg
			}

			if (n.operator === '!') {
				assertBoolean(arg, "Operator '!'")
				return !arg
			}

			throw new Error(`Unknown unary operator: ${n.operator}`)
		},

		FunctionCall: (n, recurse) => {
			const fn = context.functions?.[n.name]
			if (fn === undefined) {
				throw new Error(`Undefined function: ${n.name}`)
			}
			if (typeof fn !== 'function') {
				throw new Error(`${n.name} is not a function`)
			}

			const evaluatedArgs = n.args.map(recurse)
			return fn(...evaluatedArgs)
		},

		Assignment: (n, recurse) => {
			const value = recurse(n.value)

			if (externalVariables.has(n.name)) {
				const externalValue = variables.get(n.name)
				if (externalValue !== undefined) {
					return externalValue
				}
			}

			variables.set(n.name, value)
			return value
		},

		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n.condition)
			assertBoolean(condition, 'Ternary condition')
			return condition ? recurse(n.consequent) : recurse(n.alternate)
		},
	})
}

/**
 * Shared setup for evaluate and evaluateScope.
 */
function run(
	input: string | ASTNode,
	context: ExecutionContext = {},
): { value: RuntimeValue; variables: Map<string, RuntimeValue> } {
	const node = typeof input === 'string' ? parse(input) : input
	const entries = Object.entries(context.variables || {})
	const variables = new Map(entries)
	const externalVariables = new Set(entries.map(([key]) => key))

	const value = evaluateNode(node, context, variables, externalVariables)
	return { value, variables }
}

/**
 * Evaluate source code or AST with given context
 */
export function evaluate(
	input: string | ASTNode,
	context: ExecutionContext = {},
): RuntimeValue {
	return run(input, context).value
}

/**
 * Evaluate source code or AST and return the full variable scope.
 */
export function evaluateScope(
	input: string | ASTNode,
	context: ExecutionContext = {},
): Record<string, RuntimeValue> {
	const { variables } = run(input, context)
	return Object.fromEntries(variables)
}
