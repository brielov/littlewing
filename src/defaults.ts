import * as dateUtils from './date-utils'
import type { ExecutionContext } from './types'

/**
 * Default execution context with common Math functions and date/time utilities
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

		/**
		 * Constrain a value between a minimum and maximum
		 * @example CLAMP(value, 0, 100) - Clamps value between 0 and 100
		 */
		CLAMP: (value: number, min: number, max: number): number => {
			return value < min ? min : value > max ? max : value
		},

		// All date/time utilities (from date-utils module)
		...dateUtils,
	},
}
