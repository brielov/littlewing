import { describe, expect, test } from 'bun:test';
import * as clock from '../src/clock.js';
import type { CompileOptions } from '../src/compile.js';
import { compile, evaluate, run } from '../src/compile.js';
import { define, once, t } from '../src/define.js';
import { CompileError, EvaluationError } from '../src/errors.js';
import * as temporal from '../src/temporal.js';

const TEMPORAL_STEPS_TABLE: Record<string, number> = {
	'YEAR(a)': 69,
	'MONTH(a)': 69,
	'DAY(a)': 69,
	'WEEKDAY(a)': 69,
	'DAY_OF_YEAR(a)': 69,
	'QUARTER(a)': 69,
	'IS_WEEKEND(a)': 69,
	'IS_LEAP_YEAR(a)': 69,
	'HOUR(a)': 69,
	'MINUTE(a)': 69,
	'SECOND(a)': 69,
	'MILLISECOND(a)': 69,
	'TO_DATE(a)': 85,
	'TO_TIME(a)': 85,
	'ADD(a, 1, "days")': 92,
	'DIFF(a, a, "days")': 1036,
	'IS_SAME_DAY(a, a)': 71,
	'AGE(a, a)': 1031,
	'START_OF(a, "month")': 91,
	'END_OF(a, "month")': 91,
	'DATE(n, 1, 1)': 89,
	'TIME(n, 1, 1)': 89,
	'DATETIME(n, 1, 1, 1, 1, 1)': 95,
	'COMBINE(a, b)': 87,
};

const functions = temporal.temporalFunctions;

function codeOf(body: () => unknown): string {
	try {
		body();
	} catch (error) {
		if (error instanceof EvaluationError) return error.code;
		if (error instanceof CompileError) return `compile:${error.diagnostics[0]?.code}`;
		return `other:${String(error)}`;
	}
	return 'no failure';
}

const d = (text: string): Temporal.PlainDate => Temporal.PlainDate.from(text);
const at = (text: string): Temporal.PlainTime => Temporal.PlainTime.from(text);
const dt = (text: string): Temporal.PlainDateTime => Temporal.PlainDateTime.from(text);

function shown(source: string): string {
	return String(run(source, { functions }));
}

describe('making values', () => {
	test('constructors', () => {
		expect(shown('DATE(2024, 2, 29)')).toBe('2024-02-29');
		expect(shown('TIME(13, 5, 9)')).toBe('13:05:09');
		expect(shown('DATETIME(2024, 2, 29, 13, 5, 9)')).toBe('2024-02-29T13:05:09');
	});

	test('a value that does not exist fails', () => {
		expect(codeOf(() => run('DATE(2023, 2, 29)', { functions }))).toBe('compile:host-error');
		expect(codeOf(() => run('TIME(24, 0, 0)', { functions }))).toBe('compile:host-error');
		expect(codeOf(() => run('DATE(2024.5, 1, 1)', { functions }))).toBe('compile:host-error');
	});

	test('conversions', () => {
		const later = 'DATETIME(2024, 2, 29, 13, 5, 9)';
		expect(shown(`TO_DATE(${later})`)).toBe('2024-02-29');
		expect(shown(`TO_TIME(${later})`)).toBe('13:05:09');
		expect(shown('COMBINE(DATE(2024, 1, 2), TIME(3, 4, 5))')).toBe('2024-01-02T03:04:05');
	});
});

describe('reading values', () => {
	const moment = 'DATETIME(2024, 8, 3, 13, 5, 9)';

	test('parts', () => {
		expect(run(`YEAR(${moment})`, { functions })).toBe(2024);
		expect(run(`MONTH(${moment})`, { functions })).toBe(8);
		expect(run(`DAY(${moment})`, { functions })).toBe(3);
		expect(run(`HOUR(${moment})`, { functions })).toBe(13);
		expect(run(`MINUTE(${moment})`, { functions })).toBe(5);
		expect(run(`SECOND(${moment})`, { functions })).toBe(9);
		expect(run(`MILLISECOND(${moment})`, { functions })).toBe(0);
		expect(run('YEAR(DATE(2024, 1, 1))', { functions })).toBe(2024);
		expect(run('HOUR(TIME(5, 0, 0))', { functions })).toBe(5);
	});

	test('calendar facts', () => {
		expect(run('WEEKDAY(DATE(2024, 8, 3))', { functions })).toBe(6);
		expect(run('DAY_OF_YEAR(DATE(2024, 12, 31))', { functions })).toBe(366);
		expect(run('QUARTER(DATE(2024, 8, 3))', { functions })).toBe(3);
		expect(run('QUARTER(DATE(2024, 12, 31))', { functions })).toBe(4);
		expect(run('IS_WEEKEND(DATE(2024, 8, 3))', { functions })).toBe(true);
		expect(run('IS_WEEKEND(DATE(2024, 8, 5))', { functions })).toBe(false);
		expect(run('IS_LEAP_YEAR(DATE(2024, 1, 1))', { functions })).toBe(true);
		expect(run('IS_LEAP_YEAR(DATE(2023, 1, 1))', { functions })).toBe(false);
	});
});

describe('arithmetic', () => {
	test('ADD keeps the type', () => {
		expect(shown('ADD(DATE(2024, 1, 31), 1, "months")')).toBe('2024-02-29');
		expect(shown('ADD(DATE(2024, 1, 1), -1, "days")')).toBe('2023-12-31');
		expect(shown('ADD(DATE(2024, 1, 1), 1, "weeks")')).toBe('2024-01-08');
		expect(shown('ADD(DATE(2024, 2, 29), 1, "years")')).toBe('2025-02-28');
		expect(shown('ADD(TIME(23, 0, 0), 2, "hours")')).toBe('01:00:00');
		expect(shown('ADD(DATETIME(2024, 1, 1, 23, 0, 0), 2, "hours")')).toBe('2024-01-02T01:00:00');
		expect(shown('ADD(DATETIME(2024, 1, 1, 0, 0, 0), 1, "days")')).toBe('2024-01-02T00:00:00');
	});

	test('a unit has to fit the type', () => {
		expect(codeOf(() => run('ADD(DATE(2024, 1, 1), 1, "hours")', { functions }))).toBe(
			'compile:type-mismatch',
		);
		expect(codeOf(() => run('ADD(TIME(1, 0, 0), 1, "days")', { functions }))).toBe(
			'compile:type-mismatch',
		);
		expect(codeOf(() => run('ADD(DATE(2024, 1, 1), 0.5, "days")', { functions }))).toBe(
			'compile:host-error',
		);
	});

	test('a unit known only at run time is checked then', () => {
		const inputs = { u: t.string() };
		const variables = { u: 'hours' };
		expect(codeOf(() => run('ADD(DATE(2024, 1, 1), 1, u)', { functions, inputs, variables }))).toBe(
			'invalid-argument',
		);
	});

	test('DIFF counts whole units, whichever comes first', () => {
		expect(run('DIFF(DATE(2024, 1, 1), DATE(2024, 3, 1), "days")', { functions })).toBe(60);
		expect(run('DIFF(DATE(2024, 3, 1), DATE(2024, 1, 1), "days")', { functions })).toBe(60);
		expect(run('DIFF(DATE(2024, 1, 31), DATE(2024, 3, 30), "months")', { functions })).toBe(1);
		expect(run('DIFF(DATE(2020, 1, 1), DATE(2024, 1, 1), "years")', { functions })).toBe(4);
		expect(run('DIFF(DATE(2024, 1, 1), DATE(2024, 1, 15), "weeks")', { functions })).toBe(2);
		expect(run('DIFF(TIME(1, 0, 0), TIME(3, 30, 0), "hours")', { functions })).toBe(2);
		expect(run('DIFF(TIME(1, 0, 0), TIME(1, 1, 30), "seconds")', { functions })).toBe(90);
		const a = 'DATETIME(2024, 1, 1, 0, 0, 0)';
		const b = 'DATETIME(2024, 1, 2, 1, 0, 0)';
		expect(run(`DIFF(${a}, ${b}, "hours")`, { functions })).toBe(25);
	});

	test('DIFF needs one type on both sides', () => {
		expect(codeOf(() => run('DIFF(DATE(2024, 1, 1), TIME(1, 0, 0), "days")', { functions }))).toBe(
			'compile:type-mismatch',
		);
	});

	test('IS_SAME_DAY and AGE', () => {
		expect(run('IS_SAME_DAY(DATE(2024, 1, 1), DATETIME(2024, 1, 1, 5, 0, 0))', { functions })).toBe(
			true,
		);
		expect(run('IS_SAME_DAY(DATE(2024, 1, 1), DATE(2024, 1, 2))', { functions })).toBe(false);
		expect(run('AGE(DATE(2000, 6, 15), DATE(2024, 6, 14))', { functions })).toBe(23);
		expect(run('AGE(DATE(2000, 6, 15), DATE(2024, 6, 15))', { functions })).toBe(24);
		expect(codeOf(() => run('AGE(DATE(2024, 1, 1), DATE(2000, 1, 1))', { functions }))).toBe(
			'compile:host-error',
		);
	});
});

describe('periods', () => {
	test('START_OF a date', () => {
		expect(shown('START_OF(DATE(2024, 8, 3), "year")')).toBe('2024-01-01');
		expect(shown('START_OF(DATE(2024, 8, 3), "quarter")')).toBe('2024-07-01');
		expect(shown('START_OF(DATE(2024, 8, 3), "month")')).toBe('2024-08-01');
		expect(shown('START_OF(DATE(2024, 8, 3), "week")')).toBe('2024-07-29');
	});

	test('END_OF a date', () => {
		expect(shown('END_OF(DATE(2024, 8, 3), "year")')).toBe('2024-12-31');
		expect(shown('END_OF(DATE(2024, 8, 3), "quarter")')).toBe('2024-09-30');
		expect(shown('END_OF(DATE(2024, 2, 3), "month")')).toBe('2024-02-29');
		expect(shown('END_OF(DATE(2024, 8, 3), "week")')).toBe('2024-08-04');
	});

	test('on a date and time, its first and last moments', () => {
		const moment = 'DATETIME(2024, 8, 3, 13, 5, 9)';
		expect(shown(`START_OF(${moment}, "day")`)).toBe('2024-08-03T00:00:00');
		expect(shown(`END_OF(${moment}, "day")`)).toBe('2024-08-03T23:59:59.999999999');
		expect(shown(`START_OF(${moment}, "month")`)).toBe('2024-08-01T00:00:00');
		expect(shown(`END_OF(${moment}, "year")`)).toBe('2024-12-31T23:59:59.999999999');
	});

	test('"day" is not a period of a date', () => {
		expect(codeOf(() => run('START_OF(DATE(2024, 1, 1), "day")', { functions }))).toBe(
			'compile:type-mismatch',
		);
	});
});

describe('as abstract types', () => {
	const inputs = { a: temporal.date, b: temporal.date };
	const variables = { a: d('2024-01-01'), b: d('2024-01-02') };

	test('order, equality and text', () => {
		expect(run('a < b', { inputs, variables })).toBe(true);
		expect(run('a == b', { inputs, variables })).toBe(false);
		expect(run('a == a', { inputs, variables })).toBe(true);
		expect(run('"on #{a}"', { inputs, variables })).toBe('on 2024-01-01');
		expect(run('SORT([b, a])', { inputs, variables })).toEqual([variables.a, variables.b]);
		const times = { inputs: { a: temporal.time, b: temporal.time } };
		const moments = { inputs: { a: temporal.datetime, b: temporal.datetime } };
		expect(run('a < b', { ...times, variables: { a: at('01:00'), b: at('02:00') } })).toBe(true);
		expect(
			run('a < b', {
				...moments,
				variables: { a: dt('2024-01-01T01:00'), b: dt('2024-01-01T02:00') },
			}),
		).toBe(true);
	});

	test('they cross the boundary untouched, and must be the right type', () => {
		expect(run('a', { inputs, variables })).toBe(variables.a);
		expect(codeOf(() => run('a < b', { inputs, variables: { a: '2024-01-01', b: 1 } }))).toBe(
			'invalid-input',
		);
		expect(
			codeOf(() =>
				run('a < b', { inputs, variables: { a: dt('2024-01-01T00:00'), b: variables.b } }),
			),
		).toBe('invalid-input');
	});

	test('the types are three, and do not mix', () => {
		expect(codeOf(() => run('DATE(2024, 1, 1) < TIME(1, 0, 0)', { functions }))).toBe(
			'compile:type-mismatch',
		);
	});

	test('an operation on one never folds', () => {
		const result = compile('DATE(2024, 1, 1) < DATE(2024, 1, 2)', { functions });
		expect(result.ok).toBe(true);
		if (result.ok) expect(evaluate(result.program)).toBe(true);
	});

	test('an undeclared input takes the first overload, and a declared one its type', () => {
		const inferred = compile('YEAR(a) + 1', { functions });
		if (!inferred.ok) throw new CompileError(inferred.diagnostics);
		expect(inferred.program.inputs.a?.type).toEqual({ kind: 'abstract', name: 'date' });
		expect(evaluate(inferred.program, { variables: { a: d('2024-01-01') } })).toBe(2025);

		const declared = compile('YEAR(a) + 1', { functions, inputs: { a: temporal.datetime } });
		if (!declared.ok) throw new CompileError(declared.diagnostics);
		expect(evaluate(declared.program, { variables: { a: dt('2024-01-01T00:00') } })).toBe(2025);
	});
});

describe('on a declared date and time', () => {
	const inputs = { a: temporal.datetime, b: temporal.datetime };
	const a = dt('2024-03-15T10:20:30.500');
	const b = dt('2024-03-17T12:00:00');
	const variables = { a, b };

	test.each<[string, unknown]>([
		['YEAR(a)', 2024],
		['MONTH(a)', 3],
		['DAY(a)', 15],
		['WEEKDAY(a)', 5],
		['DAY_OF_YEAR(a)', 75],
		['QUARTER(a)', 1],
		['IS_WEEKEND(b)', true],
		['IS_WEEKEND(a)', false],
		['IS_LEAP_YEAR(a)', true],
		['HOUR(a)', 10],
		['MINUTE(a)', 20],
		['SECOND(a)', 30],
		['MILLISECOND(a)', 500],
		['DIFF(a, b, "days")', 2],
		['DIFF(a, b, "hours")', 49],
		['DIFF(a, b, "minutes")', 2979],
		['IS_SAME_DAY(a, b)', false],
		['IS_SAME_DAY(a, a)', true],
		['AGE(a, b)', 0],
	])('%s', (source, value) => {
		expect(run(source, { functions, inputs, variables })).toBe(value);
	});

	test.each([
		['ADD(a, 1, "days")', '2024-03-16T10:20:30.5'],
		['ADD(a, 1, "months")', '2024-04-15T10:20:30.5'],
		['ADD(a, 1, "hours")', '2024-03-15T11:20:30.5'],
		['ADD(a, 1, "minutes")', '2024-03-15T10:21:30.5'],
		['ADD(a, 1, "seconds")', '2024-03-15T10:20:31.5'],
		['START_OF(a, "week")', '2024-03-11T00:00:00'],
		['END_OF(a, "quarter")', '2024-03-31T23:59:59.999999999'],
		['COMBINE(TO_DATE(a), TO_TIME(b))', '2024-03-15T12:00:00'],
	])('%s', (source, value) => {
		expect(String(run(source, { functions, inputs, variables }))).toBe(value);
	});
});

describe('the record of functions', () => {
	test('it holds every function, and a namespace cannot be spread', () => {
		const { date, time, datetime, temporalFunctions, ...named } = temporal;
		expect(Object.keys(temporalFunctions).sort()).toEqual(Object.keys(named).sort());
		expect(Object.isFrozen(temporalFunctions)).toBe(true);
		expect(temporal.date).toBe(date);
		expect(temporal.time).toBe(time);
		expect(temporal.datetime).toBe(datetime);
		expect(() => compile('1', { functions: { ...temporal } as never })).toThrow(TypeError);
	});
});

describe('folding', () => {
	const on = 'DATE(2024, 8, 3)';
	const at = 'TIME(1, 2, 3)';
	const moment = 'DATETIME(2024, 8, 3, 1, 2, 3)';

	test.each([
		`YEAR(${on})`,
		`MONTH(${on})`,
		`DAY(${on})`,
		`WEEKDAY(${on})`,
		`DAY_OF_YEAR(${on})`,
		`QUARTER(${on})`,
		`IS_WEEKEND(${on})`,
		`IS_LEAP_YEAR(${on})`,
		`HOUR(${at})`,
		`MINUTE(${at})`,
		`SECOND(${at})`,
		`MILLISECOND(${at})`,
		`YEAR(${moment})`,
		`HOUR(${moment})`,
		`YEAR(TO_DATE(${moment}))`,
		`HOUR(TO_TIME(${moment}))`,
		`YEAR(COMBINE(${on}, ${at}))`,
		`YEAR(ADD(${on}, 1, "days"))`,
		`DIFF(${on}, ${on}, "days")`,
		`IS_SAME_DAY(${on}, ${on})`,
		`AGE(${on}, ${on})`,
		`YEAR(START_OF(${on}, "month"))`,
		`YEAR(END_OF(${on}, "month"))`,
	])('%s folds', (source) => {
		const result = compile(source, { functions });
		if (!result.ok) throw new CompileError(result.diagnostics);
		// One step for the constant, and one to hand it back, where a call would cost far more
		expect(evaluate(result.program, { limits: { maxSteps: 2 } })).toBeDefined();
	});
});

describe('budgets', () => {
	const a = temporal.date;
	const stepsOf = (source: string, options: CompileOptions, variables: object): number => {
		const result = compile(source, { functions, ...options });
		if (!result.ok) throw new CompileError(result.diagnostics);
		const { program } = result;
		let low = 0;
		let high = 1 << 20;
		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			const outcome = codeOf(() =>
				evaluate(program, { variables: variables as never, limits: { maxSteps: middle } }),
			);
			if (outcome === 'no failure') high = middle;
			else low = middle + 1;
		}
		return low;
	};

	test('every function pays what it costs, on top of the walk around it', () => {
		const dates = { inputs: { a } };
		const times = { inputs: { a: temporal.time } };
		const moments = { inputs: { a: temporal.datetime } };
		const onDate = { a: d('2024-08-03') };
		const onTime = { a: at('01:02:03') };
		const onMoment = { a: dt('2024-08-03T01:02:03') };
		const table: Record<string, number> = {};
		const measure = (source: string, options: CompileOptions, variables: object): void => {
			table[source] = stepsOf(source, options, variables);
		};
		for (const name of ['YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'DAY_OF_YEAR', 'QUARTER']) {
			measure(`${name}(a)`, dates, onDate);
		}
		measure('IS_WEEKEND(a)', dates, onDate);
		measure('IS_LEAP_YEAR(a)', dates, onDate);
		for (const name of ['HOUR', 'MINUTE', 'SECOND', 'MILLISECOND']) {
			measure(`${name}(a)`, times, onTime);
		}
		measure('TO_DATE(a)', moments, onMoment);
		measure('TO_TIME(a)', moments, onMoment);
		measure('ADD(a, 1, "days")', dates, onDate);
		measure('DIFF(a, a, "days")', dates, onDate);
		measure('IS_SAME_DAY(a, a)', dates, onDate);
		measure('AGE(a, a)', dates, onDate);
		measure('START_OF(a, "month")', dates, onDate);
		measure('END_OF(a, "month")', dates, onDate);
		measure('DATE(n, 1, 1)', { inputs: { n: t.number() } }, { n: 2024 });
		measure('TIME(n, 1, 1)', { inputs: { n: t.number() } }, { n: 1 });
		measure('DATETIME(n, 1, 1, 1, 1, 1)', { inputs: { n: t.number() } }, { n: 2024 });
		measure('COMBINE(a, b)', { inputs: { a, b: temporal.time } }, { a: onDate.a, b: onTime.a });
		expect(table).toEqual(TEMPORAL_STEPS_TABLE);
	});

	test('the clock pays for reading it', () => {
		const result = (name: string): number => stepsOf(`${name}()`, { functions: clock }, {});
		expect(result('NOW')).toBeGreaterThanOrEqual(2048);
		expect(result('TODAY')).toBeGreaterThanOrEqual(2048);
		expect(result('NOW_TIME')).toBeGreaterThanOrEqual(2048);
	});
});

describe('the ISO calendar', () => {
	test('other calendars are not values of these types', () => {
		const hebrew = d('2024-01-01').withCalendar('hebrew');
		expect(temporal.date.definition.is(hebrew)).toBe(false);
		expect(temporal.date.definition.is(d('2024-01-01'))).toBe(true);
		const inputs = { a: temporal.date };
		expect(codeOf(() => run('a', { inputs, variables: { a: hebrew } }))).toBe('invalid-input');
		const moment = dt('2024-01-01T00:00').withCalendar('hebrew');
		expect(temporal.datetime.definition.is(moment)).toBe(false);
		expect(temporal.time.definition.is(at('01:00'))).toBe(true);
	});
});

describe('edges of periods and ages', () => {
	test('the first month of a quarter starts it', () => {
		expect(shown('START_OF(DATE(2024, 7, 1), "quarter")')).toBe('2024-07-01');
		expect(shown('START_OF(DATE(2024, 4, 30), "quarter")')).toBe('2024-04-01');
		expect(shown('START_OF(DATE(2024, 1, 1), "quarter")')).toBe('2024-01-01');
		expect(shown('END_OF(DATE(2024, 10, 1), "quarter")')).toBe('2024-12-31');
		expect(shown('START_OF(DATE(2024, 7, 29), "week")')).toBe('2024-07-29');
		expect(shown('END_OF(DATE(2024, 12, 30), "week")')).toBe('2025-01-05');
	});

	test('an age on the birth date is zero', () => {
		expect(run('AGE(DATE(2024, 1, 1), DATE(2024, 1, 1))', { functions })).toBe(0);
		expect(run('AGE(DATETIME(2000, 1, 1, 0, 0, 0), DATE(2024, 1, 1))', { functions })).toBe(24);
	});
});

describe('the clock', () => {
	test('spreading the temporal functions gives no clock', () => {
		expect(compile('NOW()', { functions }).diagnostics[0]?.code).toBe('unknown-function');
		expect(compile('TODAY()', { functions }).diagnostics[0]?.code).toBe('unknown-function');
	});

	test('NOW, TODAY and NOW_TIME agree within one evaluation', () => {
		const result = compile(
			'[TO_DATE(NOW()) == TODAY(), TO_TIME(NOW()) == NOW_TIME(), NOW() == NOW()]',
			{ functions: { ...functions, ...clock } },
		);
		if (!result.ok) throw new CompileError(result.diagnostics);
		expect(evaluate(result.program)).toEqual([true, true, true]);
	});

	test('the clock never folds', () => {
		let reads = 0;
		const read = once(() => ++reads);
		const R = define({ args: [], returns: t.number(), run: () => read() });
		const result = compile('R()', { functions: { R, ...clock } });
		expect(reads).toBe(0);
		expect(result.ok).toBe(true);
		const now = compile('TODAY()', { functions: { ...clock } });
		if (!now.ok) throw new CompileError(now.diagnostics);
		expect(evaluate(now.program)).toBeInstanceOf(Temporal.PlainDate);
	});

	test('AGE works from the clock', () => {
		const result = compile('AGE(DATE(2000, 1, 1), TODAY())', {
			functions: { ...functions, ...clock },
		});
		if (!result.ok) throw new CompileError(result.diagnostics);
		expect(evaluate(result.program)).toBeGreaterThan(20);
	});
});

describe('without Temporal', () => {
	test('the failure names the polyfill', () => {
		const saved = globalThis.Temporal;
		const holder = globalThis as { Temporal?: unknown };
		// A program compiled first, so only evaluating sees it gone
		const result = compile('DATE(y, 1, 1)', { functions });
		delete holder.Temporal;
		try {
			if (!result.ok) throw new CompileError(result.diagnostics);
			const error = (() => {
				try {
					evaluate(result.program, { variables: { y: 2024 } });
				} catch (caught) {
					return caught as Error & { cause: Error; code: string };
				}
				throw new Error('Expected a failure');
			})();
			expect(error.code).toBe('host-error');
			expect(error.cause.message).toContain('temporal-polyfill');
			expect(temporal.date.definition.is(1)).toBe(false);
		} finally {
			holder.Temporal = saved;
		}
	});
});
