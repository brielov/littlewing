import { bench, group, run } from 'mitata'
import { parse } from '../src/parser'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Parser', () => {
	bench('small script', () => {
		parse(SMALL_SCRIPT)
	})

	bench('medium script', () => {
		parse(MEDIUM_SCRIPT)
	})

	bench('large script', () => {
		parse(LARGE_SCRIPT)
	})
})

await run()
