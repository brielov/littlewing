import { EvaluationError } from './errors.js';
import { charge } from './limits.js';

/**
 * The language's number type: decimal, with 34 significant digits, on the value
 * set of IEEE 754 decimal128 without negative zero, infinities or NaN.
 *
 * A number is a JS number exactly when it is a safe integer, and a `Dec`
 * otherwise. Integers then cost what they always did, as arithmetic on them is
 * exact. Every number has one representation, so values compare by their parts.
 */
export type Num = number | Dec;

export type RoundingMode = 'half_away' | 'half_even' | 'floor' | 'ceil' | 'trunc';

/**
 * A number that is not a safe integer: `c × 10^e`. `c` is never a multiple of
 * ten, and is a JS number whenever it is a safe integer.
 */
export class Dec {
	readonly c: number | bigint;
	readonly e: number;
	constructor(c: number | bigint, e: number) {
		this.c = c;
		this.e = e;
	}
}

const PRECISION = 34;
const MIN_EXPONENT = -6176;
const MIN_NORMAL_ADJUSTED = -6143;
const MAX_ADJUSTED = 6144;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const POW10 = [1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15];
const isSafe = Number.isSafeInteger;

/** The cost of an operation that falls back to `BigInt`. */
const BIG_STEPS = 8;

/** The cost of a pass of the power loop, on top of its working precision. */
const POWER_STEPS = 256;

/** A value with no more digits than this has an exact power worth computing. */
const EXACT_POWER_DIGITS = 400n;

/** The longest text to build: the shortest limit among JavaScript engines. */
const MAX_TEXT_LENGTH = 2 ** 29 - 24;

/**
 * The largest denominator of an exponent for which a base other than a power of
 * ten can be a perfect power: a coefficient below 10^34 is below 2^113.
 */
const MAX_ROOT = 113n;

function failure(code: string, message: string): EvaluationError {
	return new EvaluationError(message, 0, 0, { code });
}

function overflow(): EvaluationError {
	return failure('overflow', 'Number is too large');
}

const pow10Cache: bigint[] = [];

function pow10(n: number): bigint {
	if (n > 64) return 10n ** BigInt(n);
	let value = pow10Cache[n];
	if (value === undefined) {
		value = 10n ** BigInt(n);
		pow10Cache[n] = value;
	}
	return value;
}

function digitCount(magnitude: bigint): number {
	return magnitude.toString().length;
}

function abs(value: bigint): bigint {
	return value < 0n ? -value : value;
}

/**
 * The canonical form of a value that fits: `magnitude` is non-zero and has at
 * most 34 digits, and `e` is in range.
 */
function canonical(negative: boolean, magnitude: bigint, e: number): Num {
	if (magnitude % 10n === 0n) {
		// An exact quotient can have some 30 zeros to lose, so take them in chunks
		for (const size of [16, 8, 4, 2, 1]) {
			const chunk = pow10(size);
			while (magnitude % chunk === 0n) {
				magnitude /= chunk;
				e += size;
			}
		}
	}
	if (magnitude > MAX_SAFE) return new Dec(negative ? -magnitude : magnitude, e);

	const c = negative ? -Number(magnitude) : Number(magnitude);
	if (e === 0) return c;
	if (e > 0 && e < 16) {
		const integer = c * (POW10[e] as number);
		if (isSafe(integer)) return integer;
	}
	return new Dec(c, e);
}

/**
 * Round an exact value once, as language section 4.1 says, or return undefined
 * if it overflows. `sticky` means that the exact value has more non-zero digits
 * below `magnitude`, which must then hold at least 36 digits.
 */
function rounded(negative: boolean, magnitude: bigint, e: number, sticky = false): Num | undefined {
	if (magnitude === 0n) return 0;

	const adjusted = digitCount(magnitude) + e - 1;
	// Below half of the smallest number
	if (adjusted < MIN_EXPONENT - 1) return 0;

	const target = adjusted < MIN_NORMAL_ADJUSTED ? MIN_EXPONENT : adjusted - (PRECISION - 1);
	if (target > e) {
		const divisor = pow10(target - e);
		let quotient = magnitude / divisor;
		const twice = (magnitude - quotient * divisor) * 2n;
		if (twice > divisor || (twice === divisor && (sticky || quotient % 2n === 1n))) quotient += 1n;
		if (quotient === 0n) return 0;
		magnitude = quotient;
		e = target;
	}
	if (digitCount(magnitude) + e - 1 > MAX_ADJUSTED) return undefined;
	return canonical(negative, magnitude, e);
}

function finish(negative: boolean, magnitude: bigint, e: number, sticky = false): Num {
	const result = rounded(negative, magnitude, e, sticky);
	if (result === undefined) throw overflow();
	return result;
}

/**
 * Canonicalize a result of the fast paths: `c` is a non-zero safe integer.
 */
function normal(c: number, e: number): Num {
	if (e === 0) return c;
	while (c % 10 === 0) {
		c /= 10;
		e++;
	}
	if (e === 0) return c;
	if (e < MIN_EXPONENT || e > 6100) return finish(c < 0, BigInt(Math.abs(c)), e);
	if (e > 0 && e < 16) {
		const integer = c * (POW10[e] as number);
		if (isSafe(integer)) return integer;
	}
	return new Dec(c, e);
}

/**
 * The sum of two values. A value more than 40 digits below the other cannot move
 * it, even across a rounding boundary, as the other is already a number.
 */
function addBig(ac: bigint, ae: number, bc: bigint, be: number): Num {
	charge(BIG_STEPS);
	if (ac === 0n) return finish(bc < 0n, abs(bc), be);
	if (bc === 0n) return finish(ac < 0n, abs(ac), ae);

	const aDigits = digitCount(abs(ac));
	const bDigits = digitCount(abs(bc));
	const gap = aDigits + ae - (bDigits + be);
	if (gap > 40 || gap < -40) {
		return gap > 0 ? finish(ac < 0n, abs(ac), ae) : finish(bc < 0n, abs(bc), be);
	}

	const e = Math.min(ae, be);
	const sum = ac * pow10(ae - e) + bc * pow10(be - e);
	return finish(sum < 0n, abs(sum), e);
}

export function add(a: Num, b: Num): Num {
	const ac = typeof a === 'number' ? a : a.c;
	const ae = typeof a === 'number' ? 0 : a.e;
	const bc = typeof b === 'number' ? b : b.c;
	const be = typeof b === 'number' ? 0 : b.e;
	if (typeof ac === 'number' && typeof bc === 'number') {
		if (ae === be) {
			const sum = ac + bc;
			if (isSafe(sum)) return sum === 0 ? 0 : normal(sum, ae);
		} else if (ae > be) {
			const shift = ae - be;
			if (shift < 16) {
				const scaled = ac * (POW10[shift] as number);
				const sum = scaled + bc;
				if (isSafe(scaled) && isSafe(sum)) return sum === 0 ? 0 : normal(sum, be);
			}
		} else {
			const shift = be - ae;
			if (shift < 16) {
				const scaled = bc * (POW10[shift] as number);
				const sum = scaled + ac;
				if (isSafe(scaled) && isSafe(sum)) return sum === 0 ? 0 : normal(sum, ae);
			}
		}
	}
	return addBig(BigInt(ac), ae, BigInt(bc), be);
}

export function neg(a: Num): Num {
	if (typeof a === 'number') return a === 0 ? 0 : -a;
	return new Dec(-a.c, a.e);
}

export function sub(a: Num, b: Num): Num {
	return add(a, neg(b));
}

export function mul(a: Num, b: Num): Num {
	const ac = typeof a === 'number' ? a : a.c;
	const ae = typeof a === 'number' ? 0 : a.e;
	const bc = typeof b === 'number' ? b : b.c;
	const be = typeof b === 'number' ? 0 : b.e;
	if (typeof ac === 'number' && typeof bc === 'number') {
		const product = ac * bc;
		if (isSafe(product)) return product === 0 ? 0 : normal(product, ae + be);
	}
	charge(BIG_STEPS);
	const product = BigInt(ac) * BigInt(bc);
	return finish(product < 0n, abs(product), ae + be);
}

export function div(a: Num, b: Num): Num {
	if (b === 0) throw failure('division-by-zero', 'Division by zero');
	if (a === 0) return 0;
	if (typeof a === 'number' && typeof b === 'number') {
		const quotient = a / b;
		if (isSafe(quotient) && quotient * b === a) return quotient;
	}

	const ae = typeof a === 'number' ? 0 : a.e;
	const be = typeof b === 'number' ? 0 : b.e;
	const numerator = typeof a === 'number' ? a : a.c;
	const denominator = typeof b === 'number' ? b : b.c;
	if (typeof numerator === 'number' && typeof denominator === 'number') {
		// Most divisions in formulas end, as a percentage does
		for (const scale of [2, 6]) {
			const scaled = numerator * (POW10[scale] as number);
			const quotient = scaled / denominator;
			if (isSafe(scaled) && isSafe(quotient) && quotient * denominator === scaled) {
				return normal(quotient, ae - be - scale);
			}
		}
	}

	charge(BIG_STEPS);
	const ac = BigInt(numerator);
	const bc = BigInt(denominator);
	const dividend = abs(ac);
	const divisor = abs(bc);
	// At least 36 digits, so the quotient rounds with digits to spare
	const shift = PRECISION + 3 + digitCount(divisor) - digitCount(dividend);
	const scaled = dividend * pow10(shift);
	const quotient = scaled / divisor;
	return finish(ac < 0n !== bc < 0n, quotient, ae - be - shift, scaled !== quotient * divisor);
}

export function mod(a: Num, b: Num): Num {
	if (b === 0) throw failure('modulo-by-zero', 'Modulo by zero');
	if (typeof a === 'number' && typeof b === 'number') {
		const remainder = a % b;
		return remainder === 0 ? 0 : remainder;
	}

	const ac = BigInt(typeof a === 'number' ? a : a.c);
	const ae = typeof a === 'number' ? 0 : a.e;
	const bc = BigInt(typeof b === 'number' ? b : b.c);
	const be = typeof b === 'number' ? 0 : b.e;
	const e = Math.min(ae, be);
	charge(BIG_STEPS + ((Math.max(ae, be) - e) >>> 3));
	const remainder = (ac * pow10(ae - e)) % (bc * pow10(be - e));
	return finish(remainder < 0n, abs(remainder), e);
}

export function compare(a: Num, b: Num): -1 | 0 | 1 {
	if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;

	const ac = typeof a === 'number' ? a : a.c;
	const ae = typeof a === 'number' ? 0 : a.e;
	const bc = typeof b === 'number' ? b : b.c;
	const be = typeof b === 'number' ? 0 : b.e;
	if (ac < 0 !== bc < 0 || ac === 0 || bc === 0) {
		const left = ac < 0 ? -1 : ac > 0 ? 1 : 0;
		const right = bc < 0 ? -1 : bc > 0 ? 1 : 0;
		return left < right ? -1 : left > right ? 1 : 0;
	}
	if (typeof ac === 'number' && typeof bc === 'number') {
		const shift = ae - be;
		if (shift > -16 && shift < 16) {
			const left = shift > 0 ? ac * (POW10[shift] as number) : ac;
			const right = shift < 0 ? bc * (POW10[-shift] as number) : bc;
			if (isSafe(left) && isSafe(right)) return left < right ? -1 : left > right ? 1 : 0;
		}
	}

	charge(BIG_STEPS);
	const left = BigInt(ac);
	const right = BigInt(bc);
	const leftAdjusted = digitCount(abs(left)) + ae;
	const rightAdjusted = digitCount(abs(right)) + be;
	if (leftAdjusted !== rightAdjusted) {
		return leftAdjusted > rightAdjusted === left > 0n ? 1 : -1;
	}
	const e = Math.min(ae, be);
	const x = left * pow10(ae - e);
	const y = right * pow10(be - e);
	return x < y ? -1 : x > y ? 1 : 0;
}

export function equals(a: Num, b: Num): boolean {
	if (typeof a === 'number' || typeof b === 'number') return a === b;
	return a.e === b.e && a.c === b.c;
}

export function isNegative(a: Num): boolean {
	return typeof a === 'number' ? a < 0 : a.c < 0;
}

export function isInteger(a: Num): boolean {
	return typeof a === 'number' || a.e >= 0;
}

/** Sign and canonical parts of a non-zero number. */
function partsOf(a: Num): [boolean, bigint, number] {
	if (typeof a !== 'number') return [a.c < 0, abs(BigInt(a.c)), a.e];
	let magnitude = BigInt(Math.abs(a));
	let e = 0;
	while (magnitude % 10n === 0n) {
		magnitude /= 10n;
		e++;
	}
	return [a < 0, magnitude, e];
}

function adjustedOf(a: Num): number {
	const [, magnitude, e] = partsOf(a);
	return digitCount(magnitude) + e - 1;
}

// ============================================================================
// Text
// ============================================================================

/**
 * Read an unsigned or signed decimal: digits with an optional point, at least
 * one digit, and an optional exponent, already known to have that form. Gives
 * undefined for what no number can hold exactly.
 */
function fromParts(
	negative: boolean,
	integer: string,
	fraction: string,
	exponent: number,
): Num | undefined {
	const digits = integer + fraction;
	let start = 0;
	while (start < digits.length && digits.charCodeAt(start) === 0x30) start++;
	let end = digits.length;
	while (end > start && digits.charCodeAt(end - 1) === 0x30) end--;
	if (start === end) return 0;

	const significant = end - start;
	if (significant > PRECISION) return undefined;
	const e = exponent - fraction.length + (digits.length - end);
	if (e < MIN_EXPONENT || significant + e - 1 > MAX_ADJUSTED) return undefined;
	return canonical(negative, BigInt(digits.slice(start, end)), e);
}

// Each part has one way to match, as a regular expression must on untrusted input
const NUMERIC = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * Parse a decimal, with an optional sign, or give undefined if the text is not
 * one, or no number can hold it exactly.
 */
export function parseNumber(text: string): Num | undefined {
	const match = NUMERIC.exec(text);
	if (match === null) return undefined;
	const integer = match[2] as string;
	const fraction = match[3] ?? '';
	if (integer === '' && fraction === '') return undefined;
	return fromParts(match[1] === '-', integer, fraction, Number(match[4] ?? 0));
}

/**
 * A JS number enters by its shortest decimal form, so `0.1` is exactly `0.1`.
 * It must be finite.
 */
export function fromDouble(value: number): Num {
	if (isSafe(value)) return value === 0 ? 0 : value;
	return parseNumber(String(value)) as Num;
}

/** The text form of language section 4.7. */
export function toText(a: Num): string {
	if (typeof a === 'number') return String(a);

	const negative = a.c < 0;
	const digits = abs(BigInt(a.c)).toString();
	const sign = negative ? '-' : '';
	const { e } = a;
	if (e >= 0) {
		if (digits.length + e <= PRECISION) return sign + digits + '0'.repeat(e);
	} else if (-e <= PRECISION) {
		const point = digits.length + e;
		return point > 0
			? `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
			: `${sign}0.${'0'.repeat(-point)}${digits}`;
	}

	const exponent = digits.length + e - 1;
	const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
	return `${sign}${mantissa}e${exponent}`;
}

/**
 * The nearest double, ties to even. A result that would be infinite overflows,
 * and one too small to represent is `0`, never `-0`.
 */
export function toDouble(a: Num): number {
	if (typeof a === 'number') return a;
	const value = Number(toText(a));
	if (!Number.isFinite(value)) throw overflow();
	return value === 0 ? 0 : value;
}

// ============================================================================
// Rounding
// ============================================================================

function roundsUp(
	mode: RoundingMode,
	negative: boolean,
	odd: boolean,
	remainder: bigint,
	unit: bigint,
): boolean {
	if (remainder === 0n) return false;
	switch (mode) {
		case 'trunc':
			return false;
		case 'floor':
			return negative;
		case 'ceil':
			return !negative;
		case 'half_away':
			return remainder * 2n >= unit;
		case 'half_even': {
			const twice = remainder * 2n;
			return twice > unit || (twice === unit && odd);
		}
	}
}

/**
 * Round to `digits` decimal places. `digits` is an integer, and can be negative.
 */
export function round(a: Num, digits = 0, mode: RoundingMode = 'half_away'): Num {
	if (a === 0 || (digits >= 0 && typeof a === 'number')) return a;

	charge(BIG_STEPS);
	const [negative, magnitude, e] = partsOf(a);
	const target = -digits;
	if (e >= target) return a;

	const drop = target - e;
	const count = digitCount(magnitude);
	if (drop > count + 1) {
		// Far below one unit of the target, so only a mode that always rounds away counts
		const up = roundsUp(mode, negative, false, 1n, pow10(4));
		return up ? finish(negative, 1n, target) : 0;
	}

	const unit = pow10(drop);
	const quotient = magnitude / unit;
	const up = roundsUp(mode, negative, quotient % 2n === 1n, magnitude - quotient * unit, unit);
	const result = up ? quotient + 1n : quotient;
	return result === 0n ? 0 : finish(negative, result, target);
}

/**
 * Round, then write in plain notation with exactly `digits` places, which is an
 * integer that is not negative.
 */
export function toFixed(a: Num, digits: number, mode: RoundingMode = 'half_away'): string {
	// The text is the cost, and `digits` alone can make it enormous, so pay first
	const length = Math.max(a === 0 ? 1 : adjustedOf(a) + 1, 1) + digits + 2;
	if (length > MAX_TEXT_LENGTH) {
		throw failure('limit-exceeded', 'Text is too long');
	}
	charge(BIG_STEPS + length / 8);

	const value = round(a, digits, mode);
	if (value === 0) return digits > 0 ? `0.${'0'.repeat(digits)}` : '0';

	const [negative, magnitude, e] = partsOf(value);
	const coefficient = magnitude.toString();
	const sign = negative ? '-' : '';
	if (e >= 0) {
		const integer = coefficient + '0'.repeat(e);
		return digits > 0 ? `${sign}${integer}.${'0'.repeat(digits)}` : sign + integer;
	}

	const point = coefficient.length + e;
	const integer = point > 0 ? coefficient.slice(0, point) : '0';
	const fraction = point > 0 ? coefficient.slice(point) : '0'.repeat(-point) + coefficient;
	return `${sign}${integer}.${fraction.padEnd(digits, '0')}`;
}

// ============================================================================
// Powers
// ============================================================================

function gcd(a: bigint, b: bigint): bigint {
	while (b !== 0n) [a, b] = [b, a % b];
	return a;
}

/** The integer `n`-th root of a positive value, rounded down. */
function integerRoot(value: bigint, n: bigint): bigint {
	const shift = BigInt(digitCount(value)) / n + 1n;
	let guess = 10n ** shift;
	for (;;) {
		const next = ((n - 1n) * guess + value / guess ** (n - 1n)) / n;
		if (next >= guess) return guess;
		guess = next;
	}
}

/** `exp(x)`, in fixed point with `digits` places, for a small `x`. */
function expFixed(x: bigint, digits: number): bigint {
	// Halving brings the series close to 1, and squaring undoes it, losing a
	// factor of two in accuracy each time
	const halvings = Math.ceil(Math.sqrt(digits));
	const guard = Math.ceil(halvings * 0.302) + 6;
	const one = pow10(digits + guard);
	const reduced = (x * pow10(guard)) >> BigInt(halvings);

	let sum = one;
	let term = one;
	for (let k = 1n; ; k++) {
		term = (term * reduced) / one / k;
		if (term === 0n) break;
		sum += term;
	}
	for (let i = 0; i < halvings; i++) sum = (sum * sum) / one;
	return sum / pow10(guard);
}

/**
 * `ln(x)`, in fixed point with `digits` places, for `x` from 1 to 10, given as
 * `coefficient / 10^shift`. Halley's iteration on `expFixed` triples the correct
 * digits each pass, starting from those of a double.
 */
function logFixed(coefficient: bigint, shift: number, digits: number): bigint {
	const working = digits + 6;
	const x = (coefficient * pow10(working)) / pow10(shift);
	const start = Math.log(Number(coefficient) / 10 ** shift);
	let y = BigInt(Math.round(start * 1e15)) * pow10(working - 15);
	for (let correct = 14; correct < working + 1; correct *= 3) {
		const e = expFixed(y, working);
		y += (2n * (x - e) * pow10(working)) / (x + e);
	}
	return y / pow10(6);
}

let ln10Digits = 0;
let ln10Value = 0n;

function ln10Fixed(digits: number): bigint {
	if (digits > ln10Digits) {
		ln10Digits = digits;
		ln10Value = logFixed(10n, 0, digits);
	}
	return ln10Value / pow10(ln10Digits - digits);
}

/**
 * An exact power, if `a^b` can be exact or close enough to a tie to need it. The
 * base is `c × 10^e`, with `c` no multiple of ten and neither 0 nor 1 as a whole.
 * Gives undefined otherwise, when approximating is certain to end.
 */
function exactPower(c: bigint, e: number, b: Num): Num | undefined {
	const [exponentNegative, exponent, exponentE] = partsOf(b);

	if (c === 1n) {
		// A power of ten: exact if the exponent of ten comes out whole
		const whole = BigInt(e) * exponent;
		if (exponentE >= 0) {
			if (digitCount(exponent) + exponentE > 8) {
				if (e > 0 !== exponentNegative) throw overflow();
				return 0;
			}
			const power = Number(whole * pow10(exponentE));
			return finish(false, 1n, exponentNegative ? -power : power);
		}
		if (-exponentE > 40 || whole % pow10(-exponentE) !== 0n) return undefined;
		const power = Number(whole / pow10(-exponentE));
		return finish(false, 1n, exponentNegative ? -power : power);
	}

	let base = c;
	let baseE = e;
	let numerator = exponent;
	if (exponentE >= 0) {
		if (digitCount(exponent) + exponentE > Number(EXACT_POWER_DIGITS)) return undefined;
		numerator = exponent * pow10(exponentE);
	} else {
		// `exponent` is below 10^34, so the root would be past any that can be exact
		if (exponentE < -36) return undefined;
		const denominator = pow10(-exponentE);
		const divisor = gcd(denominator, exponent);
		numerator = exponent / divisor;
		const root = denominator / divisor;
		if (root > MAX_ROOT) return undefined;

		// `c` is no multiple of ten, so a whole root of `c × 10^e` needs `n` to divide `e`
		const n = Number(root);
		if (e % n !== 0) return undefined;
		charge(n);
		base = integerRoot(c, root);
		if (base ** root !== c) return undefined;
		baseE = e / n;
	}

	const size = numerator * BigInt(digitCount(base));
	if (size > EXACT_POWER_DIGITS) return undefined;
	charge(Number(size) >>> 3);
	const power = base ** numerator;
	const powerE = baseE * Number(numerator);
	if (!exponentNegative) return finish(false, power, powerE);

	const shift = PRECISION + 3 + digitCount(power);
	const scaled = pow10(shift);
	const quotient = scaled / power;
	return finish(false, quotient, -shift - powerE, scaled !== quotient * power);
}

/**
 * The size of `b × ln(a)`, as a power of ten, for a positive `a` other than 1.
 * This is an estimate, within a factor of 100 or so, and needs no precision.
 */
function exponentScale(c: bigint, e: number, b: Num): number {
	const value = finish(false, c, e);
	const digits = digitCount(c);
	const adjusted = digits + e - 1;
	const near = adjusted === 0 || adjusted === -1;
	if (near) {
		const distance = sub(value, 1);
		if (distance !== 0) {
			const scale = adjustedOf(distance);
			if (scale < -1) return adjustedOf(b) + scale;
		}
	}
	const log = Math.abs(adjusted * Math.LN10 + Math.log(Number(c) / 10 ** (digits - 1)));
	return adjustedOf(b) + Math.floor(Math.log10(log));
}

/**
 * Approximate `a^b` with more digits on each pass, until both ends of the error
 * bound round to one number. `exactPower` has ruled out an exact tie, so the
 * value is never on a rounding boundary, and this ends.
 */
function approximatePower(c: bigint, e: number, b: Num): Num {
	const base = finish(false, c, e);
	const [exponentNegative, exponent, exponentE] = partsOf(b);
	const growing = compare(base, 1) > 0 !== exponentNegative;
	if (exponentScale(c, e, b) > 6) {
		if (growing) throw overflow();
		return 0;
	}

	const digits = digitCount(c);
	const adjusted = digits + e - 1;
	for (let precision = 50; ; precision *= 2) {
		const fixed = precision + 12 + Math.max(0, adjustedOf(b) + 1);
		charge(POWER_STEPS + fixed + Math.floor((fixed * fixed) / 32));

		const ln10 = ln10Fixed(fixed);
		const logBase = logFixed(c, digits - 1, fixed) + BigInt(adjusted) * ln10;
		let exponentLog = logBase * exponent;
		if (exponentE >= 0) exponentLog *= pow10(exponentE);
		else if (-exponentE > digitCount(abs(exponentLog))) exponentLog = 0n;
		else exponentLog /= pow10(-exponentE);
		if (exponentNegative) exponentLog = -exponentLog;

		const tens = exponentLog / ln10;
		if (tens > 6300n) throw overflow();
		if (tens < -6400n) return 0;

		const value = expFixed(exponentLog - tens * ln10, fixed);
		const tolerance = value / pow10(precision) + 1n;
		const resultE = Number(tens) - fixed;
		const low = rounded(false, value - tolerance, resultE);
		const high = rounded(false, value + tolerance, resultE);
		if (low !== undefined && high !== undefined && equals(low, high)) return low;
		if (low === undefined && high === undefined) throw overflow();
	}
}

/**
 * `a ^ b`, correctly rounded. `x ^ 0` is 1, including `0 ^ 0`.
 */
export function pow(a: Num, b: Num): Num {
	if (b === 0 || a === 1) return 1;
	if (b === 1) return a;
	if (b === 2) return mul(a, a);
	if (a === 0) {
		if (isNegative(b)) throw failure('invalid-power', 'Zero to a negative power');
		return 0;
	}

	const integer = isInteger(b);
	const [negative, c, e] = partsOf(a);
	if (negative && !integer) {
		throw failure('invalid-power', 'A negative base needs an integer exponent');
	}
	charge(BIG_STEPS);

	const odd =
		integer && (typeof b === 'number' ? b % 2 !== 0 : b.e === 0 && BigInt(b.c) % 2n !== 0n);
	const result = c === 1n && e === 0 ? 1 : (exactPower(c, e, b) ?? approximatePower(c, e, b));
	return negative && odd ? neg(result) : result;
}
