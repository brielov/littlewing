/**
 * Littlewing - Minimal arithmetic expression language
 */

// AST builders
export * as ast from './ast'

// Code generation
export { CodeGenerator, generate } from './codegen'

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
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	isFunctionCall,
	isIdentifier,
	isNullishAssignment,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
	type Token,
	TokenType,
} from './types'
