import type { ExecutionContext } from '../types'
import * as array from './array'
import * as core from './core'
import * as datetime from './datetime'
import * as math from './math'
import * as string from './string'

/**
 * Default execution context with standard library functions
 * Includes math, string, array, datetime, and type conversion functions
 */
export const defaultContext: ExecutionContext = {
	functions: {
		...core,
		...math,
		...string,
		...array,
		...datetime,
	},
}

// Re-export stdlib modules for direct access
export { array, core, datetime, math, string }
