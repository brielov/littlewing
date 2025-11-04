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
	StringLiteral,
	UnaryOp,
} from './types'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	isUnaryOp,
} from './types'

/**
 * Executor - evaluates an AST with given context
 */
export class Executor {
	private context: ExecutionContext
	private variables: Map<string, RuntimeValue>

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
		if (isStringLiteral(node)) return this.executeStringLiteral(node)
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
	private executeProgram(node: Program): RuntimeValue {
		let result: RuntimeValue
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
	 * Execute a string literal
	 */
	private executeStringLiteral(node: StringLiteral): string {
		return node.value
	}

	/**
	 * Execute an identifier (variable reference)
	 */
	private executeIdentifier(node: Identifier): RuntimeValue {
		const value = this.variables.get(node.name)
		if (value === undefined) {
			throw new Error(`Undefined variable: ${node.name}`)
		}
		return value
	}

	/**
	 * Execute a binary operation
	 */
	private executeBinaryOp(node: BinaryOp): RuntimeValue {
		const left = this.execute(node.left)
		const right = this.execute(node.right)

		switch (node.operator) {
			case '+':
				return this.add(left, right)
			case '-':
				return this.subtract(left, right)
			case '*':
				return this.multiply(left, right)
			case '/':
				return this.divide(left, right)
			case '%':
				return this.modulo(left, right)
			case '^':
				return this.exponentiate(left, right)
			default:
				throw new Error(`Unknown operator: ${node.operator}`)
		}
	}

	/**
	 * Execute a unary operation
	 */
	private executeUnaryOp(node: UnaryOp): RuntimeValue {
		const arg = this.execute(node.argument)

		if (node.operator === '-') {
			if (typeof arg === 'number') {
				return -arg
			}
			if (arg instanceof Date) {
				return new Date(-arg.getTime())
			}
			throw new Error(`Cannot negate ${typeof arg}`)
		}

		throw new Error(`Unknown unary operator: ${node.operator}`)
	}

	/**
	 * Execute a function call
	 */
	private executeFunctionCall(node: FunctionCall): unknown {
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
	private executeAssignment(node: Assignment): RuntimeValue {
		const value = this.execute(node.value)
		// Only allow number and Date values in variables
		if (typeof value !== 'number' && !(value instanceof Date)) {
			throw new Error(
				`Cannot assign ${typeof value} to variable. Only numbers and Dates are allowed.`,
			)
		}
		this.variables.set(node.name, value)
		return value
	}

	/**
	 * Add two values (handles Date + number, number + Date, Date + Date, number + number)
	 */
	private add(left: unknown, right: unknown): RuntimeValue {
		// number + number
		if (typeof left === 'number' && typeof right === 'number') {
			return left + right
		}

		// Date + number
		if (left instanceof Date && typeof right === 'number') {
			return new Date(left.getTime() + right)
		}

		// number + Date
		if (typeof left === 'number' && right instanceof Date) {
			return new Date(right.getTime() + left)
		}

		// Date + Date (add time offsets)
		if (left instanceof Date && right instanceof Date) {
			return new Date(left.getTime() + right.getTime())
		}

		throw new Error(`Cannot add ${this.typeOf(left)} and ${this.typeOf(right)}`)
	}

	/**
	 * Subtract two values (handles Date - number, number - Date, Date - Date, number - number)
	 */
	private subtract(left: unknown, right: unknown): RuntimeValue {
		// number - number
		if (typeof left === 'number' && typeof right === 'number') {
			return left - right
		}

		// Date - number
		if (left instanceof Date && typeof right === 'number') {
			return new Date(left.getTime() - right)
		}

		// number - Date
		if (typeof left === 'number' && right instanceof Date) {
			return new Date(left - right.getTime())
		}

		// Date - Date (calculate time difference in milliseconds)
		if (left instanceof Date && right instanceof Date) {
			return left.getTime() - right.getTime()
		}

		throw new Error(
			`Cannot subtract ${this.typeOf(right)} from ${this.typeOf(left)}`,
		)
	}

	/**
	 * Multiply two values (number * number only)
	 */
	private multiply(left: unknown, right: unknown): RuntimeValue {
		if (typeof left === 'number' && typeof right === 'number') {
			return left * right
		}

		throw new Error(
			`Cannot multiply ${this.typeOf(left)} and ${this.typeOf(right)}`,
		)
	}

	/**
	 * Divide two values (number / number only)
	 */
	private divide(left: unknown, right: unknown): RuntimeValue {
		if (typeof left === 'number' && typeof right === 'number') {
			if (right === 0) {
				throw new Error('Division by zero')
			}
			return left / right
		}

		throw new Error(
			`Cannot divide ${this.typeOf(left)} by ${this.typeOf(right)}`,
		)
	}

	/**
	 * Modulo operation (number % number only)
	 */
	private modulo(left: unknown, right: unknown): RuntimeValue {
		if (typeof left === 'number' && typeof right === 'number') {
			if (right === 0) {
				throw new Error('Division by zero')
			}
			return left % right
		}

		throw new Error(
			`Cannot compute ${this.typeOf(left)} modulo ${this.typeOf(right)}`,
		)
	}

	/**
	 * Exponentiation operation (number ^ number only)
	 */
	private exponentiate(left: unknown, right: unknown): RuntimeValue {
		if (typeof left === 'number' && typeof right === 'number') {
			return left ** right
		}

		throw new Error(
			`Cannot exponentiate ${this.typeOf(left)} by ${this.typeOf(right)}`,
		)
	}

	/**
	 * Get type name for error messages
	 */
	private typeOf(value: unknown): string {
		if (value instanceof Date) {
			return 'Date'
		}
		return typeof value
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
