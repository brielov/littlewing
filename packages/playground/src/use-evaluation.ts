import {
	type ASTNode,
	ParseError,
	type RuntimeValue,
	defaultContext,
	evaluate,
	evaluateScope,
	extractInputVariables,
	optimize,
	parse,
	toLineColumn,
	typeOf,
} from "littlewing";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

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
	parseMs: number;
	optimizeMs: number;
}

function compile(src: string): CompilationResult | null {
	if (src.trim() === "") return null;

	const parseStart = performance.now();
	const ast = parse(src);
	const parseMs = performance.now() - parseStart;

	const inputVarNames = extractInputVariables(ast);

	const optimizeStart = performance.now();
	const optimizedAst = optimize(ast, new Set(inputVarNames));
	const optimizeMs = performance.now() - optimizeStart;

	const defaultScope = evaluateScope(optimizedAst, defaultContext);
	const inputVariables: InputVariable[] = inputVarNames
		.filter((name) => name in defaultScope)
		.map((name) => ({
			name,
			type: typeOf(defaultScope[name] as RuntimeValue),
			defaultValue: defaultScope[name] as RuntimeValue,
		}));

	return { optimizedAst, ast, inputVariables, parseMs, optimizeMs };
}

interface EvaluationResult {
	result: Result;
	scope: Record<string, RuntimeValue>;
	evaluateMs: number;
}

function formatParseErrorMessage(message: string, line: number, column: number): string {
	return `${message} (line ${line}, col ${column})`;
}

function parseErrorToDiagnostic(source: string, err: ParseError): Diagnostic {
	const rawStartOffset = Math.max(0, Math.min(err.start, source.length));
	const rawStart = toLineColumn(source, rawStartOffset);
	let markerStartOffset = rawStartOffset;
	let markerEndOffset = Math.max(markerStartOffset, Math.min(err.end, source.length));

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
	const message = formatParseErrorMessage(err.message, rawStart.line, rawStart.column);

	return {
		message,
		startLine: markerStart.line,
		startCol: markerStart.column,
		endLine: markerEnd.line,
		endCol: markerEnd.column,
	};
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createIdentifierDiagnostic(
	source: string,
	name: string,
	message: string,
): Diagnostic | null {
	if (name.length === 0) return null;
	const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, "g");
	let match: RegExpExecArray | null;
	let lastMatch: RegExpExecArray | null = null;
	while (true) {
		match = pattern.exec(source);
		if (!match) break;
		lastMatch = match;
	}
	if (!lastMatch) return null;

	const startOffset = lastMatch.index;
	const endOffset = startOffset + name.length;
	const start = toLineColumn(source, startOffset);
	const end = toLineColumn(source, endOffset);
	return {
		message: formatParseErrorMessage(message, start.line, start.column),
		startLine: start.line,
		startCol: start.column,
		endLine: end.line,
		endCol: end.column,
	};
}

function runtimeErrorToDiagnostic(source: string, message: string): Diagnostic | null {
	const undefinedVariablePrefix = "Undefined variable: ";
	if (message.startsWith(undefinedVariablePrefix)) {
		const name = message.slice(undefinedVariablePrefix.length).trim();
		return createIdentifierDiagnostic(source, name, message);
	}

	const undefinedFunctionPrefix = "Undefined function: ";
	if (message.startsWith(undefinedFunctionPrefix)) {
		const name = message.slice(undefinedFunctionPrefix.length).trim();
		return createIdentifierDiagnostic(source, name, message);
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
	};

	const evaluateStart = performance.now();
	const value = evaluate(optimizedAst, mergedContext);
	const scope = evaluateScope(optimizedAst, mergedContext);
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
			let message = err instanceof Error ? err.message : String(err);
			const diagnostics: Diagnostic[] = [];
			if (err instanceof ParseError) {
				const diagnostic = parseErrorToDiagnostic(deferredSource, err);
				diagnostics.push(diagnostic);
				message = diagnostic.message;
			} else {
				const diagnostic = runtimeErrorToDiagnostic(deferredSource, message);
				if (diagnostic) {
					diagnostics.push(diagnostic);
					message = diagnostic.message;
				}
			}
			return { ok: false as const, error: message, diagnostics };
		}
	}, [deferredSource]);

	// Phase 2: evaluate — re-runs when compilation or overrides change
	const output = useMemo(() => {
		if (!compilation.ok) {
			return {
				result: { ok: false as const, error: compilation.error } as Result,
				inputVariables: [] as InputVariable[],
				scope: null,
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
				ast: null,
				timing: null,
				diagnostics: [],
			};
		}

		const { optimizedAst, ast, inputVariables, parseMs, optimizeMs } = compilation.value;

		try {
			const { result, scope, evaluateMs } = run(optimizedAst, overrides);
			const totalMs = parseMs + optimizeMs + evaluateMs;
			return {
				result,
				inputVariables,
				scope,
				ast,
				timing: { parseMs, optimizeMs, evaluateMs, totalMs },
				diagnostics: [],
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const diagnostic = runtimeErrorToDiagnostic(deferredSource, message);
			return {
				result: {
					ok: false as const,
					error: diagnostic ? diagnostic.message : message,
				} as Result,
				inputVariables,
				scope: null,
				ast,
				timing: { parseMs, optimizeMs, evaluateMs: 0, totalMs: parseMs + optimizeMs },
				diagnostics: diagnostic ? [diagnostic] : [],
			};
		}
	}, [compilation, deferredSource, overrides]);

	return { ...output, overrides, setOverride, clearOverride };
}
