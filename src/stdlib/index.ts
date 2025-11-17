import type { ExecutionContext } from '../types'
import * as datetime from './datetime'
import * as math from './math'

/**
 * Default execution context with standard library functions
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
		// Math utilities
		...math,

		// Date/time utilities
		...datetime,
	},
}

// Re-export stdlib modules for direct access
export { math, datetime }
