import { bench, group, run } from 'mitata'
import { createCursor, nextToken, type Token, TokenKind } from '../src/lexer'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

function tokenize(script: string): readonly Token[] {
	const cursor = createCursor(script)
	const tokens: Token[] = []
	let token = nextToken(cursor)
	while (token[0] !== TokenKind.Eof) {
		tokens.push(token)
		token = nextToken(cursor)
	}
	return tokens
}

group('Lexer', () => {
	bench('small script', () => {
		tokenize(SMALL_SCRIPT)
	})

	bench('medium script', () => {
		tokenize(MEDIUM_SCRIPT)
	})

	bench('large script', () => {
		tokenize(LARGE_SCRIPT)
	})
})

await run()
