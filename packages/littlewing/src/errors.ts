/**
 * Error thrown when parsing fails. Carries UTF-16 offsets into the source string
 * so callers can display precise error locations.
 */
export class ParseError extends Error {
	override readonly name = 'ParseError';
	constructor(
		message: string,
		readonly start: number,
		readonly end: number,
	) {
		super(message);
	}
}

/**
 * Error thrown when evaluation fails. Offsets locate the failing expression in
 * the source, when the AST came from the parser. The original error is `cause`:
 * a `TypeError` or `RangeError` from the language, a `LimitExceededError`, or
 * whatever a host function threw.
 */
export class EvaluationError extends Error {
	override readonly name = 'EvaluationError';
	constructor(
		message: string,
		readonly start: number | undefined,
		readonly end: number | undefined,
		options?: ErrorOptions,
	) {
		super(message, options);
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
