import { bench, group, run } from 'mitata'
import { defaultContext, parse } from '../src'
import { Interpreter } from '../src/interpreter'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

// Pre-parse ASTs to isolate interpreter performance
const smallAST = parse(SMALL_SCRIPT)
const mediumAST = parse(MEDIUM_SCRIPT)
const largeAST = parse(LARGE_SCRIPT)

group('Interpreter', () => {
	bench('small script', () => {
		const interpreter = new Interpreter(defaultContext)
		interpreter.evaluate(smallAST)
	})

	bench('medium script', () => {
		const interpreter = new Interpreter(defaultContext)
		interpreter.evaluate(mediumAST)
	})

	bench('large script', () => {
		const interpreter = new Interpreter(defaultContext)
		interpreter.evaluate(largeAST)
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
		const interpreter = new Interpreter(context)
		interpreter.evaluate(smallAST)
	})

	bench('medium script', () => {
		const interpreter = new Interpreter(context)
		interpreter.evaluate(mediumAST)
	})

	bench('large script', () => {
		const interpreter = new Interpreter(context)
		interpreter.evaluate(largeAST)
	})
})

await run()
