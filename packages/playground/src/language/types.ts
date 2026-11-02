import { compile, type CompileOptions, type TypeDescription } from 'littlewing';
import { isWord, TokenKind, type Token } from './tokens.ts';

/**
 * A type as the library writes types in function descriptions: `array<number>`,
 * `{ total: number, note?: string, ... }`. Type variables are named by `variable`,
 * so that one shared between two types gets one name.
 */
export function typeText(
	type: TypeDescription,
	variable: (id: number) => string = defaultVariables(),
): string {
	switch (type.kind) {
		case 'array':
			return `array<${typeText(type.element, variable)}>`;
		case 'record': {
			const fields = Object.entries(type.fields).map(
				([name, field]) => `${name}${field.required ? '' : '?'}: ${typeText(field.type, variable)}`,
			);
			if (type.uniform !== undefined) fields.push(`[key]: ${typeText(type.uniform, variable)}`);
			if (type.open) fields.push('...');
			return fields.length === 0 ? '{}' : `{ ${fields.join(', ')} }`;
		}
		case 'abstract':
			return type.name;
		case 'generic': {
			// A variable in classes is written as them, as `ordered`
			const name = variable(type.id);
			return type.classes === undefined ? name : `${name}: ${type.classes.join(' & ')}`;
		}
		default:
			return type.kind;
	}
}

/** Names for type variables, in the order they are met: T, U, V, and so on. */
export function defaultVariables(): (id: number) => string {
	const names = new Map<number, string>();
	return (id) => {
		let name = names.get(id);
		if (name === undefined) {
			const n = names.size;
			name = n < 7 ? 'TUVWXYZ'[n]! : `T${n}`;
			names.set(id, name);
		}
		return name;
	};
}

/**
 * The type of each top-level name, read by compiling the program with a record
 * of those names after it, which gives their types as its fields. Names the
 * program only reads are its inputs. Nothing comes back if it does not compile.
 */
export function namesTypes(
	source: string,
	names: readonly string[],
	options: CompileOptions,
): Map<string, TypeDescription> | undefined {
	const result = compile(`${source}\n{ ${names.join(', ')} }`, options);
	if (!result.ok) {
		// A record of every name can be too large to write out when each one is not,
		// so then the names are asked for in halves, if the record is all that fails
		const appended = source.length;
		const sized = result.diagnostics.every(
			({ code, severity, start }) =>
				severity !== 'error' || (code === 'type-too-large' && start > appended),
		);
		if (!sized || names.length < 2) return undefined;
		const half = names.length >> 1;
		const first = namesTypes(source, names.slice(0, half), options);
		const second = namesTypes(source, names.slice(half), options);
		if (first === undefined) return second;
		for (const [name, type] of second ?? []) first.set(name, type);
		return first;
	}
	const types = new Map<string, TypeDescription>();
	for (const [name, input] of Object.entries(result.program.inputs)) types.set(name, input.type);
	const { output } = result.program;
	if (output.kind === 'record') {
		for (const [name, field] of Object.entries(output.fields)) types.set(name, field.type);
	}
	return types;
}

/** How to find the type of the name a path starts with, which the token is. */
export type NameType = (token: Token) => TypeDescription | undefined;

/**
 * The type a field goes on from, for a path written before a `.` at `position`,
 * as `order.items[0].` gives the type of an item.
 */
export function typeBefore(
	tokens: readonly Token[],
	position: number,
	read: (from: number, to: number) => string,
	nameType: NameType,
): TypeDescription | undefined {
	const code = codeBefore(tokens, position);
	const dot = code.pop();
	if (dot?.kind !== TokenKind.Dot) return undefined;
	return walkPath(code, read, nameType, undefined);
}

/**
 * The type of the path that is all of `span`, as `order.items` in `for item in
 * order.items`: names, fields and indexes back to a name whose type is known.
 */
export function pathType(
	tokens: readonly Token[],
	span: { readonly from: number; readonly to: number },
	read: (from: number, to: number) => string,
	nameType: NameType,
): TypeDescription | undefined {
	return walkPath(codeBefore(tokens, span.to), read, nameType, span.from);
}

/** What a loop over a value of `type` binds: an element, or a code point of a string. */
export function elementOf(type: TypeDescription): TypeDescription | undefined {
	if (type.kind === 'array') return type.element;
	return type.kind === 'string' ? type : undefined;
}

/** The tokens that end at or before `position`, comments left out. */
function codeBefore(tokens: readonly Token[], position: number): Token[] {
	let end = tokens.length;
	while (end > 0 && tokens[end - 1]!.to > position) end--;
	return tokens.slice(0, end).filter((token) => token.kind !== 'comment');
}

/** The type of the path the last of `code` ends, starting at `start` if that is given. */
function walkPath(
	code: readonly Token[],
	read: (from: number, to: number) => string,
	nameType: NameType,
	start: number | undefined,
): TypeDescription | undefined {
	// From the last step back to the first; `undefined` is an index
	const steps: (string | undefined)[] = [];
	let i = code.length - 1;
	for (;;) {
		const token = code[i];
		if (token === undefined) return undefined;
		if (token.kind === TokenKind.RBracket) {
			const close = i;
			let depth = 0;
			for (; i >= 0; i--) {
				const kind = code[i]!.kind;
				if (kind === TokenKind.RBracket) depth++;
				else if (kind === TokenKind.LBracket && --depth === 0) break;
			}
			// A `[` that starts a line starts an array, and ends the path
			if (i < 0 || code[i]!.startsLine) return undefined;
			// A plain string is a field, and anything else an index
			const inner = code[i + 1];
			const key =
				close === i + 2 && inner?.kind === TokenKind.String
					? read(inner.from, inner.to)
					: undefined;
			steps.push(key !== undefined && !key.includes('\\') ? key.slice(1, -1) : undefined);
			i--;
			continue;
		}
		if (token.kind === 'comment' || !isWord(token.kind)) return undefined;
		if (code[i - 1]?.kind === TokenKind.Dot) {
			steps.push(read(token.from, token.to));
			i -= 2;
			continue;
		}
		if (token.kind !== TokenKind.Identifier) return undefined;
		if (start !== undefined && token.from !== start) return undefined;
		let type = nameType(token);
		for (let s = steps.length - 1; s >= 0 && type !== undefined; s--) {
			type = step(type, steps[s]);
		}
		return type;
	}
}

/** The type of field `by` of `type`, or of an element of it when `by` is undefined. */
function step(type: TypeDescription, by: string | undefined): TypeDescription | undefined {
	if (by === undefined) {
		if (type.kind === 'array') return type.element;
		return type.kind === 'record' ? type.uniform : undefined;
	}
	if (type.kind !== 'record') return undefined;
	return type.fields[by]?.type ?? type.uniform;
}
