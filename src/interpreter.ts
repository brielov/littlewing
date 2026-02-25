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
			for (const statement of n[1]) {
				result = recurse(statement)
			}
			return result
		},

		NumberLiteral: (n) => n[1],

		StringLiteral: (n) => n[1],

		BooleanLiteral: (n) => n[1],

		ArrayLiteral: (n, recurse) => {
			const elements = n[1].map(recurse)
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
			const name = n[1]
			const value = variables.get(name)
			if (value === undefined) {
				throw new Error(`Undefined variable: ${name}`)
			}
			return value
		},

		BinaryOp: (n, recurse) => {
			const operator = n[2]

			// Short-circuit && and ||
			if (operator === '&&') {
				const left = recurse(n[1])
				assertBoolean(left, "Operator '&&'", 'left')
				if (!left) return false
				const right = recurse(n[3])
				assertBoolean(right, "Operator '&&'", 'right')
				return right
			}

			if (operator === '||') {
				const left = recurse(n[1])
				assertBoolean(left, "Operator '||'", 'left')
				if (left) return true
				const right = recurse(n[3])
				assertBoolean(right, "Operator '||'", 'right')
				return right
			}

			const left = recurse(n[1])
			const right = recurse(n[3])
			return evaluateBinaryOperation(operator, left, right)
		},

		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const arg = recurse(n[2])

			if (operator === '-') {
				assertNumber(arg, "Operator '-' (unary)")
				return -arg
			}

			if (operator === '!') {
				assertBoolean(arg, "Operator '!'")
				return !arg
			}

			throw new Error(`Unknown unary operator: ${operator}`)
		},

		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const fn = context.functions?.[name]
			if (fn === undefined) {
				throw new Error(`Undefined function: ${name}`)
			}
			if (typeof fn !== 'function') {
				throw new Error(`${name} is not a function`)
			}

			const evaluatedArgs = args.map(recurse)
			return fn(...evaluatedArgs)
		},

		Assignment: (n, recurse) => {
			const name = n[1]
			const valueNode = n[2]
			const value = recurse(valueNode)

			if (externalVariables.has(name)) {
				const externalValue = variables.get(name)
				if (externalValue !== undefined) {
					return externalValue
				}
			}

			variables.set(name, value)
			return value
		},

		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n[1])
			assertBoolean(condition, 'Ternary condition')
			return condition ? recurse(n[2]) : recurse(n[3])
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
