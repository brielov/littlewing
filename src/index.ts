/**
 * Littlewing - Minimal arithmetic expression language
 */

// AST builders
export * as ast from './ast'

// Code generation
export { CodeGenerator, generate } from './codegen'

// Date utilities
export * as dateUtils from './date-utils'

// Defaults
export { defaultContext } from './defaults'

// Executor
export { Executor, execute } from './executor'

// Lexer
export { Lexer } from './lexer'

// Optimizer
export { optimize } from './optimizer'

// Parser
export { Parser, parseSource } from './parser'

// Type definitions
export type { ExecutionContext, RuntimeValue } from './types'
export {
	type ASTNode,
	type Assignment,
	type BinaryOp,
	type ConditionalExpression,
	type FunctionCall,
	type Identifier,
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
	type NumberLiteral,
	type Operator,
	type Program,
	type Token,
	TokenType,
	type UnaryOp,
} from './types'
