import type { Decimal } from './decimal.js';
import { currentEvaluation } from './limits.js';

/** The classes of language section 6.2. */
export type TypeClass =
	| 'addable'
	| 'subtractable'
	| 'ordered'
	| 'equatable'
	| 'showable'
	| 'convertible'
	| 'sized'
	| 'indexable';

const CLASSES: ReadonlySet<string> = new Set<TypeClass>([
	'addable',
	'subtractable',
	'ordered',
	'equatable',
	'showable',
	'convertible',
	'sized',
	'indexable',
]);

/**
 * A type of the language, as a host writes it. `In` is what `run` receives and
 * `Out` is what it may return. They differ for numbers: a `Decimal` arrives, and
 * a `Decimal` or a JS number can go back.
 */
export interface Type<In = unknown, Out = In> {
	readonly kind: string;
	/** A name for the parameter, for tooling. */
	readonly label: string | undefined;
	/** Only here for inference. There is no such property at run time. */
	readonly __in?: In;
	readonly __out?: Out;
}

/** An optional field, or an optional trailing argument. */
export interface Optional<T extends Type = Type> {
	readonly kind: 'optional';
	readonly type: T;
}

type InOf<T> = T extends Type<infer In, unknown> ? In : never;
type OutOf<T> = T extends Type<unknown, infer Out> ? Out : never;

/** The shape of the fields of a record type, as written in `t.record`. */
export type Fields = Readonly<Record<string, Type | Optional>>;

type RequiredKeys<F> = { [K in keyof F]: F[K] extends Optional ? never : K }[keyof F];
type OptionalKeys<F> = { [K in keyof F]: F[K] extends Optional ? K : never }[keyof F];

/** One object type rather than an intersection, which would accept almost anything. */
type Flat<T> = { [K in keyof T]: T[K] } & object;

type RecordIn<F> = Flat<
	{ readonly [K in RequiredKeys<F>]: InOf<F[K]> } & {
		readonly [K in OptionalKeys<F>]?: F[K] extends Optional<infer T> ? InOf<T> : never;
	}
>;

/** A key whose value is `undefined` is absent, so an optional field can be one. */
type RecordOut<F> = Flat<
	{ readonly [K in RequiredKeys<F>]: OutOf<F[K]> } & {
		readonly [K in OptionalKeys<F>]?: F[K] extends Optional<infer T> ? OutOf<T> | undefined : never;
	}
>;

/**
 * An abstract type: a type itself, and callable with a name for a parameter, as
 * in `money` and `money('price')`.
 */
export interface AbstractType<T = unknown> extends Type<T, T> {
	readonly kind: 'abstract';
	readonly definition: AbstractDefinition<T>;
	(label: string): Type<T, T>;
}

/** What makes up an abstract type: language section 9. */
export interface AbstractDefinition<T = unknown> {
	/** Its name in the schema and in messages. */
	readonly name: string;
	/** Whether a host value belongs to it. It receives any value, including `null`. */
	readonly is: (value: unknown) => boolean;
	/** Enables `==` and `!=`. */
	equals?(a: T, b: T): boolean;
	/** Enables `<`, `>`, `<=`, `>=` and sorting. */
	compare?(a: T, b: T): number;
	/** Enables `+`. */
	add?(a: T, b: T): T;
	/** Enables binary `-`. */
	subtract?(a: T, b: T): T;
	/** Enables `STR` and interpolation. */
	show?(a: T): string;
}

/** The types with structure, which the checker reads. */
export type TypeNode =
	| { readonly kind: 'number' | 'string' | 'boolean'; readonly label: string | undefined }
	| { readonly kind: 'array'; readonly element: Type; readonly label: string | undefined }
	| {
			readonly kind: 'record';
			readonly fields: Fields;
			readonly open: boolean;
			readonly label: string | undefined;
	  }
	| { readonly kind: 'uniform'; readonly value: Type; readonly label: string | undefined }
	| {
			readonly kind: 'var';
			readonly variable: string;
			readonly typeClass: TypeClass | undefined;
			readonly label: string | undefined;
	  }
	| {
			readonly kind: 'oneOf';
			readonly values: readonly string[];
			readonly label: string | undefined;
	  }
	| {
			readonly kind: 'abstract';
			readonly definition: AbstractDefinition;
			readonly label: string | undefined;
	  };

export interface TypeBuilders {
	number(label?: string): Type<Decimal, Decimal | number>;
	string(label?: string): Type<string>;
	boolean(label?: string): Type<boolean>;
	array<T extends Type>(element: T, label?: string): Type<readonly InOf<T>[], readonly OutOf<T>[]>;
	/** A closed record: exactly these fields, and any of the optional ones. */
	record<const F extends Fields>(fields: F, label?: string): Type<RecordIn<F>, RecordOut<F>>;
	/** A record with these fields, and possibly others. */
	openRecord<const F extends Fields>(
		fields: F,
		label?: string,
	): Type<RecordIn<F> & Readonly<Record<string, unknown>>, RecordOut<F>>;
	/** A record whose fields, whatever they are, all have one type. */
	uniformRecord<T extends Type>(
		value: T,
		label?: string,
	): Type<Readonly<Record<string, InOf<T>>>, Readonly<Record<string, OutOf<T> | undefined>>>;
	/** A type variable. Each name is one variable, per signature. */
	var(variable: string, label?: string): Type;
	/** A type variable in a class of language section 6.2. */
	class(typeClass: TypeClass, variable: string, label?: string): Type;
	/** A parameter that accepts only these strings. */
	oneOf<const V extends readonly string[]>(values: V, label?: string): Type<V[number]>;
	/** An optional field, or an optional trailing argument. */
	optional<T extends Type>(type: T): Optional<T>;
}

/** Everything `t` and `defineType` made, so nothing else passes for a type. */
const madeTypes = new WeakSet<object>();

function made<T extends object>(type: T): T {
	madeTypes.add(type);
	return type;
}

function node(fields: Record<string, unknown>, label: string | undefined): Type {
	if (label !== undefined && typeof label !== 'string') {
		throw new TypeError('A label must be a string');
	}
	return made(Object.freeze({ ...fields, label })) as unknown as Type;
}

function variableNode(
	variable: string,
	typeClass: TypeClass | null | undefined,
	label: string | undefined,
): Type {
	if (typeof variable !== 'string') throw new TypeError('A type variable needs a name');
	return node({ kind: 'var', variable, typeClass }, label);
}

/** Read a list once, by index, whatever its iterator or methods claim. */
function copyList<T>(list: readonly T[]): T[] {
	const copy: T[] = [];
	const { length } = list;
	for (let i = 0; i < length; i++) {
		const item = list[i];
		// Never valid in any list, and it stops a huge sparse array at its first hole
		if (item === undefined) throw new TypeError('A list has a hole');
		copy.push(item);
	}
	return copy;
}

function copyFields<F extends Fields>(fields: F): F {
	const prototype: unknown = Object.getPrototypeOf(fields);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError('Fields must be a plain object');
	}
	const copy = Object.create(null) as Record<string, Type | Optional>;
	for (const key of Object.keys(fields)) copy[key] = fields[key] as Type | Optional;
	return Object.freeze(copy) as F;
}

function oneOfNode(values: readonly string[], label: string | undefined): Type {
	if (!Array.isArray(values)) throw new TypeError('t.oneOf needs a list of strings');
	const copy = copyList(values);
	if (copy.some((value) => typeof value !== 'string')) {
		throw new TypeError('t.oneOf needs a list of strings');
	}
	return node({ kind: 'oneOf', values: Object.freeze(copy) }, label);
}

export const t: TypeBuilders = Object.freeze<TypeBuilders>({
	number: (label) => node({ kind: 'number' }, label) as Type<Decimal, Decimal | number>,
	string: (label) => node({ kind: 'string' }, label) as Type<string>,
	boolean: (label) => node({ kind: 'boolean' }, label) as Type<boolean>,
	array: (element, label) => node({ kind: 'array', element }, label) as never,
	record: (fields, label) =>
		node({ kind: 'record', fields: copyFields(fields), open: false }, label) as never,
	openRecord: (fields, label) =>
		node({ kind: 'record', fields: copyFields(fields), open: true }, label) as never,
	uniformRecord: (value, label) => node({ kind: 'uniform', value }, label) as never,
	var: (variable, label) => variableNode(variable, undefined, label),
	// Anything missing here is a mistake, and must not read as a plain variable
	class: (typeClass, variable, label) => variableNode(variable, typeClass ?? null, label),
	oneOf: (values, label) => oneOfNode(values, label) as never,
	optional: (type) => made(Object.freeze({ kind: 'optional', type })),
});

/** Where a type is written, which decides what it can be. */
type Position = 'parameter' | 'optional parameter' | 'field' | 'inner';

/** The deepest type: language section 11. */
const MAX_TYPE_DEPTH = 256;

/** What is known while checking one signature. */
interface SignatureCheck {
	/** Each variable name is one variable, with one class. */
	readonly variables: Map<string, TypeClass | undefined>;
	/**
	 * The depth of each container seen. A container's children have one position
	 * however it is reached, and types can share parts exponentially often.
	 */
	readonly depths: Map<object, number>;
}

function newCheck(): SignatureCheck {
	return { variables: new Map(), depths: new Map() };
}

function isType(value: unknown): value is { readonly kind: string } {
	return (
		(typeof value === 'object' || typeof value === 'function') && madeTypes.has(value as object)
	);
}

function checkVariable(
	variable: string,
	typeClass: TypeClass | null | undefined,
	check: SignatureCheck,
): void {
	if (typeClass !== undefined && (typeClass === null || !CLASSES.has(typeClass))) {
		throw new TypeError(`Unknown type class: ${String(typeClass)}`);
	}
	const { variables } = check;
	if (variables.has(variable) && variables.get(variable) !== typeClass) {
		throw new TypeError(`Type variable ${variable} is used with two different classes`);
	}
	variables.set(variable, typeClass);
}

/** Check a type written at `position`, `level` deep, and give its depth. */
function checkType(
	type: unknown,
	position: Position,
	level: number,
	check: SignatureCheck,
): number {
	if (!isType(type)) throw new TypeError('Expected a type made with t');
	if (level > MAX_TYPE_DEPTH) throw new TypeError('Type is too deep');

	const shape = type as TypeNode | Optional;
	switch (shape.kind) {
		case 'optional':
			if (position !== 'parameter' && position !== 'field') {
				throw new TypeError('t.optional is only valid on a field or a trailing argument');
			}
			return checkType(
				shape.type,
				position === 'field' ? 'inner' : 'optional parameter',
				level,
				check,
			);
		case 'oneOf':
			if (position !== 'parameter' && position !== 'optional parameter') {
				throw new TypeError('t.oneOf is only valid as a parameter');
			}
			return 1;
		case 'var':
			checkVariable(shape.variable, shape.typeClass, check);
			return 1;
		case 'array':
		case 'uniform':
		case 'record': {
			const known = check.depths.get(shape);
			if (known !== undefined) {
				if (level + known - 1 > MAX_TYPE_DEPTH) throw new TypeError('Type is too deep');
				return known;
			}
			let depth = 0;
			if (shape.kind === 'array') {
				depth = checkType(shape.element, 'inner', level + 1, check);
			} else if (shape.kind === 'uniform') {
				depth = checkType(shape.value, 'inner', level + 1, check);
			} else {
				for (const field of Object.values(shape.fields)) {
					depth = Math.max(depth, checkType(field, 'field', level + 1, check));
				}
			}
			check.depths.set(shape, depth + 1);
			return depth + 1;
		}
		default:
			return 1;
	}
}

/**
 * Check the types a host declares for inputs, which are one signature. Neither
 * `t.optional` nor `t.oneOf` means anything there.
 */
export function checkInputTypes(inputs: Readonly<Record<string, Type>>): void {
	const check = newCheck();
	for (const name of Object.keys(inputs)) checkType(inputs[name], 'inner', 1, check);
}

/** One way to call a function. */
export interface Signature {
	readonly args: readonly (Type | Optional)[];
	readonly returns: Type;
}

/** Copy a signature and check the copy, so that what is stored is what was checked. */
function checkedSignature(signature: Signature): Signature {
	const { args, returns } = signature;
	if (!Array.isArray(args)) throw new TypeError('A function needs a list of args');

	const copy = copyList(args);
	const check = newCheck();
	let optional = false;
	for (const arg of copy) {
		const isOptional = isType(arg) && arg.kind === 'optional';
		if (optional && !isOptional) {
			throw new TypeError('A required parameter cannot follow an optional one');
		}
		optional = isOptional;
		checkType(arg, 'parameter', 1, check);
	}
	checkType(returns, 'inner', 1, check);
	return Object.freeze({ args: Object.freeze(copy), returns });
}

type ParameterIn<T> = T extends Optional<infer Inner> ? InOf<Inner> | undefined : InOf<T>;

/** What `run` receives, from the types of `args`. */
export type ArgumentsOf<A extends readonly (Type | Optional)[]> = {
	-readonly [K in keyof A]: ParameterIn<A[K]>;
};

type At<U, I extends string> = U extends readonly unknown[]
	? I extends keyof U
		? U[I]
		: undefined
	: never;

/**
 * Tuples of different lengths, as one list by position. A rest parameter of a
 * union of them would accept no fixed list of parameters at all, and a position
 * an overload does not reach is `undefined`, as it is at run time.
 */
type Merged<U extends readonly unknown[], Done extends unknown[] = []> = number extends U['length']
	? U
	: `${Done['length']}` extends (U extends unknown ? keyof U : never)
		? Merged<U, [...Done, At<U, `${Done['length']}`>]>
		: Done;

interface DefinitionOptions<Args extends readonly unknown[]> {
	/** Same arguments give the same result, with no side effects, so it can fold. */
	readonly pure?: boolean;
	/** Extra steps to charge, for work the size of the arguments does not show. */
	readonly cost?: (...args: Args) => number;
	/** A description for tooling. */
	readonly doc?: string;
}

/** A function a program can call. Only `define` makes one. */
export interface FunctionDefinition {
	readonly overloads: readonly Signature[];
	readonly pure: boolean;
	readonly cost: ((...args: never[]) => number) | undefined;
	readonly doc: string | undefined;
	readonly run: (...args: never[]) => unknown;
}

const definitions = new WeakSet<object>();

export function isFunctionDefinition(value: unknown): value is FunctionDefinition {
	return typeof value === 'object' && value !== null && definitions.has(value);
}

interface SingleSpec<
	A extends readonly (Type | Optional)[],
	R extends Type,
> extends DefinitionOptions<ArgumentsOf<A>> {
	readonly args: A;
	readonly returns: R;
	readonly run: (...args: ArgumentsOf<A>) => OutOf<R>;
}

interface OverloadedSpec<O extends readonly Signature[]> extends DefinitionOptions<
	Merged<ArgumentsOf<O[number]['args']>>
> {
	readonly overloads: O;
	readonly run: (...args: Merged<ArgumentsOf<O[number]['args']>>) => OutOf<O[number]['returns']>;
}

/**
 * Define a function a program can call. `run` is synchronous, and is typed from
 * the signature, so TypeScript and the language agree from one declaration.
 *
 * @throws {TypeError} for an invalid definition
 */
export function define<const O extends readonly Signature[]>(
	spec: OverloadedSpec<O>,
): FunctionDefinition;
export function define<const A extends readonly (Type | Optional)[], R extends Type>(
	spec: SingleSpec<A, R>,
): FunctionDefinition;
export function define(spec: {
	readonly args?: readonly (Type | Optional)[];
	readonly returns?: Type;
	readonly overloads?: readonly Signature[];
	readonly pure?: boolean;
	readonly cost?: (...args: never[]) => number;
	readonly doc?: string;
	readonly run: (...args: never[]) => unknown;
}): FunctionDefinition {
	// One read of each, as a getter can answer differently the next time
	const { args, returns, overloads, pure, cost, doc, run } = spec;

	if (overloads !== undefined && (args !== undefined || returns !== undefined)) {
		throw new TypeError('A function has either overloads, or args and returns');
	}
	if (typeof run !== 'function') throw new TypeError('A function needs run');
	if (cost !== undefined && typeof cost !== 'function') {
		throw new TypeError('cost must be a function');
	}
	if (pure !== undefined && typeof pure !== 'boolean') {
		throw new TypeError('pure must be a boolean');
	}
	if (doc !== undefined && typeof doc !== 'string') throw new TypeError('doc must be a string');

	let signatures: Signature[];
	if (overloads === undefined) {
		signatures = [checkedSignature({ args, returns } as Signature)];
	} else {
		if (!Array.isArray(overloads)) throw new TypeError('overloads must be a list');
		signatures = copyList(overloads).map(checkedSignature);
		if (signatures.length === 0) throw new TypeError('overloads must list at least one signature');
	}

	const definition: FunctionDefinition = Object.freeze({
		overloads: Object.freeze(signatures),
		pure: pure === true,
		cost,
		doc,
		run,
	});
	definitions.add(definition);
	return definition;
}

const HOOKS = ['equals', 'compare', 'add', 'subtract', 'show'] as const;

const abstractTypes = new WeakSet<object>();

/** Whether a value is what `defineType` returned, and not a labelled use of one. */
export function isAbstractType(value: unknown): value is AbstractType {
	return typeof value === 'function' && abstractTypes.has(value);
}

/**
 * Define an abstract type, to represent a foreign value in a program. Only `name`
 * and `is` are required, and each other operation enables syntax on the type.
 *
 * @throws {TypeError} for an invalid definition
 */
export function defineType<T>(definition: AbstractDefinition<T>): AbstractType<T> {
	const prototype: unknown = Object.getPrototypeOf(definition);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError('A type definition must be a plain object');
	}

	// The copy is what gets checked, as a getter can answer differently the next time
	const frozen = Object.freeze({ ...definition });
	const { name, is } = frozen;
	if (typeof name !== 'string' || name === '') throw new TypeError('A type needs a name');
	if (typeof is !== 'function') throw new TypeError('A type needs is');
	for (const hook of HOOKS) {
		const operation: unknown = frozen[hook];
		if (operation !== undefined && typeof operation !== 'function') {
			throw new TypeError(`${hook} must be a function`);
		}
	}

	const labelled = (label: string): Type<T, T> => {
		const type = node({ kind: 'abstract', definition: frozen }, label);
		return type as Type<T, T>;
	};
	const type = Object.freeze(
		Object.defineProperties(labelled, {
			kind: { value: 'abstract', enumerable: true },
			definition: { value: frozen, enumerable: true },
			label: { value: undefined, enumerable: true },
			name: { value: name },
		}),
	) as unknown as AbstractType<T>;
	abstractTypes.add(type);
	return made(type);
}

/**
 * Make a function that calls `fn` at most once per `evaluate`, so functions can
 * share one reading, of a clock for instance. Outside an evaluation it calls `fn`
 * every time. If `fn` throws, nothing is kept, and a later call tries again.
 */
export function once<T>(fn: () => T): () => T {
	if (typeof fn !== 'function') throw new TypeError('once needs a function');

	const values = new WeakMap<object, { readonly value: T }>();
	const running = new WeakSet<object>();
	return () => {
		const evaluation = currentEvaluation();
		if (evaluation === undefined) return fn();

		const known = values.get(evaluation);
		if (known !== undefined) return known.value;
		if (running.has(evaluation)) {
			throw new Error('A function made with once called itself');
		}

		running.add(evaluation);
		try {
			const value = fn();
			values.set(evaluation, { value });
			return value;
		} finally {
			running.delete(evaluation);
		}
	};
}
