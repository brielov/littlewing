import { bench, group, run } from 'mitata'
import { generate, parse } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

// Pre-parse ASTs to isolate code generation performance
const smallAST = parse(SMALL_SCRIPT)
const mediumAST = parse(MEDIUM_SCRIPT)
const largeAST = parse(LARGE_SCRIPT)

group('Code Generation', () => {
	bench('small script', () => {
		generate(smallAST)
	})

	bench('medium script', () => {
		generate(mediumAST)
	})

	bench('large script', () => {
		generate(largeAST)
	})
})

await run()
