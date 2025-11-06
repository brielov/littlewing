import * as dateUtils from './date-utils'
import type { ExecutionContext } from './types'

/**
 * Default execution context with common Math functions and timestamp utilities
 * Users can use this as-is or spread it into their own context
 *
 * All functions use UPPERCASE naming convention to avoid collisions with user variables.
 * All date-related functions work with timestamps (milliseconds since Unix epoch)
 * to maintain the language's numbers-only type system.
 *
 * @example
 * // Use as-is
 * execute('ABS(-5)', defaultContext)
 *
 * @example
 * // Spread into custom context
 * execute('NOW() + FROM_MINUTES(5)', {
 *   ...defaultContext,
 *   variables: { customVar: 42 }
 * })
 *
 * @example
 * // Work with timestamps
 * const result = execute('NOW() + FROM_DAYS(7)', defaultContext)
 * const futureDate = new Date(result) // Convert back to Date if needed
 *
 * @example
 * // Calculate time differences
 * const ts1 = Date.now()
 * const ts2 = ts1 + 1000 * 60 * 60 * 3 // 3 hours later
 * execute('DIFFERENCE_IN_HOURS(ts1, ts2)', { ...defaultContext, variables: { ts1, ts2 } })
 */
export const defaultContext: ExecutionContext = {
	functions: {
		// Math functions (uppercase for consistency)
		ABS: Math.abs,
		CEIL: Math.ceil,
		FLOOR: Math.floor,
		ROUND: Math.round,
		SQRT: Math.sqrt,
		MIN: Math.min,
		MAX: Math.max,
		SIN: Math.sin,
		COS: Math.cos,
		TAN: Math.tan,
		LOG: Math.log,
		LOG10: Math.log10,
		EXP: Math.exp,

		// Timestamp functions

		/**
		 * Get current timestamp (milliseconds since Unix epoch)
		 */
		NOW: () => Date.now(),

		/**
		 * Create timestamp from date components
		 * Month is 1-based (1 = January, 12 = December)
		 * All parameters after 'day' are optional
		 */
		TIMESTAMP: (
			year: number,
			month: number,
			day: number,
			hour = 0,
			minute = 0,
			second = 0,
		) => new Date(year, month - 1, day, hour, minute, second).getTime(),

		// Time conversion helpers (convert to milliseconds for arithmetic operations)

		/**
		 * Convert milliseconds to milliseconds (identity function for consistency)
		 */
		FROM_MILLISECONDS: (ms: number) => ms,

		/**
		 * Convert seconds to milliseconds
		 */
		FROM_SECONDS: (s: number) => s * 1000,

		/**
		 * Convert minutes to milliseconds
		 */
		FROM_MINUTES: (m: number) => m * 60 * 1000,

		/**
		 * Convert hours to milliseconds
		 */
		FROM_HOURS: (h: number) => h * 60 * 60 * 1000,

		/**
		 * Convert days to milliseconds
		 */
		FROM_DAYS: (d: number) => d * 24 * 60 * 60 * 1000,

		/**
		 * Convert weeks to milliseconds
		 */
		FROM_WEEKS: (w: number) => w * 7 * 24 * 60 * 60 * 1000,

		// Timestamp component extractors (extract parts from timestamps)

		/**
		 * Get the year from a timestamp
		 */
		GET_YEAR: (timestamp: number) => new Date(timestamp).getFullYear(),

		/**
		 * Get the month from a timestamp (1-based: 1 = January, 12 = December)
		 */
		GET_MONTH: (timestamp: number) => new Date(timestamp).getMonth() + 1,

		/**
		 * Get the day of month from a timestamp (1-31)
		 */
		GET_DAY: (timestamp: number) => new Date(timestamp).getDate(),

		/**
		 * Get the hour from a timestamp (0-23)
		 */
		GET_HOUR: (timestamp: number) => new Date(timestamp).getHours(),

		/**
		 * Get the minute from a timestamp (0-59)
		 */
		GET_MINUTE: (timestamp: number) => new Date(timestamp).getMinutes(),

		/**
		 * Get the second from a timestamp (0-59)
		 */
		GET_SECOND: (timestamp: number) => new Date(timestamp).getSeconds(),

		/**
		 * Get the day of week from a timestamp (0 = Sunday, 6 = Saturday)
		 */
		GET_WEEKDAY: (timestamp: number) => new Date(timestamp).getDay(),

		// Time difference functions (always return positive values)

		/**
		 * Get the absolute difference between two timestamps in milliseconds
		 */
		DIFFERENCE_IN_MILLISECONDS: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2),

		/**
		 * Get the absolute difference between two timestamps in seconds
		 */
		DIFFERENCE_IN_SECONDS: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2) / 1000,

		/**
		 * Get the absolute difference between two timestamps in minutes
		 */
		DIFFERENCE_IN_MINUTES: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2) / (60 * 1000),

		/**
		 * Get the absolute difference between two timestamps in hours
		 */
		DIFFERENCE_IN_HOURS: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2) / (60 * 60 * 1000),

		/**
		 * Get the absolute difference between two timestamps in days
		 */
		DIFFERENCE_IN_DAYS: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2) / (24 * 60 * 60 * 1000),

		/**
		 * Get the absolute difference between two timestamps in weeks
		 */
		DIFFERENCE_IN_WEEKS: (ts1: number, ts2: number) =>
			Math.abs(ts1 - ts2) / (7 * 24 * 60 * 60 * 1000),

		// Additional date utilities (from date-utils module)
		...dateUtils,
	},
}
