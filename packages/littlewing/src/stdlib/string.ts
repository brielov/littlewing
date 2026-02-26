import type { RuntimeValue } from "../types";
import { assertNumber, assertString } from "../utils";

/**
 * Get the length of a string
 */
export const STR_LEN = (s: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_LEN");
	return s.length;
};

/**
 * Convert string to uppercase
 */
export const STR_UPPER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_UPPER");
	return s.toUpperCase();
};

/**
 * Convert string to lowercase
 */
export const STR_LOWER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_LOWER");
	return s.toLowerCase();
};

/**
 * Trim whitespace from both ends of a string
 */
export const STR_TRIM = (s: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_TRIM");
	return s.trim();
};

/**
 * Extract a section of a string (0-based indices)
 */
export const STR_SLICE = (
	s: RuntimeValue,
	start: RuntimeValue,
	end?: RuntimeValue,
): RuntimeValue => {
	assertString(s, "STR_SLICE");
	assertNumber(start, "STR_SLICE", "start");
	if (end !== undefined) {
		assertNumber(end, "STR_SLICE", "end");
		return s.slice(start, end);
	}
	return s.slice(start);
};

/**
 * Check if a string contains another string
 * Returns boolean
 */
export const STR_CONTAINS = (s: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_CONTAINS");
	assertString(search, "STR_CONTAINS");
	return s.includes(search);
};

/**
 * Find the first index of a substring (-1 if not found)
 */
export const STR_INDEX_OF = (s: RuntimeValue, search: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_INDEX_OF");
	assertString(search, "STR_INDEX_OF");
	return s.indexOf(search);
};

/**
 * Split a string by a separator into a string array
 */
export const STR_SPLIT = (s: RuntimeValue, sep: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_SPLIT");
	assertString(sep, "STR_SPLIT (separator)");
	return s.split(sep);
};

/**
 * Replace the first occurrence of a search string with a replacement
 */
export const STR_REPLACE = (
	s: RuntimeValue,
	search: RuntimeValue,
	replacement: RuntimeValue,
): RuntimeValue => {
	assertString(s, "STR_REPLACE");
	assertString(search, "STR_REPLACE (search)");
	assertString(replacement, "STR_REPLACE (replacement)");
	return s.replace(search, replacement);
};

/**
 * Check if a string starts with a given prefix
 */
export const STR_STARTS_WITH = (s: RuntimeValue, prefix: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_STARTS_WITH");
	assertString(prefix, "STR_STARTS_WITH (prefix)");
	return s.startsWith(prefix);
};

/**
 * Check if a string ends with a given suffix
 */
export const STR_ENDS_WITH = (s: RuntimeValue, suffix: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_ENDS_WITH");
	assertString(suffix, "STR_ENDS_WITH (suffix)");
	return s.endsWith(suffix);
};

/**
 * Repeat a string n times. Count must be a non-negative integer.
 */
export const STR_REPEAT = (s: RuntimeValue, count: RuntimeValue): RuntimeValue => {
	assertString(s, "STR_REPEAT");
	assertNumber(count, "STR_REPEAT", "count");
	if (!Number.isInteger(count) || count < 0) {
		throw new RangeError(`STR_REPEAT: count must be a non-negative integer, got ${count}`);
	}
	return s.repeat(count);
};
