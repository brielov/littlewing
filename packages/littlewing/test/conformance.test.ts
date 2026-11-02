import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FunctionDefinition } from '../src/define.js';
import { compile, evaluate } from '../src/compile.js';
import { Decimal } from '../src/decimal.js';
import { define, defineType, t } from '../src/define.js';
import { EvaluationError } from '../src/errors.js';

interface Case {
	readonly spec: string;
	readonly source: string;
	readonly inputs?: Record<string, unknown>;
	readonly value?: string;
	readonly error?: string;
	readonly failure?: string;
}

/** The canonical text of a value, as `conformance/README.md` defines it. */
function canonical(value: unknown): string {
	if (value instanceof Decimal) return value.toString();
	// A field carried unread comes back as it went in
	if (typeof value === 'number') return Decimal.from(value).toString();
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(', ')}]`;
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort((a, b) => {
		const first = Array.from(a);
		const second = Array.from(b);
		for (let i = 0; i < Math.min(first.length, second.length); i++) {
			const order = (first[i] as string).codePointAt(0)! - (second[i] as string).codePointAt(0)!;
			if (order !== 0) return order;
		}
		return first.length - second.length;
	});
	const fields = keys.map((key) => `${JSON.stringify(key)}: ${canonical(record[key])}`);
	return `{${fields.join(', ')}}`;
}

class Usd {
	constructor(readonly amount: Decimal) {}
}
class Opaque {}

const usd = defineType<Usd>({
	name: 'usd',
	is: (value) => value instanceof Usd,
	equals: (a, b) => a.amount.equals(b.amount),
	compare: (a, b) => a.amount.compare(b.amount),
	add: (a, b) => new Usd(a.amount.plus(b.amount)),
	subtract: (a, b) => new Usd(a.amount.minus(b.amount)),
	show: (a) => `$${a.amount.toString()}`,
});
const opaque = defineType<Opaque>({ name: 'opaque', is: (value) => value instanceof Opaque });

const HOST: Record<string, FunctionDefinition> = {
	BOOM: define({
		args: [],
		returns: t.number(),
		run: () => {
			throw new Error('It always fails');
		},
	}),
	USD: define({ args: [t.number()], returns: usd, pure: true, run: (n) => new Usd(n) }),
	CENTS: define({ args: [usd], returns: t.number(), pure: true, run: (a) => a.amount }),
	OPAQUE: define({ args: [t.number()], returns: opaque, pure: true, run: () => new Opaque() }),
};

/** What a case came to, in the form its expectation is written in. */
function outcome(testCase: Case, functions: Record<string, FunctionDefinition>): Partial<Case> {
	const result = compile(testCase.source, { functions });
	if (!result.ok) {
		const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
		const codes = new Set(errors.map((diagnostic) => diagnostic.code));
		return { error: [...codes].join(' ') };
	}
	try {
		const options = { numbers: 'decimal', limits: { maxSteps: 1e8 } } as const;
		const { inputs } = testCase;
		return { value: canonical(evaluate(result.program, { ...options, variables: inputs })) };
	} catch (error) {
		if (error instanceof EvaluationError) return { failure: error.code };
		throw error;
	}
}

const directory = join(import.meta.dir, '..', 'conformance');
const files = readdirSync(directory).filter((name) => name.endsWith('.jsonl'));

test('there are cases to run', () => {
	expect(files.length).toBeGreaterThan(0);
});

for (const file of files) {
	const lines = readFileSync(join(directory, file), 'utf8').split('\n').filter(Boolean);
	const cases = lines.map((line) => JSON.parse(line) as Case);
	const functions = file.startsWith('12-') ? HOST : {};

	describe(file, () => {
		for (const testCase of cases) {
			const name = `${testCase.spec}: ${testCase.source.slice(0, 80)}`;
			test(name, () => {
				const { value, error, failure } = testCase;
				const expected = [value, error, failure].filter((part) => part !== undefined);
				expect(expected.length).toBe(1);

				const actual = outcome(testCase, functions);
				// Each invalid program has one error, so no other code can come with it
				if (error !== undefined) expect(actual).toEqual({ error });
				else if (failure !== undefined) expect(actual).toEqual({ failure });
				else expect(actual).toEqual({ value });
			});
		}
	});
}
