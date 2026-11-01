/**
 * The syntax tree of a program. Nodes are plain data with string kinds, so a tree
 * can be printed and read back. Offsets are UTF-16 code units into the source.
 */
export interface Node {
	readonly start: number;
	readonly end: number;
}

/** Comments live on statements, as those are the only places they keep their position. */
interface Commented {
	readonly leadingComments?: readonly string[];
	readonly trailingComments?: readonly string[];
}

export interface Program extends Node {
	readonly kind: 'program';
	readonly statements: readonly Statement[];
	/** Comments on their own lines after the last statement. */
	readonly trailingComments?: readonly string[];
}

export type Statement = (Binding | Expression) & Commented;

/** `name = value`, or `name ?= value`, which declares an input with a default. */
export interface Binding extends Node {
	readonly kind: 'binding';
	readonly name: string;
	readonly input: boolean;
	readonly value: Expression;
}

/** A number as written, which is what `generate` gives back. */
export interface NumberLiteral extends Node {
	readonly kind: 'number';
	readonly text: string;
}

export interface StringLiteral extends Node {
	readonly kind: 'string';
	readonly value: string;
}

/** A string with interpolations: text and expressions in turn, with text at both ends. */
export interface Template extends Node {
	readonly kind: 'template';
	readonly parts: readonly (string | Expression)[];
}

export interface BooleanLiteral extends Node {
	readonly kind: 'boolean';
	readonly value: boolean;
}

export interface Name extends Node {
	readonly kind: 'name';
	readonly name: string;
}

export type BinaryOperator =
	| '+'
	| '-'
	| '*'
	| '/'
	| '%'
	| '^'
	| '=='
	| '!='
	| '<'
	| '>'
	| '<='
	| '>='
	| '&&'
	| '||';

export interface Binary extends Node {
	readonly kind: 'binary';
	readonly operator: BinaryOperator;
	readonly left: Expression;
	readonly right: Expression;
}

export interface Unary extends Node {
	readonly kind: 'unary';
	readonly operator: '-' | '!';
	readonly argument: Expression;
}

/** `path ?? fallback` */
export interface Fallback extends Node {
	readonly kind: 'fallback';
	readonly path: Expression;
	readonly fallback: Expression;
}

export interface RangeExpression extends Node {
	readonly kind: 'range';
	readonly from: Expression;
	readonly to: Expression;
	readonly inclusive: boolean;
}

export interface ArrayLiteral extends Node {
	readonly kind: 'array';
	readonly elements: readonly Expression[];
}

export interface RecordLiteral extends Node {
	readonly kind: 'record';
	readonly members: readonly RecordMember[];
}

export type RecordMember = Field | Spread;

/** `name: value`, or `name` alone as shorthand, where `value` is a `Name` of the same name. */
export interface Field extends Node {
	readonly kind: 'field';
	readonly name: string;
	readonly value: Expression;
	readonly shorthand: boolean;
}

export interface Spread extends Node {
	readonly kind: 'spread';
	readonly value: Expression;
}

export interface Member extends Node {
	readonly kind: 'member';
	readonly object: Expression;
	readonly name: string;
}

export interface Index extends Node {
	readonly kind: 'index';
	readonly object: Expression;
	readonly index: Expression;
}

export interface Call extends Node {
	readonly kind: 'call';
	readonly name: string;
	readonly args: readonly Expression[];
	/** After desugaring a pipe: evaluated first, and what placeholders in `args` read. */
	readonly piped?: Expression;
	/** After desugaring a pipe: the offset of the step, which is its source order. */
	readonly stepStart?: number;
	/** After desugaring interpolation: the core `STR`, whatever the host defines. */
	readonly core?: boolean;
}

/** `value |> name`, or `value |> name(args)`, where `args` holds placeholders. */
export interface Pipe extends Node {
	readonly kind: 'pipe';
	readonly value: Expression;
	readonly name: string;
	/** The offset of the name of the step. */
	readonly stepStart: number;
	readonly args: readonly Expression[] | null;
}

/** `?` in the arguments of a pipe step. */
export interface Placeholder extends Node {
	readonly kind: 'placeholder';
}

export interface If extends Node {
	readonly kind: 'if';
	readonly condition: Expression;
	readonly consequent: Expression;
	readonly alternate: Expression;
}

export interface For extends Node {
	readonly kind: 'for';
	readonly variable: string;
	readonly iterable: Expression;
	readonly guard: Expression | null;
	readonly accumulator: { readonly name: string; readonly initial: Expression } | null;
	readonly body: Expression;
}

export type Expression =
	| NumberLiteral
	| StringLiteral
	| Template
	| BooleanLiteral
	| Name
	| Binary
	| Unary
	| Fallback
	| RangeExpression
	| ArrayLiteral
	| RecordLiteral
	| Member
	| Index
	| Call
	| Pipe
	| Placeholder
	| If
	| For;

/** Grammar levels, loosest first. Nothing that is an operator sits at `None`. */
export const Precedence = {
	None: 0,
	Pipe: 1,
	Or: 2,
	And: 3,
	Compare: 4,
	Fallback: 5,
	Range: 6,
	Add: 7,
	Multiply: 8,
	Power: 9,
	Postfix: 10,
	Atom: 11,
} as const;
