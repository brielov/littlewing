import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { evaluate } from '../src/interpreter'
import { defaultContext } from '../src/stdlib'
import type { RuntimeValue } from '../src/types'

/**
 * Helper to create a context with temporal variables
 */
function dateCtx(vars: Record<string, RuntimeValue>) {
	return { ...defaultContext, variables: vars }
}

describe('Date Utils', () => {
	describe('CORE FUNCTIONS', () => {
		test('TODAY() returns a PlainDate', () => {
			const result = evaluate('TODAY()', defaultContext)
			expect(result).toBeInstanceOf(Temporal.PlainDate)
		})

		test('TODAY() returns current date', () => {
			const result = evaluate('TODAY()', defaultContext) as Temporal.PlainDate
			const now = Temporal.Now.plainDateISO()
			expect(result.equals(now)).toBe(true)
		})

		test('DATE() creates PlainDate', () => {
			const result = evaluate('DATE(2024, 6, 15)', defaultContext)
			expect(result).toBeInstanceOf(Temporal.PlainDate)
			const date = result as Temporal.PlainDate
			expect(date.year).toBe(2024)
			expect(date.month).toBe(6)
			expect(date.day).toBe(15)
		})

		test('DATE() with year, month, day', () => {
			const result = evaluate(
				'DATE(2024, 1, 1)',
				defaultContext,
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(1)
			expect(result.day).toBe(1)
		})

		test('DATE() handles leap year Feb 29', () => {
			const result = evaluate(
				'DATE(2024, 2, 29)',
				defaultContext,
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(2)
			expect(result.day).toBe(29)
		})
	})

	describe('COMPONENT EXTRACTORS', () => {
		const d = new Temporal.PlainDate(2024, 6, 15)

		test('GET_YEAR() extracts year', () => {
			expect(evaluate('GET_YEAR(d)', dateCtx({ d }))).toBe(2024)
		})

		test('GET_MONTH() extracts month (1-based)', () => {
			expect(evaluate('GET_MONTH(d)', dateCtx({ d }))).toBe(6)
		})

		test('GET_DAY() extracts day', () => {
			expect(evaluate('GET_DAY(d)', dateCtx({ d }))).toBe(15)
		})

		test('GET_WEEKDAY() extracts day of week (1=Mon, 7=Sun)', () => {
			// 2024-06-15 is a Saturday
			expect(evaluate('GET_WEEKDAY(d)', dateCtx({ d }))).toBe(6)
		})

		test('GET_DAY_OF_YEAR - Jan 1 is day 1', () => {
			const jan1 = new Temporal.PlainDate(2024, 1, 1)
			expect(evaluate('GET_DAY_OF_YEAR(d)', dateCtx({ d: jan1 }))).toBe(1)
		})

		test('GET_DAY_OF_YEAR - Dec 31 in leap year is day 366', () => {
			const dec31 = new Temporal.PlainDate(2024, 12, 31)
			expect(evaluate('GET_DAY_OF_YEAR(d)', dateCtx({ d: dec31 }))).toBe(366)
		})

		test('GET_DAY_OF_YEAR - Dec 31 in non-leap year is day 365', () => {
			const dec31 = new Temporal.PlainDate(2023, 12, 31)
			expect(evaluate('GET_DAY_OF_YEAR(d)', dateCtx({ d: dec31 }))).toBe(365)
		})

		test('GET_DAY_OF_YEAR - Feb 29 in leap year is day 60', () => {
			const feb29 = new Temporal.PlainDate(2024, 2, 29)
			expect(evaluate('GET_DAY_OF_YEAR(d)', dateCtx({ d: feb29 }))).toBe(60)
		})

		test('GET_QUARTER', () => {
			const q1 = new Temporal.PlainDate(2024, 2, 15)
			expect(evaluate('GET_QUARTER(d)', dateCtx({ d: q1 }))).toBe(1)

			const q2 = new Temporal.PlainDate(2024, 5, 15)
			expect(evaluate('GET_QUARTER(d)', dateCtx({ d: q2 }))).toBe(2)

			const q3 = new Temporal.PlainDate(2024, 8, 15)
			expect(evaluate('GET_QUARTER(d)', dateCtx({ d: q3 }))).toBe(3)

			const q4 = new Temporal.PlainDate(2024, 11, 15)
			expect(evaluate('GET_QUARTER(d)', dateCtx({ d: q4 }))).toBe(4)
		})
	})

	describe('START/END OF PERIOD', () => {
		test('START_OF_MONTH', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'START_OF_MONTH(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(6)
			expect(result.day).toBe(1)
		})

		test('END_OF_MONTH for June (30 days)', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'END_OF_MONTH(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(30)
		})

		test('END_OF_MONTH for February in leap year', () => {
			const d = new Temporal.PlainDate(2024, 2, 15)
			const result = evaluate(
				'END_OF_MONTH(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(29)
		})

		test('END_OF_MONTH for February in non-leap year', () => {
			const d = new Temporal.PlainDate(2023, 2, 15)
			const result = evaluate(
				'END_OF_MONTH(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(28)
		})

		test('END_OF_MONTH for month with 31 days', () => {
			const d = new Temporal.PlainDate(2024, 1, 15)
			const result = evaluate(
				'END_OF_MONTH(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(31)
		})

		test('START_OF_YEAR', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'START_OF_YEAR(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(1)
			expect(result.day).toBe(1)
		})

		test('END_OF_YEAR', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'END_OF_YEAR(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(12)
			expect(result.day).toBe(31)
		})

		test('START_OF_WEEK returns Monday', () => {
			// 2024-06-15 is Saturday (dayOfWeek = 6)
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'START_OF_WEEK(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.dayOfWeek).toBe(1) // Monday
			expect(result.day).toBe(10) // June 10
		})

		test('START_OF_WEEK on Monday returns same day', () => {
			const d = new Temporal.PlainDate(2024, 6, 10) // Monday
			const result = evaluate(
				'START_OF_WEEK(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.equals(d)).toBe(true)
		})

		test('START_OF_WEEK on Sunday goes back to previous Monday', () => {
			const d = new Temporal.PlainDate(2024, 6, 16) // Sunday
			const result = evaluate(
				'START_OF_WEEK(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.dayOfWeek).toBe(1)
			expect(result.day).toBe(10)
		})

		test('START_OF_WEEK crosses month boundary', () => {
			const d = new Temporal.PlainDate(2024, 7, 2) // Tuesday
			const result = evaluate(
				'START_OF_WEEK(d)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.dayOfWeek).toBe(1)
			expect(result.month).toBe(7)
			expect(result.day).toBe(1)
		})

		test('START_OF_QUARTER', () => {
			const may = new Temporal.PlainDate(2024, 5, 15)
			const result = evaluate(
				'START_OF_QUARTER(d)',
				dateCtx({ d: may }),
			) as Temporal.PlainDate
			expect(result.month).toBe(4)
			expect(result.day).toBe(1)
		})

		test('START_OF_QUARTER for Q1', () => {
			const jan = new Temporal.PlainDate(2024, 2, 15)
			const result = evaluate(
				'START_OF_QUARTER(d)',
				dateCtx({ d: jan }),
			) as Temporal.PlainDate
			expect(result.month).toBe(1)
			expect(result.day).toBe(1)
		})
	})

	describe('DATE ARITHMETIC', () => {
		test('ADD_DAYS positive', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_DAYS(d, 7)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(22)
			expect(result.month).toBe(6)
		})

		test('ADD_DAYS negative', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_DAYS(d, -5)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.day).toBe(10)
		})

		test('ADD_DAYS crosses month boundary', () => {
			const d = new Temporal.PlainDate(2024, 6, 28)
			const result = evaluate(
				'ADD_DAYS(d, 5)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.month).toBe(7)
			expect(result.day).toBe(3)
		})

		test('ADD_MONTHS positive', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_MONTHS(d, 2)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.month).toBe(8)
			expect(result.day).toBe(15)
		})

		test('ADD_MONTHS negative', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_MONTHS(d, -3)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.month).toBe(3)
		})

		test('ADD_MONTHS handles month-end overflow', () => {
			const d = new Temporal.PlainDate(2024, 1, 31)
			const result = evaluate(
				'ADD_MONTHS(d, 1)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			// Temporal clamps to last valid day of month
			expect(result.month).toBe(2)
			expect(result.day).toBe(29) // 2024 is a leap year
		})

		test('ADD_MONTHS negative crosses year boundary', () => {
			const d = new Temporal.PlainDate(2024, 2, 15)
			const result = evaluate(
				'ADD_MONTHS(d, -3)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2023)
			expect(result.month).toBe(11)
			expect(result.day).toBe(15)
		})

		test('ADD_YEARS positive', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_YEARS(d, 5)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2029)
			expect(result.month).toBe(6)
			expect(result.day).toBe(15)
		})

		test('ADD_YEARS negative', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_YEARS(d, -2)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2022)
		})

		test('ADD_YEARS from Feb 29 to non-leap year', () => {
			const d = new Temporal.PlainDate(2024, 2, 29)
			const result = evaluate(
				'ADD_YEARS(d, 1)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2025)
			expect(result.month).toBe(2)
			expect(result.day).toBe(28) // Temporal clamps to last valid day
		})
	})

	describe('TIME DIFFERENCES', () => {
		test('DIFFERENCE_IN_DAYS', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 20)
			expect(evaluate('DIFFERENCE_IN_DAYS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				5,
			)
		})

		test('DIFFERENCE_IN_DAYS returns absolute value', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 20)
			const d2 = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('DIFFERENCE_IN_DAYS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				5,
			)
		})

		test('DIFFERENCE_IN_WEEKS', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 1)
			const d2 = new Temporal.PlainDate(2024, 6, 22)
			expect(evaluate('DIFFERENCE_IN_WEEKS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				3,
			)
		})

		test('DIFFERENCE_IN_MONTHS - exact month boundaries', () => {
			const d1 = new Temporal.PlainDate(2024, 1, 15)
			const d2 = new Temporal.PlainDate(2024, 4, 15)
			expect(
				evaluate('DIFFERENCE_IN_MONTHS(d1, d2)', dateCtx({ d1, d2 })),
			).toBe(3)
		})

		test('DIFFERENCE_IN_MONTHS - day not reached yet', () => {
			const d1 = new Temporal.PlainDate(2024, 1, 15)
			const d2 = new Temporal.PlainDate(2024, 2, 14)
			expect(
				evaluate('DIFFERENCE_IN_MONTHS(d1, d2)', dateCtx({ d1, d2 })),
			).toBe(0)
		})

		test('DIFFERENCE_IN_MONTHS - crosses year boundary', () => {
			const d1 = new Temporal.PlainDate(2023, 11, 15)
			const d2 = new Temporal.PlainDate(2024, 2, 15)
			expect(
				evaluate('DIFFERENCE_IN_MONTHS(d1, d2)', dateCtx({ d1, d2 })),
			).toBe(3)
		})

		test('DIFFERENCE_IN_MONTHS - returns absolute value', () => {
			const d1 = new Temporal.PlainDate(2024, 4, 15)
			const d2 = new Temporal.PlainDate(2024, 1, 15)
			expect(
				evaluate('DIFFERENCE_IN_MONTHS(d1, d2)', dateCtx({ d1, d2 })),
			).toBe(3)
		})

		test('DIFFERENCE_IN_YEARS - exact year boundaries', () => {
			const d1 = new Temporal.PlainDate(2020, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('DIFFERENCE_IN_YEARS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				4,
			)
		})

		test('DIFFERENCE_IN_YEARS - day not reached yet', () => {
			const d1 = new Temporal.PlainDate(2020, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 14)
			expect(evaluate('DIFFERENCE_IN_YEARS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				3,
			)
		})

		test('DIFFERENCE_IN_YEARS - leap year edge case', () => {
			const d1 = new Temporal.PlainDate(2020, 2, 29)
			const d2 = new Temporal.PlainDate(2021, 2, 28)
			expect(evaluate('DIFFERENCE_IN_YEARS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				0,
			)
		})

		test('DIFFERENCE_IN_YEARS - leap year to next leap year', () => {
			const d1 = new Temporal.PlainDate(2020, 2, 29)
			const d2 = new Temporal.PlainDate(2024, 2, 29)
			expect(evaluate('DIFFERENCE_IN_YEARS(d1, d2)', dateCtx({ d1, d2 }))).toBe(
				4,
			)
		})
	})

	describe('DATE COMPARISON', () => {
		test('date comparison using < operator', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 20)
			expect(evaluate('d1 < d2', dateCtx({ d1, d2 }))).toBe(true)
		})

		test('date comparison using > operator', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 20)
			const d2 = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('d1 > d2', dateCtx({ d1, d2 }))).toBe(true)
		})

		test('date equality using ==', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('d1 == d2', dateCtx({ d1, d2 }))).toBe(true)
		})

		test('IS_SAME_DAY returns true for same date', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('IS_SAME_DAY(d1, d2)', dateCtx({ d1, d2 }))).toBe(true)
		})

		test('IS_SAME_DAY returns false for different dates', () => {
			const d1 = new Temporal.PlainDate(2024, 6, 15)
			const d2 = new Temporal.PlainDate(2024, 6, 16)
			expect(evaluate('IS_SAME_DAY(d1, d2)', dateCtx({ d1, d2 }))).toBe(false)
		})

		test('IS_WEEKEND returns true for Saturday', () => {
			const d = new Temporal.PlainDate(2024, 6, 15) // Saturday
			expect(evaluate('IS_WEEKEND(d)', dateCtx({ d }))).toBe(true)
		})

		test('IS_WEEKEND returns true for Sunday', () => {
			const d = new Temporal.PlainDate(2024, 6, 16) // Sunday
			expect(evaluate('IS_WEEKEND(d)', dateCtx({ d }))).toBe(true)
		})

		test('IS_WEEKEND returns false for weekday', () => {
			const d = new Temporal.PlainDate(2024, 6, 17) // Monday
			expect(evaluate('IS_WEEKEND(d)', dateCtx({ d }))).toBe(false)
		})

		test('IS_LEAP_YEAR returns true for leap year', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			expect(evaluate('IS_LEAP_YEAR(d)', dateCtx({ d }))).toBe(true)
		})

		test('IS_LEAP_YEAR returns false for non-leap year', () => {
			const d = new Temporal.PlainDate(2023, 6, 15)
			expect(evaluate('IS_LEAP_YEAR(d)', dateCtx({ d }))).toBe(false)
		})

		test('IS_LEAP_YEAR handles century years', () => {
			const d2000 = new Temporal.PlainDate(2000, 6, 15)
			expect(evaluate('IS_LEAP_YEAR(d)', dateCtx({ d: d2000 }))).toBe(true)

			const d1900 = new Temporal.PlainDate(1900, 6, 15)
			expect(evaluate('IS_LEAP_YEAR(d)', dateCtx({ d: d1900 }))).toBe(false)
		})
	})

	describe('INTEGRATION TESTS', () => {
		test('Calculate age in years', () => {
			const birth = new Temporal.PlainDate(1990, 6, 15)
			const today = new Temporal.PlainDate(2024, 6, 15)
			expect(
				evaluate(
					'DIFFERENCE_IN_YEARS(birth, today)',
					dateCtx({ birth, today }),
				),
			).toBe(34)
		})

		test('Get last day of previous month', () => {
			const d = new Temporal.PlainDate(2024, 6, 15)
			const result = evaluate(
				'ADD_DAYS(START_OF_MONTH(d), -1)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.month).toBe(5)
			expect(result.day).toBe(31)
		})

		test('Days between two dates', () => {
			const start = new Temporal.PlainDate(2024, 1, 1)
			const end = new Temporal.PlainDate(2024, 12, 31)
			expect(
				evaluate('DIFFERENCE_IN_DAYS(start, end)', dateCtx({ start, end })),
			).toBe(365)
		})

		test('Date arithmetic chain', () => {
			const d = new Temporal.PlainDate(2024, 1, 15)
			const result = evaluate(
				'ADD_MONTHS(ADD_DAYS(d, 10), 2)',
				dateCtx({ d }),
			) as Temporal.PlainDate
			expect(result.year).toBe(2024)
			expect(result.month).toBe(3)
			expect(result.day).toBe(25)
		})

		test('Check if date is in Q1', () => {
			const d = new Temporal.PlainDate(2024, 2, 15)
			expect(evaluate('GET_QUARTER(d) == 1', dateCtx({ d }))).toBe(true)
		})
	})

	describe('PlainDateTime support', () => {
		const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 0)

		describe('EXTRACTORS with PlainDateTime', () => {
			test('GET_YEAR()', () => {
				expect(evaluate('GET_YEAR(dt)', dateCtx({ dt }))).toBe(2024)
			})

			test('GET_MONTH()', () => {
				expect(evaluate('GET_MONTH(dt)', dateCtx({ dt }))).toBe(6)
			})

			test('GET_DAY()', () => {
				expect(evaluate('GET_DAY(dt)', dateCtx({ dt }))).toBe(15)
			})

			test('GET_WEEKDAY()', () => {
				// 2024-06-15 is a Saturday
				expect(evaluate('GET_WEEKDAY(dt)', dateCtx({ dt }))).toBe(6)
			})

			test('GET_DAY_OF_YEAR()', () => {
				const jan1 = new Temporal.PlainDateTime(2024, 1, 1, 12, 0, 0)
				expect(evaluate('GET_DAY_OF_YEAR(dt)', dateCtx({ dt: jan1 }))).toBe(1)
			})

			test('GET_QUARTER()', () => {
				expect(evaluate('GET_QUARTER(dt)', dateCtx({ dt }))).toBe(2)
			})
		})

		describe('ARITHMETIC with PlainDateTime', () => {
			test('ADD_DAYS() preserves PlainDateTime type', () => {
				const result = evaluate(
					'ADD_DAYS(dt, 7)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.day).toBe(22)
				expect(result.hour).toBe(14)
				expect(result.minute).toBe(30)
			})

			test('ADD_MONTHS() preserves PlainDateTime type', () => {
				const result = evaluate(
					'ADD_MONTHS(dt, 2)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.month).toBe(8)
				expect(result.hour).toBe(14)
			})

			test('ADD_YEARS() preserves PlainDateTime type', () => {
				const result = evaluate(
					'ADD_YEARS(dt, 1)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.year).toBe(2025)
				expect(result.hour).toBe(14)
			})
		})

		describe('DIFFERENCES with PlainDateTime', () => {
			test('DIFFERENCE_IN_DAYS() between PlainDateTimes', () => {
				const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
				const dt2 = new Temporal.PlainDateTime(2024, 6, 20, 18, 0, 0)
				expect(
					evaluate('DIFFERENCE_IN_DAYS(dt1, dt2)', dateCtx({ dt1, dt2 })),
				).toBe(5)
			})

			test('DIFFERENCE_IN_MONTHS() between PlainDateTimes', () => {
				const dt1 = new Temporal.PlainDateTime(2024, 1, 15, 10, 0, 0)
				const dt2 = new Temporal.PlainDateTime(2024, 4, 15, 18, 0, 0)
				expect(
					evaluate('DIFFERENCE_IN_MONTHS(dt1, dt2)', dateCtx({ dt1, dt2 })),
				).toBe(3)
			})

			test('DIFFERENCE_IN_YEARS() between PlainDateTimes', () => {
				const dt1 = new Temporal.PlainDateTime(2020, 6, 15, 10, 0, 0)
				const dt2 = new Temporal.PlainDateTime(2024, 6, 15, 18, 0, 0)
				expect(
					evaluate('DIFFERENCE_IN_YEARS(dt1, dt2)', dateCtx({ dt1, dt2 })),
				).toBe(4)
			})

			test('mixed date+datetime rejects', () => {
				const d = new Temporal.PlainDate(2024, 6, 15)
				expect(() =>
					evaluate('DIFFERENCE_IN_DAYS(d, dt)', dateCtx({ d, dt })),
				).toThrow(TypeError)
			})

			test('mixed datetime+date rejects', () => {
				const d = new Temporal.PlainDate(2024, 6, 15)
				expect(() =>
					evaluate('DIFFERENCE_IN_DAYS(dt, d)', dateCtx({ dt, d })),
				).toThrow(TypeError)
			})
		})

		describe('PERIOD BOUNDARIES with PlainDateTime', () => {
			test('START_OF_MONTH() preserves PlainDateTime type', () => {
				const result = evaluate(
					'START_OF_MONTH(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.day).toBe(1)
				expect(result.hour).toBe(14)
			})

			test('END_OF_MONTH() preserves PlainDateTime type', () => {
				const result = evaluate(
					'END_OF_MONTH(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.day).toBe(30)
			})

			test('START_OF_YEAR() preserves PlainDateTime type', () => {
				const result = evaluate(
					'START_OF_YEAR(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.month).toBe(1)
				expect(result.day).toBe(1)
			})

			test('END_OF_YEAR() preserves PlainDateTime type', () => {
				const result = evaluate(
					'END_OF_YEAR(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.month).toBe(12)
				expect(result.day).toBe(31)
			})

			test('START_OF_WEEK() preserves PlainDateTime type', () => {
				// 2024-06-15 Saturday → Monday 2024-06-10
				const result = evaluate(
					'START_OF_WEEK(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.dayOfWeek).toBe(1)
				expect(result.day).toBe(10)
			})

			test('START_OF_QUARTER() preserves PlainDateTime type', () => {
				const result = evaluate(
					'START_OF_QUARTER(dt)',
					dateCtx({ dt }),
				) as Temporal.PlainDateTime
				expect(result).toBeInstanceOf(Temporal.PlainDateTime)
				expect(result.month).toBe(4)
				expect(result.day).toBe(1)
			})
		})

		describe('COMPARISONS with PlainDateTime', () => {
			test('IS_SAME_DAY() same day different time', () => {
				const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
				const dt2 = new Temporal.PlainDateTime(2024, 6, 15, 22, 30, 0)
				expect(evaluate('IS_SAME_DAY(dt1, dt2)', dateCtx({ dt1, dt2 }))).toBe(
					true,
				)
			})

			test('IS_SAME_DAY() different days', () => {
				const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
				const dt2 = new Temporal.PlainDateTime(2024, 6, 16, 10, 0, 0)
				expect(evaluate('IS_SAME_DAY(dt1, dt2)', dateCtx({ dt1, dt2 }))).toBe(
					false,
				)
			})

			test('IS_SAME_DAY() mixed date+datetime', () => {
				const d = new Temporal.PlainDate(2024, 6, 15)
				expect(evaluate('IS_SAME_DAY(d, dt)', dateCtx({ d, dt }))).toBe(true)
			})

			test('IS_SAME_DAY() mixed datetime+date', () => {
				const d = new Temporal.PlainDate(2024, 6, 15)
				expect(evaluate('IS_SAME_DAY(dt, d)', dateCtx({ dt, d }))).toBe(true)
			})

			test('IS_WEEKEND() with PlainDateTime', () => {
				// 2024-06-15 is Saturday
				expect(evaluate('IS_WEEKEND(dt)', dateCtx({ dt }))).toBe(true)
				const monday = new Temporal.PlainDateTime(2024, 6, 17, 10, 0, 0)
				expect(evaluate('IS_WEEKEND(dt)', dateCtx({ dt: monday }))).toBe(false)
			})

			test('IS_LEAP_YEAR() with PlainDateTime', () => {
				expect(evaluate('IS_LEAP_YEAR(dt)', dateCtx({ dt }))).toBe(true)
				const nonLeap = new Temporal.PlainDateTime(2023, 6, 15, 10, 0, 0)
				expect(evaluate('IS_LEAP_YEAR(dt)', dateCtx({ dt: nonLeap }))).toBe(
					false,
				)
			})
		})
	})
})
