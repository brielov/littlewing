import { describe, expect, test } from 'bun:test';
import { FUNCTION_DESCRIPTIONS } from '../src/language/catalog.ts';
import { insertion } from '../src/language/insert.ts';
import { lex } from '../src/language/tokens.ts';

/** What inserting `name` at the end of `before`, over `selected`, writes, with `‸` for the cursor. */
function insert(name: string, before = '', selected = ''): string {
	const { text, cursor } = insertion(
		name,
		FUNCTION_DESCRIPTIONS.get(name)!,
		selected,
		lex(before).at(-1),
	);
	return `${text.slice(0, cursor)}‸${text.slice(cursor)}`;
}

describe('insertion', () => {
	test('a call, with the cursor for its arguments', () => {
		expect(insert('ROUND')).toBe('ROUND(‸)');
	});

	test('a selection becomes the argument', () => {
		expect(insert('ROUND', '', 'price * 2')).toBe('ROUND(price * 2)‸');
	});

	test('a pipe step', () => {
		expect(insert('TRIM', 'x |> ')).toBe('TRIM‸');
		expect(insert('ROUND', 'x |> ')).toBe('ROUND‸');
		expect(insert('SPLIT', 'x |> ')).toBe('SPLIT(?, ‸)');
		// Nothing can be piped into it, which compiling then says
		expect(insert('NOW', 'x |> ')).toBe('NOW(?, ‸)');
	});

	test('a function that takes nothing', () => {
		expect(insert('TODAY')).toBe('TODAY()‸');
	});
});
