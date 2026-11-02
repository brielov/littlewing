import {
	type Diagnostic as CompileDiagnostic,
	EvaluationError,
	compile,
	evaluate,
	parse,
	type InputDescription,
	type Program,
	type syntax,
	toLineColumn,
	type TypeDescription,
} from 'littlewing';
import * as clock from 'littlewing/clock';
import * as std from 'littlewing/std';
import { date, datetime, temporalFunctions, time } from 'littlewing/temporal';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';

/**
 * Evaluation runs on the main thread, on every keystroke and from shared links, so
 * it gets a budget small enough to keep the page responsive whatever is typed.
 * The library default is ten times this.
 */
export const LIMITS = { maxSteps: 2_000_000 };

/** Everything a program here can call, beyond the core functions. */
export const FUNCTIONS = { ...std, ...temporalFunctions, ...clock };

const TYPES = [date, time, datetime];

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

export interface Diagnostic {
	code: string;
	message: string;
	severity: 'error' | 'warning';
	startLine: number;
	startCol: number;
	endLine: number;
	endCol: number;
}

export interface UseEvaluationReturn {
	/** The source all of this is about, which lags what is typed. */
	source: string;
	result: Result | null;
	inputVariables: readonly InputVariable[];
	overrides: ReadonlyMap<string, unknown>;
	ast: syntax.Program | null;
	timing: Timing | null;
	diagnostics: readonly Diagnostic[];
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

/**
 * Turn a source span into a diagnostic.
 */
function spanToDiagnostic(
	source: string,
	code: string,
	message: string,
	severity: Diagnostic['severity'],
	start: number,
	end: number,
): Diagnostic {
	const rawStartOffset = Math.max(0, Math.min(start, source.length));
	const rawStart = toLineColumn(source, rawStartOffset);
	let markerStartOffset = rawStartOffset;
	let markerEndOffset = Math.max(markerStartOffset, Math.min(end, source.length));

	// Monaco markers render best with a non-empty span.
	if (markerEndOffset === markerStartOffset && source.length > 0) {
		if (markerStartOffset < source.length) {
			markerEndOffset = markerStartOffset + 1;
		} else {
			markerStartOffset = source.length - 1;
			markerEndOffset = source.length;
		}
	}

	const markerStart = toLineColumn(source, markerStartOffset);
	const markerEnd = toLineColumn(source, markerEndOffset);

	return {
		code,
		message: `${message} (line ${rawStart.line}, col ${rawStart.column})`,
		severity,
		startLine: markerStart.line,
		startCol: markerStart.column,
		endLine: markerEnd.line,
		endCol: markerEnd.column,
	};
}

/** What went wrong in host code, which is here the library's own functions. */
function withCause(code: string, message: string, cause: unknown): string {
	return code === 'host-error' && cause instanceof Error ? `${message}: ${cause.message}` : message;
}

function toDiagnostic(source: string, diagnostic: CompileDiagnostic): Diagnostic {
	const { cause, code, end, message, severity, start } = diagnostic;
	return spanToDiagnostic(source, code, withCause(code, message, cause), severity, start, end);
}

interface Compilation {
	program: Program;
	ast: syntax.Program;
	inputVariables: InputVariable[];
	compileMs: number;
}

type CompileOutcome =
	| { ok: true; value: Compilation | null; diagnostics: readonly Diagnostic[] }
	| { ok: false; error: string; diagnostics: readonly Diagnostic[] };

function compileSource(source: string): CompileOutcome {
	if (source.trim() === '') return { ok: true, value: null, diagnostics: [] };

	const start = performance.now();
	const result = compile(source, { functions: FUNCTIONS, types: TYPES, limits: LIMITS });
	const compileMs = performance.now() - start;

	const reported = result.diagnostics.map((diagnostic) => toDiagnostic(source, diagnostic));
	// Running out of budget is about the whole program, and no place in it
	const diagnostics = reported.filter((diagnostic) => diagnostic.code !== 'limit-exceeded');
	if (!result.ok) {
		const first = reported.find((diagnostic) => diagnostic.severity === 'error');
		return { ok: false, error: first?.message ?? 'The program does not compile', diagnostics };
	}

	const { program } = result;
	const value = { program, ast: parse(source).program, inputVariables: inputsOf(program), compileMs };
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
			const failure = spanToDiagnostic(deferredSource, code, text, 'error', from, end);
			const result: Result = { ok: false, error: failure.message };
			return { ...finished, result, timing, diagnostics: [...diagnostics, failure] };
		}
	}, [compilation, deferredSource, overrides]);

	return { ...output, source: deferredSource, overrides, setOverride, clearOverride };
}
