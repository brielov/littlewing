// Runs the built package on Node, whose engine differs from the one `bun test`
// uses: no tail calls, a smaller stack, its own heap limit.
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

// Use the engine's Temporal where it has one
globalThis.Temporal ??= Temporal;

const {
	DEFAULT_MAX_STEPS,
	EvaluationError,
	LimitExceededError,
	defaultContext,
	evaluate,
	generate,
	optimize,
	parse,
} = await import('littlewing');

// Semantics reach the published entry point
assert.equal(evaluate('8 / -2 * 4'), -16);
assert.equal(evaluate('a = 5; -1'), -1);
assert.equal(evaluate('LEN("a😀b")', defaultContext), 3);
assert.ok(DEFAULT_MAX_STEPS > 0);

// Dates work on whichever Temporal this is
assert.equal(evaluate('YEAR(DATE(2024, 1, 2))', defaultContext), 2024);

// A long run of separators must not recurse
assert.equal(evaluate(`1${';'.repeat(1_000_000)}`), 1);

// The deepest trees the parser accepts must get through every recursive pass
const deepest = [
	`1${'+1'.repeat(1023)}`,
	`${'-'.repeat(255)}1`,
	`${'['.repeat(255)}${']'.repeat(255)}`,
	`${'('.repeat(255)}1${')'.repeat(255)}`,
	`${'1 |> ABS(?, '.repeat(254)}1${')'.repeat(254)}`,
];
for (const source of deepest) {
	const node = parse(source);
	generate(node);
	optimize(node);
}
evaluate(deepest[0]);

// A budget stops a program, however it spends it, with an error a host can catch
const limits = { maxSteps: 100_000 };
for (const source of [
	'for i in 0..22 into a = [1] then a + a',
	'for i in 0..1000 then for j in 0..1000 then [0]',
	'a = for i in 0..60 into a = [1] then [a, a]\nLEN(ARR_UNIQUE(a))',
]) {
	assert.throws(
		() => evaluate(source, { ...defaultContext, limits }),
		(err) => err instanceof EvaluationError && err.cause instanceof LimitExceededError,
	);
}

console.log('package smoke test passed');
