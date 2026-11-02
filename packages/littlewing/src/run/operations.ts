import type { Type } from '../check/types.js';
import { AbstractTypeRef, ArrayType, fieldType, prune, RecordType } from '../check/types.js';
import type {
	AbstractDefinition,
	FunctionDefinition,
	Optional,
	Signature,
	Type as HostType,
	TypeNode,
} from '../define.js';
import { isOptional } from '../define.js';
import { charge, chargeRead, exhaust } from '../limits.js';
import type { Num } from '../number.js';
import { compare, equals as numbersEqual, toText } from '../number.js';
import type { Node } from '../syntax/ast.js';
import type { Bindings } from './boundary.js';
import { logicalSize, Reader, Writer } from './boundary.js';
import type { RecordValue, Value } from './values.js';
import {
	callCompare,
	callEquals,
	callIs,
	codePoints,
	compareStrings,
	failure,
	hasUnpaired,
	HOOK_STEPS,
	hostCall,
	isNum,
	isRecordValue,
	OBJECT_STEPS,
	resolvePosition,
} from './values.js';

/** State of one evaluation. Variables live in slots numbered at compile time. */
export interface Frame {
	readonly slots: Value[];
	/** The node to blame for a failure. */
	current: Node | undefined;
	/** Strings in top-level names, split once for indexing, by slot. */
	strings: (readonly string[] | string | undefined)[] | undefined;
	/** What each generic variable turned out to be, for this evaluation. */
	readonly bindings: Bindings;
	/** Whether what this evaluation reads is charged, as a nested one's is. */
	readonly metered: boolean;
}

/** What a call of a host function needs to know, fixed at compile time. */
export interface HostCall {
	readonly label: string;
	readonly definition: FunctionDefinition;
	readonly signature: Signature;
	readonly argTypes: readonly (Type | undefined)[];
	readonly result: Type;
}

/** Read `container[index]`, giving undefined for what is missing. */
export function readIndex(
	container: Value,
	index: Value,
	split: readonly string[] | string | undefined,
): Value {
	if (typeof index === 'string') {
		// Looking a key up reads all of it, however it was built
		chargeRead(index.length);
		return (container as RecordValue)[index];
	}
	if (typeof container === 'string') {
		const points = split ?? codePoints(container);
		const position = resolvePosition(index as Num, points.length);
		return position === undefined ? undefined : points[position];
	}
	const items = container as readonly Value[];
	const position = resolvePosition(index as Num, items.length);
	return position === undefined ? undefined : items[position];
}

/** Whether a signature has a parameter that `t.oneOf` restricts. */
export function hasRestriction(signature: Signature): boolean {
	return signature.args.some((param) => {
		const shape = (isOptional(param) ? param.type : param) as TypeNode;
		return shape.kind === 'oneOf';
	});
}

/** Hold arguments to what `t.oneOf` accepts, which only a literal could be checked for. */
export function checkAccepted(signature: Signature, args: readonly Value[]): void {
	for (let i = 0; i < args.length; i++) {
		const param = signature.args[i] as HostType | Optional;
		const shape = (isOptional(param) ? param.type : param) as TypeNode;
		if (shape.kind === 'oneOf' && !shape.values.includes(args[i] as string)) {
			throw failure('invalid-argument', 'This is not one of the accepted strings');
		}
	}
}

/**
 * What a program does at run time beyond arithmetic. A program holds this and not
 * the compiler, as hosts keep programs a long time.
 */
export class Operations {
	constructor(private readonly abstracts: readonly AbstractDefinition[]) {}

	/** The abstract type of a value at a generic position, which has one at most. */
	private abstractOf(value: Value): AbstractDefinition {
		for (const definition of this.abstracts) {
			charge(HOOK_STEPS);
			if (callIs(definition, value)) return definition;
		}
		throw failure('host-error', 'A value belongs to no type');
	}

	hook(definition: AbstractDefinition, name: 'add' | 'subtract', a: Value, b: Value): Value {
		charge(HOOK_STEPS);
		const result: unknown = hostCall(`${definition.name.slice(0, 40)} ${name}`, () =>
			definition[name]?.(a, b),
		);
		charge(HOOK_STEPS);
		if (result === undefined || !callIs(definition, result)) {
			throw failure('host-error', `${name} must return its own type`);
		}
		return result;
	}

	/**
	 * `+` where the type is not number. Language section 6.5 settles any class with
	 * number in it, so a generic one is a string or an array, and is told apart here.
	 */
	add(a: Value, b: Value, abstract: AbstractDefinition | undefined): Value {
		if (abstract !== undefined) return this.hook(abstract, 'add', a, b);
		if (typeof a === 'string') {
			charge(Math.min(a.length, (b as string).length));
			return a + (b as string);
		}
		const items = a as readonly Value[];
		const other = b as readonly Value[];
		charge(items.length + other.length + OBJECT_STEPS);
		return items.concat(other);
	}

	private equalRecords(a: RecordValue, b: RecordValue, type: Type | undefined): boolean {
		const keys = Object.keys(a);
		charge(keys.length);
		const others = Object.keys(b);
		charge(others.length);
		if (keys.length !== others.length) return false;
		for (const key of keys) {
			const other = b[key];
			if (other === undefined) return false;
			const field = type instanceof RecordType ? fieldType(type, key) : undefined;
			if (!this.equal(a[key], other, field)) return false;
		}
		return true;
	}

	/** Compare by what the type says, or by what the value is at a generic position. */
	equal(a: Value, b: Value, type: Type | undefined): boolean {
		charge(1);
		const current = type === undefined ? undefined : prune(type);
		if (current instanceof AbstractTypeRef) return callEquals(current.definition, a, b);

		if (isNum(a)) return numbersEqual(a, b as Num);
		if (typeof a === 'string') {
			if (a.length !== (b as string).length) return false;
			chargeRead(a.length);
			return a === b;
		}
		if (typeof a === 'boolean') return a === b;
		if (Array.isArray(a)) {
			const other = b as readonly Value[];
			if (a.length !== other.length) return false;
			const element = current instanceof ArrayType ? current.element : undefined;
			return a.every((item, i) => this.equal(item, other[i], element));
		}
		if (isRecordValue(a)) return this.equalRecords(a, b as RecordValue, current);
		return callEquals(this.abstractOf(a), a, b);
	}

	/** The order of values of a type, for the functions that sort. */
	order(type: Type | undefined): (a: Value, b: Value) => number {
		const current = type === undefined ? undefined : prune(type);
		if (current instanceof AbstractTypeRef) {
			const { definition } = current;
			return (a, b) => callCompare(definition, a, b);
		}
		return (a, b) => {
			if (typeof a === 'number' && typeof b === 'number') return a - b;
			return isNum(a) ? compare(a, b as Num) : compareStrings(a as string, b as string);
		};
	}

	show(value: Value, type: Type | undefined): string {
		const current = type === undefined ? undefined : prune(type);
		const abstract = current instanceof AbstractTypeRef ? current.definition : undefined;
		if (abstract === undefined) {
			if (typeof value === 'string') return value;
			if (typeof value === 'boolean') return value ? 'true' : 'false';
			if (isNum(value)) return toText(value);
		}

		const definition = abstract ?? this.abstractOf(value);
		charge(HOOK_STEPS);
		const text: unknown = hostCall(`${definition.name.slice(0, 40)} show`, () =>
			definition.show?.(value),
		);
		if (typeof text !== 'string' || hasUnpaired(text)) {
			throw failure('host-error', 'show must return a string with no unpaired surrogates');
		}
		charge(text.length);
		return text;
	}

	invoke(call: HostCall, args: readonly Value[], frame: Frame): Value {
		const { label, definition, signature, argTypes, result } = call;
		checkAccepted(signature, args);

		const sizes = new Map<object, number>();
		for (let i = 0; i < args.length; i++) charge(logicalSize(args[i], argTypes[i], sizes));

		const writer = new Writer('decimal', true);
		const outgoing = args.map((arg, i) => writer.write(arg, argTypes[i])) as never[];

		const { cost, run } = definition;
		if (cost !== undefined) {
			const steps: unknown = hostCall(`${label} cost`, () => cost(...outgoing));
			if (typeof steps !== 'number' || Number.isNaN(steps) || steps < 0) {
				throw failure('host-error', 'cost must return a number that is not negative');
			}
			if (steps === Number.POSITIVE_INFINITY) exhaust();
			charge(steps);
		}

		const returned: unknown = hostCall(label, () => run(...outgoing));
		const reader = new Reader('host-error', frame.bindings, this.abstracts, true);
		const value = reader.cross(returned, result);
		reader.checkLimits(result);
		charge(logicalSize(value, result, new Map()));
		return value;
	}
}
