import type { RuntimeValue } from "../types";
import { assertArray, assertString, deepEquals, typeOf } from "../utils";

/**
 * Sort an array in ascending order, returning a new array.
 * Numbers sort numerically, strings lexicographically,
 * dates/times/datetimes by temporal comparison.
 * All elements must be the same type.
 */
export const ARR_SORT = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_SORT");
	if (a.length <= 1) return a;

	const sorted = [...a];
	const elemType = typeOf(sorted[0] as RuntimeValue);

	sorted.sort((x, y) => {
		if (typeof x === "number" && typeof y === "number") return x - y;
		if (typeof x === "string" && typeof y === "string") return x < y ? -1 : x > y ? 1 : 0;
		if (x instanceof Temporal.PlainDate && y instanceof Temporal.PlainDate) {
			return Temporal.PlainDate.compare(x, y);
		}
		if (x instanceof Temporal.PlainTime && y instanceof Temporal.PlainTime) {
			return Temporal.PlainTime.compare(x, y);
		}
		if (x instanceof Temporal.PlainDateTime && y instanceof Temporal.PlainDateTime) {
			return Temporal.PlainDateTime.compare(x, y);
		}
		throw new TypeError(`ARR_SORT: cannot sort array<${elemType}>`);
	});

	return sorted;
};

/**
 * Remove duplicate elements using deep equality, preserving first occurrence order.
 */
export const ARR_UNIQUE = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_UNIQUE");
	const result: RuntimeValue[] = [];
	for (const elem of a) {
		let found = false;
		for (const existing of result) {
			if (deepEquals(elem, existing)) {
				found = true;
				break;
			}
		}
		if (!found) result.push(elem);
	}
	return result;
};

/**
 * Flatten one level of nested arrays.
 * Each element must be an array. Result is validated for homogeneity.
 */
export const ARR_FLAT = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_FLAT");
	const result: RuntimeValue[] = [];
	for (const elem of a) {
		if (!Array.isArray(elem)) {
			throw new TypeError(`ARR_FLAT: expected array element, got ${typeOf(elem)}`);
		}
		for (const inner of elem) {
			result.push(inner);
		}
	}
	// Validate homogeneity of the flattened result
	if (result.length > 1) {
		const firstType = typeOf(result[0] as RuntimeValue);
		for (let i = 1; i < result.length; i++) {
			const elemType = typeOf(result[i] as RuntimeValue);
			if (elemType !== firstType) {
				throw new TypeError(
					`ARR_FLAT: heterogeneous result: expected ${firstType}, got ${elemType} at index ${i}`,
				);
			}
		}
	}
	return result;
};

/**
 * Join a string array with a separator into a single string.
 * All elements must be strings.
 */
export const ARR_JOIN = (a: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_JOIN");
	assertString(sep, "ARR_JOIN (separator)");
	for (let i = 0; i < a.length; i++) {
		const elem = a[i];
		if (typeof elem !== "string") {
			throw new TypeError(
				`ARR_JOIN: expected string element, got ${typeOf(elem as RuntimeValue)} at index ${i}`,
			);
		}
	}
	return (a as readonly string[]).join(sep);
};

/**
 * Sum all elements of a numeric array. Empty array returns 0.
 */
export const ARR_SUM = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_SUM");
	let sum = 0;
	for (const elem of a) {
		if (typeof elem !== "number") {
			throw new TypeError(`ARR_SUM: expected number element, got ${typeOf(elem)}`);
		}
		sum += elem;
	}
	return sum;
};

/**
 * Get the minimum element of an array.
 * Supports numbers, strings, dates, times, and datetimes.
 * Throws on empty arrays.
 */
export const ARR_MIN = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_MIN");
	if (a.length === 0) {
		throw new RangeError("ARR_MIN: array is empty");
	}
	return findExtreme(a, "ARR_MIN", -1);
};

/**
 * Get the maximum element of an array.
 * Supports numbers, strings, dates, times, and datetimes.
 * Throws on empty arrays.
 */
export const ARR_MAX = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, "ARR_MAX");
	if (a.length === 0) {
		throw new RangeError("ARR_MAX: array is empty");
	}
	return findExtreme(a, "ARR_MAX", 1);
};

/**
 * Find the extreme (min or max) element of a homogeneous array.
 * direction: 1 for max (keep larger), -1 for min (keep smaller)
 */
function findExtreme(a: readonly RuntimeValue[], context: string, direction: 1 | -1): RuntimeValue {
	let best = a[0] as RuntimeValue;

	for (let i = 1; i < a.length; i++) {
		const elem = a[i] as RuntimeValue;
		const cmp = compareValues(elem, best, context);
		if (cmp * direction > 0) {
			best = elem;
		}
	}

	return best;
}

/**
 * Compare two same-type values. Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareValues(a: RuntimeValue, b: RuntimeValue, context: string): number {
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
	if (a instanceof Temporal.PlainDate && b instanceof Temporal.PlainDate) {
		return Temporal.PlainDate.compare(a, b);
	}
	if (a instanceof Temporal.PlainTime && b instanceof Temporal.PlainTime) {
		return Temporal.PlainTime.compare(a, b);
	}
	if (a instanceof Temporal.PlainDateTime && b instanceof Temporal.PlainDateTime) {
		return Temporal.PlainDateTime.compare(a, b);
	}
	throw new TypeError(`${context}: cannot compare ${typeOf(a)} and ${typeOf(b)}`);
}
