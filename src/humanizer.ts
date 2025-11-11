import type {
	ASTNode,
	Assignment,
	BinaryOp,
	ConditionalExpression,
	FunctionCall,
	Identifier,
	NumberLiteral,
	Operator,
	Program,
	UnaryOp,
} from './types'
import {
	isAssignment,
	isBinaryOp,
	isConditionalExpression,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from './types'

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
 * Converts an AST node to human-readable English text
 */
export class Humanizer {
	private readonly operatorPhrases: Record<Operator, string>
	private readonly functionPhrases: Record<string, string>

	constructor(private readonly options: HumanizeOptions = {}) {
		this.operatorPhrases = {
			...DEFAULT_OPERATOR_PHRASES,
			...options.operatorPhrases,
		}
		this.functionPhrases = {
			...DEFAULT_FUNCTION_PHRASES,
			...options.functionPhrases,
		}
	}

	/**
	 * Humanize an AST node into English text
	 */
	humanize(node: ASTNode): string {
		if (isProgram(node)) {
			return this.humanizeProgram(node)
		}
		if (isNumberLiteral(node)) {
			return this.humanizeNumberLiteral(node)
		}
		if (isIdentifier(node)) {
			return this.humanizeIdentifier(node)
		}
		if (isBinaryOp(node)) {
			return this.humanizeBinaryOp(node)
		}
		if (isUnaryOp(node)) {
			return this.humanizeUnaryOp(node)
		}
		if (isFunctionCall(node)) {
			return this.humanizeFunctionCall(node)
		}
		if (isAssignment(node)) {
			return this.humanizeAssignment(node)
		}
		if (isConditionalExpression(node)) {
			return this.humanizeConditionalExpression(node)
		}

		throw new Error(`Unknown node type: ${JSON.stringify(node)}`)
	}

	private humanizeProgram(node: Program): string {
		const statements = node.statements.map((stmt) => {
			const text = this.humanize(stmt)
			// Capitalize first letter of each statement
			return text.charAt(0).toUpperCase() + text.slice(1)
		})
		return statements.join('. ')
	}

	private humanizeNumberLiteral(node: NumberLiteral): string {
		const text = String(node.value)
		return this.wrapHtml(text, 'number')
	}

	private humanizeIdentifier(node: Identifier): string {
		return this.wrapHtml(node.name, 'identifier')
	}

	private humanizeBinaryOp(node: BinaryOp): string {
		const left = this.humanize(node.left)
		const right = this.humanize(node.right)
		const operator = this.operatorPhrases[node.operator]

		const operatorText = this.wrapHtml(operator, 'operator')
		return `${left} ${operatorText} ${right}`
	}

	private humanizeUnaryOp(node: UnaryOp): string {
		const arg = this.humanize(node.argument)

		if (node.operator === '-') {
			// Check if we need grouping phrase for complex expressions
			const needsGrouping =
				!isNumberLiteral(node.argument) && !isIdentifier(node.argument)
			if (needsGrouping) {
				return `the negative of ${arg}`
			}
			return `negative ${arg}`
		}

		if (node.operator === '!') {
			return `not ${arg}`
		}

		throw new Error(`Unknown unary operator: ${node.operator}`)
	}

	private humanizeFunctionCall(node: FunctionCall): string {
		const funcName = this.wrapHtml(node.name, 'function')
		const args = node.arguments.map((arg) => this.humanize(arg))

		// Check if we have a known phrase for this function
		const phrase = this.functionPhrases[node.name]

		if (phrase) {
			// Known function - use the custom phrase
			if (args.length === 0) {
				return phrase
			}
			if (args.length === 1) {
				return `${phrase} ${args[0]}`
			}
			// Multiple arguments - join with "and"
			const lastArg = args[args.length - 1]
			const otherArgs = args.slice(0, -1).join(', ')
			return `${phrase} ${otherArgs} and ${lastArg}`
		}

		// Unknown function - use generic phrasing
		if (args.length === 0) {
			return `the result of ${funcName}`
		}
		if (args.length === 1) {
			return `the result of ${funcName} with ${args[0]}`
		}
		const lastArg = args[args.length - 1]
		const otherArgs = args.slice(0, -1).join(', ')
		return `the result of ${funcName} with ${otherArgs} and ${lastArg}`
	}

	private humanizeAssignment(node: Assignment): string {
		const name = this.wrapHtml(node.name, 'identifier')
		const value = this.humanize(node.value)
		return `set ${name} to ${value}`
	}

	private humanizeConditionalExpression(node: ConditionalExpression): string {
		const condition = this.humanize(node.condition)
		const consequent = this.humanize(node.consequent)
		const alternate = this.humanize(node.alternate)

		return `if ${condition} then ${consequent}, otherwise ${alternate}`
	}

	/**
	 * Wrap text in HTML tag if html option is enabled
	 */
	private wrapHtml(
		text: string,
		type: keyof NonNullable<HumanizeOptions['htmlClasses']>,
	): string {
		if (!this.options.html) {
			return text
		}

		const className = this.options.htmlClasses?.[type]
		if (className) {
			return `<span class="${className}">${text}</span>`
		}

		return `<span>${text}</span>`
	}
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
 * const ast = parseSource('price * quantity > 100 ? (price * quantity - discount) * (1 + tax_rate) : MAX(price * quantity, 50)')
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
export function humanize(node: ASTNode, options?: HumanizeOptions): string {
	const humanizer = new Humanizer(options)
	return humanizer.humanize(node)
}
