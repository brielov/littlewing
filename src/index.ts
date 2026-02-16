/**
 * Littlewing - Minimal arithmetic expression language
 */

// Analyzer
export { extractAssignedVariables, extractInputVariables } from './analyzer'

// AST builders
export * as ast from './ast'
// AST types and type guards
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
	NodeKind,
	type NumberLiteral,
	type Operator,
	type Program,
	type UnaryOp,
} from './ast'
// Code generation
export { generate } from './codegen'
// Humanizer
export { type HumanizeOptions, humanize } from './humanizer'
// Interpreter
export { evaluate, evaluateScope } from './interpreter'
// JIT Compiler
export { type CompiledExpression, compile } from './jit'
// Optimizer
export { optimize } from './optimizer'
// Parser
export { parse } from './parser'
// Standard library
export { datetime, defaultContext, math } from './stdlib'
// Type definitions
export type { ExecutionContext, RuntimeValue } from './types'

// Visitor pattern
export { type Visitor, visit, visitPartial } from './visitor'
