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
			expect(typeof result).toBe('number')
			const date = new Date(result)
			expect(date.getFullYear()).toBe(2024)
			expect(date.getMonth()).toBe(0) // January is 0
			expect(date.getDate()).toBe(1)
		})

		test('DATE() with all components', () => {
			const result = execute('DATE(2024, 6, 15, 12, 30, 45)', defaultContext)
			expect(typeof result).toBe('number')
			const date = new Date(result)
			expect(date.getFullYear()).toBe(2024)
			expect(date.getMonth()).toBe(5) // June is 5 (0-based)
			expect(date.getDate()).toBe(15)
			expect(date.getHours()).toBe(12)
			expect(date.getMinutes()).toBe(30)
			expect(date.getSeconds()).toBe(45)
		})
	})

	describe('TIME CONVERTERS', () => {
		test('FROM_SECONDS()', () => {
			const result = execute('FROM_SECONDS(5)', defaultContext)
			expect(result).toBe(5000)
		})

		test('FROM_MINUTES()', () => {
			const result = execute('FROM_MINUTES(2)', defaultContext)
			expect(result).toBe(2 * 60 * 1000)
		})

		test('FROM_HOURS()', () => {
			const result = execute('FROM_HOURS(1)', defaultContext)
			expect(result).toBe(60 * 60 * 1000)
		})

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
			expect(result).toBe(30 * 24 * 60 * 60 * 1000) // 30 days in ms
		})

		test('FROM_YEARS', () => {
			const result = execute('FROM_YEARS(1)', defaultContext)
			expect(result).toBe(365 * 24 * 60 * 60 * 1000) // 365 days in ms
		})

		test('NOW() + FROM_MINUTES()', () => {
			const result = execute('NOW() + FROM_MINUTES(5)', defaultContext)
			expect(typeof result).toBe('number')
			expect(result).toBeGreaterThan(Date.now())
		})
	})

	describe('COMPONENT EXTRACTORS', () => {
		test('GET_YEAR() extracts year from timestamp', () => {
			const timestamp = new Date('2024-06-15').getTime()
			const result = execute('GET_YEAR(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(2024)
		})

		test('GET_MONTH() extracts month from timestamp', () => {
			const timestamp = new Date('2024-06-15').getTime()
			const result = execute('GET_MONTH(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(6) // 1-based: June = 6
		})

		test('GET_DAY() extracts day from timestamp', () => {
			const timestamp = new Date('2024-06-15').getTime()
			const result = execute('GET_DAY(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(15)
		})

		test('GET_HOUR() extracts hour from timestamp', () => {
			const timestamp = new Date('2024-06-15T14:30:00').getTime()
			const result = execute('GET_HOUR(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(14)
		})

		test('GET_MINUTE() extracts minute from timestamp', () => {
			const timestamp = new Date('2024-06-15T14:30:00').getTime()
			const result = execute('GET_MINUTE(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(30)
		})

		test('GET_SECOND() extracts second from timestamp', () => {
			const timestamp = new Date('2024-06-15T14:30:45').getTime()
			const result = execute('GET_SECOND(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBe(45)
		})

		test('GET_WEEKDAY() extracts day of week', () => {
			const timestamp = new Date('2024-01-01').getTime() // Monday
			const result = execute('GET_WEEKDAY(t)', {
				...defaultContext,
				variables: { t: timestamp },
			})
			expect(result).toBeGreaterThanOrEqual(0)
			expect(result).toBeLessThanOrEqual(6)
		})

		test('GET_MILLISECOND', () => {
			const timestamp = new Date('2024-06-15T14:30:45.123Z').getTime()
			const result = execute('GET_MILLISECOND(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			expect(result).toBe(123)
		})

		test('GET_DAY_OF_YEAR', () => {
			// Jan 1 = day 1
			const jan1 = new Date('2024-01-01T10:00:00Z').getTime()
			expect(
				execute('GET_DAY_OF_YEAR(ts)', {
					...defaultContext,
					variables: { ts: jan1 },
				}),
			).toBe(1)

			// Dec 31 in leap year = day 366
			const dec31 = new Date('2024-12-31T10:00:00Z').getTime()
			expect(
				execute('GET_DAY_OF_YEAR(ts)', {
					...defaultContext,
					variables: { ts: dec31 },
				}),
			).toBe(366)
		})

		test('GET_QUARTER', () => {
			const q1 = new Date('2024-02-15T10:00:00Z').getTime()
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q1 },
				}),
			).toBe(1)

			const q2 = new Date('2024-05-15T10:00:00Z').getTime()
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q2 },
				}),
			).toBe(2)

			const q3 = new Date('2024-08-15T10:00:00Z').getTime()
			expect(
				execute('GET_QUARTER(ts)', {
					...defaultContext,
					variables: { ts: q3 },
				}),
			).toBe(3)

			const q4 = new Date('2024-11-15T10:00:00Z').getTime()
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
			// 2024-06-15 14:30:45.123 → 2024-06-15 00:00:00.000
			const timestamp = new Date('2024-06-15T14:30:45.123Z').getTime()
			const result = execute('START_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCHours()).toBe(0)
			expect(resultDate.getUTCMinutes()).toBe(0)
			expect(resultDate.getUTCSeconds()).toBe(0)
			expect(resultDate.getUTCMilliseconds()).toBe(0)
		})

		test('END_OF_DAY', () => {
			// 2024-06-15 14:30:45.123 → 2024-06-15 23:59:59.999
			const timestamp = new Date('2024-06-15T14:30:45.123Z').getTime()
			const result = execute('END_OF_DAY(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCHours()).toBe(23)
			expect(resultDate.getUTCMinutes()).toBe(59)
			expect(resultDate.getUTCSeconds()).toBe(59)
			expect(resultDate.getUTCMilliseconds()).toBe(999)
		})

		test('START_OF_WEEK', () => {
			// 2024-06-15 (Saturday) → 2024-06-09 (Sunday)
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('START_OF_WEEK(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDay()).toBe(0) // Sunday
			expect(resultDate.getUTCHours()).toBe(0)
			expect(resultDate.getUTCMinutes()).toBe(0)
		})

		test('START_OF_MONTH', () => {
			// 2024-06-15 → 2024-06-01
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('START_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(1)
			expect(resultDate.getUTCHours()).toBe(0)
		})

		test('END_OF_MONTH', () => {
			// 2024-06-15 → 2024-06-30 (June has 30 days)
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(30)
			expect(resultDate.getUTCHours()).toBe(23)
			expect(resultDate.getUTCMinutes()).toBe(59)
		})

		test('END_OF_MONTH handles leap year', () => {
			// 2024-02-15 → 2024-02-29 (2024 is leap year)
			const timestamp = new Date('2024-02-15T14:30:00Z').getTime()
			const result = execute('END_OF_MONTH(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(29)
		})

		test('START_OF_YEAR', () => {
			// 2024-06-15 → 2024-01-01
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('START_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2024)
			expect(resultDate.getUTCMonth()).toBe(0) // January
			expect(resultDate.getUTCDate()).toBe(1)
		})

		test('END_OF_YEAR', () => {
			// 2024-06-15 → 2024-12-31
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('END_OF_YEAR(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(11) // December
			expect(resultDate.getUTCDate()).toBe(31)
		})

		test('START_OF_QUARTER', () => {
			// Q2 starts April 1
			const mayTimestamp = new Date('2024-05-15T10:00:00Z').getTime()
			const result = execute('START_OF_QUARTER(ts)', {
				...defaultContext,
				variables: { ts: mayTimestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(3) // April (0-indexed)
			expect(resultDate.getUTCDate()).toBe(1)
			expect(resultDate.getUTCHours()).toBe(0)
		})
	})

	describe('DATE ARITHMETIC', () => {
		test('ADD_DAYS positive', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_DAYS(ts, 7)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(22)
		})

		test('ADD_DAYS negative', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_DAYS(ts, -5)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCDate()).toBe(10)
		})

		test('ADD_MONTHS positive', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_MONTHS(ts, 2)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(7) // August (0-indexed)
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('ADD_MONTHS negative', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_MONTHS(ts, -3)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(2) // March
		})

		test('ADD_MONTHS handles month-end overflow', () => {
			// Jan 31 + 1 month → March 2 (JavaScript Date overflow behavior)
			// This is expected: Feb only has 29 days in 2024, so 31 → 29+2 = March 2
			const timestamp = new Date('2024-01-31T14:30:00Z').getTime()
			const result = execute('ADD_MONTHS(ts, 1)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(2) // March (overflow from Feb)
			expect(resultDate.getUTCDate()).toBe(2) // March 2nd
		})

		test('ADD_YEARS positive', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_YEARS(ts, 5)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2029)
			expect(resultDate.getUTCMonth()).toBe(5) // June
			expect(resultDate.getUTCDate()).toBe(15)
		})

		test('ADD_YEARS negative', () => {
			const timestamp = new Date('2024-06-15T14:30:00Z').getTime()
			const result = execute('ADD_YEARS(ts, -2)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCFullYear()).toBe(2022)
		})
	})

	describe('DATE COMPARISON', () => {
		test('IS_BEFORE returns 1 when ts1 < ts2', () => {
			const ts1 = new Date('2024-06-15T10:00:00Z').getTime()
			const ts2 = new Date('2024-06-15T14:00:00Z').getTime()
			const result = execute('IS_BEFORE(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_BEFORE returns 0 when ts1 >= ts2', () => {
			const ts1 = new Date('2024-06-15T14:00:00Z').getTime()
			const ts2 = new Date('2024-06-15T10:00:00Z').getTime()
			const result = execute('IS_BEFORE(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('IS_AFTER returns 1 when ts1 > ts2', () => {
			const ts1 = new Date('2024-06-15T14:00:00Z').getTime()
			const ts2 = new Date('2024-06-15T10:00:00Z').getTime()
			const result = execute('IS_AFTER(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_AFTER returns 0 when ts1 <= ts2', () => {
			const ts1 = new Date('2024-06-15T10:00:00Z').getTime()
			const ts2 = new Date('2024-06-15T14:00:00Z').getTime()
			const result = execute('IS_AFTER(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('IS_SAME_DAY returns 1 for same calendar day', () => {
			const ts1 = new Date('2024-06-15T10:00:00Z').getTime()
			const ts2 = new Date('2024-06-15T23:00:00Z').getTime()
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(1)
		})

		test('IS_SAME_DAY returns 0 for different days', () => {
			const ts1 = new Date('2024-06-15T23:00:00Z').getTime()
			const ts2 = new Date('2024-06-16T01:00:00Z').getTime()
			const result = execute('IS_SAME_DAY(ts1, ts2)', {
				...defaultContext,
				variables: { ts1, ts2 },
			})
			expect(result).toBe(0)
		})

		test('IS_WEEKEND returns 1 for Saturday', () => {
			const saturday = new Date('2024-06-15T10:00:00Z').getTime() // June 15, 2024 is Saturday
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: saturday },
			})
			expect(result).toBe(1)
		})

		test('IS_WEEKEND returns 1 for Sunday', () => {
			const sunday = new Date('2024-06-16T10:00:00Z').getTime() // June 16, 2024 is Sunday
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: sunday },
			})
			expect(result).toBe(1)
		})

		test('IS_WEEKEND returns 0 for weekday', () => {
			const monday = new Date('2024-06-17T10:00:00Z').getTime() // June 17, 2024 is Monday
			const result = execute('IS_WEEKEND(ts)', {
				...defaultContext,
				variables: { ts: monday },
			})
			expect(result).toBe(0)
		})

		test('IS_LEAP_YEAR returns 1 for leap year', () => {
			const ts2024 = new Date('2024-06-15T10:00:00Z').getTime()
			const result = execute('IS_LEAP_YEAR(ts)', {
				...defaultContext,
				variables: { ts: ts2024 },
			})
			expect(result).toBe(1)
		})

		test('IS_LEAP_YEAR returns 0 for non-leap year', () => {
			const ts2023 = new Date('2023-06-15T10:00:00Z').getTime()
			const result = execute('IS_LEAP_YEAR(ts)', {
				...defaultContext,
				variables: { ts: ts2023 },
			})
			expect(result).toBe(0)
		})

		test('IS_LEAP_YEAR handles century years', () => {
			// 2000 was leap year (divisible by 400)
			const ts2000 = new Date('2000-06-15T10:00:00Z').getTime()
			expect(
				execute('IS_LEAP_YEAR(ts)', {
					...defaultContext,
					variables: { ts: ts2000 },
				}),
			).toBe(1)

			// 1900 was not leap year (divisible by 100 but not 400)
			const ts1900 = new Date('1900-06-15T10:00:00Z').getTime()
			expect(
				execute('IS_LEAP_YEAR(ts)', {
					...defaultContext,
					variables: { ts: ts1900 },
				}),
			).toBe(0)
		})
	})

	describe('UNIX TIME CONVERSIONS', () => {
		test('TO_UNIX_SECONDS', () => {
			const timestamp = 1718460000000 // milliseconds
			const result = execute('TO_UNIX_SECONDS(ts)', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			expect(result).toBe(1718460000) // seconds
		})

		test('FROM_UNIX_SECONDS', () => {
			const unixSeconds = 1718460000
			const result = execute('FROM_UNIX_SECONDS(s)', {
				...defaultContext,
				variables: { s: unixSeconds },
			})
			expect(result).toBe(1718460000000) // milliseconds
		})

		test('TO_UNIX_SECONDS and FROM_UNIX_SECONDS round-trip', () => {
			const timestamp = Date.now()
			const result = execute('FROM_UNIX_SECONDS(TO_UNIX_SECONDS(ts))', {
				...defaultContext,
				variables: { ts: timestamp },
			})
			// Should be within 1 second due to floor in TO_UNIX_SECONDS
			expect(Math.abs(result - timestamp)).toBeLessThan(1000)
		})
	})

	describe('INTEGRATION TESTS', () => {
		test('Calculate business days until deadline', () => {
			// Get start of next week + 5 days (Friday)
			const today = Date.now()
			const result = execute('ADD_DAYS(START_OF_WEEK(NOW()), 12)', {
				...defaultContext,
			})
			expect(result).toBeGreaterThan(today)
		})

		test('Check if timestamp is in working hours', () => {
			const workdayMorning = new Date('2024-06-17T09:00:00Z').getTime() // Monday 9 AM
			// GET_HOUR(ts) >= 9 && GET_HOUR(ts) < 17 && !IS_WEEKEND(ts)
			const result = execute(
				'GET_HOUR(ts) >= 9 && GET_HOUR(ts) < 17 && IS_WEEKEND(ts) == 0 ? 1 : 0',
				{
					...defaultContext,
					variables: { ts: workdayMorning },
				},
			)
			expect(result).toBe(1)
		})

		test('Calculate age in years', () => {
			const birthdate = new Date('1990-06-15T00:00:00Z').getTime()
			const today = new Date('2024-06-15T00:00:00Z').getTime()
			// Simple age: (today - birthdate) / FROM_YEARS(1)
			const result = execute('FLOOR((today - birth) / FROM_YEARS(1))', {
				...defaultContext,
				variables: { birth: birthdate, today },
			})
			expect(result).toBe(34)
		})

		test('Get last day of previous month', () => {
			const june15 = new Date('2024-06-15T10:00:00Z').getTime()
			// ADD_DAYS(START_OF_MONTH(ts), -1)
			const result = execute('ADD_DAYS(START_OF_MONTH(ts), -1)', {
				...defaultContext,
				variables: { ts: june15 },
			})
			const resultDate = new Date(result)
			expect(resultDate.getUTCMonth()).toBe(4) // May
			expect(resultDate.getUTCDate()).toBe(31)
		})
	})
})
