import type { RuntimeValue } from '../types.js';
import { chargeValue } from '../limits.js';
import {
	assertInteger,
	assertString,
	codePointLength,
	deepEquals,
	toIndexable,
	typeOf,
} from '../utils.js';
import { findSubstring } from './search.js';

/**
 * Fail if an argument was left out, which a function's types cannot catch when a
 * program calls it.
 */
function assertProvided(v: RuntimeValue | undefined, context: string): asserts v is RuntimeValue {
	if (v === undefined) {
		throw new TypeError(`${context} requires an argument`);
	}
}

/**
 * Convert a value to string representation
 * Supports strings, numbers, booleans, dates, times and datetimes. Arrays throw
 * TypeError.
 */
export const STR = (v: RuntimeValue): RuntimeValue => {
	assertProvided(v, 'STR');
	if (Array.isArray(v)) {
		throw new TypeError(`STR: cannot convert ${typeOf(v)} to string`);
	}
	chargeValue(v);
	return typeof v === 'string' ? v : String(v);
};

// Each part has one way to match, as a regular expression must on untrusted input
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Convert a value to number
 * Supports decimal strings, surrounding whitespace aside, and booleans (true→1,
 * false→0). Dates and arrays throw TypeError.
 */
export const NUM = (v: RuntimeValue): RuntimeValue => {
	if (typeof v === 'number') return v;
	if (typeof v === 'string') {
		chargeValue(v);
		const n = Number(v);
		if (!NUMERIC.test(v.trim()) || !Number.isFinite(n)) {
			throw new TypeError(`NUM: cannot convert string "${v}" to number`);
		}
		return n;
	}
	if (typeof v === 'boolean') return v ? 1 : 0;
	throw new TypeError(`NUM: cannot convert ${typeOf(v)} to number`);
};

/**
 * Returns the type name of a value as a string
 */
export const TYPE = (v: RuntimeValue): RuntimeValue => {
	assertProvided(v, 'TYPE');
	return typeOf(v);
};

// ============================================================================
// POLYMORPHIC COLLECTION FUNCTIONS (string + array)
// ============================================================================

function assertStringOrArray(
	v: RuntimeValue,
	context: string,
): asserts v is string | readonly RuntimeValue[] {
	if (typeof v !== 'string' && !Array.isArray(v)) {
		throw new TypeError(`${context} expected string or array, got ${typeOf(v)}`);
	}
}

/**
 * Get the length of a string or array
 */
export const LEN = (v: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, 'LEN');
	return typeof v === 'string' ? codePointLength(v) : v.length;
};

/**
 * Extract a section of a string or array (0-based indices)
 */
export const SLICE = (v: RuntimeValue, start: RuntimeValue, end?: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, 'SLICE');
	assertInteger(start, 'SLICE', 'start');
	if (end !== undefined) assertInteger(end, 'SLICE', 'end');
	if (typeof v !== 'string') return v.slice(start, end as number | undefined);

	const items = toIndexable(v);
	const sliced = items.slice(start, end as number | undefined);
	return typeof sliced === 'string' ? sliced : sliced.join('');
};

/**
 * Check if a string contains a substring or an array contains an element.
 * For strings: both arguments must be strings (substring search).
 * For arrays: uses deep equality to find the element.
 */
export const CONTAINS = (v: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, 'CONTAINS');
	assertProvided(search, 'CONTAINS');
	chargeValue(v);
	if (typeof v === 'string') {
		assertString(search, 'CONTAINS (search)');
		return findSubstring(v, search) !== -1;
	}
	for (const elem of v) {
		if (deepEquals(elem, search)) return true;
	}
	return false;
};

/**
 * Reverse a string or array, returning a new value
 */
export const REVERSE = (v: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, 'REVERSE');
	chargeValue(v);
	if (typeof v === 'string') {
		return Array.from(v).reverse().join('');
	}
	return v.slice().reverse();
};

/**
 * Find the first index of a substring in a string or an element in an array.
 * Returns -1 if not found.
 * For strings: both arguments must be strings.
 * For arrays: uses deep equality.
 */
export const INDEX_OF = (v: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, 'INDEX_OF');
	assertProvided(search, 'INDEX_OF');
	chargeValue(v);
	if (typeof v === 'string') {
		assertString(search, 'INDEX_OF (search)');
		const offset = findSubstring(v, search);
		return offset === -1 ? -1 : codePointLength(v.slice(0, offset));
	}
	for (let i = 0; i < v.length; i++) {
		if (deepEquals(v[i] as RuntimeValue, search)) return i;
	}
	return -1;
};
