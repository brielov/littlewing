import {
	type ASTNode,
	EvaluationError,
	type ExecutionLimits,
	LimitExceededError,
	ParseError,
	type RuntimeValue,
	defaultContext,
	evaluate,
	evaluateWithScope,
	extractAssignedVariables,
	extractInputVariables,
	isAssignment,
	isProgram,
	optimize,
	parse,
	toLineColumn,
	typeOf,
} from 'littlewing';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

/**
 * Evaluation runs on the main thread, on every keystroke and from shared links, so
 * it gets a budget small enough to keep the page responsive whatever is typed.
 * The library default is ten times this.
 */
const maxSteps = 2_000_000;
export const LIMITS: ExecutionLimits = { maxSteps };

interface InputVariable {
	name: string;
	type: string;
	defaultValue: RuntimeValue;
}

interface Timing {
	parseMs: number;
	optimizeMs: number;
	evaluateMs: number;
	totalMs: number;
}

type Result = { ok: true; value: RuntimeValue } | { ok: false; error: string };

export interface Diagnostic {
	message: string;
	startLine: number;
	startCol: number;
	endLine: number;
	endCol: number;
}

export interface UseEvaluationReturn {
	result: Result | null;
	inputVariables: InputVariable[];
	overrides: Map<string, RuntimeValue>;
	scope: Record<string, RuntimeValue> | null;
	assignedVariables: readonly string[];
	ast: ASTNode | null;
	timing: Timing | null;
	diagnostics: readonly Diagnostic[];
	setOverride: (name: string, value: RuntimeValue) => void;
	clearOverride: (name: string) => void;
}

interface CompilationResult {
	optimizedAst: ASTNode;
	ast: ASTNode;
	inputVariables: InputVariable[];
	assignedVariables: string[];
	parseMs: number;
	optimizeMs: number;
}

function resolveInputVariables(ast: ASTNode): InputVariable[] {
	const inputVarNames = new Set(extractInputVariables(ast));
	if (inputVarNames.size === 0) return [];

	const statements = isProgram(ast) ? ast.statements : [ast];
	const seen = new Set<string>();
	const inputVariables: InputVariable[] = [];
	// The defaults share one budget, or a long program could multiply it
	const limits = { maxSteps: Math.floor(maxSteps / inputVarNames.size) };

	for (const statement of statements) {
		if (
			!isAssignment(statement) ||
			!inputVarNames.has(statement.name) ||
			seen.has(statement.name)
		) {
			continue;
		}

		seen.add(statement.name);

		let defaultValue: RuntimeValue;
		try {
			defaultValue = evaluate(statement.value, { ...defaultContext, limits });
		} catch (err) {
			// Too heavy for its share to become an input, though the program may still run
			if (err instanceof EvaluationError && err.cause instanceof LimitExceededError) continue;
			throw err;
		}

		inputVariables.push({
			name: statement.name,
			type: typeOf(defaultValue),
			defaultValue,
		});
	}

	return inputVariables;
}

function compile(src: string): CompilationResult | null {
	if (src.trim() === '') return null;

	const parseStart = performance.now();
	const ast = parse(src);
	const parseMs = performance.now() - parseStart;

	const inputVariables = resolveInputVariables(ast);
	const assignedVariables = extractAssignedVariables(ast);

	const optimizeStart = performance.now();
	const optimizedAst = optimize(ast, {
		externalVariables: new Set(inputVariables.map((variable) => variable.name)),
		preserveScope: true,
	});
	const optimizeMs = performance.now() - optimizeStart;

	return { optimizedAst, ast, inputVariables, assignedVariables, parseMs, optimizeMs };
}

interface EvaluationResult {
	result: Result;
	scope: Record<string, RuntimeValue>;
	evaluateMs: number;
}

function formatErrorMessage(message: string, line: number, column: number): string {
	return `${message} (line ${line}, col ${column})`;
}

/**
 * Turn an error's source span into a diagnostic.
 */
function spanToDiagnostic(source: string, message: string, start: number, end: number): Diagnostic {
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
		message: formatErrorMessage(message, rawStart.line, rawStart.column),
		startLine: markerStart.line,
		startCol: markerStart.column,
		endLine: markerEnd.line,
		endCol: markerEnd.column,
	};
}

/**
 * Find a function's name within the call or pipe an error spans, as that is what a
 * quick fix replaces.
 */
function findFunctionName(
	source: string,
	name: string,
	start: number,
	end: number,
): [number, number] {
	const text = source.slice(start, end);
	// A call fails before its arguments run, so a span starting with the name is it
	if (new RegExp(`^${name}\\s*\\(`).test(text)) return [start, start + name.length];
	const offset = text.indexOf(name, Math.max(text.lastIndexOf('|>'), 0));
	return offset === -1 ? [start, end] : [start + offset, start + offset + name.length];
}

/**
 * Get a diagnostic for an error that knows where in the source it happened.
 */
function errorToDiagnostic(source: string, err: unknown): Diagnostic | null {
	if (err instanceof ParseError || err instanceof EvaluationError) {
		const { end, message, start } = err;
		if (start === undefined || end === undefined) return null;

		const undefinedFunction = 'Undefined function: ';
		if (message.startsWith(undefinedFunction)) {
			const name = message.slice(undefinedFunction.length);
			return spanToDiagnostic(source, message, ...findFunctionName(source, name, start, end));
		}
		return spanToDiagnostic(source, message, start, end);
	}
	return null;
}

function run(optimizedAst: ASTNode, overrides: Map<string, RuntimeValue>): EvaluationResult {
	const overrideVariables: Record<string, RuntimeValue> = {};
	for (const [name, value] of overrides) {
		overrideVariables[name] = value;
	}

	const mergedContext = {
		...defaultContext,
		variables: overrideVariables,
		limits: LIMITS,
	};

	const evaluateStart = performance.now();
	const { value, scope } = evaluateWithScope(optimizedAst, mergedContext);
	const evaluateMs = performance.now() - evaluateStart;

	return { result: { ok: true, value }, scope, evaluateMs };
}

export function useEvaluation(source: string): UseEvaluationReturn {
	const [overrides, setOverrides] = useState<Map<string, RuntimeValue>>(() => new Map());
	const deferredSource = useDeferredValue(source);

	const setOverride = useCallback((name: string, value: RuntimeValue) => {
		setOverrides((prev) => {
			const next = new Map(prev);
			next.set(name, value);
			return next;
		});
	}, []);

	const clearOverride = useCallback((name: string) => {
		setOverrides((prev) => {
			const next = new Map(prev);
			next.delete(name);
			return next;
		});
	}, []);

	// Phase 1: compile (parse + optimize) — only re-runs when source changes
	const compilation = useMemo(() => {
		try {
			return { ok: true as const, value: compile(deferredSource), diagnostics: [] as Diagnostic[] };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const diagnostic = errorToDiagnostic(deferredSource, err);
			return {
				ok: false as const,
				error: diagnostic ? diagnostic.message : message,
				diagnostics: diagnostic ? [diagnostic] : [],
			};
		}
	}, [deferredSource]);

	// Phase 2: evaluate — re-runs when compilation or overrides change
	const output = useMemo(() => {
		if (!compilation.ok) {
			return {
				result: { ok: false as const, error: compilation.error } as Result,
				inputVariables: [] as InputVariable[],
				scope: null,
				assignedVariables: [],
				ast: null,
				timing: null,
				diagnostics: compilation.diagnostics,
			};
		}

		if (compilation.value === null) {
			return {
				result: null,
				inputVariables: [] as InputVariable[],
				scope: null,
				assignedVariables: [],
				ast: null,
				timing: null,
				diagnostics: [],
			};
		}

		const { optimizedAst, ast, inputVariables, assignedVariables, parseMs, optimizeMs } =
			compilation.value;

		try {
			const { result, scope, evaluateMs } = run(optimizedAst, overrides);
			const totalMs = parseMs + optimizeMs + evaluateMs;
			return {
				result,
				inputVariables,
				scope,
				assignedVariables,
				ast,
				timing: { parseMs, optimizeMs, evaluateMs, totalMs },
				diagnostics: [],
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const diagnostic = errorToDiagnostic(deferredSource, err);
			return {
				result: {
					ok: false as const,
					error: diagnostic ? diagnostic.message : message,
				} as Result,
				inputVariables,
				scope: null,
				assignedVariables,
				ast,
				timing: { parseMs, optimizeMs, evaluateMs: 0, totalMs: parseMs + optimizeMs },
				diagnostics: diagnostic ? [diagnostic] : [],
			};
		}
	}, [compilation, deferredSource, overrides]);

	return { ...output, overrides, setOverride, clearOverride };
}
