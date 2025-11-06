/**
 * Date utility functions for working with timestamps
 * All functions work with milliseconds since Unix epoch (numbers only)
 */

// ============================================================================
// CORE TIMESTAMP FUNCTIONS
// ============================================================================

/**
 * Get current timestamp (milliseconds since Unix epoch)
 */
export const NOW = (): number => Date.now()

/**
 * Create timestamp from date components
 * Year is required, all other parameters default to minimum values
 * Month is 1-based (1 = January, 12 = December)
 */
export const DATE = (
	year: number,
	month = 1,
	day = 1,
	hour = 0,
	minute = 0,
	second = 0,
): number => new Date(year, month - 1, day, hour, minute, second).getTime()

// ============================================================================
// TIME CONVERTERS (to milliseconds)
// ============================================================================

/**
 * Convert seconds to milliseconds
 */
export const FROM_SECONDS = (s: number): number => s * 1000

/**
 * Convert minutes to milliseconds
 */
export const FROM_MINUTES = (m: number): number => m * 60 * 1000

/**
 * Convert hours to milliseconds
 */
export const FROM_HOURS = (h: number): number => h * 60 * 60 * 1000

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
 */
export const FROM_MONTHS = (months: number): number =>
	months * 30 * 24 * 60 * 60 * 1000

/**
 * Convert years to milliseconds (approximate: 365 days per year)
 */
export const FROM_YEARS = (years: number): number =>
	years * 365 * 24 * 60 * 60 * 1000

// ============================================================================
// COMPONENT EXTRACTORS (from timestamps)
// ============================================================================

/**
 * Get the year from a timestamp
 */
export const GET_YEAR = (timestamp: number): number =>
	new Date(timestamp).getFullYear()

/**
 * Get the month from a timestamp (1-based: 1 = January, 12 = December)
 */
export const GET_MONTH = (timestamp: number): number =>
	new Date(timestamp).getMonth() + 1

/**
 * Get the day of month from a timestamp (1-31)
 */
export const GET_DAY = (timestamp: number): number =>
	new Date(timestamp).getDate()

/**
 * Get the hour from a timestamp (0-23)
 */
export const GET_HOUR = (timestamp: number): number =>
	new Date(timestamp).getHours()

/**
 * Get the minute from a timestamp (0-59)
 */
export const GET_MINUTE = (timestamp: number): number =>
	new Date(timestamp).getMinutes()

/**
 * Get the second from a timestamp (0-59)
 */
export const GET_SECOND = (timestamp: number): number =>
	new Date(timestamp).getSeconds()

/**
 * Get the millisecond component from a timestamp (0-999)
 */
export const GET_MILLISECOND = (timestamp: number): number =>
	new Date(timestamp).getMilliseconds()

/**
 * Get the day of week from a timestamp (0 = Sunday, 6 = Saturday)
 */
export const GET_WEEKDAY = (timestamp: number): number =>
	new Date(timestamp).getDay()

/**
 * Get the day of year (1-366) from a timestamp
 */
export const GET_DAY_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	const start = new Date(date.getFullYear(), 0, 0)
	const diff = date.getTime() - start.getTime()
	const oneDay = 1000 * 60 * 60 * 24
	return Math.floor(diff / oneDay)
}

/**
 * Get the quarter (1-4) from a timestamp
 */
export const GET_QUARTER = (timestamp: number): number => {
	const month = new Date(timestamp).getMonth()
	return Math.floor(month / 3) + 1
}

// ============================================================================
// TIME DIFFERENCES (always positive)
// ============================================================================

/**
 * Get the absolute difference between two timestamps in seconds
 */
export const DIFFERENCE_IN_SECONDS = (ts1: number, ts2: number): number =>
	Math.abs(ts1 - ts2) / 1000

/**
 * Get the absolute difference between two timestamps in minutes
 */
export const DIFFERENCE_IN_MINUTES = (ts1: number, ts2: number): number =>
	Math.abs(ts1 - ts2) / (60 * 1000)

/**
 * Get the absolute difference between two timestamps in hours
 */
export const DIFFERENCE_IN_HOURS = (ts1: number, ts2: number): number =>
	Math.abs(ts1 - ts2) / (60 * 60 * 1000)

/**
 * Get the absolute difference between two timestamps in days
 */
export const DIFFERENCE_IN_DAYS = (ts1: number, ts2: number): number =>
	Math.abs(ts1 - ts2) / (24 * 60 * 60 * 1000)

/**
 * Get the absolute difference between two timestamps in weeks
 */
export const DIFFERENCE_IN_WEEKS = (ts1: number, ts2: number): number =>
	Math.abs(ts1 - ts2) / (7 * 24 * 60 * 60 * 1000)

// ============================================================================
// START/END OF PERIOD FUNCTIONS
// ============================================================================

/**
 * Get the start of day (00:00:00.000) for a given timestamp
 */
export const START_OF_DAY = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

/**
 * Get the end of day (23:59:59.999) for a given timestamp
 */
export const END_OF_DAY = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setHours(23, 59, 59, 999)
	return date.getTime()
}

/**
 * Get the start of week (Sunday at 00:00:00.000) for a given timestamp
 */
export const START_OF_WEEK = (timestamp: number): number => {
	const date = new Date(timestamp)
	const day = date.getDay()
	const diff = date.getDate() - day
	date.setDate(diff)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

/**
 * Get the start of month (1st day at 00:00:00.000) for a given timestamp
 */
export const START_OF_MONTH = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setDate(1)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

/**
 * Get the end of month (last day at 23:59:59.999) for a given timestamp
 */
export const END_OF_MONTH = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setMonth(date.getMonth() + 1, 0) // 0th day of next month = last day of current month
	date.setHours(23, 59, 59, 999)
	return date.getTime()
}

/**
 * Get the start of year (Jan 1st at 00:00:00.000) for a given timestamp
 */
export const START_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setMonth(0, 1)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

/**
 * Get the end of year (Dec 31st at 23:59:59.999) for a given timestamp
 */
export const END_OF_YEAR = (timestamp: number): number => {
	const date = new Date(timestamp)
	date.setMonth(11, 31)
	date.setHours(23, 59, 59, 999)
	return date.getTime()
}

// ============================================================================
// DATE ARITHMETIC FUNCTIONS
// ============================================================================

/**
 * Add days to a timestamp
 */
export const ADD_DAYS = (timestamp: number, days: number): number => {
	const date = new Date(timestamp)
	date.setDate(date.getDate() + days)
	return date.getTime()
}

/**
 * Add months to a timestamp (handles variable month lengths correctly)
 */
export const ADD_MONTHS = (timestamp: number, months: number): number => {
	const date = new Date(timestamp)
	date.setMonth(date.getMonth() + months)
	return date.getTime()
}

/**
 * Add years to a timestamp
 */
export const ADD_YEARS = (timestamp: number, years: number): number => {
	const date = new Date(timestamp)
	date.setFullYear(date.getFullYear() + years)
	return date.getTime()
}

// ============================================================================
// DATE COMPARISON/VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if ts1 is before ts2
 * Returns 1 if true, 0 if false
 */
export const IS_BEFORE = (ts1: number, ts2: number): number => {
	return ts1 < ts2 ? 1 : 0
}

/**
 * Check if ts1 is after ts2
 * Returns 1 if true, 0 if false
 */
export const IS_AFTER = (ts1: number, ts2: number): number => {
	return ts1 > ts2 ? 1 : 0
}

/**
 * Check if two timestamps are on the same calendar day
 * Returns 1 if true, 0 if false
 */
export const IS_SAME_DAY = (ts1: number, ts2: number): number => {
	const date1 = new Date(ts1)
	const date2 = new Date(ts2)
	return date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
		? 1
		: 0
}

/**
 * Check if timestamp falls on a weekend (Saturday or Sunday)
 * Returns 1 if true, 0 if false
 */
export const IS_WEEKEND = (timestamp: number): number => {
	const day = new Date(timestamp).getDay()
	return day === 0 || day === 6 ? 1 : 0
}

/**
 * Check if timestamp is in a leap year
 * Returns 1 if true, 0 if false
 */
export const IS_LEAP_YEAR = (timestamp: number): number => {
	const year = new Date(timestamp).getFullYear()
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 1 : 0
}

/**
 * Get the start of quarter for a given timestamp
 */
export const START_OF_QUARTER = (timestamp: number): number => {
	const date = new Date(timestamp)
	const quarter = Math.floor(date.getMonth() / 3)
	date.setMonth(quarter * 3, 1)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

// ============================================================================
// UNIX TIME CONVERSIONS
// ============================================================================

/**
 * Convert millisecond timestamp to Unix seconds
 */
export const TO_UNIX_SECONDS = (timestamp: number): number =>
	Math.floor(timestamp / 1000)

/**
 * Convert Unix seconds to millisecond timestamp
 */
export const FROM_UNIX_SECONDS = (seconds: number): number => seconds * 1000
