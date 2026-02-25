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
	| '||'

/**
 * AST Node kind discriminator (const enum for zero-cost abstraction)
 */
export const enum NodeKind {
	Program,
	NumberLiteral,
	Identifier,
	BinaryOp,
	UnaryOp,
	FunctionCall,
	Assignment,
	ConditionalExpression,
	StringLiteral,
	BooleanLiteral,
	ArrayLiteral,
}

/**
 * Program node (multiple statements)
 * Tuple: [kind, statements]
 */
export type Program = readonly [
	kind: NodeKind.Program,
	statements: readonly ASTNode[],
]

/**
 * Number literal (123, 45.67)
 * Tuple: [kind, value]
 */
export type NumberLiteral = readonly [
	kind: NodeKind.NumberLiteral,
	value: number,
]

/**
 * String literal ("hello")
 * Tuple: [kind, value]
 */
export type StringLiteral = readonly [
	kind: NodeKind.StringLiteral,
	value: string,
]

/**
 * Boolean literal (true, false)
 * Tuple: [kind, value]
 */
export type BooleanLiteral = readonly [
	kind: NodeKind.BooleanLiteral,
	value: boolean,
]

/**
 * Array literal ([1, 2, 3])
 * Tuple: [kind, elements]
 */
export type ArrayLiteral = readonly [
	kind: NodeKind.ArrayLiteral,
	elements: readonly ASTNode[],
]

/**
 * Identifier (variable or function name)
 * Tuple: [kind, name]
 */
export type Identifier = readonly [kind: NodeKind.Identifier, name: string]

/**
 * Binary operation (a + b, x * y, etc.)
 * Tuple: [kind, left, operator, right]
 * Note: left-to-right reading order
 */
export type BinaryOp = readonly [
	kind: NodeKind.BinaryOp,
	left: ASTNode,
	operator: Operator,
	right: ASTNode,
]

/**
 * Unary operation (-x, !x, etc.)
 * Tuple: [kind, operator, argument]
 */
export type UnaryOp = readonly [
	kind: NodeKind.UnaryOp,
	operator: '-' | '!',
	argument: ASTNode,
]

/**
 * Function call (NOW(), MAX(a, b), etc.)
 * Tuple: [kind, name, arguments]
 */
export type FunctionCall = readonly [
	kind: NodeKind.FunctionCall,
	name: string,
	arguments: readonly ASTNode[],
]

/**
 * Variable assignment (x = 5)
 * Tuple: [kind, name, value]
 */
export type Assignment = readonly [
	kind: NodeKind.Assignment,
	name: string,
	value: ASTNode,
]

/**
 * Conditional expression (ternary operator: condition ? consequent : alternate)
 * Returns consequent if condition is true, otherwise returns alternate
 * Tuple: [kind, condition, consequent, alternate]
 */
export type ConditionalExpression = readonly [
	kind: NodeKind.ConditionalExpression,
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
]

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
	| ConditionalExpression

/**
 * Type guard functions for discriminated union narrowing
 */
export function isProgram(node: ASTNode): node is Program {
	return node[0] === NodeKind.Program
}

export function isNumberLiteral(node: ASTNode): node is NumberLiteral {
	return node[0] === NodeKind.NumberLiteral
}

export function isStringLiteral(node: ASTNode): node is StringLiteral {
	return node[0] === NodeKind.StringLiteral
}

export function isBooleanLiteral(node: ASTNode): node is BooleanLiteral {
	return node[0] === NodeKind.BooleanLiteral
}

export function isArrayLiteral(node: ASTNode): node is ArrayLiteral {
	return node[0] === NodeKind.ArrayLiteral
}

export function isIdentifier(node: ASTNode): node is Identifier {
	return node[0] === NodeKind.Identifier
}

export function isBinaryOp(node: ASTNode): node is BinaryOp {
	return node[0] === NodeKind.BinaryOp
}

export function isUnaryOp(node: ASTNode): node is UnaryOp {
	return node[0] === NodeKind.UnaryOp
}

export function isFunctionCall(node: ASTNode): node is FunctionCall {
	return node[0] === NodeKind.FunctionCall
}

export function isAssignment(node: ASTNode): node is Assignment {
	return node[0] === NodeKind.Assignment
}

export function isConditionalExpression(
	node: ASTNode,
): node is ConditionalExpression {
	return node[0] === NodeKind.ConditionalExpression
}

/**
 * Builder functions for creating AST nodes manually
 */

/**
 * Create a program node
 */
export function program(statements: readonly ASTNode[]): Program {
	return [NodeKind.Program, statements]
}

/**
 * Create a number literal node
 */
export function number(value: number): NumberLiteral {
	return [NodeKind.NumberLiteral, value]
}

/**
 * Create a string literal node
 */
export function string(value: string): StringLiteral {
	return [NodeKind.StringLiteral, value]
}

/**
 * Create a boolean literal node
 */
export function boolean(value: boolean): BooleanLiteral {
	return [NodeKind.BooleanLiteral, value]
}

/**
 * Create an array literal node
 */
export function array(elements: readonly ASTNode[]): ArrayLiteral {
	return [NodeKind.ArrayLiteral, elements]
}

/**
 * Create an identifier node
 */
export function identifier(name: string): Identifier {
	return [NodeKind.Identifier, name]
}

/**
 * Create a binary operation node
 */
export function binaryOp(
	left: ASTNode,
	operator: Operator,
	right: ASTNode,
): BinaryOp {
	return [NodeKind.BinaryOp, left, operator, right]
}

/**
 * Create a unary operation node (unary minus or logical NOT)
 */
export function unaryOp(operator: '-' | '!', argument: ASTNode): UnaryOp {
	return [NodeKind.UnaryOp, operator, argument]
}

/**
 * Create a function call node
 */
export function functionCall(
	name: string,
	args: readonly ASTNode[] = [],
): FunctionCall {
	return [NodeKind.FunctionCall, name, args]
}

/**
 * Create a variable assignment node
 */
export function assign(name: string, value: ASTNode): Assignment {
	return [NodeKind.Assignment, name, value]
}

/**
 * Create a conditional expression node (ternary operator)
 */
export function conditional(
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
): ConditionalExpression {
	return [NodeKind.ConditionalExpression, condition, consequent, alternate]
}

/**
 * Convenience functions for common operations
 */

export function add(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '+', right)
}

export function subtract(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '-', right)
}

export function multiply(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '*', right)
}

export function divide(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '/', right)
}

export function modulo(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '%', right)
}

export function exponentiate(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '^', right)
}

export function negate(argument: ASTNode): UnaryOp {
	return unaryOp('-', argument)
}

export function logicalNot(argument: ASTNode): UnaryOp {
	return unaryOp('!', argument)
}

export function equals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '==', right)
}

export function notEquals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '!=', right)
}

export function lessThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<', right)
}

export function greaterThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>', right)
}

export function lessEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<=', right)
}

export function greaterEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>=', right)
}

export function logicalAnd(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '&&', right)
}

export function logicalOr(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '||', right)
}

export function getNodeName(node: ASTNode): string {
	switch (node[0]) {
		case NodeKind.Assignment:
			return 'Assignment'
		case NodeKind.BinaryOp:
			return 'BinaryOp'
		case NodeKind.ConditionalExpression:
			return 'ConditionalExpression'
		case NodeKind.FunctionCall:
			return 'FunctionCall'
		case NodeKind.Identifier:
			return 'Identifier'
		case NodeKind.NumberLiteral:
			return 'NumberLiteral'
		case NodeKind.StringLiteral:
			return 'StringLiteral'
		case NodeKind.BooleanLiteral:
			return 'BooleanLiteral'
		case NodeKind.ArrayLiteral:
			return 'ArrayLiteral'
		case NodeKind.Program:
			return 'Program'
		case NodeKind.UnaryOp:
			return 'UnaryOp'
		default:
			throw new Error(`Unknown node kind: ${(node as ASTNode)[0]}`)
	}
}
