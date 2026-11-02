import { charge, chargeRead } from '../limits.js';

/**
 * Longest pattern left to the engine's substring search. Past this it can take
 * time proportional to the text times the pattern, which a program could exploit.
 */
const MAX_NATIVE_PATTERN_LENGTH = 64;

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

/** Knuth-Morris-Pratt search, linear in the text and the pattern alike. */
function findLongPattern(
	value: string,
	pattern: string,
	fallbacks: Int32Array,
	from: number,
): number {
	let matched = 0;
	for (let i = from; i < value.length; i++) {
		const code = value.charCodeAt(i);
		while (matched > 0 && code !== pattern.charCodeAt(matched)) {
			matched = fallbacks[matched - 1] as number;
		}
		if (code === pattern.charCodeAt(matched)) matched++;
		if (matched === pattern.length) return i + 1 - matched;
	}
	return -1;
}

/**
 * How to find a string, to be used on one text or many. A string of the language has
 * no unpaired surrogates, so a match can only begin and end between code points.
 */
function searcherFor(search: string): (value: string, from: number) => number {
	if (search.length <= MAX_NATIVE_PATTERN_LENGTH) {
		return (value, from) => value.indexOf(search, from);
	}
	const fallbacks = buildFallbacks(search);
	return (value, from) => findLongPattern(value, search, fallbacks, from);
}

/** Find a substring, returning its UTF-16 offset or -1. */
export function findSubstring(value: string, search: string): number {
	return searcherFor(search)(value, 0);
}

/** Every part of a string between separators, found left to right without overlaps. */
export function splitOn(value: string, separator: string): string[] {
	chargeRead(value.length + separator.length);
	const find = searcherFor(separator);
	const parts: string[] = [];
	let start = 0;
	let end = find(value, 0);
	while (end !== -1) {
		charge(1);
		parts.push(value.slice(start, end));
		start = end + separator.length;
		end = find(value, start);
	}
	parts.push(value.slice(start));
	return parts;
}
