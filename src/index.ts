/**
 * Littlewing - Minimal arithmetic expression language
 */

// Analyzer
export { extractInputVariables } from './analyzer'

// AST builders
export * as ast from './ast'

// Code generation
export { generate } from './codegen'

// Defaults
export { defaultContext } from './defaults'

// Humanizer
export { type HumanizeOptions, humanize } from './humanizer'

// Interpreter
export { evaluate } from './interpreter'

// Optimizer
export { optimize } from './optimizer'

// Parser
export { parse } from './parser'

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

// Visitor pattern
export { type Visitor, visit, visitPartial } from './visitor'
