import type { RuntimeValue } from "../types";
import { assertArray, assertNumber, deepEquals, typeOf } from "../utils";

/**
 * Get the length of an array
 */
export const ARR_LEN = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_LEN");
	return a.length;
};

/**
 * Get the element at a given index (0-based)
 * Throws on out-of-bounds index
 */
export const ARR_INDEX = (a: RuntimeValue, i: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_INDEX");
	assertNumber(i, "ARR_INDEX", "index");
	const idx = Math.trunc(i);
	if (idx < 0 || idx >= a.length) {
		throw new RangeError(`ARR_INDEX: index ${idx} out of bounds for array of length ${a.length}`);
	}
	return a[idx] as RuntimeValue;
};

/**
 * Append a value to an array, returning a new array
 * Validates homogeneity
 */
export const ARR_PUSH = (a: RuntimeValue, value: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_PUSH");
	if (a.length > 0) {
		const elemType = typeOf(a[0] as RuntimeValue);
		const valType = typeOf(value);
		if (elemType !== valType) {
			throw new TypeError(`ARR_PUSH: cannot push ${valType} into array<${elemType}>`);
		}
	}
	return [...a, value];
};

/**
 * Extract a section of an array (0-based indices)
 */
export const ARR_SLICE = (
	a: RuntimeValue,
	start: RuntimeValue,
	end?: RuntimeValue,
): RuntimeValue => {
	assertArray(a, "ARR_SLICE");
	assertNumber(start, "ARR_SLICE", "start");
	if (end !== undefined) {
		assertNumber(end, "ARR_SLICE", "end");
		return a.slice(start, end);
	}
	return a.slice(start);
};

/**
 * Check if an array contains a value (using deep equality)
 * Returns boolean
 */
export const ARR_CONTAINS = (a: RuntimeValue, value: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_CONTAINS");
	for (const elem of a) {
		if (deepEquals(elem, value)) return true;
	}
	return false;
};

/**
 * Reverse an array, returning a new array
 */
export const ARR_REVERSE = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_REVERSE");
	return [...a].reverse();
};

/**
 * Get the first element of an array
 * Throws if array is empty
 */
export const ARR_FIRST = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_FIRST");
	if (a.length === 0) {
		throw new RangeError("ARR_FIRST: array is empty");
	}
	return a[0] as RuntimeValue;
};

/**
 * Get the last element of an array
 * Throws if array is empty
 */
export const ARR_LAST = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_LAST");
	if (a.length === 0) {
		throw new RangeError("ARR_LAST: array is empty");
	}
	return a[a.length - 1] as RuntimeValue;
};
