import type { ExecutionContext } from '../types'
import * as array from './array'
import * as core from './core'
import * as datetime from './datetime'
import * as datetimefull from './datetimefull'
import * as math from './math'
import * as string from './string'
import * as time from './time'

/**
 * Default execution context with standard library functions
 * Includes math, string, array, datetime, time, datetimefull, and type conversion functions
 */
export const defaultContext: ExecutionContext = {
	functions: {
		...core,
		...math,
		...string,
		...array,
		...datetime,
		...time,
		...datetimefull,
	},
}

// Re-export stdlib modules for direct access
export { array, core, datetime, datetimefull, math, string, time }
