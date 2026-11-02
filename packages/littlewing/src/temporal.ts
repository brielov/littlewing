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
const YEAR_ARG = /* @__PURE__ */ t.number('year');
const MONTH_ARG = /* @__PURE__ */ t.number('month');
const DAY_ARG = /* @__PURE__ */ t.number('day');
const HOUR_ARG = /* @__PURE__ */ t.number('hour');
const MINUTE_ARG = /* @__PURE__ */ t.number('minute');
const SECOND_ARG = /* @__PURE__ */ t.number('second');
const AMOUNT = /* @__PURE__ */ t.number('amount');

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

const DATED = [date, datetime] as unknown as readonly AbstractType<never>[];
const TIMED = [time, datetime] as unknown as readonly AbstractType<never>[];
const MOMENT = [datetime] as unknown as readonly AbstractType<never>[];

/** A function of the values of the types listed, which are all it needs to know. */
function on<T>(
	doc: string,
	types: readonly AbstractType<never>[],
	returns: Type,
	read: (value: T) => unknown,
): FunctionDefinition {
	return define({
		doc,
		overloads: types.map((type) => ({ args: [type('value')], returns })),
		pure: true,
		cost: () => TEMPORAL_STEPS,
		run: ((value: T) => read(value)) as never,
	});
}

function onDates(doc: string, returns: Type, read: (value: Dated) => unknown): FunctionDefinition {
	return on(doc, DATED, returns, read);
}

function onTimes(doc: string, returns: Type, read: (value: Timed) => unknown): FunctionDefinition {
	return on(doc, TIMED, returns, read);
}

/** Make a date. */
export const DATE: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'Make a date',
	args: [YEAR_ARG, MONTH_ARG, DAY_ARG],
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
	doc: 'Make a time',
	args: [HOUR_ARG, MINUTE_ARG, SECOND_ARG],
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
	doc: 'Make a date and time',
	args: [YEAR_ARG, MONTH_ARG, DAY_ARG, HOUR_ARG, MINUTE_ARG, SECOND_ARG],
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

export const YEAR: FunctionDefinition = /* @__PURE__ */ onDates('The year', NUMBER, (d) => d.year);
export const MONTH: FunctionDefinition = /* @__PURE__ */ onDates(
	'The month, from 1',
	NUMBER,
	(d) => d.month,
);
export const DAY: FunctionDefinition = /* @__PURE__ */ onDates(
	'The day of the month',
	NUMBER,
	(d) => d.day,
);

export const WEEKDAY: FunctionDefinition = /* @__PURE__ */ onDates(
	'The day of the week, from 1 for Monday to 7 for Sunday',
	NUMBER,
	(d) => d.dayOfWeek,
);
export const DAY_OF_YEAR: FunctionDefinition = /* @__PURE__ */ onDates(
	'The day of the year, from 1',
	NUMBER,
	(d) => d.dayOfYear,
);
export const QUARTER: FunctionDefinition = /* @__PURE__ */ onDates(
	'The quarter of the year, from 1 to 4',
	NUMBER,
	(d) => Math.ceil(d.month / 3),
);
export const IS_WEEKEND: FunctionDefinition = /* @__PURE__ */ onDates(
	'Whether it falls on a Saturday or a Sunday',
	BOOLEAN,
	(d) => d.dayOfWeek >= 6,
);
export const IS_LEAP_YEAR: FunctionDefinition = /* @__PURE__ */ onDates(
	'Whether its year is a leap year',
	BOOLEAN,
	(d) => d.inLeapYear,
);

export const HOUR: FunctionDefinition = /* @__PURE__ */ onTimes(
	'The hour, from 0 to 23',
	NUMBER,
	(v) => v.hour,
);
export const MINUTE: FunctionDefinition = /* @__PURE__ */ onTimes(
	'The minute',
	NUMBER,
	(v) => v.minute,
);
export const SECOND: FunctionDefinition = /* @__PURE__ */ onTimes(
	'The second',
	NUMBER,
	(v) => v.second,
);
export const MILLISECOND: FunctionDefinition = /* @__PURE__ */ onTimes(
	'The millisecond',
	NUMBER,
	(v) => v.millisecond,
);

export const TO_DATE: FunctionDefinition = /* @__PURE__ */ on<PlainDateTime>(
	'The date of a date and time',
	MOMENT,
	date,
	(value) => value.toPlainDate(),
);

export const TO_TIME: FunctionDefinition = /* @__PURE__ */ on<PlainDateTime>(
	'The time of a date and time',
	MOMENT,
	time,
	(value) => value.toPlainTime(),
);

export const COMBINE: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'A date at a time',
	args: [/* @__PURE__ */ date('date'), /* @__PURE__ */ time('time')],
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

export const ADD: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'The value moved by a whole number of units. A time wraps around at midnight',
	overloads: [
		{ args: [/* @__PURE__ */ date('value'), AMOUNT, DATE_UNIT], returns: date },
		{ args: [/* @__PURE__ */ time('value'), AMOUNT, TIME_UNIT], returns: time },
		{ args: [/* @__PURE__ */ datetime('value'), AMOUNT, ANY_UNIT], returns: datetime },
	] as readonly Signature[],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((value: PlainDateTime, amount: Decimal, unit: Unit) =>
		value.add({ [unit]: integer(amount, 'amount') })) as never,
});

export const DIFF: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'How many whole units lie between two values, whichever comes first',
	overloads: [
		{ args: [/* @__PURE__ */ date('a'), /* @__PURE__ */ date('b'), DATE_UNIT], returns: NUMBER },
		{ args: [/* @__PURE__ */ time('a'), /* @__PURE__ */ time('b'), TIME_UNIT], returns: NUMBER },
		{
			args: [/* @__PURE__ */ datetime('a'), /* @__PURE__ */ datetime('b'), ANY_UNIT],
			returns: NUMBER,
		},
	],
	pure: true,
	cost: () => DURATION_STEPS,
	run: ((a: PlainDateTime, b: PlainDateTime, unit: Unit) =>
		Math.abs(a.until(b, { largestUnit: unit })[unit])) as never,
});

function datePart(value: Dated): PlainDate {
	return 'toPlainDate' in value ? value.toPlainDate() : value;
}

export const IS_SAME_DAY: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'Whether two values fall on one calendar day, whatever their times',
	overloads: [
		{ args: [/* @__PURE__ */ date('a'), /* @__PURE__ */ date('b')], returns: BOOLEAN },
		{ args: [/* @__PURE__ */ date('a'), /* @__PURE__ */ datetime('b')], returns: BOOLEAN },
		{ args: [/* @__PURE__ */ datetime('a'), /* @__PURE__ */ date('b')], returns: BOOLEAN },
		{ args: [/* @__PURE__ */ datetime('a'), /* @__PURE__ */ datetime('b')], returns: BOOLEAN },
	],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((a: Dated, b: Dated) => datePart(a).equals(datePart(b))) as never,
});

export const AGE: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'Complete years from a birth date up to a date, which TODAY can give',
	overloads: [
		{ args: [/* @__PURE__ */ date('birth'), /* @__PURE__ */ date('on')], returns: NUMBER },
		{ args: [/* @__PURE__ */ date('birth'), /* @__PURE__ */ datetime('on')], returns: NUMBER },
		{ args: [/* @__PURE__ */ datetime('birth'), /* @__PURE__ */ date('on')], returns: NUMBER },
		{ args: [/* @__PURE__ */ datetime('birth'), /* @__PURE__ */ datetime('on')], returns: NUMBER },
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

export const START_OF: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'The first day of a period, or for a date and time its first moment',
	overloads: [
		{ args: [/* @__PURE__ */ date('value'), PERIOD], returns: date },
		{ args: [/* @__PURE__ */ datetime('value'), PERIOD_OR_DAY], returns: datetime },
	],
	pure: true,
	cost: () => TEMPORAL_STEPS,
	run: ((value: Dated, unit: Period | 'day') => {
		const day = datePart(value);
		const first = unit === 'day' ? day : firstDay(day, unit);
		return value === day ? first : first.toPlainDateTime();
	}) as never,
});

export const END_OF: FunctionDefinition = /* @__PURE__ */ define({
	doc: 'The last day of a period, or for a date and time its last moment',
	overloads: [
		{ args: [/* @__PURE__ */ date('value'), PERIOD], returns: date },
		{ args: [/* @__PURE__ */ datetime('value'), PERIOD_OR_DAY], returns: datetime },
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
