/**
 * Longest pattern left to the engine's substring search. Past this it can take
 * time proportional to the text times the pattern, which a program could exploit.
 */
const MAX_NATIVE_PATTERN_LENGTH = 64;

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Check if a UTF-16 offset falls inside a surrogate pair.
 */
function splitsPair(value: string, offset: number): boolean {
	return isLowSurrogate(value.charCodeAt(offset)) && isHighSurrogate(value.charCodeAt(offset - 1));
}

function isWholeMatch(value: string, offset: number, length: number): boolean {
	return !splitsPair(value, offset) && !splitsPair(value, offset + length);
}

/**
 * For each prefix of `pattern`, get the length of its longest proper prefix that
 * is also its suffix: how much of a match survives a mismatch.
 */
function buildFallbacks(pattern: string): Int32Array {
	const fallbacks = new Int32Array(pattern.length);
	let matched = 0;
	for (let i = 1; i < pattern.length; i++) {
		const code = pattern.charCodeAt(i);
		while (matched > 0 && code !== pattern.charCodeAt(matched)) {
			matched = fallbacks[matched - 1] as number;
		}
		if (code === pattern.charCodeAt(matched)) matched++;
		fallbacks[i] = matched;
	}
	return fallbacks;
}

/**
 * Knuth-Morris-Pratt search, linear in the text and the pattern alike.
 */
function findLongPattern(value: string, pattern: string, from: number): number {
	const fallbacks = buildFallbacks(pattern);
	let matched = 0;
	for (let i = from; i < value.length; i++) {
		const code = value.charCodeAt(i);
		while (matched > 0 && code !== pattern.charCodeAt(matched)) {
			matched = fallbacks[matched - 1] as number;
		}
		if (code === pattern.charCodeAt(matched)) matched++;
		if (matched === pattern.length) {
			const offset = i + 1 - matched;
			if (isWholeMatch(value, offset, matched)) return offset;
			matched = fallbacks[matched - 1] as number;
		}
	}
	return -1;
}

/**
 * Find a substring on code point boundaries, so that half a character never
 * matches, returning its UTF-16 offset or -1.
 */
export function findSubstring(value: string, search: string, from = 0): number {
	if (search.length > MAX_NATIVE_PATTERN_LENGTH) return findLongPattern(value, search, from);

	let offset = value.indexOf(search, from);
	while (offset !== -1 && !isWholeMatch(value, offset, search.length)) {
		offset = value.indexOf(search, offset + 1);
	}
	return offset;
}
