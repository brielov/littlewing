/**
 * What the page and the evaluation worker say to each other. Everything here is
 * plain data, as `Decimal`s, dates and records with no prototype do not survive
 * being copied between threads.
 */
import type { TypeDescription } from 'littlewing';

/** A value typed into the panel for an input. */
export type Given =
	| { readonly kind: 'number'; readonly text: string }
	| { readonly kind: 'string'; readonly value: string }
	| { readonly kind: 'boolean'; readonly value: boolean }
	/** ISO 8601, as `2026-11-02`, `09:30` or `2026-11-02T09:30`. */
	| { readonly kind: 'date' | 'time' | 'datetime'; readonly text: string }
	/** Littlewing source, for an array, a record or anything else. */
	| { readonly kind: 'expression'; readonly source: string };

/** A value as the panel shows it. */
export type Shown =
	| { readonly kind: 'number'; readonly text: string }
	/** `more` counts the code units left out of a long string. */
	| { readonly kind: 'string'; readonly value: string; readonly more?: number }
	| { readonly kind: 'boolean'; readonly value: boolean }
	| { readonly kind: 'date' | 'time' | 'datetime'; readonly text: string }
	/** `more` counts the elements left out, past what the panel is sent. */
	| { readonly kind: 'array'; readonly items: readonly Shown[]; readonly more: number }
	| {
			readonly kind: 'record';
			readonly fields: readonly (readonly [string, Shown])[];
			readonly more: number;
	  }
	/** A value of a host's own type, as its text. */
	| { readonly kind: 'other'; readonly text: string }
	/** Past what the panel shows, as a value nested thousands deep. */
	| { readonly kind: 'elided' };

/** A problem compiling or running the program found, at offsets into its source. */
export interface Problem {
	readonly code: string;
	readonly message: string;
	readonly severity: 'error' | 'warning';
	readonly from: number;
	readonly to: number;
}

/** An input of the program, which the panel offers a control for. */
export interface Input {
	readonly name: string;
	readonly type: TypeDescription;
	readonly required: boolean;
	/** Whether it is a `?=` input, which has a default. */
	readonly defaulted: boolean;
	/** The source of the default, which says whether a value it gave is still its own. */
	readonly defaultSource: string | undefined;
	/** The `?=` default, when folding kept it as a constant. */
	readonly default: Given | undefined;
	/** The value the program ran with, when it ran. */
	readonly current: Shown | undefined;
}

export interface Request {
	readonly id: number;
	readonly source: string;
	/** What was typed for inputs, by name. */
	readonly given: Readonly<Record<string, Given>>;
}

export type Outcome =
	| { readonly ok: true; readonly value: Shown; readonly type: TypeDescription }
	| { readonly ok: false; readonly message: string; readonly code: string };

/** A top-level name and its value, which a failure before it leaves unknown. */
export interface Named {
	readonly name: string;
	readonly type: TypeDescription | undefined;
	readonly value: Shown | undefined;
}

export interface Response {
	readonly id: number;
	/**
	 * `compiled` comes first, with what compiling found and no outcome, so that
	 * problems show while a long program runs; `done` comes when it has run.
	 */
	readonly phase: 'compiled' | 'done';
	readonly source: string;
	/** Values typed for inputs that could not be used, which the program ran without. */
	readonly rejected: readonly { readonly name: string; readonly message: string }[];
	readonly problems: readonly Problem[];
	/** The program's inputs, or undefined if it does not compile, when the panel keeps the last ones. */
	readonly inputs: readonly Input[] | undefined;
	/** What running it gave, or undefined if it does not compile or is empty. */
	readonly outcome: Outcome | undefined;
	readonly scope: readonly Named[];
	/** The type of each top-level name, from the statements that could be read. */
	readonly types: readonly (readonly [string, TypeDescription])[] | undefined;
	readonly timing: { readonly compileMs: number; readonly evaluateMs: number } | undefined;
}

/** What the worker sends: that it is ready, or a response. */
export type Message = { readonly ready: true } | Response;
