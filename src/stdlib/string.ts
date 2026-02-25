import type { RuntimeValue } from '../types'
import { assertNumber, assertString } from '../utils'

/**
 * Get the length of a string
 */
export const STR_LEN = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_LEN')
	return s.length
}

/**
 * Get the character at a given index (0-based)
 * Throws on out-of-bounds index
 */
export const STR_CHAR_AT = (s: RuntimeValue, i: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_CHAR_AT')
	assertNumber(i, 'STR_CHAR_AT', 'index')
	const idx = Math.trunc(i)
	if (idx < 0 || idx >= s.length) {
		throw new RangeError(
			`STR_CHAR_AT: index ${idx} out of bounds for string of length ${s.length}`,
		)
	}
	return s[idx] as string
}

/**
 * Convert string to uppercase
 */
export const STR_UPPER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_UPPER')
	return s.toUpperCase()
}

/**
 * Convert string to lowercase
 */
export const STR_LOWER = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_LOWER')
	return s.toLowerCase()
}

/**
 * Trim whitespace from both ends of a string
 */
export const STR_TRIM = (s: RuntimeValue): RuntimeValue => {
	assertString(s, 'STR_TRIM')
	return s.trim()
}

/**
 * Extract a section of a string (0-based indices)
 */
export const STR_SLICE = (
	s: RuntimeValue,
	start: RuntimeValue,
	end?: RuntimeValue,
): RuntimeValue => {
	assertString(s, 'STR_SLICE')
	assertNumber(start, 'STR_SLICE', 'start')
	if (end !== undefined) {
		assertNumber(end, 'STR_SLICE', 'end')
		return s.slice(start, end)
	}
	return s.slice(start)
}

/**
 * Check if a string contains another string
 * Returns boolean
 */
export const STR_CONTAINS = (
	s: RuntimeValue,
	search: RuntimeValue,
): RuntimeValue => {
	assertString(s, 'STR_CONTAINS')
	assertString(search, 'STR_CONTAINS')
	return s.includes(search)
}

/**
 * Find the first index of a substring (-1 if not found)
 */
export const STR_INDEX_OF = (
	s: RuntimeValue,
	search: RuntimeValue,
): RuntimeValue => {
	assertString(s, 'STR_INDEX_OF')
	assertString(search, 'STR_INDEX_OF')
	return s.indexOf(search)
}
