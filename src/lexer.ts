import { type Token, TokenType } from './types'

/**
 * Lexer - converts source code into tokens
 */
export class Lexer {
	private source: string
	private position: number = 0

	constructor(source: string) {
		this.source = source
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

		if (this.position >= this.source.length) {
			return { type: TokenType.EOF, value: '', position: this.position }
		}

		const char = this.getCharAt(this.position)
		const start = this.position

		// Numbers
		if (this.isDigit(char)) {
			return this.readNumber()
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
				this.position++
				return { type: TokenType.EQUALS, value: '=', position: start }
			case ',':
				this.position++
				return { type: TokenType.COMMA, value: ',', position: start }
			case ';':
				// Semicolons are ignored (optional)
				this.position++
				return this.nextToken()
			default:
				throw new Error(`Unexpected character '${char}' at position ${start}`)
		}
	}

	/**
	 * Skip whitespace and comments
	 */
	private skipWhitespaceAndComments(): void {
		while (this.position < this.source.length) {
			const char = this.getCharAt(this.position)

			// Skip whitespace
			if (this.isWhitespace(char)) {
				this.position++
				continue
			}

			// Skip comments
			if (char === '/' && this.peek() === '/') {
				// Skip until end of line
				while (
					this.position < this.source.length &&
					this.getCharAt(this.position) !== '\n'
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
	 * Supports: integers (42), decimals (3.14), and scientific notation (1.5e6, 2e-3)
	 */
	private readNumber(): Token {
		const start = this.position
		let hasDecimal = false
		let hasExponent = false

		// Read digits and optional decimal point
		while (this.position < this.source.length) {
			const char = this.getCharAt(this.position)

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
				const nextChar = this.getCharAt(this.position)
				if (nextChar === '+' || nextChar === '-') {
					this.position++
				}

				// Must have at least one digit after e/E
				if (!this.isDigit(this.getCharAt(this.position))) {
					throw new Error(
						`Invalid number: expected digit after exponent at position ${this.position}`,
					)
				}

				// Read exponent digits
				while (
					this.position < this.source.length &&
					this.isDigit(this.getCharAt(this.position))
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

		while (this.position < this.source.length) {
			const char = this.getCharAt(this.position)
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
	 * Get character at position
	 */
	private getCharAt(pos: number): string {
		return pos < this.source.length ? this.source[pos] || '' : ''
	}

	/**
	 * Peek at the next character without consuming it
	 */
	private peek(): string {
		return this.getCharAt(this.position + 1)
	}

	/**
	 * Check if character is a digit
	 */
	private isDigit(char: string): boolean {
		return char >= '0' && char <= '9'
	}

	/**
	 * Check if character is a letter
	 */
	private isLetter(char: string): boolean {
		return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
	}

	/**
	 * Check if character is whitespace
	 */
	private isWhitespace(char: string): boolean {
		return char === ' ' || char === '\t' || char === '\n' || char === '\r'
	}
}
