/**
 * Runtime value type - only numbers
 */
export type RuntimeValue = number

/**
 * Execution context providing global functions and variables
 * Functions must accept zero or more number arguments and return a number
 * Variables must be numbers
 */
export interface ExecutionContext {
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>
	variables?: Record<string, RuntimeValue>
}
