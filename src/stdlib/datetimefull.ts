import type { RuntimeValue } from '../types'
import { assertDate, assertDateTime, assertNumber, assertTime } from '../utils'

/**
 * DateTime construction and conversion functions using Temporal.PlainDateTime
 */

// ============================================================================
// CORE DATETIME FUNCTIONS
// ============================================================================

/**
 * Create a PlainDateTime from year, month, day, hour, minute, second
 */
export const DATETIME = (
	year: RuntimeValue,
	month: RuntimeValue,
	day: RuntimeValue,
	hour: RuntimeValue,
	minute: RuntimeValue,
	second: RuntimeValue,
): RuntimeValue => {
	assertNumber(year, 'DATETIME', 'year')
	assertNumber(month, 'DATETIME', 'month')
	assertNumber(day, 'DATETIME', 'day')
	assertNumber(hour, 'DATETIME', 'hour')
	assertNumber(minute, 'DATETIME', 'minute')
	assertNumber(second, 'DATETIME', 'second')
	return new Temporal.PlainDateTime(year, month, day, hour, minute, second)
}

/**
 * Get the current date and time as a PlainDateTime
 */
export const NOW = (): RuntimeValue => Temporal.Now.plainDateTimeISO()

// ============================================================================
// CONVERSIONS
// ============================================================================

/**
 * Extract the PlainDate from a PlainDateTime
 */
export const TO_DATE = (dt: RuntimeValue): RuntimeValue => {
	assertDateTime(dt, 'TO_DATE')
	return dt.toPlainDate()
}

/**
 * Extract the PlainTime from a PlainDateTime
 */
export const TO_TIME = (dt: RuntimeValue): RuntimeValue => {
	assertDateTime(dt, 'TO_TIME')
	return dt.toPlainTime()
}

/**
 * Combine a PlainDate and PlainTime into a PlainDateTime
 */
export const COMBINE = (
	date: RuntimeValue,
	time: RuntimeValue,
): RuntimeValue => {
	assertDate(date, 'COMBINE')
	assertTime(time, 'COMBINE')
	return date.toPlainDateTime(time)
}

// ============================================================================
// DAY BOUNDARIES
// ============================================================================

/**
 * Get midnight (00:00:00) of a PlainDateTime's day
 */
export const START_OF_DAY = (dt: RuntimeValue): RuntimeValue => {
	assertDateTime(dt, 'START_OF_DAY')
	return dt.with({
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	})
}

/**
 * Get the last representable instant (23:59:59.999999999) of a PlainDateTime's day
 */
export const END_OF_DAY = (dt: RuntimeValue): RuntimeValue => {
	assertDateTime(dt, 'END_OF_DAY')
	return dt.with({
		hour: 23,
		minute: 59,
		second: 59,
		millisecond: 999,
		microsecond: 999,
		nanosecond: 999,
	})
}
