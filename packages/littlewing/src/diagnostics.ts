/**
 * A problem found in a program. The code is stable, and comes from Appendix B of
 * the language spec. The message is for people, and is free to change.
 */
export interface Diagnostic {
	readonly code: string;
	readonly severity: 'error' | 'warning';
	readonly message: string;
	/** Offsets into the source, in UTF-16 code units. */
	readonly start: number;
	readonly end: number;
	/** What host code threw, for a constant failure. */
	readonly cause?: unknown;
}

export function errorAt(code: string, message: string, start: number, end: number): Diagnostic {
	return { code, severity: 'error', message, start, end };
}
