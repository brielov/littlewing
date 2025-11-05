import { parseSource } from './parser'
import type {
	ASTNode,
	Assignment,
	BinaryOp,
	ConditionalExpression,
	ExecutionContext,
	FunctionCall,
	Identifier,
	NullishAssignment,
	NumberLiteral,
	Program,
	RuntimeValue,
	UnaryOp,
} from './types'
import {
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	isFunctionCall,
	isIdentifier,
	isNullishAssignment,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'
import { evaluateBinaryOperation } from './utils'

/**
 * Executor - evaluates an AST with given context
 */
export class Executor {
	private context: ExecutionContext
	private variables: Map<string, number>

	constructor(context: ExecutionContext = {}) {
		this.context = context
		this.variables = new Map(Object.entries(context.variables || {}))
	}

	/**
	 * Execute an AST node and return the result
	 */
	execute(node: ASTNode): RuntimeValue {
		if (isProgram(node)) return this.executeProgram(node)
		if (isNumberLiteral(node)) return this.executeNumberLiteral(node)
		if (isIdentifier(node)) return this.executeIdentifier(node)
		if (isBinaryOp(node)) return this.executeBinaryOp(node)
		if (isUnaryOp(node)) return this.executeUnaryOp(node)
		if (isFunctionCall(node)) return this.executeFunctionCall(node)
		if (isAssignment(node)) return this.executeAssignment(node)
		if (isNullishAssignment(node)) return this.executeNullishAssignment(node)
		if (isConditionalExpression(node))
			return this.executeConditionalExpression(node)
		throw new Error(`Unknown node type`)
	}

	/**
	 * Execute a program (multiple statements)
	 */
	private executeProgram(node: Program): number {
		let result: number = 0
		for (const statement of node.statements) {
			result = this.execute(statement)
		}
		return result
	}

	/**
	 * Execute a number literal
	 */
	private executeNumberLiteral(node: NumberLiteral): number {
		return node.value
	}

	/**
	 * Execute an identifier (variable reference)
	 */
	private executeIdentifier(node: Identifier): number {
		const value = this.variables.get(node.name)
		if (value === undefined) {
			throw new Error(`Undefined variable: ${node.name}`)
		}
		return value
	}

	/**
	 * Execute a binary operation
	 */
	private executeBinaryOp(node: BinaryOp): number {
		const left = this.execute(node.left)
		const right = this.execute(node.right)
		return evaluateBinaryOperation(node.operator, left, right)
	}

	/**
	 * Execute a unary operation
	 */
	private executeUnaryOp(node: UnaryOp): number {
		const arg = this.execute(node.argument)

		if (node.operator === '-') {
			return -arg
		}

		throw new Error(`Unknown unary operator: ${node.operator}`)
	}

	/**
	 * Execute a function call
	 */
	private executeFunctionCall(node: FunctionCall): number {
		const fn = this.context.functions?.[node.name]
		if (fn === undefined) {
			throw new Error(`Undefined function: ${node.name}`)
		}
		if (typeof fn !== 'function') {
			throw new Error(`${node.name} is not a function`)
		}

		const args = node.arguments.map((arg) => this.execute(arg))
		return fn(...args)
	}

	/**
	 * Execute a variable assignment
	 */
	private executeAssignment(node: Assignment): number {
		const value = this.execute(node.value)
		this.variables.set(node.name, value)
		return value
	}

	/**
	 * Execute a nullish assignment (??=)
	 * Only assigns if the variable is undefined (not in variables map)
	 * Returns the existing value if defined, otherwise evaluates and assigns the value
	 */
	private executeNullishAssignment(node: NullishAssignment): number {
		// Check if variable already exists
		if (this.variables.has(node.name)) {
			// Variable exists, return its current value without executing the right side
			return this.variables.get(node.name) as number
		}

		// Variable doesn't exist, evaluate and assign the default value
		const value = this.execute(node.value)
		this.variables.set(node.name, value)
		return value
	}

	/**
	 * Execute a conditional expression (ternary operator)
	 * Returns consequent if condition !== 0, otherwise returns alternate
	 */
	private executeConditionalExpression(node: ConditionalExpression): number {
		const condition = this.execute(node.condition)
		return condition !== 0
			? this.execute(node.consequent)
			: this.execute(node.alternate)
	}
}

/**
 * Execute source code with given context
 */
export function execute(
	source: string,
	context?: ExecutionContext,
): RuntimeValue {
	const ast = parseSource(source)
	const executor = new Executor(context)
	return executor.execute(ast)
}
