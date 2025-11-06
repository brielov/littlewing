import { describe, expect, test } from 'bun:test'
import { execute } from '../src'

describe('Timestamps', () => {
	test('add milliseconds to timestamp', () => {
		const timestamp = 1704067200000 // 2024-01-01T00:00:00Z
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
		const t1 = 1704067200000 // 2024-01-01T00:00:00Z
		const t2 = 1704153600000 // 2024-01-02T00:00:00Z
		const result = execute('t2 - t1', {
			variables: { t1, t2 },
		})
		expect(result).toBe(t2 - t1) // 86400000 milliseconds (1 day)
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
		const result = execute('NOW() + FROM_MINUTES(5)', {
			functions: {
				NOW: () => now,
				FROM_MINUTES: (m: number) => m * 60 * 1000,
			},
		})
		expect(result).toBe(now + 5 * 60 * 1000)
	})

	test('complex date arithmetic', () => {
		const now = 1704067200000
		const result = execute('NOW() + FROM_HOURS(2) + FROM_MINUTES(30)', {
			functions: {
				NOW: () => now,
				FROM_HOURS: (h: number) => h * 60 * 60 * 1000,
				FROM_MINUTES: (m: number) => m * 60 * 1000,
			},
		})
		expect(result).toBe(now + 2 * 60 * 60 * 1000 + 30 * 60 * 1000)
	})

	test('calculate deadline', () => {
		const start = 1704067200000
		const duration = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
		const result = execute('start + duration', {
			variables: { start, duration },
		})
		expect(result).toBe(start + duration)
	})
})
