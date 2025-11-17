import { bench, group, run } from 'mitata'
import { createCursor, nextToken, type Token, TokenKind } from '../src/lexer'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Lexer', () => {
	bench('small script', () => {
		const cursor = createCursor(SMALL_SCRIPT)
		const tokens: Token[] = []
		let token = nextToken(cursor)
		while (token[0] !== TokenKind.Eof) {
			tokens.push(token)
			token = nextToken(cursor)
		}
	})

	bench('medium script', () => {
		const cursor = createCursor(MEDIUM_SCRIPT)
		const tokens: Token[] = []
		let token = nextToken(cursor)
		while (token[0] !== TokenKind.Eof) {
			tokens.push(token)
			token = nextToken(cursor)
		}
	})

	bench('large script', () => {
		const cursor = createCursor(LARGE_SCRIPT)
		const tokens: Token[] = []
		let token = nextToken(cursor)
		while (token[0] !== TokenKind.Eof) {
			tokens.push(token)
			token = nextToken(cursor)
		}
	})
})

await run()
