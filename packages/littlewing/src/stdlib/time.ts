import { CLOCK_STEPS, charge } from '../limits.js';
import type { RuntimeValue } from '../types.js';
import { assertInteger, assertTimeOrDateTime, temporalDifference } from '../utils.js';

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
	assertInteger(hour, 'TIME', 'hour');
	assertInteger(minute, 'TIME', 'minute');
	assertInteger(second, 'TIME', 'second');
	return new Temporal.PlainTime(hour, minute, second);
};

/**
 * Get the current wall-clock time as a PlainTime
 */
export const NOW_TIME = (): RuntimeValue => {
	charge(CLOCK_STEPS);
	return Temporal.Now.plainTimeISO();
};

// ============================================================================
// COMPONENT EXTRACTORS
// ============================================================================

/**
 * Get the hour (0-23) from a time or datetime
 */
export const HOUR = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'HOUR');
	return t.hour;
};

/**
 * Get the minute (0-59) from a time or datetime
 */
export const MINUTE = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'MINUTE');
	return t.minute;
};

/**
 * Get the second (0-59) from a time or datetime
 */
export const SECOND = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'SECOND');
	return t.second;
};

/**
 * Get the millisecond (0-999) from a time or datetime
 */
export const MILLISECOND = (t: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'MILLISECOND');
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
	assertTimeOrDateTime(t, 'ADD_HOURS');
	assertInteger(hours, 'ADD_HOURS', 'hours');
	return t.add({ hours });
};

/**
 * Add minutes to a time or datetime.
 * PlainTime wraps around at midnight boundaries.
 */
export const ADD_MINUTES = (t: RuntimeValue, minutes: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'ADD_MINUTES');
	assertInteger(minutes, 'ADD_MINUTES', 'minutes');
	return t.add({ minutes });
};

/**
 * Add seconds to a time or datetime.
 * PlainTime wraps around at midnight boundaries.
 */
export const ADD_SECONDS = (t: RuntimeValue, seconds: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t, 'ADD_SECONDS');
	assertInteger(seconds, 'ADD_SECONDS', 'seconds');
	return t.add({ seconds });
};

// ============================================================================
// TIME DIFFERENCES
// ============================================================================

/**
 * Get the absolute difference between two times or datetimes in whole units.
 */
function difference(
	context: string,
	unit: 'hour' | 'minute' | 'second',
	t1: RuntimeValue,
	t2: RuntimeValue,
): number {
	assertTimeOrDateTime(t1, context);
	assertTimeOrDateTime(t2, context);
	return temporalDifference(t1, t2, unit, context);
}

/**
 * Get the absolute difference in hours between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_HOURS = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue =>
	difference('DIFFERENCE_IN_HOURS', 'hour', t1, t2);

/**
 * Get the absolute difference in minutes between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_MINUTES = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue =>
	difference('DIFFERENCE_IN_MINUTES', 'minute', t1, t2);

/**
 * Get the absolute difference in seconds between two times or datetimes (same type required)
 */
export const DIFFERENCE_IN_SECONDS = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue =>
	difference('DIFFERENCE_IN_SECONDS', 'second', t1, t2);

// ============================================================================
// TIME COMPARISONS
// ============================================================================

/**
 * Check if two times/datetimes have the same time-of-day.
 * For PlainDateTime values, only the time portion is compared.
 * Mixed time+datetime is allowed (datetime is converted to time for comparison).
 */
export const IS_SAME_TIME = (t1: RuntimeValue, t2: RuntimeValue): RuntimeValue => {
	assertTimeOrDateTime(t1, 'IS_SAME_TIME');
	assertTimeOrDateTime(t2, 'IS_SAME_TIME');
	const time1 = t1 instanceof Temporal.PlainDateTime ? t1.toPlainTime() : t1;
	const time2 = t2 instanceof Temporal.PlainDateTime ? t2.toPlainTime() : t2;
	return time1.equals(time2);
};
