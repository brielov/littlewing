#!/usr/bin/env bun

/**
 * Transform mitata benchmark output to github-action-benchmark JSON format
 *
 * Parses mitata's terminal output and converts it to the JSON format expected by
 * github-action-benchmark:
 * [
 *   {
 *     "name": "Lexer - small script",
 *     "unit": "µs/iter",
 *     "value": 1.75
 *   }
 * ]
 */

interface BenchmarkResult {
	name: string
	unit: string
	value: number
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsi(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

/**
 * Parse mitata output and extract benchmark results
 */
function parseMitataOutput(output: string): BenchmarkResult[] {
	const results: BenchmarkResult[] = []
	let currentGroup = ''

	// Strip ANSI codes first
	const cleanOutput = stripAnsi(output)
	const lines = cleanOutput.split('\n')

	for (const line of lines) {
		// Match group headers like "• Lexer"
		const groupMatch = line.match(/^•\s+(.+)$/)
		if (groupMatch) {
			currentGroup = groupMatch[1].trim()
			continue
		}

		// Match benchmark lines like:
		// "small script                   1.75 µs/iter   1.78 µs"
		// Regex explanation:
		// - ^([a-zA-Z0-9\s\-\_\(\)]+?)  - benchmark name (letters, numbers, spaces, hyphens, underscores, parens)
		// - \s{2,}                       - at least 2 spaces (column separator)
		// - ([\d.]+)                     - numeric value
		// - \s+                          - whitespace
		// - (µs|ms|ns|s)                 - unit (microseconds, milliseconds, nanoseconds, seconds)
		// - \/iter                       - literal "/iter"
		const benchMatch = line.match(
			/^([a-zA-Z0-9\s\-_()]+?)\s{2,}([\d.]+)\s+(µs|ms|ns|s)\/iter/,
		)

		if (benchMatch) {
			const [, benchmarkName, value, unit] = benchMatch
			const name = currentGroup
				? `${currentGroup} - ${benchmarkName.trim()}`
				: benchmarkName.trim()

			results.push({
				name,
				unit: `${unit}/iter`,
				value: Number.parseFloat(value),
			})
		}
	}

	return results
}

/**
 * Main execution
 */
async function main() {
	const inputFile = process.argv[2]
	const outputFile = process.argv[3] || 'benchmark-results.json'

	if (!inputFile) {
		console.error(
			'Usage: bun transform-bench-to-json.ts <input-file> [output-file]',
		)
		console.error(
			'Example: bun transform-bench-to-json.ts bench-output.txt bench.json',
		)
		process.exit(1)
	}

	try {
		const output = await Bun.file(inputFile).text()
		const results = parseMitataOutput(output)

		if (results.length === 0) {
			console.error('Warning: No benchmark results found in input file')
			console.error('Make sure the file contains mitata output')
			process.exit(1)
		}

		await Bun.write(outputFile, JSON.stringify(results, null, 2))

		console.log(`✅ Transformed ${results.length} benchmark results`)
		console.log(`   Input:  ${inputFile}`)
		console.log(`   Output: ${outputFile}`)
		console.log('\nResults:')
		for (const result of results) {
			console.log(`   - ${result.name}: ${result.value} ${result.unit}`)
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

main()
