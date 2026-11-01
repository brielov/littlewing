import { charge } from '../limits.js';
import type { Type } from './types.js';
import {
	ArrayType,
	classNames,
	forEachField,
	prune,
	pruneRow,
	RecordType,
	TypeVariable,
} from './types.js';

export interface FieldDescription {
	readonly type: TypeDescription;
	readonly required: boolean;
}

/** A type as plain data, for a host to read. */
export type TypeDescription =
	| { readonly kind: 'number' | 'string' | 'boolean' }
	| { readonly kind: 'array'; readonly element: TypeDescription }
	| {
			readonly kind: 'record';
			readonly open: boolean;
			readonly fields: Readonly<Record<string, FieldDescription>>;
			readonly uniform?: TypeDescription;
	  }
	| { readonly kind: 'abstract'; readonly name: string }
	| { readonly kind: 'generic'; readonly id: number; readonly classes?: readonly string[] };

export interface InputDescription {
	readonly type: TypeDescription;
	readonly required: boolean;
	readonly default?: string | boolean;
}

export type InputSchema = Readonly<Record<string, InputDescription>>;

/**
 * The type every field has, for an open record with a uniform row: its own fields
 * have to agree too, as a spread can set anything over them.
 */
function uniformOf(record: RecordType): Type | undefined {
	const value = record.row === undefined ? undefined : pruneRow(record.row).uniform;
	if (value === undefined) return undefined;

	const type = prune(value);
	for (const field of record.fields.values()) {
		if (prune(field.type) !== type) return undefined;
	}
	return type;
}

/**
 * Write types as plain data. One type is one description, as many inputs can share
 * a large type, but each use is still charged what it costs a host to walk.
 */
export class TypeDescriber {
	private readonly known = new Map<Type, { description: TypeDescription; size: number }>();

	private write(type: Type): { description: TypeDescription; size: number } {
		const current = prune(type);
		const memo = this.known.get(current);
		if (memo !== undefined) return memo;

		let description: TypeDescription;
		let size = 1;
		if (current instanceof ArrayType) {
			const element = this.write(current.element);
			size += element.size;
			description = { kind: 'array', element: element.description };
		} else if (current instanceof RecordType) {
			const fields = Object.create(null) as Record<string, FieldDescription>;
			forEachField(current, (name, field) => {
				const written = this.write(field.type);
				size += written.size;
				fields[name] = {
					type: written.description,
					required: field.required && field.absent !== true,
				};
			});
			const open = !current.closed;
			const value = uniformOf(current);
			if (value === undefined) {
				description = { kind: 'record', open, fields };
			} else {
				const uniform = this.write(value);
				size += uniform.size;
				description = { kind: 'record', open, fields, uniform: uniform.description };
			}
		} else if (current instanceof TypeVariable) {
			const classes = classNames(current.classes);
			description =
				classes.length > 0
					? { kind: 'generic', id: current.id, classes }
					: { kind: 'generic', id: current.id };
		} else if (current.tag === 'abstract') {
			description = { kind: 'abstract', name: current.definition.name };
		} else if (current.tag === 'error') {
			description = { kind: 'generic', id: -1 };
		} else {
			description = { kind: current.tag };
		}

		const written = { description, size };
		this.known.set(current, written);
		return written;
	}

	describe(type: Type): TypeDescription {
		const { description, size } = this.write(type);
		charge(size);
		return description;
	}
}
