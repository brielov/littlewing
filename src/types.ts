/**
 * Runtime value type - can be a number, Date, or unknown (for function results)
 */
export type RuntimeValue = number | Date | unknown

/**
 * Execution context providing global functions and variables
 * Functions must accept any arguments and return a number or Date
 * Variables must be numbers or Dates
 */
export interface ExecutionContext {
	// biome-ignore lint/suspicious/noExplicitAny: variadic function signature
	functions?: Record<string, (...args: any[]) => number | Date>
	variables?: Record<string, number | Date>
}

/**
 * Token types for lexer output
 */
export enum TokenType {
	// Literals
	NUMBER = 'NUMBER',
	STRING = 'STRING',
	IDENTIFIER = 'IDENTIFIER',

	// Operators
	PLUS = 'PLUS',
	MINUS = 'MINUS',
	STAR = 'STAR',
	SLASH = 'SLASH',
	PERCENT = 'PERCENT',
	CARET = 'CARET',

	// Punctuation
	LPAREN = 'LPAREN',
	RPAREN = 'RPAREN',
	EQUALS = 'EQUALS',
	COMMA = 'COMMA',

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
	| StringLiteral
	| Identifier
	| BinaryOp
	| UnaryOp
	| FunctionCall
	| Assignment

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
 * String literal ('hello', '2025-10-01')
 */
export interface StringLiteral {
	type: 'StringLiteral'
	value: string
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
	operator: '+' | '-' | '*' | '/' | '%' | '^'
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
