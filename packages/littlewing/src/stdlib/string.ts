import type { RuntimeValue } from '../types.js';
import { charge } from '../limits.js';
import { assertNumber, assertString } from '../utils.js';
import { findSubstring } from './search.js';

/**
 * Convert string to uppercase
 */
export const STR_UPPER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_UPPER');
	return s.toUpperCase();
};

/**
 * Convert string to lowercase
 */
export const STR_LOWER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_LOWER');
	return s.toLowerCase();
};

/**
 * Trim whitespace from both ends of a string
 */
export const STR_TRIM = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_TRIM');
	return s.trim();
};

function splitOn(s: string, sep: string): string[] {
	const parts: string[] = [];
	let start = 0;
	let end = findSubstring(s, sep);
	while (end !== -1) {
		parts.push(s.slice(start, end));
		start = end + sep.length;
		end = findSubstring(s, sep, start);
	}
	parts.push(s.slice(start));
	return parts;
}

/**
 * Split a string by a separator into a string array. An empty separator splits
 * between code points.
 */
export const STR_SPLIT = (s: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_SPLIT');
	assertString(sep, 'STR_SPLIT (separator)');
	const parts = sep === '' ? Array.from(s) : splitOn(s, sep);
	// On top of the array, every part is a string of its own
	charge(parts.length);
	// Without the spare room growing the array left behind
	return parts.slice();
};

/**
 * Replace the first occurrence of a search string with a replacement
 */
export const STR_REPLACE = (
	s: RuntimeValue,
	search: RuntimeValue,
	replacement: RuntimeValue,
): RuntimeValue => {
	assertString(s, 'STR_REPLACE');
	assertString(search, 'STR_REPLACE (search)');
	assertString(replacement, 'STR_REPLACE (replacement)');
	const offset = findSubstring(s, search);
	if (offset === -1) return s;
	return s.slice(0, offset) + replacement + s.slice(offset + search.length);
};

/**
 * Check if a string starts with a given prefix
 */
export const STR_STARTS_WITH = (s: RuntimeValue, prefix: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_STARTS_WITH');
	assertString(prefix, 'STR_STARTS_WITH (prefix)');
	return s.startsWith(prefix);
};

/**
 * Check if a string ends with a given suffix
 */
export const STR_ENDS_WITH = (s: RuntimeValue, suffix: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_ENDS_WITH');
	assertString(suffix, 'STR_ENDS_WITH (suffix)');
	return s.endsWith(suffix);
};

/**
 * Repeat a string n times. Count must be a non-negative integer.
 */
export const STR_REPEAT = (s: RuntimeValue, count: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_REPEAT');
	assertNumber(count, 'STR_REPEAT', 'count');
	if (!Number.isInteger(count) || count < 0) {
		throw new RangeError(`STR_REPEAT: count must be a non-negative integer, got ${count}`);
	}
	charge(s.length * count);
	return s.repeat(count);
};
