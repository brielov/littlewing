import { describe, expect, test } from 'bun:test'
import { defaultContext, execute } from '../src'

describe('Date Utils', () => {
	describe('CORE FUNCTIONS', () => {
		test('NOW() returns timestamp', () => {
			const before = Date.now()
			const result = execute('NOW()', defaultContext)
			const after = Date.now()
			expect(typeof result).toBe('number')
			expect(result).toBeGreaterThanOrEqual(before)
			expect(result).toBeLessThanOrEqual(after)
		})

		test('DATE() creates timestamp with defaults', () => {
			const result = execute('DATE(2024)', defaultContext)
			const expected = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('DATE() with all components', () => {
			const result = execute('DATE(2024, 6, 15, 12, 30, 45)', defaultContext)
			const expected = Date.UTC(2024, 5, 15, 12, 30, 45)
			expect(result).toBe(expected)
		})

		test('DATE() creates same timestamp regardless of timezone', () => {
			const result = execute('DATE(2024, 6, 15, 12, 0, 0)', defaultContext)
			const expected = Date.UTC(2024, 5, 15, 12, 0, 0)
			expect(result).toBe(expected)
			expect(result).toBe(1718452800000)
		})

		test('DATE() at midnight is predictable', () => {
			const result = execute('DATE(2024, 1, 1)', defaultContext)
			const expected = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
			expect(result).toBe(expected)
			expect(result).toBe(1704067200000)
		})

		test('DATE() handles leap year Feb 29', () => {
			const result = execute('DATE(2024, 2, 29)', defaultContext)
			const date = new Date(result)
			expect(date.getUTCFullYear()).toBe(2024)
			expect(date.getUTCMonth()).toBe(1)
			expect(date.getUTCDate()).toBe(29)
		})
	})

	describe('TIME CONVERTERS', () => {
		test('FROM_DAYS()', () => {
			const result = execute('FROM_DAYS(1)', defaultContext)
			expect(result).toBe(24 * 60 * 60 * 1000)
		})

		test('FROM_WEEKS()', () => {
			const result = execute('FROM_WEEKS(1)', defaultContext)
			expect(result).toBe(7 * 24 * 60 * 60 * 1000)
		})

		test('FROM_MONTHS', () => {
			const result = execute('FROM_MONTHS(1)', defaultContext)
			expect(result).toBe(30 * 24 * 60 * 60 * 1000)
		})

		test('FROM_YEARS', () => {
			const result = execute('FROM_YEARS(1)', defaultContext)
			expect(result).toBe(365 * 24 * 60 * 60 * 1000)
		})
	})

	describe('COMPONENT EXTRACTORS', () => {
		test('GET_YEAR() extracts year from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15)
			const result = execute('GET_YEAR(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(2024)
		})

		test('GET_MONTH() extracts month from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15)
			const result = execute('GET_MONTH(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(6)
		})

		test('GET_DAY() extracts day from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15)
			const result = execute('GET_DAY(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(15)
		})

		test('GET_DAY returns UTC day, not local day', () => {
			const ts = Date.UTC(2024, 5, 15, 23, 0, 0)
			const result = execute('GET_DAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			expect(result).toBe(15)
		})

		test('GET_HOUR() extracts hour from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('GET_HOUR(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(14)
		})

		test('GET_HOUR returns UTC hour, not local hour', () => {
			const ts = Date.UTC(2024, 5, 15, 12, 0, 0)
			const result = execute('GET_HOUR(ts)', {
				...defaultContext,
				variables: { ts },
			})
			expect(result).toBe(12)
		})

		test('GET_MINUTE() extracts minute from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('GET_MINUTE(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(30)
		})

		test('GET_SECOND() extracts second from timestamp', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 45)
			const result = execute('GET_SECOND(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(45)
		})

		test('GET_WEEKDAY() extracts day of week', () => {
			const timestamp = Date.UTC(2024, 0, 1)
			const result = execute('GET_WEEKDAY(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBeGreaterThanOrEqual(0)
			expect(result).toBeLessThanOrEqual(6)
		})

		test('GET_WEEKDAY returns UTC day of week', () => {
			const ts = Date.UTC(2024, 5, 15, 12, 0, 0)
			const result = execute('GET_WEEKDAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			expect(result).toBe(6)
		})

		test('GET_MILLISECOND', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 45, 123)
			const result = execute('GET_MILLISECOND(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			expect(result).toBe(123)
		})

		test('GET_DAY_OF_YEAR - Jan 1 is day 1', () => {
			const jan1 = Date.UTC(2024, 0, 1)
			const result = execute('GET_DAY_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: jan1 },
			})
			expect(result).toBe(1)
		})

		test('GET_DAY_OF_YEAR - Dec 31 in leap year is day 366', () => {
			const dec31 = Date.UTC(2024, 11, 31)
			const result = execute('GET_DAY_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: dec31 },
			})
			expect(result).toBe(366)
		})

		test('GET_DAY_OF_YEAR - Dec 31 in non-leap year is day 365', () => {
			const ts = Date.UTC(2023, 11, 31)
			const result = execute('GET_DAY_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts },
			})
			expect(result).toBe(365)
		})

		test('GET_DAY_OF_YEAR - Feb 29 in leap year is day 60', () => {
			const ts = Date.UTC(2024, 1, 29)
			const result = execute('GET_DAY_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts },
			})
			expect(result).toBe(60)
		})

		test('GET_QUARTER', () => {
			const q1 = Date.UTC(2024, 1, 15)
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q1 },
				}),
			).toBe(1)

			const q2 = Date.UTC(2024, 4, 15)
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q2 },
				}),
			).toBe(2)

			const q3 = Date.UTC(2024, 7, 15)
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q3 },
				}),
			).toBe(3)

			const q4 = Date.UTC(2024, 10, 15)
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q4 },
				}),
			).toBe(4)
		})
	})

	describe('START/END OF PERIOD', () => {
		test('START_OF_DAY', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 45, 123)
			const result = execute('START_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const expected = Date.UTC(2024, 5, 15, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('START_OF_DAY uses UTC not local time', () => {
			const ts = Date.UTC(2024, 5, 15, 23, 30, 0)
			const result = execute('START_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			const expected = Date.UTC(2024, 5, 15, 0, 0, 0, 0)
			expect(result).toBe(expected)
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('START_OF_DAY at year boundary', () => {
			const ts = Date.UTC(2024, 0, 1, 12, 0, 0)
			const result = execute('START_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			const expected = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('END_OF_DAY', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 45, 123)
			const result = execute('END_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const expected = Date.UTC(2024, 5, 15, 23, 59, 59, 999)
			expect(result).toBe(expected)
		})

		test('END_OF_DAY uses UTC not local time', () => {
			const ts = Date.UTC(2024, 5, 15, 1, 0, 0)
			const result = execute('END_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			const expected = Date.UTC(2024, 5, 15, 23, 59, 59, 999)
			expect(result).toBe(expected)
		})

		test('END_OF_DAY at year boundary', () => {
			const ts = Date.UTC(2024, 11, 31, 12, 0, 0)
			const result = execute('END_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts },
			})
			const expected = Date.UTC(2024, 11, 31, 23, 59, 59, 999)
			expect(result).toBe(expected)
		})

		test('START_OF_WEEK', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('START_OF_WEEK(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDay()).toBe(0)
			expect(resultDate.getUTCHours()).toBe(0)
			expect(resultDate.getUTCMinutes()).toBe(0)
		})

		test('START_OF_WEEK on Sunday returns same day at midnight', () => {
			const sunday = Date.UTC(2024, 5, 16, 14, 30, 0)
			const result = execute('START_OF_WEEK(ts)', {
				...defaultContext,
				variables: { ts: sunday },
			})
			const expected = Date.UTC(2024, 5, 16, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('START_OF_WEEK on Saturday goes back to previous Sunday', () => {
			const saturday = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('START_OF_WEEK(ts)', {
				...defaultContext,
				variables: { ts: saturday },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDay()).toBe(0)
			expect(resultDate.getUTCDate()).toBe(9)
			expect(resultDate.getUTCHours()).toBe(0)
		})

		test('START_OF_WEEK crosses month boundary', () => {
			const ts = Date.UTC(2024, 6, 2, 10, 0, 0)
			const result = execute('START_OF_WEEK(ts)', {
				...defaultContext,
				variables: { ts },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDay()).toBe(0)
			expect(resultDate.getUTCMonth()).toBe(5)
			expect(resultDate.getUTCDate()).toBe(30)
		})

		test('START_OF_MONTH', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('START_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const expected = Date.UTC(2024, 5, 1, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('END_OF_MONTH', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(30)
			expect(resultDate.getUTCHours()).toBe(23)
			expect(resultDate.getUTCMinutes()).toBe(59)
			expect(resultDate.getUTCSeconds()).toBe(59)
			expect(resultDate.getUTCMilliseconds()).toBe(999)
		})

		test('END_OF_MONTH for February in leap year', () => {
			const feb15 = Date.UTC(2024, 1, 15, 10, 0, 0)
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: feb15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(29)
			expect(resultDate.getUTCHours()).toBe(23)
			expect(resultDate.getUTCMinutes()).toBe(59)
			expect(resultDate.getUTCSeconds()).toBe(59)
			expect(resultDate.getUTCMilliseconds()).toBe(999)
		})

		test('END_OF_MONTH for February in non-leap year', () => {
			const feb15 = Date.UTC(2023, 1, 15, 10, 0, 0)
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: feb15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(28)
		})

		test('END_OF_MONTH for month with 31 days', () => {
			const jan15 = Date.UTC(2024, 0, 15, 10, 0, 0)
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: jan15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(31)
		})

		test('END_OF_MONTH for month with 30 days', () => {
			const jun15 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: jun15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(30)
		})

		test('START_OF_YEAR', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('START_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const expected = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
			expect(result).toBe(expected)
		})

		test('END_OF_YEAR', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('END_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const expected = Date.UTC(2024, 11, 31, 23, 59, 59, 999)
			expect(result).toBe(expected)
		})

		test('START_OF_QUARTER', () => {
			const mayTimestamp = Date.UTC(2024, 4, 15, 10, 0, 0)
			const result = execute('START_OF_QUARTER(ts)', {
				...defaultContext,
				variables: { ts: mayTimestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(3)
			expect(resultDate.getUTCDate()).toBe(1)
			expect(resultDate.getUTCHours()).toBe(0)
		})
	})

	describe('DATE ARITHMETIC', () => {
		test('ADD_DAYS positive', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_DAYS(ts, 7)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(22)
		})

		test('ADD_DAYS negative', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_DAYS(ts, -5)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(10)
		})

		test('ADD_DAYS maintains UTC consistency', () => {
			const ts = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_DAYS(ts, 7)', {
				...defaultContext,
				variables: { ts },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(22)
			expect(resultDate.getUTCHours()).toBe(14)
			expect(resultDate.getUTCMinutes()).toBe(30)
		})

		test('ADD_MONTHS positive', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_MONTHS(ts, 2)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(7)
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('ADD_MONTHS negative', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_MONTHS(ts, -3)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(2)
		})

		test('ADD_MONTHS handles month-end overflow', () => {
			const timestamp = Date.UTC(2024, 0, 31, 14, 30, 0)
			const result = execute('ADD_MONTHS(ts, 1)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(2)
			expect(resultDate.getUTCDate()).toBe(2)
		})

		test('ADD_MONTHS with month-end overflow (Jan 31 + 1 month)', () => {
			const jan31 = Date.UTC(2024, 0, 31, 10, 0, 0)
			const result = execute('ADD_MONTHS(ts, 1)', {
				...defaultContext,
				variables: { ts: jan31 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(2)
			expect(resultDate.getUTCDate()).toBe(2)
		})

		test('ADD_MONTHS negative crosses year boundary', () => {
			const feb2024 = Date.UTC(2024, 1, 15, 10, 0, 0)
			const result = execute('ADD_MONTHS(ts, -3)', {
				...defaultContext,
				variables: { ts: feb2024 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2023)
			expect(resultDate.getUTCMonth()).toBe(10)
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('ADD_MONTHS preserves time components', () => {
			const ts = Date.UTC(2024, 0, 15, 14, 30, 45, 123)
			const result = execute('ADD_MONTHS(ts, 2)', {
				...defaultContext,
				variables: { ts },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCHours()).toBe(14)
			expect(resultDate.getUTCMinutes()).toBe(30)
			expect(resultDate.getUTCSeconds()).toBe(45)
			expect(resultDate.getUTCMilliseconds()).toBe(123)
		})

		test('ADD_YEARS positive', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_YEARS(ts, 5)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2029)
			expect(resultDate.getUTCMonth()).toBe(5)
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('ADD_YEARS negative', () => {
			const timestamp = Date.UTC(2024, 5, 15, 14, 30, 0)
			const result = execute('ADD_YEARS(ts, -2)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2022)
		})

		test('ADD_YEARS from Feb 29 to non-leap year', () => {
			const feb29_2024 = Date.UTC(2024, 1, 29, 10, 0, 0)
			const result = execute('ADD_YEARS(ts, 1)', {
				...defaultContext,
				variables: { ts: feb29_2024 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2025)
			expect(resultDate.getUTCMonth()).toBe(2)
			expect(resultDate.getUTCDate()).toBe(1)
		})

		test('ADD_YEARS negative preserves date', () => {
			const ts = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('ADD_YEARS(ts, -10)', {
				...defaultContext,
				variables: { ts },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2014)
			expect(resultDate.getUTCMonth()).toBe(5)
			expect(resultDate.getUTCDate()).toBe(15)
		})
	})

	describe('TIME DIFFERENCES', () => {
		test('DIFFERENCE_IN_SECONDS', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 0, 30)
			const result = execute('DIFFERENCE_IN_SECONDS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(30)
		})

		test('DIFFERENCE_IN_SECONDS floors fractional seconds', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 0, 10, 750)
			const result = execute('DIFFERENCE_IN_SECONDS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(10)
		})

		test('DIFFERENCE_IN_MINUTES', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 15, 0)
			const result = execute('DIFFERENCE_IN_MINUTES(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(15)
		})

		test('DIFFERENCE_IN_MINUTES floors fractional minutes', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 5, 45)
			const result = execute('DIFFERENCE_IN_MINUTES(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(5)
		})

		test('DIFFERENCE_IN_HOURS', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 14, 0, 0)
			const result = execute('DIFFERENCE_IN_HOURS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(4)
		})

		test('DIFFERENCE_IN_HOURS floors fractional hours', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 13, 45, 30)
			const result = execute('DIFFERENCE_IN_HOURS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_DAYS', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 20, 10, 0, 0)
			const result = execute('DIFFERENCE_IN_DAYS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(5)
		})

		test('DIFFERENCE_IN_DAYS floors fractional days', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 20, 14, 30, 45)
			const result = execute('DIFFERENCE_IN_DAYS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(5)
		})

		test('DIFFERENCE_IN_DAYS is timezone-independent', () => {
			const ts1 = Date.UTC(2024, 5, 10, 12, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 12, 0, 0)
			const result = execute('DIFFERENCE_IN_DAYS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(5)
		})

		test('DIFFERENCE_IN_DAYS partial days are floored consistently', () => {
			const ts1 = Date.UTC(2024, 5, 10, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 16, 30, 0)
			const result = execute('DIFFERENCE_IN_DAYS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(5)
		})

		test('DIFFERENCE_IN_WEEKS', () => {
			const ts1 = Date.UTC(2024, 5, 1, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 22, 10, 0, 0)
			const result = execute('DIFFERENCE_IN_WEEKS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_WEEKS floors fractional weeks', () => {
			const ts1 = Date.UTC(2024, 5, 1, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 23, 14, 0, 0)
			const result = execute('DIFFERENCE_IN_WEEKS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_MONTHS - exact month boundaries', () => {
			const ts1 = Date.UTC(2024, 0, 15)
			const ts2 = Date.UTC(2024, 3, 15)
			const result = execute('DIFFERENCE_IN_MONTHS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_MONTHS - day not reached yet', () => {
			const ts1 = Date.UTC(2024, 0, 15)
			const ts2 = Date.UTC(2024, 1, 14)
			const result = execute('DIFFERENCE_IN_MONTHS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('DIFFERENCE_IN_MONTHS - end of month edge case', () => {
			const ts1 = Date.UTC(2024, 0, 31)
			const ts2 = Date.UTC(2024, 1, 28)
			const result = execute('DIFFERENCE_IN_MONTHS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('DIFFERENCE_IN_MONTHS - crosses year boundary', () => {
			const ts1 = Date.UTC(2023, 10, 15)
			const ts2 = Date.UTC(2024, 1, 15)
			const result = execute('DIFFERENCE_IN_MONTHS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_MONTHS - returns absolute value', () => {
			const ts1 = Date.UTC(2024, 3, 15)
			const ts2 = Date.UTC(2024, 0, 15)
			const result = execute('DIFFERENCE_IN_MONTHS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_YEARS - exact year boundaries', () => {
			const ts1 = Date.UTC(2020, 5, 15)
			const ts2 = Date.UTC(2024, 5, 15)
			const result = execute('DIFFERENCE_IN_YEARS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(4)
		})

		test('DIFFERENCE_IN_YEARS - day not reached yet', () => {
			const ts1 = Date.UTC(2020, 5, 15)
			const ts2 = Date.UTC(2024, 5, 14)
			const result = execute('DIFFERENCE_IN_YEARS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(3)
		})

		test('DIFFERENCE_IN_YEARS - leap year edge case', () => {
			const ts1 = Date.UTC(2020, 1, 29)
			const ts2 = Date.UTC(2021, 1, 28)
			const result = execute('DIFFERENCE_IN_YEARS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('DIFFERENCE_IN_YEARS - leap year to next leap year', () => {
			const ts1 = Date.UTC(2020, 1, 29)
			const ts2 = Date.UTC(2024, 1, 29)
			const result = execute('DIFFERENCE_IN_YEARS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(4)
		})

		test('DIFFERENCE functions return absolute values', () => {
			const ts1 = Date.UTC(2024, 5, 15, 14, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('DIFFERENCE_IN_HOURS(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(4)
		})
	})

	describe('DATE COMPARISON', () => {
		test('Timestamp comparison using < operator', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 14, 0, 0)
			const result = execute('ts1 < ts2 ? 1 : 0', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('Timestamp comparison using > operator', () => {
			const ts1 = Date.UTC(2024, 5, 15, 14, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('ts1 > ts2 ? 1 : 0', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_SAME_DAY returns 1 for same calendar day', () => {
			const ts1 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 23, 0, 0)
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_SAME_DAY returns 0 for different days', () => {
			const ts1 = Date.UTC(2024, 5, 15, 23, 0, 0)
			const ts2 = Date.UTC(2024, 5, 16, 1, 0, 0)
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('IS_SAME_DAY uses UTC, not local time', () => {
			const ts1 = Date.UTC(2024, 5, 15, 1, 0, 0)
			const ts2 = Date.UTC(2024, 5, 15, 23, 0, 0)
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_SAME_DAY returns 0 for adjacent days at midnight', () => {
			const ts1 = Date.UTC(2024, 5, 15, 23, 59, 59, 999)
			const ts2 = Date.UTC(2024, 5, 16, 0, 0, 0, 0)
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('IS_WEEKEND returns 1 for Saturday', () => {
			const saturday = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: saturday },
			})
			expect(result).toBe(1)
		})

		test('IS_WEEKEND returns 1 for Sunday', () => {
			const sunday = Date.UTC(2024, 5, 16, 10, 0, 0)
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: sunday },
			})
			expect(result).toBe(1)
		})

		test('IS_WEEKEND returns 0 for weekday', () => {
			const monday = Date.UTC(2024, 5, 17, 10, 0, 0)
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: monday },
			})
			expect(result).toBe(0)
		})

		test('IS_WEEKEND uses UTC day of week', () => {
			const saturday = Date.UTC(2024, 5, 15, 12, 0, 0)
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: saturday },
			})
			expect(result).toBe(1)
		})

		test('IS_WEEKEND at day boundary', () => {
			const friday = Date.UTC(2024, 5, 14, 23, 59, 59, 999)
			expect(
				execute('IS_WEEKEND(ts)', {
					...defaultContext,
					variables: { ts: friday },
				}),
			).toBe(0)

			const saturday = Date.UTC(2024, 5, 15, 0, 0, 0, 0)
			expect(
				execute('IS_WEEKEND(ts)', {
					...defaultContext,
					variables: { ts: saturday },
				}),
			).toBe(1)
		})

		test('IS_LEAP_YEAR returns 1 for leap year', () => {
			const ts2024 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('IS_LEAP_YEAR(ts)', {
				...defaultContext,
				variables: { ts: ts2024 },
			})
			expect(result).toBe(1)
		})

		test('IS_LEAP_YEAR returns 0 for non-leap year', () => {
			const ts2023 = Date.UTC(2023, 5, 15, 10, 0, 0)
			const result = execute('IS_LEAP_YEAR(ts)', {
				...defaultContext,
				variables: { ts: ts2023 },
			})
			expect(result).toBe(0)
		})

		test('IS_LEAP_YEAR handles century years', () => {
			const ts2000 = Date.UTC(2000, 5, 15, 10, 0, 0)
			expect(
				execute('IS_LEAP_YEAR(ts)', {
					...defaultContext,
					variables: { ts: ts2000 },
				}),
			).toBe(1)

			const ts1900 = Date.UTC(1900, 5, 15, 10, 0, 0)
			expect(
				execute('IS_LEAP_YEAR(ts)', {
					...defaultContext,
					variables: { ts: ts1900 },
				}),
			).toBe(0)
		})
	})

	describe('TIMESTAMP ARITHMETIC', () => {
		test('add milliseconds to timestamp', () => {
			const timestamp = 1704067200000
			const result = execute('t + 1000', {
				variables: { t: timestamp },
			})
			expect(result).toBe(timestamp + 1000)
		})

		test('subtract milliseconds from timestamp', () => {
			const timestamp = 1704067200000
			const result = execute('t - 1000', {
				variables: { t: timestamp },
			})
			expect(result).toBe(timestamp - 1000)
		})

		test('difference between two timestamps', () => {
			const t1 = 1704067200000
			const t2 = 1704153600000
			const result = execute('t2 - t1', {
				variables: { t1, t2 },
			})
			expect(result).toBe(t2 - t1)
		})

		test('NOW() returns timestamp', () => {
			const now = 1704067200000
			const result = execute('NOW()', {
				functions: { NOW: () => now },
			})
			expect(result).toBe(now)
		})

		test('timestamp + time duration', () => {
			const now = 1704067200000
			const result = execute('NOW() + 5 * 60 * 1000', {
				functions: {
					NOW: () => now,
				},
			})
			expect(result).toBe(now + 5 * 60 * 1000)
		})

		test('complex date arithmetic', () => {
			const now = 1704067200000
			const result = execute('NOW() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000', {
				functions: {
					NOW: () => now,
				},
			})
			expect(result).toBe(now + 2 * 60 * 60 * 1000 + 30 * 60 * 1000)
		})

		test('calculate deadline', () => {
			const start = 1704067200000
			const duration = 7 * 24 * 60 * 60 * 1000
			const result = execute('start + duration', {
				variables: { start, duration },
			})
			expect(result).toBe(start + duration)
		})
	})

	describe('INTEGRATION TESTS', () => {
		test('Calculate business days until deadline', () => {
			const today = Date.now()
			const result = execute('ADD_DAYS(START_OF_WEEK(NOW()), 12)', {
				...defaultContext,
			})
			expect(result).toBeGreaterThan(today)
		})

		test('Check if timestamp is in working hours', () => {
			const workdayMorning = Date.UTC(2024, 5, 17, 9, 0, 0)
			const result = execute(
				'GET_HOUR(ts) >= 9 && GET_HOUR(ts) < 17 && IS_WEEKEND(ts) == 0 ? 1 : 0',
				{
					...defaultContext,
					variables: { ts: workdayMorning },
				},
			)
			expect(result).toBe(1)
		})

		test('Calculate age in years using DIFFERENCE_IN_YEARS', () => {
			const birthdate = Date.UTC(1990, 5, 15)
			const today = Date.UTC(2024, 5, 15)
			const result = execute('DIFFERENCE_IN_YEARS(birth, today)', {
				...defaultContext,
				variables: { birth: birthdate, today },
			})
			expect(result).toBe(34)
		})

		test('Get last day of previous month', () => {
			const june15 = Date.UTC(2024, 5, 15, 10, 0, 0)
			const result = execute('ADD_DAYS(START_OF_MONTH(ts), -1)', {
				...defaultContext,
				variables: { ts: june15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(4)
			expect(resultDate.getUTCDate()).toBe(31)
		})

		test('Days until Christmas calculation', () => {
			// Use local time instead of UTC for calendar day calculations
			const today = new Date(2024, 10, 8, 14, 45, 30).getTime()
			const christmas = new Date(2025, 11, 25, 0, 0, 0).getTime()
			const result = execute('DIFFERENCE_IN_DAYS(today, christmas)', {
				...defaultContext,
				variables: { today, christmas },
			})
			// With calendar day logic, Nov 8 2024 to Dec 25 2025 = 412 days
			expect(result).toBe(412)
			expect(Number.isInteger(result)).toBe(true)
		})

		test('Date range calculation is consistent', () => {
			// Use local time for calendar day calculations
			const start = new Date(2024, 0, 1, 0, 0, 0).getTime()
			const end = new Date(2024, 11, 31, 23, 59, 59).getTime()
			const days = execute('DIFFERENCE_IN_DAYS(start, end)', {
				...defaultContext,
				variables: { start, end },
			})
			expect(days).toBe(365)
		})
	})
})
