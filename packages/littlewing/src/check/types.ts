import type { AbstractDefinition, TypeClass } from '../define.js';
import { charge } from '../limits.js';

/** The classes of language section 6.2, as bits of a mask. A variable meets all of its. */
export const ADDABLE = 1;
export const SUBTRACTABLE = 2;
export const ORDERED = 4;
export const EQUATABLE = 8;
export const SHOWABLE = 16;
export const CONVERTIBLE = 32;
export const SIZED = 64;
export const INDEXABLE = 128;

export const CLASS_BITS: Readonly<Record<TypeClass, number>> = {
	addable: ADDABLE,
	subtractable: SUBTRACTABLE,
	ordered: ORDERED,
	equatable: EQUATABLE,
	showable: SHOWABLE,
	convertible: CONVERTIBLE,
	sized: SIZED,
	indexable: INDEXABLE,
};

const CLASS_NAMES = Object.keys(CLASS_BITS) as TypeClass[];

export const NUMBER_CLASSES: number =
	ADDABLE | SUBTRACTABLE | ORDERED | EQUATABLE | SHOWABLE | CONVERTIBLE;
export const STRING_CLASSES: number =
	ADDABLE | ORDERED | EQUATABLE | SHOWABLE | CONVERTIBLE | SIZED | INDEXABLE;
export const BOOLEAN_CLASSES: number = EQUATABLE | SHOWABLE | CONVERTIBLE;
export const ARRAY_CLASSES: number = ADDABLE | EQUATABLE | SIZED | INDEXABLE;
export const RECORD_CLASSES: number = EQUATABLE | INDEXABLE;

/** The classes an abstract type belongs to, from the operations it provides. */
export function classesOfDefinition(definition: AbstractDefinition): number {
	const provides = (name: keyof AbstractDefinition, bit: number): number =>
		Reflect.get(definition, name) === undefined ? 0 : bit;
	return (
		provides('add', ADDABLE) |
		provides('subtract', SUBTRACTABLE) |
		provides('compare', ORDERED) |
		provides('equals', EQUATABLE) |
		provides('show', SHOWABLE)
	);
}

export function classNames(mask: number): TypeClass[] {
	return CLASS_NAMES.filter((name) => (mask & CLASS_BITS[name]) !== 0);
}

export interface Primitive {
	readonly tag: 'number' | 'string' | 'boolean';
}

export const NUMBER: Primitive = { tag: 'number' };
export const STRING: Primitive = { tag: 'string' };
export const BOOLEAN: Primitive = { tag: 'boolean' };

/** What a failed expression has, which unifies with anything, so one mistake reports once. */
export const ERROR = { tag: 'error' } as const;

export class ArrayType {
	readonly tag = 'array';
	/** Whether its elements have joined `equatable`, so that happens once. */
	equatable = false;
	constructor(readonly element: Type) {}
}

export class AbstractTypeRef {
	readonly tag = 'abstract';
	constructor(
		readonly definition: AbstractDefinition,
		readonly classes: number,
	) {}
}

export interface FieldType {
	readonly type: Type;
	required: boolean;
	/**
	 * Optional in what a function returns. A read can make an input's field required,
	 * but this one can still be absent, whatever reads it.
	 */
	absent?: boolean;
}

/**
 * The part of an open record that is not spelled out: its row. A spread's result
 * shares the row of its operand, so a spread of a spread stays one level deep.
 */
export class Row {
	link: Row | undefined;
	/** Every field in the row, known or not, has this type. */
	uniform: Type | undefined;
	/** Taken by a spread as open, so it can no longer be closed. */
	sealed = false;
	equatable = false;
	/** What to run once this row closes. */
	closing: (() => void)[] | undefined;

	constructor(readonly fields: Map<string, FieldType>) {}
}

export function pruneRow(row: Row): Row {
	let root = row;
	while (root.link !== undefined) root = root.link;
	let current = row;
	while (current.link !== undefined) {
		const next: Row = current.link;
		current.link = root;
		current = next;
	}
	return root;
}

/**
 * Waiting records that have met, and the record they have to become. They are a
 * disjoint set, so a chain of them costs one meeting each, however long it runs.
 */
export class Meeting {
	link: Meeting | undefined;
	/** A record that is not waiting, if any has met this set yet. */
	known: RecordType | undefined;
	/** Where it met, which is where a failure to become it belongs. */
	node: { readonly start: number; readonly end: number } | undefined;
	/** Literals spreading a member, to retry once this set is known to be closed. */
	spreads: (() => void)[] | undefined;
	/** How many members still wait, which is what a spread of `known` waits for too. */
	waiting = 0;
}

export function pruneMeeting(meeting: Meeting): Meeting {
	let root = meeting;
	while (root.link !== undefined) root = root.link;
	let current = meeting;
	while (current.link !== undefined) {
		const next: Meeting = current.link;
		current.link = root;
		current = next;
	}
	return root;
}

/**
 * A record type: the fields a literal spells out, and, if it is open, the row that
 * holds the rest. A name in `fields` hides that name in the row, which is what a
 * literal setting a field over a spread does.
 */
export class RecordType {
	readonly tag = 'record';
	/** A record this one was unified into. */
	link: RecordType | undefined;
	/** Every field this record spells out has this type. */
	uniform: Type | undefined;
	/** Its fields have joined `equatable`. */
	equatable = false;
	/** Until a waiting spread resolves it, everything that needs this record waits. */
	pending: (() => void)[] | undefined;
	/** What met this record while it waited, which is one type with it already. */
	meeting: Meeting | undefined;
	/** A literal that failed, which reports nothing more. */
	failed = false;

	constructor(
		readonly fields: Map<string, FieldType>,
		public row: Row | undefined,
		public closed: boolean,
	) {}
}

export function closedRecord(fields: Map<string, FieldType>): RecordType {
	return new RecordType(fields, undefined, true);
}

export function openRecord(fields: Map<string, FieldType> = new Map()): RecordType {
	return new RecordType(new Map(), new Row(fields), false);
}

export class TypeVariable {
	readonly tag = 'variable';
	link: Type | undefined;
	/** What to run once this variable is known. */
	waiters: (() => void)[] | undefined;
	/** The element of this container, shared by everything that reads one from it. */
	element: Type | undefined;

	constructor(
		readonly id: number,
		public classes: number,
		/** Made to test an overload, and never linked to anything. */
		readonly trial: boolean = false,
	) {}
}

export type Type =
	| Primitive
	| typeof ERROR
	| ArrayType
	| AbstractTypeRef
	| RecordType
	| TypeVariable;

function linkOf(type: Type): Type | undefined {
	return type instanceof TypeVariable || type instanceof RecordType ? type.link : undefined;
}

/** Follow links to what a type stands for now, shortening them for next time. */
export function prune(type: Type): Type {
	let root = type;
	for (let next = linkOf(root); next !== undefined; next = linkOf(root)) root = next;

	let current = type;
	while (current !== root) {
		const next = linkOf(current) as Type;
		if (current instanceof TypeVariable) current.link = root;
		else (current as RecordType).link = root as RecordType;
		current = next;
	}
	return root;
}

export function pruneRecord(record: RecordType): RecordType {
	return prune(record) as RecordType;
}

/** A field as seen from a record, whichever part holds it. */
export function forEachField(
	record: RecordType,
	visit: (name: string, field: FieldType) => void,
): void {
	for (const [name, field] of record.fields) visit(name, field);
	if (record.row === undefined) return;
	for (const [name, field] of pruneRow(record.row).fields) {
		if (!record.fields.has(name)) visit(name, field);
	}
}

/** The type of a field a record names, itself or in its row. */
export function fieldType(record: RecordType, name: string): Type | undefined {
	const field =
		record.fields.get(name) ??
		(record.row === undefined ? undefined : pruneRow(record.row).fields.get(name));
	return field?.type;
}

function printFields(type: RecordType, depth: number): string {
	const parts: string[] = [];
	let more = !type.closed;
	for (const [name, field] of type.fields) {
		if (parts.length === 4) {
			more = true;
			break;
		}
		const mark = field.required ? '' : '?';
		parts.push(`${name.slice(0, 20)}${mark}: ${printType(field.type, depth + 1)}`);
	}
	return `{ ${[...parts, ...(more ? ['...'] : [])].join(', ')} }`;
}

/** Write a type for a message, short whatever its size. */
export function printType(type: Type, depth = 0): string {
	const current = prune(type);
	if (depth > 3) return '...';
	switch (current.tag) {
		case 'number':
		case 'string':
		case 'boolean':
			return current.tag;
		case 'error':
			return 'an error';
		case 'array':
			return `array<${printType(current.element, depth + 1)}>`;
		case 'abstract':
			return current.definition.name.slice(0, 40);
		case 'record':
			return printFields(current, depth);
		case 'variable':
			return 'an unknown type';
	}
}

const MAX_DEPTH = 256;
const MAX_SIZE = 65536;

/**
 * Measures types against the limits of language section 11. Sizes are of a type
 * written out in full, so they are memoized to not cost what they count.
 */
export class TypeMeter {
	private readonly sizes = new Map<object, number>();
	private readonly depths = new Map<object, number>();
	private exceeded = false;

	private measure(type: Type, level: number): void {
		if (this.exceeded) return;
		if (level > MAX_DEPTH) {
			this.exceeded = true;
			return;
		}
		const current = prune(type);
		if (!(current instanceof ArrayType) && !(current instanceof RecordType)) return;

		const known = this.depths.get(current);
		if (known !== undefined) {
			if (level + known - 1 > MAX_DEPTH) this.exceeded = true;
			return;
		}

		const children: Type[] = [];
		if (current instanceof ArrayType) children.push(current.element);
		else {
			forEachField(current, (_, field) => {
				children.push(field.type);
			});
			const uniform = current.row === undefined ? undefined : pruneRow(current.row).uniform;
			if (uniform !== undefined) children.push(uniform);
		}

		let size = 1;
		let depth = 0;
		for (const child of children) {
			charge(1);
			this.measure(child, level + 1);
			if (this.exceeded) return;
			const pruned = prune(child);
			size += this.sizes.get(pruned) ?? 1;
			depth = Math.max(depth, this.depths.get(pruned) ?? 1);
		}
		if (size > MAX_SIZE) this.exceeded = true;
		this.sizes.set(current, size);
		this.depths.set(current, depth + 1);
	}

	/** Whether a type passes the limits. */
	fits(type: Type): boolean {
		this.exceeded = false;
		this.measure(type, 1);
		return !this.exceeded;
	}
}
