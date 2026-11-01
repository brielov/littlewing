import type { Temporal as Spec } from 'temporal-spec';

/**
 * Pick the global type of a Temporal class where a project declares one, as with
 * `lib: ["ESNext"]` or a polyfill's global types, so that its values fit without
 * casts. Otherwise fall back on the specification, as nothing declares a global.
 */
type TemporalClass<Name extends string, Fallback> = typeof globalThis extends {
	Temporal: { [K in Name]: { prototype: infer Instance } };
}
	? Instance
	: Fallback;

export type PlainDate = TemporalClass<'PlainDate', Spec.PlainDate>;
export type PlainTime = TemporalClass<'PlainTime', Spec.PlainTime>;
export type PlainDateTime = TemporalClass<'PlainDateTime', Spec.PlainDateTime>;

/**
 * Runtime value type - numbers, strings, booleans, dates, times, datetimes, and homogeneous arrays
 */
export type RuntimeValue =
	| number
	| string
	| boolean
	| PlainDate
	| PlainTime
	| PlainDateTime
	| readonly RuntimeValue[];

/**
 * A function callable from the language
 */
export type HostFunction = (...args: RuntimeValue[]) => RuntimeValue;

/**
 * Bounds on the work one evaluation may do
 */
export interface ExecutionLimits {
	/**
	 * Evaluation fails with a `LimitExceededError` cause past this many steps, and
	 * so does a result larger than this many elements and characters. Evaluating a
	 * node is one step, and operators and functions spend steps in proportion to
	 * the time and memory they use. A step costs at most about 16 bytes, so the
	 * default bounds an evaluation to a few hundred megabytes and a second or two.
	 * Pass `Infinity` to disable the limit for trusted programs. Defaults to
	 * `DEFAULT_MAX_STEPS`.
	 */
	maxSteps?: number;
}

/**
 * Execution context providing global functions and variables
 * Functions accept zero or more RuntimeValue arguments and return a RuntimeValue
 * Variables can be any RuntimeValue
 */
export interface ExecutionContext {
	functions?: Record<string, HostFunction>;
	variables?: Record<string, RuntimeValue>;
	limits?: ExecutionLimits;
}

/**
 * Result of evaluating source or an AST in a single pass.
 */
export interface ExecutionResult {
	value: RuntimeValue;
	scope: Record<string, RuntimeValue>;
}
