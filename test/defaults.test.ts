import { describe, expect, test } from 'bun:test'
import { defaultContext, execute } from '../src'

describe('Default Context', () => {
	test('Math.ABS', () => {
		const result = execute('ABS(-42)', defaultContext)
		expect(result).toBe(42)
	})

	test('Math.FLOOR', () => {
		const result = execute('FLOOR(3.7)', defaultContext)
		expect(result).toBe(3)
	})

	test('Math.CEIL', () => {
		const result = execute('CEIL(3.2)', defaultContext)
		expect(result).toBe(4)
	})

	test('Math.ROUND', () => {
		const result = execute('ROUND(3.5)', defaultContext)
		expect(result).toBe(4)
	})

	test('Math.SQRT', () => {
		const result = execute('SQRT(16)', defaultContext)
		expect(result).toBe(4)
	})

	test('exponentiation operator', () => {
		const result = execute('2 ^ 3', defaultContext)
		expect(result).toBe(8)
	})

	test('Math.MAX', () => {
		const result = execute('MAX(1, 5, 3)', defaultContext)
		expect(result).toBe(5)
	})

	test('Math.MIN', () => {
		const result = execute('MIN(1, 5, 3)', defaultContext)
		expect(result).toBe(1)
	})

	test('NOW() returns timestamp', () => {
		const before = Date.now()
		const result = execute('NOW()', defaultContext)
		const after = Date.now()
		expect(typeof result).toBe('number')
		expect(result).toBeGreaterThanOrEqual(before)
		expect(result).toBeLessThanOrEqual(after)
	})

	test('TIMESTAMP() creates timestamp', () => {
		const result = execute('TIMESTAMP(2024, 1, 1)', defaultContext)
		expect(typeof result).toBe('number')
		const date = new Date(result)
		expect(date.getFullYear()).toBe(2024)
		expect(date.getMonth()).toBe(0) // January is 0
		expect(date.getDate()).toBe(1)
	})

	test('TIMESTAMP() with time components', () => {
		const result = execute('TIMESTAMP(2024, 1, 1, 12, 30, 0)', defaultContext)
		expect(typeof result).toBe('number')
		const date = new Date(result)
		expect(date.getFullYear()).toBe(2024)
		expect(date.getHours()).toBe(12)
		expect(date.getMinutes()).toBe(30)
	})

	test('FROM_MILLISECONDS()', () => {
		const result = execute('FROM_MILLISECONDS(1500)', defaultContext)
		expect(result).toBe(1500)
	})

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

	test('NOW() + FROM_MINUTES()', () => {
		const result = execute('NOW() + FROM_MINUTES(5)', defaultContext)
		expect(typeof result).toBe('number')
		expect(result).toBeGreaterThan(Date.now())
	})

	test('spread into custom context', () => {
		const result = execute('ABS(x * -2)', {
			...defaultContext,
			variables: { x: 5 },
		})
		expect(result).toBe(10)
	})
})
