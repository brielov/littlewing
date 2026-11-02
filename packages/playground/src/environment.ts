import * as clock from 'littlewing/clock';
import * as std from 'littlewing/std';
import { date, datetime, temporalFunctions, time } from 'littlewing/temporal';

/** Everything a program here can call, beyond the core functions. */
export const FUNCTIONS = { ...std, ...temporalFunctions, ...clock };

/** The types a program here can take as inputs, beyond the built in ones. */
export const TYPES = [date, time, datetime];
