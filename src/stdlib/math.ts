import type { RuntimeValue } from '../types'

/**
 * Math utility functions
 * All functions work with numbers only
 */

/**
 * Constrain a value between a minimum and maximum
 * @example CLAMP(value, 0, 100) - Clamps value between 0 and 100
 */
export const CLAMP = (
	value: RuntimeValue,
	min: RuntimeValue,
	max: RuntimeValue,
): RuntimeValue => {
	return value < min ? min : value > max ? max : value
}

// Standard Math functions (re-exported with UPPERCASE names for consistency)
export const ABS: (x: RuntimeValue) => RuntimeValue = Math.abs
export const CEIL: (x: RuntimeValue) => RuntimeValue = Math.ceil
export const FLOOR: (x: RuntimeValue) => RuntimeValue = Math.floor
export const ROUND: (x: RuntimeValue) => RuntimeValue = Math.round
export const SQRT: (x: RuntimeValue) => RuntimeValue = Math.sqrt
export const MIN: (...values: RuntimeValue[]) => RuntimeValue = Math.min
export const MAX: (...values: RuntimeValue[]) => RuntimeValue = Math.max
export const SIN: (x: RuntimeValue) => RuntimeValue = Math.sin
export const COS: (x: RuntimeValue) => RuntimeValue = Math.cos
export const TAN: (x: RuntimeValue) => RuntimeValue = Math.tan
export const LOG: (x: RuntimeValue) => RuntimeValue = Math.log
export const LOG10: (x: RuntimeValue) => RuntimeValue = Math.log10
export const EXP: (x: RuntimeValue) => RuntimeValue = Math.exp
