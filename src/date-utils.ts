/**
 * Date utility functions for working with timestamps
 * All functions work with milliseconds since Unix epoch (numbers only)
 */

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

// ============================================================================
// ADDITIONAL TIME CONVERTERS
// ============================================================================

/**
 * Convert months to milliseconds (approximate: 30 days per month)
 */
export const FROM_MONTHS = (months: number): number => {
	return months * 30 * 24 * 60 * 60 * 1000
}

/**
 * Convert years to milliseconds (approximate: 365 days per year)
 */
export const FROM_YEARS = (years: number): number => {
	return years * 365 * 24 * 60 * 60 * 1000
}

// ============================================================================
// ADDITIONAL COMPONENT EXTRACTORS
// ============================================================================

/**
 * Get the millisecond component from a timestamp (0-999)
 */
export const GET_MILLISECOND = (timestamp: number): number => {
	return new Date(timestamp).getMilliseconds()
}

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
export const TO_UNIX_SECONDS = (timestamp: number): number => {
	return Math.floor(timestamp / 1000)
}

/**
 * Convert Unix seconds to millisecond timestamp
 */
export const FROM_UNIX_SECONDS = (seconds: number): number => {
	return seconds * 1000
}
