import type { Temporal as Spec } from 'temporal-spec';
import type { Decimal } from './decimal.js';
import type { AbstractType, FunctionDefinition, Signature, Type } from './define.js';
import { define, defineType, t } from './define.js';
import { temporalApi } from './functions/temporal-api.js';

type PlainDate = Spec.PlainDate;
type PlainTime = Spec.PlainTime;
type PlainDateTime = Spec.PlainDateTime;
type Dated = PlainDate | PlainDateTime;
type Timed = PlainTime | PlainDateTime;

/** A date or time is slow to work with, and much larger than a number. */
const TEMPORAL_STEPS = 64;

/** A duration between two of them is slower still. */
const DURATION_STEPS = 1024;

const NUMBER = /* @__PURE__ */ t.number();
const BOOLEAN = /* @__PURE__ */ t.boolean();

/**
 * Whether a value is one of a type of the ISO calendar. Temporal has others, whose
 * months and years mean something else, and which compare unequal to their ISO twins.
 */
function isInstance(value: unknown, name: 'PlainDate' | 'PlainTime' | 'PlainDateTime'): boolean {
	if (typeof Temporal === 'undefined' || !(value instanceof Temporal[name])) return false;
	return !('calendarId' in value) || value.calendarId === 'iso8601';
}

export const date: AbstractType<PlainDate> = /* @__PURE__ */ defineType<PlainDate>({
	name: 'date',
	is: (value) => isInstance(value, 'PlainDate'),
	equals: (a, b) => a.equals(b),
	compare: (a, b) => temporalApi().PlainDate.compare(a, b),
	show: (value) => value.toString(),
});

export const time: AbstractType<PlainTime> = /* @__PURE__ */ defineType<PlainTime>({
	name: 'time',
	is: (value) => isInstance(value, 'PlainTime'),
	equals: (a, b) => a.equals(b),
	compare: (a, b) => temporalApi().PlainTime.compare(a, b),
	show: (value) => value.toString(),
});

export const datetime: AbstractType<PlainDateTime> = /* @__PURE__ */ defineType<PlainDateTime>({
	name: 'datetime',
	is: (value) => isInstance(value, 'PlainDateTime'),
	equals: (a, b) => a.equals(b),
	compare: (a, b) => temporalApi().PlainDateTime.compare(a, b),
	show: (value) => value.toString(),
});

function integer(value: Decimal, name: string): number {
	if (!value.isInteger()) throw new Error(`${name} must be an integer`);
	return value.toNumber();
}

/** A function of the values of the types listed, which are all it needs to know. */
function on<T>(
	types: readonly Type[],
	returns: Type,
	read: (value: T) => unknown,
): FunctionDefinition {
	return define({
		overloads: types.map((type) => ({ args: [type], returns })),
		pure: true,
		cost: () => TEMPORAL_STEPS,
		run: ((value: T) => read(value)) as never,
	});
}

function onDates(returns: Type, read: (value: Dated) => unknown): FunctionDefinition {
	return on([date, datetime], returns, read);
}

function onTimes(returns: Type, read: (value: Timed) => unknown): FunctionDefinition {
	return on([time, datetime], returns, read);
}

/** Make a date. */
export const DATE: FunctionDefinition = /* @__PURE__ */ define({
	args: [NUMBER, NUMBER, NUMBER],
	returns: date,
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: (year, month, day) =>
		new (temporalApi().PlainDate)(
			integer(year, 'year'),
			integer(month, 'month'),
			integer(day, 'day'),
		),
});

/** Make a time. */
export const TIME: FunctionDefinition = /* @__PURE__ */ define({
	args: [NUMBER, NUMBER, NUMBER],
	returns: time,
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: (hour, minute, second) =>
		new (temporalApi().PlainTime)(
			integer(hour, 'hour'),
			integer(minute, 'minute'),
			integer(second, 'second'),
		),
});

/** Make a date and time. */
export const DATETIME: FunctionDefinition = /* @__PURE__ */ define({
	args: [NUMBER, NUMBER, NUMBER, NUMBER, NUMBER, NUMBER],
	returns: datetime,
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: (year, month, day, hour, minute, second) =>
		new (temporalApi().PlainDateTime)(
			integer(year, 'year'),
			integer(month, 'month'),
			integer(day, 'day'),
			integer(hour, 'hour'),
			integer(minute, 'minute'),
			integer(second, 'second'),
		),
});

export const YEAR: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) => d.year);
export const MONTH: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) => d.month);
export const DAY: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) => d.day);

/** The day of the week, from 1 for Monday to 7 for Sunday. */
export const WEEKDAY: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) => d.dayOfWeek);
export const DAY_OF_YEAR: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) => d.dayOfYear);
export const QUARTER: FunctionDefinition = /* @__PURE__ */ onDates(NUMBER, (d) =>
	Math.ceil(d.month / 3),
);
export const IS_WEEKEND: FunctionDefinition = /* @__PURE__ */ onDates(
	BOOLEAN,
	(d) => d.dayOfWeek >= 6,
);
export const IS_LEAP_YEAR: FunctionDefinition = /* @__PURE__ */ onDates(
	BOOLEAN,
	(d) => d.inLeapYear,
);

export const HOUR: FunctionDefinition = /* @__PURE__ */ onTimes(NUMBER, (v) => v.hour);
export const MINUTE: FunctionDefinition = /* @__PURE__ */ onTimes(NUMBER, (v) => v.minute);
export const SECOND: FunctionDefinition = /* @__PURE__ */ onTimes(NUMBER, (v) => v.second);
export const MILLISECOND: FunctionDefinition = /* @__PURE__ */ onTimes(
	NUMBER,
	(v) => v.millisecond,
);

/** The date of a date and time. */
export const TO_DATE: FunctionDefinition = /* @__PURE__ */ on<PlainDateTime>(
	[datetime],
	date,
	(value) => value.toPlainDate(),
);

/** The time of a date and time. */
export const TO_TIME: FunctionDefinition = /* @__PURE__ */ on<PlainDateTime>(
	[datetime],
	time,
	(value) => value.toPlainTime(),
);

/** A date at a time. */
export const COMBINE: FunctionDefinition = /* @__PURE__ */ define({
	args: [date, time],
	returns: datetime,
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: (day, at) => day.toPlainDateTime(at),
});

const DATE_UNITS = ['years', 'months', 'weeks', 'days'] as const;
const TIME_UNITS = ['hours', 'minutes', 'seconds'] as const;
const ALL_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'] as const;
type Unit = (typeof ALL_UNITS)[number];

const DATE_UNIT = /* @__PURE__ */ t.oneOf(DATE_UNITS, 'unit');
const TIME_UNIT = /* @__PURE__ */ t.oneOf(TIME_UNITS, 'unit');
const ANY_UNIT = /* @__PURE__ */ t.oneOf(ALL_UNITS, 'unit');

/** The same type moved by a whole number of units. A time wraps around at midnight. */
export const ADD: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, NUMBER, DATE_UNIT], returns: date },
		{ args: [time, NUMBER, TIME_UNIT], returns: time },
		{ args: [datetime, NUMBER, ANY_UNIT], returns: datetime },
	] as readonly Signature[],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((value: PlainDateTime, amount: Decimal, unit: Unit) =>
		value.add({ [unit]: integer(amount, 'amount') })) as never,
});

/** How many whole units lie between two of one type, whichever comes first. */
export const DIFF: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, date, DATE_UNIT], returns: NUMBER },
		{ args: [time, time, TIME_UNIT], returns: NUMBER },
		{ args: [datetime, datetime, ANY_UNIT], returns: NUMBER },
	],
	pure: true,
	cost: () => DURATION_STEPS,
	run: ((a: PlainDateTime, b: PlainDateTime, unit: Unit) =>
		Math.abs(a.until(b, { largestUnit: unit })[unit])) as never,
});

function datePart(value: Dated): PlainDate {
	return 'toPlainDate' in value ? value.toPlainDate() : value;
}

/** Whether two values fall on one calendar day, whatever their times. */
export const IS_SAME_DAY: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, date], returns: BOOLEAN },
		{ args: [date, datetime], returns: BOOLEAN },
		{ args: [datetime, date], returns: BOOLEAN },
		{ args: [datetime, datetime], returns: BOOLEAN },
	],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((a: Dated, b: Dated) => datePart(a).equals(datePart(b))) as never,
});

/** Complete years from a birth date up to a date, which `TODAY` can give. */
export const AGE: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, date], returns: NUMBER },
		{ args: [date, datetime], returns: NUMBER },
		{ args: [datetime, date], returns: NUMBER },
		{ args: [datetime, datetime], returns: NUMBER },
	],
	pure: true,
	cost: () => DURATION_STEPS,
	run: ((birth: Dated, on: Dated) => {
		const from = datePart(birth);
		const to = datePart(on);
		if (temporalApi().PlainDate.compare(from, to) > 0) {
			throw new Error('AGE needs a birth date on or before the other date');
		}
		return from.until(to, { largestUnit: 'years' }).years;
	}) as never,
});

const PERIODS = ['year', 'quarter', 'month', 'week'] as const;
type Period = (typeof PERIODS)[number];

function firstDay(day: PlainDate, period: Period): PlainDate {
	switch (period) {
		case 'year':
			return day.with({ month: 1, day: 1 });
		case 'quarter':
			return day.with({ month: Math.floor((day.month - 1) / 3) * 3 + 1, day: 1 });
		case 'month':
			return day.with({ day: 1 });
		case 'week':
			return day.subtract({ days: day.dayOfWeek - 1 });
	}
}

function lastDay(day: PlainDate, period: Period): PlainDate {
	const first = firstDay(day, period);
	switch (period) {
		case 'year':
			return first.add({ years: 1 }).subtract({ days: 1 });
		case 'quarter':
			return first.add({ months: 3 }).subtract({ days: 1 });
		case 'month':
			return first.add({ months: 1 }).subtract({ days: 1 });
		case 'week':
			return first.add({ days: 6 });
	}
}

const LAST_TIME = {
	hour: 23,
	minute: 59,
	second: 59,
	millisecond: 999,
	microsecond: 999,
	nanosecond: 999,
};

const PERIOD = /* @__PURE__ */ t.oneOf(PERIODS, 'unit');
const PERIOD_OR_DAY = /* @__PURE__ */ t.oneOf(['year', 'quarter', 'month', 'week', 'day'], 'unit');

/** The first day of a period, or for a date and time its first moment. */
export const START_OF: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, PERIOD], returns: date },
		{ args: [datetime, PERIOD_OR_DAY], returns: datetime },
	],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((value: Dated, unit: Period | 'day') => {
		const day = datePart(value);
		const first = unit === 'day' ? day : firstDay(day, unit);
		return value === day ? first : first.toPlainDateTime();
	}) as never,
});

/** The last day of a period, or for a date and time its last moment. */
export const END_OF: FunctionDefinition = /* @__PURE__ */ define({
	overloads: [
		{ args: [date, PERIOD], returns: date },
		{ args: [datetime, PERIOD_OR_DAY], returns: datetime },
	],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((value: Dated, unit: Period | 'day') => {
		const day = datePart(value);
		const last = unit === 'day' ? day : lastDay(day, unit);
		return value === day ? last : last.toPlainDateTime(LAST_TIME);
	}) as never,
});

/**
 * Every function here, for `compile`. The module also holds the types, which are not
 * functions, so a namespace of it cannot be spread into `functions`.
 */
export const temporalFunctions: Readonly<Record<string, FunctionDefinition>> =
	/* @__PURE__ */ Object.freeze({
		DATE,
		TIME,
		DATETIME,
		YEAR,
		MONTH,
		DAY,
		WEEKDAY,
		DAY_OF_YEAR,
		QUARTER,
		IS_WEEKEND,
		IS_LEAP_YEAR,
		HOUR,
		MINUTE,
		SECOND,
		MILLISECOND,
		TO_DATE,
		TO_TIME,
		COMBINE,
		ADD,
		DIFF,
		IS_SAME_DAY,
		AGE,
		START_OF,
		END_OF,
	});
