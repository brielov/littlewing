import { describe, expect, test } from "bun:test";
import { Temporal } from "temporal-polyfill";
import { evaluate } from "../src/interpreter";
import { defaultContext } from "../src/stdlib";
import type { RuntimeValue } from "../src/types";

/**
 * Helper to create a context with variables
 */
function ctx(vars: Record<string, RuntimeValue>) {
	return { ...defaultContext, variables: vars };
}

describe("DateTime Full Functions", () => {
	describe("CORE", () => {
		test("DATETIME() creates PlainDateTime", () => {
			const result = evaluate("DATETIME(2024, 6, 15, 14, 30, 0)", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainDateTime);
			const dt = result as Temporal.PlainDateTime;
			expect(dt.year).toBe(2024);
			expect(dt.month).toBe(6);
			expect(dt.day).toBe(15);
			expect(dt.hour).toBe(14);
			expect(dt.minute).toBe(30);
			expect(dt.second).toBe(0);
		});

		test("DATETIME() type errors", () => {
			expect(() => evaluate('DATETIME("2024", 6, 15, 14, 30, 0)', defaultContext)).toThrow(
				TypeError,
			);
		});

		test("NOW() returns PlainDateTime", () => {
			const result = evaluate("NOW()", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainDateTime);
		});
	});

	describe("CONVERSIONS", () => {
		test("TO_DATE() extracts PlainDate from PlainDateTime", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 0);
			const result = evaluate("TO_DATE(dt)", ctx({ dt }));
			expect(result).toBeInstanceOf(Temporal.PlainDate);
			const d = result as Temporal.PlainDate;
			expect(d.year).toBe(2024);
			expect(d.month).toBe(6);
			expect(d.day).toBe(15);
		});

		test("TO_DATE() rejects non-datetime", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			expect(() => evaluate("TO_DATE(d)", ctx({ d }))).toThrow(TypeError);
		});

		test("TO_TIME() extracts PlainTime from PlainDateTime", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 45);
			const result = evaluate("TO_TIME(dt)", ctx({ dt }));
			expect(result).toBeInstanceOf(Temporal.PlainTime);
			const t = result as Temporal.PlainTime;
			expect(t.hour).toBe(14);
			expect(t.minute).toBe(30);
			expect(t.second).toBe(45);
		});

		test("TO_TIME() rejects non-datetime", () => {
			const t = new Temporal.PlainTime(14, 30, 0);
			expect(() => evaluate("TO_TIME(t)", ctx({ t }))).toThrow(TypeError);
		});

		test("COMBINE() creates PlainDateTime from date + time", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			const t = new Temporal.PlainTime(14, 30, 0);
			const result = evaluate("COMBINE(d, t)", ctx({ d, t }));
			expect(result).toBeInstanceOf(Temporal.PlainDateTime);
			const dt = result as Temporal.PlainDateTime;
			expect(dt.year).toBe(2024);
			expect(dt.month).toBe(6);
			expect(dt.day).toBe(15);
			expect(dt.hour).toBe(14);
			expect(dt.minute).toBe(30);
			expect(dt.second).toBe(0);
		});

		test("COMBINE() rejects wrong types", () => {
			const t = new Temporal.PlainTime(14, 30, 0);
			expect(() => evaluate("COMBINE(t, t)", ctx({ t }))).toThrow(TypeError);
			const d = new Temporal.PlainDate(2024, 6, 15);
			expect(() => evaluate("COMBINE(d, d)", ctx({ d }))).toThrow(TypeError);
		});

		test("round-trip: COMBINE(TO_DATE(dt), TO_TIME(dt)) == dt", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 45);
			const result = evaluate(
				"COMBINE(TO_DATE(dt), TO_TIME(dt))",
				ctx({ dt }),
			) as Temporal.PlainDateTime;
			expect(result.equals(dt)).toBe(true);
		});
	});

	describe("DAY BOUNDARIES", () => {
		test("START_OF_DAY() returns midnight", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 45);
			const result = evaluate("START_OF_DAY(dt)", ctx({ dt })) as Temporal.PlainDateTime;
			expect(result.year).toBe(2024);
			expect(result.month).toBe(6);
			expect(result.day).toBe(15);
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.second).toBe(0);
			expect(result.millisecond).toBe(0);
		});

		test("START_OF_DAY() rejects non-datetime", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			expect(() => evaluate("START_OF_DAY(d)", ctx({ d }))).toThrow(TypeError);
		});

		test("END_OF_DAY() returns end of day", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0);
			const result = evaluate("END_OF_DAY(dt)", ctx({ dt })) as Temporal.PlainDateTime;
			expect(result.year).toBe(2024);
			expect(result.month).toBe(6);
			expect(result.day).toBe(15);
			expect(result.hour).toBe(23);
			expect(result.minute).toBe(59);
			expect(result.second).toBe(59);
			expect(result.millisecond).toBe(999);
		});

		test("END_OF_DAY() rejects non-datetime", () => {
			const t = new Temporal.PlainTime(10, 0, 0);
			expect(() => evaluate("END_OF_DAY(t)", ctx({ t }))).toThrow(TypeError);
		});
	});
});
