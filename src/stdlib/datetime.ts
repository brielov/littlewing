import { Temporal } from 'temporal-polyfill'
import type { RuntimeValue } from '../types'
import { assertDate, assertNumber } from '../utils'

/**
 * Date utility functions using Temporal.PlainDate
 * All date functions operate on Temporal.PlainDate values (no time, no timezone)
 */

// ============================================================================
// CORE DATE FUNCTIONS
// ============================================================================

/**
 * Get today's date as a Temporal.PlainDate
 */
export const TODAY = (): RuntimeValue => Temporal.Now.plainDateISO()

/**
 * Create a date from year, month (1-based), and day
 */
export const DATE = (
	year: RuntimeValue,
	month: RuntimeValue,
	day: RuntimeValue,
): RuntimeValue => {
	assertNumber(year, 'DATE', 'year')
	assertNumber(month, 'DATE', 'month')
	assertNumber(day, 'DATE', 'day')
	return new Temporal.PlainDate(year, month, day)
}

// ============================================================================
// COMPONENT EXTRACTORS
// ============================================================================

/**
 * Get the year from a date
 */
export const GET_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_YEAR')
	return date.year
}

/**
 * Get the month from a date (1-based: 1 = January, 12 = December)
 */
export const GET_MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_MONTH')
	return date.month
}

/**
 * Get the day of month from a date (1-31)
 */
export const GET_DAY = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_DAY')
	return date.day
}

/**
 * Get the day of week from a date (1 = Monday, 7 = Sunday)
 */
export const GET_WEEKDAY = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_WEEKDAY')
	return date.dayOfWeek
}

/**
 * Get the day of year (1-366) from a date
 */
export const GET_DAY_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_DAY_OF_YEAR')
	return date.dayOfYear
}

/**
 * Get the quarter (1-4) from a date
 */
export const GET_QUARTER = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'GET_QUARTER')
	return Math.ceil(date.month / 3)
}

// ============================================================================
// DATE ARITHMETIC
// ============================================================================

/**
 * Add days to a date, returning a new date
 */
export const ADD_DAYS = (
	date: RuntimeValue,
	days: RuntimeValue,
): RuntimeValue => {
	assertDate(date, 'ADD_DAYS')
	assertNumber(days, 'ADD_DAYS', 'days')
	return date.add({ days })
}

/**
 * Add months to a date, returning a new date
 */
export const ADD_MONTHS = (
	date: RuntimeValue,
	months: RuntimeValue,
): RuntimeValue => {
	assertDate(date, 'ADD_MONTHS')
	assertNumber(months, 'ADD_MONTHS', 'months')
	return date.add({ months })
}

/**
 * Add years to a date, returning a new date
 */
export const ADD_YEARS = (
	date: RuntimeValue,
	years: RuntimeValue,
): RuntimeValue => {
	assertDate(date, 'ADD_YEARS')
	assertNumber(years, 'ADD_YEARS', 'years')
	return date.add({ years })
}

// ============================================================================
// DATE DIFFERENCES
// ============================================================================

/**
 * Get the difference in days between two dates
 */
export const DIFFERENCE_IN_DAYS = (
	d1: RuntimeValue,
	d2: RuntimeValue,
): RuntimeValue => {
	assertDate(d1, 'DIFFERENCE_IN_DAYS')
	assertDate(d2, 'DIFFERENCE_IN_DAYS')
	const duration = d1.until(d2, { largestUnit: 'day' })
	return Math.abs(duration.days)
}

/**
 * Get the difference in weeks between two dates (whole weeks)
 */
export const DIFFERENCE_IN_WEEKS = (
	d1: RuntimeValue,
	d2: RuntimeValue,
): RuntimeValue => {
	assertDate(d1, 'DIFFERENCE_IN_WEEKS')
	assertDate(d2, 'DIFFERENCE_IN_WEEKS')
	const duration = d1.until(d2, { largestUnit: 'week' })
	return Math.abs(duration.weeks)
}

/**
 * Get the difference in months between two dates (whole months)
 */
export const DIFFERENCE_IN_MONTHS = (
	d1: RuntimeValue,
	d2: RuntimeValue,
): RuntimeValue => {
	assertDate(d1, 'DIFFERENCE_IN_MONTHS')
	assertDate(d2, 'DIFFERENCE_IN_MONTHS')
	const duration = d1.until(d2, { largestUnit: 'month' })
	return Math.abs(duration.months + duration.years * 12)
}

/**
 * Get the difference in years between two dates (whole years)
 */
export const DIFFERENCE_IN_YEARS = (
	d1: RuntimeValue,
	d2: RuntimeValue,
): RuntimeValue => {
	assertDate(d1, 'DIFFERENCE_IN_YEARS')
	assertDate(d2, 'DIFFERENCE_IN_YEARS')
	const duration = d1.until(d2, { largestUnit: 'year' })
	return Math.abs(duration.years)
}

// ============================================================================
// START/END OF PERIOD
// ============================================================================

/**
 * Get the first day of the month for a given date
 */
export const START_OF_MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'START_OF_MONTH')
	return date.with({ day: 1 })
}

/**
 * Get the last day of the month for a given date
 */
export const END_OF_MONTH = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'END_OF_MONTH')
	return date.with({ day: date.daysInMonth })
}

/**
 * Get the first day of the year for a given date
 */
export const START_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'START_OF_YEAR')
	return date.with({ month: 1, day: 1 })
}

/**
 * Get the last day of the year for a given date
 */
export const END_OF_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'END_OF_YEAR')
	return date.with({ month: 12, day: 31 })
}

/**
 * Get the first day of the week (Monday) for a given date
 */
export const START_OF_WEEK = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'START_OF_WEEK')
	// dayOfWeek: 1=Monday, 7=Sunday
	const daysBack = date.dayOfWeek - 1
	return date.subtract({ days: daysBack })
}

/**
 * Get the first day of the quarter for a given date
 */
export const START_OF_QUARTER = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'START_OF_QUARTER')
	const quarterStartMonth = Math.floor((date.month - 1) / 3) * 3 + 1
	return date.with({ month: quarterStartMonth, day: 1 })
}

// ============================================================================
// DATE COMPARISONS
// ============================================================================

/**
 * Check if two dates are the same day
 * Returns boolean
 */
export const IS_SAME_DAY = (
	d1: RuntimeValue,
	d2: RuntimeValue,
): RuntimeValue => {
	assertDate(d1, 'IS_SAME_DAY')
	assertDate(d2, 'IS_SAME_DAY')
	return d1.equals(d2)
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 * Returns boolean
 */
export const IS_WEEKEND = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'IS_WEEKEND')
	// dayOfWeek: 1=Mon, ..., 6=Sat, 7=Sun
	return date.dayOfWeek >= 6
}

/**
 * Check if a date is in a leap year
 * Returns boolean
 */
export const IS_LEAP_YEAR = (date: RuntimeValue): RuntimeValue => {
	assertDate(date, 'IS_LEAP_YEAR')
	return date.inLeapYear
}
