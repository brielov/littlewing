import {
	type Diagnostic as CompileDiagnostic,
	EvaluationError,
	compile,
	evaluate,
	generate,
	parse,
	type InputDescription,
	type Program,
	type syntax,
	toLineColumn,
	type TypeDescription,
} from 'littlewing';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import type { Problem } from './editor/index.ts';
import { namesTypes } from './language/types.ts';
import { FUNCTIONS, LIMITS, TYPES } from './environment.ts';

interface InputVariable {
	name: string;
	type: string;
	required: boolean;
	defaultValue: unknown;
}

interface Timing {
	compileMs: number;
	evaluateMs: number;
	totalMs: number;
}

type Result = { ok: true; value: unknown } | { ok: false; error: string };

export interface UseEvaluationReturn {
	/** The source all of this is about, which lags what is typed. */
	source: string;
	result: Result | null;
	inputVariables: readonly InputVariable[];
	overrides: ReadonlyMap<string, unknown>;
	ast: syntax.Program | null;
	timing: Timing | null;
	/** Every problem found, in the source this is about. */
	diagnostics: readonly Problem[];
	/** The type of each top-level name, kept from the last source whose types could be found. */
	types: ReadonlyMap<string, TypeDescription>;
	/** Whether `types` are of `source`, rather than of an earlier one. */
	typesCurrent: boolean;
	setOverride: (name: string, value: unknown) => void;
	clearOverride: (name: string) => void;
}

/** The name a type goes by in the sidebar, which picks the control that edits it. */
function typeName(type: TypeDescription): string {
	switch (type.kind) {
		case 'abstract':
			return type.name;
		case 'generic':
			return 'any';
		default:
			return type.kind;
	}
}

/** A value to start a required input from, so that a program runs as soon as it is typed. */
function startingValue(type: string): unknown {
	switch (type) {
		case 'number':
			return 0;
		case 'string':
			return '';
		case 'boolean':
			return false;
		case 'array':
			return [];
		case 'date':
			return Temporal.Now.plainDateISO();
		case 'time':
			return Temporal.Now.plainTimeISO();
		case 'datetime':
			return Temporal.Now.plainDateTimeISO();
		default:
			return undefined;
	}
}

function defaultOf(input: InputDescription, type: string): unknown {
	if (input.default !== undefined) {
		return type === 'number' ? Number(input.default) : input.default;
	}
	return input.required ? startingValue(type) : undefined;
}

function inputsOf(program: Program): InputVariable[] {
	return Object.entries(program.inputs).map(([name, input]) => {
		const type = typeName(input.type);
		return { name, type, required: input.required, defaultValue: defaultOf(input, type) };
	});
}

/** Where a problem is, for a message shown away from the source. */
function located(source: string, problem: Problem): string {
	const { line, column } = toLineColumn(source, problem.from);
	return `${problem.message} (line ${line}, col ${column})`;
}

/** What went wrong in host code, which is here the library's own functions. */
function withCause(code: string, message: string, cause: unknown): string {
	return code === 'host-error' && cause instanceof Error ? `${message}: ${cause.message}` : message;
}

function toProblem(diagnostic: CompileDiagnostic): Problem {
	const { cause, code, end, message, severity, start } = diagnostic;
	return { code, message: withCause(code, message, cause), severity, from: start, to: end };
}

interface Compilation {
	program: Program;
	ast: syntax.Program;
	inputVariables: InputVariable[];
	compileMs: number;
}

type CompileOutcome =
	| { ok: true; value: Compilation | null; diagnostics: readonly Problem[] }
	| { ok: false; error: string; diagnostics: readonly Problem[] };

function compileSource(source: string): CompileOutcome {
	if (source.trim() === '') return { ok: true, value: null, diagnostics: [] };

	const start = performance.now();
	const result = compile(source, { functions: FUNCTIONS, types: TYPES, limits: LIMITS });
	const compileMs = performance.now() - start;

	const reported = result.diagnostics.map(toProblem);
	// Running out of budget is about the whole program, and no place in it
	const diagnostics = reported.filter((diagnostic) => diagnostic.code !== 'limit-exceeded');
	if (!result.ok) {
		const first = reported.find((diagnostic) => diagnostic.severity === 'error');
		const error = first === undefined ? 'The program does not compile' : located(source, first);
		return { ok: false, error, diagnostics };
	}

	const { program } = result;
	const value = {
		program,
		ast: parse(source).program,
		inputVariables: inputsOf(program),
		compileMs,
	};
	return { ok: true, value, diagnostics };
}

/** What the program runs on: what was typed, or else what an input starts from. */
function variablesFor(
	inputs: readonly InputVariable[],
	overrides: ReadonlyMap<string, unknown>,
): Record<string, unknown> {
	const variables = Object.create(null) as Record<string, unknown>;
	for (const { name, required, defaultValue } of inputs) {
		const value = overrides.get(name) ?? (required ? defaultValue : undefined);
		if (value !== undefined) variables[name] = value;
	}
	return variables;
}

/** A value typed for an input, which only holds while the input keeps that type. */
interface Override {
	readonly type: string | undefined;
	readonly value: unknown;
}

/** The values that still fit, as a source edit can change what an input is. */
function currentOverrides(
	inputs: readonly InputVariable[],
	stored: ReadonlyMap<string, Override>,
): Map<string, unknown> {
	const current = new Map<string, unknown>();
	for (const { name, type } of inputs) {
		const override = stored.get(name);
		if (override?.type === type) current.set(name, override.value);
	}
	return current;
}

const NO_INPUTS: readonly InputVariable[] = [];

/**
 * The type of each top-level name, from the statements the parser could read, so
 * that a line being typed does not hide the types of all the others.
 */
function typesOf(source: string): Map<string, TypeDescription> | undefined {
	const { program, diagnostics } = parse(source);
	const names = new Set<string>();
	for (const statement of program.statements) {
		if (statement.kind === 'binding') names.add(statement.name);
	}
	const options = { functions: FUNCTIONS, types: TYPES, limits: LIMITS };
	// Only statements left out need writing out without them
	const readable = diagnostics.length === 0 ? source : generate(program);
	return namesTypes(readable, [...names], options);
}

export function useEvaluation(source: string): UseEvaluationReturn {
	const [stored, setStored] = useState<ReadonlyMap<string, Override>>(() => new Map());
	const deferredSource = useDeferredValue(source);
	const inputsRef = useRef<readonly InputVariable[]>([]);

	const setOverride = useCallback((name: string, value: unknown) => {
		const type = inputsRef.current.find((input) => input.name === name)?.type;
		setStored((prev) => new Map(prev).set(name, { type, value }));
	}, []);

	const clearOverride = useCallback((name: string) => {
		setStored((prev) => {
			const next = new Map(prev);
			next.delete(name);
			return next;
		});
	}, []);

	// Phase 1: compile, which only re-runs when the source changes
	const compilation = useMemo(() => compileSource(deferredSource), [deferredSource]);
	const inputs = compilation.ok ? (compilation.value?.inputVariables ?? NO_INPUTS) : NO_INPUTS;
	inputsRef.current = inputs;
	const overrides = useMemo(() => currentOverrides(inputs, stored), [inputs, stored]);

	// Phase 2: evaluate, which re-runs when the compilation or the overrides change
	const output = useMemo(() => {
		const { diagnostics } = compilation;
		const nothing = { inputVariables: [] as InputVariable[], ast: null, timing: null, diagnostics };
		if (!compilation.ok) {
			return { ...nothing, result: { ok: false as const, error: compilation.error } as Result };
		}
		if (compilation.value === null) return { ...nothing, result: null };

		const { program, ast, inputVariables, compileMs } = compilation.value;
		const finished = { inputVariables, ast };
		const start = performance.now();
		try {
			const variables = variablesFor(inputVariables, overrides);
			const value = evaluate(program, { variables, limits: LIMITS, numbers: 'decimal' });
			const evaluateMs = performance.now() - start;
			const timing = { compileMs, evaluateMs, totalMs: compileMs + evaluateMs };
			return { ...finished, result: { ok: true as const, value } as Result, timing, diagnostics };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const timing = { compileMs, evaluateMs: 0, totalMs: compileMs };
			if (!(err instanceof EvaluationError)) {
				const result: Result = { ok: false, error: message };
				return { ...finished, result, timing, diagnostics };
			}
			// Offsets of 0 mean the failure is not in the source, as with a missing input
			const { cause, code, end, start: from } = err;
			const text = withCause(code, message, cause);
			if (from === 0 && end === 0) {
				return { ...finished, result: { ok: false as const, error: text }, timing, diagnostics };
			}
			const failure: Problem = { code, message: text, severity: 'error', from, to: end };
			const result: Result = { ok: false, error: located(deferredSource, failure) };
			return { ...finished, result, timing, diagnostics: [...diagnostics, failure] };
		}
	}, [compilation, deferredSource, overrides]);

	// Types outlast a source that does not compile, which is most of them while typing
	const known = useRef<ReadonlyMap<string, TypeDescription>>(new Map());
	const { types, typesCurrent } = useMemo(() => {
		const found = typesOf(deferredSource);
		if (found !== undefined) known.current = found;
		return { types: known.current, typesCurrent: found !== undefined };
	}, [deferredSource]);

	return {
		...output,
		source: deferredSource,
		types,
		typesCurrent,
		overrides,
		setOverride,
		clearOverride,
	};
}
