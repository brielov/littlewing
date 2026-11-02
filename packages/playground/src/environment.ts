import * as clock from 'littlewing/clock';
import * as std from 'littlewing/std';
import { date, datetime, temporalFunctions, time } from 'littlewing/temporal';

/**
 * Evaluation runs on the main thread, on every keystroke and from shared links, so
 * it gets a budget small enough to keep the page responsive whatever is typed.
 * The library default is ten times this.
 */
export const LIMITS = { maxSteps: 2_000_000 };

/** Everything a program here can call, beyond the core functions. */
export const FUNCTIONS = { ...std, ...temporalFunctions, ...clock };

/** The types a program here can take as inputs, beyond the built in ones. */
export const TYPES = [date, time, datetime];
