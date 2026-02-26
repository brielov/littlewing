import { describe, expect, test } from "bun:test";
import { ParseError } from "../src/errors";
import { toLineColumn } from "../src/errors";
import { parse } from "../src/parser";

describe("ParseError", () => {
	test("parse errors are instanceof ParseError", () => {
		try {
			parse("if x");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			expect(err).toBeInstanceOf(Error);
		}
	});

	test("ParseError has name 'ParseError'", () => {
		const err = new ParseError("test", 0, 1);
		expect(err.name).toBe("ParseError");
	});

	test("ParseError carries start and end offsets", () => {
		const err = new ParseError("test", 5, 10);
		expect(err.start).toBe(5);
		expect(err.end).toBe(10);
		expect(err.message).toBe("test");
	});

	test("unexpected token has correct span", () => {
		// Source: "1 + @"
		//          01234
		// The '@' is at position 4, spans 1 character
		try {
			parse("1 + @");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.start).toBe(4);
			expect(pe.end).toBe(5);
		}
	});

	test("missing closing parenthesis has correct span", () => {
		// Source: "(1 + 2"
		// The EOF token is at position 6
		try {
			parse("(1 + 2");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe("Expected closing parenthesis");
			expect(pe.start).toBe(6);
		}
	});

	test("missing 'then' in if expression has correct span", () => {
		// Source: "if true 2"
		//          0123456789
		// After "if true", parser expects "then" but finds "2" at position 8
		try {
			parse("if true 2");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe('Expected "then" in if expression');
			expect(pe.start).toBe(8);
			expect(pe.end).toBe(9);
		}
	});

	test("missing 'else' in if expression has correct span", () => {
		try {
			parse("if true then 1");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe('Expected "else" in if expression');
		}
	});

	test("unterminated string has correct span", () => {
		// Source: '"hello'
		//          012345
		// String starts at 0, unterminated at 6
		try {
			parse('"hello');
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe("Unterminated string");
			expect(pe.start).toBe(0);
		}
	});

	test("unexpected character has correct span", () => {
		try {
			parse("&");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe("Unexpected character '&'");
			expect(pe.start).toBe(0);
		}
	});

	test("invalid assignment target has correct span", () => {
		try {
			parse("5 = 10");
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			const pe = err as ParseError;
			expect(pe.message).toBe("Invalid assignment target");
		}
	});
});

describe("toLineColumn", () => {
	test("offset 0 is line 1, column 1", () => {
		expect(toLineColumn("hello", 0)).toEqual({ line: 1, column: 1 });
	});

	test("offset at start of second line", () => {
		// "ab\ncd"
		//  0123 4
		// offset 3 is start of line 2, column 1
		expect(toLineColumn("ab\ncd", 3)).toEqual({ line: 2, column: 1 });
	});

	test("offset in middle of second line", () => {
		expect(toLineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
	});

	test("multiple newlines", () => {
		// "a\nb\nc"
		//  01 23 4
		expect(toLineColumn("a\nb\nc", 4)).toEqual({ line: 3, column: 1 });
	});

	test("offset beyond source length clamps", () => {
		expect(toLineColumn("abc", 100)).toEqual({ line: 1, column: 4 });
	});

	test("empty source", () => {
		expect(toLineColumn("", 0)).toEqual({ line: 1, column: 1 });
	});

	test("offset at end of single line", () => {
		expect(toLineColumn("hello", 5)).toEqual({ line: 1, column: 6 });
	});
});
