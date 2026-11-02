/**
 * Thrown (as the cause of an `EvaluationError`) when an evaluation runs out of
 * its step budget.
 */
export class LimitExceededError extends Error {
	override readonly name = 'LimitExceededError';
}

/**
 * Steps left for the running evaluation. Work is metered wherever it happens,
 * including inside operators and the library, so the budget lives here rather than
 * being threaded through every function. Evaluation is synchronous, so only a nested
 * `compile` or `evaluate` from host code can interleave, and each of those saves and
 * restores this around itself.
 */
let remaining = Number.POSITIVE_INFINITY;

/**
 * Identifies the running evaluation, for what must be kept for its length. Each
 * evaluation has its own, including one nested inside another.
 */
let evaluation: object | undefined;

export function currentEvaluation(): object | undefined {
	return evaluation;
}

/** Enter an evaluation, returning the one to go back to. */
export function setEvaluation(next: object | undefined): object | undefined {
	const previous = evaluation;
	evaluation = next;
	return previous;
}

/**
 * Install a step budget, returning the one it replaces.
 */
export function setBudget(steps: number): number {
	const previous = remaining;
	remaining = steps;
	return previous;
}

/** Steps left, for a nested evaluation to run on. */
export function remainingSteps(): number {
	return remaining;
}

/**
 * Spend `steps` from the running evaluation's budget. Outside an evaluation the
 * budget is infinite, so library functions can be called directly.
 */
export function charge(steps: number): void {
	remaining -= steps;
	if (remaining < 0) {
		throw new LimitExceededError('Evaluation exceeded its step limit');
	}
}

/**
 * Spend the step of evaluating `node`, on behalf of `owner`. Evaluation does this
 * for every node, so it records the node to blame only if the budget runs out.
 */
export function step(owner: { current: unknown }, node: unknown): void {
	remaining -= 1;
	if (remaining < 0) {
		owner.current = node;
		throw new LimitExceededError('Evaluation exceeded its step limit');
	}
}

/**
 * Spend `steps` that belong to `node`, on behalf of `owner`, as `step` does.
 */
export function stepBy(owner: { current: unknown }, node: unknown, steps: number): void {
	remaining -= steps;
	if (remaining < 0) {
		owner.current = node;
		throw new LimitExceededError('Evaluation exceeded its step limit');
	}
}

/** Use up the running budget, even one that is disabled, as a `cost` of `Infinity` does. */
export function exhaust(): never {
	remaining = -1;
	throw new LimitExceededError('Evaluation exceeded its step limit');
}

/**
 * Spend steps for reading `length` characters natively. The first read flattens
 * a lazily concatenated string, copying it and keeping the copy, so this pays
 * for time and memory alike. A character takes up to two bytes, so a step buys
 * at most 16 bytes.
 */
export function chargeRead(length: number): void {
	charge(length >>> 3);
}

/**
 * Spend the comparisons of sorting `length` elements.
 */
export function chargeSort(length: number): void {
	charge(length * Math.ceil(Math.log2(length + 1)));
}
