/**
 * Littlewing - Multi-type expression language
 */

// Analyzer
export { extractAssignedVariables, extractInputVariables } from "./analyzer";

// Errors
export { ParseError, toLineColumn } from "./errors";

// AST builders
export * as ast from "./ast";
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
	NodeKind,
	type NumberLiteral,
	type Operator,
	type PipeExpression,
	type Placeholder,
	type Program,
	type RangeExpression,
	type StringLiteral,
	type UnaryOp,
} from "./ast";
// Code generation
export { generate } from "./codegen";
// Interpreter
export { evaluate, evaluateScope } from "./interpreter";
// Optimizer
export { optimize } from "./optimizer";
// Parser
export { parse } from "./parser";
// Standard library
export { array, core, datetime, datetimefull, defaultContext, math, string, time } from "./stdlib";
// Type definitions
export type { ExecutionContext, RuntimeValue } from "./types";
// Utilities
export {
	assertArray,
	assertBoolean,
	assertDate,
	assertDateOrDateTime,
	assertDateTime,
	assertNumber,
	assertString,
	assertTime,
	assertTimeOrDateTime,
	typeOf,
} from "./utils";
