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
 * Returns consequent if condition !== 0, otherwise returns alternate
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

/**
 * Create an addition operation
 */
export function add(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '+', right)
}

/**
 * Create a subtraction operation
 */
export function subtract(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '-', right)
}

/**
 * Create a multiplication operation
 */
export function multiply(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '*', right)
}

/**
 * Create a division operation
 */
export function divide(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '/', right)
}

/**
 * Create a modulo operation
 */
export function modulo(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '%', right)
}

/**
 * Create an exponentiation operation
 */
export function exponentiate(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '^', right)
}

/**
 * Create a negation operation
 */
export function negate(argument: ASTNode): UnaryOp {
	return unaryOp('-', argument)
}

/**
 * Create a logical NOT operation
 */
export function logicalNot(argument: ASTNode): UnaryOp {
	return unaryOp('!', argument)
}

/**
 * Comparison operator convenience functions
 */

/**
 * Create an equality comparison (==)
 */
export function equals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '==', right)
}

/**
 * Create a not-equals comparison (!=)
 */
export function notEquals(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '!=', right)
}

/**
 * Create a less-than comparison (<)
 */
export function lessThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<', right)
}

/**
 * Create a greater-than comparison (>)
 */
export function greaterThan(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>', right)
}

/**
 * Create a less-than-or-equal comparison (<=)
 */
export function lessEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '<=', right)
}

/**
 * Create a greater-than-or-equal comparison (>=)
 */
export function greaterEqual(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '>=', right)
}

/**
 * Logical operator convenience functions
 */

/**
 * Create a logical AND operation (&&)
 */
export function logicalAnd(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '&&', right)
}

/**
 * Create a logical OR operation (||)
 */
export function logicalOr(left: ASTNode, right: ASTNode): BinaryOp {
	return binaryOp(left, '||', right)
}
