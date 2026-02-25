/**
 * Littlewing - Multi-type expression language
 */

// Analyzer
export { extractAssignedVariables, extractInputVariables } from './analyzer'

// AST builders
export * as ast from './ast'
// AST types and type guards
export {
	type ArrayLiteral,
	type ASTNode,
	type Assignment,
	type BinaryOp,
	type BooleanLiteral,
	type ForExpression,
	type FunctionCall,
	type Identifier,
	type IfExpression,
	isArrayLiteral,
	isAssignment,
	isBinaryOp,
	isBooleanLiteral,
	isForExpression,
	isFunctionCall,
	isIdentifier,
	isIfExpression,
	isNumberLiteral,
	isProgram,
	isStringLiteral,
	isUnaryOp,
	NodeKind,
	type NumberLiteral,
	type Operator,
	type Program,
	type StringLiteral,
	type UnaryOp,
} from './ast'
// Code generation
export { generate } from './codegen'
// Interpreter
export { evaluate, evaluateScope } from './interpreter'
// Optimizer
export { optimize } from './optimizer'
// Parser
export { parse } from './parser'
// Standard library
export { array, core, datetime, defaultContext, math, string } from './stdlib'
// Type definitions
export type { ExecutionContext, RuntimeValue } from './types'
// Utilities
export { typeOf } from './utils'

// Visitor pattern
export { type Visitor, visit, visitPartial } from './visitor'
