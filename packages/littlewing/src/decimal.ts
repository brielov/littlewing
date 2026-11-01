import { EvaluationError } from './errors.js';
import type { Num, RoundingMode } from './number.js';
import {
	add,
	compare,
	div,
	equals,
	fromDouble,
	isInteger,
	mod,
	mul,
	neg,
	parseNumber,
	pow,
	round,
	sub,
	toDouble,
	toFixed,
	toText,
} from './number.js';

export type { RoundingMode } from './number.js';

export type DecimalLike = number | string | Decimal;

const WHITE_SPACE = /^\p{White_Space}$/u;

function isSpace(text: string, index: number): boolean {
	return WHITE_SPACE.test(text[index] as string);
}

/**
 * Remove `White_Space` from both ends of a string. Every character it tests is
 * in the BMP, and scanning from each end cannot backtrack.
 */
function trimWhiteSpace(text: string): string {
	let start = 0;
	let end = text.length;
	while (start < end && isSpace(text, start)) start++;
	while (end > start && isSpace(text, end - 1)) end--;
	return text.slice(start, end);
}

/**
 * Read a string by the rules of `NUM`, or give undefined.
 */
export function parseDecimalText(text: string): Num | undefined {
	return parseNumber(trimWhiteSpace(text));
}

function invalid(message: string): EvaluationError {
	return new EvaluationError(message, 0, 0, { code: 'invalid-argument' });
}

/** Keeps `new Decimal` from plain JavaScript, where `private` means nothing. */
const KEY = Symbol('Decimal');

/** Wrap a number of the language. */
export let wrapDecimal: (value: Num) => Decimal;

/** The number of the language that a `Decimal` holds. */
export let unwrapDecimal: (value: Decimal) => Num;

/** Whether a value is a `Decimal`, by its brand and not its prototype. */
export let isDecimal: (value: unknown) => value is Decimal;

/**
 * A number with exactly the semantics of the language's `number`: 34 significant
 * digits, and immutable. Every method rounds as the language does, and fails as
 * the language does, with an `EvaluationError` of the same code.
 */
export class Decimal {
	readonly #value: Num;

	private constructor(key: symbol, value: Num) {
		if (key !== KEY) throw new TypeError('Make a Decimal with Decimal.from');
		this.#value = value;
	}

	static {
		wrapDecimal = (value) => new Decimal(KEY, value);
		unwrapDecimal = (value) => value.#value;
		isDecimal = (value) => typeof value === 'object' && value !== null && #value in value;
	}

	/**
	 * Make a `Decimal`. A JS number enters by its shortest decimal form, and a
	 * string by the rules of `NUM`.
	 */
	static from(value: DecimalLike): Decimal {
		return wrapDecimal(toNum(value));
	}

	plus(other: DecimalLike): Decimal {
		return wrapDecimal(add(this.#value, toNum(other)));
	}

	minus(other: DecimalLike): Decimal {
		return wrapDecimal(sub(this.#value, toNum(other)));
	}

	times(other: DecimalLike): Decimal {
		return wrapDecimal(mul(this.#value, toNum(other)));
	}

	div(other: DecimalLike): Decimal {
		return wrapDecimal(div(this.#value, toNum(other)));
	}

	mod(other: DecimalLike): Decimal {
		return wrapDecimal(mod(this.#value, toNum(other)));
	}

	pow(other: DecimalLike): Decimal {
		return wrapDecimal(pow(this.#value, toNum(other)));
	}

	neg(): Decimal {
		return wrapDecimal(neg(this.#value));
	}

	/** `ROUND`: to `digits` places, half away from zero unless told otherwise. */
	round(digits = 0, mode: RoundingMode = 'half_away'): Decimal {
		if (!Number.isInteger(digits)) throw invalid('Round: digits must be an integer');
		return wrapDecimal(round(this.#value, digits, checkMode(mode)));
	}

	compare(other: DecimalLike): -1 | 0 | 1 {
		return compare(this.#value, toNum(other));
	}

	equals(other: DecimalLike): boolean {
		return equals(this.#value, toNum(other));
	}

	isInteger(): boolean {
		return isInteger(this.#value);
	}

	/**
	 * The nearest double. This fails with `overflow` if that would be infinite.
	 */
	toNumber(): number {
		return toDouble(this.#value);
	}

	/** The text form of the language: `1.5`, `1e34`. */
	toString(): string {
		return toText(this.#value);
	}

	/** `FIXED`: rounded, then written with exactly `digits` places. */
	toFixed(digits: number, mode: RoundingMode = 'half_away'): string {
		if (!Number.isInteger(digits) || digits < 0) {
			throw invalid('Fixed: digits must be an integer that is not negative');
		}
		return toFixed(this.#value, digits, checkMode(mode));
	}

	/** A string, as JSON numbers are read as doubles. */
	toJSON(): string {
		return toText(this.#value);
	}

	/**
	 * Refuse to become anything but a string, so `a > b` and `a * b` fail rather
	 * than compare text or fall back to doubles.
	 */
	[Symbol.toPrimitive](hint: string): string {
		if (hint !== 'string') {
			throw new TypeError(
				'A Decimal cannot be used with JavaScript operators. Use its methods, such as compare',
			);
		}
		return toText(this.#value);
	}
}

const MODES: ReadonlySet<string> = new Set(['half_away', 'half_even', 'floor', 'ceil', 'trunc']);

function checkMode(mode: RoundingMode): RoundingMode {
	if (typeof mode !== 'string' || !MODES.has(mode)) throw invalid('Unknown rounding mode');
	return mode;
}

function toNum(value: DecimalLike): Num {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw invalid('Not a number of the language');
		return fromDouble(value);
	}
	if (typeof value === 'string') {
		const parsed = parseDecimalText(value);
		if (parsed === undefined) throw invalid('Not a number of the language');
		return parsed;
	}
	if (isDecimal(value)) return unwrapDecimal(value);
	throw invalid('Not a number of the language');
}
