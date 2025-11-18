import { bench, group, run } from 'mitata'
import { compile, defaultContext, evaluate, optimize, parse } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Full Pipeline: Interpreter (evaluate)', () => {
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

group('Full Pipeline: Interpreter + Optimize', () => {
	bench('small script', () => {
		const ast = parse(SMALL_SCRIPT)
		const optimized = optimize(ast)
		evaluate(optimized, defaultContext)
	})

	bench('medium script', () => {
		const ast = parse(MEDIUM_SCRIPT)
		const optimized = optimize(ast)
		evaluate(optimized, defaultContext)
	})

	bench('large script', () => {
		const ast = parse(LARGE_SCRIPT)
		const optimized = optimize(ast)
		evaluate(optimized, defaultContext)
	})
})

group('Full Pipeline: JIT (compile + execute)', () => {
	bench('small script', () => {
		const compiled = compile(SMALL_SCRIPT)
		compiled.execute(defaultContext)
	})

	bench('medium script', () => {
		const compiled = compile(MEDIUM_SCRIPT)
		compiled.execute(defaultContext)
	})

	bench('large script', () => {
		const compiled = compile(LARGE_SCRIPT)
		compiled.execute(defaultContext)
	})
})

run()
