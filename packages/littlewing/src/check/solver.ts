import type {
	AbstractDefinition,
	Optional,
	Signature,
	Type as HostType,
	TypeNode,
} from '../define.js';
import type { Diagnostic } from '../diagnostics.js';
import { errorAt } from '../diagnostics.js';
import { charge } from '../limits.js';
import type { Call, Expression, Node } from '../syntax/ast.js';
import type { FieldType, Type } from './types.js';
import {
	AbstractTypeRef,
	ARRAY_CLASSES,
	ArrayType,
	BOOLEAN,
	BOOLEAN_CLASSES,
	CLASS_BITS,
	classesOfDefinition,
	closedRecord,
	EQUATABLE,
	ERROR,
	forEachField,
	Meeting,
	NUMBER,
	NUMBER_CLASSES,
	openRecord,
	printType,
	prune,
	pruneMeeting,
	pruneRecord,
	pruneRow,
	RECORD_CLASSES,
	RecordType,
	Row,
	STRING,
	STRING_CLASSES,
	TypeVariable,
} from './types.js';

/** Unification deeper than this is past the limit on the depth of a type. */
const MAX_LEVEL = 300;

/** Keeps a hostile program from turning every expression into a report. */
const MAX_REPORTS = 100;

/**
 * Steps for copying a field. A step buys 16 bytes, and a field takes about this
 * many times that in a map.
 */
const FIELD_STEPS = 8;

type Message = string | (() => string);

/** A member of a record literal, once typed. */
export type LiteralMember =
	| { readonly kind: 'field'; readonly name: string; readonly type: Type; readonly node: Node }
	| { readonly kind: 'spread'; readonly type: Type; readonly node: Node };

/** A record literal with a spread, which waits until its operands are known. */
export interface SpreadLiteral {
	readonly node: Node;
	readonly order: number;
	readonly members: readonly LiteralMember[];
	readonly result: RecordType;
	done: boolean;
}

/** A container or iterable whose type is not known yet. */
interface Container {
	readonly type: TypeVariable;
	readonly order: number;
	readonly node: Node;
}

/** A call of an overloaded function that its arguments have not decided yet. */
export interface WaitingCall {
	readonly node: Call;
	readonly order: number;
	readonly overloads: readonly Signature[];
	readonly args: readonly Type[];
	readonly argNodes: readonly Expression[];
	readonly result: Type;
	done: boolean;
}

function isOptional(type: HostType | Optional): type is Optional {
	return type.kind === 'optional';
}

function failedRecord(): RecordType {
	const record = closedRecord(new Map());
	record.failed = true;
	return record;
}

/** Whether a type is what a failure left, which reports nothing more. */
function isBroken(type: Type): boolean {
	return type === ERROR || (type instanceof RecordType && type.failed);
}

/**
 * Steps a node of a signature costs each time it is instantiated. A record field that
 * is itself a record allocates several objects and maps, and whatever is built here
 * then goes through the type measure and the schema too, so at much less a formula of
 * ordinary calls could run the compiler out of memory inside its budget, which on Node
 * cannot even be caught.
 */
const INSTANTIATE_STEPS = 32;

export class Solver {
	readonly errors: Diagnostic[] = [];
	readonly warnings: Diagnostic[] = [];
	readonly queue: (() => void)[] = [];
	readonly spreads: SpreadLiteral[] = [];
	readonly containers: Container[] = [];
	readonly calls: WaitingCall[] = [];
	/** Variables that may fall to the last rule of language section 6.5. */
	readonly classed: TypeVariable[] = [];
	readonly resolved: Map<Call, Signature> = new Map();
	/** Records in `equatable`, which may not still be open when solving ends. */
	readonly equatableRecords: { readonly record: RecordType; readonly node: Node }[] = [];
	/** Set if unification gave up on a type too deep to walk. */
	tooDeep: Node | undefined;
	readonly abstracts: Map<AbstractDefinition, AbstractTypeRef> = new Map();
	/** One set of parameters per signature, as a call can be tried again and again. */
	private readonly trials = new Map<Signature, readonly Type[]>();
	private readonly admitted = new Map<number, readonly Type[]>();
	private nextId: number = 0;

	report(code: string, message: Message, node: Node): void {
		if (this.errors.length < MAX_REPORTS) {
			const text = typeof message === 'string' ? message : message();
			this.errors.push(errorAt(code, text, node.start, node.end));
		}
	}

	warn(code: string, message: string, node: Node): void {
		if (this.warnings.length < MAX_REPORTS) {
			const { start, end } = node;
			this.warnings.push({ code, severity: 'warning', message, start, end });
		}
	}

	mismatch(message: Message, node: Node): typeof ERROR {
		this.report('type-mismatch', message, node);
		return ERROR;
	}

	fresh(classes = 0): TypeVariable {
		const variable = new TypeVariable(this.nextId++, classes);
		if (classes !== 0) this.classed.push(variable);
		return variable;
	}

	abstract(definition: AbstractDefinition): AbstractTypeRef {
		let reference = this.abstracts.get(definition);
		if (reference === undefined) {
			reference = new AbstractTypeRef(definition, classesOfDefinition(definition));
			this.abstracts.set(definition, reference);
			this.admitted.clear();
		}
		return reference;
	}

	/**
	 * The types a class still allows, apart from arrays and records. A string is
	 * allowed wherever they are, so this is only empty if nothing is left.
	 */
	private admits(classes: number): readonly Type[] {
		let types = this.admitted.get(classes);
		if (types === undefined) {
			const fits = (own: number): boolean => (classes & own) === classes;
			const list: Type[] = [];
			if (fits(NUMBER_CLASSES)) list.push(NUMBER);
			if (fits(STRING_CLASSES)) list.push(STRING);
			if (fits(BOOLEAN_CLASSES)) list.push(BOOLEAN);
			for (const reference of this.abstracts.values()) {
				if (fits(reference.classes)) list.push(reference);
			}
			types = list;
			this.admitted.set(classes, types);
		}
		return types;
	}

	allowsArrays(classes: number): boolean {
		return (classes & ARRAY_CLASSES) === classes;
	}

	private allowsContainers(classes: number): boolean {
		return this.allowsArrays(classes) || (classes & RECORD_CLASSES) === classes;
	}

	allowsNumber(classes: number): boolean {
		return (classes & NUMBER_CLASSES) === classes;
	}

	private classesOf(type: Type): number {
		switch (type.tag) {
			case 'number':
				return NUMBER_CLASSES;
			case 'string':
				return STRING_CLASSES;
			case 'boolean':
				return BOOLEAN_CLASSES;
			case 'array':
				return ARRAY_CLASSES;
			case 'record':
				return RECORD_CLASSES;
			case 'abstract':
				return type.classes;
			default:
				return -1;
		}
	}

	private wake(waiters: (() => void)[] | undefined): void {
		if (waiters !== undefined) for (const waiter of waiters) this.queue.push(waiter);
	}

	/** Run what is waiting until nothing can move. */
	drain(): void {
		while (this.queue.length > 0) (this.queue.pop() as () => void)();
	}

	private fail(variable: TypeVariable): void {
		variable.link = ERROR;
		this.wake(variable.waiters);
	}

	/** Bind a variable whose class allows one type, as language section 6.5 says. */
	private settle(variable: TypeVariable, node: Node): void {
		const allowed = this.admits(variable.classes);
		if (allowed.length === 0) {
			this.mismatch('No type can do all of what this needs', node);
			this.fail(variable);
		} else if (allowed.length === 1 && !this.allowsContainers(variable.classes)) {
			this.bind(variable, allowed[0] as Type, node, 0);
		}
	}

	private addClass(variable: TypeVariable, bit: number, node: Node): void {
		if ((variable.classes & bit) === bit) return;
		if (variable.classes === 0) this.classed.push(variable);
		variable.classes |= bit;
		this.settle(variable, node);
	}

	/** Put a type in a class, giving whether it can be. */
	require(type: Type, bit: number, node: Node, describe: string): boolean {
		const current = prune(type);
		if (isBroken(current)) return false;
		if (current instanceof TypeVariable) {
			this.addClass(current, bit, node);
			return true;
		}
		if ((this.classesOf(current) & bit) === 0) {
			this.mismatch(() => `${describe}, and ${printType(current)} cannot`, node);
			return false;
		}
		if (bit === EQUATABLE) this.markEquatable(current, node, 0);
		return true;
	}

	private markRow(row: Row, node: Node, level: number): void {
		const root = pruneRow(row);
		if (root.equatable) return;
		root.equatable = true;
		for (const field of root.fields.values()) this.markEquatable(field.type, node, level + 1);
		if (root.uniform !== undefined) this.markEquatable(root.uniform, node, level + 1);
	}

	/** A type in `equatable` takes what it contains with it. */
	markEquatable(type: Type, node: Node, level: number): void {
		charge(1);
		const current = prune(type);
		if (level > MAX_LEVEL) {
			this.tooDeep ??= node;
			return;
		}
		if (current instanceof TypeVariable) {
			this.addClass(current, EQUATABLE, node);
		} else if (current instanceof ArrayType) {
			if (!current.equatable) {
				current.equatable = true;
				this.markEquatable(current.element, node, level + 1);
			}
		} else if (current instanceof RecordType) {
			if (current.pending !== undefined) {
				current.pending.push(() => {
					this.markEquatable(current, node, level);
				});
			} else if (!current.equatable) {
				current.equatable = true;
				this.equatableRecords.push({ record: current, node });
				for (const field of current.fields.values()) {
					this.markEquatable(field.type, node, level + 1);
				}
				if (current.uniform !== undefined) this.markEquatable(current.uniform, node, level + 1);
				if (current.row !== undefined) this.markRow(current.row, node, level);
			}
		} else if (current instanceof AbstractTypeRef && (current.classes & EQUATABLE) === 0) {
			this.mismatch(() => `${printType(current)} cannot be compared`, node);
		}
	}

	/** Whether a variable occurs in a type, by a loop, as a type can be deep before it fails. */
	private occurs(variable: TypeVariable, type: Type): boolean {
		const pending: Type[] = [type];
		const seen = new Set<object>();
		while (pending.length > 0) {
			charge(1);
			const current = prune(pending.pop() as Type);
			if (current === variable) return true;
			if (current instanceof ArrayType) {
				if (!seen.has(current)) {
					seen.add(current);
					pending.push(current.element);
				}
			} else if (current instanceof RecordType) {
				if (!seen.has(current)) {
					seen.add(current);
					forEachField(current, (_, field) => {
						pending.push(field.type);
					});
				}
			} else if (current instanceof TypeVariable && current.element !== undefined) {
				if (!seen.has(current)) {
					seen.add(current);
					pending.push(current.element);
				}
			}
		}
		return false;
	}

	private bind(variable: TypeVariable, type: Type, node: Node, level: number): void {
		if (this.occurs(variable, type)) {
			this.mismatch('A type cannot contain itself', node);
			this.fail(variable);
			return;
		}

		const { classes, element, waiters } = variable;
		if (classes !== 0 && (this.classesOf(type) & classes) !== classes) {
			this.mismatch(() => `${printType(type)} cannot do what this needs`, node);
			this.fail(variable);
			return;
		}

		variable.link = type;
		if ((classes & EQUATABLE) !== 0) this.markEquatable(type, node, level);
		if (element !== undefined) this.joinElement(type, element, node, level);
		this.wake(waiters);
	}

	/** A container is known: what was read from it is its element. */
	private joinElement(container: Type, element: Type, node: Node, level: number): void {
		if (container instanceof ArrayType) this.unify(container.element, element, node, level + 1);
		else if (container === STRING) this.unify(STRING, element, node, level + 1);
		else if (container instanceof RecordType) this.makeUniform(container, element, node, level + 1);
	}

	/** Make two types one, reporting at `node` if they cannot be. */
	unify(left: Type, right: Type, node: Node, level = 0): void {
		charge(1);
		const a = prune(left);
		const b = prune(right);
		if (a === b || isBroken(a) || isBroken(b)) return;
		if (level > MAX_LEVEL) {
			// Too deep, or infinite, which only a walk of the final types can tell
			this.tooDeep ??= node;
			return;
		}

		if (a instanceof TypeVariable) {
			if (b instanceof TypeVariable) this.mergeVariables(a, b, node, level);
			else this.bind(a, b, node, level);
		} else if (b instanceof TypeVariable) {
			this.bind(b, a, node, level);
		} else if (a instanceof ArrayType && b instanceof ArrayType) {
			this.unify(a.element, b.element, node, level + 1);
		} else if (a instanceof RecordType && b instanceof RecordType) {
			this.unifyRecords(a, b, node, level);
		} else {
			this.mismatch(() => `Expected ${printType(a)}, got ${printType(b)}`, node);
		}
	}

	private mergeVariables(a: TypeVariable, b: TypeVariable, node: Node, level: number): void {
		// The larger list stays where it is, so a chain of merges stays linear
		const small = (a.waiters?.length ?? 0) > (b.waiters?.length ?? 0) ? b : a;
		const large = small === a ? b : a;
		const classes = small.classes | large.classes;

		small.link = large;
		if (large.classes === 0 && classes !== 0) this.classed.push(large);
		large.classes = classes;

		if (small.waiters !== undefined) {
			if (large.waiters === undefined) large.waiters = small.waiters;
			else for (const waiter of small.waiters) large.waiters.push(waiter);
			small.waiters = undefined;
		}
		if (small.element !== undefined) {
			if (large.element === undefined) large.element = small.element;
			else this.unify(small.element, large.element, node, level + 1);
		}
		if (classes !== 0 && prune(large) === large) this.settle(large, node);
	}

	/** The set of waiting records this one belongs to. */
	private meetingOf(record: RecordType): Meeting {
		if (record.meeting === undefined) {
			record.meeting = new Meeting();
			record.meeting.waiting = 1;
		}
		return pruneMeeting(record.meeting);
	}

	/** Run the literals spreading a set, once, as they only need to hear this once. */
	private wakeSpreads(meeting: Meeting): void {
		const root = pruneMeeting(meeting);
		this.wake(root.spreads);
		root.spreads = undefined;
	}

	/** Whatever meets a waiting record is one type with it, from this moment. */
	private meet(waiting: RecordType, other: RecordType, node: Node, level: number): void {
		const meeting = this.meetingOf(waiting);
		if (other.pending === undefined) {
			this.joinMeeting(meeting, other, node, level);
			return;
		}

		const theirs = this.meetingOf(other);
		if (theirs === meeting) return;
		theirs.link = meeting;
		meeting.waiting += theirs.waiting;
		const ours = meeting.spreads ?? [];
		const others = theirs.spreads ?? [];
		// The larger list stays where it is, so a chain of meetings stays linear
		const [small, large] = ours.length < others.length ? [ours, others] : [others, ours];
		for (const retry of small) large.push(retry);
		meeting.spreads = large;
		theirs.spreads = undefined;
		if (theirs.known !== undefined) {
			this.joinMeeting(meeting, theirs.known, theirs.node ?? node, level);
		}
	}

	private joinMeeting(meeting: Meeting, record: RecordType, node: Node, level: number): void {
		if (meeting.known !== undefined) {
			this.unify(meeting.known, record, node, level);
			return;
		}
		meeting.known = record;
		meeting.node = node;
		record.meeting ??= meeting;
		if (record.closed) this.wakeSpreads(meeting);
		else {
			// Open for now, and what closes it decides whatever is spreading this set
			const row = pruneRow(record.row as Row);
			(row.closing ??= []).push(() => {
				this.wakeSpreads(meeting);
			});
		}
	}

	private unifyRecords(left: RecordType, right: RecordType, node: Node, level: number): void {
		if (left.pending !== undefined) this.meet(left, right, node, level);
		else if (right.pending !== undefined) this.meet(right, left, node, level);
		else if (left.closed && right.closed) this.unifyClosed(left, right, node, level);
		else if (left.closed) this.closeRecord(right, left, node, level);
		else if (right.closed) this.closeRecord(left, right, node, level);
		else this.mergeOpen(left, right, node, level);
	}

	private joinField(from: FieldType, to: FieldType, node: Node, level: number): void {
		this.unify(from.type, to.type, node, level + 1);
		to.required ||= from.required;
		if (from.absent === true) to.absent = true;
	}

	private unifyClosed(a: RecordType, b: RecordType, node: Node, level: number): void {
		const differ = (): void => {
			this.mismatch(() => `Expected ${printType(a)}, got ${printType(b)}`, node);
		};
		if (a.fields.size !== b.fields.size) {
			differ();
			return;
		}
		for (const name of a.fields.keys()) {
			charge(1);
			if (!b.fields.has(name)) {
				differ();
				return;
			}
		}
		// Once linked, a later meeting is immediate, however much the types share
		a.link = b;
		for (const [name, field] of a.fields) {
			this.joinField(field, b.fields.get(name) as FieldType, node, level);
		}
		this.afterJoin(a, b, node, level);
	}

	/** Everything a uniform or `equatable` record promised holds for what it became. */
	private afterJoin(from: RecordType, to: RecordType, node: Node, level: number): void {
		if (from.uniform !== undefined) this.makeUniform(to, from.uniform, node, level + 1);
		if (from.equatable) this.markEquatable(to, node, level + 1);
	}

	private closeRecord(open: RecordType, closed: RecordType, node: Node, level: number): void {
		// A record with fields of its own is a spread's result, whose row is sealed
		const row = pruneRow(open.row as Row);
		if (row.sealed) {
			this.mismatch(() => `A spread of an open record cannot be ${printType(closed)}`, node);
			return;
		}

		for (const name of row.fields.keys()) {
			charge(1);
			if (!closed.fields.has(name)) {
				this.mismatch(() => `${printType(closed)} has no field ${name.slice(0, 40)}`, node);
				return;
			}
		}
		open.link = closed;
		for (const [name, field] of row.fields) {
			this.joinField(field, closed.fields.get(name) as FieldType, node, level);
		}
		if (row.uniform !== undefined) this.makeUniform(closed, row.uniform, node, level + 1);
		if (row.equatable) this.markEquatable(closed, node, level + 1);
		this.afterJoin(open, closed, node, level);
		this.wake(row.closing);
	}

	/** Make two rows one, moving the smaller into the larger. */
	private mergeRows(left: Row, right: Row, node: Node, level: number): Row {
		const a = pruneRow(left);
		const b = pruneRow(right);
		if (a === b) return a;

		const from = a.fields.size > b.fields.size ? b : a;
		const into = from === a ? b : a;
		from.link = into;
		for (const [name, field] of from.fields) {
			charge(FIELD_STEPS);
			const known = into.fields.get(name);
			if (known !== undefined) {
				this.joinField(field, known, node, level);
			} else {
				into.fields.set(name, field);
				if (into.uniform !== undefined) this.unify(field.type, into.uniform, node, level + 1);
			}
		}
		from.fields.clear();

		into.sealed ||= from.sealed;
		if (from.closing !== undefined) {
			if (into.closing === undefined) into.closing = from.closing;
			else for (const waiter of from.closing) into.closing.push(waiter);
		}
		if (from.uniform !== undefined) this.makeRowUniform(into, from.uniform, node, level + 1);
		if (from.equatable) this.markRow(into, node, level);
		else if (into.equatable) {
			for (const field of into.fields.values()) this.markEquatable(field.type, node, level + 1);
		}
		return into;
	}

	/**
	 * A record that spells out `name` meets `other`, which does not. A row nothing
	 * else shares gives the name up, as `other` is that record now, and whatever it
	 * knew about the name holds for the field. A shared row keeps it, as what shares
	 * the row still has its own view of that name.
	 */
	private matchSpelled(
		name: string,
		field: FieldType,
		other: RecordType,
		row: Row,
		node: Node,
		level: number,
	): void {
		const root = pruneRow(row);
		if (other.fields.size > 0 || root.sealed) {
			const type = this.readRow(root, name, field.required, node);
			this.unify(field.type, type, node, level + 1);
			return;
		}

		const known = root.fields.get(name);
		if (known !== undefined) {
			this.joinField(known, field, node, level);
			root.fields.delete(name);
		}
		if (root.uniform !== undefined) this.unify(field.type, root.uniform, node, level + 1);
	}

	/**
	 * Two open records are one, with one row. What one spells out, the other holds
	 * in its row, and the name stays hidden there for whatever else shares that row.
	 */
	private mergeOpen(left: RecordType, right: RecordType, node: Node, level: number): void {
		const from = left.fields.size > right.fields.size ? right : left;
		const into = from === left ? right : left;
		const fromRow = from.row as Row;
		const intoRow = into.row as Row;

		from.link = into;
		into.meeting ??= from.meeting;
		for (const [name, field] of from.fields) {
			const known = into.fields.get(name);
			if (known !== undefined) this.joinField(field, known, node, level);
			else this.matchSpelled(name, field, into, intoRow, node, level);
		}
		for (const [name, field] of into.fields) {
			if (!from.fields.has(name)) this.matchSpelled(name, field, from, fromRow, node, level);
		}
		for (const [name, field] of from.fields) {
			charge(FIELD_STEPS);
			if (!into.fields.has(name)) into.fields.set(name, field);
		}
		from.fields.clear();

		into.row = this.mergeRows(fromRow, intoRow, node, level);
		this.afterJoin(from, into, node, level);
	}

	private readRow(row: Row, name: string, required: boolean, node: Node): Type {
		const root = pruneRow(row);
		const field = root.fields.get(name);
		if (field !== undefined) {
			field.required ||= required;
			return field.type;
		}
		charge(FIELD_STEPS);
		const type = root.uniform ?? this.fresh();
		root.fields.set(name, { type, required });
		if (root.equatable) this.markEquatable(type, node, 0);
		return type;
	}

	private makeRowUniform(row: Row, value: Type, node: Node, level: number): void {
		const root = pruneRow(row);
		if (root.uniform !== undefined) {
			this.unify(root.uniform, value, node, level + 1);
			return;
		}
		root.uniform = value;
		for (const field of root.fields.values()) this.unify(field.type, value, node, level + 1);
	}

	makeUniform(record: RecordType, value: Type, node: Node, level = 0): void {
		const current = pruneRecord(record);
		if (current.failed) return;
		if (current.pending !== undefined) {
			current.pending.push(() => {
				this.makeUniform(current, value, node, level);
			});
			return;
		}
		if (current.uniform !== undefined) {
			this.unify(current.uniform, value, node, level + 1);
			return;
		}
		current.uniform = value;
		for (const field of current.fields.values()) this.unify(field.type, value, node, level + 1);
		if (current.row !== undefined) this.makeRowUniform(current.row, value, node, level);
	}

	/** The type of a field. `required` is false for a step of the path of a `??`. */
	readField(object: Type, name: string, required: boolean, node: Node): Type {
		const current = prune(object);
		if (isBroken(current)) return ERROR;

		if (current instanceof TypeVariable) {
			const record = openRecord();
			this.bind(current, record, node, 0);
			if (prune(current) !== record) return ERROR;
			return this.readField(record, name, required, node);
		}
		if (!(current instanceof RecordType)) {
			return this.mismatch(() => `${printType(current)} has no fields`, node);
		}

		if (current.pending !== undefined) {
			const result = this.fresh();
			current.pending.push(() => {
				this.unify(result, this.readField(current, name, required, node), node);
			});
			return result;
		}

		const field = current.fields.get(name);
		if (field !== undefined) {
			field.required ||= required;
			return field.type;
		}
		if (current.closed) {
			return this.mismatch(() => `${printType(current)} has no field ${name.slice(0, 40)}`, node);
		}
		return this.readRow(current.row as Row, name, required, node);
	}

	/** The element of a container not yet known, which may fall to rule 2 of section 6.5. */
	container(type: TypeVariable, order: number, node: Node): Type {
		type.element ??= this.fresh();
		this.containers.push({ type, order, node });
		return type.element;
	}

	/** `e[i]`: language section 6.3. */
	solveIndex(container: Type, index: Type, element: Type, node: Node): void {
		const c = prune(container);
		const i = prune(index);
		if (c === ERROR || i === ERROR) return;

		if (c instanceof TypeVariable) {
			if (i === STRING) {
				const record = openRecord();
				this.bind(c, record, node, 0);
				this.solveIndex(record, index, element, node);
				return;
			}
			const retry = (): void => {
				this.solveIndex(container, index, element, node);
			};
			(c.waiters ??= []).push(retry);
			if (i instanceof TypeVariable) (i.waiters ??= []).push(retry);
			return;
		}

		if (c instanceof ArrayType || c === STRING) {
			this.unify(NUMBER, index, node);
			this.unify(element, c === STRING ? STRING : (c as ArrayType).element, node);
		} else if (c instanceof RecordType) {
			this.unify(STRING, index, node);
			this.makeUniform(c, element, node);
		}
	}

	/** `for c in e` over a type already known: language section 6.3. */
	solveIteration(iterable: Type, element: Type, node: Node): void {
		const e = prune(iterable);
		if (e instanceof ArrayType) this.unify(element, e.element, node);
		else if (e === STRING) this.unify(element, STRING, node);
	}

	/**
	 * A type of a signature, with its variables shared through `scope`. A `trial`
	 * type only tests whether an overload fits, and leaves nothing behind. The
	 * optional fields of what a function returns can be `absent`, whatever reads them.
	 */
	instantiate(
		type: HostType | Optional,
		scope: Map<string, TypeVariable>,
		trial = false,
		returned = false,
	): Type {
		charge(INSTANTIATE_STEPS);
		const shape = (isOptional(type) ? type.type : type) as TypeNode;
		switch (shape.kind) {
			case 'number':
				return NUMBER;
			case 'string':
			case 'oneOf':
				return STRING;
			case 'boolean':
				return BOOLEAN;
			case 'abstract':
				return this.abstract(shape.definition);
			case 'array':
				return new ArrayType(this.instantiate(shape.element, scope, trial, returned));
			case 'uniform': {
				const record = openRecord();
				(record.row as Row).uniform = this.instantiate(shape.value, scope, trial, returned);
				return record;
			}
			case 'record': {
				const fields = new Map<string, FieldType>();
				for (const name of Object.keys(shape.fields)) {
					const field = shape.fields[name] as HostType | Optional;
					fields.set(name, {
						type: this.instantiate(field, scope, trial, returned),
						required: !isOptional(field),
						absent: returned && isOptional(field),
					});
				}
				return shape.open ? openRecord(fields) : closedRecord(fields);
			}
			case 'var': {
				let variable = scope.get(shape.variable);
				if (variable === undefined) {
					const classes = shape.typeClass === undefined ? 0 : CLASS_BITS[shape.typeClass];
					variable = trial ? new TypeVariable(-1, classes, true) : this.fresh(classes);
					scope.set(shape.variable, variable);
				}
				return variable;
			}
		}
	}

	private compatibleRecords(
		param: RecordType,
		arg: RecordType,
		bound: Map<TypeVariable, Type>,
		level: number,
	): boolean {
		const argFields = new Map<string, FieldType>();
		forEachField(arg, (name, field) => {
			charge(1);
			argFields.set(name, field);
		});
		const paramFields = new Map<string, FieldType>();
		forEachField(param, (name, field) => {
			paramFields.set(name, field);
		});

		const argRow = arg.row === undefined ? undefined : pruneRow(arg.row);
		if (param.closed && argRow?.sealed === true) return false;
		if (param.closed && arg.closed && paramFields.size !== argFields.size) return false;

		for (const [name, field] of paramFields) {
			const other = argFields.get(name);
			if (other === undefined) {
				if (arg.closed) return false;
			} else if (!this.compatible(field.type, other.type, bound, level + 1)) {
				return false;
			}
		}
		for (const name of argFields.keys()) {
			if (param.closed && !paramFields.has(name)) return false;
		}

		const uniform = param.row === undefined ? undefined : pruneRow(param.row).uniform;
		if (uniform !== undefined) {
			for (const field of argFields.values()) {
				if (!this.compatible(uniform, field.type, bound, level + 1)) return false;
			}
		}
		return true;
	}

	/** Whether a type of a signature fits an argument, without changing either. */
	private compatible(
		parameter: Type,
		argument: Type,
		bound: Map<TypeVariable, Type>,
		level: number,
	): boolean {
		charge(1);
		const a = prune(parameter);
		const b = prune(argument);
		if (a === b || isBroken(a) || isBroken(b) || level > MAX_LEVEL) return true;

		if (a instanceof TypeVariable) {
			const earlier = bound.get(a);
			if (earlier !== undefined) return this.compatible(earlier, b, bound, level + 1);
			if (a.trial) bound.set(a, b);
			return b instanceof TypeVariable
				? this.admits(a.classes | b.classes).length > 0
				: (this.classesOf(b) & a.classes) === a.classes;
		}
		if (b instanceof TypeVariable) return (this.classesOf(a) & b.classes) === b.classes;
		if (a instanceof ArrayType && b instanceof ArrayType) {
			return this.compatible(a.element, b.element, bound, level + 1);
		}
		if (a instanceof RecordType && b instanceof RecordType) {
			return b.pending !== undefined || this.compatibleRecords(a, b, bound, level);
		}
		return false;
	}

	/** The parameters of a signature to try arguments on, which trying leaves unchanged. */
	private trialOf(signature: Signature): readonly Type[] {
		let params = this.trials.get(signature);
		if (params === undefined) {
			const scope = new Map<string, TypeVariable>();
			params = signature.args.map((param) => this.instantiate(param, scope, true));
			this.trials.set(signature, params);
		}
		return params;
	}

	private fitsOverload(call: WaitingCall, signature: Signature): boolean {
		charge(signature.args.length + 1);
		const params = this.trialOf(signature);
		const bound = new Map<TypeVariable, Type>();
		return call.args.every((arg, i) => {
			const param = signature.args[i] as HostType | Optional;
			const fits = this.compatible(params[i] as Type, arg, bound, 0);
			return fits && !this.outsideList(param, this.literalOf(call, i));
		});
	}

	/** The expression at an argument, which for a placeholder is what was piped. */
	private literalOf(call: WaitingCall, index: number): Expression {
		const arg = call.argNodes[index] as Expression;
		return arg.kind === 'placeholder' ? (call.node.piped ?? arg) : arg;
	}

	private outsideList(param: HostType | Optional, arg: Expression): boolean {
		const shape = (isOptional(param) ? param.type : param) as TypeNode;
		return shape.kind === 'oneOf' && arg.kind === 'string' && !shape.values.includes(arg.value);
	}

	/** Apply one signature to a call. */
	commit(call: WaitingCall, signature: Signature): void {
		call.done = true;
		this.resolved.set(call.node, signature);
		const scope = new Map<string, TypeVariable>();
		call.args.forEach((arg, i) => {
			const param = signature.args[i] as HostType | Optional;
			const node = call.argNodes[i] as Node;
			this.unify(this.instantiate(param, scope), arg, node);
			const literal = this.literalOf(call, i);
			if (this.outsideList(param, literal)) {
				this.mismatch('This is not one of the accepted strings', literal);
			}
		});
		this.unify(call.result, this.instantiate(signature.returns, scope, false, true), call.node);
	}

	/** Decide an overloaded call if its arguments leave one signature. */
	tryCall(call: WaitingCall): void {
		const fitting = call.overloads.filter((signature) => this.fitsOverload(call, signature));
		if (fitting.length === 0) {
			call.done = true;
			this.mismatch(
				`No overload of ${call.node.name.slice(0, 40)} takes these arguments`,
				call.node,
			);
			const result = prune(call.result);
			if (result instanceof TypeVariable) this.fail(result);
		} else if (fitting.length === 1) {
			this.commit(call, fitting[0] as Signature);
		}
	}

	/** Rule 3 of language section 6.5. */
	decideCall(call: WaitingCall): void {
		const first = call.overloads.find((signature) => this.fitsOverload(call, signature));
		if (first === undefined) this.tryCall(call);
		else this.commit(call, first);
	}

	/** A record literal's spread operand, made into a record if it is not known. */
	operandRecord(type: Type, node: Node): RecordType | undefined {
		const current = prune(type);
		if (isBroken(current)) return undefined;
		if (current instanceof TypeVariable) {
			const record = openRecord();
			this.bind(current, record, node, 0);
			return prune(current) === record ? record : undefined;
		}
		if (current instanceof RecordType) return current;
		this.mismatch(() => `Cannot spread ${printType(current)}`, node);
		return undefined;
	}

	/**
	 * What a spread can read of its operand. A waiting record that has met a closed
	 * one is that record, as a spread only waits until its operand is closed.
	 */
	private operandOf(type: Type): RecordType | undefined {
		const record = prune(type);
		if (!(record instanceof RecordType)) return undefined;
		if (record.pending === undefined || record.meeting === undefined) return record;

		const { known } = pruneMeeting(record.meeting);
		if (known === undefined) return record;
		const current = pruneRecord(known);
		return current.closed ? current : record;
	}

	private operands(literal: SpreadLiteral): RecordType[] {
		const records: RecordType[] = [];
		for (const member of literal.members) {
			if (member.kind === 'spread') {
				charge(1);
				const record = this.operandOf(member.type);
				if (record !== undefined) records.push(record);
			}
		}
		return records;
	}

	/** Give a waiting literal its type, and release what waited for it. */
	private finishSpread(literal: SpreadLiteral, type: RecordType): void {
		const { result } = literal;
		const waiting = result.pending;
		const { meeting } = result;
		literal.done = true;
		result.pending = undefined;
		result.link = type;
		if (meeting !== undefined) {
			const root = pruneMeeting(meeting);
			root.waiting--;
			this.joinMeeting(root, type, root.node ?? literal.node, 0);
		}
		this.wake(waiting);
	}

	/** The fields a literal spells out, from `members` on, with later ones replacing. */
	private spelledFields(members: readonly LiteralMember[]): Map<string, FieldType> {
		const fields = new Map<string, FieldType>();
		for (const member of members) {
			if (member.kind === 'field') {
				charge(FIELD_STEPS);
				fields.set(member.name, { type: member.type, required: true });
				continue;
			}
			const record = this.operandOf(member.type);
			if (record !== undefined) {
				for (const [name, field] of record.fields) {
					charge(FIELD_STEPS);
					fields.set(name, { type: field.type, required: field.required });
				}
			}
		}
		return fields;
	}

	/** Resolve a literal once all its operands are closed, as then its type is known. */
	trySpread(literal: SpreadLiteral): void {
		if (literal.done) return;
		const operands = this.operands(literal);
		if (operands.some((record) => record.failed)) {
			this.finishSpread(literal, failedRecord());
			return;
		}
		if (operands.some((record) => !record.closed || record.pending !== undefined)) return;
		this.finishSpread(literal, closedRecord(this.spelledFields(literal.members)));
	}

	/** Wait for every operand of a literal. */
	watchSpread(literal: SpreadLiteral): void {
		const retry = (): void => {
			this.trySpread(literal);
		};
		for (const record of this.operands(literal)) {
			if (record.pending !== undefined) {
				record.pending.push(retry);
				(this.meetingOf(record).spreads ??= []).push(retry);
			} else if (!record.closed) (pruneRow(record.row as Row).closing ??= []).push(retry);
		}
		this.trySpread(literal);
	}

	/** Rule 1 of language section 6.5: the literal's open operand is taken as open. */
	openSpread(literal: SpreadLiteral): void {
		const { members } = literal;
		const open = this.operands(literal).filter((record) => !record.closed);
		const [operand] = open;
		if (operand === undefined) {
			this.trySpread(literal);
			return;
		}

		const first = members[0];
		const firstRecord = first?.kind === 'spread' ? this.operandOf(first.type) : undefined;
		if (open.length > 1 || firstRecord !== operand) {
			this.mismatch(
				'A record that may have other fields must be spread first, and alone',
				literal.node,
			);
			this.finishSpread(literal, failedRecord());
			return;
		}

		// The operand's row is the result's, so a spread of a spread stays flat
		const row = pruneRow(operand.row as Row);
		row.sealed = true;
		this.finishSpread(literal, new RecordType(this.spelledFields(members), row, false));
	}

	/** Whether a literal cannot resolve until another literal has. */
	blockedOnSpread(literal: SpreadLiteral): boolean {
		return this.operands(literal).some((record) => record.pending !== undefined);
	}

	/**
	 * Whether a literal should let another literal go first. An open operand that has
	 * met a waiting record is one type with it, whichever became a variable first.
	 */
	waitsOnSpread(literal: SpreadLiteral): boolean {
		return this.operands(literal).some(
			(record) =>
				record.pending !== undefined ||
				(!record.closed &&
					record.meeting !== undefined &&
					pruneMeeting(record.meeting).waiting > 0),
		);
	}
}
