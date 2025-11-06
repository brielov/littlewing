/**
 * Runtime value type - only numbers
 */
export type RuntimeValue = number

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
 * Execution context providing global functions and variables
 * Functions must accept zero or more number arguments and return a number
 * Variables must be numbers
 */
export interface ExecutionContext {
	functions?: Record<string, (...args: number[]) => number>
	variables?: Record<string, number>
}

/**
 * Token types for lexer output
 */
export enum TokenType {
	// Literals
	NUMBER = 'NUMBER',
	IDENTIFIER = 'IDENTIFIER',

	// Operators
	PLUS = 'PLUS',
	MINUS = 'MINUS',
	STAR = 'STAR',
	SLASH = 'SLASH',
	PERCENT = 'PERCENT',
	CARET = 'CARET',

	// Comparison operators
	DOUBLE_EQUALS = 'DOUBLE_EQUALS',
	NOT_EQUALS = 'NOT_EQUALS',
	LESS_THAN = 'LESS_THAN',
	GREATER_THAN = 'GREATER_THAN',
	LESS_EQUAL = 'LESS_EQUAL',
	GREATER_EQUAL = 'GREATER_EQUAL',

	// Logical operators
	LOGICAL_AND = 'LOGICAL_AND',
	LOGICAL_OR = 'LOGICAL_OR',

	// Punctuation
	LPAREN = 'LPAREN',
	RPAREN = 'RPAREN',
	EQUALS = 'EQUALS',
	COMMA = 'COMMA',
	QUESTION = 'QUESTION',
	COLON = 'COLON',

	// End of file
	EOF = 'EOF',
}

/**
 * Token produced by lexer
 */
export interface Token {
	type: TokenType
	value: string | number
	position: number
}

/**
 * AST Node - base type
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
 * Program node (multiple statements)
 */
export interface Program {
	type: 'Program'
	statements: ASTNode[]
}

/**
 * Number literal (123, 45.67)
 */
export interface NumberLiteral {
	type: 'NumberLiteral'
	value: number
}

/**
 * Identifier (variable or function name)
 */
export interface Identifier {
	type: 'Identifier'
	name: string
}

/**
 * Binary operation (a + b, x * y, etc.)
 */
export interface BinaryOp {
	type: 'BinaryOp'
	left: ASTNode
	operator: Operator
	right: ASTNode
}

/**
 * Unary operation (-x, -5, etc.)
 */
export interface UnaryOp {
	type: 'UnaryOp'
	operator: '-'
	argument: ASTNode
}

/**
 * Function call (now(), abs(-5), etc.)
 */
export interface FunctionCall {
	type: 'FunctionCall'
	name: string
	arguments: ASTNode[]
}

/**
 * Variable assignment (x = 5)
 */
export interface Assignment {
	type: 'Assignment'
	name: string
	value: ASTNode
}

/**
 * Conditional expression (ternary operator: condition ? consequent : alternate)
 * Returns consequent if condition !== 0, otherwise returns alternate
 */
export interface ConditionalExpression {
	type: 'ConditionalExpression'
	condition: ASTNode
	consequent: ASTNode
	alternate: ASTNode
}

/**
 * Type guard functions for discriminated union narrowing
 */
export function isNumberLiteral(node: ASTNode): node is NumberLiteral {
	return node.type === 'NumberLiteral'
}

export function isIdentifier(node: ASTNode): node is Identifier {
	return node.type === 'Identifier'
}

export function isBinaryOp(node: ASTNode): node is BinaryOp {
	return node.type === 'BinaryOp'
}

export function isUnaryOp(node: ASTNode): node is UnaryOp {
	return node.type === 'UnaryOp'
}

export function isFunctionCall(node: ASTNode): node is FunctionCall {
	return node.type === 'FunctionCall'
}

export function isAssignment(node: ASTNode): node is Assignment {
	return node.type === 'Assignment'
}

export function isProgram(node: ASTNode): node is Program {
	return node.type === 'Program'
}

export function isConditionalExpression(
	node: ASTNode,
): node is ConditionalExpression {
	return node.type === 'ConditionalExpression'
}
