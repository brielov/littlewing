import type { CheckResult, InputType } from './check/check.js';
import { check } from './check/check.js';
import type { InputDescription, InputSchema, TypeDescription } from './check/schema.js';
import { checkInputTypes, isAbstractType, isFunctionDefinition, walkType } from './define.js';
import type {
	AbstractDefinition,
	AbstractType,
	FunctionDefinition,
	Type,
	TypeNode,
} from './define.js';
import type { Diagnostic } from './diagnostics.js';
import { errorAt } from './diagnostics.js';
import { CompileError, EvaluationError } from './errors.js';
import {
	charge,
	currentEvaluation,
	LimitExceededError,
	remainingSteps,
	setBudget,
	setEvaluation,
} from './limits.js';
import { toText } from './number.js';
import { logicalSize, Reader, Writer } from './run/boundary.js';
import type { NumberForm } from './run/boundary.js';
import type { Code, CompiledProgram } from './run/interpret.js';
import { Compiler } from './run/interpret.js';
import type { Frame } from './run/operations.js';
import type { Value } from './run/values.js';
import { failure, isNum } from './run/values.js';
import { CORE } from './functions/core.js';
import { desugarProgram } from './syntax/desugar.js';
import { isKeyword } from './syntax/lexer.js';
import { parseProgram } from './syntax/parser.js';

/** The default budget of compiling, and of evaluating. */
const DEFAULT_MAX_STEPS = 20_000_000;

const IDENTIFIER = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;
const MAX_NAME_LENGTH = 1024;

export interface CompileOptions {
	readonly functions?: Readonly<Record<string, FunctionDefinition>>;
	readonly types?: readonly AbstractType[];
	readonly inputs?: Readonly<Record<string, Type>>;
	readonly limits?: { readonly maxSteps?: number };
}

export interface EvaluateOptions {
	readonly variables?: Readonly<Record<string, unknown>>;
	readonly limits?: { readonly maxSteps?: number };
	readonly numbers?: NumberForm;
}

export type CompileResult =
	| { readonly ok: true; readonly program: Program; readonly diagnostics: readonly Diagnostic[] }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** What a program keeps, which is what evaluating needs and nothing else. */
interface ProgramParts {
	readonly code: Code;
	readonly inputSlots: ReadonlyMap<string, number>;
	readonly inputTypes: ReadonlyMap<string, InputType>;
	readonly abstracts: readonly AbstractDefinition[];
	readonly outputType: CheckResult['outputType'];
}

const KEY = Symbol('Program');

let partsOf: (program: Program) => ProgramParts;
let makeProgram: (parts: ProgramParts, inputs: InputSchema, output: TypeDescription) => Program;
let isProgram: (value: unknown) => value is Program;

/**
 * A checked and compiled program. It can only come from `compile`, and it cannot
 * change. It holds compiled code, so it cannot be serialized.
 */
export class Program {
	readonly #parts: ProgramParts;
	/** What the program needs from its host, inferred. */
	readonly inputs: InputSchema;
	/** What the program gives back. */
	readonly output: TypeDescription;

	private constructor(
		key: symbol,
		parts: ProgramParts,
		inputs: InputSchema,
		output: TypeDescription,
	) {
		if (key !== KEY) throw new TypeError('A Program comes from compile');
		this.#parts = parts;
		this.inputs = inputs;
		this.output = output;
		Object.freeze(this);
	}

	static {
		partsOf = (program) => program.#parts;
		makeProgram = (parts, inputs, output) => new Program(KEY, parts, inputs, output);
		isProgram = (value): value is Program =>
			typeof value === 'object' && value !== null && #parts in value;
	}
}

function checkMaxSteps(limits: { readonly maxSteps?: number } | undefined): number {
	const maxSteps = limits?.maxSteps ?? DEFAULT_MAX_STEPS;
	if (typeof maxSteps !== 'number' || Number.isNaN(maxSteps) || maxSteps < 0) {
		throw new TypeError('limits.maxSteps must be a number that is not negative');
	}
	return maxSteps;
}

/**
 * Run `body` on a budget. Nested in an evaluation or a compile, it runs on what is
 * left of that one, which `maxSteps` can only lower, and what it spends counts there.
 * A lower budget is its own: overrunning it costs the one around it what it allowed.
 */
function withBudget<T>(maxSteps: number, nested: boolean, body: () => T): T {
	const outer = remainingSteps();
	const allowed = Math.min(outer, maxSteps);
	setBudget(allowed);
	try {
		return body();
	} finally {
		const left = remainingSteps();
		if (allowed === outer) setBudget(nested ? left : outer);
		else setBudget(outer - (allowed - Math.max(left, 0)));
	}
}

function isFunctionName(name: string): boolean {
	return (
		IDENTIFIER.test(name) &&
		name.normalize('NFC') === name &&
		!isKeyword(name) &&
		Array.from(name).length <= MAX_NAME_LENGTH
	);
}

function checkFunctions(
	functions: Readonly<Record<string, FunctionDefinition>> | undefined,
): Map<string, FunctionDefinition> {
	const known = new Map<string, FunctionDefinition>();
	if (functions === undefined) return known;
	for (const name of Object.keys(functions)) {
		if (!isFunctionName(name)) throw new TypeError(`Not a function name: ${name.slice(0, 40)}`);
		const definition = functions[name];
		if (!isFunctionDefinition(definition)) {
			throw new TypeError(`Not made with define: ${name.slice(0, 40)}`);
		}
		known.set(name, definition);
	}
	return known;
}

/** Two types of one name could not be told apart in anything a host reads. */
function checkTypeNames(
	functions: ReadonlyMap<string, FunctionDefinition>,
	options: CompileOptions,
): void {
	const names = new Map<string, AbstractDefinition>();
	const seen = new Set<object>();
	const visit = (node: TypeNode): void => {
		if (node.kind !== 'abstract') return;
		const { definition } = node;
		const other = names.get(definition.name);
		if (other !== undefined && other !== definition) {
			throw new TypeError(`Two types are named ${definition.name.slice(0, 40)}`);
		}
		names.set(definition.name, definition);
	};
	for (const type of options.types ?? []) walkType(type, seen, visit);
	for (const definition of functions.values()) {
		for (const { args, returns } of definition.overloads) {
			for (const arg of args) walkType(arg, seen, visit);
			walkType(returns, seen, visit);
		}
	}
	for (const type of Object.values(options.inputs ?? {})) walkType(type, seen, visit);
}

function checkOptions(options: CompileOptions): Map<string, FunctionDefinition> {
	const functions = checkFunctions(options.functions);
	const { types, inputs } = options;
	if (types !== undefined) {
		if (!Array.isArray(types)) throw new TypeError('types must be a list');
		for (const type of types as readonly unknown[]) {
			if (!isAbstractType(type)) throw new TypeError('types must be made with defineType');
		}
	}
	if (inputs !== undefined) checkInputTypes(inputs);
	checkTypeNames(functions, options);
	return new Map([...CORE, ...functions]);
}

/** What a `RangeError` means here: the stack ran out, or a string or array grew too long. */
const TOO_LARGE = 'The program ran out of room';

function failureOf(error: unknown): Diagnostic {
	const message =
		error instanceof LimitExceededError ? 'Compiling exceeded its step limit' : TOO_LARGE;
	return errorAt('limit-exceeded', message, 0, 0);
}

function deepFreeze<T>(value: T, seen: Set<object>): T {
	if (typeof value !== 'object' || value === null || seen.has(value)) return value;
	seen.add(value);
	for (const item of Object.values(value)) deepFreeze(item, seen);
	return Object.freeze(value);
}

function defaultsOf(inputs: InputSchema, compiled: CompiledProgram): InputSchema {
	const schema = Object.create(null) as Record<string, InputDescription>;
	for (const name of Object.keys(inputs)) {
		const input = inputs[name] as InputDescription;
		const value: Value = compiled.defaults.get(name);
		if (isNum(value)) schema[name] = { ...input, default: toText(value) };
		else if (typeof value === 'string' || typeof value === 'boolean') {
			schema[name] = { ...input, default: value };
		} else schema[name] = input;
	}
	return schema;
}

function hasError(diagnostics: readonly Diagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

/**
 * Compile a program: lex, parse, desugar, check and optimize. Every problem in the
 * program comes back as a diagnostic.
 *
 * @throws {TypeError} for a mistake in the host
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
	const functions = checkOptions(options);
	const maxSteps = checkMaxSteps(options.limits);

	return withBudget(maxSteps, currentEvaluation() !== undefined, () => {
		const diagnostics: Diagnostic[] = [];
		try {
			const parsed = parseProgram(source);
			diagnostics.push(...parsed.diagnostics);
			if (parsed.program === undefined || hasError(diagnostics)) {
				return { ok: false, diagnostics };
			}

			const { inputs, types } = options;
			const checked = check(desugarProgram(parsed.program), {
				functions,
				...(inputs === undefined ? {} : { inputs }),
				...(types === undefined ? {} : { types }),
			});
			diagnostics.push(...checked.diagnostics);
			if (hasError(diagnostics)) return { ok: false, diagnostics };

			// Folding runs host code, which is nested in it as it would be in an evaluation
			const outer = setEvaluation({});
			let compiled: CompiledProgram;
			try {
				compiled = new Compiler(checked, functions).compile(checked.program);
			} finally {
				setEvaluation(outer);
			}
			diagnostics.push(...compiled.diagnostics);
			if (hasError(diagnostics)) return { ok: false, diagnostics };

			const parts: ProgramParts = {
				code: compiled.code,
				inputSlots: compiled.inputSlots,
				inputTypes: checked.inputTypes,
				abstracts: checked.abstracts,
				outputType: checked.outputType,
			};
			const seen = new Set<object>();
			const program = makeProgram(
				parts,
				deepFreeze(defaultsOf(checked.inputs, compiled), seen),
				deepFreeze(checked.output, seen),
			);
			return { ok: true, program, diagnostics };
		} catch (error) {
			if (!(error instanceof LimitExceededError) && !(error instanceof RangeError)) throw error;
			diagnostics.push(failureOf(error));
			return { ok: false, diagnostics };
		}
	});
}

function checkVariables(variables: unknown): void {
	if (variables === undefined) return;
	if (typeof variables !== 'object' || variables === null) {
		throw new TypeError('variables must be a plain object');
	}
	let prototype: unknown;
	try {
		prototype = Object.getPrototypeOf(variables);
	} catch {
		throw new TypeError('variables must be a plain object');
	}
	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError('variables must be a plain object');
	}
}

interface Supplied {
	readonly values: Map<string, unknown>;
	/** The first input that threw, which comes after any that is missing. */
	readonly failed: EvaluationError | undefined;
}

/** Read each input once, by its own enumerable key. */
function readSupplied(
	variables: Readonly<Record<string, unknown>> | undefined,
	parts: ProgramParts,
): Supplied {
	const values = new Map<string, unknown>();
	let failed: EvaluationError | undefined;
	if (variables === undefined) return { values, failed };
	for (const name of parts.inputTypes.keys()) {
		try {
			if (Object.getOwnPropertyDescriptor(variables, name)?.enumerable !== true) continue;
			const value: unknown = variables[name];
			if (value !== undefined) values.set(name, value);
		} catch (cause) {
			values.set(name, undefined);
			failed ??= failure('invalid-input', 'An input could not be read', cause);
		}
	}
	return { values, failed };
}

function readVariables(
	variables: Readonly<Record<string, unknown>> | undefined,
	parts: ProgramParts,
	frame: Frame,
): void {
	const { values: supplied, failed } = readSupplied(variables, parts);
	for (const [name, input] of parts.inputTypes) {
		if (input.required && !supplied.has(name)) {
			throw failure('missing-input', `Missing input ${name.slice(0, 40)}`);
		}
	}
	if (failed !== undefined) throw failed;

	const reader = new Reader('invalid-input', frame.bindings, parts.abstracts, frame.metered);
	const { inputSlots } = parts;
	for (const [name, value] of supplied) {
		const input = parts.inputTypes.get(name) as InputType;
		frame.slots[inputSlots.get(name) as number] = reader.cross(value, input.type);
	}
	for (const name of supplied.keys()) {
		reader.checkLimits((parts.inputTypes.get(name) as InputType).type);
	}
}

function located(error: EvaluationError, frame: Frame, inProgram: boolean): EvaluationError {
	const start = inProgram ? (frame.current?.start ?? 0) : 0;
	const end = inProgram ? (frame.current?.end ?? 0) : 0;
	const { cause } = error;
	return new EvaluationError(error.message, start, end, {
		code: error.code,
		...(cause === undefined ? {} : { cause }),
	});
}

function evaluateParts(parts: ProgramParts, options: EvaluateOptions, metered: boolean): unknown {
	const frame: Frame = {
		slots: [],
		current: undefined,
		strings: undefined,
		bindings: new Map(),
		metered,
	};
	const { code } = parts;

	let inProgram = false;
	try {
		readVariables(options.variables, parts, frame);
		inProgram = true;
		const value = code(frame);
		inProgram = false;
		if (remainingSteps() < 0) throw new LimitExceededError('Evaluation exceeded its step limit');

		charge(logicalSize(value, parts.outputType, new Map()));
		return new Writer(options.numbers ?? 'number', false).write(value, parts.outputType);
	} catch (error) {
		// The budget comes first: a host that caught its end can still return nonsense
		const ranOut = error instanceof LimitExceededError || remainingSteps() < 0;
		if (ranOut || error instanceof RangeError) {
			const start = inProgram ? (frame.current?.start ?? 0) : 0;
			const end = inProgram ? (frame.current?.end ?? 0) : 0;
			const message = ranOut ? 'Evaluation exceeded its step limit' : TOO_LARGE;
			throw new EvaluationError(message, start, end, { code: 'limit-exceeded', cause: error });
		}
		if (error instanceof EvaluationError) throw located(error, frame, inProgram);
		throw new EvaluationError('Host code failed', 0, 0, { code: 'host-error', cause: error });
	}
}

/**
 * Evaluate a compiled program. Every failure is an `EvaluationError`.
 *
 * @throws {TypeError} for a mistake in the host
 */
export function evaluate(program: Program, options: EvaluateOptions = {}): unknown {
	if (!isProgram(program)) throw new TypeError('Expected a Program from compile');
	const { numbers } = options;
	if (numbers !== undefined && numbers !== 'number' && numbers !== 'decimal') {
		throw new TypeError('numbers must be number or decimal');
	}
	const maxSteps = checkMaxSteps(options.limits);
	checkVariables(options.variables);

	const nested = currentEvaluation() !== undefined;
	const previous = setEvaluation({});
	try {
		return withBudget(maxSteps, nested, () => evaluateParts(partsOf(program), options, nested));
	} finally {
		setEvaluation(previous);
	}
}

/**
 * Compile and evaluate, for one-off use.
 *
 * @throws {CompileError} if the program does not compile
 */
export function run(source: string, options: CompileOptions & EvaluateOptions = {}): unknown {
	const result = compile(source, options);
	if (!result.ok) throw new CompileError(result.diagnostics);
	return evaluate(result.program, options);
}
