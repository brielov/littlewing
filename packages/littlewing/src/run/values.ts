import type { AbstractDefinition } from '../define.js';
import { EvaluationError } from '../errors.js';
import { charge, chargeRead } from '../limits.js';
import type { Num } from '../number.js';
import { add, compare, Dec, isInteger, neg, parseNumber, sub, toDouble } from '../number.js';

/** What the language's values are, at run time. */
export type Value = unknown;

/** A record of the language: its fields, with nothing inherited. */
export type RecordValue = Record<string, Value>;

/** Steps a call of a type's operation costs. */
export const HOOK_STEPS = 16;

/** Steps an array or record costs on top of its contents, for the object itself. */
export const OBJECT_STEPS = 2;

export function isNum(value: Value): value is Num {
	return typeof value === 'number' || value instanceof Dec;
}

export function failure(code: string, message: string, cause?: unknown): EvaluationError {
	return new EvaluationError(message, 0, 0, cause === undefined ? { code } : { code, cause });
}

/**
 * Whether a value is a record, where the type does not say. Sound at a generic
 * position, which a value that is also abstract cannot reach: language section 9.
 */
export function isRecordValue(value: Value): value is RecordValue {
	return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === null;
}

export function newRecord(): RecordValue {
	return Object.create(null) as RecordValue;
}

/**
 * Whether a thrown thing is an instance of a class. It can come from host code,
 * where a Proxy can have a trap for this.
 */
export function isInstance<T>(
	value: unknown,
	type: abstract new (...args: never[]) => T,
): value is T {
	try {
		return value instanceof type;
	} catch {
		return false;
	}
}

/**
 * Whether a thrown thing is the stack running out. Host code can throw a `RangeError`
 * of its own, and one that also says this has only itself to blame.
 */
export function isStackOverflow(error: unknown): boolean {
	try {
		return error instanceof RangeError && /call stack/i.test(error.message);
	} catch {
		return false;
	}
}

/**
 * Run host code, turning what it throws into a `host-error`. What it threw stays as
 * the cause, and out of the message, which never holds a host value.
 */
export function hostCall<T>(name: string, call: () => T): T {
	try {
		return call();
	} catch (cause) {
		throw failure('host-error', `${name} failed`, cause);
	}
}

/** A type's test, held to what it promises. */
export function callIs(definition: AbstractDefinition, value: Value): boolean {
	const result: unknown = hostCall(`${definition.name.slice(0, 40)} is`, () =>
		definition.is(value),
	);
	if (typeof result !== 'boolean') throw failure('host-error', 'is must return a boolean');
	return result;
}

/** A `equals` hook, held to what it promises. */
export function callEquals(definition: AbstractDefinition, a: Value, b: Value): boolean {
	charge(HOOK_STEPS);
	const result: unknown = hostCall(`${definition.name.slice(0, 40)} equals`, () =>
		definition.equals?.(a, b),
	);
	if (typeof result !== 'boolean') {
		throw failure('host-error', 'equals must return a boolean');
	}
	return result;
}

/** A `compare` hook, held to what it promises. */
export function callCompare(definition: AbstractDefinition, a: Value, b: Value): number {
	charge(HOOK_STEPS);
	const result: unknown = hostCall(`${definition.name.slice(0, 40)} compare`, () =>
		definition.compare?.(a, b),
	);
	if (typeof result !== 'number' || Number.isNaN(result)) {
		throw failure('host-error', 'compare must return a number');
	}
	return result;
}

const UNPAIRED = /\p{Cs}/u;

/** Whether a string has a surrogate with no partner, which the language has no use for. */
export function hasUnpaired(value: string): boolean {
	return UNPAIRED.test(value);
}

const SURROGATE = /[\ud800-\udfff]/;

/** Whether a string can index by code unit, which spares splitting it. */
function isBasic(value: string): boolean {
	return !SURROGATE.test(value);
}

/** A string as something to index by code point. */
export function codePoints(value: string): readonly string[] | string {
	chargeRead(value.length);
	if (isBasic(value)) return value;
	charge(value.length);
	return Array.from(value);
}

export function lengthOf(value: string): number {
	chargeRead(value.length);
	if (isBasic(value)) return value.length;
	let length = 0;
	for (let i = 0; i < value.length; i++) {
		const unit = value.charCodeAt(i);
		// The second half of a pair does not count
		if (unit < 0xdc00 || unit > 0xdfff) length++;
	}
	return length;
}

/**
 * Compare two strings by code point. UTF-16 order only differs from it where a
 * surrogate meets a unit above the surrogates, so the first difference decides.
 */
export function compareStrings(a: string, b: string): number {
	chargeRead(a.length + b.length);
	if (a === b) return 0;
	const end = Math.min(a.length, b.length);
	for (let i = 0; i < end; i++) {
		const x = a.charCodeAt(i);
		const y = b.charCodeAt(i);
		if (x !== y) {
			const fix = (unit: number): number => (unit >= 0xe000 ? unit - 0x800 : unit + 0x2000);
			if (x >= 0xd800 && y >= 0xd800) return fix(x) - fix(y);
			return x - y;
		}
	}
	return a.length - b.length;
}

/** A position in a sequence, or undefined if it is past either end. */
export function resolvePosition(index: Num, length: number): number | undefined {
	if (typeof index !== 'number') {
		if (!isInteger(index)) throw failure('not-an-integer', 'An index must be an integer');
		return undefined;
	}
	const position = index < 0 ? length + index : index;
	return position < 0 || position >= length ? undefined : position;
}

/** Every integer up to here is a number, and past it some are not. */
const LARGEST_RANGE_BOUND: Num = parseNumber('1e34') as Num;

/** `from..to`, or `from..=to`. */
export function buildRange(from: Num, to: Num, inclusive: boolean): readonly Num[] {
	if (!isInteger(from) || !isInteger(to)) {
		throw failure('not-an-integer', 'A range needs integers');
	}
	const order = compare(from, to);
	if (order > 0) throw failure('invalid-range', 'A range must not run backwards');
	if (order === 0) return inclusive ? [from] : [];

	const last = inclusive ? to : sub(to, 1);
	if (compare(from, neg(LARGEST_RANGE_BOUND)) < 0 || compare(last, LARGEST_RANGE_BOUND) > 0) {
		throw failure('invalid-range', 'A range cannot hold integers this large');
	}

	const length = toDouble(sub(to, from)) + (inclusive ? 1 : 0);
	charge(length);
	const values: Num[] = [];
	if (typeof from === 'number' && typeof to === 'number') {
		for (let i = 0; i < length; i++) values.push(from + i);
	} else {
		let current = from;
		for (let i = 0; i < length; i++) {
			values.push(current);
			current = add(current, 1);
		}
	}
	return values;
}
