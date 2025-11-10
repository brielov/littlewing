import { type Token, TokenType } from './types'

/**
 * Lexer - converts source code into tokens
 * Implements a single-pass O(n) tokenization algorithm
 */
export class Lexer {
	private source: string
	private position: number = 0
	private length: number

	constructor(source: string) {
		this.source = source
		this.length = source.length
	}

	/**
	 * Tokenize the entire source and return all tokens
	 */
	tokenize(): Token[] {
		const tokens: Token[] = []

		while (true) {
			const token = this.nextToken()
			tokens.push(token)
			if (token.type === TokenType.EOF) {
				break
			}
		}

		return tokens
	}

	/**
	 * Get the next token from the source
	 */
	nextToken(): Token {
		this.skipWhitespaceAndComments()

		if (this.position >= this.length) {
			return { type: TokenType.EOF, value: '', position: this.position }
		}

		const char = this.source[this.position]
		if (char === undefined) {
			return { type: TokenType.EOF, value: '', position: this.position }
		}

		const start = this.position

		// Numbers (including decimal shorthand like .2)
		if (this.isDigit(char)) {
			return this.readNumber()
		}

		// Decimal shorthand (.2 means 0.2)
		if (char === '.') {
			const nextChar = this.source[this.position + 1]
			if (nextChar !== undefined && this.isDigit(nextChar)) {
				return this.readNumber()
			}
		}

		// Identifiers and keywords
		if (this.isLetter(char) || char === '_') {
			return this.readIdentifier()
		}

		// Single character operators and punctuation
		switch (char) {
			case '+':
				this.position++
				return { type: TokenType.PLUS, value: '+', position: start }
			case '-':
				this.position++
				return { type: TokenType.MINUS, value: '-', position: start }
			case '*':
				this.position++
				return { type: TokenType.STAR, value: '*', position: start }
			case '/':
				this.position++
				return { type: TokenType.SLASH, value: '/', position: start }
			case '%':
				this.position++
				return { type: TokenType.PERCENT, value: '%', position: start }
			case '^':
				this.position++
				return { type: TokenType.CARET, value: '^', position: start }
			case '(':
				this.position++
				return { type: TokenType.LPAREN, value: '(', position: start }
			case ')':
				this.position++
				return { type: TokenType.RPAREN, value: ')', position: start }
			case '=':
				// Check for == (equality comparison)
				if (this.source[this.position + 1] === '=') {
					this.position += 2
					return { type: TokenType.DOUBLE_EQUALS, value: '==', position: start }
				}
				// Single = is assignment
				this.position++
				return { type: TokenType.EQUALS, value: '=', position: start }
			case '!':
				// Check for != (not equals)
				if (this.source[this.position + 1] === '=') {
					this.position += 2
					return { type: TokenType.NOT_EQUALS, value: '!=', position: start }
				}
				// Single ! is logical NOT
				this.position++
				return { type: TokenType.EXCLAMATION, value: '!', position: start }
			case '<':
				// Check for <= (less than or equal)
				if (this.source[this.position + 1] === '=') {
					this.position += 2
					return { type: TokenType.LESS_EQUAL, value: '<=', position: start }
				}
				// Single < is less than
				this.position++
				return { type: TokenType.LESS_THAN, value: '<', position: start }
			case '>':
				// Check for >= (greater than or equal)
				if (this.source[this.position + 1] === '=') {
					this.position += 2
					return { type: TokenType.GREATER_EQUAL, value: '>=', position: start }
				}
				// Single > is greater than
				this.position++
				return { type: TokenType.GREATER_THAN, value: '>', position: start }
			case '?':
				this.position++
				return { type: TokenType.QUESTION, value: '?', position: start }
			case ':':
				this.position++
				return { type: TokenType.COLON, value: ':', position: start }
			case ',':
				this.position++
				return { type: TokenType.COMMA, value: ',', position: start }
			case ';':
				// Semicolons are ignored (optional)
				this.position++
				return this.nextToken()
			case '&':
				// Check for && (logical AND)
				if (this.source[this.position + 1] === '&') {
					this.position += 2
					return { type: TokenType.LOGICAL_AND, value: '&&', position: start }
				}
				throw new Error(`Unexpected character '${char}' at position ${start}`)
			case '|':
				// Check for || (logical OR)
				if (this.source[this.position + 1] === '|') {
					this.position += 2
					return { type: TokenType.LOGICAL_OR, value: '||', position: start }
				}
				throw new Error(`Unexpected character '${char}' at position ${start}`)
			default:
				throw new Error(`Unexpected character '${char}' at position ${start}`)
		}
	}

	/**
	 * Skip whitespace and comments
	 */
	private skipWhitespaceAndComments(): void {
		while (this.position < this.length) {
			const char = this.source[this.position]

			// Skip whitespace
			if (this.isWhitespace(char)) {
				this.position++
				continue
			}

			// Skip comments
			if (char === '/' && this.source[this.position + 1] === '/') {
				// Skip until end of line
				this.position += 2
				while (
					this.position < this.length &&
					this.source[this.position] !== '\n'
				) {
					this.position++
				}
				continue
			}

			break
		}
	}

	/**
	 * Read a number token
	 * Supports: integers (42), decimals (3.14), decimal shorthand (.2), and scientific notation (1.5e6, 2e-3, .5e2)
	 */
	private readNumber(): Token {
		const start = this.position
		let hasDecimal = false
		let hasExponent = false

		// Handle leading decimal point (.2 means 0.2)
		if (this.source[this.position] === '.') {
			hasDecimal = true
			this.position++
			// The digit after the decimal point is guaranteed by nextToken()
		}

		// Read digits and optional decimal point
		while (this.position < this.length) {
			const char = this.source[this.position]

			if (this.isDigit(char)) {
				this.position++
			} else if (char === '.' && !hasDecimal && !hasExponent) {
				hasDecimal = true
				this.position++
			} else if ((char === 'e' || char === 'E') && !hasExponent) {
				// Scientific notation exponent
				hasExponent = true
				this.position++

				// Optional + or - sign after e/E
				const nextChar = this.source[this.position]
				if (nextChar === '+' || nextChar === '-') {
					this.position++
				}

				// Must have at least one digit after e/E
				const digitChar = this.source[this.position]
				if (digitChar === undefined || !this.isDigit(digitChar)) {
					throw new Error(
						`Invalid number: expected digit after exponent at position ${this.position}`,
					)
				}

				// Read exponent digits
				while (
					this.position < this.length &&
					this.isDigit(this.source[this.position])
				) {
					this.position++
				}
				break
			} else {
				break
			}
		}

		const value = parseFloat(this.source.slice(start, this.position))

		return { type: TokenType.NUMBER, value, position: start }
	}

	/**
	 * Read an identifier token
	 */
	private readIdentifier(): Token {
		const start = this.position

		while (this.position < this.length) {
			const char = this.source[this.position]
			if (this.isLetter(char) || this.isDigit(char) || char === '_') {
				this.position++
			} else {
				break
			}
		}

		const name = this.source.slice(start, this.position)

		return { type: TokenType.IDENTIFIER, value: name, position: start }
	}

	/**
	 * Check if character is a digit (0-9)
	 */
	private isDigit(char: string | undefined): char is string {
		return char !== undefined && char >= '0' && char <= '9'
	}

	/**
	 * Check if character is a letter (a-z, A-Z)
	 */
	private isLetter(char: string | undefined): char is string {
		return (
			char !== undefined &&
			((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'))
		)
	}

	/**
	 * Check if character is whitespace
	 */
	private isWhitespace(char: string | undefined): char is string {
		return (
			char !== undefined &&
			(char === ' ' || char === '\t' || char === '\n' || char === '\r')
		)
	}
}
