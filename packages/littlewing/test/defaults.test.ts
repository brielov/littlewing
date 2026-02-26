import { describe, expect, test } from "bun:test";
import { Temporal } from "temporal-polyfill";
import { evaluate } from "../src/interpreter";
import { defaultContext } from "../src/stdlib";

describe("Default Context Functions", () => {
	describe("Math", () => {
		test("ABS", () => {
			expect(evaluate("ABS(-5)", defaultContext)).toBe(5);
			expect(evaluate("ABS(5)", defaultContext)).toBe(5);
			expect(evaluate("ABS(0)", defaultContext)).toBe(0);
		});

		test("CEIL", () => {
			expect(evaluate("CEIL(4.2)", defaultContext)).toBe(5);
			expect(evaluate("CEIL(-4.8)", defaultContext)).toBe(-4);
		});

		test("FLOOR", () => {
			expect(evaluate("FLOOR(4.8)", defaultContext)).toBe(4);
			expect(evaluate("FLOOR(-4.2)", defaultContext)).toBe(-5);
		});

		test("ROUND", () => {
			expect(evaluate("ROUND(4.5)", defaultContext)).toBe(5);
			expect(evaluate("ROUND(4.4)", defaultContext)).toBe(4);
		});

		test("SQRT", () => {
			expect(evaluate("SQRT(9)", defaultContext)).toBe(3);
			expect(evaluate("SQRT(2)", defaultContext)).toBeCloseTo(Math.SQRT2);
		});

		test("MIN and MAX", () => {
			expect(evaluate("MIN(1, 2, 3)", defaultContext)).toBe(1);
			expect(evaluate("MAX(1, 2, 3)", defaultContext)).toBe(3);
		});

		test("CLAMP returns value when within bounds", () => {
			expect(evaluate("CLAMP(50, 0, 100)", defaultContext)).toBe(50);
		});

		test("CLAMP returns min when value is below minimum", () => {
			expect(evaluate("CLAMP(-10, 0, 100)", defaultContext)).toBe(0);
		});

		test("CLAMP returns max when value is above maximum", () => {
			expect(evaluate("CLAMP(150, 0, 100)", defaultContext)).toBe(100);
		});

		test("CLAMP with negative bounds", () => {
			expect(evaluate("CLAMP(-5, -10, -1)", defaultContext)).toBe(-5);
		});

		test("CLAMP at boundaries", () => {
			expect(evaluate("CLAMP(0, 0, 100)", defaultContext)).toBe(0);
			expect(evaluate("CLAMP(100, 0, 100)", defaultContext)).toBe(100);
		});

		test("CLAMP with variables", () => {
			const result = evaluate("CLAMP(value, minVal, maxVal)", {
				...defaultContext,
				variables: { value: 75, minVal: 0, maxVal: 100 },
			});
			expect(result).toBe(75);
		});

		test("CLAMP in expression", () => {
			const result = evaluate("CLAMP((score / total) * 100, 0, 100)", {
				...defaultContext,
				variables: { score: 95, total: 90 },
			});
			expect(result).toBe(100);
		});

		test("SIN, COS, TAN", () => {
			expect(evaluate("SIN(0)", defaultContext)).toBe(0);
			expect(evaluate("COS(0)", defaultContext)).toBe(1);
			expect(evaluate("TAN(0)", defaultContext)).toBe(0);
		});

		test("LOG, LOG10, EXP", () => {
			expect(evaluate("LOG(1)", defaultContext)).toBe(0);
			expect(evaluate("LOG10(100)", defaultContext)).toBe(2);
			expect(evaluate("EXP(0)", defaultContext)).toBe(1);
		});

		test("math functions throw TypeError on non-number", () => {
			expect(() => evaluate('ABS("hello")', defaultContext)).toThrow(TypeError);
			expect(() => evaluate("SQRT(true)", defaultContext)).toThrow(TypeError);
		});
	});

	describe("Core (Type Conversion)", () => {
		test("STR converts number to string", () => {
			expect(evaluate("STR(42)", defaultContext)).toBe("42");
		});

		test("STR converts boolean to string", () => {
			expect(evaluate("STR(true)", defaultContext)).toBe("true");
			expect(evaluate("STR(false)", defaultContext)).toBe("false");
		});

		test("NUM converts string to number", () => {
			expect(evaluate('NUM("42")', defaultContext)).toBe(42);
			expect(evaluate('NUM("3.14")', defaultContext)).toBeCloseTo(3.14);
		});

		test("NUM converts boolean to number", () => {
			expect(evaluate("NUM(true)", defaultContext)).toBe(1);
			expect(evaluate("NUM(false)", defaultContext)).toBe(0);
		});

		test("TYPE returns type name", () => {
			expect(evaluate("TYPE(42)", defaultContext)).toBe("number");
			expect(evaluate('TYPE("hello")', defaultContext)).toBe("string");
			expect(evaluate("TYPE(true)", defaultContext)).toBe("boolean");
			expect(evaluate("TYPE([1, 2])", defaultContext)).toBe("array");
		});
	});

	describe("String Functions", () => {
		test("STR_LEN", () => {
			expect(evaluate('STR_LEN("hello")', defaultContext)).toBe(5);
			expect(evaluate('STR_LEN("")', defaultContext)).toBe(0);
		});

		test("STR_UPPER and STR_LOWER", () => {
			expect(evaluate('STR_UPPER("hello")', defaultContext)).toBe("HELLO");
			expect(evaluate('STR_LOWER("HELLO")', defaultContext)).toBe("hello");
		});

		test("STR_TRIM", () => {
			expect(evaluate('STR_TRIM("  hello  ")', defaultContext)).toBe("hello");
		});

		test("STR_CONTAINS", () => {
			expect(evaluate('STR_CONTAINS("hello world", "world")', defaultContext)).toBe(true);
			expect(evaluate('STR_CONTAINS("hello world", "xyz")', defaultContext)).toBe(false);
		});

		test("STR_INDEX_OF", () => {
			expect(evaluate('STR_INDEX_OF("hello world", "world")', defaultContext)).toBe(6);
			expect(evaluate('STR_INDEX_OF("hello", "xyz")', defaultContext)).toBe(-1);
		});

		test("STR_SLICE", () => {
			expect(evaluate('STR_SLICE("hello", 1, 3)', defaultContext)).toBe("el");
			expect(evaluate('STR_SLICE("hello", 1)', defaultContext)).toBe("ello");
		});

		test("STR_SPLIT", () => {
			expect(evaluate('STR_SPLIT("a,b,c", ",")', defaultContext)).toEqual(["a", "b", "c"]);
			expect(evaluate('STR_SPLIT("hello", "")', defaultContext)).toEqual(["h", "e", "l", "l", "o"]);
		});

		test("STR_REPLACE", () => {
			expect(evaluate('STR_REPLACE("hello world", "world", "there")', defaultContext)).toBe(
				"hello there",
			);
			expect(evaluate('STR_REPLACE("aaa", "a", "b")', defaultContext)).toBe("baa");
		});

		test("STR_STARTS_WITH", () => {
			expect(evaluate('STR_STARTS_WITH("hello", "hel")', defaultContext)).toBe(true);
			expect(evaluate('STR_STARTS_WITH("hello", "xyz")', defaultContext)).toBe(false);
		});

		test("STR_ENDS_WITH", () => {
			expect(evaluate('STR_ENDS_WITH("hello", "llo")', defaultContext)).toBe(true);
			expect(evaluate('STR_ENDS_WITH("hello", "xyz")', defaultContext)).toBe(false);
		});

		test("STR_REPEAT", () => {
			expect(evaluate('STR_REPEAT("ab", 3)', defaultContext)).toBe("ababab");
			expect(evaluate('STR_REPEAT("x", 0)', defaultContext)).toBe("");
		});

		test("STR_REPEAT throws on negative count", () => {
			expect(() => evaluate('STR_REPEAT("x", -1)', defaultContext)).toThrow(RangeError);
		});

		test("string functions throw TypeError on non-string", () => {
			expect(() => evaluate("STR_LEN(42)", defaultContext)).toThrow(TypeError);
			expect(() => evaluate("STR_UPPER(true)", defaultContext)).toThrow(TypeError);
		});
	});

	describe("Array Functions", () => {
		test("ARR_LEN", () => {
			expect(evaluate("ARR_LEN([1, 2, 3])", defaultContext)).toBe(3);
			expect(evaluate("ARR_LEN([])", defaultContext)).toBe(0);
		});

		test("ARR_PUSH", () => {
			expect(evaluate("ARR_PUSH([1, 2], 3)", defaultContext)).toEqual([1, 2, 3]);
		});

		test("ARR_SLICE", () => {
			expect(evaluate("ARR_SLICE([1, 2, 3, 4], 1, 3)", defaultContext)).toEqual([2, 3]);
			expect(evaluate("ARR_SLICE([1, 2, 3], 1)", defaultContext)).toEqual([2, 3]);
		});

		test("ARR_CONTAINS", () => {
			expect(evaluate("ARR_CONTAINS([1, 2, 3], 2)", defaultContext)).toBe(true);
			expect(evaluate("ARR_CONTAINS([1, 2, 3], 5)", defaultContext)).toBe(false);
		});

		test("ARR_REVERSE", () => {
			expect(evaluate("ARR_REVERSE([1, 2, 3])", defaultContext)).toEqual([3, 2, 1]);
		});

		test("ARR_SORT with numbers", () => {
			expect(evaluate("ARR_SORT([3, 1, 2])", defaultContext)).toEqual([1, 2, 3]);
		});

		test("ARR_SORT with strings", () => {
			expect(evaluate('ARR_SORT(["c", "a", "b"])', defaultContext)).toEqual(["a", "b", "c"]);
		});

		test("ARR_SORT with empty array", () => {
			expect(evaluate("ARR_SORT([])", defaultContext)).toEqual([]);
		});

		test("ARR_UNIQUE", () => {
			expect(evaluate("ARR_UNIQUE([1, 2, 2, 3, 1])", defaultContext)).toEqual([1, 2, 3]);
		});

		test("ARR_UNIQUE with deep equality", () => {
			expect(evaluate("ARR_UNIQUE([[1, 2], [1, 2], [3]])", defaultContext)).toEqual([[1, 2], [3]]);
		});

		test("ARR_FLAT", () => {
			expect(evaluate("ARR_FLAT([[1, 2], [3, 4]])", defaultContext)).toEqual([1, 2, 3, 4]);
		});

		test("ARR_FLAT throws on non-array elements", () => {
			expect(() => evaluate("ARR_FLAT([1, 2])", defaultContext)).toThrow(TypeError);
		});

		test("ARR_JOIN", () => {
			expect(evaluate('ARR_JOIN(["a", "b", "c"], ", ")', defaultContext)).toBe("a, b, c");
			expect(evaluate('ARR_JOIN(["x"], "-")', defaultContext)).toBe("x");
			expect(evaluate('ARR_JOIN([], "-")', defaultContext)).toBe("");
		});

		test("ARR_JOIN throws on non-string elements", () => {
			expect(() => evaluate('ARR_JOIN([1, 2], ",")', defaultContext)).toThrow(TypeError);
		});

		test("ARR_SUM", () => {
			expect(evaluate("ARR_SUM([1, 2, 3])", defaultContext)).toBe(6);
			expect(evaluate("ARR_SUM([])", defaultContext)).toBe(0);
		});

		test("ARR_SUM throws on non-number elements", () => {
			expect(() => evaluate('ARR_SUM(["a"])', defaultContext)).toThrow(TypeError);
		});

		test("ARR_MIN and ARR_MAX", () => {
			expect(evaluate("ARR_MIN([3, 1, 2])", defaultContext)).toBe(1);
			expect(evaluate("ARR_MAX([3, 1, 2])", defaultContext)).toBe(3);
		});

		test("ARR_MIN and ARR_MAX with strings", () => {
			expect(evaluate('ARR_MIN(["c", "a", "b"])', defaultContext)).toBe("a");
			expect(evaluate('ARR_MAX(["c", "a", "b"])', defaultContext)).toBe("c");
		});

		test("ARR_MIN and ARR_MAX throw on empty array", () => {
			expect(() => evaluate("ARR_MIN([])", defaultContext)).toThrow(RangeError);
			expect(() => evaluate("ARR_MAX([])", defaultContext)).toThrow(RangeError);
		});

		test("array functions throw TypeError on non-array", () => {
			expect(() => evaluate("ARR_LEN(42)", defaultContext)).toThrow(TypeError);
		});
	});

	describe("Date Functions", () => {
		test("TODAY returns a PlainDate", () => {
			const result = evaluate("TODAY()", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainDate);
		});

		test("DATE creates a PlainDate", () => {
			const result = evaluate("DATE(2024, 6, 15)", defaultContext);
			expect(result).toBeInstanceOf(Temporal.PlainDate);
			const date = result as Temporal.PlainDate;
			expect(date.year).toBe(2024);
			expect(date.month).toBe(6);
			expect(date.day).toBe(15);
		});

		test("GET_YEAR, GET_MONTH, GET_DAY", () => {
			const ctx = {
				...defaultContext,
				variables: { d: new Temporal.PlainDate(2024, 6, 15) },
			};
			expect(evaluate("GET_YEAR(d)", ctx)).toBe(2024);
			expect(evaluate("GET_MONTH(d)", ctx)).toBe(6);
			expect(evaluate("GET_DAY(d)", ctx)).toBe(15);
		});

		test("ADD_DAYS", () => {
			const ctx = {
				...defaultContext,
				variables: { d: new Temporal.PlainDate(2024, 6, 15) },
			};
			const result = evaluate("ADD_DAYS(d, 7)", ctx) as Temporal.PlainDate;
			expect(result.day).toBe(22);
			expect(result.month).toBe(6);
		});

		test("IS_WEEKEND", () => {
			const saturday = new Temporal.PlainDate(2024, 6, 15); // Saturday
			const monday = new Temporal.PlainDate(2024, 6, 17); // Monday
			expect(
				evaluate("IS_WEEKEND(d)", {
					...defaultContext,
					variables: { d: saturday },
				}),
			).toBe(true);
			expect(
				evaluate("IS_WEEKEND(d)", {
					...defaultContext,
					variables: { d: monday },
				}),
			).toBe(false);
		});

		test("date functions throw TypeError on non-date", () => {
			expect(() => evaluate("GET_YEAR(42)", defaultContext)).toThrow(TypeError);
			expect(() => evaluate('ADD_DAYS("hello", 1)', defaultContext)).toThrow(TypeError);
		});
	});
});
