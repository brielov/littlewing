import type { Temporal } from 'temporal-polyfill'

/**
 * Runtime value type - numbers, strings, booleans, dates, and homogeneous arrays
 */
export type RuntimeValue =
	| number
	| string
	| boolean
	| Temporal.PlainDate
	| readonly RuntimeValue[]

/**
 * Execution context providing global functions and variables
 * Functions accept zero or more RuntimeValue arguments and return a RuntimeValue
 * Variables can be any RuntimeValue
 */
export interface ExecutionContext {
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>
	variables?: Record<string, RuntimeValue>
}
