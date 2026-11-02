/**
 * Littlewing: a small typed language for formulas that a host can run safely.
 */

export type {
	FieldDescription,
	InputDescription,
	InputSchema,
	TypeDescription,
} from './check/schema.js';
export type { CompileOptions, CompileResult, EvaluateOptions, Program } from './compile.js';
export { compile, evaluate, run } from './compile.js';
export type { DecimalLike, RoundingMode } from './decimal.js';
export { Decimal } from './decimal.js';
export type {
	AbstractType,
	FunctionDefinition,
	FunctionDescription,
	OverloadDescription,
	ParameterDescription,
	Type,
} from './define.js';
export { define, defineType, describeFunction, once, t } from './define.js';
export type { Diagnostic } from './diagnostics.js';
export { CompileError, EvaluationError, ParseError, toLineColumn } from './errors.js';
export { coreFunctions } from './functions/core.js';
export type * as syntax from './syntax/ast.js';
export { generate } from './syntax/generate.js';
export { parse } from './syntax/parser.js';
