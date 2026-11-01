/**
 * Littlewing - Multi-type expression language
 */

// Analyzer
export { extractAssignedVariables, extractInputVariables } from './analyzer.js';

// Errors
export { EvaluationError, ParseError, toLineColumn } from './errors.js';

// AST builders
export * as ast from './ast.js';
// AST types and type guards
export {
	type ArrayLiteral,
	type ASTNode,
	type ASTNodeBase,
	type Assignment,
	type BinaryOp,
	type BooleanLiteral,
	type ForExpression,
	type FunctionCall,
	forEachChild,
	type Identifier,
	type IfExpression,
	type IndexAccess,
	isArrayLiteral,
	isAssignment,
	isBinaryOp,
	isBooleanLiteral,
	isForExpression,
	isFunctionCall,
	isIdentifier,
	isIfExpression,
	isIndexAccess,
	isNumberLiteral,
	isPipeExpression,
	isPlaceholder,
	isProgram,
	isRangeExpression,
	isStringLiteral,
	isUnaryOp,
	mapChildren,
	NodeKind,
	type NumberLiteral,
	type Operator,
	type PipeExpression,
	type Placeholder,
	type Program,
	type RangeExpression,
	type StringLiteral,
	type UnaryOp,
	type Visitor,
	visit,
} from './ast.js';
// Code generation
export { generate } from './codegen.js';
// Interpreter
export { DEFAULT_MAX_STEPS, evaluate, evaluateScope, evaluateWithScope } from './interpreter.js';
// Limits
export { LimitExceededError } from './limits.js';
// Optimizer
export { type OptimizeOptions, optimize } from './optimizer.js';
// Parser
export { parse } from './parser.js';
// Standard library
export {
	array,
	core,
	datetime,
	datetimefull,
	defaultContext,
	math,
	string,
	time,
} from './stdlib/index.js';
// Type definitions
export type {
	ExecutionContext,
	ExecutionLimits,
	ExecutionResult,
	HostFunction,
	PlainDate,
	PlainDateTime,
	PlainTime,
	RuntimeValue,
} from './types.js';
// Utilities
export {
	assertArray,
	assertBoolean,
	assertDate,
	assertDateOrDateTime,
	assertDateTime,
	assertInteger,
	assertNumber,
	assertRuntimeValue,
	assertString,
	assertTime,
	assertTimeOrDateTime,
	typeOf,
} from './utils.js';
