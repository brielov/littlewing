import { bench, group, run } from 'mitata'
import { defaultContext, evaluate } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Integration (Full Pipeline)', () => {
	bench('small script', () => {
		evaluate(SMALL_SCRIPT, defaultContext)
	})

	bench('medium script', () => {
		evaluate(MEDIUM_SCRIPT, defaultContext)
	})

	bench('large script', () => {
		evaluate(LARGE_SCRIPT, defaultContext)
	})
})

group('Integration (with external variables)', () => {
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
		evaluate(SMALL_SCRIPT, context)
	})

	bench('medium script', () => {
		evaluate(MEDIUM_SCRIPT, context)
	})

	bench('large script', () => {
		evaluate(LARGE_SCRIPT, context)
	})
})

await run()
