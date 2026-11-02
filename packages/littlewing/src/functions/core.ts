import { ArrayType, prune } from '../check/types.js';
import { parseDecimalText, trimWhiteSpace } from '../decimal.js';
import type { FunctionDefinition, NativeCall } from '../define.js';
import { defineNative, t } from '../define.js';
import { charge, chargeRead, chargeSort } from '../limits.js';
import type { Num, RoundingMode } from '../number.js';
import { compare, isInteger, round, toDouble, toFixed } from '../number.js';
import type { Value } from '../run/values.js';
import { codePoints, failure, isNum, lengthOf, OBJECT_STEPS } from '../run/values.js';
import { findSubstring, splitOn } from './search.js';

const MODES = ['half_away', 'half_even', 'floor', 'ceil', 'trunc'] as const;

export function invalid(message: string): Error {
	return failure('invalid-argument', message);
}

/** The element type of the array passed as an argument. */
export function elementOf(call: NativeCall, index: number): ReturnType<typeof prune> | undefined {
	const type = call.types[index];
	const current = type === undefined ? undefined : prune(type);
	return current instanceof ArrayType ? current.element : undefined;
}

/** Past any position, count or number of digits a value can have. */
const LARGEST_INTEGER = 1e15;

/** An integer argument as a double, held to where its exact size stops mattering. */
export function integerOf(value: Value, name: string): number {
	const integer = value as Num;
	if (!isInteger(integer)) throw invalid(`${name} must be an integer`);
	if (compare(integer, LARGEST_INTEGER) > 0) return LARGEST_INTEGER;
	if (compare(integer, -LARGEST_INTEGER) < 0) return -LARGEST_INTEGER;
	return toDouble(integer);
}

/** A position of `SLICE`: counted from the end if negative, and clamped to both ends. */
function positionOf(value: Value, length: number, name: string): number {
	const position = integerOf(value, name);
	const counted = position < 0 ? length + position : position;
	return Math.min(Math.max(counted, 0), length);
}

/** Positions in order of their keys, equal keys staying in order. */
export function sortedPositions(
	keys: readonly Value[],
	order: (a: Value, b: Value) => number,
): number[] {
	chargeSort(keys.length);
	const positions = Array.from(keys, (_, i) => i);
	return positions.sort((a, b) => order(keys[a], keys[b]));
}

const STR = defineNative({
	args: [t.class('showable', 'T')],
	returns: t.string(),
	hooks: [0],
	run: ([value], { ops, types }) => ops.show(value, types[0]),
});

const NUM = defineNative({
	args: [t.class('convertible', 'T')],
	returns: t.number(),
	run: ([value]) => {
		if (isNum(value)) return value;
		if (typeof value === 'boolean') return value ? 1 : 0;
		const text = value as string;
		charge(text.length);
		const parsed = parseDecimalText(text);
		if (parsed === undefined) throw invalid('NUM needs text that is a number');
		return parsed;
	},
});

const LEN = defineNative({
	args: [t.class('sized', 'S')],
	returns: t.number(),
	run: ([value]) =>
		typeof value === 'string' ? lengthOf(value) : (value as readonly Value[]).length,
});

const SLICE = defineNative({
	args: [t.class('sized', 'S'), t.number('start'), t.optional(t.number('end'))],
	returns: t.class('sized', 'S'),
	run: ([value, start, end]) => {
		const whole = typeof value === 'string' ? codePoints(value) : (value as readonly Value[]);
		const { length } = whole;
		const from = positionOf(start, length, 'start');
		const to = end === undefined ? length : positionOf(end, length, 'end');
		const count = Math.max(to - from, 0);
		charge(count + OBJECT_STEPS);
		if (typeof whole === 'string') return whole.slice(from, from + count);
		const part = whole.slice(from, from + count);
		return typeof value === 'string' ? part.join('') : part;
	},
});

const CONTAINS = defineNative({
	overloads: [
		{ args: [t.string(), t.string()], returns: t.boolean() },
		{
			args: [t.array(t.class('equatable', 'T')), t.class('equatable', 'T')],
			returns: t.boolean(),
		},
	],
	hooks: [0, 1],
	run: ([container, item], call) => positionIn(container, item, call) !== -1,
});

function positionIn(container: Value, item: Value, { ops, types }: NativeCall): number {
	if (typeof container === 'string') {
		const search = item as string;
		chargeRead(container.length + search.length);
		const offset = findSubstring(container, search);
		return offset === -1 ? -1 : lengthOf(container.slice(0, offset));
	}
	const list = container as readonly Value[];
	for (let i = 0; i < list.length; i++) {
		if (ops.equal(list[i], item, types[1])) return i;
	}
	return -1;
}

const INDEX_OF = defineNative({
	overloads: [
		{ args: [t.string(), t.string()], returns: t.number() },
		{
			args: [t.array(t.class('equatable', 'T')), t.class('equatable', 'T')],
			returns: t.number(),
		},
	],
	hooks: [0, 1],
	run: ([container, item], call) => positionIn(container, item, call),
});

const UPPER = defineNative({
	args: [t.string()],
	returns: t.string(),
	run: ([text]) => {
		charge((text as string).length);
		return (text as string).toUpperCase();
	},
});

const LOWER = defineNative({
	args: [t.string()],
	returns: t.string(),
	run: ([text]) => {
		charge((text as string).length);
		return (text as string).toLowerCase();
	},
});

const TRIM = defineNative({
	args: [t.string()],
	returns: t.string(),
	run: ([text]) => {
		charge((text as string).length);
		return trimWhiteSpace(text as string);
	},
});

const SPLIT = defineNative({
	args: [t.string(), t.string('separator')],
	returns: t.array(t.string()),
	run: ([text, separator]) => {
		const value = text as string;
		if (separator !== '') return splitOn(value, separator as string);
		const points = codePoints(value);
		charge(points.length + OBJECT_STEPS);
		return typeof points === 'string' ? points.split('') : points;
	},
});

const REPLACE = defineNative({
	args: [t.string(), t.string('search'), t.string('replacement')],
	returns: t.string(),
	run: ([text, search, replacement]) => {
		if (search === '') throw invalid('REPLACE needs something to search for');
		const parts = splitOn(text as string, search as string);
		const added = (replacement as string).length * (parts.length - 1);
		charge(added + (text as string).length);
		return parts.join(replacement as string);
	},
});

const SORT = defineNative({
	args: [t.array(t.class('ordered', 'T'))],
	returns: t.array(t.class('ordered', 'T')),
	hooks: [0],
	run: ([list], call) => {
		const items = list as readonly Value[];
		chargeSort(items.length);
		charge(items.length + OBJECT_STEPS);
		// A sort is stable, and this one keeps nothing else
		return items.slice().sort(call.ops.order(elementOf(call, 0)));
	},
});

const SORT_BY = defineNative({
	args: [t.array(t.var('T')), t.array(t.class('ordered', 'K'))],
	returns: t.array(t.var('T')),
	hooks: [1],
	run: ([list, keys], call) => {
		const items = list as readonly Value[];
		const order = keys as readonly Value[];
		if (items.length !== order.length) throw invalid('SORT_BY needs one key for each item');
		const positions = sortedPositions(order, call.ops.order(elementOf(call, 1)));
		charge(items.length + OBJECT_STEPS);
		return positions.map((position) => items[position]);
	},
});

const JOIN = defineNative({
	args: [t.array(t.string()), t.string('separator')],
	returns: t.string(),
	run: ([list, separator]) => {
		const parts = list as readonly string[];
		const gap = (separator as string).length;
		let total = parts.length * gap;
		for (const part of parts) total += part.length;
		charge(total + parts.length);
		return parts.join(separator as string);
	},
});

const FLOOR = defineNative({
	args: [t.number()],
	returns: t.number(),
	run: ([value]) => (typeof value === 'number' ? value : round(value as Num, 0, 'floor')),
});

const CEIL = defineNative({
	args: [t.number()],
	returns: t.number(),
	run: ([value]) => (typeof value === 'number' ? value : round(value as Num, 0, 'ceil')),
});

const ROUND = defineNative({
	args: [t.number(), t.optional(t.number('digits')), t.optional(t.oneOf(MODES, 'mode'))],
	returns: t.number(),
	run: ([value, digits, mode]) => {
		const places = digits === undefined ? 0 : integerOf(digits, 'digits');
		return round(value as Num, places, (mode ?? 'half_away') as RoundingMode);
	},
});

const FIXED = defineNative({
	args: [t.number(), t.number('digits'), t.optional(t.oneOf(MODES, 'mode'))],
	returns: t.string(),
	run: ([value, digits, mode]) => {
		const places = integerOf(digits, 'digits');
		if (places < 0) throw invalid('digits must not be negative');
		return toFixed(value as Num, places, (mode ?? 'half_away') as RoundingMode);
	},
});

/** The functions every program has, which a host can replace. */
export const CORE: ReadonlyMap<string, FunctionDefinition> = new Map(
	Object.entries({
		STR,
		NUM,
		LEN,
		SLICE,
		CONTAINS,
		INDEX_OF,
		UPPER,
		LOWER,
		TRIM,
		SPLIT,
		REPLACE,
		SORT,
		SORT_BY,
		JOIN,
		FLOOR,
		CEIL,
		ROUND,
		FIXED,
	}),
);
