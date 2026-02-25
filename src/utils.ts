import type { ASTNode, Operator } from './ast'
import { TokenKind } from './lexer'
import type { RuntimeValue } from './types'
import { visit } from './visitor'

/**
 * Return the type name of a runtime value
 * Note: PlainDateTime check must precede PlainDate because PlainDateTime is not an
 * instance of PlainDate in the Temporal API, but ordering is kept explicit for clarity.
 */
export function typeOf(value: RuntimeValue): string {
	if (typeof value === 'number') return 'number'
	if (typeof value === 'string') return 'string'
	if (typeof value === 'boolean') return 'boolean'
	if (value instanceof Temporal.PlainDateTime) return 'datetime'
	if (value instanceof Temporal.PlainDate) return 'date'
	if (value instanceof Temporal.PlainTime) return 'time'
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
	if (a instanceof Temporal.PlainTime && b instanceof Temporal.PlainTime) {
		return a.equals(b)
	}
	if (
		a instanceof Temporal.PlainDateTime &&
		b instanceof Temporal.PlainDateTime
	) {
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
 * Assert a value is a Temporal.PlainTime, throwing a TypeError if not
 */
export function assertTime(
	v: RuntimeValue,
	context: string,
): asserts v is Temporal.PlainTime {
	if (!(v instanceof Temporal.PlainTime)) {
		throw new TypeError(`${context} expected time, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is a Temporal.PlainDateTime, throwing a TypeError if not
 */
export function assertDateTime(
	v: RuntimeValue,
	context: string,
): asserts v is Temporal.PlainDateTime {
	if (!(v instanceof Temporal.PlainDateTime)) {
		throw new TypeError(`${context} expected datetime, got ${typeOf(v)}`)
	}
}

/**
 * Assert a value is a Temporal.PlainDate or Temporal.PlainDateTime
 */
export function assertDateOrDateTime(
	v: RuntimeValue,
	context: string,
): asserts v is Temporal.PlainDate | Temporal.PlainDateTime {
	if (
		!(v instanceof Temporal.PlainDate) &&
		!(v instanceof Temporal.PlainDateTime)
	) {
		throw new TypeError(
			`${context} expected date or datetime, got ${typeOf(v)}`,
		)
	}
}

/**
 * Assert a value is a Temporal.PlainTime or Temporal.PlainDateTime
 */
export function assertTimeOrDateTime(
	v: RuntimeValue,
	context: string,
): asserts v is Temporal.PlainTime | Temporal.PlainDateTime {
	if (
		!(v instanceof Temporal.PlainTime) &&
		!(v instanceof Temporal.PlainDateTime)
	) {
		throw new TypeError(
			`${context} expected time or datetime, got ${typeOf(v)}`,
		)
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
 * Validate that an array is homogeneous
 */
export function validateHomogeneousArray(
	elements: readonly RuntimeValue[],
): void {
	if (elements.length <= 1) return
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
	if (
		left instanceof Temporal.PlainTime &&
		right instanceof Temporal.PlainTime
	) {
		const cmp = Temporal.PlainTime.compare(left, right)
		return numericComparison(operator, cmp, 0)
	}
	if (
		left instanceof Temporal.PlainDateTime &&
		right instanceof Temporal.PlainDateTime
	) {
		const cmp = Temporal.PlainDateTime.compare(left, right)
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
 * Resolve an index into an array or string, with negative indexing and bounds checking.
 * Returns the element at the resolved index.
 */
export function resolveIndex(
	target: readonly RuntimeValue[] | string,
	index: RuntimeValue,
): RuntimeValue {
	if (typeof index !== 'number') {
		throw new TypeError(`Index expected number, got ${typeOf(index)}`)
	}
	if (!Number.isInteger(index)) {
		throw new TypeError(`Index must be an integer, got ${index}`)
	}

	const len = typeof target === 'string' ? target.length : target.length
	const resolved = index < 0 ? len + index : index

	if (resolved < 0 || resolved >= len) {
		throw new RangeError(`Index ${index} out of bounds for length ${len}`)
	}

	if (typeof target === 'string') {
		return target[resolved] as string
	}

	return target[resolved] as RuntimeValue
}

/**
 * Build a range array from start to end (exclusive or inclusive).
 * Both bounds must be non-negative integers and start <= end.
 */
export function buildRange(
	start: number,
	end: number,
	inclusive: boolean,
): readonly number[] {
	if (!Number.isInteger(start)) {
		throw new TypeError(`Range start must be an integer, got ${start}`)
	}
	if (!Number.isInteger(end)) {
		throw new TypeError(`Range end must be an integer, got ${end}`)
	}
	if (start > end) {
		throw new RangeError(`Range start (${start}) must not exceed end (${end})`)
	}

	const limit = inclusive ? end + 1 : end
	const result: number[] = []
	for (let i = start; i < limit; i++) {
		result.push(i)
	}
	return result
}

/**
 * Get operator precedence (higher number = higher precedence)
 *
 * Precedence hierarchy:
 * - 0: None
 * - 1: Assignment (=)
 * - 3: Logical OR (||)
 * - 4: Logical AND (&&)
 * - 5: Comparison (==, !=, <, >, <=, >=)
 * - 6: Range (.., ..=)
 * - 7: Addition/Subtraction (+, -)
 * - 8: Multiplication/Division/Modulo (*, /, %)
 * - 9: Exponentiation (^)
 */
export function getOperatorPrecedence(operator: Operator): number {
	switch (operator) {
		case '^':
			return 9
		case '*':
		case '/':
		case '%':
			return 8
		case '+':
		case '-':
			return 7
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
			for (const stmt of n.statements) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		StringLiteral: () => {},
		BooleanLiteral: () => {},
		ArrayLiteral: (n, recurse) => {
			for (const elem of n.elements) {
				recurse(elem)
			}
		},
		Identifier: (n) => {
			identifiers.add(n.name)
		},
		BinaryOp: (n, recurse) => {
			recurse(n.left)
			recurse(n.right)
		},
		UnaryOp: (n, recurse) => {
			recurse(n.argument)
		},
		FunctionCall: (n, recurse) => {
			for (const arg of n.args) {
				recurse(arg)
			}
		},
		Assignment: (n, recurse) => {
			recurse(n.value)
		},
		IfExpression: (n, recurse) => {
			recurse(n.condition)
			recurse(n.consequent)
			recurse(n.alternate)
		},
		ForExpression: (n, recurse) => {
			// Do NOT collect the loop variable — it's a binding, not a reference
			recurse(n.iterable)
			if (n.guard) recurse(n.guard)
			recurse(n.body)
		},
		IndexAccess: (n, recurse) => {
			recurse(n.object)
			recurse(n.index)
		},
		RangeExpression: (n, recurse) => {
			recurse(n.start)
			recurse(n.end)
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
		case TokenKind.DotDot:
		case TokenKind.DotDotEq:
			return 6
		case TokenKind.Plus:
		case TokenKind.Minus:
			return 7
		case TokenKind.Star:
		case TokenKind.Slash:
		case TokenKind.Percent:
			return 8
		case TokenKind.Caret:
			return 9
		default:
			return 0
	}
}
