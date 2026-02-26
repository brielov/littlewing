import type { RuntimeValue } from "../types";
import { assertDateOrDateTime, assertNumber, typeOf } from "../utils";

/**
 * Date utility functions using Temporal.PlainDate and Temporal.PlainDateTime
 * Most functions accept both PlainDate and PlainDateTime, preserving the input type.
 * TODAY() and DATE() remain PlainDate-only constructors.
 */

// ============================================================================
// CORE DATE FUNCTIONS
// ============================================================================

/**
 * Get today's date as a Temporal.PlainDate
 */
export const TODAY = (): RuntimeValue => Temporal.Now.plainDateISO();

/**
 * Create a date from year, month (1-based), and day
 */
export const DATE = (year: RuntimeValue, month: RuntimeValue, day: RuntimeValue): RuntimeValue => {
	assertNumber(year, "DATE", "year");
	assertNumber(month, "DATE", "month");
	assertNumber(day, "DATE", "day");
	return new Temporal.PlainDate(year, month, day);
};

// ============================================================================
// COMPONENT EXTRACTORS
// ============================================================================

/**
 * Get the year from a date or datetime
 */
export const YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "YEAR");
	return date.year;
};

/**
 * Get the month from a date or datetime (1-based: 1 = January, 12 = December)
 */
export const MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "MONTH");
	return date.month;
};

/**
 * Get the day of month from a date or datetime (1-31)
 */
export const DAY = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "DAY");
	return date.day;
};

/**
 * Get the day of week from a date or datetime (1 = Monday, 7 = Sunday)
 */
export const WEEKDAY = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "WEEKDAY");
	return date.dayOfWeek;
};

/**
 * Get the day of year (1-366) from a date or datetime
 */
export const DAY_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "DAY_OF_YEAR");
	return date.dayOfYear;
};

/**
 * Get the quarter (1-4) from a date or datetime
 */
export const QUARTER = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "QUARTER");
	return Math.ceil(date.month / 3);
};

// ============================================================================
// DATE ARITHMETIC
// ============================================================================

/**
 * Add days to a date or datetime, returning the same type
 */
export const ADD_DAYS = (date: RuntimeValue, days: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "ADD_DAYS");
	assertNumber(days, "ADD_DAYS", "days");
	return date.add({ days });
};

/**
 * Add months to a date or datetime, returning the same type
 */
export const ADD_MONTHS = (date: RuntimeValue, months: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "ADD_MONTHS");
	assertNumber(months, "ADD_MONTHS", "months");
	return date.add({ months });
};

/**
 * Add years to a date or datetime, returning the same type
 */
export const ADD_YEARS = (date: RuntimeValue, years: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "ADD_YEARS");
	assertNumber(years, "ADD_YEARS", "years");
	return date.add({ years });
};

// ============================================================================
// DATE DIFFERENCES
// ============================================================================

/**
 * Assert both arguments are the same date-like type (both PlainDate or both PlainDateTime).
 * Mixed date+datetime is a TypeError because Temporal .until() requires matching types.
 */
function assertSameDateType(
	d1: Temporal.PlainDate | Temporal.PlainDateTime,
	d2: RuntimeValue,
	context: string,
): asserts d2 is Temporal.PlainDate | Temporal.PlainDateTime {
	assertDateOrDateTime(d2, context);
	const t1 = typeOf(d1);
	const t2 = typeOf(d2);
	if (t1 !== t2) {
		throw new TypeError(`${context} requires same type, got ${t1} and ${t2}`);
	}
}

/**
 * Get the difference in days between two dates or datetimes (same type required)
 */
export const DIFFERENCE_IN_DAYS = (d1: RuntimeValue, d2: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(d1, "DIFFERENCE_IN_DAYS");
	assertSameDateType(d1, d2, "DIFFERENCE_IN_DAYS");
	if (d1 instanceof Temporal.PlainDate && d2 instanceof Temporal.PlainDate) {
		const duration = d1.until(d2, { largestUnit: "day" });
		return Math.abs(duration.days);
	}
	const dt1 = d1 as Temporal.PlainDateTime;
	const dt2 = d2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "day" });
	return Math.abs(duration.days);
};

/**
 * Get the difference in weeks between two dates or datetimes (same type, whole weeks)
 */
export const DIFFERENCE_IN_WEEKS = (d1: RuntimeValue, d2: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(d1, "DIFFERENCE_IN_WEEKS");
	assertSameDateType(d1, d2, "DIFFERENCE_IN_WEEKS");
	if (d1 instanceof Temporal.PlainDate && d2 instanceof Temporal.PlainDate) {
		const duration = d1.until(d2, { largestUnit: "week" });
		return Math.abs(duration.weeks);
	}
	const dt1 = d1 as Temporal.PlainDateTime;
	const dt2 = d2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "week" });
	return Math.abs(duration.weeks);
};

/**
 * Get the difference in months between two dates or datetimes (same type, whole months)
 */
export const DIFFERENCE_IN_MONTHS = (d1: RuntimeValue, d2: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(d1, "DIFFERENCE_IN_MONTHS");
	assertSameDateType(d1, d2, "DIFFERENCE_IN_MONTHS");
	if (d1 instanceof Temporal.PlainDate && d2 instanceof Temporal.PlainDate) {
		const duration = d1.until(d2, { largestUnit: "month" });
		return Math.abs(duration.months + duration.years * 12);
	}
	const dt1 = d1 as Temporal.PlainDateTime;
	const dt2 = d2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "month" });
	return Math.abs(duration.months + duration.years * 12);
};

/**
 * Get the difference in years between two dates or datetimes (same type, whole years)
 */
export const DIFFERENCE_IN_YEARS = (d1: RuntimeValue, d2: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(d1, "DIFFERENCE_IN_YEARS");
	assertSameDateType(d1, d2, "DIFFERENCE_IN_YEARS");
	if (d1 instanceof Temporal.PlainDate && d2 instanceof Temporal.PlainDate) {
		const duration = d1.until(d2, { largestUnit: "year" });
		return Math.abs(duration.years);
	}
	const dt1 = d1 as Temporal.PlainDateTime;
	const dt2 = d2 as Temporal.PlainDateTime;
	const duration = dt1.until(dt2, { largestUnit: "year" });
	return Math.abs(duration.years);
};

// ============================================================================
// START/END OF PERIOD
// ============================================================================

/**
 * Get the first day of the month for a given date or datetime
 */
export const START_OF_MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "START_OF_MONTH");
	return date.with({ day: 1 });
};

/**
 * Get the last day of the month for a given date or datetime
 */
export const END_OF_MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "END_OF_MONTH");
	return date.with({ day: date.daysInMonth });
};

/**
 * Get the first day of the year for a given date or datetime
 */
export const START_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "START_OF_YEAR");
	return date.with({ month: 1, day: 1 });
};

/**
 * Get the last day of the year for a given date or datetime
 */
export const END_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "END_OF_YEAR");
	return date.with({ month: 12, day: 31 });
};

/**
 * Get the first day of the week (Monday) for a given date or datetime
 */
export const START_OF_WEEK = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "START_OF_WEEK");
	// dayOfWeek: 1=Monday, 7=Sunday
	const daysBack = date.dayOfWeek - 1;
	return date.subtract({ days: daysBack });
};

/**
 * Get the first day of the quarter for a given date or datetime
 */
export const START_OF_QUARTER = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "START_OF_QUARTER");
	const quarterStartMonth = Math.floor((date.month - 1) / 3) * 3 + 1;
	return date.with({ month: quarterStartMonth, day: 1 });
};

// ============================================================================
// DATE COMPARISONS
// ============================================================================

/**
 * Check if two dates/datetimes fall on the same calendar day.
 * For PlainDateTime values, only the date portion is compared.
 * Mixed date+datetime is allowed (datetime is converted to date for comparison).
 */
export const IS_SAME_DAY = (d1: RuntimeValue, d2: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(d1, "IS_SAME_DAY");
	assertDateOrDateTime(d2, "IS_SAME_DAY");
	const date1 = d1 instanceof Temporal.PlainDateTime ? d1.toPlainDate() : d1;
	const date2 = d2 instanceof Temporal.PlainDateTime ? d2.toPlainDate() : d2;
	return date1.equals(date2);
};

/**
 * Check if a date or datetime falls on a weekend (Saturday or Sunday)
 */
export const IS_WEEKEND = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "IS_WEEKEND");
	// dayOfWeek: 1=Mon, ..., 6=Sat, 7=Sun
	return date.dayOfWeek >= 6;
};

/**
 * Check if a date or datetime is in a leap year
 */
export const IS_LEAP_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDateOrDateTime(date, "IS_LEAP_YEAR");
	return date.inLeapYear;
};

/**
 * Calculate age in complete years from a birth date.
 * Accepts PlainDate or PlainDateTime (only the date portion is used).
 * Optional second argument specifies the reference date (defaults to today).
 */
export const AGE = (birthDate: RuntimeValue, ...rest: RuntimeValue[]): RuntimeValue => {
	assertDateOrDateTime(birthDate, "AGE");
	const birth = birthDate instanceof Temporal.PlainDateTime ? birthDate.toPlainDate() : birthDate;

	let reference: Temporal.PlainDate;
	if (rest.length > 0) {
		const ref = rest[0] as RuntimeValue;
		assertDateOrDateTime(ref, "AGE");
		reference = ref instanceof Temporal.PlainDateTime ? ref.toPlainDate() : ref;
	} else {
		reference = Temporal.Now.plainDateISO();
	}

	if (Temporal.PlainDate.compare(birth, reference) > 0) {
		throw new RangeError("AGE requires birth date to be on or before reference date");
	}

	return birth.until(reference, { largestUnit: "year" }).years;
};
