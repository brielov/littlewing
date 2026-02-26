import { describe, expect, test } from "bun:test";
import {
	type ASTNode,
	type PipeExpression,
	NodeKind,
	isPipeExpression,
	isPlaceholder,
	isNumberLiteral,
	isIdentifier,
} from "../src/ast";
import * as ast from "../src/ast";
import { generate } from "../src/codegen";
import { evaluate, evaluateScope } from "../src/interpreter";
import { optimize } from "../src/optimizer";
import { parse } from "../src/parser";
import { extractAssignedVariables, extractInputVariables } from "../src/analyzer";
import { createCursor, nextToken, TokenKind } from "../src/lexer";
import { defaultContext } from "../src/stdlib";
import type { ExecutionContext, RuntimeValue } from "../src/types";

const stdlibCtx: ExecutionContext = defaultContext;

// --- Lexer ---

describe("Lexer: pipe tokens", () => {
	test("tokenizes |> as Pipe", () => {
		const cursor = createCursor("|>");
		const token = nextToken(cursor);
		expect(token[0]).toBe(TokenKind.Pipe);
	});

	test("tokenizes ? as Question", () => {
		const cursor = createCursor("?");
		const token = nextToken(cursor);
		expect(token[0]).toBe(TokenKind.Question);
	});

	test("tokenizes || and |> distinctly", () => {
		const cursor = createCursor("|| |>");
		const t1 = nextToken(cursor);
		expect(t1[0]).toBe(TokenKind.Or);
		const t2 = nextToken(cursor);
		expect(t2[0]).toBe(TokenKind.Pipe);
	});

	test("tokenizes pipe in expression context", () => {
		const cursor = createCursor("x |> FUN(?)");
		const t1 = nextToken(cursor);
		expect(t1[0]).toBe(TokenKind.Identifier);
		const t2 = nextToken(cursor);
		expect(t2[0]).toBe(TokenKind.Pipe);
		const t3 = nextToken(cursor);
		expect(t3[0]).toBe(TokenKind.Identifier);
		const t4 = nextToken(cursor);
		expect(t4[0]).toBe(TokenKind.LParen);
		const t5 = nextToken(cursor);
		expect(t5[0]).toBe(TokenKind.Question);
		const t6 = nextToken(cursor);
		expect(t6[0]).toBe(TokenKind.RParen);
	});

	test("bare | throws", () => {
		const cursor = createCursor("| x");
		expect(() => nextToken(cursor)).toThrow();
	});
});

// --- Parser ---

describe("Parser: pipe expressions", () => {
	test("parses simple pipe expression", () => {
		const node = parse("x |> ABS(?)");
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.name).toBe("ABS");
		expect(isIdentifier(pipe.value)).toBe(true);
		expect(pipe.args.length).toBe(1);
		expect(isPlaceholder(pipe.args[0] as ASTNode)).toBe(true);
	});

	test("parses chained pipe expressions", () => {
		const node = parse("x |> ABS(?) |> STR(?)");
		expect(isPipeExpression(node)).toBe(true);
		const outer = node as PipeExpression;
		expect(outer.name).toBe("STR");
		expect(isPipeExpression(outer.value)).toBe(true);
		const inner = outer.value as PipeExpression;
		expect(inner.name).toBe("ABS");
	});

	test("parses pipe with multiple arguments", () => {
		const node = parse("x |> CLAMP(?, 0, 100)");
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.name).toBe("CLAMP");
		expect(pipe.args.length).toBe(3);
		expect(isPlaceholder(pipe.args[0] as ASTNode)).toBe(true);
		expect(isNumberLiteral(pipe.args[1] as ASTNode)).toBe(true);
		expect(isNumberLiteral(pipe.args[2] as ASTNode)).toBe(true);
	});

	test("parses pipe with placeholder in non-first position", () => {
		const node = parse("1 |> MAX(0, ?)");
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.args.length).toBe(2);
		expect(isNumberLiteral(pipe.args[0] as ASTNode)).toBe(true);
		expect(isPlaceholder(pipe.args[1] as ASTNode)).toBe(true);
	});

	test("parses pipe with multiple placeholders", () => {
		const node = parse("5 |> ADD(?, ?)");
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.args.length).toBe(2);
		expect(isPlaceholder(pipe.args[0] as ASTNode)).toBe(true);
		expect(isPlaceholder(pipe.args[1] as ASTNode)).toBe(true);
	});

	test("pipe has lower precedence than ||", () => {
		// a || b |> FUN(?) should parse as (a || b) |> FUN(?)
		const node = parse("a || b |> FUN(?)");
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.value.kind).toBe(NodeKind.BinaryOp);
	});

	test("pipe has higher precedence than assignment", () => {
		// x = a |> FUN(?) should parse as x = (a |> FUN(?))
		const node = parse("x = a |> FUN(?)");
		expect(node.kind).toBe(NodeKind.Assignment);
	});

	test("pipe is left-associative", () => {
		// a |> B(?) |> C(?) should parse as (a |> B(?)) |> C(?)
		const node = parse("a |> B(?) |> C(?)");
		expect(isPipeExpression(node)).toBe(true);
		const outer = node as PipeExpression;
		expect(outer.name).toBe("C");
		expect(isPipeExpression(outer.value)).toBe(true);
		const inner = outer.value as PipeExpression;
		expect(inner.name).toBe("B");
	});

	test("pipe with expression on left side", () => {
		const node = parse("2 + 3 |> ABS(?)");
		// 2 + 3 has higher precedence than |>, so this is (2 + 3) |> ABS(?)
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(pipe.value.kind).toBe(NodeKind.BinaryOp);
	});

	test("error: missing placeholder", () => {
		expect(() => parse("x |> FUN(1, 2)")).toThrow(
			"Pipe expression requires at least one ? placeholder",
		);
	});

	test("error: missing function name", () => {
		expect(() => parse("x |> (?)")).toThrow("Expected function name after |>");
	});

	test("error: missing parentheses", () => {
		expect(() => parse("x |> FUN")).toThrow("Expected ( after function name in pipe expression");
	});

	test("error: ? outside pipe expression", () => {
		expect(() => parse("FUN(?)")).toThrow();
	});

	test("pipe with no-arg function + placeholder is still required", () => {
		expect(() => parse("x |> FUN()")).toThrow(
			"Pipe expression requires at least one ? placeholder",
		);
	});
});

// --- Interpreter ---

describe("Interpreter: pipe expressions", () => {
	const ctx: ExecutionContext = {
		functions: {
			ABS: (...args: RuntimeValue[]) => Math.abs(args[0] as number),
			DOUBLE: (...args: RuntimeValue[]) => (args[0] as number) * 2,
			ADD: (...args: RuntimeValue[]) => (args[0] as number) + (args[1] as number),
			CLAMP: (...args: RuntimeValue[]) =>
				Math.min(Math.max(args[0] as number, args[1] as number), args[2] as number),
			STR: (...args: RuntimeValue[]) => String(args[0]),
			IDENTITY: (...args: RuntimeValue[]) => args[0] as RuntimeValue,
		},
	};

	test("basic pipe", () => {
		expect(evaluate("-5 |> ABS(?)", ctx)).toBe(5);
	});

	test("chained pipes", () => {
		expect(evaluate("-3 |> ABS(?) |> DOUBLE(?)", ctx)).toBe(6);
	});

	test("pipe with extra arguments", () => {
		expect(evaluate("150 |> CLAMP(?, 0, 100)", ctx)).toBe(100);
	});

	test("pipe with placeholder in non-first position", () => {
		expect(evaluate("10 |> ADD(5, ?)", ctx)).toBe(15);
	});

	test("pipe with multiple placeholders", () => {
		expect(evaluate("7 |> ADD(?, ?)", ctx)).toBe(14);
	});

	test("pipe with expression on left", () => {
		expect(evaluate("2 + 3 |> DOUBLE(?)", ctx)).toBe(10);
	});

	test("pipe with variable", () => {
		expect(evaluate("x = -10; x |> ABS(?)", ctx)).toBe(10);
	});

	test("pipe result used in assignment", () => {
		const scope = evaluateScope("y = -7 |> ABS(?)", ctx);
		expect(scope.y).toBe(7);
	});

	test("pipe with type conversion", () => {
		expect(evaluate("42 |> STR(?)", ctx)).toBe("42");
	});

	test("long pipe chain", () => {
		expect(evaluate("-50 |> ABS(?) |> DOUBLE(?) |> CLAMP(?, 0, 75)", ctx)).toBe(75);
	});

	test("pipe with undefined function throws", () => {
		expect(() => evaluate("1 |> NOPE(?)")).toThrow("Undefined function: NOPE");
	});

	test("pipe with stdlib functions", () => {
		expect(evaluate("-5 |> ABS(?)", stdlibCtx)).toBe(5);
		expect(evaluate("3.7 |> FLOOR(?)", stdlibCtx)).toBe(3);
		expect(evaluate('"hello" |> STR_UPPER(?)', stdlibCtx)).toBe("HELLO");
	});
});

// --- Codegen ---

describe("Codegen: pipe expressions", () => {
	test("generates simple pipe", () => {
		const node = ast.pipeExpr(ast.identifier("x"), "ABS", [ast.placeholder()]);
		expect(generate(node)).toBe("x |> ABS(?)");
	});

	test("generates pipe with multiple args", () => {
		const node = ast.pipeExpr(ast.identifier("x"), "CLAMP", [
			ast.placeholder(),
			ast.number(0),
			ast.number(100),
		]);
		expect(generate(node)).toBe("x |> CLAMP(?, 0, 100)");
	});

	test("generates chained pipes", () => {
		const inner = ast.pipeExpr(ast.identifier("x"), "ABS", [ast.placeholder()]);
		const outer = ast.pipeExpr(inner, "STR", [ast.placeholder()]);
		expect(generate(outer)).toBe("x |> ABS(?) |> STR(?)");
	});

	test("generates pipe with multiple placeholders", () => {
		const node = ast.pipeExpr(ast.number(5), "ADD", [ast.placeholder(), ast.placeholder()]);
		expect(generate(node)).toBe("5 |> ADD(?, ?)");
	});

	test("roundtrip: parse → generate", () => {
		const source = "x |> ABS(?)";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: chained pipe", () => {
		const source = "x |> ABS(?) |> DOUBLE(?)";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: pipe with extra args", () => {
		const source = "x |> CLAMP(?, 0, 100)";
		expect(generate(parse(source))).toBe(source);
	});

	test("assignment wraps value in parens when needed", () => {
		const node = ast.pipeExpr(ast.assign("x", ast.number(5)), "ABS", [ast.placeholder()]);
		expect(generate(node)).toBe("(x = 5) |> ABS(?)");
	});

	test("if expression wraps value in parens", () => {
		const node = ast.pipeExpr(ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(2)), "ABS", [
			ast.placeholder(),
		]);
		expect(generate(node)).toBe("(if true then 1 else 2) |> ABS(?)");
	});

	test("for expression wraps value in parens", () => {
		const node = ast.pipeExpr(
			ast.forExpr("x", ast.array([ast.number(1), ast.number(2)]), null, null, ast.identifier("x")),
			"LEN",
			[ast.placeholder()],
		);
		expect(generate(node)).toBe("(for x in [1, 2] then x) |> LEN(?)");
	});

	test("pipe as binary right operand wraps in parens", () => {
		const pipe = ast.pipeExpr(ast.number(2), "F", [ast.placeholder()]);
		const node = ast.add(ast.number(1), pipe);
		expect(generate(node)).toBe("1 + (2 |> F(?))");
	});

	test("pipe as unary argument wraps in parens", () => {
		const pipe = ast.pipeExpr(ast.identifier("x"), "F", [ast.placeholder()]);
		const node = ast.negate(pipe);
		expect(generate(node)).toBe("-(x |> F(?))");
	});

	test("pipe as range end wraps in parens", () => {
		const pipe = ast.pipeExpr(ast.number(2), "F", [ast.placeholder()]);
		const node = ast.rangeExpr(ast.number(1), pipe, false);
		expect(generate(node)).toBe("1..(2 |> F(?))");
	});

	test("roundtrip: pipe as binary right operand", () => {
		const source = "1 + (2 |> F(?))";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: pipe as unary argument", () => {
		const source = "-(x |> F(?))";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: if expression piped", () => {
		const source = "(if true then 1 else 2) |> ABS(?)";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: for expression piped", () => {
		const source = "(for x in [1, 2] then x) |> LEN(?)";
		expect(generate(parse(source))).toBe(source);
	});

	test("roundtrip: pipe as range end", () => {
		const source = "1..(x |> F(?))";
		expect(generate(parse(source))).toBe(source);
	});
});

// --- Optimizer ---

describe("Optimizer: pipe expressions", () => {
	test("folds constant sub-expressions inside pipe args", () => {
		const node = optimize(parse("x |> CLAMP(?, 1 + 1, 50 * 2)"));
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(isNumberLiteral(pipe.args[1] as ASTNode)).toBe(true);
		expect((pipe.args[1] as { value: number }).value).toBe(2);
		expect(isNumberLiteral(pipe.args[2] as ASTNode)).toBe(true);
		expect((pipe.args[2] as { value: number }).value).toBe(100);
	});

	test("folds constant value expression before pipe", () => {
		const node = optimize(parse("1 + 2 |> ABS(?)"));
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(isNumberLiteral(pipe.value)).toBe(true);
		expect((pipe.value as { value: number }).value).toBe(3);
	});

	test("DCE preserves pipe expressions (they have side effects)", () => {
		const node = optimize(parse("x = 1; y = x |> ABS(?); y"));
		// y should not be eliminated because it uses a pipe (function call)
		expect(isIdentifier(node)).toBe(false);
	});

	test("constant propagation into pipe value", () => {
		const node = optimize(parse("x = 5; x |> ABS(?)"), new Set<string>());
		expect(isPipeExpression(node)).toBe(true);
		const pipe = node as PipeExpression;
		expect(isNumberLiteral(pipe.value)).toBe(true);
		expect((pipe.value as { value: number }).value).toBe(5);
	});
});

// --- Analyzer ---

describe("Analyzer: pipe expressions", () => {
	test("extractInputVariables excludes pipe-using assignments", () => {
		const node = parse("x = 10; y = x |> ABS(?)");
		const inputs = extractInputVariables(node);
		// x is a constant literal assignment → input variable
		// y references x → not an input variable
		expect(inputs).toEqual(["x"]);
	});

	test("extractAssignedVariables includes pipe assignments", () => {
		const node = parse("x = 10; y = x |> ABS(?)");
		const assigned = extractAssignedVariables(node);
		expect(assigned).toEqual(["x", "y"]);
	});

	test("extractInputVariables: standalone pipe is not an assignment", () => {
		const node = parse("x |> ABS(?)");
		const inputs = extractInputVariables(node);
		expect(inputs).toEqual([]);
	});

	test("extractAssignedVariables finds assignments inside pipe args", () => {
		// Edge case: assignment nested in pipe arg expression
		// This is a valid expression: the pipe arg is a sub-expression
		const node = parse("x = 5; y = 10; y |> ADD(?, x)");
		const assigned = extractAssignedVariables(node);
		expect(assigned).toEqual(["x", "y"]);
	});
});

// --- AST builders ---

describe("AST builders: pipe", () => {
	test("pipeExpr creates correct node", () => {
		const node = ast.pipeExpr(ast.identifier("x"), "ABS", [ast.placeholder()]);
		expect(node.kind).toBe(NodeKind.PipeExpression);
		expect(node.name).toBe("ABS");
		expect(node.value.kind).toBe(NodeKind.Identifier);
		expect(node.args.length).toBe(1);
		expect(node.args[0]?.kind).toBe(NodeKind.Placeholder);
	});

	test("placeholder creates correct node", () => {
		const node = ast.placeholder();
		expect(node.kind).toBe(NodeKind.Placeholder);
	});

	test("isPipeExpression type guard", () => {
		expect(isPipeExpression(ast.pipeExpr(ast.number(1), "F", [ast.placeholder()]))).toBe(true);
		expect(isPipeExpression(ast.number(1))).toBe(false);
	});

	test("isPlaceholder type guard", () => {
		expect(isPlaceholder(ast.placeholder())).toBe(true);
		expect(isPlaceholder(ast.number(1))).toBe(false);
	});
});
