import { bench, group, run } from 'mitata'
import { defaultContext, evaluate, parse } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

// Pre-parse ASTs to isolate interpreter performance
const smallAST = parse(SMALL_SCRIPT)
const mediumAST = parse(MEDIUM_SCRIPT)
const largeAST = parse(LARGE_SCRIPT)

group('Interpreter', () => {
	bench('small script', () => {
		evaluate(smallAST, defaultContext)
	})

	bench('medium script', () => {
		evaluate(mediumAST, defaultContext)
	})

	bench('large script', () => {
		evaluate(largeAST, defaultContext)
	})
})

group('Interpreter (with external variables)', () => {
	const context = {
		...defaultContext,
		variables: {
			...defaultContext.variables,
			externalVar1: 100,
			externalVar2: 200,
			externalVar3: 300,
		},
	}

	bench('small script', () => {
		evaluate(smallAST, context)
	})

	bench('medium script', () => {
		evaluate(mediumAST, context)
	})

	bench('large script', () => {
		evaluate(largeAST, context)
	})
})

await run()
