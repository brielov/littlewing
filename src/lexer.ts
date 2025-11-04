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

		// String literals
		if (char === "'") {
			return this.readString()
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
	 */
	private readNumber(): Token {
		const start = this.position
		let hasDecimal = false

		while (this.position < this.source.length) {
			const char = this.getCharAt(this.position)

			if (this.isDigit(char)) {
				this.position++
			} else if (char === '.' && !hasDecimal) {
				hasDecimal = true
				this.position++
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
	 * Read a string token
	 */
	private readString(): Token {
		const start = this.position
		this.position++ // skip opening quote

		let value = ''
		while (this.position < this.source.length) {
			const char = this.getCharAt(this.position)

			if (char === "'") {
				this.position++ // skip closing quote
				break
			}

			if (char === '\\' && this.position + 1 < this.source.length) {
				// Handle escape sequences
				this.position++
				const escaped = this.getCharAt(this.position)
				switch (escaped) {
					case 'n':
						value += '\n'
						break
					case 't':
						value += '\t'
						break
					case 'r':
						value += '\r'
						break
					case "'":
						value += "'"
						break
					case '\\':
						value += '\\'
						break
					default:
						value += escaped
				}
				this.position++
			} else {
				value += char
				this.position++
			}
		}

		return { type: TokenType.STRING, value, position: start }
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
