import { parse } from './parser'
import type { ASTNode, ExecutionContext, RuntimeValue } from './types'
import { evaluateBinaryOperation } from './utils'
import { visit } from './visitor'

/**
 * Interpreter - evaluates an AST with given context
 * Uses a tree-walk interpreter with O(n) execution time where n is the number of AST nodes
 */
export class Interpreter {
	private context: ExecutionContext
	private variables: Map<string, number>
	private externalVariables: Set<string>

	constructor(context: ExecutionContext = {}) {
		this.context = context
		// Use Map for O(1) variable lookups (faster than object property access)
		this.variables = new Map(Object.entries(context.variables || {}))
		// Track which variables came from external context
		this.externalVariables = new Set(Object.keys(context.variables || {}))
	}

	/**
	 * Interpret an AST node and return the result
	 */
	evaluate(node: ASTNode): RuntimeValue {
		return visit(node, {
			// Execute a program (multiple statements)
			Program: (n, recurse) => {
				let result = 0
				for (const statement of n.statements) {
					result = recurse(statement)
				}
				return result
			},

			// Execute a number literal
			NumberLiteral: (n) => {
				return n.value
			},

			// Execute an identifier (variable reference)
			Identifier: (n) => {
				const value = this.variables.get(n.name)
				if (value === undefined) {
					throw new Error(`Undefined variable: ${n.name}`)
				}
				return value
			},

			// Execute a binary operation
			BinaryOp: (n, recurse) => {
				const left = recurse(n.left)
				const right = recurse(n.right)
				return evaluateBinaryOperation(n.operator, left, right)
			},

			// Execute a unary operation
			UnaryOp: (n, recurse) => {
				const arg = recurse(n.argument)

				if (n.operator === '-') {
					return -arg
				}

				if (n.operator === '!') {
					return arg === 0 ? 1 : 0
				}

				throw new Error(`Unknown unary operator: ${n.operator}`)
			},

			// Execute a function call
			FunctionCall: (n, recurse) => {
				const fn = this.context.functions?.[n.name]
				if (fn === undefined) {
					throw new Error(`Undefined function: ${n.name}`)
				}
				if (typeof fn !== 'function') {
					throw new Error(`${n.name} is not a function`)
				}

				const args = n.arguments.map(recurse)
				return fn(...args)
			},

			// Execute a variable assignment
			// External variables (from context) take precedence over script assignments
			// This allows scripts to define defaults that can be overridden at runtime
			Assignment: (n, recurse) => {
				// Check if this variable was provided externally
				if (this.externalVariables.has(n.name)) {
					// External variable exists - return it without evaluating the assignment
					const externalValue = this.variables.get(n.name)
					// externalVariables.has guarantees this exists
					if (externalValue !== undefined) {
						return externalValue
					}
				}

				// No external variable - evaluate and assign normally
				const value = recurse(n.value)
				this.variables.set(n.name, value)
				return value
			},

			// Execute a conditional expression (ternary operator)
			// Returns consequent if condition !== 0, otherwise returns alternate
			ConditionalExpression: (n, recurse) => {
				const condition = recurse(n.condition)
				return condition !== 0 ? recurse(n.consequent) : recurse(n.alternate)
			},
		})
	}
}

/**
 * Evaluate source code or AST with given context
 * @param input - Either a source code string or an AST node
 * @param context - Optional execution context with variables and functions
 */
export function evaluate(
	input: string | ASTNode,
	context?: ExecutionContext,
): RuntimeValue {
	const node = typeof input === 'string' ? parse(input) : input
	const interpreter = new Interpreter(context)
	return interpreter.evaluate(node)
}
