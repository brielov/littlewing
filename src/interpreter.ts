import type { ASTNode } from './ast'
import { parse } from './parser'
import type { ExecutionContext, RuntimeValue } from './types'
import { evaluateBinaryOperation } from './utils'
import { visit } from './visitor'

/**
 * Evaluate an AST node with given context
 * Uses a tree-walk interpreter with O(n) execution time where n is the number of AST nodes
 *
 * @param node - The AST node to evaluate
 * @param context - Execution context with variables and functions
 * @param variables - Mutable map of runtime variables (used for assignments)
 * @param externalVariables - Set of variable names from external context (immutable)
 * @returns The evaluated result
 */
function evaluateNode(
	node: ASTNode,
	context: ExecutionContext,
	variables: Map<string, number>,
	externalVariables: Set<string>,
): RuntimeValue {
	return visit(node, {
		// Execute a program (multiple statements)
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			let result = 0
			const statements = n[1]
			for (const statement of statements) {
				result = recurse(statement)
			}
			return result
		},

		// Execute a number literal
		// Tuple: [kind, value]
		NumberLiteral: (n) => {
			return n[1]
		},

		// Execute an identifier (variable reference)
		// Tuple: [kind, name]
		Identifier: (n) => {
			const name = n[1]
			const value = variables.get(name)
			if (value === undefined) {
				throw new Error(`Undefined variable: ${name}`)
			}
			return value
		},

		// Execute a binary operation
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			const left = recurse(n[1])
			const operator = n[2]
			const right = recurse(n[3])
			return evaluateBinaryOperation(operator, left, right)
		},

		// Execute a unary operation
		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const arg = recurse(n[2])

			if (operator === '-') {
				return -arg
			}

			if (operator === '!') {
				return arg === 0 ? 1 : 0
			}

			throw new Error(`Unknown unary operator: ${operator}`)
		},

		// Execute a function call
		// Tuple: [kind, name, arguments]
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

		// Execute a variable assignment
		// Tuple: [kind, name, value]
		// External variables (from context) take precedence over script assignments
		// This allows scripts to define defaults that can be overridden at runtime
		//
		// IMPORTANT: We MUST evaluate the RHS for side effects even when external
		// variable exists (e.g., `x = NOW()` should call NOW() for side effects)
		Assignment: (n, recurse) => {
			const name = n[1]
			const valueNode = n[2]

			// Always evaluate RHS for side effects (function calls, etc.)
			const value = recurse(valueNode)

			// Check if this variable was provided externally
			if (externalVariables.has(name)) {
				// External variable exists - return it (ignore evaluated value)
				const externalValue = variables.get(name)
				// externalVariables.has guarantees this exists
				if (externalValue !== undefined) {
					return externalValue
				}
			}

			// No external variable - use the evaluated value
			variables.set(name, value)
			return value
		},

		// Execute a conditional expression (ternary operator)
		// Tuple: [kind, condition, consequent, alternate]
		// Returns consequent if condition !== 0, otherwise returns alternate
		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n[1])
			const consequent = n[2]
			const alternate = n[3]
			return condition !== 0 ? recurse(consequent) : recurse(alternate)
		},
	})
}

/**
 * Evaluate source code or AST with given context
 * @param input - Either a source code string or an AST node
 * @param context - Optional execution context with variables and functions
 * @returns The evaluated result
 */
export function evaluate(
	input: string | ASTNode,
	context: ExecutionContext = {},
): RuntimeValue {
	const node = typeof input === 'string' ? parse(input) : input

	// Use Map for O(1) variable lookups (faster than object property access)
	// Extract entries once - used for both Map construction and Set derivation
	// Using || {} is faster than branching for the common case
	const entries = Object.entries(context.variables || {})
	const variables = new Map(entries)
	// Build Set from entries array to avoid re-iterating the object
	// entries is [[key, value], ...] so we map to just keys
	const externalVariables = new Set(entries.map(([key]) => key))

	return evaluateNode(node, context, variables, externalVariables)
}
