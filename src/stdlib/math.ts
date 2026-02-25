import type { RuntimeValue } from '../types'
import { assertNumber } from '../utils'

/**
 * Math utility functions
 * All functions assert number inputs and return numbers
 */

export const ABS = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'ABS')
	return Math.abs(x)
}

export const CEIL = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'CEIL')
	return Math.ceil(x)
}

export const FLOOR = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'FLOOR')
	return Math.floor(x)
}

export const ROUND = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'ROUND')
	return Math.round(x)
}

export const SQRT = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'SQRT')
	return Math.sqrt(x)
}

export const MIN = (...values: RuntimeValue[]): RuntimeValue => {
	for (const value of values) {
		assertNumber(value, 'MIN')
	}
	return Math.min(...(values as number[]))
}

export const MAX = (...values: RuntimeValue[]): RuntimeValue => {
	for (const value of values) {
		assertNumber(value, 'MAX')
	}
	return Math.max(...(values as number[]))
}

export const SIN = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'SIN')
	return Math.sin(x)
}

export const COS = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'COS')
	return Math.cos(x)
}

export const TAN = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'TAN')
	return Math.tan(x)
}

export const LOG = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'LOG')
	return Math.log(x)
}

export const LOG10 = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'LOG10')
	return Math.log10(x)
}

export const EXP = (x: RuntimeValue): RuntimeValue => {
	assertNumber(x, 'EXP')
	return Math.exp(x)
}

/**
 * Constrain a value between a minimum and maximum
 */
export const CLAMP = (
	value: RuntimeValue,
	min: RuntimeValue,
	max: RuntimeValue,
): RuntimeValue => {
	assertNumber(value, 'CLAMP', 'value')
	assertNumber(min, 'CLAMP', 'min')
	assertNumber(max, 'CLAMP', 'max')
	return value < min ? min : value > max ? max : value
}
