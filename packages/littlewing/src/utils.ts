import type { ASTNode, Operator } from './ast.js';
import { forEachChild, NodeKind } from './ast.js';
import { charge, chargeRead, chargeValue, DURATION_STEPS } from './limits.js';
import { TokenKind } from './lexer.js';
import type { PlainDate, PlainDateTime, PlainTime, RuntimeValue } from './types.js';

/**
 * Return the type name of a runtime value
 */
export function typeOf(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (value === null) return 'null';
	if (typeof value !== 'object') return typeof value;
	if (Array.isArray(value)) return 'array';
	if (typeof Temporal === 'undefined') return 'object';
	if (value instanceof Temporal.PlainDateTime) return 'datetime';
	if (value instanceof Temporal.PlainDate) return 'date';
	if (value instanceof Temporal.PlainTime) return 'time';
	return 'object';
}

/**
 * Deep structural equality for RuntimeValue
 * Cross-type comparisons return false, and so does NaN against anything.
 * Arrays compare element-wise recursively.
 * Dates use .equals().
 */
export function deepEquals(a: RuntimeValue, b: RuntimeValue): boolean {
	if (typeof a === 'string' && typeof b === 'string') {
		// Strings of different lengths are unequal without reading them
		if (a.length === b.length) chargeRead(a.length + b.length);
		return a === b;
	}
	if (typeof a !== 'object' || typeof b !== 'object') return a === b;

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		// Arrays may share elements, so their size can dwarf the work to build them
		charge(a.length + 1);
		for (let i = 0; i < a.length; i++) {
			if (!deepEquals(a[i] as RuntimeValue, b[i] as RuntimeValue)) return false;
		}
		return true;
	}
	if (Array.isArray(b)) return false;

	chargeValue(a);
	if (a instanceof Temporal.PlainDate) {
		return b instanceof Temporal.PlainDate && a.equals(b);
	}
	if (a instanceof Temporal.PlainTime) {
		return b instanceof Temporal.PlainTime && a.equals(b);
	}
	return a instanceof Temporal.PlainDateTime && b instanceof Temporal.PlainDateTime && a.equals(b);
}

/**
 * Assert a value is a number, throwing a TypeError if not
 */
export function assertNumber(v: RuntimeValue, context: string, side?: string): asserts v is number {
	if (typeof v !== 'number') {
		const where = side ? ` (${side})` : '';
		throw new TypeError(`${context}${where} expected number, got ${typeOf(v)}`);
	}
}

/**
 * Assert a value is an integer number, throwing a TypeError if not.
 */
export function assertInteger(
	v: RuntimeValue,
	context: string,
	side?: string,
): asserts v is number {
	assertNumber(v, context, side);
	if (!Number.isInteger(v)) {
		const where = side ? ` (${side})` : '';
		throw new TypeError(`${context}${where} expected integer, got ${v}`);
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
		const where = side ? ` (${side})` : '';
		throw new TypeError(`${context}${where} expected boolean, got ${typeOf(v)}`);
	}
}

/**
 * Assert a value is a string, throwing a TypeError if not.
 * Like the other assertions on strings, arrays, dates and times, this charges the
 * running evaluation for the function reading the value.
 */
export function assertString(v: RuntimeValue, context: string): asserts v is string {
	if (typeof v !== 'string') {
		throw new TypeError(`${context} expected string, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is a Temporal.PlainDate, throwing a TypeError if not
 */
export function assertDate(v: RuntimeValue, context: string): asserts v is PlainDate {
	if (!(v instanceof Temporal.PlainDate)) {
		throw new TypeError(`${context} expected date, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is a Temporal.PlainTime, throwing a TypeError if not
 */
export function assertTime(v: RuntimeValue, context: string): asserts v is PlainTime {
	if (!(v instanceof Temporal.PlainTime)) {
		throw new TypeError(`${context} expected time, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is a Temporal.PlainDateTime, throwing a TypeError if not
 */
export function assertDateTime(v: RuntimeValue, context: string): asserts v is PlainDateTime {
	if (!(v instanceof Temporal.PlainDateTime)) {
		throw new TypeError(`${context} expected datetime, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is a Temporal.PlainDate or Temporal.PlainDateTime
 */
export function assertDateOrDateTime(
	v: RuntimeValue,
	context: string,
): asserts v is PlainDate | PlainDateTime {
	if (!(v instanceof Temporal.PlainDate) && !(v instanceof Temporal.PlainDateTime)) {
		throw new TypeError(`${context} expected date or datetime, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is a Temporal.PlainTime or Temporal.PlainDateTime
 */
export function assertTimeOrDateTime(
	v: RuntimeValue,
	context: string,
): asserts v is PlainTime | PlainDateTime {
	if (!(v instanceof Temporal.PlainTime) && !(v instanceof Temporal.PlainDateTime)) {
		throw new TypeError(`${context} expected time or datetime, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Assert a value is an array, throwing a TypeError if not
 */
export function assertArray(
	v: RuntimeValue,
	context: string,
): asserts v is readonly RuntimeValue[] {
	if (!Array.isArray(v)) {
		throw new TypeError(`${context} expected array, got ${typeOf(v)}`);
	}
	chargeValue(v);
}

/**
 * Scalar type at the bottom of a value's nesting, numbered for `Shape`.
 */
const enum Leaf {
	Unknown,
	Number,
	String,
	Boolean,
	Date,
	Time,
	DateTime,
}

const LEAF_NAMES = ['unknown', 'number', 'string', 'boolean', 'date', 'time', 'datetime'];

/**
 * A value's type as one integer: `depth * ARRAY_LEVEL + leaf`. `[[1]]` has depth 2
 * and leaf `Number`. Empty arrays leave the leaf `Unknown`, because they fit any
 * array type: `[[], [1]]` is homogeneous.
 */
type Shape = number;

const ARRAY_LEVEL = 8;

function leafOf(value: unknown): Leaf {
	switch (typeof value) {
		case 'number':
			return Leaf.Number;
		case 'string':
			return Leaf.String;
		case 'boolean':
			return Leaf.Boolean;
	}
	if (typeof Temporal === 'undefined') return Leaf.Unknown;
	if (value instanceof Temporal.PlainDate) return Leaf.Date;
	if (value instanceof Temporal.PlainTime) return Leaf.Time;
	if (value instanceof Temporal.PlainDateTime) return Leaf.DateTime;
	return Leaf.Unknown;
}

function isKnown(shape: Shape): boolean {
	return shape % ARRAY_LEVEL !== Leaf.Unknown;
}

/**
 * Get the shape of a value already known to be homogeneous, for which the first
 * element with a known leaf speaks for the whole array.
 */
function shapeOf(value: RuntimeValue): Shape {
	charge(1);
	if (!Array.isArray(value)) return leafOf(value);

	let deepest: Shape = Leaf.Unknown;
	for (const element of value) {
		const shape = shapeOf(element);
		if (isKnown(shape)) return shape + ARRAY_LEVEL;
		deepest = Math.max(deepest, shape);
	}
	return deepest + ARRAY_LEVEL;
}

/**
 * Check if two shapes can sit in one array. An unknown shape fits any array type
 * at least as deep as itself.
 */
function isCompatible(a: Shape, b: Shape): boolean {
	if (isKnown(a)) return isKnown(b) ? a === b : b <= a;
	return !isKnown(b) || a <= b;
}

/**
 * Get the more informative of two compatible shapes.
 */
function mergeShapes(a: Shape, b: Shape): Shape {
	if (isKnown(a)) return a;
	return isKnown(b) ? b : Math.max(a, b);
}

function describeShape(shape: Shape): string {
	const leaf = shape % ARRAY_LEVEL;
	const depth = (shape - leaf) / ARRAY_LEVEL;
	return 'array<'.repeat(depth) + LEAF_NAMES[leaf] + '>'.repeat(depth);
}

/**
 * Concatenate two arrays, validating homogeneity
 */
function concatenateArrays(
	a: readonly RuntimeValue[],
	b: readonly RuntimeValue[],
): readonly RuntimeValue[] {
	charge(a.length + b.length);
	const shapeA = shapeOf(a);
	const shapeB = shapeOf(b);
	if (!isCompatible(shapeA, shapeB)) {
		throw new TypeError(
			`Cannot concatenate ${describeShape(shapeA)} with ${describeShape(shapeB)}`,
		);
	}
	return a.concat(b);
}

/**
 * Validate that an array of valid values is homogeneous
 */
export function validateHomogeneousArray(elements: readonly RuntimeValue[]): void {
	if (elements.length <= 1) return;
	const first = elements[0] as RuntimeValue;
	const firstType = typeof first;

	// Fast path: scalars of one primitive type
	if (firstType === 'number' || firstType === 'string' || firstType === 'boolean') {
		let i = 1;
		while (i < elements.length && typeof elements[i] === firstType) i++;
		if (i === elements.length) return;
	}

	let expected = shapeOf(first);
	for (let i = 1; i < elements.length; i++) {
		const shape = shapeOf(elements[i] as RuntimeValue);
		if (!isCompatible(expected, shape)) {
			throw new TypeError(
				`Heterogeneous array: expected ${describeShape(expected)}, got ${describeShape(shape)} at index ${i}`,
			);
		}
		expected = mergeShapes(expected, shape);
	}
}

/**
 * Compute the shape of an untrusted value, checking that it is a valid
 * RuntimeValue at every level. Arrays are memoized by identity: one value can
 * alias the same array exponentially often.
 */
function checkedShape(value: unknown, context: string, seen: Map<unknown, Shape>): Shape {
	if (Array.isArray(value)) {
		const known = seen.get(value);
		if (known !== undefined) return known;
		charge(value.length + 1);

		let shape: Shape = Leaf.Unknown;
		for (let i = 0; i < value.length; i++) {
			const element = checkedShape(value[i], context, seen);
			if (i > 0 && !isCompatible(shape, element)) {
				throw new TypeError(
					`${context}: heterogeneous array: expected ${describeShape(shape)}, got ${describeShape(element)} at index ${i}`,
				);
			}
			shape = i === 0 ? element : mergeShapes(shape, element);
		}
		seen.set(value, shape + ARRAY_LEVEL);
		return shape + ARRAY_LEVEL;
	}

	const leaf = leafOf(value);
	if (leaf === Leaf.Unknown) {
		const tag = (value as { [Symbol.toStringTag]?: unknown } | null | undefined)?.[
			Symbol.toStringTag
		];
		if (typeof tag === 'string' && /^Temporal\.Plain(Date|Time|DateTime)$/.test(tag)) {
			throw new TypeError(`${context}: ${tag} is not from the global Temporal`);
		}
		throw new TypeError(`${context}: expected a language value, got ${typeOf(value)}`);
	}
	if (leaf === Leaf.Date || leaf === Leaf.DateTime) {
		const { calendarId } = value as Temporal.PlainDate | Temporal.PlainDateTime;
		// Other calendars make date arithmetic take time proportional to its arguments
		if (calendarId !== 'iso8601') {
			throw new TypeError(`${context}: expected an ISO date, got calendar ${calendarId}`);
		}
	}
	return leaf;
}

/**
 * Assert a value from outside the language is a valid RuntimeValue, including
 * that its arrays are homogeneous, throwing a TypeError if not
 */
export function assertRuntimeValue(value: unknown, context: string): asserts value is RuntimeValue {
	const type = typeof value;
	if (type !== 'number' && type !== 'string' && type !== 'boolean') {
		checkedShape(value, context, new Map());
	}
}

/**
 * Count the elements and characters a reader of `value` will walk. Arrays are
 * memoized by identity: aliasing makes this size exponential in the work it took
 * to build the value, which is why a result has to be measured before it leaves.
 */
export function logicalSize(value: RuntimeValue, seen: Map<RuntimeValue, number>): number {
	if (typeof value === 'string') return value.length;
	if (!Array.isArray(value)) return 1;

	const known = seen.get(value);
	if (known !== undefined) return known;

	let size = 1;
	for (const element of value) {
		size += logicalSize(element, seen);
	}
	seen.set(value, size);
	return size;
}

/**
 * Evaluate a binary operation on two RuntimeValues
 * Shared implementation used by both interpreter and optimizer to ensure consistent semantics
 *
 * Note: && and || are NOT handled here: they short-circuit, so their callers have
 * to decide whether the right side runs at all.
 */
export function evaluateBinaryOperation(
	operator: Exclude<Operator, '&&' | '||'>,
	left: RuntimeValue,
	right: RuntimeValue,
): RuntimeValue {
	switch (operator) {
		case '==':
			return deepEquals(left, right);
		case '!=':
			return !deepEquals(left, right);

		case '+': {
			if (typeof left === 'number' && typeof right === 'number') return left + right;
			if (typeof left === 'string' && typeof right === 'string') {
				// Engines concatenate lazily, so the cost is that of the smaller side
				charge(Math.min(left.length, right.length));
				return left + right;
			}
			if (Array.isArray(left) && Array.isArray(right)) return concatenateArrays(left, right);
			throw new TypeError(`Operator '+' not supported for ${typeOf(left)} and ${typeOf(right)}`);
		}

		case '-':
			assertNumber(left, "Operator '-'", 'left');
			assertNumber(right, "Operator '-'", 'right');
			return left - right;
		case '*':
			assertNumber(left, "Operator '*'", 'left');
			assertNumber(right, "Operator '*'", 'right');
			return left * right;
		case '/':
			assertNumber(left, "Operator '/'", 'left');
			assertNumber(right, "Operator '/'", 'right');
			if (right === 0) throw new Error('Division by zero');
			return left / right;
		case '%':
			assertNumber(left, "Operator '%'", 'left');
			assertNumber(right, "Operator '%'", 'right');
			if (right === 0) throw new Error('Modulo by zero');
			return left % right;
		case '^':
			assertNumber(left, "Operator '^'", 'left');
			assertNumber(right, "Operator '^'", 'right');
			return left ** right;

		case '<':
		case '>':
		case '<=':
		case '>=':
			return compareOrdered(operator, left, right);
	}
}

/**
 * Compare two non-numeric values of one ordered type, returning a negative number,
 * zero or a positive number, or undefined if they have no order.
 */
function compareNonNumbers(left: RuntimeValue, right: RuntimeValue): number | undefined {
	if (typeof left === 'string' && typeof right === 'string') {
		chargeRead(left.length + right.length);
		return left < right ? -1 : left > right ? 1 : 0;
	}
	chargeValue(left);
	if (typeof Temporal === 'undefined') return undefined;
	if (left instanceof Temporal.PlainDate && right instanceof Temporal.PlainDate) {
		return Temporal.PlainDate.compare(left, right);
	}
	if (left instanceof Temporal.PlainTime && right instanceof Temporal.PlainTime) {
		return Temporal.PlainTime.compare(left, right);
	}
	if (left instanceof Temporal.PlainDateTime && right instanceof Temporal.PlainDateTime) {
		return Temporal.PlainDateTime.compare(left, right);
	}
	return undefined;
}

/**
 * Compare two values for sorting, returning a negative number, zero or a positive
 * number, or undefined if they have no order. NaN sorts after every other number,
 * unlike the comparison operators, for which it is unordered.
 */
export function compareValues(left: RuntimeValue, right: RuntimeValue): number | undefined {
	if (typeof left !== 'number' || typeof right !== 'number') {
		return compareNonNumbers(left, right);
	}
	if (left < right) return -1;
	if (left > right) return 1;
	return left === right ? 0 : Number(Number.isNaN(left)) - Number(Number.isNaN(right));
}

/**
 * Compare two ordered values (<, >, <=, >=)
 * Supports numbers, strings, dates, times and datetimes.
 */
function compareOrdered(
	operator: '<' | '>' | '<=' | '>=',
	left: RuntimeValue,
	right: RuntimeValue,
): boolean {
	if (typeof left === 'number' && typeof right === 'number') {
		return numericComparison(operator, left, right);
	}
	const order = compareNonNumbers(left, right);
	if (order === undefined) {
		throw new TypeError(
			`Operator '${operator}' not supported for ${typeOf(left)} and ${typeOf(right)}`,
		);
	}
	return numericComparison(operator, order, 0);
}

function numericComparison(
	operator: '<' | '>' | '<=' | '>=',
	left: number,
	right: number,
): boolean {
	switch (operator) {
		case '<':
			return left < right;
		case '>':
			return left > right;
		case '<=':
			return left <= right;
		case '>=':
			return left >= right;
	}
}

function hasSurrogates(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 0xd800 && code <= 0xdfff) return true;
	}
	return false;
}

/**
 * Split a string for indexing by code point: into an array of code points, or
 * the string itself if each of its code units is one.
 */
export function toIndexable(value: string): readonly string[] | string {
	charge(value.length);
	if (!hasSurrogates(value)) return value;
	// Every code point becomes a string of its own
	charge(value.length);
	return Array.from(value);
}

/**
 * Count the code points of a string.
 */
export function codePointLength(value: string): number {
	charge(value.length);
	let length = value.length;
	for (let i = 1; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 0xdc00 && code <= 0xdfff) {
			const previous = value.charCodeAt(i - 1);
			if (previous >= 0xd800 && previous <= 0xdbff) length--;
		}
	}
	return length;
}

/**
 * Resolve an index into an array or a string's code units, with negative indexing
 * and bounds checking. Returns the element at the resolved index.
 */
export function resolveIndex(
	target: readonly RuntimeValue[] | string,
	index: RuntimeValue,
): RuntimeValue {
	if (typeof index !== 'number') {
		throw new TypeError(`Index expected number, got ${typeOf(index)}`);
	}
	if (!Number.isInteger(index)) {
		throw new TypeError(`Index must be an integer, got ${index}`);
	}

	const length = target.length;
	const resolved = index < 0 ? length + index : index;
	if (resolved < 0 || resolved >= length) {
		throw new RangeError(`Index ${index} out of bounds for length ${length}`);
	}
	return target[resolved] as RuntimeValue;
}

/**
 * Get the absolute difference between two dates, times or datetimes of one type
 * in whole units. Mixed types are a TypeError because `until` needs them to match.
 */
export function temporalDifference(
	a: PlainDate | PlainTime | PlainDateTime,
	b: PlainDate | PlainTime | PlainDateTime,
	unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second',
	context: string,
): number {
	const typeA = typeOf(a);
	const typeB = typeOf(b);
	if (typeA !== typeB) {
		throw new TypeError(`${context} requires same type, got ${typeA} and ${typeB}`);
	}
	charge(DURATION_STEPS);
	// `until` belongs to each type separately, but they are the same type here
	const duration = (a as Temporal.PlainDateTime).until(b as Temporal.PlainDateTime, {
		largestUnit: unit,
	});
	return Math.abs(duration[`${unit}s`]);
}

/**
 * Build a range array from start to end (exclusive or inclusive).
 * Both bounds must be integers and start <= end.
 */
export function buildRange(start: number, end: number, inclusive: boolean): readonly number[] {
	if (!Number.isInteger(start)) {
		throw new TypeError(`Range start must be an integer, got ${start}`);
	}
	if (!Number.isInteger(end)) {
		throw new TypeError(`Range end must be an integer, got ${end}`);
	}
	if (start > end) {
		throw new RangeError(`Range start (${start}) must not exceed end (${end})`);
	}

	const length = end - start + (inclusive ? 1 : 0);
	charge(length);
	// The length is known, and `Array.from` with a callback spends far longer here
	// oxlint-disable-next-line no-new-array
	const values = new Array<number>(length);
	for (let i = 0; i < length; i++) values[i] = start + i;
	return values;
}

/**
 * Binding strength of each grammar level (higher binds tighter).
 *
 * Unary operators parse their operand at `Exponent`, so `^` binds tighter than
 * a leading minus but `*` does not: `-2 ^ 2` is `-(2 ^ 2)` and `-2 * 3` is
 * `(-2) * 3`.
 */
export const enum Precedence {
	None = 0,
	Assignment = 1,
	Pipe = 2,
	Or = 3,
	And = 4,
	Comparison = 5,
	Range = 6,
	Additive = 7,
	Multiplicative = 8,
	Exponent = 9,
	Postfix = 10,
	Atom = 11,
}

/**
 * Get the precedence of a binary operator
 */
export function getOperatorPrecedence(operator: Operator): Precedence {
	switch (operator) {
		case '^':
			return Precedence.Exponent;
		case '*':
		case '/':
		case '%':
			return Precedence.Multiplicative;
		case '+':
		case '-':
			return Precedence.Additive;
		case '==':
		case '!=':
		case '<':
		case '>':
		case '<=':
		case '>=':
			return Precedence.Comparison;
		case '&&':
			return Precedence.And;
		case '||':
			return Precedence.Or;
	}
}

/**
 * Add the free identifiers of a node to `identifiers`: the variables it reads
 * from outside. A `for` loop binds its variable and accumulator for its guard and
 * body, but its iterable and initial value run outside those bindings.
 */
export function collectFreeIdentifiers(
	node: ASTNode,
	identifiers: Set<string>,
	bound: ReadonlySet<string> = new Set(),
): void {
	const visit = (child: ASTNode): void => {
		if (child.kind === NodeKind.Identifier) {
			if (!bound.has(child.name)) identifiers.add(child.name);
		} else if (child.kind === NodeKind.ForExpression) {
			visit(child.iterable);
			if (child.accumulator) visit(child.accumulator.initial);

			const inner = new Set(bound);
			inner.add(child.variable);
			if (child.accumulator) inner.add(child.accumulator.name);
			if (child.guard) collectFreeIdentifiers(child.guard, identifiers, inner);
			collectFreeIdentifiers(child.body, identifiers, inner);
		} else {
			forEachChild(child, visit);
		}
	};
	visit(node);
}

/**
 * Get token precedence for parsing
 */
export function getTokenPrecedence(kind: TokenKind): Precedence {
	switch (kind) {
		case TokenKind.Eq:
			return Precedence.Assignment;
		case TokenKind.Pipe:
			return Precedence.Pipe;
		case TokenKind.Or:
			return Precedence.Or;
		case TokenKind.And:
			return Precedence.And;
		case TokenKind.EqEq:
		case TokenKind.NotEq:
		case TokenKind.Lt:
		case TokenKind.Gt:
		case TokenKind.Le:
		case TokenKind.Ge:
			return Precedence.Comparison;
		case TokenKind.DotDot:
		case TokenKind.DotDotEq:
			return Precedence.Range;
		case TokenKind.Plus:
		case TokenKind.Minus:
			return Precedence.Additive;
		case TokenKind.Star:
		case TokenKind.Slash:
		case TokenKind.Percent:
			return Precedence.Multiplicative;
		case TokenKind.Caret:
			return Precedence.Exponent;
		default:
			return Precedence.None;
	}
}
