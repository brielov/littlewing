import { trustFunctions } from '../limits.js';
import type { ExecutionContext, HostFunction } from '../types.js';
import * as arrayFunctions from './array.js';
import * as coreFunctions from './core.js';
import * as datetimeFunctions from './datetime.js';
import * as datetimefullFunctions from './datetimefull.js';
import * as mathFunctions from './math.js';
import * as stringFunctions from './string.js';
import * as timeFunctions from './time.js';

/**
 * Build the default functions, which are trusted: they charge for their own work.
 */
function createDefaultContext(): ExecutionContext {
	const functions: Record<string, HostFunction> = {
		...coreFunctions,
		...mathFunctions,
		...stringFunctions,
		...arrayFunctions,
		...datetimeFunctions,
		...timeFunctions,
		...datetimefullFunctions,
	};
	trustFunctions(functions);
	return { functions };
}

/**
 * Default execution context with standard library functions
 * Includes math, string, array, datetime, time, datetimefull, and type conversion functions
 */
export const defaultContext: ExecutionContext = /* @__PURE__ */ createDefaultContext();

/**
 * Copy a family of functions for public use. Taken one by one, a function counts as
 * a host function, whether or not bundling kept the trusted table around.
 */
function publicCopy<Family extends Record<string, unknown>>(family: Family): Family {
	const copy: Record<string, unknown> = {};
	for (const [name, fn] of Object.entries(family)) {
		copy[name] = (fn as HostFunction).bind(undefined);
	}
	return copy as Family;
}

export const array: typeof arrayFunctions = /* @__PURE__ */ publicCopy(arrayFunctions);
export const core: typeof coreFunctions = /* @__PURE__ */ publicCopy(coreFunctions);
export const datetime: typeof datetimeFunctions = /* @__PURE__ */ publicCopy(datetimeFunctions);
export const datetimefull: typeof datetimefullFunctions =
	/* @__PURE__ */ publicCopy(datetimefullFunctions);
export const math: typeof mathFunctions = /* @__PURE__ */ publicCopy(mathFunctions);
export const string: typeof stringFunctions = /* @__PURE__ */ publicCopy(stringFunctions);
export const time: typeof timeFunctions = /* @__PURE__ */ publicCopy(timeFunctions);
