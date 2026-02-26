import { describe, expect, test } from "bun:test";
import { Temporal } from "temporal-polyfill";
import { evaluate } from "../src/interpreter";
import { defaultContext } from "../src/stdlib";
import type { RuntimeValue } from "../src/types";

/**
 * Helper to create a context with time/datetime variables
 */
function ctx(vars: Record<string, RuntimeValue>) {
	return { ...defaultContext, variables: vars };
}

describe("Time Functions", () => {
	describe("CORE", () => {
		test("TIME() creates PlainTime", () => {
			const result = evaluate("TIME(14, 30, 0)", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainTime);
			const t = result as Temporal.PlainTime;
			expect(t.hour).toBe(14);
			expect(t.minute).toBe(30);
			expect(t.second).toBe(0);
		});

		test("TIME() with midnight", () => {
			const result = evaluate("TIME(0, 0, 0)", defaultContext) as Temporal.PlainTime;
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.second).toBe(0);
		});

		test("TIME() with end of day", () => {
			const result = evaluate("TIME(23, 59, 59)", defaultContext) as Temporal.PlainTime;
			expect(result.hour).toBe(23);
			expect(result.minute).toBe(59);
			expect(result.second).toBe(59);
		});

		test("NOW_TIME() returns a PlainTime", () => {
			const result = evaluate("NOW_TIME()", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainTime);
		});

		test("TIME() type errors", () => {
			expect(() => evaluate('TIME("14", 30, 0)', defaultContext)).toThrow(TypeError);
			expect(() => evaluate('TIME(14, "30", 0)', defaultContext)).toThrow(TypeError);
			expect(() => evaluate('TIME(14, 30, "0")', defaultContext)).toThrow(TypeError);
		});
	});

	describe("EXTRACTORS", () => {
		const t = new Temporal.PlainTime(14, 30, 45, 123);

		test("GET_HOUR()", () => {
			expect(evaluate("GET_HOUR(t)", ctx({ t }))).toBe(14);
		});

		test("GET_MINUTE()", () => {
			expect(evaluate("GET_MINUTE(t)", ctx({ t }))).toBe(30);
		});

		test("GET_SECOND()", () => {
			expect(evaluate("GET_SECOND(t)", ctx({ t }))).toBe(45);
		});

		test("GET_MILLISECOND()", () => {
			expect(evaluate("GET_MILLISECOND(t)", ctx({ t }))).toBe(123);
		});

		test("extractors work on PlainDateTime", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 9, 15, 30, 500);
			expect(evaluate("GET_HOUR(dt)", ctx({ dt }))).toBe(9);
			expect(evaluate("GET_MINUTE(dt)", ctx({ dt }))).toBe(15);
			expect(evaluate("GET_SECOND(dt)", ctx({ dt }))).toBe(30);
			expect(evaluate("GET_MILLISECOND(dt)", ctx({ dt }))).toBe(500);
		});

		test("extractors reject date", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			expect(() => evaluate("GET_HOUR(d)", ctx({ d }))).toThrow(TypeError);
		});

		test("extractors reject number", () => {
			expect(() => evaluate("GET_HOUR(5)", defaultContext)).toThrow(TypeError);
		});
	});

	describe("ARITHMETIC", () => {
		test("ADD_HOURS()", () => {
			const t = new Temporal.PlainTime(10, 0, 0);
			const result = evaluate("ADD_HOURS(t, 3)", ctx({ t })) as Temporal.PlainTime;
			expect(result.hour).toBe(13);
		});

		test("ADD_HOURS() wraps around midnight", () => {
			const t = new Temporal.PlainTime(22, 0, 0);
			const result = evaluate("ADD_HOURS(t, 5)", ctx({ t })) as Temporal.PlainTime;
			expect(result.hour).toBe(3);
		});

		test("ADD_MINUTES()", () => {
			const t = new Temporal.PlainTime(10, 15, 0);
			const result = evaluate("ADD_MINUTES(t, 30)", ctx({ t })) as Temporal.PlainTime;
			expect(result.hour).toBe(10);
			expect(result.minute).toBe(45);
		});

		test("ADD_SECONDS()", () => {
			const t = new Temporal.PlainTime(10, 0, 30);
			const result = evaluate("ADD_SECONDS(t, 45)", ctx({ t })) as Temporal.PlainTime;
			expect(result.minute).toBe(1);
			expect(result.second).toBe(15);
		});

		test("ADD_HOURS() on PlainDateTime", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 22, 0, 0);
			const result = evaluate("ADD_HOURS(dt, 5)", ctx({ dt })) as Temporal.PlainDateTime;
			expect(result).toBeInstanceOf(Temporal.PlainDateTime);
			expect(result.day).toBe(16);
			expect(result.hour).toBe(3);
		});

		test("ADD_MINUTES() on PlainDateTime", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 50, 0);
			const result = evaluate("ADD_MINUTES(dt, 20)", ctx({ dt })) as Temporal.PlainDateTime;
			expect(result).toBeInstanceOf(Temporal.PlainDateTime);
			expect(result.hour).toBe(11);
			expect(result.minute).toBe(10);
		});

		test("arithmetic rejects date", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			expect(() => evaluate("ADD_HOURS(d, 1)", ctx({ d }))).toThrow(TypeError);
		});

		test("arithmetic rejects non-number amount", () => {
			const t = new Temporal.PlainTime(10, 0, 0);
			expect(() => evaluate('ADD_HOURS(t, "3")', ctx({ t }))).toThrow(TypeError);
		});
	});

	describe("DIFFERENCES", () => {
		test("DIFFERENCE_IN_HOURS() between PlainTimes", () => {
			const t1 = new Temporal.PlainTime(10, 0, 0);
			const t2 = new Temporal.PlainTime(13, 0, 0);
			expect(evaluate("DIFFERENCE_IN_HOURS(t1, t2)", ctx({ t1, t2 }))).toBe(3);
		});

		test("DIFFERENCE_IN_HOURS() returns absolute value", () => {
			const t1 = new Temporal.PlainTime(15, 0, 0);
			const t2 = new Temporal.PlainTime(10, 0, 0);
			expect(evaluate("DIFFERENCE_IN_HOURS(t1, t2)", ctx({ t1, t2 }))).toBe(5);
		});

		test("DIFFERENCE_IN_MINUTES()", () => {
			const t1 = new Temporal.PlainTime(10, 0, 0);
			const t2 = new Temporal.PlainTime(10, 45, 0);
			expect(evaluate("DIFFERENCE_IN_MINUTES(t1, t2)", ctx({ t1, t2 }))).toBe(45);
		});

		test("DIFFERENCE_IN_SECONDS()", () => {
			const t1 = new Temporal.PlainTime(10, 0, 0);
			const t2 = new Temporal.PlainTime(10, 0, 30);
			expect(evaluate("DIFFERENCE_IN_SECONDS(t1, t2)", ctx({ t1, t2 }))).toBe(30);
		});

		test("DIFFERENCE_IN_HOURS() between PlainDateTimes", () => {
			const dt1 = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0);
			const dt2 = new Temporal.PlainDateTime(2024, 6, 15, 18, 0, 0);
			expect(evaluate("DIFFERENCE_IN_HOURS(dt1, dt2)", ctx({ dt1, dt2 }))).toBe(8);
		});

		test("mixed time+datetime rejects", () => {
			const t = new Temporal.PlainTime(10, 0, 0);
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0);
			expect(() => evaluate("DIFFERENCE_IN_HOURS(t, dt)", ctx({ t, dt }))).toThrow(TypeError);
		});

		test("mixed datetime+time rejects", () => {
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0);
			const t = new Temporal.PlainTime(10, 0, 0);
			expect(() => evaluate("DIFFERENCE_IN_HOURS(dt, t)", ctx({ dt, t }))).toThrow(TypeError);
		});
	});

	describe("COMPARISONS", () => {
		test("IS_SAME_TIME() with same PlainTimes", () => {
			const t1 = new Temporal.PlainTime(10, 30, 0);
			const t2 = new Temporal.PlainTime(10, 30, 0);
			expect(evaluate("IS_SAME_TIME(t1, t2)", ctx({ t1, t2 }))).toBe(true);
		});

		test("IS_SAME_TIME() with different PlainTimes", () => {
			const t1 = new Temporal.PlainTime(10, 30, 0);
			const t2 = new Temporal.PlainTime(11, 30, 0);
			expect(evaluate("IS_SAME_TIME(t1, t2)", ctx({ t1, t2 }))).toBe(false);
		});

		test("IS_SAME_TIME() compares time portion of PlainDateTime", () => {
			const dt1 = new Temporal.PlainDateTime(2024, 1, 1, 10, 30, 0);
			const dt2 = new Temporal.PlainDateTime(2024, 12, 31, 10, 30, 0);
			expect(evaluate("IS_SAME_TIME(dt1, dt2)", ctx({ dt1, dt2 }))).toBe(true);
		});

		test("IS_SAME_TIME() mixed time+datetime", () => {
			const t = new Temporal.PlainTime(10, 30, 0);
			const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 30, 0);
			expect(evaluate("IS_SAME_TIME(t, dt)", ctx({ t, dt }))).toBe(true);
		});

		test("IS_SAME_TIME() rejects date", () => {
			const d = new Temporal.PlainDate(2024, 6, 15);
			const t = new Temporal.PlainTime(10, 0, 0);
			expect(() => evaluate("IS_SAME_TIME(d, t)", ctx({ d, t }))).toThrow(TypeError);
		});
	});
});
