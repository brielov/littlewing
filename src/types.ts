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
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>
	variables?: Record<string, RuntimeValue>
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
	EXCLAMATION = 'EXCLAMATION',

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
