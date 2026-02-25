import { describe, expect, test } from "bun:test";
import * as ast from "../src/ast";
import {
	isArrayLiteral,
	isBinaryOp,
	isBooleanLiteral,
	isForExpression,
	isIfExpression,
	isIndexAccess,
	isRangeExpression,
	isStringLiteral,
	NodeKind,
} from "../src/ast";
import { evaluate } from "../src/interpreter";

describe("AST Builders", () => {
	test("manual construction", () => {
		const node = ast.add(ast.number(2), ast.number(3));
		const result = evaluate(node);
		expect(result).toBe(5);
	});

	test("complex expression", () => {
		const node = ast.multiply(ast.add(ast.number(2), ast.number(3)), ast.number(4));
		const result = evaluate(node);
		expect(result).toBe(20);
	});

	test("with variables", () => {
		const node = ast.assign("x", ast.add(ast.number(2), ast.number(3)));
		const result = evaluate(node);
		expect(result).toBe(5);
	});

	test("function call", () => {
		const node = ast.functionCall("ABS", [ast.negate(ast.number(5))]);
		const result = evaluate(node, {
			functions: {
				ABS: (x) => {
					if (typeof x !== "number") throw new TypeError("expected number");
					return Math.abs(x);
				},
			},
		});
		expect(result).toBe(5);
	});

	test("unary operator", () => {
		const node = ast.negate(ast.number(5));
		const result = evaluate(node);
		expect(result).toBe(-5);
	});

	test("comparison operator builders", () => {
		const node1 = ast.equals(ast.number(5), ast.number(5));
		expect(isBinaryOp(node1)).toBe(true);
		if (isBinaryOp(node1)) {
			expect(node1.operator).toBe("==");
		}

		const node2 = ast.notEquals(ast.number(5), ast.number(3));
		expect(isBinaryOp(node2)).toBe(true);
		if (isBinaryOp(node2)) {
			expect(node2.operator).toBe("!=");
		}

		const node3 = ast.lessThan(ast.number(3), ast.number(5));
		expect(isBinaryOp(node3)).toBe(true);
		if (isBinaryOp(node3)) {
			expect(node3.operator).toBe("<");
		}

		const node4 = ast.greaterThan(ast.number(5), ast.number(3));
		expect(isBinaryOp(node4)).toBe(true);
		if (isBinaryOp(node4)) {
			expect(node4.operator).toBe(">");
		}

		const node5 = ast.lessEqual(ast.number(3), ast.number(5));
		expect(isBinaryOp(node5)).toBe(true);
		if (isBinaryOp(node5)) {
			expect(node5.operator).toBe("<=");
		}

		const node6 = ast.greaterEqual(ast.number(5), ast.number(3));
		expect(isBinaryOp(node6)).toBe(true);
		if (isBinaryOp(node6)) {
			expect(node6.operator).toBe(">=");
		}
	});

	test("if expression builder", () => {
		const node = ast.ifExpr(
			ast.greaterThan(ast.number(5), ast.number(3)),
			ast.number(100),
			ast.number(50),
		);
		expect(isIfExpression(node)).toBe(true);
		if (isIfExpression(node)) {
			expect(node.kind).toBe(NodeKind.IfExpression);
			expect(node.condition).toBeDefined();
			expect(node.consequent).toBeDefined();
			expect(node.alternate).toBeDefined();
		}
	});

	test("for expression builder", () => {
		const node = ast.forExpr(
			"x",
			ast.array([ast.number(1), ast.number(2)]),
			null,
			ast.identifier("x"),
		);
		expect(isForExpression(node)).toBe(true);
		if (isForExpression(node)) {
			expect(node.kind).toBe(NodeKind.ForExpression);
			expect(node.variable).toBe("x");
			expect(node.guard).toBeNull();
		}
	});

	test("for expression builder with guard", () => {
		const node = ast.forExpr(
			"x",
			ast.identifier("arr"),
			ast.greaterThan(ast.identifier("x"), ast.number(0)),
			ast.multiply(ast.identifier("x"), ast.number(2)),
		);
		expect(isForExpression(node)).toBe(true);
		if (isForExpression(node)) {
			expect(node.guard).not.toBeNull();
		}
	});

	test("logicalAnd", () => {
		const node = ast.logicalAnd(ast.boolean(true), ast.boolean(true));
		expect(isBinaryOp(node)).toBe(true);
		if (isBinaryOp(node)) {
			expect(node.operator).toBe("&&");
		}
		const result = evaluate(node);
		expect(result).toBe(true);
	});

	test("logicalOr", () => {
		const node = ast.logicalOr(ast.boolean(false), ast.boolean(true));
		expect(isBinaryOp(node)).toBe(true);
		if (isBinaryOp(node)) {
			expect(node.operator).toBe("||");
		}
		const result = evaluate(node);
		expect(result).toBe(true);
	});

	test("string builder", () => {
		const node = ast.string("hello");
		expect(isStringLiteral(node)).toBe(true);
		if (isStringLiteral(node)) {
			expect(node.kind).toBe(NodeKind.StringLiteral);
			expect(node.value).toBe("hello");
		}
	});

	test("boolean builder", () => {
		const nodeTrue = ast.boolean(true);
		expect(isBooleanLiteral(nodeTrue)).toBe(true);
		if (isBooleanLiteral(nodeTrue)) {
			expect(nodeTrue.kind).toBe(NodeKind.BooleanLiteral);
			expect(nodeTrue.value).toBe(true);
		}

		const nodeFalse = ast.boolean(false);
		expect(isBooleanLiteral(nodeFalse)).toBe(true);
		if (isBooleanLiteral(nodeFalse)) {
			expect(nodeFalse.value).toBe(false);
		}
	});

	test("array builder", () => {
		const node = ast.array([ast.number(1), ast.number(2), ast.number(3)]);
		expect(isArrayLiteral(node)).toBe(true);
		if (isArrayLiteral(node)) {
			expect(node.kind).toBe(NodeKind.ArrayLiteral);
			expect(node.elements.length).toBe(3);
		}
	});

	test("logicalNot builder", () => {
		const node = ast.logicalNot(ast.boolean(true));
		expect(node.kind).toBe(NodeKind.UnaryOp);
		expect(node.operator).toBe("!");
		const result = evaluate(node);
		expect(result).toBe(false);
	});

	test("indexAccess builder", () => {
		const node = ast.indexAccess(ast.array([ast.number(10), ast.number(20)]), ast.number(1));
		expect(isIndexAccess(node)).toBe(true);
		if (isIndexAccess(node)) {
			expect(node.kind).toBe(NodeKind.IndexAccess);
			expect(isArrayLiteral(node.object)).toBe(true);
			expect(ast.isNumberLiteral(node.index)).toBe(true);
		}
		const result = evaluate(node);
		expect(result).toBe(20);
	});

	test("rangeExpr builder", () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(4), false);
		expect(isRangeExpression(node)).toBe(true);
		if (isRangeExpression(node)) {
			expect(node.kind).toBe(NodeKind.RangeExpression);
			expect(node.inclusive).toBe(false);
		}
		const result = evaluate(node);
		expect(result).toEqual([1, 2, 3]);
	});

	test("rangeExpr builder inclusive", () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(3), true);
		expect(isRangeExpression(node)).toBe(true);
		if (isRangeExpression(node)) {
			expect(node.inclusive).toBe(true);
		}
		const result = evaluate(node);
		expect(result).toEqual([1, 2, 3]);
	});
});
