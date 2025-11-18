import type { RuntimeValue } from '../types'

/**
 * Date utility functions for working with timestamps
 * All functions work with milliseconds since Unix epoch (numbers only)
 *
 * IMPORTANT: All functions use local timezone to match the user's context.
 * In a browser, this reflects the user's timezone. On a server, this reflects
 * the server's configured timezone. This ensures date calculations align with
 * the user's calendar expectations.
 */

// ============================================================================
// CORE TIMESTAMP FUNCTIONS
// ============================================================================

/**
 * Get current timestamp (milliseconds since Unix epoch)
 */
export const NOW = (): RuntimeValue => Date.now()

/**
 * Create timestamp from date components (local timezone)
 * Year is required, all other parameters default to minimum values
 * Month is 1-based (1 = January, 12 = December)
 * All parameters are interpreted in local timezone
 */
export const DATE = (
	year: RuntimeValue,
	month = 1,
	day = 1,
	hour = 0,
	minute = 0,
	second = 0,
): RuntimeValue =>
	new Date(year, month - 1, day, hour, minute, second).getTime()

// ============================================================================
// TIME CONVERTERS (to milliseconds)
// ============================================================================

/**
 * Convert days to milliseconds
 */
export const FROM_DAYS = (d: RuntimeValue): RuntimeValue =>
	d * 24 * 60 * 60 * 1000

/**
 * Convert weeks to milliseconds
 */
export const FROM_WEEKS = (w: RuntimeValue): RuntimeValue =>
	w * 7 * 24 * 60 * 60 * 1000

/**
 * Convert months to milliseconds (approximate: 30 days per month)
 * WARNING: This is an approximation. Not all months have 30 days.
 * For accurate month arithmetic, use ADD_MONTHS() instead.
 */
export const FROM_MONTHS = (months: RuntimeValue): RuntimeValue =>
	months * 30 * 24 * 60 * 60 * 1000

/**
 * Convert years to milliseconds (approximate: 365 days per year)
 * WARNING: This is an approximation. Leap years have 366 days.
 * For accurate year arithmetic, use ADD_YEARS() instead.
 */
export const FROM_YEARS = (years: RuntimeValue): RuntimeValue =>
	years * 365 * 24 * 60 * 60 * 1000

// ============================================================================
// COMPONENT EXTRACTORS (from timestamps, local timezone)
// ============================================================================

/**
 * Get the year from a timestamp (local timezone)
 */
export const GET_YEAR = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getFullYear()

/**
 * Get the month from a timestamp (1-based: 1 = January, 12 = December, local timezone)
 */
export const GET_MONTH = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getMonth() + 1

/**
 * Get the day of month from a timestamp (1-31, local timezone)
 */
export const GET_DAY = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getDate()

/**
 * Get the hour from a timestamp (0-23, local timezone)
 */
export const GET_HOUR = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getHours()

/**
 * Get the minute from a timestamp (0-59, local timezone)
 */
export const GET_MINUTE = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getMinutes()

/**
 * Get the second from a timestamp (0-59, local timezone)
 */
export const GET_SECOND = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getSeconds()

/**
 * Get the millisecond component from a timestamp (0-999, local timezone)
 */
export const GET_MILLISECOND = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getMilliseconds()

/**
 * Get the day of week from a timestamp (0 = Sunday, 6 = Saturday, local timezone)
 */
export const GET_WEEKDAY = (timestamp: RuntimeValue): RuntimeValue =>
	new Date(timestamp).getDay()

/**
 * Get the day of year (1-366) from a timestamp (local timezone)
 * January 1st = 1, December 31st = 365 or 366 (leap year)
 */
export const GET_DAY_OF_YEAR = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	const year = date.getFullYear()
	// Start of year in local timezone: January 1st at 00:00:00.000
	const startOfYear = new Date(year, 0, 1).getTime()
	const diff = timestamp - startOfYear
	const oneDay = 86400000 // 24 * 60 * 60 * 1000
	// Add 1 because Jan 1 is day 1, not day 0
	return Math.floor(diff / oneDay) + 1
}

/**
 * Get the quarter (1-4) from a timestamp (local timezone)
 */
export const GET_QUARTER = (timestamp: RuntimeValue): RuntimeValue => {
	const month = new Date(timestamp).getMonth()
	return Math.floor(month / 3) + 1
}

// ============================================================================
// TIME DIFFERENCES (always positive, whole units)
// ============================================================================

/**
 * Get the absolute difference between two timestamps in seconds (whole seconds)
 */
export const DIFFERENCE_IN_SECONDS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => Math.ceil(Math.abs(ts1 - ts2) / 1000)

/**
 * Get the absolute difference between two timestamps in minutes (whole minutes)
 */
export const DIFFERENCE_IN_MINUTES = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => Math.ceil(Math.abs(ts1 - ts2) / (60 * 1000))

/**
 * Get the absolute difference between two timestamps in hours (whole hours)
 */
export const DIFFERENCE_IN_HOURS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => Math.ceil(Math.abs(ts1 - ts2) / (60 * 60 * 1000))

/**
 * Get the difference in calendar days between two timestamps
 * Counts the number of calendar day boundaries crossed, not 24-hour periods
 * Example: Nov 7 at 11:59 PM to Nov 8 at 12:01 AM = 1 day (different calendar days)
 */
export const DIFFERENCE_IN_DAYS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => {
	// Normalize both timestamps to start of their respective days
	const day1 = START_OF_DAY(ts1)
	const day2 = START_OF_DAY(ts2)
	// Now calculate the difference in whole days
	return Math.floor(Math.abs(day1 - day2) / (24 * 60 * 60 * 1000))
}

/**
 * Get the difference in calendar weeks between two timestamps
 * Counts the number of week boundaries crossed (based on calendar days)
 */
export const DIFFERENCE_IN_WEEKS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => {
	const days = DIFFERENCE_IN_DAYS(ts1, ts2)
	return Math.floor(days / 7)
}

/**
 * Get the number of full calendar months between two timestamps (local timezone)
 * Counts complete months where the same day-of-month has been reached
 *
 * Examples:
 *   Jan 15 → Feb 14 = 0 months (Feb 15 not reached yet)
 *   Jan 15 → Feb 15 = 1 month
 *   Jan 31 → Feb 28 = 0 months (Feb 31 doesn't exist)
 *   Jan 31 → Mar 31 = 2 months
 */
export const DIFFERENCE_IN_MONTHS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => {
	const smaller = Math.min(ts1, ts2)
	const larger = Math.max(ts1, ts2)

	const date1 = new Date(smaller)
	const date2 = new Date(larger)

	const yearDiff = date2.getFullYear() - date1.getFullYear()
	const monthDiff = date2.getMonth() - date1.getMonth()

	let months = yearDiff * 12 + monthDiff

	// Adjust if we haven't reached the same day-of-month yet
	if (date2.getDate() < date1.getDate()) {
		months--
	}

	return months
}

/**
 * Get the number of full calendar years between two timestamps (local timezone)
 * Counts complete years where the same month and day have been reached
 *
 * Examples:
 *   Jan 15, 2020 → Jan 14, 2021 = 0 years (Jan 15 not reached)
 *   Jan 15, 2020 → Jan 15, 2021 = 1 year
 *   Feb 29, 2020 → Feb 28, 2021 = 0 years (Feb 29 doesn't exist)
 *   Feb 29, 2020 → Mar 1, 2021 = 1 year
 */
export const DIFFERENCE_IN_YEARS = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => {
	return Math.floor(DIFFERENCE_IN_MONTHS(ts1, ts2) / 12)
}

// ============================================================================
// START/END OF PERIOD FUNCTIONS (local timezone)
// ============================================================================

/**
 * Get the start of day (00:00:00.000 local time) for a given timestamp
 */
export const START_OF_DAY = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		0,
		0,
		0,
		0,
	).getTime()
}

/**
 * Get the end of day (23:59:59.999 local time) for a given timestamp
 */
export const END_OF_DAY = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		23,
		59,
		59,
		999,
	).getTime()
}

/**
 * Get the start of week (Sunday at 00:00:00.000 local time) for a given timestamp
 */
export const START_OF_WEEK = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
	const currentDay = date.getDate()
	const startDay = currentDay - dayOfWeek
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		startDay,
		0,
		0,
		0,
		0,
	).getTime()
}

/**
 * Get the start of month (1st day at 00:00:00.000 local time) for a given timestamp
 */
export const START_OF_MONTH = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()
}

/**
 * Get the end of month (last day at 23:59:59.999 local time) for a given timestamp
 */
export const END_OF_MONTH = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	// Setting day to 0 of next month gives last day of current month
	return new Date(
		date.getFullYear(),
		date.getMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	).getTime()
}

/**
 * Get the start of year (Jan 1st at 00:00:00.000 local time) for a given timestamp
 */
export const START_OF_YEAR = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()
}

/**
 * Get the end of year (Dec 31st at 23:59:59.999 local time) for a given timestamp
 */
export const END_OF_YEAR = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999).getTime()
}

// ============================================================================
// DATE ARITHMETIC FUNCTIONS (local timezone)
// ============================================================================

/**
 * Add days to a timestamp (local timezone)
 */
export const ADD_DAYS = (
	timestamp: RuntimeValue,
	days: RuntimeValue,
): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate() + days,
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds(),
	).getTime()
}

/**
 * Add months to a timestamp (handles variable month lengths correctly, local timezone)
 */
export const ADD_MONTHS = (
	timestamp: RuntimeValue,
	months: RuntimeValue,
): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(
		date.getFullYear(),
		date.getMonth() + months,
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds(),
	).getTime()
}

/**
 * Add years to a timestamp (local timezone)
 */
export const ADD_YEARS = (
	timestamp: RuntimeValue,
	years: RuntimeValue,
): RuntimeValue => {
	const date = new Date(timestamp)
	return new Date(
		date.getFullYear() + years,
		date.getMonth(),
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds(),
	).getTime()
}

// ============================================================================
// DATE COMPARISON/VALIDATION FUNCTIONS (local timezone)
// ============================================================================

/**
 * Check if two timestamps are on the same calendar day (local timezone)
 * Returns 1 if true, 0 if false
 */
export const IS_SAME_DAY = (
	ts1: RuntimeValue,
	ts2: RuntimeValue,
): RuntimeValue => {
	const date1 = new Date(ts1)
	const date2 = new Date(ts2)
	return date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
		? 1
		: 0
}

/**
 * Check if timestamp falls on a weekend (Saturday or Sunday, local timezone)
 * Returns 1 if true, 0 if false
 */
export const IS_WEEKEND = (timestamp: RuntimeValue): RuntimeValue => {
	const day = new Date(timestamp).getDay()
	return day === 0 || day === 6 ? 1 : 0
}

/**
 * Check if timestamp is in a leap year (local timezone)
 * Returns 1 if true, 0 if false
 */
export const IS_LEAP_YEAR = (timestamp: RuntimeValue): RuntimeValue => {
	const year = new Date(timestamp).getFullYear()
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 1 : 0
}

/**
 * Get the start of quarter for a given timestamp (local timezone)
 */
export const START_OF_QUARTER = (timestamp: RuntimeValue): RuntimeValue => {
	const date = new Date(timestamp)
	const month = date.getMonth()
	const quarterStartMonth = Math.floor(month / 3) * 3
	return new Date(
		date.getFullYear(),
		quarterStartMonth,
		1,
		0,
		0,
		0,
		0,
	).getTime()
}
