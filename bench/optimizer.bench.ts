import { bench, group, run } from 'mitata'
import { optimize } from '../src/optimizer'
import { parse } from '../src/parser'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

// Pre-parse ASTs to isolate optimizer performance
const smallAST = parse(SMALL_SCRIPT)
const mediumAST = parse(MEDIUM_SCRIPT)
const largeAST = parse(LARGE_SCRIPT)

group('Optimizer', () => {
	bench('small script', () => {
		optimize(smallAST)
	})

	bench('medium script', () => {
		optimize(mediumAST)
	})

	bench('large script', () => {
		optimize(largeAST)
	})
})

run()
