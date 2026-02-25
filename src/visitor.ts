import {
	type ArrayLiteral,
	type ASTNode,
	type Assignment,
	type BinaryOp,
	type BooleanLiteral,
	type ConditionalExpression,
	type FunctionCall,
	getNodeName,
	type Identifier,
	NodeKind,
	type NumberLiteral,
	type Program,
	type StringLiteral,
	type UnaryOp,
} from './ast'

/**
 * Type-safe visitor pattern for AST traversal.
 *
 * A visitor is an object with handler functions for each AST node type.
 * Each handler receives:
 * - The node (correctly typed based on node.type)
 * - A recurse function to visit child nodes with the same visitor
 *
 * @template T The return type of visitor handlers
 */
export type Visitor<T> = {
	Program: (node: Program, recurse: (n: ASTNode) => T) => T
	NumberLiteral: (node: NumberLiteral, recurse: (n: ASTNode) => T) => T
	StringLiteral: (node: StringLiteral, recurse: (n: ASTNode) => T) => T
	BooleanLiteral: (node: BooleanLiteral, recurse: (n: ASTNode) => T) => T
	ArrayLiteral: (node: ArrayLiteral, recurse: (n: ASTNode) => T) => T
	Identifier: (node: Identifier, recurse: (n: ASTNode) => T) => T
	BinaryOp: (node: BinaryOp, recurse: (n: ASTNode) => T) => T
	UnaryOp: (node: UnaryOp, recurse: (n: ASTNode) => T) => T
	FunctionCall: (node: FunctionCall, recurse: (n: ASTNode) => T) => T
	Assignment: (node: Assignment, recurse: (n: ASTNode) => T) => T
	ConditionalExpression: (
		node: ConditionalExpression,
		recurse: (n: ASTNode) => T,
	) => T
}

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
		throw new Error(`No handler for node type: ${getNodeName(node)}`)
	})
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
	defaultHandler: (node: ASTNode, recurse: (n: ASTNode) => T) => T,
): T {
	const recurse = (n: ASTNode): T => visitPartial(n, visitor, defaultHandler)

	switch (node.kind) {
		case NodeKind.Program:
			return visitor.Program
				? visitor.Program(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.NumberLiteral:
			return visitor.NumberLiteral
				? visitor.NumberLiteral(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.StringLiteral:
			return visitor.StringLiteral
				? visitor.StringLiteral(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.BooleanLiteral:
			return visitor.BooleanLiteral
				? visitor.BooleanLiteral(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.ArrayLiteral:
			return visitor.ArrayLiteral
				? visitor.ArrayLiteral(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.Identifier:
			return visitor.Identifier
				? visitor.Identifier(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.BinaryOp:
			return visitor.BinaryOp
				? visitor.BinaryOp(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.UnaryOp:
			return visitor.UnaryOp
				? visitor.UnaryOp(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.FunctionCall:
			return visitor.FunctionCall
				? visitor.FunctionCall(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.Assignment:
			return visitor.Assignment
				? visitor.Assignment(node, recurse)
				: defaultHandler(node, recurse)
		case NodeKind.ConditionalExpression:
			return visitor.ConditionalExpression
				? visitor.ConditionalExpression(node, recurse)
				: defaultHandler(node, recurse)
	}
}
