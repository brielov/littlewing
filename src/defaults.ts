import type { ExecutionContext } from './types'

/**
 * Default execution context with common Math functions and date utilities
 * Users can use this as-is or spread it into their own context
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

		// Date functions
		now: () => new Date(),
		date: (...args: ConstructorParameters<typeof Date>) => new Date(...args),

		// Time conversion helpers (return milliseconds)
		milliseconds: (ms: number) => ms,
		seconds: (s: number) => s * 1000,
		minutes: (m: number) => m * 60 * 1000,
		hours: (h: number) => h * 60 * 60 * 1000,
		days: (d: number) => d * 24 * 60 * 60 * 1000,
	},
}
