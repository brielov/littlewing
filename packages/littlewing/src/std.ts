import { prune } from './check/types.js';
import type { FunctionDefinition } from './define.js';
import { defineNative, t } from './define.js';
import { elementOf, integerOf, invalid, sortedPositions } from './functions/core.js';
import { charge, chargeRead } from './limits.js';
import type { Num } from './number.js';
import {
	add,
	compare,
	fromDouble,
	isNegative,
	mul,
	neg,
	parseNumber,
	pow,
	toDouble,
	toText,
} from './number.js';
import { codePoints, failure, OBJECT_STEPS } from './run/values.js';
import type { Value } from './run/values.js';

const NUMBER = /* @__PURE__ */ t.number();
const STRING = /* @__PURE__ */ t.string();
const BOOLEAN = /* @__PURE__ */ t.boolean();
const ORDERED = /* @__PURE__ */ t.class('ordered', 'T');
const ORDERED_LIST = /* @__PURE__ */ t.array(ORDERED);
const EQUATABLE_LIST = /* @__PURE__ */ t.array(/* @__PURE__ */ t.class('equatable', 'T'));
const SIZED = /* @__PURE__ */ t.class('sized', 'S');
const ANY_LIST = /* @__PURE__ */ t.array(/* @__PURE__ */ t.var('T'));
const NESTED_LIST = /* @__PURE__ */ t.array(ANY_LIST);
const NUMBER_LIST = /* @__PURE__ */ t.array(NUMBER);

/** Steps a function through doubles costs, as it converts a number twice. */
const DOUBLE_STEPS = 8;

/**
 * Back from a double. What calls this rules out a result outside the language, and
 * these checks are there so that a mistake fails rather than returns a wrong number.
 */
function fromResult(result: number): Num {
	if (Number.isNaN(result)) throw invalid('This number is outside what the function takes');
	if (!Number.isFinite(result)) throw failure('overflow', 'Number is too large');
	return fromDouble(result);
}

/** A function through doubles, so about 15 digits. */
function viaDouble(fn: (value: number) => number): FunctionDefinition {
	return defineNative({
		args: [NUMBER],
		returns: NUMBER,
		run: ([value]) => {
			charge(DOUBLE_STEPS);
			return fromResult(fn(toDouble(value as Num)));
		},
	});
}

/** `mantissa × 10^exponent`, so that a number too large for a double still has a root. */
function scaled(value: Num): { readonly mantissa: number; readonly exponent: number } {
	const [mantissa = '0', exponent = '0'] = toText(value).split('e');
	return { mantissa: Number(mantissa), exponent: Number(exponent) };
}

/** A logarithm of any number above zero, from that of its mantissa and its exponent. */
function logarithm(fn: (mantissa: number, exponent: number) => number): FunctionDefinition {
	return defineNative({
		args: [NUMBER],
		returns: NUMBER,
		run: ([value]) => {
			charge(DOUBLE_STEPS);
			if (compare(value as Num, 0) <= 0) throw invalid('A logarithm needs a number above zero');
			const { mantissa, exponent } = scaled(value as Num);
			return fromResult(fn(mantissa, exponent));
		},
	});
}

export const ABS: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NUMBER],
	returns: NUMBER,
	run: ([value]) => (isNegative(value as Num) ? neg(value as Num) : value),
});

export const SQRT: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NUMBER],
	returns: NUMBER,
	run: ([value]) => {
		charge(DOUBLE_STEPS);
		if (isNegative(value as Num)) throw invalid('SQRT needs a number that is not negative');
		const { mantissa, exponent } = scaled(value as Num);
		const odd = exponent % 2 !== 0;
		const root = fromResult(Math.sqrt(odd ? mantissa * 10 : mantissa));
		const half = (odd ? exponent - 1 : exponent) / 2;
		return half === 0 ? root : mul(root, parseNumber(`1e${half}`) as Num);
	},
});

export const SIN: FunctionDefinition = /* @__PURE__ */ viaDouble((value) => Math.sin(value));
export const COS: FunctionDefinition = /* @__PURE__ */ viaDouble((value) => Math.cos(value));
export const TAN: FunctionDefinition = /* @__PURE__ */ viaDouble((value) => Math.tan(value));

/** Past this, `e` to a power is below every number the language has. */
const LOWEST_EXPONENT = -20_000;

/** The range of exponents whose powers of `e` a double holds to full precision. */
const LOWEST_DOUBLE_EXPONENT = -708;
const HIGHEST_DOUBLE_EXPONENT = 709;

const E = '2.718281828459045235360287471352662';

export const EXP: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NUMBER],
	returns: NUMBER,
	run: ([value]) => {
		charge(DOUBLE_STEPS);
		const power = value as Num;
		if (compare(power, LOWEST_EXPONENT) < 0) return 0;
		const inDoubles =
			compare(power, LOWEST_DOUBLE_EXPONENT) >= 0 && compare(power, HIGHEST_DOUBLE_EXPONENT) <= 0;
		return inDoubles ? fromResult(Math.exp(toDouble(power))) : pow(parseNumber(E) as Num, power);
	},
});

export const LOG: FunctionDefinition = /* @__PURE__ */ logarithm(
	(mantissa, exponent) => Math.log(mantissa) + exponent * Math.LN10,
);
export const LOG10: FunctionDefinition = /* @__PURE__ */ logarithm(
	(mantissa, exponent) => Math.log10(mantissa) + exponent,
);

export const CLAMP: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NUMBER, NUMBER, NUMBER],
	returns: NUMBER,
	run: ([value, min, max]) => {
		if (compare(min as Num, max as Num) > 0) throw invalid('CLAMP needs min not above max');
		if (compare(value as Num, min as Num) < 0) return min;
		return compare(value as Num, max as Num) > 0 ? max : value;
	},
});

function extreme(direction: 1 | -1): FunctionDefinition {
	return defineNative({
		args: [ORDERED_LIST],
		returns: ORDERED,
		hooks: [0],
		run: ([list], call) => {
			const items = list as readonly Value[];
			if (items.length === 0) throw invalid('An empty array has no extreme');
			const order = call.ops.order(elementOf(call, 0));
			let best = items[0];
			for (let i = 1; i < items.length; i++) {
				charge(1);
				if (order(items[i], best) * direction > 0) best = items[i];
			}
			return best;
		},
	});
}

export const MIN: FunctionDefinition = /* @__PURE__ */ extreme(-1);
export const MAX: FunctionDefinition = /* @__PURE__ */ extreme(1);

export const SUM: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NUMBER_LIST],
	returns: NUMBER,
	run: ([list]) => {
		const items = list as readonly Num[];
		charge(items.length);
		let total: Num = 0;
		for (const item of items) total = add(total, item);
		return total;
	},
});

export const STARTS_WITH: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [STRING, STRING],
	returns: BOOLEAN,
	run: ([text, prefix]) => {
		// Reading any of a string reads all of it, however it was built
		chargeRead((text as string).length + (prefix as string).length);
		return (text as string).startsWith(prefix as string);
	},
});

export const ENDS_WITH: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [STRING, STRING],
	returns: BOOLEAN,
	run: ([text, suffix]) => {
		chargeRead((text as string).length + (suffix as string).length);
		return (text as string).endsWith(suffix as string);
	},
});

export const REPEAT: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [STRING, NUMBER],
	returns: STRING,
	run: ([text, count]) => {
		const times = integerOf(count, 'count');
		if (times < 0) throw invalid('count must not be negative');
		const value = text as string;
		if (value === '') return value;
		charge(value.length * times);
		return value.repeat(times);
	},
});

export const REVERSE: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [SIZED],
	returns: SIZED,
	run: ([value]) => {
		if (typeof value !== 'string') {
			const items = value as readonly Value[];
			charge(items.length + OBJECT_STEPS);
			return items.slice().reverse();
		}
		const points = codePoints(value);
		charge(points.length);
		return Array.from(points).reverse().join('');
	},
});

export const FLAT: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [NESTED_LIST],
	returns: ANY_LIST,
	run: ([list]) => {
		const lists = list as readonly (readonly Value[])[];
		let total = lists.length + OBJECT_STEPS;
		for (const items of lists) total += items.length;
		charge(total);
		return lists.flat();
	},
});

/** Whether values of a type have an order that also says which are equal. */
function isSortable(type: ReturnType<typeof elementOf>): boolean {
	const current = type === undefined ? undefined : prune(type);
	return current?.tag === 'number' || current?.tag === 'string';
}

export const UNIQUE: FunctionDefinition = /* @__PURE__ */ defineNative({
	args: [EQUATABLE_LIST],
	returns: EQUATABLE_LIST,
	hooks: [0],
	run: ([list], call) => {
		const items = list as readonly Value[];
		const { ops } = call;
		const element = elementOf(call, 0);
		const kept: Value[] = [];

		if (isSortable(element)) {
			// Sorting and not hashing, as a program can craft values that hash alike
			const order = ops.order(element);
			const positions = sortedPositions(items, order);
			const repeated = new Uint8Array(items.length);
			for (let i = 1; i < positions.length; i++) {
				const position = positions[i] as number;
				if (order(items[position], items[positions[i - 1] as number]) === 0) repeated[position] = 1;
			}
			charge(items.length + OBJECT_STEPS);
			for (let i = 0; i < items.length; i++) {
				if (repeated[i] === 0) kept.push(items[i]);
			}
			return kept;
		}

		for (const item of items) {
			charge(1);
			if (!kept.some((other) => ops.equal(other, item, element))) kept.push(item);
		}
		return kept;
	},
});
