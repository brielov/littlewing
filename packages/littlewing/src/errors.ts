/**
 * Error thrown when parsing fails. Carries byte offsets into the source string
 * so callers can display precise error locations.
 */
export class ParseError extends Error {
	override readonly name = "ParseError";
	constructor(
		message: string,
		readonly start: number,
		readonly end: number,
	) {
		super(message);
	}
}

/**
 * Convert a byte offset into a source string to a 1-based line and column.
 */
export function toLineColumn(source: string, offset: number): { line: number; column: number } {
	let line = 1;
	let column = 1;
	const clamped = Math.min(offset, source.length);
	for (let i = 0; i < clamped; i++) {
		if (source.charCodeAt(i) === 0x0a) {
			line++;
			column = 1;
		} else {
			column++;
		}
	}
	return { line, column };
}
