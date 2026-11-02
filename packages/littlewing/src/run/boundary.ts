import type { FieldType, Type } from '../check/types.js';
import {
	AbstractTypeRef,
	ARRAY_CLASSES,
	ArrayType,
	BOOLEAN_CLASSES,
	classesOfDefinition,
	EQUATABLE,
	ERROR,
	fieldType,
	forEachField,
	NUMBER,
	NUMBER_CLASSES,
	prune,
	pruneRow,
	RECORD_CLASSES,
	RecordType,
	STRING_CLASSES,
	TypeVariable,
} from '../check/types.js';
import { isDecimal, unwrapDecimal, wrapDecimal } from '../decimal.js';
import type { AbstractDefinition } from '../define.js';
import { charge, LimitExceededError } from '../limits.js';
import type { Num } from '../number.js';
import { fromDouble, toDouble } from '../number.js';
import type { RecordValue, Value } from './values.js';
import {
	callIs,
	failure,
	hasUnpaired,
	HOOK_STEPS,
	isInstance,
	isNum,
	isRecordValue,
	isStackOverflow,
	newRecord,
} from './values.js';

/** What failure means where a value comes in. */
export type Crossing = 'invalid-input' | 'host-error';

/** The limits of a type: language section 11. */
const MAX_DEPTH = 256;
const MAX_SIZE = 65_536;

function isPlainObject(value: Value): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

/** What each generic variable turned out to be, for one evaluation. */
export type Bindings = Map<TypeVariable, Shape>;

/** A type counted as language section 11 counts it. */
interface Extent {
	readonly size: number;
	readonly depth: number;
}

interface Facts extends Extent {
	/** The classes it is in, which for `equatable` depends on what it contains. */
	readonly classes: number;
}

/** The type a value at a generic position has: language section 6.6. */
type Shape = Facts &
	(
		| { readonly kind: 'number' | 'string' | 'boolean' }
		/** The element of an array with none, which fits any type. */
		| { readonly kind: 'empty' }
		| { readonly kind: 'abstract'; readonly definition: AbstractDefinition }
		| { readonly kind: 'array'; readonly element: Shape }
		| { readonly kind: 'record'; readonly fields: Map<string, Shape> }
	);

const NUMBER_SHAPE: Shape = { kind: 'number', classes: NUMBER_CLASSES, size: 1, depth: 1 };
const STRING_SHAPE: Shape = { kind: 'string', classes: STRING_CLASSES, size: 1, depth: 1 };
const BOOLEAN_SHAPE: Shape = { kind: 'boolean', classes: BOOLEAN_CLASSES, size: 1, depth: 1 };
const EMPTY_SHAPE: Shape = { kind: 'empty', classes: EQUATABLE, size: 1, depth: 1 };

/** Nothing raised yet, which nothing host code throws can equal. */
const NOT_RAISED = Symbol('not raised');

/** A value at a generic position, and the copy of it the language holds. */
interface Walked {
	readonly copy: Value;
	readonly shape: Shape;
}

/** What a record type asks of every value read at it, worked out once. */
interface Layout {
	readonly fields: ReadonlyMap<string, FieldType>;
	readonly required: readonly string[];
	readonly uniform: Type | undefined;
}

/**
 * One crossing into the language, in one pass over the value. It holds what must
 * stay the same across a whole value, so every object is read once per type and
 * sharing survives, and, across all the inputs of one evaluation, the type each
 * generic variable took.
 */
export class Reader {
	private readonly copies = new Map<object, Map<Type, Value>>();
	private readonly layouts = new Map<RecordType, Layout>();
	/** Objects read at a generic position, which need no type to be read again. */
	private readonly walked = new Map<object, Walked>();
	/** Objects at a generic position whose reading has not ended. */
	private readonly open = new Set<object>();
	private readonly merges = new Map<Shape, Map<Shape, Shape>>();
	/** The last failure raised here, to tell it from what host code threw. */
	private raised: unknown = NOT_RAISED;
	/** How far each type goes, once the variables are known. */
	private readonly extents = new Map<Type, Extent>();

	constructor(
		private readonly crossing: Crossing,
		private readonly bindings: Bindings,
		private readonly abstracts: readonly AbstractDefinition[],
		private readonly metered: boolean,
	) {}

	private fail(message: string): never {
		this.raised = failure(this.crossing, message);
		throw this.raised;
	}

	private spend(steps: number): void {
		if (this.metered) charge(steps);
	}

	private test(definition: AbstractDefinition, value: Value): boolean {
		this.spend(HOOK_STEPS);
		try {
			return callIs(definition, value);
		} catch (error) {
			this.raised = error;
			throw error;
		}
	}

	private number(value: Value): Num {
		if (typeof value === 'number') {
			if (!Number.isFinite(value)) this.fail('A number must be finite');
			return fromDouble(value);
		}
		if (isDecimal(value)) return unwrapDecimal(value);
		return this.fail('Expected a number');
	}

	private string(value: Value): string {
		if (typeof value !== 'string') return this.fail('Expected a string');
		this.spend(value.length);
		if (hasUnpaired(value)) this.fail('A string must have no unpaired surrogates');
		return value;
	}

	private fieldName(key: string): void {
		this.spend(key.length);
		if (hasUnpaired(key)) this.fail('A field name must have no unpaired surrogates');
	}

	private remember(value: object, type: Type, copy: Value): void {
		let byType = this.copies.get(value);
		if (byType === undefined) {
			byType = new Map();
			this.copies.set(value, byType);
		}
		byType.set(type, copy);
	}

	private array(value: Value, element: Type, type: Type): Value {
		if (!Array.isArray(value)) return this.fail('Expected an array');
		const known = this.copies.get(value)?.get(type);
		if (known !== undefined) return known;

		const copy: Value[] = [];
		this.remember(value, type, copy);
		const { length } = value;
		this.spend(length + 1);
		for (let i = 0; i < length; i++) {
			const item: unknown = value[i];
			if (item === undefined) this.fail('An array cannot hold undefined');
			copy.push(this.read(item, element));
		}
		return copy;
	}

	private layoutOf(record: RecordType): Layout {
		const known = this.layouts.get(record);
		if (known !== undefined) return known;

		const fields = new Map<string, FieldType>();
		const required: string[] = [];
		forEachField(record, (name, field) => {
			this.spend(1);
			fields.set(name, field);
			if (field.required && field.absent !== true) required.push(name);
		});
		const uniform = record.row === undefined ? undefined : pruneRow(record.row).uniform;
		const layout = { fields, required, uniform };
		this.layouts.set(record, layout);
		return layout;
	}

	private record(value: Value, record: RecordType): Value {
		if (!isPlainObject(value)) return this.fail('Expected a plain object');
		const known = this.copies.get(value)?.get(record);
		if (known !== undefined) return known;

		const copy = newRecord();
		this.remember(value, record, copy);
		const { fields, required, uniform } = this.layoutOf(record);
		const keys = Object.keys(value);
		this.spend(keys.length + 1);

		for (const key of keys) {
			const item: unknown = value[key];
			if (item === undefined) continue;
			const type = fields.get(key)?.type ?? uniform;
			if (type !== undefined) {
				this.fieldName(key);
				copy[key] = this.read(item, type);
			} else if (record.closed) {
				this.fail('This record has a field its type does not');
			} else {
				// Unread and unchecked, whatever it is
				copy[key] = item;
			}
		}

		// The value has as many keys as this has names, or stops at the first it lacks
		for (const name of required) {
			if (copy[name] === undefined) this.fail(`Missing field ${name.slice(0, 40)}`);
		}
		return copy;
	}

	/**
	 * A shape past the limits on its own. Depth is not only for `walk` to find, as an
	 * object already read can sit under one more level each time, and merging such a
	 * shape would run off the end of the stack.
	 */
	private measured(shape: Shape): Shape {
		if (shape.size > MAX_SIZE) this.fail('This value has too large a type');
		if (shape.depth > MAX_DEPTH) this.fail('This value is too deep');
		return shape;
	}

	private arrayShape(element: Shape): Shape {
		const classes = (element.classes & EQUATABLE) === 0 ? ARRAY_CLASSES ^ EQUATABLE : ARRAY_CLASSES;
		const { size, depth } = element;
		return this.measured({ kind: 'array', element, classes, size: size + 1, depth: depth + 1 });
	}

	private recordShape(fields: Map<string, Shape>): Shape {
		let size = 1;
		let depth = 0;
		let equatable = true;
		for (const field of fields.values()) {
			size += field.size;
			depth = Math.max(depth, field.depth);
			equatable &&= (field.classes & EQUATABLE) !== 0;
		}
		const classes = equatable ? RECORD_CLASSES : RECORD_CLASSES ^ EQUATABLE;
		return this.measured({ kind: 'record', fields, classes, size, depth: depth + 1 });
	}

	private walkArray(value: readonly Value[], depth: number): Walked {
		this.open.add(value);
		const { length } = value;
		this.spend(length + 1);
		const copy: Value[] = [];
		let element = EMPTY_SHAPE;
		for (let i = 0; i < length; i++) {
			const item = this.walk(value[i], depth + 1);
			copy.push(item.copy);
			element = this.merge(element, item.shape);
		}
		this.open.delete(value);
		return { copy, shape: this.arrayShape(element) };
	}

	private walkRecord(value: Record<string, unknown>, depth: number): Walked {
		this.open.add(value);
		const keys = Object.keys(value);
		this.spend(keys.length + 1);
		const copy = newRecord();
		const fields = new Map<string, Shape>();
		for (const key of keys) {
			const item: unknown = value[key];
			if (item === undefined) continue;
			this.fieldName(key);
			const field = this.walk(item, depth + 1);
			copy[key] = field.copy;
			fields.set(key, field.shape);
		}
		this.open.delete(value);
		return { copy, shape: this.recordShape(fields) };
	}

	private classify(value: Value, depth: number): Walked {
		// `is` sees the host's own value, before anything else reads it
		let abstract: AbstractDefinition | undefined;
		for (const definition of this.abstracts) {
			if (!this.test(definition, value)) continue;
			if (abstract !== undefined) this.fail('A value belongs to more than one type');
			abstract = definition;
		}

		const isNumber = typeof value === 'number' || isDecimal(value);
		const isArray = Array.isArray(value);
		const isRecord = isPlainObject(value);
		if (abstract !== undefined) {
			const builtin =
				isNumber || isArray || isRecord || typeof value === 'string' || typeof value === 'boolean';
			if (builtin) this.fail('A value belongs to more than one type');
			const classes = classesOfDefinition(abstract);
			const shape: Shape = { kind: 'abstract', definition: abstract, classes, size: 1, depth: 1 };
			return { copy: value, shape };
		}

		if (isNumber) return { copy: this.number(value), shape: NUMBER_SHAPE };
		if (typeof value === 'string') return { copy: this.string(value), shape: STRING_SHAPE };
		if (typeof value === 'boolean') return { copy: value, shape: BOOLEAN_SHAPE };
		if (isArray) return this.walkArray(value as readonly Value[], depth);
		if (isRecord) return this.walkRecord(value, depth);
		return this.fail('Not a value of the language');
	}

	/** Read a value where the type does not say, which gives its copy and its type at once. */
	private walk(value: Value, depth: number): Walked {
		if (value === undefined) this.fail('A value cannot be undefined');
		if (depth > MAX_DEPTH) this.fail('This value is too deep');
		if (typeof value !== 'object' || value === null) return this.classify(value, depth);

		const known = this.walked.get(value);
		if (known !== undefined) return known;
		if (this.open.has(value)) this.fail('A value cannot contain itself');
		const walked = this.classify(value, depth);
		this.walked.set(value, walked);
		return walked;
	}

	/** `a`, itself if `b` adds nothing to it, which is what lets a repeated pair be known. */
	private mergeParts(a: Shape, b: Shape): Shape {
		if (a.kind === 'array' && b.kind === 'array') {
			const element = this.merge(a.element, b.element);
			return element === a.element ? a : this.arrayShape(element);
		}
		if (a.kind === 'record' && b.kind === 'record') {
			if (a.fields.size !== b.fields.size) this.fail('Values have different types');
			this.spend(a.fields.size);
			const fields = new Map<string, Shape>();
			let changed = false;
			for (const [name, shape] of a.fields) {
				const other = b.fields.get(name);
				if (other === undefined) this.fail('Values have different types');
				const field = this.merge(shape, other);
				changed ||= field !== shape;
				fields.set(name, field);
			}
			return changed ? this.recordShape(fields) : a;
		}
		if (a.kind === 'abstract' && b.kind === 'abstract' && a.definition === b.definition) return a;
		return this.fail('Values have different types');
	}

	/** One type for two, each pair worked out once, as a shape can repeat its parts. */
	private merge(a: Shape, b: Shape): Shape {
		if (a === b || b.kind === 'empty') return a;
		if (a.kind === 'empty') return b;
		this.spend(1);

		let byOther = this.merges.get(a);
		if (byOther === undefined) {
			byOther = new Map();
			this.merges.set(a, byOther);
		}
		const known = byOther.get(b);
		if (known !== undefined) return known;
		const merged = this.mergeParts(a, b);
		byOther.set(b, merged);
		return merged;
	}

	private generic(value: Value, variable: TypeVariable): Value {
		const { copy, shape } = this.walk(value, 1);
		if ((shape.classes & variable.classes) !== variable.classes) {
			this.fail('This value cannot do what the program needs');
		}
		const known = this.bindings.get(variable);
		this.bindings.set(variable, known === undefined ? shape : this.merge(known, shape));
		return copy;
	}

	/** Copy a value in, checking it against a type. A throw while reading is a failure. */
	cross(value: Value, type: Type): Value {
		try {
			return this.read(value, type);
		} catch (error) {
			if (error === this.raised || isInstance(error, LimitExceededError)) throw error;
			if (isStackOverflow(error)) throw error;
			throw failure(this.crossing, 'A value could not be read', error);
		}
	}

	/** The size and depth of a type written out, with what its variables turned out to be. */
	private extent(type: Type): Extent {
		const current = prune(type);
		const seen = this.extents.get(current);
		if (seen !== undefined) return seen;
		this.spend(1);

		let extent: Extent = { size: 1, depth: 1 };
		if (current instanceof TypeVariable) {
			extent = this.bindings.get(current) ?? extent;
		} else if (current instanceof ArrayType) {
			const { size, depth } = this.extent(current.element);
			extent = { size: size + 1, depth: depth + 1 };
		} else if (current instanceof RecordType) {
			const { fields, uniform } = this.layoutOf(current);
			const parts = [...fields.values()].map((field) => this.extent(field.type));
			if (uniform !== undefined) parts.push(this.extent(uniform));
			extent = {
				size: parts.reduce((total, part) => total + part.size, 1),
				depth: 1 + parts.reduce((deepest, part) => Math.max(deepest, part.depth), 0),
			};
		}
		this.extents.set(current, extent);
		return extent;
	}

	/**
	 * Hold what was read at a type to the limits of language section 11. This waits for
	 * the end of the crossing, when the variables are known, and counts the type around
	 * them, so neither the order of the fields nor what is shared can change the answer.
	 */
	checkLimits(type: Type): void {
		if (this.bindings.size === 0) return;
		const { size, depth } = this.extent(type);
		if (size > MAX_SIZE || depth > MAX_DEPTH) this.fail('This value has too large a type');
	}

	private read(value: Value, type: Type): Value {
		const current = prune(type);
		switch (current.tag) {
			case 'number':
				return this.number(value);
			case 'string':
				return this.string(value);
			case 'boolean':
				return typeof value === 'boolean' ? value : this.fail('Expected a boolean');
			case 'abstract':
				// Absent is not a value, whatever a test says
				return value !== undefined && this.test(current.definition, value)
					? value
					: this.fail(`Expected ${current.definition.name.slice(0, 40)}`);
			case 'array':
				return this.array(value, current.element, current);
			case 'record':
				return this.record(value, current);
			case 'variable':
				return this.generic(value, current);
			case 'error':
				return value;
		}
	}
}

/**
 * What a value costs a host to read, following its type, counting a shared part
 * every time it appears and walking it once, as a value can hold one array
 * exponentially often. An abstract value and an unread field each count as 1, and
 * neither is walked. With no type, it is a generic value, which can be.
 */
export function logicalSize(
	value: Value,
	type: Type | undefined,
	sizes: Map<object, number>,
): number {
	const current = type === undefined ? undefined : prune(type);
	if (current instanceof AbstractTypeRef) return 1;
	if (typeof value === 'string') return value.length;

	let element: Type | undefined;
	let record: RecordType | undefined;
	if (current instanceof ArrayType) element = current.element;
	else if (current instanceof RecordType) record = current;
	else if (current !== undefined && !(current instanceof TypeVariable)) return 1;
	else if (!Array.isArray(value) && !isRecordValue(value)) return 1;

	const known = sizes.get(value as object);
	if (known !== undefined) return known;

	let size = 1;
	if (Array.isArray(value)) {
		charge(value.length + 1);
		const leaf = element === undefined ? undefined : prune(element);
		if (leaf !== undefined && (leaf.tag === 'number' || leaf.tag === 'boolean')) {
			size += value.length;
		} else {
			for (const item of value as readonly Value[]) size += logicalSize(item, element, sizes);
		}
	} else {
		const fields = value as RecordValue;
		const keys = Object.keys(fields);
		charge(keys.length + 1);
		const uniform = record?.row === undefined ? undefined : pruneRow(record.row).uniform;
		for (const key of keys) {
			const named = record === undefined ? undefined : (fieldType(record, key) ?? uniform);
			size +=
				record !== undefined && named === undefined ? 1 : logicalSize(fields[key], named, sizes);
		}
	}
	sizes.set(value as object, size);
	return size;
}

/** How numbers go out. */
export type NumberForm = 'number' | 'decimal';

/**
 * Copy a value out, following its type, so unread fields stay untouched. Sharing
 * survives, as a value can hold one array exponentially often.
 */
export class Writer {
	private readonly copies = new Map<object, Value>();

	constructor(
		private readonly form: NumberForm,
		private readonly frozen: boolean,
	) {}

	private number(value: Num): Value {
		return this.form === 'decimal' ? wrapDecimal(value) : toDouble(value);
	}

	private array(value: readonly Value[], element: Type | undefined): Value {
		const known = this.copies.get(value);
		if (known !== undefined) return known;
		charge(value.length + 1);
		const copy =
			element !== undefined && prune(element) === NUMBER
				? value.map((item) => this.number(item as Num))
				: value.map((item) => this.write(item, element));
		this.copies.set(value, copy);
		return this.frozen ? Object.freeze(copy) : copy;
	}

	private record(value: RecordValue, record: RecordType | undefined): Value {
		const known = this.copies.get(value);
		if (known !== undefined) return known;

		const copy = newRecord();
		const uniform = record?.row === undefined ? undefined : pruneRow(record.row).uniform;

		const keys = Object.keys(value);
		charge(keys.length + 1);
		for (const key of keys) {
			const type = (record === undefined ? undefined : fieldType(record, key)) ?? uniform;
			// A field the type does not name is an unread one, unless the type is not known
			copy[key] =
				type === undefined && record !== undefined ? value[key] : this.write(value[key], type);
		}
		this.copies.set(value, copy);
		return this.frozen ? Object.freeze(copy) : copy;
	}

	/** Copy a value out. With no type, it is a generic value, which can be walked. */
	write(value: Value, type: Type | undefined): Value {
		const current = type === undefined ? undefined : prune(type);
		if (current instanceof ArrayType) {
			return this.array(value as readonly Value[], current.element);
		}
		if (current instanceof RecordType) return this.record(value as RecordValue, current);
		if (current === undefined || current instanceof TypeVariable || current === ERROR) {
			if (isNum(value)) return this.number(value);
			if (Array.isArray(value)) return this.array(value as readonly Value[], undefined);
			return isRecordValue(value) ? this.record(value, undefined) : value;
		}
		if (current.tag === 'number') return this.number(value as Num);
		return value;
	}
}
