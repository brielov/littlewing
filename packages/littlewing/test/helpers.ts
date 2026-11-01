import { type ASTNode, mapChildren } from '../src/ast';
import type { EvaluationError } from '../src/errors';
import { evaluate } from '../src/interpreter';
import { LimitExceededError } from '../src/limits';
import type { ExecutionContext } from '../src/types';

/**
 * Copy an AST without source offsets, for structural comparison with hand-built
 * nodes. Values pass through untouched, so `-0` and `NaN` stay distinct.
 */
export function withoutSpans<T extends ASTNode>(node: T): T {
	const { start: _start, end: _end, ...rest } = mapChildren(node, withoutSpans);
	return rest as T;
}

/**
 * The exact number of steps a program takes, found by searching for the smallest
 * budget it runs under.
 */
export function stepsOf(source: string, context: ExecutionContext = {}): number {
	const fits = (maxSteps: number): boolean => {
		try {
			evaluate(source, { ...context, limits: { maxSteps } });
			return true;
		} catch (err) {
			if ((err as EvaluationError).cause instanceof LimitExceededError) return false;
			throw err;
		}
	};
	let high = 1;
	while (!fits(high)) high *= 2;
	let low = 0;
	while (high - low > 1) {
		const middle = Math.floor((low + high) / 2);
		if (fits(middle)) high = middle;
		else low = middle;
	}
	return high;
}
