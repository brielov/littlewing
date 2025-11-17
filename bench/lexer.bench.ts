import { bench, group, run } from 'mitata'
import { Lexer } from '../src/lexer'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Lexer', () => {
	bench('small script', () => {
		const lexer = new Lexer(SMALL_SCRIPT)
		const tokens = []
		let token = lexer.nextToken()
		while (token.type !== 'EOF') {
			tokens.push(token)
			token = lexer.nextToken()
		}
	})

	bench('medium script', () => {
		const lexer = new Lexer(MEDIUM_SCRIPT)
		const tokens = []
		let token = lexer.nextToken()
		while (token.type !== 'EOF') {
			tokens.push(token)
			token = lexer.nextToken()
		}
	})

	bench('large script', () => {
		const lexer = new Lexer(LARGE_SCRIPT)
		const tokens = []
		let token = lexer.nextToken()
		while (token.type !== 'EOF') {
			tokens.push(token)
			token = lexer.nextToken()
		}
	})
})

await run()
