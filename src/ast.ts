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
	IfExpression,
	StringLiteral,
	BooleanLiteral,
	ArrayLiteral,
	ForExpression,
	IndexAccess,
	RangeExpression,
}

/**
 * Program node (multiple statements)
 */
export interface Program {
	readonly kind: NodeKind.Program
	readonly statements: readonly ASTNode[]
}

/**
 * Number literal (123, 45.67)
 */
export interface NumberLiteral {
	readonly kind: NodeKind.NumberLiteral
	readonly value: number
}

/**
 * String literal ("hello")
 */
export interface StringLiteral {
	readonly kind: NodeKind.StringLiteral
	readonly value: string
}

/**
 * Boolean literal (true, false)
 */
export interface BooleanLiteral {
	readonly kind: NodeKind.BooleanLiteral
	readonly value: boolean
}

/**
 * Array literal ([1, 2, 3])
 */
export interface ArrayLiteral {
	readonly kind: NodeKind.ArrayLiteral
	readonly elements: readonly ASTNode[]
}

/**
 * Identifier (variable or function name)
 */
export interface Identifier {
	readonly kind: NodeKind.Identifier
	readonly name: string
}

/**
 * Binary operation (a + b, x * y, etc.)
 */
export interface BinaryOp {
	readonly kind: NodeKind.BinaryOp
	readonly left: ASTNode
	readonly operator: Operator
	readonly right: ASTNode
}

/**
 * Unary operation (-x, !x, etc.)
 */
export interface UnaryOp {
	readonly kind: NodeKind.UnaryOp
	readonly operator: '-' | '!'
	readonly argument: ASTNode
}

/**
 * Function call (NOW(), MAX(a, b), etc.)
 */
export interface FunctionCall {
	readonly kind: NodeKind.FunctionCall
	readonly name: string
	readonly args: readonly ASTNode[]
}

/**
 * Variable assignment (x = 5)
 */
export interface Assignment {
	readonly kind: NodeKind.Assignment
	readonly name: string
	readonly value: ASTNode
}

/**
 * If expression (if condition then consequent else alternate)
 * Returns consequent if condition is true, otherwise returns alternate
 */
export interface IfExpression {
	readonly kind: NodeKind.IfExpression
	readonly condition: ASTNode
	readonly consequent: ASTNode
	readonly alternate: ASTNode
}

/**
 * For expression (for variable in iterable [when guard] then body)
 * Maps over an array or string, optionally filtering with a guard
 */
export interface ForExpression {
	readonly kind: NodeKind.ForExpression
	readonly variable: string
	readonly iterable: ASTNode
	readonly guard: ASTNode | null
	readonly body: ASTNode
}

/**
 * Index access (arr[0], str[1])
 */
export interface IndexAccess {
	readonly kind: NodeKind.IndexAccess
	readonly object: ASTNode
	readonly index: ASTNode
}

/**
 * Range expression (1..5, 1..=5)
 */
export interface RangeExpression {
	readonly kind: NodeKind.RangeExpression
	readonly start: ASTNode
	readonly end: ASTNode
	readonly inclusive: boolean
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

/**
 * Type guard functions for discriminated union narrowing
 */
export function isProgram(node: ASTNode): node is Program {
	return node.kind === NodeKind.Program
}

export function isNumberLiteral(node: ASTNode): node is NumberLiteral {
	return node.kind === NodeKind.NumberLiteral
}

export function isStringLiteral(node: ASTNode): node is StringLiteral {
	return node.kind === NodeKind.StringLiteral
}

export function isBooleanLiteral(node: ASTNode): node is BooleanLiteral {
	return node.kind === NodeKind.BooleanLiteral
}

export function isArrayLiteral(node: ASTNode): node is ArrayLiteral {
	return node.kind === NodeKind.ArrayLiteral
}

export function isIdentifier(node: ASTNode): node is Identifier {
	return node.kind === NodeKind.Identifier
}

export function isBinaryOp(node: ASTNode): node is BinaryOp {
	return node.kind === NodeKind.BinaryOp
}

export function isUnaryOp(node: ASTNode): node is UnaryOp {
	return node.kind === NodeKind.UnaryOp
}

export function isFunctionCall(node: ASTNode): node is FunctionCall {
	return node.kind === NodeKind.FunctionCall
}

export function isAssignment(node: ASTNode): node is Assignment {
	return node.kind === NodeKind.Assignment
}

export function isIfExpression(node: ASTNode): node is IfExpression {
	return node.kind === NodeKind.IfExpression
}

export function isForExpression(node: ASTNode): node is ForExpression {
	return node.kind === NodeKind.ForExpression
}

export function isIndexAccess(node: ASTNode): node is IndexAccess {
	return node.kind === NodeKind.IndexAccess
}

export function isRangeExpression(node: ASTNode): node is RangeExpression {
	return node.kind === NodeKind.RangeExpression
}

/**
 * Builder functions for creating AST nodes manually
 */

/**
 * Create a program node
 */
export function program(statements: readonly ASTNode[]): Program {
	return { kind: NodeKind.Program, statements }
}

/**
 * Create a number literal node
 */
export function number(value: number): NumberLiteral {
	return { kind: NodeKind.NumberLiteral, value }
}

/**
 * Create a string literal node
 */
export function string(value: string): StringLiteral {
	return { kind: NodeKind.StringLiteral, value }
}

/**
 * Create a boolean literal node
 */
export function boolean(value: boolean): BooleanLiteral {
	return { kind: NodeKind.BooleanLiteral, value }
}

/**
 * Create an array literal node
 */
export function array(elements: readonly ASTNode[]): ArrayLiteral {
	return { kind: NodeKind.ArrayLiteral, elements }
}

/**
 * Create an identifier node
 */
export function identifier(name: string): Identifier {
	return { kind: NodeKind.Identifier, name }
}

/**
 * Create a binary operation node
 */
export function binaryOp(
	left: ASTNode,
	operator: Operator,
	right: ASTNode,
): BinaryOp {
	return { kind: NodeKind.BinaryOp, left, operator, right }
}

/**
 * Create a unary operation node (unary minus or logical NOT)
 */
export function unaryOp(operator: '-' | '!', argument: ASTNode): UnaryOp {
	return { kind: NodeKind.UnaryOp, operator, argument }
}

/**
 * Create a function call node
 */
export function functionCall(
	name: string,
	args: readonly ASTNode[] = [],
): FunctionCall {
	return { kind: NodeKind.FunctionCall, name, args }
}

/**
 * Create a variable assignment node
 */
export function assign(name: string, value: ASTNode): Assignment {
	return { kind: NodeKind.Assignment, name, value }
}

/**
 * Create an if expression node (if condition then consequent else alternate)
 */
export function ifExpr(
	condition: ASTNode,
	consequent: ASTNode,
	alternate: ASTNode,
): IfExpression {
	return {
		kind: NodeKind.IfExpression,
		condition,
		consequent,
		alternate,
	}
}

/**
 * Create a for expression node (for variable in iterable [when guard] then body)
 */
export function forExpr(
	variable: string,
	iterable: ASTNode,
	guard: ASTNode | null,
	body: ASTNode,
): ForExpression {
	return {
		kind: NodeKind.ForExpression,
		variable,
		iterable,
		guard,
		body,
	}
}

/**
 * Create an index access node (arr[0], str[1])
 */
export function indexAccess(object: ASTNode, index: ASTNode): IndexAccess {
	return { kind: NodeKind.IndexAccess, object, index }
}

/**
 * Create a range expression node (1..5, 1..=5)
 */
export function rangeExpr(
	start: ASTNode,
	end: ASTNode,
	inclusive: boolean,
): RangeExpression {
	return { kind: NodeKind.RangeExpression, start, end, inclusive }
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
	switch (node.kind) {
		case NodeKind.Assignment:
			return 'Assignment'
		case NodeKind.BinaryOp:
			return 'BinaryOp'
		case NodeKind.IfExpression:
			return 'IfExpression'
		case NodeKind.ForExpression:
			return 'ForExpression'
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
		case NodeKind.IndexAccess:
			return 'IndexAccess'
		case NodeKind.RangeExpression:
			return 'RangeExpression'
		default:
			throw new Error(`Unknown node kind: ${(node as ASTNode).kind}`)
	}
}
