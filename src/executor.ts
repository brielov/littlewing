import { parseSource } from './parser'
import type {
	ASTNode,
	Assignment,
	BinaryOp,
	ExecutionContext,
	FunctionCall,
	Identifier,
	NumberLiteral,
	Program,
	RuntimeValue,
	UnaryOp,
} from './types'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'

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

		switch (node.operator) {
			case '+':
				return left + right
			case '-':
				return left - right
			case '*':
				return left * right
			case '/':
				if (right === 0) {
					throw new Error('Division by zero')
				}
				return left / right
			case '%':
				if (right === 0) {
					throw new Error('Modulo by zero')
				}
				return left % right
			case '^':
				return left ** right
			default:
				throw new Error(`Unknown operator: ${node.operator}`)
		}
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
