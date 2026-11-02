// Runs the built package on Node, whose engine differs from the one `bun test`
// uses: no tail calls, a smaller stack, its own heap limit, and strings it flattens
// at other moments.
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';

// Use the engine's Temporal where it has one
globalThis.Temporal ??= Temporal;

const {
	CompileError,
	Decimal,
	EvaluationError,
	compile,
	define,
	defineType,
	evaluate,
	ParseError,
	coreFunctions,
	describeFunction,
	generate,
	once,
	parse,
	run,
	t,
	toLineColumn,
} = await import('littlewing');
const std = await import('littlewing/std');
const temporal = await import('littlewing/temporal');
const { date, temporalFunctions } = temporal;
const clock = await import('littlewing/clock');

// Each entry point exports what HOST_API section 1 says, and nothing else
assert.deepEqual(Object.keys(await import('littlewing')).sort(), [
	'CompileError',
	'Decimal',
	'EvaluationError',
	'ParseError',
	'compile',
	'coreFunctions',
	'define',
	'defineType',
	'describeFunction',
	'evaluate',
	'generate',
	'once',
	'parse',
	'run',
	't',
	'toLineColumn',
]);
assert.deepEqual(Object.keys(std).sort(), [
	'ABS',
	'CLAMP',
	'COS',
	'ENDS_WITH',
	'EXP',
	'FLAT',
	'LOG',
	'LOG10',
	'MAX',
	'MIN',
	'REPEAT',
	'REVERSE',
	'SIN',
	'SQRT',
	'STARTS_WITH',
	'SUM',
	'TAN',
	'UNIQUE',
]);
assert.deepEqual(Object.keys(clock).sort(), ['NOW', 'NOW_TIME', 'TODAY']);
const TEMPORAL_FUNCTIONS = [
	'ADD',
	'AGE',
	'COMBINE',
	'DATE',
	'DATETIME',
	'DAY',
	'DAY_OF_YEAR',
	'DIFF',
	'END_OF',
	'HOUR',
	'IS_LEAP_YEAR',
	'IS_SAME_DAY',
	'IS_WEEKEND',
	'MILLISECOND',
	'MINUTE',
	'MONTH',
	'QUARTER',
	'SECOND',
	'START_OF',
	'TIME',
	'TO_DATE',
	'TO_TIME',
	'WEEKDAY',
	'YEAR',
];
assert.deepEqual(Object.keys(temporalFunctions).sort(), TEMPORAL_FUNCTIONS);
assert.deepEqual(
	Object.keys(temporal).sort(),
	[...TEMPORAL_FUNCTIONS, 'date', 'datetime', 'temporalFunctions', 'time'].sort(),
);

// Semantics reach the published entry point
assert.equal(run('8 / -2 * 4'), -16);
assert.equal(run('0.1 + 0.2'), 0.3);
assert.equal(run('a = 5; -1'), -1);
assert.equal(run('LEN("a😀b")'), 3);
assert.equal(String(run('1 / 3', { numbers: 'decimal' })), '0.3333333333333333333333333333333333');

// The other entry points work, and together
assert.equal(run('ABS(-1)', { functions: std }), 1);
assert.equal(run('YEAR(DATE(2024, 1, 2))', { functions: temporalFunctions }), 2024);
assert.equal(
	run('a < b', {
		inputs: { a: date, b: date },
		variables: {
			a: Temporal.PlainDate.from('2024-01-01'),
			b: Temporal.PlainDate.from('2024-01-02'),
		},
	}),
	true,
);
assert.ok(run('TODAY()', { functions: clock }) instanceof Temporal.PlainDate);

// A compiled program says what it needs, and runs many times
const compiled = compile('price * quantity');
assert.ok(compiled.ok);
assert.deepEqual(Object.keys(compiled.program.inputs), ['price', 'quantity']);
assert.equal(evaluate(compiled.program, { variables: { price: 2, quantity: 3 } }), 6);
assert.equal(evaluate(compiled.program, { variables: { price: 5, quantity: 3 } }), 15);

// A host's function and type cross the boundary
class Money {
	constructor(cents) {
		this.cents = cents;
	}
}
const money = defineType({
	name: 'money',
	is: (value) => value instanceof Money,
	add: (a, b) => new Money(a.cents + b.cents),
});
const USD = define({ args: [t.number()], returns: money, run: (n) => new Money(n.toNumber()) });
assert.equal(run('USD(1) + USD(2)', { functions: { USD } }).cents, 3);

// A long run of separators must not recurse
assert.equal(run(`1${';'.repeat(1_000_000)}`), 1);

// The deepest trees the parser accepts must get through every recursive pass
const deepest = [
	`1${'+1'.repeat(1023)}`,
	`${'-'.repeat(255)}1`,
	`${'['.repeat(255)}1${']'.repeat(255)}`,
	`${'('.repeat(255)}1${')'.repeat(255)}`,
	`${'1 |> ROUND(?, '.repeat(254)}1${')'.repeat(254)}`,
];
for (const source of deepest) {
	const tree = parse(source);
	assert.equal(typeof generate(tree), 'string');
	const result = compile(source);
	assert.ok(result.ok, source.slice(0, 20));
	evaluate(result.program);
}

// A budget stops a program, however it spends it, with an error a host can catch
const limits = { maxSteps: 100_000 };
for (const source of [
	'for i in 0..22 into a = [1] then a + a',
	'for i in 0..1000 then for j in 0..1000 then [0]',
	'x = for i in 0..60 into a = [[]] then a + a\nLEN(x)',
	'x = "a" + "b"\nfor i in 0..100000 into s = x then s + s',
]) {
	const result = compile(source);
	assert.ok(result.ok, source);
	assert.throws(
		() => evaluate(result.program, { limits }),
		(err) => err instanceof EvaluationError && err.code === 'limit-exceeded',
	);
}

// Reading a string costs what flattening it does, which this engine does here. An
// input keeps the optimizer from answering all of this at compile time.
const rope = compile(
	`x = REPEAT(s, 1000000)
for i in 0..100000 into n = 0 then if STARTS_WITH(x + "b", "a") then n + 1 else n`,
	{ functions: std, inputs: { s: t.string() } },
);
assert.ok(rope.ok);
assert.throws(
	() => evaluate(rope.program, { variables: { s: 'a' } }),
	(err) => err instanceof EvaluationError && err.code === 'limit-exceeded',
);

// A definition describes itself, for an editor
assert.equal(describeFunction(coreFunctions.ROUND).overloads[0].args[1].name, 'digits');
assert.equal(describeFunction(std.ABS).doc, 'The number without its sign');

// Mistakes come back the way each stage promises
assert.throws(
	() => run('1 +'),
	(err) => err instanceof CompileError,
);
assert.throws(() => Decimal.from('not a number'), EvaluationError);
assert.throws(() => parse('1 +'), ParseError);
assert.deepEqual(toLineColumn('a\nb', 2), { line: 2, column: 1 });

// One reading per evaluation, on this engine's module instance too
let readings = 0;
const reading = once(() => ++readings);
const READ = define({ args: [], returns: t.number(), run: () => reading() });
assert.equal(run('READ() + READ()', { functions: { READ } }), 2);

console.log('package smoke test passed');
