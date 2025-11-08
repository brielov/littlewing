/**
 * Date utility functions for working with timestamps
 * All functions work with milliseconds since Unix epoch (numbers only)
 *
 * IMPORTANT: All functions use UTC timezone for consistency and predictability
 * across different server environments. This ensures the same inputs always
 * produce the same outputs regardless of the machine's local timezone.
 */

// ============================================================================
// CORE TIMESTAMP FUNCTIONS
// ============================================================================

/**
 * Get current timestamp (milliseconds since Unix epoch)
 */
export const NOW = (): number => Date.now()

/**
 * Create timestamp from date components (UTC timezone)
 * Year is required, all other parameters default to minimum values
 * Month is 1-based (1 = January, 12 = December)
 * All parameters are interpreted in UTC timezone for consistency
 */
export const DATE = (
	year: number,
	month = 1,
	day = 1,
	hour = 0,
	minute = 0,
	second = 0,
): number => Date.UTC(year, month - 1, day, hour, minute, second)

// ============================================================================
// TIME CONVERTERS (to milliseconds)
// ============================================================================

/**
 * Convert days to milliseconds
 */
export const FROM_DAYS = (d: number): number => d * 24 * 60 * 60 * 1000

/**
 * Convert weeks to milliseconds
 */
export const FROM_WEEKS = (w: number): number => w * 7 * 24 * 60 * 60 * 1000

/**
 * Convert months to milliseconds (approximate: 30 days per month)
 * WARNING: This is an approximation. Not all months have 30 days.
 * For accurate month arithmetic, use ADD_MONTHS() instead.
 */
export const FROM_MONTHS = (months: number): number =>
	months * 30 * 24 * 60 * 60 * 1000

/**
 * Convert years to milliseconds (approximate: 365 days per year)
 * WARNING: This is an approximation. Leap years have 366 days.
 * For accurate year arithmetic, use ADD_YEARS() instead.
 */
export const FROM_YEARS = (years: number): number =>
	years * 365 * 24 * 60 * 60 * 1000

// ============================================================================
// COMPONENT EXTRACTORS (from timestamps, UTC timezone)
// ============================================================================

/**
 * Get the year from a timestamp (UTC)
 */
export const GET_YEAR = (timestamp: number): number =>
	new Date(timestamp).getUTCFullYear()

/**
 * Get the month from a timestamp (1-based: 1 = January, 12 = December, UTC)
 */
export const GET_MONTH = (timestamp: number): number =>
	new Date(timestamp).getUTCMonth() + 1

/**
 * Get the day of month from a timestamp (1-31, UTC)
 */
export const GET_DAY = (timestamp: number): number =>
	new Date(timestamp).getUTCDate()

/**
 * Get the hour from a timestamp (0-23, UTC)
 */
export const GET_HOUR = (timestamp: number): number =>
	new Date(timestamp).getUTCHours()

/**
 * Get the minute from a timestamp (0-59, UTC)
 */
export const GET_MINUTE = (timestamp: number): number =>
	new Date(timestamp).getUTCMinutes()

/**
 * Get the second from a timestamp (0-59, UTC)
 */
export const GET_SECOND = (timestamp: number): number =>
	new Date(timestamp).getUTCSeconds()

/**
 * Get the millisecond component from a timestamp (0-999, UTC)
 */
export const GET_MILLISECOND = (timestamp: number): number =>
	new Date(timestamp).getUTCMilliseconds()

/**
 * Get the day of week from a timestamp (0 = Sunday, 6 = Saturday, UTC)
 */
export const GET_WEEKDAY = (timestamp: number): number =>
	new Date(timestamp).getUTCDay()

/**
 * Get the day of year (1-366) from a timestamp (UTC)
 * January 1st = 1, December 31st = 365 or 366 (leap year)
 */
export const GET_DAY_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	const year = date.getUTCFullYear()
	// Start of year in UTC: January 1st at 00:00:00.000
	const startOfYear = Date.UTC(year, 0, 1)
	const diff = timestamp - startOfYear
	const oneDay = 86400000 // 24 * 60 * 60 * 1000
	// Add 1 because Jan 1 is day 1, not day 0
	return Math.floor(diff / oneDay) + 1
}

/**
 * Get the quarter (1-4) from a timestamp (UTC)
 */
export const GET_QUARTER = (timestamp: number): number => {
	const month = new Date(timestamp).getUTCMonth()
	return Math.floor(month / 3) + 1
}

// ============================================================================
// TIME DIFFERENCES (always positive, whole units)
// ============================================================================

/**
 * Get the absolute difference between two timestamps in seconds (whole seconds)
 */
export const DIFFERENCE_IN_SECONDS = (ts1: number, ts2: number): number =>
	Math.floor(Math.abs(ts1 - ts2) / 1000)

/**
 * Get the absolute difference between two timestamps in minutes (whole minutes)
 */
export const DIFFERENCE_IN_MINUTES = (ts1: number, ts2: number): number =>
	Math.floor(Math.abs(ts1 - ts2) / (60 * 1000))

/**
 * Get the absolute difference between two timestamps in hours (whole hours)
 */
export const DIFFERENCE_IN_HOURS = (ts1: number, ts2: number): number =>
	Math.floor(Math.abs(ts1 - ts2) / (60 * 60 * 1000))

/**
 * Get the absolute difference between two timestamps in days (whole days)
 */
export const DIFFERENCE_IN_DAYS = (ts1: number, ts2: number): number =>
	Math.floor(Math.abs(ts1 - ts2) / (24 * 60 * 60 * 1000))

/**
 * Get the absolute difference between two timestamps in weeks (whole weeks)
 */
export const DIFFERENCE_IN_WEEKS = (ts1: number, ts2: number): number =>
	Math.floor(Math.abs(ts1 - ts2) / (7 * 24 * 60 * 60 * 1000))

/**
 * Get the number of full calendar months between two timestamps (UTC)
 * Counts complete months where the same day-of-month has been reached
 *
 * Examples:
 *   Jan 15 → Feb 14 = 0 months (Feb 15 not reached yet)
 *   Jan 15 → Feb 15 = 1 month
 *   Jan 31 → Feb 28 = 0 months (Feb 31 doesn't exist)
 *   Jan 31 → Mar 31 = 2 months
 */
export const DIFFERENCE_IN_MONTHS = (ts1: number, ts2: number): number => {
	const smaller = Math.min(ts1, ts2)
	const larger = Math.max(ts1, ts2)

	const date1 = new Date(smaller)
	const date2 = new Date(larger)

	const yearDiff = date2.getUTCFullYear() - date1.getUTCFullYear()
	const monthDiff = date2.getUTCMonth() - date1.getUTCMonth()

	let months = yearDiff * 12 + monthDiff

	// Adjust if we haven't reached the same day-of-month yet
	if (date2.getUTCDate() < date1.getUTCDate()) {
		months--
	}

	return months
}

/**
 * Get the number of full calendar years between two timestamps (UTC)
 * Counts complete years where the same month and day have been reached
 *
 * Examples:
 *   Jan 15, 2020 → Jan 14, 2021 = 0 years (Jan 15 not reached)
 *   Jan 15, 2020 → Jan 15, 2021 = 1 year
 *   Feb 29, 2020 → Feb 28, 2021 = 0 years (Feb 29 doesn't exist)
 *   Feb 29, 2020 → Mar 1, 2021 = 1 year
 */
export const DIFFERENCE_IN_YEARS = (ts1: number, ts2: number): number => {
	return Math.floor(DIFFERENCE_IN_MONTHS(ts1, ts2) / 12)
}

// ============================================================================
// START/END OF PERIOD FUNCTIONS (UTC timezone)
// ============================================================================

/**
 * Get the start of day (00:00:00.000 UTC) for a given timestamp
 */
export const START_OF_DAY = (timestamp: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
		0,
		0,
		0,
		0,
	)
}

/**
 * Get the end of day (23:59:59.999 UTC) for a given timestamp
 */
export const END_OF_DAY = (timestamp: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
		23,
		59,
		59,
		999,
	)
}

/**
 * Get the start of week (Sunday at 00:00:00.000 UTC) for a given timestamp
 */
export const START_OF_WEEK = (timestamp: number): number => {
	const date = new Date(timestamp)
	const dayOfWeek = date.getUTCDay() // 0 = Sunday, 6 = Saturday
	const currentDay = date.getUTCDate()
	const startDay = currentDay - dayOfWeek
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		startDay,
		0,
		0,
		0,
		0,
	)
}

/**
 * Get the start of month (1st day at 00:00:00.000 UTC) for a given timestamp
 */
export const START_OF_MONTH = (timestamp: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
}

/**
 * Get the end of month (last day at 23:59:59.999 UTC) for a given timestamp
 */
export const END_OF_MONTH = (timestamp: number): number => {
	const date = new Date(timestamp)
	// Setting day to 0 of next month gives last day of current month
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	)
}

/**
 * Get the start of year (Jan 1st at 00:00:00.000 UTC) for a given timestamp
 */
export const START_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0)
}

/**
 * Get the end of year (Dec 31st at 23:59:59.999 UTC) for a given timestamp
 */
export const END_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999)
}

// ============================================================================
// DATE ARITHMETIC FUNCTIONS (UTC timezone)
// ============================================================================

/**
 * Add days to a timestamp (UTC)
 */
export const ADD_DAYS = (timestamp: number, days: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate() + days,
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds(),
	)
}

/**
 * Add months to a timestamp (handles variable month lengths correctly, UTC)
 */
export const ADD_MONTHS = (timestamp: number, months: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth() + months,
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds(),
	)
}

/**
 * Add years to a timestamp (UTC)
 */
export const ADD_YEARS = (timestamp: number, years: number): number => {
	const date = new Date(timestamp)
	return Date.UTC(
		date.getUTCFullYear() + years,
		date.getUTCMonth(),
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds(),
	)
}

// ============================================================================
// DATE COMPARISON/VALIDATION FUNCTIONS (UTC timezone)
// ============================================================================

/**
 * Check if two timestamps are on the same calendar day (UTC)
 * Returns 1 if true, 0 if false
 */
export const IS_SAME_DAY = (ts1: number, ts2: number): number => {
	const date1 = new Date(ts1)
	const date2 = new Date(ts2)
	return date1.getUTCFullYear() === date2.getUTCFullYear() &&
		date1.getUTCMonth() === date2.getUTCMonth() &&
		date1.getUTCDate() === date2.getUTCDate()
		? 1
		: 0
}

/**
 * Check if timestamp falls on a weekend (Saturday or Sunday, UTC)
 * Returns 1 if true, 0 if false
 */
export const IS_WEEKEND = (timestamp: number): number => {
	const day = new Date(timestamp).getUTCDay()
	return day === 0 || day === 6 ? 1 : 0
}

/**
 * Check if timestamp is in a leap year (UTC)
 * Returns 1 if true, 0 if false
 */
export const IS_LEAP_YEAR = (timestamp: number): number => {
	const year = new Date(timestamp).getUTCFullYear()
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 1 : 0
}

/**
 * Get the start of quarter for a given timestamp (UTC)
 */
export const START_OF_QUARTER = (timestamp: number): number => {
	const date = new Date(timestamp)
	const month = date.getUTCMonth()
	const quarterStartMonth = Math.floor(month / 3) * 3
	return Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1, 0, 0, 0, 0)
}
