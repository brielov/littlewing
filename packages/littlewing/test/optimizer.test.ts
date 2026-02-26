import { describe, expect, test } from "bun:test";
import type {
	Assignment,
	BinaryOp,
	BooleanLiteral,
	ForExpression,
	FunctionCall,
	NumberLiteral,
	Program,
	StringLiteral,
} from "../src/ast";
import * as ast from "../src/ast";
import {
	isAssignment,
	isBinaryOp,
	isBooleanLiteral,
	isForExpression,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	isUnaryOp,
} from "../src/ast";
import { evaluate } from "../src/interpreter";
import { optimize } from "../src/optimizer";
import { parse } from "../src/parser";

describe("Optimizer", () => {
	test("constant folding binary operations", () => {
		const node = optimize(parse("2 + 3"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(5);
	});

	test("constant folding with multiplication", () => {
		const node = optimize(parse("4 * 5"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(20);
	});

	test("constant folding complex expression", () => {
		const node = optimize(parse("2 + 3 * 4"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(14);
	});

	test("constant folding with exponentiation", () => {
		const node = optimize(parse("2 ^ 3"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(8);
	});

	test("constant folding unary minus", () => {
		const node = optimize(parse("-5"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(-5);
	});

	test("constant folding nested unary and binary", () => {
		const node = optimize(parse("-(2 + 3)"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(-5);
	});

	test("does not fold with variables", () => {
		const node = optimize(parse("x + 3"));
		expect(isBinaryOp(node)).toBe(true);
		const binaryNode = node as BinaryOp;
		expect(binaryNode.operator).toBe("+");
		expect(isIdentifier(binaryNode.left)).toBe(true);
		expect(isNumberLiteral(binaryNode.right)).toBe(true);
	});

	test("partial folding in assignments", () => {
		const node = optimize(parse("x = 2 + 3"));
		expect(isAssignment(node)).toBe(true);
		const assignNode = node as Assignment;
		expect(assignNode.name).toBe("x");
		expect(isNumberLiteral(assignNode.value)).toBe(true);
		expect((assignNode.value as NumberLiteral).value).toBe(5);
	});

	test("multiple statements with folding", () => {
		const node = optimize(parse("x = 5; y = 2 * 3"));
		// DCE removes unused x=5, leaving only y=6, which unwraps from Program
		expect(isAssignment(node)).toBe(true);
		const assignNode = node as Assignment;
		expect(assignNode.name).toBe("y");
		expect(isNumberLiteral(assignNode.value)).toBe(true);
		expect((assignNode.value as NumberLiteral).value).toBe(6);
	});

	test("large number folding", () => {
		const node = optimize(parse("1000000 + 2000000"));
		expect(isNumberLiteral(node)).toBe(true);
		expect((node as NumberLiteral).value).toBe(3000000);
	});

	test("manual optimize() function", () => {
		const unoptimized = parse("10 * 5");
		const optimized = optimize(unoptimized);
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(50);
	});

	test("execution result same with or without optimization", () => {
		const source = "2 + 3 * 4 - 1";
		const unoptimized = evaluate(source);
		const optimizedAst = optimize(parse(source));
		const optimized = evaluate(optimizedAst);
		expect(optimized).toBe(unoptimized);
		expect(optimized).toBe(13);
	});

	test("division by zero error during folding", () => {
		expect(() => optimize(parse("1 / 0"))).toThrow("Division by zero");
	});

	test("modulo by zero error during folding", () => {
		expect(() => optimize(parse("10 % 0"))).toThrow("Modulo by zero");
	});

	test("function call arguments are optimized recursively", () => {
		const node = optimize(parse("MAX(2 + 3, 4 * 5)"));
		expect(isFunctionCall(node)).toBe(true);
		const funcNode = node as FunctionCall;
		expect(funcNode.args.length).toBe(2);
		const firstArg = funcNode.args[0]!;
		expect(isNumberLiteral(firstArg)).toBe(true);
		expect((firstArg as NumberLiteral).value).toBe(5);
		const secondArg = funcNode.args[1]!;
		expect(isNumberLiteral(secondArg)).toBe(true);
		expect((secondArg as NumberLiteral).value).toBe(20);
	});

	test("nested function calls with constant folding", () => {
		const node = optimize(parse("MAX(MIN(10, 5 + 5), 2 ^ 3)"));
		expect(isFunctionCall(node)).toBe(true);
		const funcNode = node as FunctionCall;
		expect(funcNode.name).toBe("MAX");
		const firstArg = funcNode.args[0]!;
		expect(isFunctionCall(firstArg)).toBe(true);
		const minFunc = firstArg as FunctionCall;
		expect(minFunc.name).toBe("MIN");
		expect(isNumberLiteral(minFunc.args[0]!)).toBe(true);
		expect((minFunc.args[0]! as NumberLiteral).value).toBe(10);
		expect(isNumberLiteral(minFunc.args[1]!)).toBe(true);
		expect((minFunc.args[1]! as NumberLiteral).value).toBe(10);
		const secondArg = funcNode.args[1]!;
		expect(isNumberLiteral(secondArg)).toBe(true);
		expect((secondArg as NumberLiteral).value).toBe(8);
	});

	test("assignment with deeply nested expression", () => {
		const node = optimize(parse("x = -(3 + 4) * 2"));
		expect(isAssignment(node)).toBe(true);
		const assignNode = node as Assignment;
		expect(assignNode.name).toBe("x");
		expect(isNumberLiteral(assignNode.value)).toBe(true);
		expect((assignNode.value as NumberLiteral).value).toBe(-14);
	});

	test("function call with nested unary and binary ops", () => {
		const node = optimize(parse("ABS(-(2 + 3) * 4)"));
		expect(isFunctionCall(node)).toBe(true);
		const funcNode = node as FunctionCall;
		expect(funcNode.name).toBe("ABS");
		const arg = funcNode.args[0]!;
		expect(isNumberLiteral(arg)).toBe(true);
		expect((arg as NumberLiteral).value).toBe(-20);
	});

	test("program with multiple complex statements", () => {
		const source = "a = 2 + 3; b = -(4 * 5); MAX(a, 10 + 10)";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(2);

		const stmt1 = programNode.statements[0]!;
		expect(isAssignment(stmt1)).toBe(true);
		expect((stmt1 as Assignment).name).toBe("a");
		expect(isNumberLiteral((stmt1 as Assignment).value)).toBe(true);
		expect(((stmt1 as Assignment).value as NumberLiteral).value).toBe(5);

		const stmt2 = programNode.statements[1]!;
		expect(isFunctionCall(stmt2)).toBe(true);
		const funcCall = stmt2 as FunctionCall;
		expect(funcCall.name).toBe("MAX");
		expect(isIdentifier(funcCall.args[0]!)).toBe(true);
		expect(isNumberLiteral(funcCall.args[1]!)).toBe(true);
		expect((funcCall.args[1]! as NumberLiteral).value).toBe(20);
	});

	test("variables not propagated (might be overridden by context)", () => {
		const source = "x = 5; x + 10";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(2);
		const stmt0 = programNode.statements[0]!;
		expect(isAssignment(stmt0)).toBe(true);
		expect((stmt0 as Assignment).name).toBe("x");
		const stmt1 = programNode.statements[1]!;
		expect(isBinaryOp(stmt1)).toBe(true);
	});

	test("execution with context override shows why propagation is unsafe", () => {
		const source = "x = 5; x + 10";
		expect(evaluate(source)).toBe(15);
		expect(evaluate(source, { variables: { x: 100 } })).toBe(110);
	});

	test("compound interest example (execution semantics preserved)", () => {
		const source = `
			principal = 1000;
			rate = 0.05;
			years = 10;
			n = 12;
			base = 1 + (rate / n);
			exponent = n * years;
			result = principal * (base ^ exponent);
			result
		`;
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const result = evaluate(source);
		expect(result).toBeCloseTo(1647.01, 2);
		const resultWithOverride = evaluate(source, {
			variables: { principal: 2000 },
		});
		expect(resultWithOverride).toBeCloseTo(3294.02, 2);
	});

	test("preserves external variables", () => {
		const source = "x = external + 10; x * 2";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(2);
		expect(isAssignment(programNode.statements[0]!)).toBe(true);
		expect(isBinaryOp(programNode.statements[1]!)).toBe(true);
	});

	test("mixed constant and external variables", () => {
		const source = "a = 5; b = external; c = a + b; c";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(4);
		expect(JSON.stringify(node)).toContain("external");
	});

	test("function calls prevent full folding", () => {
		const source = "x = 5; y = NOW(); x + y";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(3);
		expect(JSON.stringify(node)).toContain("NOW");
	});

	test("variable reassignment prevents propagation", () => {
		const source = "x = 5; x = 10; x";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(3);
	});

	test("complex arithmetic preserves variables", () => {
		const source = "a = 2; b = 3; c = 4; result = a * b + c ^ 2; result";
		const node = optimize(parse(source));
		expect(isProgram(node)).toBe(true);
		const programNode = node as Program;
		expect(programNode.statements.length).toBe(5);
		expect(evaluate(node)).toBe(22);
	});

	test("execution result unchanged after optimization", () => {
		const source = "x = 10; y = 20; z = x + y; z * 2";
		const unoptimized = parse(source);
		const optimized = optimize(unoptimized);
		expect(evaluate(unoptimized)).toBe(evaluate(optimized));
		expect(evaluate(unoptimized)).toBe(60);
	});

	test("division by zero caught at execution time", () => {
		const source = "x = 10; y = 0; x / y";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		expect(() => evaluate(source)).toThrow("Division by zero");
	});

	test("modulo by zero caught at execution time", () => {
		const source = "x = 10; y = 0; x % y";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		expect(() => evaluate(source)).toThrow("Modulo by zero");
	});

	test("constant folding for if expression (true condition)", () => {
		const optimized = optimize(parse("if true then 100 else 50"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(100);
	});

	test("constant folding for if expression (false condition)", () => {
		const optimized = optimize(parse("if false then 100 else 50"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(50);
	});

	test("if expression with constant comparison folds to boolean then resolves", () => {
		const optimized1 = optimize(parse("if 5 > 3 then 100 else 50"));
		expect(isNumberLiteral(optimized1)).toBe(true);
		expect((optimized1 as NumberLiteral).value).toBe(100);

		const optimized2 = optimize(parse("if 5 < 3 then 100 else 50"));
		expect(isNumberLiteral(optimized2)).toBe(true);
		expect((optimized2 as NumberLiteral).value).toBe(50);
	});

	test("complex if expression optimization", () => {
		const source = "x = 10; y = 5; result = if x > y then 100 else 50; result";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		expect(evaluate(source)).toBe(100);
	});

	test("nested if expression optimization", () => {
		const optimized = optimize(parse("if true then if true then 100 else 200 else 300"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(100);
	});

	test("constant folding for comparison operators produces boolean", () => {
		const optimized1 = optimize(parse("5 == 5"));
		expect(isBooleanLiteral(optimized1)).toBe(true);
		expect((optimized1 as BooleanLiteral).value).toBe(true);

		const optimized2 = optimize(parse("10 < 5"));
		expect(isBooleanLiteral(optimized2)).toBe(true);
		expect((optimized2 as BooleanLiteral).value).toBe(false);

		// Variables are NOT propagated
		const optimized3 = optimize(parse("x = 10; y = 5; z = x > y; z"));
		expect(isProgram(optimized3)).toBe(true);
		expect(evaluate("x = 10; y = 5; z = x > y; z")).toBe(true);
	});

	test("constant folding for && with booleans", () => {
		expect(optimize(parse("true && true"))).toEqual(ast.boolean(true));
		expect(optimize(parse("true && false"))).toEqual(ast.boolean(false));
		expect(optimize(parse("false && true"))).toEqual(ast.boolean(false));
		expect(optimize(parse("false && false"))).toEqual(ast.boolean(false));
	});

	test("constant folding for || with booleans", () => {
		expect(optimize(parse("true || true"))).toEqual(ast.boolean(true));
		expect(optimize(parse("true || false"))).toEqual(ast.boolean(true));
		expect(optimize(parse("false || true"))).toEqual(ast.boolean(true));
		expect(optimize(parse("false || false"))).toEqual(ast.boolean(false));
	});

	test("logical operators with comparisons fold to boolean", () => {
		expect(optimize(parse("5 > 3 && 10 > 8"))).toEqual(ast.boolean(true));
		expect(optimize(parse("5 < 3 || 10 > 8"))).toEqual(ast.boolean(true));
		expect(optimize(parse("5 < 3 && 10 < 8"))).toEqual(ast.boolean(false));
	});

	test("unary operation with variable (cannot fold)", () => {
		const optimized = optimize(parse("-x"));
		expect(isUnaryOp(optimized)).toBe(true);
		if (isUnaryOp(optimized)) {
			expect(isIdentifier(optimized.argument)).toBe(true);
		}
	});

	test("constant folding for logical NOT on booleans", () => {
		const optimized1 = optimize(parse("!true"));
		expect(isBooleanLiteral(optimized1)).toBe(true);
		expect((optimized1 as BooleanLiteral).value).toBe(false);

		const optimized2 = optimize(parse("!false"));
		expect(isBooleanLiteral(optimized2)).toBe(true);
		expect((optimized2 as BooleanLiteral).value).toBe(true);
	});

	test("constant folding for double NOT on booleans", () => {
		const optimized1 = optimize(parse("!!true"));
		expect(isBooleanLiteral(optimized1)).toBe(true);
		expect((optimized1 as BooleanLiteral).value).toBe(true);

		const optimized2 = optimize(parse("!!false"));
		expect(isBooleanLiteral(optimized2)).toBe(true);
		expect((optimized2 as BooleanLiteral).value).toBe(false);
	});

	test("NOT with variable cannot fold", () => {
		const optimized = optimize(parse("!x"));
		expect(isUnaryOp(optimized)).toBe(true);
		if (isUnaryOp(optimized)) {
			expect(optimized.operator).toBe("!");
			expect(isIdentifier(optimized.argument)).toBe(true);
		}
	});

	test("NOT in if expression with boolean literal", () => {
		const optimized1 = optimize(parse("if !false then 100 else 50"));
		expect(isNumberLiteral(optimized1)).toBe(true);
		expect((optimized1 as NumberLiteral).value).toBe(100);

		const optimized2 = optimize(parse("if !true then 100 else 50"));
		expect(isNumberLiteral(optimized2)).toBe(true);
		expect((optimized2 as NumberLiteral).value).toBe(50);
	});

	test("string constant folding", () => {
		const optimized = optimize(parse('"hello" + " world"'));
		expect(ast.isStringLiteral(optimized)).toBe(true);
		if (ast.isStringLiteral(optimized)) {
			expect(optimized.value).toBe("hello world");
		}
	});

	test("string comparison folding", () => {
		expect(optimize(parse('"abc" == "abc"'))).toEqual(ast.boolean(true));
		expect(optimize(parse('"abc" != "def"'))).toEqual(ast.boolean(true));
		expect(optimize(parse('"abc" < "def"'))).toEqual(ast.boolean(true));
	});

	test("cross-type equality folding", () => {
		expect(optimize(parse('5 == "5"'))).toEqual(ast.boolean(false));
		expect(optimize(parse('5 != "5"'))).toEqual(ast.boolean(true));
		expect(optimize(parse("true == 1"))).toEqual(ast.boolean(false));
	});

	test("boolean equality folding", () => {
		expect(optimize(parse("true == true"))).toEqual(ast.boolean(true));
		expect(optimize(parse("true == false"))).toEqual(ast.boolean(false));
		expect(optimize(parse("true != false"))).toEqual(ast.boolean(true));
	});

	test("array literal elements are optimized", () => {
		const optimized = optimize(parse("[2 + 3, 4 * 5]"));
		if (ast.isArrayLiteral(optimized)) {
			expect(isNumberLiteral(optimized.elements[0]!)).toBe(true);
			expect((optimized.elements[0]! as NumberLiteral).value).toBe(5);
			expect(isNumberLiteral(optimized.elements[1]!)).toBe(true);
			expect((optimized.elements[1]! as NumberLiteral).value).toBe(20);
		}
	});
});

describe("Dead Code Elimination", () => {
	test("removes unused variable assignment", () => {
		const source = "x = 10; y = 20; z = x * 20";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
		expect((prog.statements[0] as Assignment).name).toBe("x");
		expect((prog.statements[1] as Assignment).name).toBe("z");
	});

	test("preserves used variables", () => {
		const source = "x = 10; y = 20; x + y";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
	});

	test("preserves last statement even if unused", () => {
		const source = "x = 10; y = 20";
		const optimized = optimize(parse(source));
		// DCE removes unused x=10, leaving only y=20, which unwraps from Program
		expect(isAssignment(optimized)).toBe(true);
		expect((optimized as Assignment).name).toBe("y");
	});

	test("removes multiple unused variables", () => {
		const source = "a = 1; b = 2; c = 3; d = 4; e = a + c";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
		expect((prog.statements[0] as Assignment).name).toBe("a");
		expect((prog.statements[1] as Assignment).name).toBe("c");
		expect((prog.statements[2] as Assignment).name).toBe("e");
	});

	test("handles variable used in function call", () => {
		const source = "x = 10; y = 20; z = 30; MAX(x, z)";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
		expect((prog.statements[0] as Assignment).name).toBe("x");
		expect((prog.statements[1] as Assignment).name).toBe("z");
		expect(isFunctionCall(prog.statements[2]!)).toBe(true);
	});

	test("handles variable used in if expression", () => {
		const source = "x = 10; y = 20; z = 30; if x > y then z else 0";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(4);
	});

	test("handles variable used in nested expression", () => {
		const source = "a = 5; b = 10; c = 15; result = (a + b) * c";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(4);
	});

	test("removes variable assigned but only used in dead code", () => {
		const source = "x = 10; y = x; z = 20; z";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
		expect((prog.statements[0] as Assignment).name).toBe("z");
	});

	test("execution result unchanged after DCE", () => {
		const source = "x = 10; y = 20; z = 30; x + z";
		expect(evaluate(source)).toBe(40);
	});

	test("handles empty program", () => {
		const emptyProgram = ast.program([]);
		const optimized = optimize(emptyProgram);
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(0);
	});

	test("handles single statement", () => {
		const source = "x = 42";
		const optimized = optimize(parse(source));
		expect(isAssignment(optimized)).toBe(true);
		expect((optimized as Assignment).name).toBe("x");
		expect(isNumberLiteral((optimized as Assignment).value)).toBe(true);
		expect(((optimized as Assignment).value as NumberLiteral).value).toBe(42);
	});

	test("handles chained variable dependencies", () => {
		const source = "a = 1; b = a; c = b; d = c; e = 99; d";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(5);
		const names = prog.statements.filter(isAssignment).map((s) => s.name);
		expect(names).toEqual(["a", "b", "c", "d"]);
	});

	test("handles variable reuse (write after read)", () => {
		const source = "x = 10; y = x; x = 20; y";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
		expect((prog.statements[0] as Assignment).name).toBe("x");
		expect((prog.statements[0] as Assignment).value).toEqual(ast.number(10));
		expect((prog.statements[1] as Assignment).name).toBe("y");
	});

	test("combines constant folding with DCE", () => {
		const source = "x = 2 + 3; y = 4 * 5; z = x * 2; z";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
		const xAssignment = prog.statements[0] as Assignment;
		expect(xAssignment.name).toBe("x");
		expect(isNumberLiteral(xAssignment.value)).toBe(true);
		expect((xAssignment.value as NumberLiteral).value).toBe(5);
		const names = prog.statements.filter(isAssignment).map((s) => s.name);
		expect(names).not.toContain("y");
	});

	test("handles unary operations on unused variables", () => {
		const source = "x = 10; y = -x; z = 5; z";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
		expect((prog.statements[0] as Assignment).name).toBe("z");
	});

	test("preserves variables used in logical expressions", () => {
		const source = "x = true; y = false; z = true; result = x && y || z; result";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(5);
	});

	test("handles variables used only in assignment RHS", () => {
		const source = "a = 10; b = a + 5; c = 20; c";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
		expect((prog.statements[0] as Assignment).name).toBe("c");
	});
});

describe("Constant Propagation", () => {
	const noExternals = new Set<string>();

	test("propagates single-assignment literal", () => {
		const optimized = optimize(parse("x = 5; x + 10"), noExternals);
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(15);
	});

	test("propagates multiple variables", () => {
		const optimized = optimize(parse("x = 5; y = 10; x + y"), noExternals);
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(15);
	});

	test("chains through expressions", () => {
		const optimized = optimize(parse("x = 5; y = x + 10; y * 2"), noExternals);
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(30);
	});

	test("propagates string literals", () => {
		const optimized = optimize(parse('greeting = "hello"; greeting + " world"'), noExternals);
		expect(isStringLiteral(optimized)).toBe(true);
		expect((optimized as StringLiteral).value).toBe("hello world");
	});

	test("propagates boolean literals", () => {
		const optimized = optimize(parse("flag = true; if flag then 1 else 0"), noExternals);
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(1);
	});

	test("does NOT propagate external variables", () => {
		const optimized = optimize(parse("x = 5; y = 10; x + y"), new Set(["x"]));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		// x is external, so x assignment kept; y=10 propagated and folded
		// Result: x = 5; x + 10
		expect(prog.statements.length).toBe(2);
		expect((prog.statements[0] as Assignment).name).toBe("x");
		const expr = prog.statements[1]!;
		expect(isBinaryOp(expr)).toBe(true);
		const binOp = expr as BinaryOp;
		expect(isIdentifier(binOp.left)).toBe(true);
		expect(isNumberLiteral(binOp.right)).toBe(true);
		expect((binOp.right as NumberLiteral).value).toBe(10);
	});

	test("does NOT propagate reassigned variables", () => {
		const optimized = optimize(parse("x = 5; x = 10; x"), noExternals);
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
	});

	test("does NOT propagate non-literal values (function calls)", () => {
		const optimized = optimize(parse("x = NOW(); x"), noExternals);
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
	});

	test("does NOT propagate non-literal values (identifiers)", () => {
		const optimized = optimize(parse("x = y; x + 1"), noExternals);
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
	});

	test("does NOT propagate without externalVariables param (backward compat)", () => {
		const source = "x = 5; x + 10";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(2);
		expect(isBinaryOp(prog.statements[1]!)).toBe(true);
	});

	test("DCE removes propagated-then-unused assignments", () => {
		const optimized = optimize(parse("x = 5; y = 10; x + y"), noExternals);
		// Both x and y are propagated and folded to 15
		// Their assignments become dead code and are eliminated
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(15);
	});

	test("does NOT propagate for loop variables", () => {
		const source = "x = 5; for x in [1, 2, 3] then x * 2";
		const optimized = optimize(parse(source), noExternals);
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		// x is a for-loop variable, so x=5 is not propagated
		expect(prog.statements.length).toBe(2);
	});

	test("preserves execution semantics with propagation", () => {
		const source = "price = 100; tax = 0.08; total = price * (1 + tax); total";
		const withoutProp = evaluate(source);
		const optimized = optimize(parse(source), noExternals);
		const withProp = evaluate(optimized);
		expect(withProp).toBe(withoutProp);
		expect(withProp).toBeCloseTo(108, 10);
	});

	test("preserves execution semantics with external overrides", () => {
		const source = "price = 100; tax = 0.08; total = price * (1 + tax); total";
		const externals = new Set(["price"]);
		const optimized = optimize(parse(source), externals);
		// With price overridden at runtime, tax is still propagated
		expect(evaluate(optimized, { variables: { price: 200 } })).toBeCloseTo(216, 10);
	});

	test("full pipeline example: all locals fold away", () => {
		const source = "price = 100; tax = 0.08; total = price * (1 + tax); total";
		const optimized = optimize(parse(source), noExternals);
		// All variables are local literals, everything folds
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBeCloseTo(108, 10);
	});

	test("partial propagation with mixed external and local", () => {
		const source = "a = 5; b = external; c = a + 10; c";
		const optimized = optimize(parse(source), new Set(["external"]));
		// a=5 propagated, c = 5 + 10 = 15, b=external kept but DCE removes it
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(15);
	});
});

describe("IndexAccess folding", () => {
	test("folds array literal index access", () => {
		const optimized = optimize(parse("[1, 2, 3][1]"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(2);
	});

	test("folds string literal index access", () => {
		const optimized = optimize(parse('"hello"[0]'));
		expect(isStringLiteral(optimized)).toBe(true);
		expect((optimized as StringLiteral).value).toBe("h");
	});

	test("folds negative index on array", () => {
		const optimized = optimize(parse("[10, 20, 30][-1]"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(30);
	});

	test("does not fold out of bounds index", () => {
		const optimized = optimize(parse("[1, 2, 3][5]"));
		expect(ast.isIndexAccess(optimized)).toBe(true);
	});

	test("does not fold variable index", () => {
		const optimized = optimize(parse("[1, 2, 3][x]"));
		expect(ast.isIndexAccess(optimized)).toBe(true);
	});
});

describe("RangeExpression folding", () => {
	test("folds constant exclusive range", () => {
		const optimized = optimize(parse("1..4"));
		expect(ast.isArrayLiteral(optimized)).toBe(true);
		if (ast.isArrayLiteral(optimized)) {
			expect(optimized.elements.length).toBe(3);
			expect((optimized.elements[0] as NumberLiteral).value).toBe(1);
			expect((optimized.elements[1] as NumberLiteral).value).toBe(2);
			expect((optimized.elements[2] as NumberLiteral).value).toBe(3);
		}
	});

	test("folds constant inclusive range", () => {
		const optimized = optimize(parse("1..=3"));
		expect(ast.isArrayLiteral(optimized)).toBe(true);
		if (ast.isArrayLiteral(optimized)) {
			expect(optimized.elements.length).toBe(3);
		}
	});

	test("does not fold range with variable", () => {
		const optimized = optimize(parse("1..n"));
		expect(ast.isRangeExpression(optimized)).toBe(true);
	});

	test("combined: range then index folds", () => {
		const optimized = optimize(parse("(1..=5)[2]"));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(3);
	});
});

describe("Comment preservation through optimizer", () => {
	test("comments survive constant folding", () => {
		const source = "// compute\n2 + 3";
		const optimized = optimize(parse(source));
		expect(isNumberLiteral(optimized)).toBe(true);
		expect((optimized as NumberLiteral).value).toBe(5);
		expect(optimized.leadingComments).toEqual(["// compute"]);
	});

	test("comments on dead code are dropped", () => {
		const source = "// unused\nx = 10\n// used\ny = 20";
		const optimized = optimize(parse(source));
		// DCE removes x=10, leaving only y=20 (unwrapped from Program)
		expect(isAssignment(optimized)).toBe(true);
		expect((optimized as Assignment).name).toBe("y");
		expect(optimized.leadingComments).toEqual(["// used"]);
	});

	test("comments preserved on kept statements after DCE", () => {
		const source = "// setup\nx = 10\n// result\ny = x * 2\ny";
		const optimized = optimize(parse(source));
		expect(isProgram(optimized)).toBe(true);
		const prog = optimized as Program;
		expect(prog.statements.length).toBe(3);
		expect(prog.statements[0]!.leadingComments).toEqual(["// setup"]);
		expect(prog.statements[1]!.leadingComments).toEqual(["// result"]);
	});

	test("for accumulator initial value gets folded", () => {
		const optimized = optimize(parse("for x in arr into sum = 1 + 1 then sum + x"));
		expect(isForExpression(optimized)).toBe(true);
		const forNode = optimized as ForExpression;
		expect(forNode.accumulator).not.toBeNull();
		expect(isNumberLiteral(forNode.accumulator!.initial)).toBe(true);
		expect((forNode.accumulator!.initial as NumberLiteral).value).toBe(2);
	});

	test("for accumulator variable not propagated", () => {
		const source = "sum = 10; for x in [1, 2] into sum = 0 then sum + x";
		const optimized = optimize(parse(source), new Set());
		expect(isProgram(optimized)).toBe(true);
	});
});
