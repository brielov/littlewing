/**
 * Binary operator types
 */
export type Operator =
	| '+'
	| '-'
	| '*'
	| '/'
	| '%'
	| '^'
	| '=='
	| '!='
	| '<'
	| '>'
	| '<='
	| '>='
	| '&&'
	| '||';

/**
 * Base interface for all AST nodes.
 *
 * `start` and `end` are UTF-16 offsets into the source a node was parsed from;
 * they are absent on hand-built nodes. Comment metadata is preserved through
 * parse → generate roundtrips.
 */
export interface ASTNodeBase {
	readonly start?: number | undefined;
	readonly end?: number | undefined;
	readonly leadingComments?: readonly string[];
	readonly trailingComments?: readonly string[];
}

/**
 * AST Node kind discriminator
 */
export enum NodeKind {
	Program,
	NumberLiteral,
	Identifier,
	BinaryOp,
	UnaryOp,
	FunctionCall,
	Assignment,
	IfExpression,
	StringLiteral,
	BooleanLiteral,
	ArrayLiteral,
	ForExpression,
	IndexAccess,
	RangeExpression,
	PipeExpression,
	Placeholder,
}

/**
 * Program node (multiple statements)
 */
export interface Program extends ASTNodeBase {
	readonly kind: NodeKind.Program;
	readonly statements: readonly ASTNode[];
}

/**
 * Number literal (123, 45.67)
 */
export interface NumberLiteral extends ASTNodeBase {
	readonly kind: NodeKind.NumberLiteral;
	readonly value: number;
}

/**
 * String literal ("hello")
 */
export interface StringLiteral extends ASTNodeBase {
	readonly kind: NodeKind.StringLiteral;
	readonly value: string;
}

/**
 * Boolean literal (true, false)
 */
export interface BooleanLiteral extends ASTNodeBase {
	readonly kind: NodeKind.BooleanLiteral;
	readonly value: boolean;
}

/**
 * Array literal ([1, 2, 3])
 */
export interface ArrayLiteral extends ASTNodeBase {
	readonly kind: NodeKind.ArrayLiteral;
	readonly elements: readonly ASTNode[];
}

/**
 * Identifier (variable or function name)
 */
export interface Identifier extends ASTNodeBase {
	readonly kind: NodeKind.Identifier;
	readonly name: string;
}

/**
 * Binary operation (a + b, x * y, etc.)
 */
export interface BinaryOp extends ASTNodeBase {
	readonly kind: NodeKind.BinaryOp;
	readonly left: ASTNode;
	readonly operator: Operator;
	readonly right: ASTNode;
}

/**
 * Unary operation (-x, !x, etc.)
 */
export interface UnaryOp extends ASTNodeBase {
	readonly kind: NodeKind.UnaryOp;
	readonly operator: '-' | '!';
	readonly argument: ASTNode;
}

/**
 * Function call (NOW(), MAX(a, b), etc.)
 */
export interface FunctionCall extends ASTNodeBase {
	readonly kind: NodeKind.FunctionCall;
	readonly name: string;
	readonly args: readonly ASTNode[];
}

/**
 * Variable assignment (x = 5)
 */
export interface Assignment extends ASTNodeBase {
	readonly kind: NodeKind.Assignment;
	readonly name: string;
	readonly value: ASTNode;
}

/**
 * If expression (if condition then consequent else alternate)
 * Returns consequent if condition is true, otherwise returns alternate
 */
export interface IfExpression extends ASTNodeBase {
	readonly kind: NodeKind.IfExpression;
	readonly condition: ASTNode;
	readonly consequent: ASTNode;
	readonly alternate: ASTNode;
}

/**
 * For expression (for variable in iterable [when guard] [into name = init] then body)
 * Without `into`: maps over an array or string, optionally filtering with a guard
 * With `into`: reduces/folds into a single value using an accumulator
 */
export interface ForExpression extends ASTNodeBase {
	readonly kind: NodeKind.ForExpression;
	readonly variable: string;
	readonly iterable: ASTNode;
	readonly guard: ASTNode | null;
	readonly accumulator: { readonly name: string; readonly initial: ASTNode } | null;
	readonly body: ASTNode;
}

/**
 * Index access (arr[0], str[1])
 */
export interface IndexAccess extends ASTNodeBase {
	readonly kind: NodeKind.IndexAccess;
	readonly object: ASTNode;
	readonly index: ASTNode;
}

/**
 * Range expression (1..5, 1..=5)
 */
export interface RangeExpression extends ASTNodeBase {
	readonly kind: NodeKind.RangeExpression;
	readonly from: ASTNode;
	readonly to: ASTNode;
	readonly inclusive: boolean;
}

/**
 * Pipe expression (value |> FUN(?, arg))
 * Chains a value through a function call where ? marks the insertion point
 */
export interface PipeExpression extends ASTNodeBase {
	readonly kind: NodeKind.PipeExpression;
	readonly value: ASTNode;
	readonly name: string;
	readonly args: readonly ASTNode[];
}

/**
 * Placeholder (?) used inside pipe expression arguments
 */
export interface Placeholder extends ASTNodeBase {
	readonly kind: NodeKind.Placeholder;
}

/**
 * AST Node - discriminated union of all node types
 */
export type ASTNode =
	| Program
	| NumberLiteral
	| StringLiteral
	| BooleanLiteral
	| ArrayLiteral
	| Identifier
	| BinaryOp
	| UnaryOp
	| FunctionCall
	| Assignment
	| IfExpression
	| ForExpression
	| IndexAccess
	| RangeExpression
	| PipeExpression
	| Placeholder;

export interface Visitor<T> {
	Program: (node: Program, recurse: (child: ASTNode) => T) => T;
	NumberLiteral: (node: NumberLiteral, recurse: (child: ASTNode) => T) => T;
	StringLiteral: (node: StringLiteral, recurse: (child: ASTNode) => T) => T;
	BooleanLiteral: (node: BooleanLiteral, recurse: (child: ASTNode) => T) => T;
	ArrayLiteral: (node: ArrayLiteral, recurse: (child: ASTNode) => T) => T;
	Identifier: (node: Identifier, recurse: (child: ASTNode) => T) => T;
	BinaryOp: (node: BinaryOp, recurse: (child: ASTNode) => T) => T;
	UnaryOp: (node: UnaryOp, recurse: (child: ASTNode) => T) => T;
	FunctionCall: (node: FunctionCall, recurse: (child: ASTNode) => T) => T;
	Assignment: (node: Assignment, recurse: (child: ASTNode) => T) => T;
	IfExpression: (node: IfExpression, recurse: (child: ASTNode) => T) => T;
	ForExpression: (node: ForExpression, recurse: (child: ASTNode) => T) => T;
	IndexAccess: (node: IndexAccess, recurse: (child: ASTNode) => T) => T;
	RangeExpression: (node: RangeExpression, recurse: (child: ASTNode) => T) => T;
	PipeExpression: (node: PipeExpression, recurse: (child: ASTNode) => T) => T;
	Placeholder: (node: Placeholder, recurse: (child: ASTNode) => T) => T;
}

export function visit<T>(node: ASTNode, visitor: Visitor<T>): T {
	const recurse = (child: ASTNode): T => visit(child, visitor);

	switch (node.kind) {
		case NodeKind.Program:
			return visitor.Program(node, recurse);
		case NodeKind.NumberLiteral:
			return visitor.NumberLiteral(node, recurse);
		case NodeKind.StringLiteral:
			return visitor.StringLiteral(node, recurse);
		case NodeKind.BooleanLiteral:
			return visitor.BooleanLiteral(node, recurse);
		case NodeKind.ArrayLiteral:
			return visitor.ArrayLiteral(node, recurse);
		case NodeKind.Identifier:
			return visitor.Identifier(node, recurse);
		case NodeKind.BinaryOp:
			return visitor.BinaryOp(node, recurse);
		case NodeKind.UnaryOp:
			return visitor.UnaryOp(node, recurse);
		case NodeKind.FunctionCall:
			return visitor.FunctionCall(node, recurse);
		case NodeKind.Assignment:
			return visitor.Assignment(node, recurse);
		case NodeKind.IfExpression:
			return visitor.IfExpression(node, recurse);
		case NodeKind.ForExpression:
			return visitor.ForExpression(node, recurse);
		case NodeKind.IndexAccess:
			return visitor.IndexAccess(node, recurse);
		case NodeKind.RangeExpression:
			return visitor.RangeExpression(node, recurse);
		case NodeKind.PipeExpression:
			return visitor.PipeExpression(node, recurse);
		case NodeKind.Placeholder:
			return visitor.Placeholder(node, recurse);
	}
}

/**
 * Type guard functions for discriminated union narrowing
 */
export function isProgram(node: ASTNode): node is Program {
	return node.kind === NodeKind.Program;
}

export function isNumberLiteral(node: ASTNode): node is NumberLiteral {
	return node.kind === NodeKind.NumberLiteral;
}

export function isStringLiteral(node: ASTNode): node is StringLiteral {
	return node.kind === NodeKind.StringLiteral;
}

export function isBooleanLiteral(node: ASTNode): node is BooleanLiteral {
	return node.kind === NodeKind.BooleanLiteral;
}

export function isArrayLiteral(node: ASTNode): node is ArrayLiteral {
	return node.kind === NodeKind.ArrayLiteral;
}

export function isIdentifier(node: ASTNode): node is Identifier {
	return node.kind === NodeKind.Identifier;
}

export function isBinaryOp(node: ASTNode): node is BinaryOp {
	return node.kind === NodeKind.BinaryOp;
}

export function isUnaryOp(node: ASTNode): node is UnaryOp {
	return node.kind === NodeKind.UnaryOp;
}

export function isFunctionCall(node: ASTNode): node is FunctionCall {
	return node.kind === NodeKind.FunctionCall;
}

export function isAssignment(node: ASTNode): node is Assignment {
	return node.kind === NodeKind.Assignment;
}

export function isIfExpression(node: ASTNode): node is IfExpression {
	return node.kind === NodeKind.IfExpression;
}

export function isForExpression(node: ASTNode): node is ForExpression {
	return node.kind === NodeKind.ForExpression;
}

export function isIndexAccess(node: ASTNode): node is IndexAccess {
	return node.kind === NodeKind.IndexAccess;
}

export function isRangeExpression(node: ASTNode): node is RangeExpression {
	return node.kind === NodeKind.RangeExpression;
}

export function isPipeExpression(node: ASTNode): node is PipeExpression {
	return node.kind === NodeKind.PipeExpression;
}

export function isPlaceholder(node: ASTNode): node is Placeholder {
	return node.kind === NodeKind.Placeholder;
}

/**
 * Call `fn` on each node, stopping at (and returning) the first truthy result.
 */
function forEachNode<T>(nodes: readonly ASTNode[], fn: (child: ASTNode) => T): T | undefined {
	for (const child of nodes) {
		const result = fn(child);
		if (result) return result;
	}
	return undefined;
}

/**
 * Call `fn` on each direct child of `node`, in evaluation order, stopping at
 * (and returning) the first truthy result.
 */
export function forEachChild<T>(node: ASTNode, fn: (child: ASTNode) => T): T | undefined {
	switch (node.kind) {
		case NodeKind.Program:
			return forEachNode(node.statements, fn);
		case NodeKind.ArrayLiteral:
			return forEachNode(node.elements, fn);
		case NodeKind.BinaryOp:
			return fn(node.left) || fn(node.right) || undefined;
		case NodeKind.UnaryOp:
			return fn(node.argument) || undefined;
		case NodeKind.FunctionCall:
			return forEachNode(node.args, fn);
		case NodeKind.Assignment:
			return fn(node.value) || undefined;
		case NodeKind.IfExpression:
			return fn(node.condition) || fn(node.consequent) || fn(node.alternate) || undefined;
		case NodeKind.ForExpression:
			return (
				fn(node.iterable) ||
				(node.accumulator && fn(node.accumulator.initial)) ||
				(node.guard && fn(node.guard)) ||
				fn(node.body) ||
				undefined
			);
		case NodeKind.IndexAccess:
			return fn(node.object) || fn(node.index) || undefined;
		case NodeKind.RangeExpression:
			return fn(node.from) || fn(node.to) || undefined;
		case NodeKind.PipeExpression:
			return fn(node.value) || forEachNode(node.args, fn);
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Identifier:
		case NodeKind.Placeholder:
			return undefined;
	}
}

/**
 * Map `fn` over `nodes`, returning the original array when nothing changed.
 */
function mapNodes(nodes: readonly ASTNode[], fn: (child: ASTNode) => ASTNode): readonly ASTNode[] {
	let mapped: ASTNode[] | undefined;
	for (let i = 0; i < nodes.length; i++) {
		const child = nodes[i] as ASTNode;
		const replacement = fn(child);
		if (mapped) {
			mapped.push(replacement);
		} else if (replacement !== child) {
			mapped = nodes.slice(0, i);
			mapped.push(replacement);
		}
	}
	return mapped ?? nodes;
}

/**
 * Give a rebuilt node the comments of the one it replaces, which few nodes have.
 * The builders keep every node of a kind in one shape, unlike spreading.
 */
function withComments<T extends ASTNode>(original: ASTNode, rebuilt: T): T {
	const { leadingComments, trailingComments } = original;
	if (!leadingComments && !trailingComments) return rebuilt;
	return {
		...rebuilt,
		...(leadingComments ? { leadingComments } : {}),
		...(trailingComments ? { trailingComments } : {}),
	};
}

/**
 * Rebuild `node` with `fn` applied to each direct child, in evaluation order.
 * Returns `node` itself when no child changed. Spans and comments are preserved.
 */
export function mapChildren(node: ASTNode, fn: (child: ASTNode) => ASTNode): ASTNode {
	const { start, end } = node;
	switch (node.kind) {
		case NodeKind.Program: {
			const statements = mapNodes(node.statements, fn);
			return statements === node.statements
				? node
				: withComments(node, program(statements, start, end));
		}
		case NodeKind.ArrayLiteral: {
			const elements = mapNodes(node.elements, fn);
			return elements === node.elements ? node : withComments(node, array(elements, start, end));
		}
		case NodeKind.BinaryOp: {
			const left = fn(node.left);
			const right = fn(node.right);
			return left === node.left && right === node.right
				? node
				: withComments(node, binaryOp(left, node.operator, right, start, end));
		}
		case NodeKind.UnaryOp: {
			const argument = fn(node.argument);
			return argument === node.argument
				? node
				: withComments(node, unaryOp(node.operator, argument, start, end));
		}
		case NodeKind.FunctionCall: {
			const args = mapNodes(node.args, fn);
			return args === node.args
				? node
				: withComments(node, functionCall(node.name, args, start, end));
		}
		case NodeKind.Assignment: {
			const value = fn(node.value);
			return value === node.value ? node : withComments(node, assign(node.name, value, start, end));
		}
		case NodeKind.IfExpression: {
			const condition = fn(node.condition);
			const consequent = fn(node.consequent);
			const alternate = fn(node.alternate);
			return condition === node.condition &&
				consequent === node.consequent &&
				alternate === node.alternate
				? node
				: withComments(node, ifExpr(condition, consequent, alternate, start, end));
		}
		case NodeKind.ForExpression: {
			const iterable = fn(node.iterable);
			const initial = node.accumulator && fn(node.accumulator.initial);
			const guard = node.guard && fn(node.guard);
			const body = fn(node.body);
			if (
				iterable === node.iterable &&
				initial === (node.accumulator && node.accumulator.initial) &&
				guard === node.guard &&
				body === node.body
			) {
				return node;
			}
			const accumulator =
				node.accumulator && initial ? { name: node.accumulator.name, initial } : null;
			return withComments(
				node,
				forExpr(node.variable, iterable, guard, accumulator, body, start, end),
			);
		}
		case NodeKind.IndexAccess: {
			const object = fn(node.object);
			const index = fn(node.index);
			return object === node.object && index === node.index
				? node
				: withComments(node, indexAccess(object, index, start, end));
		}
		case NodeKind.RangeExpression: {
			const from = fn(node.from);
			const to = fn(node.to);
			return from === node.from && to === node.to
				? node
				: withComments(node, rangeExpr(from, to, node.inclusive, start, end));
		}
		case NodeKind.PipeExpression: {
			const value = fn(node.value);
			const args = mapNodes(node.args, fn);
			return value === node.value && args === node.args
				? node
				: withComments(node, pipeExpr(value, node.name, args, start, end));
		}
		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral:
		case NodeKind.Identifier:
		case NodeKind.Placeholder:
			return node;
	}
}

/**
 * Builder functions for creating AST nodes manually.
 *
 * Every builder takes optional trailing `start` and `end` source offsets, which
 * the parser supplies so that all nodes of a kind share one object shape.
 */

export function program(statements: readonly ASTNode[], start?: number, end?: number): Program {
	return { kind: NodeKind.Program, statements, start, end };
}

export function number(value: number, start?: number, end?: number): NumberLiteral {
	return { kind: NodeKind.NumberLiteral, value, start, end };
}

export function string(value: string, start?: number, end?: number): StringLiteral {
	return { kind: NodeKind.StringLiteral, value, start, end };
}

export function boolean(value: boolean, start?: number, end?: number): BooleanLiteral {
	return { kind: NodeKind.BooleanLiteral, value, start, end };
}

export function array(elements: readonly ASTNode[], start?: number, end?: number): ArrayLiteral {
	return { kind: NodeKind.ArrayLiteral, elements, start, end };
}

export function identifier(name: string, start?: number, end?: number): Identifier {
	return { kind: NodeKind.Identifier, name, start, end };
}

export function binaryOp(
	left: ASTNode,
	operator: Operator,
	right: ASTNode,
	start?: number,
	end?: number,
): BinaryOp {
	return { kind: NodeKind.BinaryOp, left, operator, right, start, end };
}

/**
 * Create a unary operation node (unary minus or logical NOT)
 */
export function unaryOp(
	operator: '-' | '!',
	argument: ASTNode,
	start?: number,
	end?: number,
): UnaryOp {
	return { kind: NodeKind.UnaryOp, operator, argument, start, end };
}

export function functionCall(
	name: string,
	args: readonly ASTNode[] = [],
	start?: number,
	end?: number,
): FunctionCall {
	return { kind: NodeKind.FunctionCall, name, args, start, end };
}

export function assign(name: string, value: ASTNode, start?: number, end?: number): Assignment {
	return { kind: NodeKind.Assignment, name, value, start, end };
}

/**
 * Create an if expression node (if condition then consequent else alternate)
 */
export function ifExpr(
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
	start?: number,
	end?: number,
): IfExpression {
	return { kind: NodeKind.IfExpression, condition, consequent, alternate, start, end };
}

/**
 * Create a for expression node (for variable in iterable [when guard] [into name = init] then body)
 */
export function forExpr(
	variable: string,
	iterable: ASTNode,
	guard: ASTNode | null,
	accumulator: { readonly name: string; readonly initial: ASTNode } | null,
	body: ASTNode,
	start?: number,
	end?: number,
): ForExpression {
	return { kind: NodeKind.ForExpression, variable, iterable, guard, accumulator, body, start, end };
}

/**
 * Create an index access node (arr[0], str[1])
 */
export function indexAccess(
	object: ASTNode,
	index: ASTNode,
	start?: number,
	end?: number,
): IndexAccess {
	return { kind: NodeKind.IndexAccess, object, index, start, end };
}

/**
 * Create a range expression node (1..5, 1..=5)
 */
export function rangeExpr(
	from: ASTNode,
	to: ASTNode,
	inclusive: boolean,
	start?: number,
	end?: number,
): RangeExpression {
	return { kind: NodeKind.RangeExpression, from, to, inclusive, start, end };
}

/**
 * Create a pipe expression node (value |> FUN(?, arg))
 */
export function pipeExpr(
	value: ASTNode,
	name: string,
	args: readonly ASTNode[],
	start?: number,
	end?: number,
): PipeExpression {
	return { kind: NodeKind.PipeExpression, value, name, args, start, end };
}

/**
 * Create a placeholder node (?) for use in pipe expression arguments
 */
export function placeholder(start?: number, end?: number): Placeholder {
	return { kind: NodeKind.Placeholder, start, end };
}

/**
 * Convenience functions for common operations
 */

export function add(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '+', right);
}

export function subtract(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '-', right);
}

export function multiply(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '*', right);
}

export function divide(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '/', right);
}

export function modulo(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '%', right);
}

export function exponentiate(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '^', right);
}

export function negate(argument: ASTNode): UnaryOp {
	return unaryOp('-', argument);
}

export function logicalNot(argument: ASTNode): UnaryOp {
	return unaryOp('!', argument);
}

export function equals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '==', right);
}

export function notEquals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '!=', right);
}

export function lessThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<', right);
}

export function greaterThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>', right);
}

export function lessEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<=', right);
}

export function greaterEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>=', right);
}

export function logicalAnd(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '&&', right);
}

export function logicalOr(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '||', right);
}

export function getNodeName(node: ASTNode): string {
	return NodeKind[node.kind];
}
