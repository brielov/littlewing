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

interface PipelineOutput {
	result: Result | null;
	inputVariables: InputVariable[];
	scope: Record<string, RuntimeValue> | null;
	ast: ASTNode | null;
	timing: Timing | null;
}

function runPipeline(src: string, currentOverrides: Map<string, RuntimeValue>): PipelineOutput {
	if (src.trim() === "") {
		return { result: null, inputVariables: [], scope: null, ast: null, timing: null };
	}

	try {
		const totalStart = performance.now();

		// Parse
		const parseStart = performance.now();
		const ast = parse(src);
		const parseMs = performance.now() - parseStart;

		// Extract input variables
		const inputVarNames = extractInputVariables(ast);

		// Optimize (preserving input variables as external)
		const optimizeStart = performance.now();
		const optimizedAst = optimize(ast, new Set(inputVarNames));
		const optimizeMs = performance.now() - optimizeStart;

		// Get default values via scope evaluation
		const defaultScope = evaluateScope(optimizedAst, defaultContext);
		const inputVariables: InputVariable[] = inputVarNames
			.filter((name) => name in defaultScope)
			.map((name) => ({
				name,
				type: typeOf(defaultScope[name] as RuntimeValue),
				defaultValue: defaultScope[name] as RuntimeValue,
			}));

		// Build context with overrides
		const overrideVariables: Record<string, RuntimeValue> = {};
		for (const [name, value] of currentOverrides) {
			overrideVariables[name] = value;
		}

		const mergedContext = {
			...defaultContext,
			variables: overrideVariables,
		};

		// Evaluate (use evaluateScope to get both result and full scope)
		const evaluateStart = performance.now();
		const value = evaluate(optimizedAst, mergedContext);
		const scope = evaluateScope(optimizedAst, mergedContext);
		const evaluateMs = performance.now() - evaluateStart;

		const totalMs = performance.now() - totalStart;

		return {
			result: { ok: true, value },
			inputVariables,
			scope,
			ast,
			timing: { parseMs, optimizeMs, evaluateMs, totalMs },
		};
	} catch (err) {
		return {
			result: {
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			},
			inputVariables: [],
			scope: null,
			ast: null,
			timing: null,
		};
	}
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

	const { result, inputVariables, scope, ast, timing } = useMemo(
		() => runPipeline(deferredSource, overrides),
		[deferredSource, overrides],
	);

	return { result, inputVariables, overrides, scope, ast, timing, setOverride, clearOverride };
}
