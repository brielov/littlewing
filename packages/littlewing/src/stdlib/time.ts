import type { RuntimeValue } from "../types";
import { assertNumber, assertTimeOrDateTime, typeOf } from "../utils";

/**
 * Time utility functions using Temporal.PlainTime and Temporal.PlainDateTime
 * Extractor and arithmetic functions accept both PlainTime and PlainDateTime.
 * Difference functions require both arguments to be the same type.
 */

// ============================================================================
// CORE TIME FUNCTIONS
// ============================================================================

/**
 * Create a PlainTime from hour, minute, and second
 */
export const TIME = (
	hour: RuntimeValue,
	minute: RuntimeValue,
	second: RuntimeValue,
): RuntimeValue => {
	assertNumber(hour, "TIME", "hour");
	assertNumber(minute, "TIME", "minute");
	assertNumber(second, "TIME", "second");
	return new Temporal.PlainTime(hour, minute, second);
};

/**
 * Get the current wall-clock time as a PlainTime
 */
export const NOW_TIME = (): RuntimeValue => Temporal.Now.plainTimeISO();

// ============================================================================
// COMPONENT EXTRACTORS
// ============================================================================

/**
 * Get the hour (0-23) from a time or datetime
 */
export const GET_HOUR = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "GET_HOUR");
	return t.hour;
};

/**
 * Get the minute (0-59) from a time or datetime
 */
export const GET_MINUTE = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "GET_MINUTE");
	return t.minute;
};

/**
 * Get the second (0-59) from a time or datetime
 */
export const GET_SECOND = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "GET_SECOND");
	return t.second;
};

/**
 * Get the millisecond (0-999) from a time or datetime
 */
export const GET_MILLISECOND = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "GET_MILLISECOND");
	return t.millisecond;
};

// ============================================================================
// TIME ARITHMETIC
// ============================================================================

/**
 * Add hours to a time or datetime.
 * PlainTime wraps around at midnight boundaries.
 */
export const ADD_HOURS = (t: RuntimeValue, hours: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "ADD_HOURS");
	assertNumber(hours, "ADD_HOURS", "hours");
	return t.add({ hours });
};

/**
 * Add minutes to a time or datetime.
 * PlainTime wraps around at midnight boundaries.
 */
export const ADD_MINUTES = (t: RuntimeValue, minutes: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "ADD_MINUTES");
	assertNumber(minutes, "ADD_MINUTES", "minutes");
	return t.add({ minutes });
};

/**
 * Add seconds to a time or datetime.
 * PlainTime wraps around at midnight boundaries.
 */
export const ADD_SECONDS = (t: RuntimeValue, seconds: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, "ADD_SECONDS");
	assertNumber(seconds, "ADD_SECONDS", "seconds");
	return t.add({ seconds });
};

// ============================================================================
// TIME DIFFERENCES
// ============================================================================

/**
 * Assert both arguments are the same time-like type (both PlainTime or both PlainDateTime).
 * Mixed time+datetime is a TypeError because Temporal .until() requires matching types.
 */
function assertSameTimeType(
	t1: Temporal.PlainTime | Temporal.PlainDateTime,
	t2: RuntimeValue,
	context: string,
): asserts t2 is Temporal.PlainTime | Temporal.PlainDateTime {
	assertTimeOrDateTime(t2, context);
	const type1 = typeOf(t1);
	const type2 = typeOf(t2);
	if (type1 !== type2) {
		throw new TypeError(`${context} requires same type, got ${type1} and ${type2}`);
	}
}

/**
 * Get the absolute difference in hours between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_HOURS = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t1, "DIFFERENCE_IN_HOURS");
	assertSameTimeType(t1, t2, "DIFFERENCE_IN_HOURS");
	if (t1 instanceof Temporal.PlainTime && t2 instanceof Temporal.PlainTime) {
		const duration = t1.until(t2, { largestUnit: "hour" });
		return Math.abs(duration.hours);
	}
	const dt1 = t1 as Temporal.PlainDateTime;
	const dt2 = t2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "hour" });
	return Math.abs(duration.hours);
};

/**
 * Get the absolute difference in minutes between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_MINUTES = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t1, "DIFFERENCE_IN_MINUTES");
	assertSameTimeType(t1, t2, "DIFFERENCE_IN_MINUTES");
	if (t1 instanceof Temporal.PlainTime && t2 instanceof Temporal.PlainTime) {
		const duration = t1.until(t2, { largestUnit: "minute" });
		return Math.abs(duration.minutes);
	}
	const dt1 = t1 as Temporal.PlainDateTime;
	const dt2 = t2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "minute" });
	return Math.abs(duration.minutes);
};

/**
 * Get the absolute difference in seconds between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_SECONDS = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t1, "DIFFERENCE_IN_SECONDS");
	assertSameTimeType(t1, t2, "DIFFERENCE_IN_SECONDS");
	if (t1 instanceof Temporal.PlainTime && t2 instanceof Temporal.PlainTime) {
		const duration = t1.until(t2, { largestUnit: "second" });
		return Math.abs(duration.seconds);
	}
	const dt1 = t1 as Temporal.PlainDateTime;
	const dt2 = t2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "second" });
	return Math.abs(duration.seconds);
};

// ============================================================================
// TIME COMPARISONS
// ============================================================================

/**
 * Check if two times/datetimes have the same time-of-day.
 * For PlainDateTime values, only the time portion is compared.
 * Mixed time+datetime is allowed (datetime is converted to time for comparison).
 */
export const IS_SAME_TIME = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t1, "IS_SAME_TIME");
	assertTimeOrDateTime(t2, "IS_SAME_TIME");
	const time1 = t1 instanceof Temporal.PlainDateTime ? t1.toPlainTime() : t1;
	const time2 = t2 instanceof Temporal.PlainDateTime ? t2.toPlainTime() : t2;
	return time1.equals(time2);
};
