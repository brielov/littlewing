/**
 * Everything the playground learns by compiling and running a program, which the
 * worker does off the page's thread. Pure apart from the clock, so it is tested
 * without a worker.
 */
import {
	compile,
	type CompileOptions,
	type Diagnostic,
	Decimal,
	EvaluationError,
	evaluate,
	generate,
	parse,
	type Program,
	run,
	type syntax,
	type TypeDescription,
} from 'littlewing';
import { FUNCTIONS, TYPES } from '../environment.ts';
import { lex, TokenKind } from '../language/tokens.ts';
import { namesTypes, typeText } from '../language/types.ts';
import type {
	Given,
	Input,
	Named,
	Outcome,
	Problem,
	Request,
	Response,
	Shown,
} from './protocol.ts';

const OPTIONS: CompileOptions = { functions: FUNCTIONS, types: TYPES };

/**
 * How many values one response may hold, and how deep, so that a program giving
 * a million elements sends a few thousand, and the page stays quick.
 */
const MAX_VALUES = 10_000;
const MAX_DEPTH = 32;
/** How much of a string is sent, in UTF-16 code units. */
const MAX_STRING = 2_000;

/** What is left of a response's room for values. */
export interface Budget {
	values: number;
}

export function budget(values = MAX_VALUES): Budget {
	return { values };
}

/** A value as plain data the panel can show, within what is left of `room`. */
export function show(value: unknown, room: Budget = budget()): Shown {
	const visit = (item: unknown, depth: number): Shown => {
		room.values--;
		if (depth > MAX_DEPTH) return { kind: 'elided' };
		// A long string costs as much room as the values its length would hold
		if (typeof item === 'string')
			room.values -= Math.floor(Math.min(item.length, MAX_STRING) / 100);
		if (item instanceof Decimal) return { kind: 'number', text: item.toString() };
		if (typeof item === 'number') return { kind: 'number', text: String(item) };
		if (typeof item === 'string') {
			if (item.length <= MAX_STRING) return { kind: 'string', value: item };
			// Cut where a code point starts, so no half of one is left
			const end = /[\uDC00-\uDFFF]/.test(item[MAX_STRING] ?? '') ? MAX_STRING - 1 : MAX_STRING;
			return { kind: 'string', value: item.slice(0, end), more: item.length - end };
		}
		if (typeof item === 'boolean') return { kind: 'boolean', value: item };
		if (item instanceof Temporal.PlainDate) return { kind: 'date', text: item.toString() };
		if (item instanceof Temporal.PlainTime) return { kind: 'time', text: item.toString() };
		if (item instanceof Temporal.PlainDateTime) return { kind: 'datetime', text: item.toString() };
		if (Array.isArray(item)) {
			const items: Shown[] = [];
			for (const element of item) {
				if (room.values <= 0) break;
				items.push(visit(element, depth + 1));
			}
			return { kind: 'array', items, more: item.length - items.length };
		}
		// A record has no prototype, and a host's own value has one
		if (typeof item === 'object' && item !== null && Object.getPrototypeOf(item) === null) {
			const entries = Object.entries(item);
			const fields: (readonly [string, Shown])[] = [];
			for (const [name, field] of entries) {
				if (room.values <= 0) break;
				fields.push([name, visit(field, depth + 1)]);
			}
			return { kind: 'record', fields, more: entries.length - fields.length };
		}
		return { kind: 'other', text: String(item) };
	};
	return visit(value, 0);
}

/** A value typed into the panel, as the program takes it. */
export function decode(given: Given): unknown {
	switch (given.kind) {
		case 'number':
			// The language writes `1_000`, and so may what is typed
			return Decimal.from(given.text.replaceAll('_', ''));
		case 'string':
		case 'boolean':
			return given.value;
		case 'date':
			return Temporal.PlainDate.from(given.text);
		case 'time':
			return Temporal.PlainTime.from(given.text);
		case 'datetime':
			return Temporal.PlainDateTime.from(given.text);
		case 'expression':
			return run(given.source, { ...OPTIONS, numbers: 'decimal' });
	}
}

/**
 * Whether a value typed for an input still fits it, which an edit to the program
 * can change. An expression is checked when the program runs.
 */
function fits(given: Given, type: TypeDescription): boolean {
	switch (given.kind) {
		case 'number':
		case 'string':
		case 'boolean':
			return type.kind === given.kind;
		case 'date':
		case 'time':
		case 'datetime':
			return type.kind === 'abstract' && type.name === given.kind;
		case 'expression':
			return true;
	}
}

/**
 * Whether a value an expression gave has `type`, as far as the program will
 * check it, so that one that does not is set aside before the run, by name.
 */
export function conforms(value: unknown, type: TypeDescription): boolean {
	switch (type.kind) {
		case 'number':
			return value instanceof Decimal;
		case 'string':
			return typeof value === 'string';
		case 'boolean':
			return typeof value === 'boolean';
		case 'array':
			return Array.isArray(value) && value.every((element) => conforms(element, type.element));
		case 'record': {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
			if (Object.getPrototypeOf(value) !== null) return false;
			const record = value as Record<string, unknown>;
			for (const [name, field] of Object.entries(type.fields)) {
				if (!(name in record)) {
					if (field.required) return false;
				} else if (!conforms(record[name], field.type)) return false;
			}
			for (const name of Object.keys(record)) {
				if (name in type.fields) continue;
				if (type.uniform !== undefined ? !conforms(record[name], type.uniform) : !type.open)
					return false;
			}
			return true;
		}
		case 'abstract':
			if (type.name === 'date') return value instanceof Temporal.PlainDate;
			if (type.name === 'time') return value instanceof Temporal.PlainTime;
			if (type.name === 'datetime') return value instanceof Temporal.PlainDateTime;
			return true;
		case 'generic': {
			// What the classes it is in allow, of the ones a typed value can miss
			const dated =
				value instanceof Temporal.PlainDate ||
				value instanceof Temporal.PlainTime ||
				value instanceof Temporal.PlainDateTime;
			const scalar = value instanceof Decimal || typeof value === 'string' || dated;
			const classes = type.classes ?? [];
			if (classes.includes('ordered') && !scalar) return false;
			if (classes.includes('showable') && !(scalar || typeof value === 'boolean')) return false;
			return true;
		}
	}
}

/** A value to start a required input from, so that a program runs as soon as it is typed. */
function starting(type: TypeDescription): unknown {
	switch (type.kind) {
		case 'number':
			return Decimal.from(0);
		case 'string':
			return '';
		case 'boolean':
			return false;
		case 'array':
			return [];
		case 'abstract':
			if (type.name === 'date') return Temporal.Now.plainDateISO();
			if (type.name === 'time') return Temporal.Now.plainTimeISO().round('second');
			if (type.name === 'datetime') return Temporal.Now.plainDateTimeISO().round('second');
			return undefined;
		default:
			return undefined;
	}
}

/** A `?=` default as the panel shows it in its control. */
function defaultOf(type: TypeDescription, value: string | boolean | undefined): Given | undefined {
	if (value === undefined) return undefined;
	if (typeof value === 'boolean') return { kind: 'boolean', value };
	return type.kind === 'number' ? { kind: 'number', text: value } : { kind: 'string', value };
}

/** What went wrong in host code, which is here the library's own functions. */
function withCause(code: string, message: string, cause: unknown): string {
	return code === 'host-error' && cause instanceof Error ? `${message}: ${cause.message}` : message;
}

function toProblem(diagnostic: Diagnostic): Problem {
	const { cause, code, end, message, severity, start } = diagnostic;
	return { code, message: withCause(code, message, cause), severity, from: start, to: end };
}

interface Variables {
	readonly variables: Record<string, unknown>;
	/** Values typed that could not be used, and why. */
	readonly rejected: { name: string; message: string }[];
}

/**
 * What the program runs on: what was typed, if it can be used, or else what a
 * required input starts from. A value typed for what the input was before an
 * edit is dropped quietly, and one that cannot be read is reported.
 */
function variablesFor(program: Program, given: Readonly<Record<string, Given>>): Variables {
	const variables = Object.create(null) as Record<string, unknown>;
	const rejected: { name: string; message: string }[] = [];
	for (const [name, input] of Object.entries(program.inputs)) {
		const typed = given[name];
		let value: unknown;
		if (typed !== undefined && fits(typed, input.type)) {
			try {
				const decoded = decode(typed);
				if (typed.kind !== 'expression' || conforms(decoded, input.type)) value = decoded;
				else rejected.push({ name, message: `Not a value of type ${typeText(input.type)}` });
			} catch (error) {
				rejected.push({ name, message: error instanceof Error ? error.message : String(error) });
			}
		}
		value ??= input.required ? starting(input.type) : undefined;
		if (value !== undefined) variables[name] = value;
	}
	return { variables, rejected };
}

/**
 * The program with its last statement bound to a fresh name, and a record of
 * every top-level name after it, so that one run gives the result and the value
 * of each binding. Offsets past where the binding goes move by its length.
 */
function withScope(
	source: string,
	program: syntax.Program,
	names: readonly string[],
): { text: string; result: string; at: number; shift: number } | undefined {
	const last = program.statements.at(-1);
	if (last === undefined || last.kind === 'binding') return undefined;

	const tokens = lex(source).filter((token) => token.kind !== 'comment');
	const words = new Set(
		tokens.filter((t) => t.kind === TokenKind.Identifier).map((t) => source.slice(t.from, t.to)),
	);
	let result = 'result';
	for (let n = 2; words.has(result); n++) result = `result${n}`;

	// The statement starts at its outer parentheses, which its node leaves out
	let index = tokens.findIndex((token) => token.from === last.start);
	while (index > 0 && tokens[index - 1]!.kind === TokenKind.LParen) index--;
	const at = tokens[index]?.from ?? last.start;

	const binding = `${result} = `;
	const record = [...names, result].join(', ');
	const text = `${source.slice(0, at)}${binding}${source.slice(at)}\n{ ${record} }`;
	return { text, result, at, shift: binding.length };
}

/** The type of each top-level name, from the statements the parser could read. */
function readableTypes(source: string): Map<string, TypeDescription> | undefined {
	const { program, diagnostics } = parse(source);
	const readable = diagnostics.length === 0 ? source : generate(program);
	return namesTypes(readable, bindingNames(program), OPTIONS);
}

function bindingNames(program: syntax.Program): string[] {
	const names = new Set<string>();
	for (const statement of program.statements) {
		if (statement.kind === 'binding') names.add(statement.name);
	}
	return [...names];
}

/**
 * What a failure says, with its place in `source` if it has one. `place` maps an
 * offset in the program that ran to one in the source.
 */
function failure(
	error: unknown,
	source: string,
	place: (offset: number) => number = (offset) => offset,
): { outcome: Outcome; problem: Problem | undefined } {
	if (!(error instanceof EvaluationError)) {
		const message = error instanceof Error ? error.message : String(error);
		return { outcome: { ok: false, message, code: 'host-error' }, problem: undefined };
	}
	const { cause, code } = error;
	const message = withCause(code, error.message, cause);
	// Offsets of 0 mean the failure is not in the source, as with a missing input
	const [from, to] = [place(error.start), place(error.end)];
	const located = (error.start !== 0 || error.end !== 0) && from <= to && to <= source.length;
	const problem: Problem | undefined = located
		? { code, message, severity: 'error', from, to }
		: undefined;
	return { outcome: { ok: false, message, code }, problem };
}

/**
 * Compile and run a program. `compiled` is told what compiling found before the
 * program runs, which a program that runs long would otherwise hold back.
 *
 * Values given as expressions are checked against their inputs' types before the
 * run, and if one still does not fit, the program runs again without them, so a
 * value typed into the panel never stops the program, only itself.
 */
export function analyze(
	request: Request,
	compiled: (response: Response) => void = () => {},
): Response {
	const response = analyzeWith(request, compiled);
	const { outcome } = response;
	const expressions = Object.entries(request.given).filter(
		([name, given]) =>
			given.kind === 'expression' && !response.rejected.some((r) => r.name === name),
	);
	if (outcome?.ok !== false || outcome.code !== 'invalid-input' || expressions.length === 0) {
		return response;
	}
	const given = Object.fromEntries(
		Object.entries(request.given).filter(([, value]) => value.kind !== 'expression'),
	);
	const again = analyzeWith({ ...request, given }, () => {});
	// What was set aside before still was, and why, as were these now
	const before = response.rejected.filter(
		({ name }) => !again.rejected.some((r) => r.name === name),
	);
	const rejected = expressions.map(([name]) => ({ name, message: outcome.message }));
	return { ...again, rejected: [...again.rejected, ...before, ...rejected] };
}

function analyzeWith(
	{ id, source, given }: Request,
	compiled: (response: Response) => void = () => {},
): Response {
	const base = { id, source, rejected: [], inputs: undefined, outcome: undefined, scope: [] };
	if (source.trim() === '') {
		return { ...base, phase: 'done', problems: [], types: [], timing: undefined };
	}

	const compileStart = performance.now();
	const result = compile(source, OPTIONS);
	const problems = result.diagnostics.map(toProblem);

	if (!result.ok) {
		// Running out of budget is about the whole program, and no place in it
		const limit = result.diagnostics.find((d) => d.code === 'limit-exceeded');
		const outcome: Outcome | undefined = limit && {
			ok: false,
			message: limit.message,
			code: limit.code,
		};
		const types = readableTypes(source);
		return {
			...base,
			phase: 'done',
			problems: problems.filter((p) => p.code !== 'limit-exceeded'),
			outcome,
			types: types && [...types],
			timing: { compileMs: performance.now() - compileStart, evaluateMs: 0 },
		};
	}

	const { program } = result;
	const tree = parse(source).program;
	const names = bindingNames(tree);
	// Each `?=` input with the source of its default, which says when it is the same one
	const defaulted = new Map(
		tree.statements.flatMap((s) =>
			s.kind === 'binding' && s.input
				? [[s.name, source.slice(s.value.start, s.value.end)] as const]
				: [],
		),
	);
	const scoped = withScope(source, tree, names);
	const augmented = scoped && compile(scoped.text, OPTIONS);

	// The types of the names, from the record after the program, or else asked for
	let types: Map<string, TypeDescription> | undefined;
	if (augmented?.ok === true && augmented.program.output.kind === 'record') {
		const { fields } = augmented.program.output;
		types = new Map();
		for (const [name, input] of Object.entries(program.inputs)) types.set(name, input.type);
		for (const name of names) {
			const field = fields[name];
			if (field !== undefined) types.set(name, field.type);
		}
	} else {
		types = readableTypes(source);
	}
	const compileMs = performance.now() - compileStart;

	const inputsWith = (current: (name: string) => Shown | undefined): Input[] =>
		Object.entries(program.inputs).map(([name, input]) => ({
			name,
			type: input.type,
			required: input.required,
			defaulted: defaulted.has(name),
			defaultSource: defaulted.get(name),
			default: defaultOf(input.type, input.default),
			current: current(name),
		}));

	const { variables, rejected } = variablesFor(program, given);
	compiled({
		...base,
		phase: 'compiled',
		problems,
		rejected,
		inputs: inputsWith(() => undefined),
		types: types && [...types],
		timing: { compileMs, evaluateMs: 0 },
	});

	const options = { variables, numbers: 'decimal' } as const;
	let evaluateMs = 0;
	/** The response, with the values a run gave, the result's first as it matters most. */
	const finish = (
		outcome: Outcome | { ok: true; raw: unknown },
		values: Record<string, unknown> | undefined,
		problem: Problem | undefined,
	): Response => {
		const room = budget();
		const shown: Outcome =
			'raw' in outcome
				? { ok: true, value: show(outcome.raw, room), type: program.output }
				: outcome;
		const value = (name: string) =>
			values !== undefined && name in values ? show(values[name], room) : undefined;
		// An input shows what the program ran with: its default, or what it was given
		const inputs = inputsWith((name) =>
			defaulted.has(name)
				? value(name)
				: name in variables
					? show(variables[name], room)
					: undefined,
		);
		const scope: Named[] = names.map((name) => ({
			name,
			type: types?.get(name),
			value: value(name),
		}));
		return {
			...base,
			phase: 'done',
			problems: problem === undefined ? problems : [...problems, problem],
			rejected,
			inputs,
			outcome: shown,
			scope,
			types: types && [...types],
			timing: { compileMs, evaluateMs },
		};
	};

	// One run gives the result and every binding's value. Bindings are evaluated
	// whether read or not, so this fails where the program itself would.
	if (scoped !== undefined && augmented?.ok === true) {
		const started = performance.now();
		try {
			const record = evaluate(augmented.program, options) as Record<string, unknown>;
			evaluateMs += performance.now() - started;
			return finish({ ok: true, raw: record[scoped.result] }, record, undefined);
		} catch (error) {
			evaluateMs += performance.now() - started;
			// The record at the end costs a few steps more, so only the program itself
			// can say whether it runs out of budget
			const exhausted = error instanceof EvaluationError && error.code === 'limit-exceeded';
			if (!exhausted) {
				const { at, shift } = scoped;
				const place = (offset: number) => (offset >= at + shift ? offset - shift : offset);
				const { outcome, problem } = failure(error, source, place);
				return finish(outcome, undefined, problem);
			}
		}
	}

	// A program that ends in a binding, or one that runs out of budget, runs as it is
	const started = performance.now();
	try {
		const value = evaluate(program, options);
		evaluateMs += performance.now() - started;
		return finish({ ok: true, raw: value }, undefined, undefined);
	} catch (error) {
		evaluateMs += performance.now() - started;
		const { outcome, problem } = failure(error, source);
		return finish(outcome, undefined, problem);
	}
}
