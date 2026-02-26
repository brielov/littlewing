import {
	type ArrayLiteral,
	type ASTNode,
	type Assignment,
	type BinaryOp,
	type BooleanLiteral,
	type ForExpression,
	type FunctionCall,
	getNodeName,
	type Identifier,
	type IfExpression,
	type IndexAccess,
	NodeKind,
	type NumberLiteral,
	type PipeExpression,
	type Placeholder,
	type Program,
	type RangeExpression,
	type StringLiteral,
	type UnaryOp,
} from "./ast";

/**
 * A single visitor handler: receives a narrowed node and a recurse function.
 *
 * @template N The specific AST node type this handler accepts
 * @template T The return type shared across all handlers
 */
export type VisitorHandler<N, T> = (node: N, recurse: (n: ASTNode) => T) => T;

/**
 * Type-safe visitor pattern for AST traversal.
 *
 * A visitor is an object with one handler per AST node type.
 * Each handler receives the narrowed node and a `recurse` function
 * for visiting child nodes with the same visitor.
 *
 * @template T The return type of visitor handlers
 */
export type Visitor<T> = {
	Program: VisitorHandler<Program, T>;
	NumberLiteral: VisitorHandler<NumberLiteral, T>;
	StringLiteral: VisitorHandler<StringLiteral, T>;
	BooleanLiteral: VisitorHandler<BooleanLiteral, T>;
	ArrayLiteral: VisitorHandler<ArrayLiteral, T>;
	Identifier: VisitorHandler<Identifier, T>;
	BinaryOp: VisitorHandler<BinaryOp, T>;
	UnaryOp: VisitorHandler<UnaryOp, T>;
	FunctionCall: VisitorHandler<FunctionCall, T>;
	Assignment: VisitorHandler<Assignment, T>;
	IfExpression: VisitorHandler<IfExpression, T>;
	ForExpression: VisitorHandler<ForExpression, T>;
	IndexAccess: VisitorHandler<IndexAccess, T>;
	RangeExpression: VisitorHandler<RangeExpression, T>;
	PipeExpression: VisitorHandler<PipeExpression, T>;
	Placeholder: VisitorHandler<Placeholder, T>;
};

/**
 * Visit an AST node using a visitor object with type-specific handlers.
 * All node types must have handlers (exhaustive by design).
 *
 * @template T The return type of visitor handlers
 * @param node The AST node to visit
 * @param visitor Object with handlers for each node type
 * @returns The result of visiting the node
 */
export function visit<T>(node: ASTNode, visitor: Visitor<T>): T {
	return visitPartial(node, visitor, (node) => {
		throw new Error(`No handler for node type: ${getNodeName(node)}`);
	});
}

/**
 * Visit an AST node using a partial visitor with a default handler.
 *
 * Unlike `visit()` which requires exhaustive handlers, `visitPartial()` allows
 * you to handle only specific node types. Unhandled nodes are processed by
 * the default handler.
 *
 * @template T The return type of visitor handlers
 * @param node The AST node to visit
 * @param visitor Object with optional handlers for node types
 * @param defaultHandler Handler for unhandled node types
 * @returns The result of visiting the node
 */
export function visitPartial<T>(
	node: ASTNode,
	visitor: Partial<Visitor<T>>,
	defaultHandler: VisitorHandler<ASTNode, T>,
): T {
	const recurse = (n: ASTNode): T => visitPartial(n, visitor, defaultHandler);

	switch (node.kind) {
		case NodeKind.Program:
			return visitor.Program ? visitor.Program(node, recurse) : defaultHandler(node, recurse);
		case NodeKind.NumberLiteral:
			return visitor.NumberLiteral
				? visitor.NumberLiteral(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.StringLiteral:
			return visitor.StringLiteral
				? visitor.StringLiteral(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.BooleanLiteral:
			return visitor.BooleanLiteral
				? visitor.BooleanLiteral(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.ArrayLiteral:
			return visitor.ArrayLiteral
				? visitor.ArrayLiteral(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.Identifier:
			return visitor.Identifier ? visitor.Identifier(node, recurse) : defaultHandler(node, recurse);
		case NodeKind.BinaryOp:
			return visitor.BinaryOp ? visitor.BinaryOp(node, recurse) : defaultHandler(node, recurse);
		case NodeKind.UnaryOp:
			return visitor.UnaryOp ? visitor.UnaryOp(node, recurse) : defaultHandler(node, recurse);
		case NodeKind.FunctionCall:
			return visitor.FunctionCall
				? visitor.FunctionCall(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.Assignment:
			return visitor.Assignment ? visitor.Assignment(node, recurse) : defaultHandler(node, recurse);
		case NodeKind.IfExpression:
			return visitor.IfExpression
				? visitor.IfExpression(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.ForExpression:
			return visitor.ForExpression
				? visitor.ForExpression(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.IndexAccess:
			return visitor.IndexAccess
				? visitor.IndexAccess(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.RangeExpression:
			return visitor.RangeExpression
				? visitor.RangeExpression(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.PipeExpression:
			return visitor.PipeExpression
				? visitor.PipeExpression(node, recurse)
				: defaultHandler(node, recurse);
		case NodeKind.Placeholder:
			return visitor.Placeholder
				? visitor.Placeholder(node, recurse)
				: defaultHandler(node, recurse);
	}
}
