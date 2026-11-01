import { describe, expect, test } from 'bun:test';
import * as ast from '../src/ast';
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
} from '../src/ast';
import { evaluate } from '../src/interpreter';
import { parse } from '../src/parser';

describe('AST Builders', () => {
	test('manual construction', () => {
		const node = ast.add(ast.number(2), ast.number(3));
		const result = evaluate(node);
		expect(result).toBe(5);
	});

	test('complex expression', () => {
		const node = ast.multiply(ast.add(ast.number(2), ast.number(3)), ast.number(4));
		const result = evaluate(node);
		expect(result).toBe(20);
	});

	test('with variables', () => {
		const node = ast.assign('x', ast.add(ast.number(2), ast.number(3)));
		const result = evaluate(node);
		expect(result).toBe(5);
	});

	test('function call', () => {
		const node = ast.functionCall('ABS', [ast.negate(ast.number(5))]);
		const result = evaluate(node, {
			functions: {
				ABS: (x) => {
					if (typeof x !== 'number') throw new TypeError('expected number');
					return Math.abs(x);
				},
			},
		});
		expect(result).toBe(5);
	});

	test('unary operator', () => {
		const node = ast.negate(ast.number(5));
		const result = evaluate(node);
		expect(result).toBe(-5);
	});

	test('comparison operator builders', () => {
		const node1 = ast.equals(ast.number(5), ast.number(5));
		expect(isBinaryOp(node1)).toBe(true);
		if (isBinaryOp(node1)) {
			expect(node1.operator).toBe('==');
		}

		const node2 = ast.notEquals(ast.number(5), ast.number(3));
		expect(isBinaryOp(node2)).toBe(true);
		if (isBinaryOp(node2)) {
			expect(node2.operator).toBe('!=');
		}

		const node3 = ast.lessThan(ast.number(3), ast.number(5));
		expect(isBinaryOp(node3)).toBe(true);
		if (isBinaryOp(node3)) {
			expect(node3.operator).toBe('<');
		}

		const node4 = ast.greaterThan(ast.number(5), ast.number(3));
		expect(isBinaryOp(node4)).toBe(true);
		if (isBinaryOp(node4)) {
			expect(node4.operator).toBe('>');
		}

		const node5 = ast.lessEqual(ast.number(3), ast.number(5));
		expect(isBinaryOp(node5)).toBe(true);
		if (isBinaryOp(node5)) {
			expect(node5.operator).toBe('<=');
		}

		const node6 = ast.greaterEqual(ast.number(5), ast.number(3));
		expect(isBinaryOp(node6)).toBe(true);
		if (isBinaryOp(node6)) {
			expect(node6.operator).toBe('>=');
		}
	});

	test('if expression builder', () => {
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

	test('for expression builder', () => {
		const node = ast.forExpr(
			'x',
			ast.array([ast.number(1), ast.number(2)]),
			null,
			null,
			ast.identifier('x'),
		);
		expect(isForExpression(node)).toBe(true);
		if (isForExpression(node)) {
			expect(node.kind).toBe(NodeKind.ForExpression);
			expect(node.variable).toBe('x');
			expect(node.guard).toBeNull();
			expect(node.accumulator).toBeNull();
		}
	});

	test('for expression builder with guard', () => {
		const node = ast.forExpr(
			'x',
			ast.identifier('arr'),
			ast.greaterThan(ast.identifier('x'), ast.number(0)),
			null,
			ast.multiply(ast.identifier('x'), ast.number(2)),
		);
		expect(isForExpression(node)).toBe(true);
		if (isForExpression(node)) {
			expect(node.guard).not.toBeNull();
			expect(node.accumulator).toBeNull();
		}
	});

	test('logicalAnd', () => {
		const node = ast.logicalAnd(ast.boolean(true), ast.boolean(true));
		expect(isBinaryOp(node)).toBe(true);
		if (isBinaryOp(node)) {
			expect(node.operator).toBe('&&');
		}
		const result = evaluate(node);
		expect(result).toBe(true);
	});

	test('logicalOr', () => {
		const node = ast.logicalOr(ast.boolean(false), ast.boolean(true));
		expect(isBinaryOp(node)).toBe(true);
		if (isBinaryOp(node)) {
			expect(node.operator).toBe('||');
		}
		const result = evaluate(node);
		expect(result).toBe(true);
	});

	test('string builder', () => {
		const node = ast.string('hello');
		expect(isStringLiteral(node)).toBe(true);
		if (isStringLiteral(node)) {
			expect(node.kind).toBe(NodeKind.StringLiteral);
			expect(node.value).toBe('hello');
		}
	});

	test('boolean builder', () => {
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

	test('array builder', () => {
		const node = ast.array([ast.number(1), ast.number(2), ast.number(3)]);
		expect(isArrayLiteral(node)).toBe(true);
		if (isArrayLiteral(node)) {
			expect(node.kind).toBe(NodeKind.ArrayLiteral);
			expect(node.elements.length).toBe(3);
		}
	});

	test('logicalNot builder', () => {
		const node = ast.logicalNot(ast.boolean(true));
		expect(node.kind).toBe(NodeKind.UnaryOp);
		expect(node.operator).toBe('!');
		const result = evaluate(node);
		expect(result).toBe(false);
	});

	test('indexAccess builder', () => {
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

	test('rangeExpr builder', () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(4), false);
		expect(isRangeExpression(node)).toBe(true);
		if (isRangeExpression(node)) {
			expect(node.kind).toBe(NodeKind.RangeExpression);
			expect(node.inclusive).toBe(false);
		}
		const result = evaluate(node);
		expect(result).toEqual([1, 2, 3]);
	});

	test('rangeExpr builder inclusive', () => {
		const node = ast.rangeExpr(ast.number(1), ast.number(3), true);
		expect(isRangeExpression(node)).toBe(true);
		if (isRangeExpression(node)) {
			expect(node.inclusive).toBe(true);
		}
		const result = evaluate(node);
		expect(result).toEqual([1, 2, 3]);
	});

	test('visit traverses every node kind', () => {
		const node = ast.forExpr(
			'x',
			ast.array([ast.number(1), ast.number(2)]),
			ast.greaterThan(ast.identifier('x'), ast.number(0)),
			{ name: 'sum', initial: ast.number(0) },
			ast.add(ast.identifier('sum'), ast.identifier('x')),
		);

		const count = ast.visit(node, {
			Program: (n, recurse) => 1 + n.statements.reduce((sum, stmt) => sum + recurse(stmt), 0),
			NumberLiteral: () => 1,
			StringLiteral: () => 1,
			BooleanLiteral: () => 1,
			ArrayLiteral: (n, recurse) => 1 + n.elements.reduce((sum, elem) => sum + recurse(elem), 0),
			Identifier: () => 1,
			BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
			UnaryOp: (n, recurse) => 1 + recurse(n.argument),
			FunctionCall: (n, recurse) => 1 + n.args.reduce((sum, arg) => sum + recurse(arg), 0),
			Assignment: (n, recurse) => 1 + recurse(n.value),
			IfExpression: (n, recurse) =>
				1 + recurse(n.condition) + recurse(n.consequent) + recurse(n.alternate),
			ForExpression: (n, recurse) =>
				1 +
				recurse(n.iterable) +
				(n.guard ? recurse(n.guard) : 0) +
				(n.accumulator ? recurse(n.accumulator.initial) : 0) +
				recurse(n.body),
			IndexAccess: (n, recurse) => 1 + recurse(n.object) + recurse(n.index),
			RangeExpression: (n, recurse) => 1 + recurse(n.from) + recurse(n.to),
			PipeExpression: (n, recurse) =>
				1 + recurse(n.value) + n.args.reduce((sum, arg) => sum + recurse(arg), 0),
			Placeholder: () => 1,
		});

		expect(count).toBe(11);
	});
});

const id = (name: string): ast.Identifier => ast.identifier(name);

test('visit dispatches every kind and recurses', () => {
	const nodes = parse(`x = [1, "a", true, y][0]
if !a then -b else F(c)
for i in 1..=3 when i > 0 into t = 0 then t + i
1 |> F(?, 2)
z`);
	const seen: Record<string, number> = {};
	const count = (
		name: string,
		children: readonly ast.ASTNode[],
		recurse: (n: ast.ASTNode) => number,
	) => {
		seen[name] = (seen[name] ?? 0) + 1;
		return children.reduce((sum, child) => sum + recurse(child), 1);
	};
	const total = ast.visit<number>(nodes, {
		Program: (n, r) => count('Program', n.statements, r),
		NumberLiteral: (_, r) => count('NumberLiteral', [], r),
		StringLiteral: (_, r) => count('StringLiteral', [], r),
		BooleanLiteral: (_, r) => count('BooleanLiteral', [], r),
		ArrayLiteral: (n, r) => count('ArrayLiteral', n.elements, r),
		Identifier: (_, r) => count('Identifier', [], r),
		BinaryOp: (n, r) => count('BinaryOp', [n.left, n.right], r),
		UnaryOp: (n, r) => count('UnaryOp', [n.argument], r),
		FunctionCall: (n, r) => count('FunctionCall', n.args, r),
		Assignment: (n, r) => count('Assignment', [n.value], r),
		IfExpression: (n, r) => count('IfExpression', [n.condition, n.consequent, n.alternate], r),
		ForExpression: (n, r) => count('ForExpression', [n.iterable, n.body], r),
		IndexAccess: (n, r) => count('IndexAccess', [n.object, n.index], r),
		RangeExpression: (n, r) => count('RangeExpression', [n.from, n.to], r),
		PipeExpression: (n, r) => count('PipeExpression', [n.value, ...n.args], r),
		Placeholder: (_, r) => count('Placeholder', [], r),
	});
	expect(Object.keys(seen)).toHaveLength(16);
	expect(total).toBe(Object.values(seen).reduce((sum, n) => sum + n, 0));
});

test('getNodeName names every kind', () => {
	const nodes: [ast.ASTNode, string][] = [
		[ast.program([]), 'Program'],
		[ast.number(1), 'NumberLiteral'],
		[ast.string('a'), 'StringLiteral'],
		[ast.boolean(true), 'BooleanLiteral'],
		[ast.array([]), 'ArrayLiteral'],
		[ast.identifier('a'), 'Identifier'],
		[ast.add(ast.number(1), ast.number(2)), 'BinaryOp'],
		[ast.negate(ast.number(1)), 'UnaryOp'],
		[ast.functionCall('F'), 'FunctionCall'],
		[ast.assign('a', ast.number(1)), 'Assignment'],
		[ast.ifExpr(ast.boolean(true), ast.number(1), ast.number(2)), 'IfExpression'],
		[ast.forExpr('i', ast.array([]), null, null, ast.number(1)), 'ForExpression'],
		[ast.indexAccess(ast.array([]), ast.number(0)), 'IndexAccess'],
		[ast.rangeExpr(ast.number(1), ast.number(2), false), 'RangeExpression'],
		[ast.pipeExpr(ast.number(1), 'F', [ast.placeholder()]), 'PipeExpression'],
		[ast.placeholder(), 'Placeholder'],
	];
	for (const [node, name] of nodes) {
		expect(ast.getNodeName(node)).toBe(name);
	}
});

describe('Child traversal', () => {
	const nodes: [string, ast.ASTNode, string[]][] = [
		['Program', ast.program([id('a'), id('b')]), ['a', 'b']],
		['ArrayLiteral', ast.array([id('a'), id('b')]), ['a', 'b']],
		['BinaryOp', ast.add(id('a'), id('b')), ['a', 'b']],
		['UnaryOp', ast.negate(id('a')), ['a']],
		['FunctionCall', ast.functionCall('F', [id('a'), id('b')]), ['a', 'b']],
		['Assignment', ast.assign('x', id('a')), ['a']],
		['IfExpression', ast.ifExpr(id('a'), id('b'), id('c')), ['a', 'b', 'c']],
		[
			'ForExpression',
			ast.forExpr('i', id('a'), id('c'), { name: 't', initial: id('b') }, id('d')),
			['a', 'b', 'c', 'd'],
		],
		['ForExpression (bare)', ast.forExpr('i', id('a'), null, null, id('b')), ['a', 'b']],
		['IndexAccess', ast.indexAccess(id('a'), id('b')), ['a', 'b']],
		['RangeExpression', ast.rangeExpr(id('a'), id('b'), false), ['a', 'b']],
		['PipeExpression', ast.pipeExpr(id('a'), 'F', [ast.placeholder(), id('b')]), ['a', '?', 'b']],
		['NumberLiteral', ast.number(1), []],
		['Identifier', id('a'), []],
		['Placeholder', ast.placeholder(), []],
	];

	test.each(nodes)('forEachChild visits %s children in evaluation order', (_, node, expected) => {
		const seen: string[] = [];
		ast.forEachChild(node, (child) => {
			seen.push(child.kind === ast.NodeKind.Identifier ? child.name : '?');
		});
		expect(seen).toEqual(expected);
	});

	test('forEachChild stops at the first truthy result', () => {
		const seen: ast.ASTNode[] = [];
		const result = ast.forEachChild(ast.array([id('a'), id('b'), id('c')]), (child) => {
			seen.push(child);
			return seen.length === 2 ? 'found' : undefined;
		});
		expect(result).toBe('found');
		expect(seen).toHaveLength(2);
	});

	test('forEachChild returns undefined when nothing matches', () => {
		expect(ast.forEachChild(ast.add(id('a'), id('b')), () => false)).toBeUndefined();
		expect(ast.forEachChild(ast.negate(id('a')), () => 0)).toBeUndefined();
	});

	test.each(nodes)('mapChildren returns %s itself when nothing changes', (_, node) => {
		expect(ast.mapChildren(node, (child) => child)).toBe(node);
	});

	test.each(nodes)('mapChildren replaces every child of %s', (_, node, expected) => {
		const mapped = ast.mapChildren(node, (child) =>
			child.kind === ast.NodeKind.Identifier ? id(`${child.name}2`) : child,
		);
		const seen: string[] = [];
		ast.forEachChild(mapped, (child) => {
			seen.push(child.kind === ast.NodeKind.Identifier ? child.name : '?');
		});
		expect(seen).toEqual(expected.map((name) => (name === '?' ? name : `${name}2`)));
		expect(mapped === node).toBe(expected.filter((name) => name !== '?').length === 0);
	});

	test('mapChildren copies only from the first changed element', () => {
		const a = id('a');
		const mapped = ast.mapChildren(ast.array([a, id('b')]), (child) =>
			child === a ? child : id('z'),
		);
		expect((mapped as ast.ArrayLiteral).elements[0]).toBe(a);
	});

	test('mapChildren preserves spans and comments', () => {
		const node = { ...ast.unaryOp('-', id('a'), 3, 5), leadingComments: ['// c'] };
		const mapped = ast.mapChildren(node, () => id('b'));
		expect(mapped.start).toBe(3);
		expect(mapped.end).toBe(5);
		expect(mapped.leadingComments).toEqual(['// c']);
	});
});
