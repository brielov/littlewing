import type { ASTNode, Operator } from './ast'
import { isIdentifier, isNumberLiteral } from './ast'
import { visit } from './visitor'

/**
 * Options for customizing the humanization output
 */
export interface HumanizeOptions {
	/**
	 * Enable HTML output with wrapper tags
	 * @default false
	 */
	html?: boolean

	/**
	 * CSS classes to apply to different node types when html is true
	 */
	htmlClasses?: {
		number?: string
		identifier?: string
		operator?: string
		function?: string
	}

	/**
	 * Custom phrases for function names
	 * Maps function name to human-readable phrase
	 * Example: { 'MAX': 'the maximum of', 'CUSTOM': 'my custom function with' }
	 */
	functionPhrases?: Record<string, string>

	/**
	 * Custom phrases for operators
	 * Overrides default operator text
	 */
	operatorPhrases?: Partial<Record<Operator, string>>

	/**
	 * Use more verbose, descriptive phrasing
	 * @default false
	 */
	verbose?: boolean
}

/**
 * Default phrases for binary operators
 */
const DEFAULT_OPERATOR_PHRASES: Record<Operator, string> = {
	'+': 'plus',
	'-': 'minus',
	'*': 'times',
	'/': 'divided by',
	'%': 'modulo',
	'^': 'to the power of',
	'==': 'equals',
	'!=': 'is not equal to',
	'<': 'is less than',
	'>': 'is greater than',
	'<=': 'is less than or equal to',
	'>=': 'is greater than or equal to',
	'&&': 'and',
	'||': 'or',
}

/**
 * Default phrases for known built-in functions
 */
const DEFAULT_FUNCTION_PHRASES: Record<string, string> = {
	// Math functions
	ABS: 'the absolute value of',
	CEIL: 'the ceiling of',
	FLOOR: 'the floor of',
	ROUND: 'the rounded value of',
	SQRT: 'the square root of',
	MIN: 'the minimum of',
	MAX: 'the maximum of',
	CLAMP: 'clamped',
	SIN: 'the sine of',
	COS: 'the cosine of',
	TAN: 'the tangent of',
	LOG: 'the natural logarithm of',
	LOG10: 'the base-10 logarithm of',
	EXP: 'e raised to the power of',

	// Date/time functions (sampling of commonly used ones)
	NOW: 'the current time',
	DATE: 'the date',
	GET_YEAR: 'the year of',
	GET_MONTH: 'the month of',
	GET_DAY: 'the day of',
	GET_HOUR: 'the hour of',
	GET_MINUTE: 'the minute of',
	GET_SECOND: 'the second of',
	START_OF_DAY: 'the start of day for',
	END_OF_DAY: 'the end of day for',
	START_OF_MONTH: 'the start of month for',
	END_OF_MONTH: 'the end of month for',
	ADD_DAYS: 'add days to',
	ADD_MONTHS: 'add months to',
	ADD_YEARS: 'add years to',
	DIFFERENCE_IN_DAYS: 'the difference in days between',
	DIFFERENCE_IN_HOURS: 'the difference in hours between',
	DIFFERENCE_IN_MINUTES: 'the difference in minutes between',
	IS_WEEKEND: 'whether it is a weekend for',
	IS_LEAP_YEAR: 'whether it is a leap year for',
}

/**
 * Wrap text in HTML tag if html option is enabled
 */
function wrapHtml(
	text: string,
	type: keyof NonNullable<HumanizeOptions['htmlClasses']>,
	options: HumanizeOptions,
): string {
	if (!options.html) {
		return text
	}

	const className = options.htmlClasses?.[type]
	if (className) {
		return `<span class="${className}">${text}</span>`
	}

	return `<span>${text}</span>`
}

/**
 * Humanize an AST node into English text
 */
function humanizeNode(
	node: ASTNode,
	operatorPhrases: Record<Operator, string>,
	functionPhrases: Record<string, string>,
	options: HumanizeOptions,
): string {
	return visit(node, {
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1]
			const texts = statements.map((stmt) => {
				const text = recurse(stmt)
				// Capitalize first letter of each statement
				return text.charAt(0).toUpperCase() + text.slice(1)
			})
			return texts.join('. ')
		},

		// Tuple: [kind, value]
		NumberLiteral: (n) => {
			const text = String(n[1])
			return wrapHtml(text, 'number', options)
		},

		// Tuple: [kind, name]
		Identifier: (n) => {
			return wrapHtml(n[1], 'identifier', options)
		},

		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			const left = recurse(n[1])
			const operator = n[2]
			const right = recurse(n[3])
			const operatorPhrase = operatorPhrases[operator]

			const operatorText = wrapHtml(operatorPhrase, 'operator', options)
			return `${left} ${operatorText} ${right}`
		},

		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const argument = n[2]
			const arg = recurse(argument)

			if (operator === '-') {
				// Check if we need grouping phrase for complex expressions
				const needsGrouping =
					!isNumberLiteral(argument) && !isIdentifier(argument)
				if (needsGrouping) {
					return `the negative of ${arg}`
				}
				return `negative ${arg}`
			}

			if (operator === '!') {
				return `not ${arg}`
			}

			throw new Error(`Unknown unary operator: ${operator}`)
		},

		// Tuple: [kind, name, arguments]
		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2]
			const funcName = wrapHtml(name, 'function', options)
			const humanArgs = args.map(recurse)

			// Check if we have a known phrase for this function
			const phrase = functionPhrases[name]

			if (phrase) {
				// Known function - use the custom phrase
				if (humanArgs.length === 0) {
					return phrase
				}
				if (humanArgs.length === 1) {
					return `${phrase} ${humanArgs[0]}`
				}
				// Multiple arguments - join with "and"
				const lastArg = humanArgs[humanArgs.length - 1]
				const otherArgs = humanArgs.slice(0, -1).join(', ')
				return `${phrase} ${otherArgs} and ${lastArg}`
			}

			// Unknown function - use generic phrasing
			if (humanArgs.length === 0) {
				return `the result of ${funcName}`
			}
			if (humanArgs.length === 1) {
				return `the result of ${funcName} with ${humanArgs[0]}`
			}
			const lastArg = humanArgs[humanArgs.length - 1]
			const otherArgs = humanArgs.slice(0, -1).join(', ')
			return `the result of ${funcName} with ${otherArgs} and ${lastArg}`
		},

		// Tuple: [kind, name, value]
		Assignment: (n, recurse) => {
			const name = n[1]
			const value = n[2]
			const humanName = wrapHtml(name, 'identifier', options)
			const humanValue = recurse(value)
			return `set ${humanName} to ${humanValue}`
		},

		// Tuple: [kind, condition, consequent, alternate]
		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n[1])
			const consequent = recurse(n[2])
			const alternate = recurse(n[3])

			return `if ${condition} then ${consequent}, otherwise ${alternate}`
		},
	})
}

/**
 * Humanize an AST node into human-readable English text
 *
 * @param node - The AST node to humanize
 * @param options - Optional configuration for the output
 * @returns Human-readable English text
 *
 * @example
 * ```typescript
 * const ast = parse('price * quantity > 100 ? (price * quantity - discount) * (1 + tax_rate) : MAX(price * quantity, 50)')
 * const text = humanize(ast)
 * // "if price times quantity is greater than 100 then (price times quantity minus discount) times (1 plus tax_rate), otherwise the maximum of price times quantity and 50"
 * ```
 *
 * @example
 * ```typescript
 * // With HTML formatting
 * const text = humanize(ast, {
 *   html: true,
 *   htmlClasses: {
 *     identifier: 'variable',
 *     operator: 'op',
 *     number: 'num'
 *   }
 * })
 * ```
 */
export function humanize(node: ASTNode, options: HumanizeOptions = {}): string {
	// Avoid object spreading overhead when no custom phrases are provided
	const operatorPhrases = options.operatorPhrases
		? { ...DEFAULT_OPERATOR_PHRASES, ...options.operatorPhrases }
		: DEFAULT_OPERATOR_PHRASES
	const functionPhrases = options.functionPhrases
		? { ...DEFAULT_FUNCTION_PHRASES, ...options.functionPhrases }
		: DEFAULT_FUNCTION_PHRASES

	return humanizeNode(node, operatorPhrases, functionPhrases, options)
}
