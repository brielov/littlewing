import { charge, chargeRead, chargeSort, chargeValue } from '../limits.js';
import type { RuntimeValue } from '../types.js';
import {
	assertArray,
	assertString,
	compareValues,
	typeOf,
	validateHomogeneousArray,
} from '../utils.js';

/**
 * Compare two elements, which must have an order.
 */
function compareElements(a: RuntimeValue, b: RuntimeValue, context: string): number {
	const order = compareValues(a, b);
	if (order === undefined) {
		throw new TypeError(`${context}: cannot compare ${typeOf(a)} and ${typeOf(b)}`);
	}
	return order;
}

/**
 * Sort an array in ascending order, returning a new array.
 * Numbers sort numerically with NaN last, strings lexicographically, and
 * dates/times/datetimes by temporal comparison.
 */
export const ARR_SORT = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_SORT');
	if (a.length === 1) compareElements(a[0] as RuntimeValue, a[0] as RuntimeValue, 'ARR_SORT');
	chargeSort(a.length);
	return a.slice().sort((x, y) => compareElements(x, y, 'ARR_SORT'));
};

/**
 * Build a string that two values share exactly when they are deeply equal, or
 * undefined if the value contains NaN and so equals nothing, itself included.
 */
function structuralKey(value: RuntimeValue): string | undefined {
	if (typeof value === 'string') {
		chargeRead(value.length);
		// The length tells where the string ends, whatever it contains
		return `${value.length}:${value}`;
	}
	if (typeof value === 'number') return Number.isNaN(value) ? undefined : String(value);
	if (typeof value === 'boolean') return String(value);
	if (!Array.isArray(value)) {
		chargeValue(value);
		return `${typeOf(value)} ${String(value)}`;
	}

	// The key spells out every element, on top of the walk itself
	charge(2 * value.length + 1);
	let key = '[';
	for (const element of value) {
		const elementKey = structuralKey(element);
		if (elementKey === undefined) return undefined;
		key += `${elementKey},`;
	}
	return `${key}]`;
}

/**
 * Get a number or string that sorts next to the elements equal to this one, or
 * undefined if nothing equals it. Elements of an array share a type, so numbers
 * and strings can stand for themselves.
 */
function sortKey(element: RuntimeValue): number | string | undefined {
	if (typeof element === 'number') return Number.isNaN(element) ? undefined : element;
	return typeof element === 'string' ? element : structuralKey(element);
}

/**
 * Remove duplicate elements using deep equality, preserving first occurrence order.
 *
 * Equal elements are found by sorting rather than hashing. Engines hash integers
 * without a seed and long strings by length alone, so a program could otherwise
 * craft elements that all land in one bucket.
 */
export const ARR_UNIQUE = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_UNIQUE');
	chargeSort(a.length);

	const keys = a.map(sortKey);
	const positions: number[] = [];
	keys.forEach((key, position) => {
		if (key !== undefined) positions.push(position);
	});
	// The sort is stable, so the first of equal elements stays first
	positions.sort((x, y) => compareValues(keys[x] as number, keys[y] as number) as number);

	const isDuplicate = new Uint8Array(a.length);
	for (let i = 1; i < positions.length; i++) {
		const position = positions[i] as number;
		const previous = positions[i - 1] as number;
		isDuplicate[position] =
			compareValues(keys[position] as number, keys[previous] as number) === 0 ? 1 : 0;
	}
	// Filtering leaves spare room behind, which a copy does not keep
	return a.filter((_, position) => isDuplicate[position] === 0).slice();
};

/**
 * Flatten one level of nested arrays.
 * Each element must be an array. Result is validated for homogeneity.
 */
export const ARR_FLAT = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_FLAT');
	for (const elem of a) {
		if (!Array.isArray(elem)) {
			throw new TypeError(`ARR_FLAT: expected array element, got ${typeOf(elem)}`);
		}
		charge(elem.length);
	}
	const result = (a as readonly (readonly RuntimeValue[])[]).flat();
	validateHomogeneousArray(result);
	// Without the spare room flattening left behind
	return result.slice();
};

/**
 * Join a string array with a separator into a single string.
 * All elements must be strings.
 */
export const ARR_JOIN = (a: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_JOIN');
	assertString(sep, 'ARR_JOIN (separator)');
	for (let i = 0; i < a.length; i++) {
		const elem = a[i];
		if (typeof elem !== 'string') {
			throw new TypeError(
				`ARR_JOIN: expected string element, got ${typeOf(elem as RuntimeValue)} at index ${i}`,
			);
		}
		charge(elem.length + sep.length);
	}
	return (a as readonly string[]).join(sep);
};

/**
 * Sum all elements of a numeric array. Empty array returns 0.
 */
export const ARR_SUM = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_SUM');
	let sum = 0;
	for (const elem of a) {
		if (typeof elem !== 'number') {
			throw new TypeError(`ARR_SUM: expected number element, got ${typeOf(elem)}`);
		}
		sum += elem;
	}
	return sum;
};

/**
 * Find the extreme (min or max) element of an array, which is NaN if any is.
 * direction: 1 for max (keep larger), -1 for min (keep smaller)
 */
function findExtreme(a: readonly RuntimeValue[], context: string, direction: 1 | -1): RuntimeValue {
	if (a.length === 0) {
		throw new RangeError(`${context}: array is empty`);
	}

	let best = a[0] as RuntimeValue;
	for (const elem of a) {
		if (Number.isNaN(elem)) return elem;
		if (compareElements(elem, best, context) * direction > 0) best = elem;
	}
	return best;
}

/**
 * Get the minimum element of an array.
 * Supports numbers, strings, dates, times, and datetimes.
 * Throws on empty arrays.
 */
export const ARR_MIN = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_MIN');
	return findExtreme(a, 'ARR_MIN', -1);
};

/**
 * Get the maximum element of an array.
 * Supports numbers, strings, dates, times, and datetimes.
 * Throws on empty arrays.
 */
export const ARR_MAX = (a: RuntimeValue): RuntimeValue => {
	assertArray(a, 'ARR_MAX');
	return findExtreme(a, 'ARR_MAX', 1);
};
