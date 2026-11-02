import type { FunctionDefinition } from './define.js';
import { define, once } from './define.js';
import { temporalApi } from './functions/temporal-api.js';
import { date, datetime, time } from './temporal.js';

/** Reading the clock and the time zone costs a system call. */
const CLOCK_STEPS = 2048;

/** One evaluation sees one moment, however many functions ask. */
const moment = /* @__PURE__ */ once(() => temporalApi().Now.plainDateTimeISO());

/** The date and time now, in the host's time zone. */
export const NOW: FunctionDefinition = /* @__PURE__ */ define({
	args: [],
	returns: datetime,
	cost: () => CLOCK_STEPS,
	run: () => moment(),
});

/** The date now, in the host's time zone. */
export const TODAY: FunctionDefinition = /* @__PURE__ */ define({
	args: [],
	returns: date,
	cost: () => CLOCK_STEPS,
	run: () => moment().toPlainDate(),
});

/** The time now, in the host's time zone. */
export const NOW_TIME: FunctionDefinition = /* @__PURE__ */ define({
	args: [],
	returns: time,
	cost: () => CLOCK_STEPS,
	run: () => moment().toPlainTime(),
});
