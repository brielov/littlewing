import type { ExecutionContext } from './types'

/**
 * Default execution context with common Math functions and timestamp utilities
 * Users can use this as-is or spread it into their own context
 *
 * All date-related functions work with timestamps (milliseconds since Unix epoch)
 * to maintain the language's numbers-only type system.
 *
 * @example
 * // Use as-is
 * execute('abs(-5)', defaultContext)
 *
 * @example
 * // Spread into custom context
 * execute('now() + minutes(5)', {
 *   ...defaultContext,
 *   variables: { customVar: 42 }
 * })
 *
 * @example
 * // Work with timestamps
 * const result = execute('now() + days(7)', defaultContext)
 * const futureDate = new Date(result) // Convert back to Date if needed
 */
export const defaultContext: ExecutionContext = {
	functions: {
		// Math functions
		abs: Math.abs,
		ceil: Math.ceil,
		floor: Math.floor,
		round: Math.round,
		sqrt: Math.sqrt,
		min: Math.min,
		max: Math.max,
		sin: Math.sin,
		cos: Math.cos,
		tan: Math.tan,
		log: Math.log,
		log10: Math.log10,
		exp: Math.exp,

		// Timestamp functions

		/**
		 * Get current timestamp (milliseconds since Unix epoch)
		 */
		now: () => Date.now(),

		/**
		 * Create timestamp from date components
		 * Month is 1-based (1 = January, 12 = December)
		 * All parameters after 'day' are optional
		 */
		timestamp: (
			year: number,
			month: number,
			day: number,
			hour = 0,
			minute = 0,
			second = 0,
		) => new Date(year, month - 1, day, hour, minute, second).getTime(),

		// Time conversion helpers (return milliseconds for arithmetic operations)

		/**
		 * Convert milliseconds to milliseconds (identity function for consistency)
		 */
		milliseconds: (ms: number) => ms,

		/**
		 * Convert seconds to milliseconds
		 */
		seconds: (s: number) => s * 1000,

		/**
		 * Convert minutes to milliseconds
		 */
		minutes: (m: number) => m * 60 * 1000,

		/**
		 * Convert hours to milliseconds
		 */
		hours: (h: number) => h * 60 * 60 * 1000,

		/**
		 * Convert days to milliseconds
		 */
		days: (d: number) => d * 24 * 60 * 60 * 1000,

		/**
		 * Convert weeks to milliseconds
		 */
		weeks: (w: number) => w * 7 * 24 * 60 * 60 * 1000,

		// Timestamp component extractors (extract parts from timestamps)

		/**
		 * Get the year from a timestamp
		 */
		year: (timestamp: number) => new Date(timestamp).getFullYear(),

		/**
		 * Get the month from a timestamp (1-based: 1 = January, 12 = December)
		 */
		month: (timestamp: number) => new Date(timestamp).getMonth() + 1,

		/**
		 * Get the day of month from a timestamp (1-31)
		 */
		day: (timestamp: number) => new Date(timestamp).getDate(),

		/**
		 * Get the hour from a timestamp (0-23)
		 */
		hour: (timestamp: number) => new Date(timestamp).getHours(),

		/**
		 * Get the minute from a timestamp (0-59)
		 */
		minute: (timestamp: number) => new Date(timestamp).getMinutes(),

		/**
		 * Get the second from a timestamp (0-59)
		 */
		second: (timestamp: number) => new Date(timestamp).getSeconds(),

		/**
		 * Get the day of week from a timestamp (0 = Sunday, 6 = Saturday)
		 */
		weekday: (timestamp: number) => new Date(timestamp).getDay(),
	},
}
