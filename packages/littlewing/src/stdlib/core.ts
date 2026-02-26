import type { RuntimeValue } from "../types";
import { assertNumber, assertString, deepEquals, typeOf } from "../utils";

/**
 * Convert a value to string representation
 * Supports numbers, booleans, and dates. Arrays throw TypeError.
 */
export const STR = (v: RuntimeValue): RuntimeValue => {
	if (typeof v === "string") return v;
	if (typeof v === "number") return String(v);
	if (typeof v === "boolean") return v ? "true" : "false";
	if (typeof v === "object" && v !== null && "toString" in v && !Array.isArray(v)) {
		return v.toString();
	}
	throw new TypeError(`STR: cannot convert ${typeOf(v)} to string`);
};

/**
 * Convert a value to number
 * Supports strings (via Number()) and booleans (true→1, false→0).
 * Dates and arrays throw TypeError.
 */
export const NUM = (v: RuntimeValue): RuntimeValue => {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number(v);
		if (Number.isNaN(n)) {
			throw new TypeError(`NUM: cannot convert string "${v}" to number`);
		}
		return n;
	}
	if (typeof v === "boolean") return v ? 1 : 0;
	throw new TypeError(`NUM: cannot convert ${typeOf(v)} to number`);
};

/**
 * Returns the type name of a value as a string
 */
export const TYPE = (v: RuntimeValue): RuntimeValue => {
	return typeOf(v);
};

// ============================================================================
// POLYMORPHIC COLLECTION FUNCTIONS (string + array)
// ============================================================================

function assertStringOrArray(
	v: RuntimeValue,
	context: string,
): asserts v is string | readonly RuntimeValue[] {
	if (typeof v !== "string" && !Array.isArray(v)) {
		throw new TypeError(`${context} expected string or array, got ${typeOf(v)}`);
	}
}

/**
 * Get the length of a string or array
 */
export const LEN = (v: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, "LEN");
	return v.length;
};

/**
 * Extract a section of a string or array (0-based indices)
 */
export const SLICE = (v: RuntimeValue, start: RuntimeValue, end?: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, "SLICE");
	assertNumber(start, "SLICE", "start");
	if (end !== undefined) {
		assertNumber(end, "SLICE", "end");
		return v.slice(start, end);
	}
	return v.slice(start);
};

/**
 * Check if a string contains a substring or an array contains an element.
 * For strings: both arguments must be strings (substring search).
 * For arrays: uses deep equality to find the element.
 */
export const CONTAINS = (v: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, "CONTAINS");
	if (typeof v === "string") {
		assertString(search, "CONTAINS (search)");
		return v.includes(search);
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
	assertStringOrArray(v, "REVERSE");
	if (typeof v === "string") {
		return Array.from(v).reverse().join("");
	}
	return [...v].reverse();
};

/**
 * Find the first index of a substring in a string or an element in an array.
 * Returns -1 if not found.
 * For strings: both arguments must be strings.
 * For arrays: uses deep equality.
 */
export const INDEX_OF = (v: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertStringOrArray(v, "INDEX_OF");
	if (typeof v === "string") {
		assertString(search, "INDEX_OF (search)");
		return v.indexOf(search);
	}
	for (let i = 0; i < v.length; i++) {
		if (deepEquals(v[i] as RuntimeValue, search)) return i;
	}
	return -1;
};
