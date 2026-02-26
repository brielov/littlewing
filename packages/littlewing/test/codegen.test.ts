import { describe, expect, test } from "bun:test";
import * as ast from "../src/ast";
import { generate } from "../src/codegen";
import { evaluate } from "../src/interpreter";
import { parse } from "../src/parser";

describe("CodeGenerator", () => {
	test("generate number literal", () => {
		const node = ast.number(42);
		const code = generate(node);
		expect(code).toBe("42");
	});

	test("decimal numbers generate standard form", () => {
		const ast1 = parse("0.2");
		const code1 = generate(ast1);
		expect(code1).toBe("0.2");

		const ast2 = parse("0.5 + 0.3");
		const code2 = generate(ast2);
		expect(code2).toBe("0.5 + 0.3");

		const ast3 = parse("x = 0.25");
		const code3 = generate(ast3);
		expect(code3).toBe("x = 0.25");
	});

	test("generate identifier", () => {
		const node = ast.identifier("x");
		const code = generate(node);
		expect(code).toBe("x");
	});

	test("generate simple binary operation", () => {
		const node = ast.add(ast.number(2), ast.number(3));
		const code = generate(node);
		expect(code).toBe("2 + 3");
	});

	test("generate binary operation with proper spacing", () => {
		const node = ast.subtract(ast.number(10), ast.number(5));
		const code = generate(node);
		expect(code).toBe("10 - 5");
	});

	test("generate multiplication", () => {
		const node = ast.multiply(ast.number(3), ast.number(4));
		const code = generate(node);
		expect(code).toBe("3 * 4");
	});

	test("generate division", () => {
		const node = ast.divide(ast.number(10), ast.number(2));
		const code = generate(node);
		expect(code).toBe("10 / 2");
	});

	test("generate modulo", () => {
		const node = ast.modulo(ast.number(10), ast.number(3));
		const code = generate(node);
		expect(code).toBe("10 % 3");
	});

	test("generate exponentiation", () => {
		const node = ast.exponentiate(ast.number(2), ast.number(3));
		const code = generate(node);
		expect(code).toBe("2 ^ 3");
	});

	test("generate unary minus", () => {
		const node = ast.negate(ast.number(5));
		const code = generate(node);
		expect(code).toBe("-5");
	});

	test("generate unary minus with binary operation", () => {
		const node = ast.negate(ast.add(ast.number(2), ast.number(3)));
		const code = generate(node);
		expect(code).toBe("-(2 + 3)");
	});

	test("generate function call without arguments", () => {
		const node = ast.functionCall("NOW");
		const code = generate(node);
		expect(code).toBe("NOW()");
	});

	test("generate function call with single argument", () => {
		const node = ast.functionCall("ABS", [ast.negate(ast.number(5))]);
		const code = generate(node);
		expect(code).toBe("ABS(-5)");
	});

	test("generate function call with multiple arguments", () => {
		const node = ast.functionCall("MAX", [ast.number(1), ast.number(5), ast.number(3)]);
		const code = generate(node);
		expect(code).toBe("MAX(1, 5, 3)");
	});

	test("generate variable assignment", () => {
		const node = ast.assign("x", ast.number(5));
		const code = generate(node);
		expect(code).toBe("x = 5");
	});

	test("generate complex assignment", () => {
		const node = ast.assign("z", ast.add(ast.identifier("x"), ast.identifier("y")));
		const code = generate(node);
		expect(code).toBe("z = x + y");
	});

	test("precedence - multiply binds tighter than add", () => {
		const node = ast.add(ast.number(1), ast.multiply(ast.number(2), ast.number(3)));
		const code = generate(node);
		expect(code).toBe("1 + 2 * 3");
	});

	test("precedence - add on left needs parens", () => {
		const node = ast.multiply(ast.add(ast.number(1), ast.number(2)), ast.number(3));
		const code = generate(node);
		expect(code).toBe("(1 + 2) * 3");
	});

	test("precedence - power binds tighter than multiply", () => {
		const node = ast.multiply(ast.number(2), ast.exponentiate(ast.number(3), ast.number(2)));
		const code = generate(node);
		expect(code).toBe("2 * 3 ^ 2");
	});

	test("precedence - nested operations", () => {
		const node = ast.add(
			ast.multiply(ast.number(2), ast.number(3)),
			ast.divide(ast.number(10), ast.number(2)),
		);
		const code = generate(node);
		expect(code).toBe("2 * 3 + 10 / 2");
	});

	test("precedence - subtract left side", () => {
		const node = ast.subtract(ast.add(ast.number(10), ast.number(5)), ast.number(3));
		const code = generate(node);
		expect(code).toBe("10 + 5 - 3");
	});

	test("precedence - subtract right side", () => {
		const node = ast.subtract(ast.number(10), ast.subtract(ast.number(5), ast.number(2)));
		const code = generate(node);
		expect(code).toBe("10 - (5 - 2)");
	});

	test("precedence - divide right side needs parens", () => {
		const node = ast.divide(ast.number(20), ast.multiply(ast.number(2), ast.number(5)));
		const code = generate(node);
		expect(code).toBe("20 / (2 * 5)");
	});

	test("precedence - exponentiation is right associative", () => {
		const node = ast.exponentiate(ast.number(2), ast.exponentiate(ast.number(3), ast.number(2)));
		const code = generate(node);
		expect(code).toBe("2 ^ 3 ^ 2");
	});

	test("precedence - left exponentiation needs parens", () => {
		const node = ast.exponentiate(ast.exponentiate(ast.number(2), ast.number(3)), ast.number(2));
		const code = generate(node);
		expect(code).toBe("(2 ^ 3) ^ 2");
	});

	test("precedence - unary minus on left of exponentiation needs parens", () => {
		const node = ast.exponentiate(ast.unaryOp("-", ast.number(2)), ast.number(2));
		const code = generate(node);
		expect(code).toBe("(-2) ^ 2");
	});

	test("precedence - unary minus wraps exponentiation", () => {
		const node = ast.unaryOp("-", ast.exponentiate(ast.number(2), ast.number(2)));
		const code = generate(node);
		expect(code).toBe("-(2 ^ 2)");
	});

	test("round-trip simple expression", () => {
		const source = "2 + 3";
		const ast1 = parse(source);
		const code = generate(ast1);
		const ast2 = parse(code);
		expect(evaluate(ast1)).toBe(evaluate(ast2));
	});

	test("round-trip with precedence", () => {
		const source = "2 + 3 * 4";
		const ast1 = parse(source);
		const code = generate(ast1);
		const ast2 = parse(code);
		expect(evaluate(ast1)).toBe(evaluate(ast2));
	});

	test("round-trip with parentheses", () => {
		const source = "(2 + 3) * 4";
		const ast1 = parse(source);
		const code = generate(ast1);
		const ast2 = parse(code);
		expect(evaluate(ast1)).toBe(evaluate(ast2));
	});

	test("round-trip with variables", () => {
		const source = "x = 5; y = x + 10";
		const ast1 = parse(source);
		const code = generate(ast1);
		const ast2 = parse(code);
		expect(evaluate(ast1)).toBe(evaluate(ast2));
	});

	test("round-trip complex expression", () => {
		const source = "2 ^ 3 * 4 + 5";
		const ast1 = parse(source);
		const code = generate(ast1);
		const ast2 = parse(code);
		expect(evaluate(ast1)).toBe(evaluate(ast2));
	});

	test("program with multiple statements", () => {
		const node = ast.program([
			ast.assign("x", ast.number(5)),
			ast.assign("y", ast.number(10)),
			ast.add(ast.identifier("x"), ast.identifier("y")),
		]);
		const code = generate(node);
		expect(code).toBe("x = 5\ny = 10\nx + y");
	});

	test("generated code is syntactically valid", () => {
		const node = ast.multiply(
			ast.add(ast.number(2), ast.number(3)),
			ast.exponentiate(ast.number(2), ast.number(3)),
		);
		const code = generate(node);
		const parsed = parse(code);
		expect(parsed).toBeDefined();
	});

	test("comparison operators", () => {
		const node1 = ast.equals(ast.number(5), ast.number(3));
		expect(generate(node1)).toBe("5 == 3");

		const node2 = ast.lessThan(ast.number(10), ast.number(20));
		expect(generate(node2)).toBe("10 < 20");

		const node3 = ast.greaterEqual(ast.identifier("x"), ast.number(5));
		expect(generate(node3)).toBe("x >= 5");
	});

	test("comparison with arithmetic (precedence)", () => {
		const node = ast.lessThan(ast.add(ast.number(2), ast.number(3)), ast.number(10));
		expect(generate(node)).toBe("2 + 3 < 10");
	});

	test("if expression", () => {
		const node = ast.ifExpr(
			ast.greaterThan(ast.number(5), ast.number(3)),
			ast.number(100),
			ast.number(50),
		);
		expect(generate(node)).toBe("if 5 > 3 then 100 else 50");
	});

	test("if expression with complex condition", () => {
		const node = ast.ifExpr(ast.add(ast.number(2), ast.number(3)), ast.number(100), ast.number(50));
		expect(generate(node)).toBe("if 2 + 3 then 100 else 50");
	});

	test("nested if expression", () => {
		const node = ast.ifExpr(
			ast.boolean(true),
			ast.ifExpr(ast.boolean(true), ast.number(100), ast.number(200)),
			ast.number(300),
		);
		expect(generate(node)).toBe("if true then if true then 100 else 200 else 300");
	});

	test("if expression round-trip", () => {
		const source = "if x > 5 then 100 else 50";
		const ast1 = parse(source);
		const code = generate(ast1);
		const result1 = evaluate(source, { variables: { x: 10 } });
		const result2 = evaluate(code, { variables: { x: 10 } });
		expect(result1).toBe(result2);
		expect(result1).toBe(100);
	});

	test("for expression", () => {
		const node = ast.forExpr(
			"x",
			ast.identifier("arr"),
			null,
			null,
			ast.multiply(ast.identifier("x"), ast.number(2)),
		);
		expect(generate(node)).toBe("for x in arr then x * 2");
	});

	test("for expression with guard", () => {
		const node = ast.forExpr(
			"x",
			ast.identifier("arr"),
			ast.greaterThan(ast.identifier("x"), ast.number(0)),
			null,
			ast.multiply(ast.identifier("x"), ast.number(2)),
		);
		expect(generate(node)).toBe("for x in arr when x > 0 then x * 2");
	});

	test("for expression round-trip", () => {
		const source = "for x in arr then x * 2";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("for expression with guard round-trip", () => {
		const source = "for x in arr when x > 0 then x * 2";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("for expression with accumulator", () => {
		const node = ast.forExpr(
			"x",
			ast.identifier("arr"),
			null,
			{ name: "sum", initial: ast.number(0) },
			ast.add(ast.identifier("sum"), ast.identifier("x")),
		);
		expect(generate(node)).toBe("for x in arr into sum = 0 then sum + x");
	});

	test("for expression with guard and accumulator", () => {
		const node = ast.forExpr(
			"x",
			ast.identifier("arr"),
			ast.greaterThan(ast.identifier("x"), ast.number(0)),
			{ name: "total", initial: ast.number(0) },
			ast.add(ast.identifier("total"), ast.identifier("x")),
		);
		expect(generate(node)).toBe("for x in arr when x > 0 into total = 0 then total + x");
	});

	test("for expression with accumulator round-trip", () => {
		const source = "for x in [1, 2, 3] into sum = 0 then sum + x";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("for expression with guard and accumulator round-trip", () => {
		const source = "for x in arr when x > 0 into total = 0 then total + x";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("&& operator", () => {
		const source = "true && false";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("true && false");
	});

	test("|| operator", () => {
		const source = "false || true";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("false || true");
	});

	test("mixed logical and comparison operators", () => {
		const source = "5 > 3 && 10 < 20";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(evaluate(source)).toBe(evaluate(code));
	});

	test("logical operators with parentheses", () => {
		const source = "(true && false) || true";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(evaluate(source)).toBe(evaluate(code));
	});

	test("logical NOT operator", () => {
		const ast1 = ast.logicalNot(ast.boolean(true));
		const code = generate(ast1);
		expect(code).toBe("!true");
	});

	test("logical NOT with identifier", () => {
		const ast1 = ast.logicalNot(ast.identifier("x"));
		const code = generate(ast1);
		expect(code).toBe("!x");
	});

	test("logical NOT with binary operation", () => {
		const ast1 = ast.logicalNot(ast.binaryOp(ast.identifier("x"), "+", ast.identifier("y")));
		const code = generate(ast1);
		expect(code).toBe("!(x + y)");
	});

	test("double NOT", () => {
		const ast1 = ast.logicalNot(ast.logicalNot(ast.identifier("x")));
		const code = generate(ast1);
		expect(code).toBe("!!x");
	});

	test("NOT round-trip", () => {
		const source = "!x";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("NOT with comparison", () => {
		const source = "!(x > 5)";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("NOT in if expression", () => {
		const source = "if !x then 100 else 50";
		const ast1 = parse(source);
		const code = generate(ast1);
		const result1 = evaluate(source, { variables: { x: false } });
		const result2 = evaluate(code, { variables: { x: false } });
		expect(result1).toBe(result2);
	});

	test("mixed unary operators", () => {
		const source = "-!x";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("NOT with logical operators", () => {
		const source = "!x && !y";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	// New type codegen tests
	test("generate string literal", () => {
		const node = ast.string("hello");
		expect(generate(node)).toBe('"hello"');
	});

	test("generate string with escapes", () => {
		const node = ast.string('hello\n"world"');
		expect(generate(node)).toBe('"hello\\n\\"world\\""');
	});

	test("generate boolean literal", () => {
		expect(generate(ast.boolean(true))).toBe("true");
		expect(generate(ast.boolean(false))).toBe("false");
	});

	test("generate array literal", () => {
		const node = ast.array([ast.number(1), ast.number(2), ast.number(3)]);
		expect(generate(node)).toBe("[1, 2, 3]");
	});

	test("generate empty array", () => {
		const node = ast.array([]);
		expect(generate(node)).toBe("[]");
	});

	test("string round-trip", () => {
		const source = '"hello world"';
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
		expect(evaluate(code)).toBe("hello world");
	});

	test("boolean round-trip", () => {
		const source = "true";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
		expect(evaluate(code)).toBe(true);
	});

	test("array round-trip", () => {
		const source = "[1, 2, 3]";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
		expect(evaluate(code)).toEqual([1, 2, 3]);
	});

	// Index access tests
	test("generate index access", () => {
		const node = ast.indexAccess(ast.identifier("arr"), ast.number(0));
		expect(generate(node)).toBe("arr[0]");
	});

	test("generate chained index access", () => {
		const node = ast.indexAccess(
			ast.indexAccess(ast.identifier("matrix"), ast.number(0)),
			ast.number(1),
		);
		expect(generate(node)).toBe("matrix[0][1]");
	});

	test("generate index access on binary op wraps in parens", () => {
		const node = ast.indexAccess(ast.add(ast.identifier("a"), ast.identifier("b")), ast.number(0));
		expect(generate(node)).toBe("(a + b)[0]");
	});

	test("index access round-trip", () => {
		const source = "arr[0]";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	// Range expression tests
	test("generate exclusive range", () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(5), false);
		expect(generate(node)).toBe("1..5");
	});

	test("generate inclusive range", () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(5), true);
		expect(generate(node)).toBe("1..=5");
	});

	test("generate range with binary op wraps in parens", () => {
		const node = ast.rangeExpr(
			ast.add(ast.number(1), ast.number(2)),
			ast.add(ast.number(3), ast.number(4)),
			false,
		);
		expect(generate(node)).toBe("(1 + 2)..(3 + 4)");
	});

	test("exclusive range round-trip", () => {
		const source = "1..5";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("inclusive range round-trip", () => {
		const source = "1..=5";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe(source);
	});

	test("comment preservation roundtrip", () => {
		const source = "// compute sum\nx = 5\ny = 10\nx + y";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("// compute sum\nx = 5\ny = 10\nx + y");
	});

	test("trailing comments after last statement", () => {
		const source = "x = 5\ny = 10\n// final comment";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("x = 5\ny = 10\n// final comment");
	});

	test("multiple comments before a single statement", () => {
		const source = "// line one\n// line two\nx + y";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("// line one\n// line two\nx + y");
	});

	test("comments survive parse → generate cycle", () => {
		const source = "// first\nx = 5\n// second\ny = x + 10\ny";
		const ast1 = parse(source);
		const code1 = generate(ast1);
		const ast2 = parse(code1);
		const code2 = generate(ast2);
		expect(code1).toBe(code2);
	});

	test("comment before single expression", () => {
		const source = "// answer\n42";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("// answer\n42");
	});

	test("trailing comment on single-statement program", () => {
		const source = "42\n// trailing";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("42\n// trailing");
	});

	test("inline comment preserved on same line", () => {
		const source = "tax = subtotal * tax_rate // tax calculation";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("tax = subtotal * tax_rate // tax calculation");
	});

	test("inline comments in multi-statement program", () => {
		const source = "x = 5 // first\ny = 10 // second\nx + y";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("x = 5 // first\ny = 10 // second\nx + y");
	});

	test("mixed leading and inline comments", () => {
		const source = "// setup\nx = 5 // assign x\ny = x + 10";
		const ast1 = parse(source);
		const code = generate(ast1);
		expect(code).toBe("// setup\nx = 5 // assign x\ny = x + 10");
	});

	// Parenthesization edge cases: greedy-tail nodes as left operands
	test("if expression as binary left operand wraps in parens", () => {
		const node = ast.add(
			ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(2)),
			ast.number(3),
		);
		expect(generate(node)).toBe("(if true then 1 else 2) + 3");
	});

	test("for expression as binary left operand wraps in parens", () => {
		const node = ast.add(
			ast.forExpr("x", ast.array([ast.number(1)]), null, null, ast.identifier("x")),
			ast.number(3),
		);
		expect(generate(node)).toBe("(for x in [1] then x) + 3");
	});

	test("assignment as binary left operand wraps in parens", () => {
		const node = ast.add(ast.assign("x", ast.number(5)), ast.number(3));
		expect(generate(node)).toBe("(x = 5) + 3");
	});

	test("range as binary left operand wraps in parens when needed", () => {
		const node = ast.add(ast.rangeExpr(ast.number(1), ast.number(5), false), ast.number(3));
		expect(generate(node)).toBe("(1..5) + 3");
	});

	test("range as binary left operand no parens for low-precedence parent", () => {
		const node = ast.logicalOr(
			ast.rangeExpr(ast.number(1), ast.number(5), false),
			ast.boolean(true),
		);
		expect(generate(node)).toBe("1..5 || true");
	});

	// Parenthesization edge cases: low-precedence infix as right operands
	test("assignment as binary right operand wraps in parens", () => {
		const node = ast.add(ast.number(3), ast.assign("x", ast.number(5)));
		expect(generate(node)).toBe("3 + (x = 5)");
	});

	test("range as binary right operand wraps in parens when needed", () => {
		const node = ast.add(ast.number(3), ast.rangeExpr(ast.number(1), ast.number(5), false));
		expect(generate(node)).toBe("3 + (1..5)");
	});

	test("range as binary right operand no parens for low-precedence parent", () => {
		const node = ast.logicalOr(
			ast.boolean(true),
			ast.rangeExpr(ast.number(1), ast.number(5), false),
		);
		expect(generate(node)).toBe("true || 1..5");
	});

	// Parenthesization edge cases: greedy-tail nodes in range start
	test("if expression as range start wraps in parens", () => {
		const node = ast.rangeExpr(
			ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(5)),
			ast.number(10),
			false,
		);
		expect(generate(node)).toBe("(if true then 1 else 5)..10");
	});

	test("assignment as range start wraps in parens", () => {
		const node = ast.rangeExpr(ast.assign("x", ast.number(5)), ast.number(10), false);
		expect(generate(node)).toBe("(x = 5)..10");
	});

	// Parenthesization edge cases: low-precedence infix in range end
	test("assignment as range end wraps in parens", () => {
		const node = ast.rangeExpr(ast.number(1), ast.assign("x", ast.number(5)), false);
		expect(generate(node)).toBe("1..(x = 5)");
	});

	// Parenthesization edge cases: unary argument
	test("range as unary argument wraps in parens", () => {
		const node = ast.negate(ast.rangeExpr(ast.number(1), ast.number(5), false));
		expect(generate(node)).toBe("-(1..5)");
	});
});
