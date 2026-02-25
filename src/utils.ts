import { Temporal } from 'temporal-polyfill'
import type { ASTNode, Operator } from './ast'
import { TokenKind } from './lexer'
import type { RuntimeValue } from './types'
import { visit } from './visitor'

/**
 * Return the type name of a runtime value
 */
export function typeOf(value: RuntimeValue): string {
	if (typeof value === 'number') return 'number'
	if (typeof value === 'string') return 'string'
	if (typeof value === 'boolean') return 'boolean'
	if (value instanceof Temporal.PlainDate) return 'date'
	if (Array.isArray(value)) return 'array'
	throw new Error(`Unknown runtime value type`)
}

/**
 * Deep structural equality for RuntimeValue
 * Cross-type comparisons return false.
 * Arrays compare element-wise recursively.
 * Dates use .equals().
 */
export function deepEquals(a: RuntimeValue, b: RuntimeValue): boolean {
	if (typeof a === 'number' && typeof b === 'number') return a === b
	if (typeof a === 'string' && typeof b === 'string') return a === b
	if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
	if (a instanceof Temporal.PlainDate && b instanceof Temporal.PlainDate) {
		return a.equals(b)
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			const ai = a[i] as RuntimeValue
			const bi = b[i] as RuntimeValue
			if (!deepEquals(ai, bi)) return false
		}
		return true
	}
	return false
}

/**
 * Assert a value is a number, throwing a TypeError if not
 */
export function assertNumber(
	v: RuntimeValue,
	context: string,
	side?: string,
): asserts v is number {
	if (typeof v !== 'number') {
		const where = side ? ` (${side})` : ''
		throw new TypeError(`${context}${where} expected number, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is a boolean, throwing a TypeError if not
 */
export function assertBoolean(
	v: RuntimeValue,
	context: string,
	side?: string,
): asserts v is boolean {
	if (typeof v !== 'boolean') {
		const where = side ? ` (${side})` : ''
		throw new TypeError(`${context}${where} expected boolean, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is a string, throwing a TypeError if not
 */
export function assertString(
	v: RuntimeValue,
	context: string,
): asserts v is string {
	if (typeof v !== 'string') {
		throw new TypeError(`${context} expected string, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is a Temporal.PlainDate, throwing a TypeError if not
 */
export function assertDate(
	v: RuntimeValue,
	context: string,
): asserts v is Temporal.PlainDate {
	if (!(v instanceof Temporal.PlainDate)) {
		throw new TypeError(`${context} expected date, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is an array, throwing a TypeError if not
 */
export function assertArray(
	v: RuntimeValue,
	context: string,
): asserts v is readonly RuntimeValue[] {
	if (!Array.isArray(v)) {
		throw new TypeError(`${context} expected array, got ${typeOf(v)}`)
	}
}

/**
 * Get the element type of an array (based on the first element).
 * Returns undefined for empty arrays.
 */
function arrayElementType(arr: readonly RuntimeValue[]): string | undefined {
	if (arr.length === 0) return undefined
	return typeOf(arr[0] as RuntimeValue)
}

/**
 * Concatenate two arrays, validating homogeneity
 */
function concatenateArrays(
	a: readonly RuntimeValue[],
	b: readonly RuntimeValue[],
): readonly RuntimeValue[] {
	const typeA = arrayElementType(a)
	const typeB = arrayElementType(b)
	if (typeA !== undefined && typeB !== undefined && typeA !== typeB) {
		throw new TypeError(
			`Cannot concatenate array<${typeA}> with array<${typeB}>`,
		)
	}
	return [...a, ...b]
}

/**
 * Evaluate a binary operation on two RuntimeValues
 * Shared implementation used by both interpreter and optimizer to ensure consistent semantics
 *
 * Note: && and || are NOT handled here — they require short-circuit evaluation
 * and are handled directly in the interpreter's BinaryOp handler.
 */
export function evaluateBinaryOperation(
	operator: Operator,
	left: RuntimeValue,
	right: RuntimeValue,
): RuntimeValue {
	switch (operator) {
		case '==':
			return deepEquals(left, right)
		case '!=':
			return !deepEquals(left, right)

		case '+': {
			if (typeof left === 'number' && typeof right === 'number')
				return left + right
			if (typeof left === 'string' && typeof right === 'string')
				return left + right
			if (Array.isArray(left) && Array.isArray(right))
				return concatenateArrays(left, right)
			throw new TypeError(
				`Operator '+' not supported for ${typeOf(left)} and ${typeOf(right)}`,
			)
		}

		case '-':
			assertNumber(left, "Operator '-'", 'left')
			assertNumber(right, "Operator '-'", 'right')
			return left - right
		case '*':
			assertNumber(left, "Operator '*'", 'left')
			assertNumber(right, "Operator '*'", 'right')
			return left * right
		case '/':
			assertNumber(left, "Operator '/'", 'left')
			assertNumber(right, "Operator '/'", 'right')
			if (right === 0) throw new Error('Division by zero')
			return left / right
		case '%':
			assertNumber(left, "Operator '%'", 'left')
			assertNumber(right, "Operator '%'", 'right')
			if (right === 0) throw new Error('Modulo by zero')
			return left % right
		case '^':
			assertNumber(left, "Operator '^'", 'left')
			assertNumber(right, "Operator '^'", 'right')
			return left ** right

		case '<':
		case '>':
		case '<=':
		case '>=':
			return compareOrdered(operator, left, right)

		case '&&':
		case '||':
			// Short-circuit logic is handled in the interpreter
			// This path is only reached during optimizer constant folding
			assertBoolean(left, `Operator '${operator}'`, 'left')
			assertBoolean(right, `Operator '${operator}'`, 'right')
			if (operator === '&&') return left && right
			return left || right

		default:
			throw new Error(`Unknown operator: ${operator}`)
	}
}

/**
 * Compare two ordered values (<, >, <=, >=)
 * Supports numbers, strings, and dates.
 */
function compareOrdered(
	operator: '<' | '>' | '<=' | '>=',
	left: RuntimeValue,
	right: RuntimeValue,
): boolean {
	if (typeof left === 'number' && typeof right === 'number') {
		return numericComparison(operator, left, right)
	}
	if (typeof left === 'string' && typeof right === 'string') {
		return numericComparison(
			operator,
			left < right ? -1 : left > right ? 1 : 0,
			0,
		)
	}
	if (
		left instanceof Temporal.PlainDate &&
		right instanceof Temporal.PlainDate
	) {
		const cmp = Temporal.PlainDate.compare(left, right)
		return numericComparison(operator, cmp, 0)
	}
	throw new TypeError(
		`Operator '${operator}' not supported for ${typeOf(left)} and ${typeOf(right)}`,
	)
}

function numericComparison(
	operator: '<' | '>' | '<=' | '>=',
	left: number,
	right: number,
): boolean {
	switch (operator) {
		case '<':
			return left < right
		case '>':
			return left > right
		case '<=':
			return left <= right
		case '>=':
			return left >= right
	}
}

/**
 * Get operator precedence (higher number = higher precedence)
 *
 * Precedence hierarchy:
 * - 0: None
 * - 1: Assignment (=)
 * - 2: Ternary conditional (? :)
 * - 3: Logical OR (||)
 * - 4: Logical AND (&&)
 * - 5: Comparison (==, !=, <, >, <=, >=)
 * - 6: Addition/Subtraction (+, -)
 * - 7: Multiplication/Division/Modulo (*, /, %)
 * - 8: Exponentiation (^)
 */
export function getOperatorPrecedence(operator: Operator): number {
	switch (operator) {
		case '^':
			return 8
		case '*':
		case '/':
		case '%':
			return 7
		case '+':
		case '-':
			return 6
		case '==':
		case '!=':
		case '<':
		case '>':
		case '<=':
		case '>=':
			return 5
		case '&&':
			return 4
		case '||':
			return 3
		default:
			return 0
	}
}

/**
 * Collect all identifier names from an AST node.
 */
export function collectAllIdentifiers(node: ASTNode): Set<string> {
	const identifiers = new Set<string>()

	visit<void>(node, {
		Program: (n, recurse) => {
			for (const stmt of n[1]) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		StringLiteral: () => {},
		BooleanLiteral: () => {},
		ArrayLiteral: (n, recurse) => {
			for (const elem of n[1]) {
				recurse(elem)
			}
		},
		Identifier: (n) => {
			identifiers.add(n[1])
		},
		BinaryOp: (n, recurse) => {
			recurse(n[1])
			recurse(n[3])
		},
		UnaryOp: (n, recurse) => {
			recurse(n[2])
		},
		FunctionCall: (n, recurse) => {
			for (const arg of n[2]) {
				recurse(arg)
			}
		},
		Assignment: (n, recurse) => {
			recurse(n[2])
		},
		ConditionalExpression: (n, recurse) => {
			recurse(n[1])
			recurse(n[2])
			recurse(n[3])
		},
	})

	return identifiers
}

/**
 * Get token precedence for parsing
 */
export function getTokenPrecedence(kind: TokenKind): number {
	switch (kind) {
		case TokenKind.Eq:
			return 1
		case TokenKind.Question:
			return 2
		case TokenKind.Or:
			return 3
		case TokenKind.And:
			return 4
		case TokenKind.EqEq:
		case TokenKind.NotEq:
		case TokenKind.Lt:
		case TokenKind.Gt:
		case TokenKind.Le:
		case TokenKind.Ge:
			return 5
		case TokenKind.Plus:
		case TokenKind.Minus:
			return 6
		case TokenKind.Star:
		case TokenKind.Slash:
		case TokenKind.Percent:
			return 7
		case TokenKind.Caret:
			return 8
		default:
			return 0
	}
}
