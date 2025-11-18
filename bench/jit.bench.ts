import { bench, group, run } from 'mitata'
import { compile, defaultContext } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

// Pre-parse ASTs to isolate interpreter performance
const smallAST = compile(SMALL_SCRIPT)
const mediumAST = compile(MEDIUM_SCRIPT)
const largeAST = compile(LARGE_SCRIPT)

group('JIT', () => {
	bench('small script', () => {
		smallAST.execute(defaultContext)
	})

	bench('medium script', () => {
		mediumAST.execute(defaultContext)
	})

	bench('large script', () => {
		largeAST.execute(defaultContext)
	})
})

group('JIT (with external variables)', () => {
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
		smallAST.execute(context)
	})

	bench('medium script', () => {
		mediumAST.execute(context)
	})

	bench('large script', () => {
		largeAST.execute(context)
	})
})

run()
