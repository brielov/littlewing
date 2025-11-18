import { bench, group, run } from 'mitata'
import { defaultContext, evaluate, generate, optimize, parse } from '../src'
import { LARGE_SCRIPT, MEDIUM_SCRIPT, SMALL_SCRIPT } from './fixtures'

group('Integration: Parse + Evaluate', () => {
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

group('Integration: Parse + Optimize + Evaluate', () => {
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

group(
	'Integration: Full Pipeline (Parse + Optimize + Codegen + Parse + Evaluate)',
	() => {
		bench('small script', () => {
			const ast = parse(SMALL_SCRIPT)
			const optimized = optimize(ast)
			const code = generate(optimized)
			evaluate(code, defaultContext)
		})

		bench('medium script', () => {
			const ast = parse(MEDIUM_SCRIPT)
			const optimized = optimize(ast)
			const code = generate(optimized)
			evaluate(code, defaultContext)
		})

		bench('large script', () => {
			const ast = parse(LARGE_SCRIPT)
			const optimized = optimize(ast)
			const code = generate(optimized)
			evaluate(code, defaultContext)
		})
	},
)

group('Integration: With External Variables', () => {
	const context = {
		...defaultContext,
		variables: {
			...defaultContext.variables,
			externalVar1: 100,
			externalVar2: 200,
			externalVar3: 300,
		},
	}

	bench('small script (parse + evaluate)', () => {
		evaluate(SMALL_SCRIPT, context)
	})

	bench('medium script (parse + evaluate)', () => {
		evaluate(MEDIUM_SCRIPT, context)
	})

	bench('large script (parse + evaluate)', () => {
		evaluate(LARGE_SCRIPT, context)
	})
})

await run()
