import type { Diagnostic } from './diagnostics.js';

/**
 * Every failure of a program being evaluated. Offsets locate the failing expression,
 * and are 0 for what happens before the program runs or after it ends. For a
 * `host-error`, `cause` is what host code threw.
 */
export class EvaluationError extends Error {
	override readonly name = 'EvaluationError';
	/** A stable code, from Appendix B of the language spec. */
	readonly code: string;
	constructor(
		message: string,
		readonly start: number,
		readonly end: number,
		options?: { readonly cause?: unknown; readonly code?: string },
	) {
		super(message, options);
		this.code = options?.code ?? 'host-error';
	}
}

/**
 * Thrown by `run` for a program that does not compile.
 */
export class CompileError extends Error {
	override readonly name = 'CompileError';
	constructor(readonly diagnostics: readonly Diagnostic[]) {
		super(diagnostics[0]?.message ?? 'The program does not compile');
	}
}

/**
 * Convert a UTF-16 offset into a source string to a 1-based line and column.
 * Lines end at `\n`, `\r\n` or a lone `\r`, matching the lexer.
 */
export function toLineColumn(source: string, offset: number): { line: number; column: number } {
	let line = 1;
	let column = 1;
	const clamped = Math.min(offset, source.length);
	for (let i = 0; i < clamped; i++) {
		const ch = source.charCodeAt(i);
		if (ch === 0x0a || (ch === 0x0d && source.charCodeAt(i + 1) !== 0x0a)) {
			line++;
			column = 1;
		} else {
			column++;
		}
	}
	return { line, column };
}
