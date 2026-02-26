import {
	type ASTNode,
	type RuntimeValue,
	defaultContext,
	evaluate,
	evaluateScope,
	extractInputVariables,
	optimize,
	parse,
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

export interface UseEvaluationReturn {
	result: Result | null;
	inputVariables: InputVariable[];
	overrides: Map<string, RuntimeValue>;
	scope: Record<string, RuntimeValue> | null;
	ast: ASTNode | null;
	timing: Timing | null;
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
			return { ok: true as const, value: compile(deferredSource) };
		} catch (err) {
			return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
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
			};
		}

		if (compilation.value === null) {
			return {
				result: null,
				inputVariables: [] as InputVariable[],
				scope: null,
				ast: null,
				timing: null,
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
			};
		} catch (err) {
			return {
				result: {
					ok: false as const,
					error: err instanceof Error ? err.message : String(err),
				} as Result,
				inputVariables,
				scope: null,
				ast,
				timing: { parseMs, optimizeMs, evaluateMs: 0, totalMs: parseMs + optimizeMs },
			};
		}
	}, [compilation, overrides]);

	return { ...output, overrides, setOverride, clearOverride };
}
