import { Lexer } from './lexer'
import { type ASTNode, type Token, TokenType } from './types'

/**
 * Parser using Pratt parsing (top-down operator precedence)
 */
export class Parser {
	private tokens: Token[]
	private current: number = 0

	constructor(tokens: Token[]) {
		this.tokens = tokens
	}

	/**
	 * Parse tokens into an AST
	 * Supports multiple statements separated by semicolons
	 */
	parse(): ASTNode {
		const statements: ASTNode[] = []

		while (this.peek().type !== TokenType.EOF) {
			statements.push(this.parseExpression(0))
		}

		if (statements.length === 0) {
			throw new Error('Empty program')
		}

		// If single statement, return it directly
		// If multiple, wrap in Program node
		if (statements.length === 1) {
			const stmt = statements[0]
			if (stmt === undefined) {
				throw new Error('Unexpected undefined statement')
			}
			return stmt
		}

		return {
			type: 'Program',
			statements,
		}
	}

	/**
	 * Parse an expression with Pratt parsing (precedence climbing)
	 */
	private parseExpression(minPrecedence: number): ASTNode {
		let left = this.parsePrefix()

		while (true) {
			const token = this.peek()
			const precedence = this.getPrecedence(token.type)

			if (precedence < minPrecedence) {
				break
			}

			if (token.type === TokenType.EQUALS) {
				// Variable assignment
				if (left.type !== 'Identifier') {
					throw new Error('Invalid assignment target')
				}
				const identName = left.name
				this.advance() // consume =
				const value = this.parseExpression(precedence + 1)
				left = {
					type: 'Assignment',
					name: identName,
					value,
				}
			} else if (this.isBinaryOperator(token.type)) {
				// Binary operation
				const operator = token.value as string as '+' | '-' | '*' | '/' | '%'
				this.advance() // consume operator
				const right = this.parseExpression(precedence + 1)
				left = {
					type: 'BinaryOp',
					left,
					operator,
					right,
				}
			} else {
				break
			}
		}

		return left
	}

	/**
	 * Parse prefix (unary) expressions
	 */
	private parsePrefix(): ASTNode {
		const token = this.peek()

		// Unary minus
		if (token.type === TokenType.MINUS) {
			this.advance()
			const argument = this.parseExpression(this.getUnaryPrecedence())
			return {
				type: 'UnaryOp',
				operator: '-',
				argument,
			}
		}

		// Parenthesized expression
		if (token.type === TokenType.LPAREN) {
			this.advance()
			const expr = this.parseExpression(0)
			if (this.peek().type !== TokenType.RPAREN) {
				throw new Error('Expected closing parenthesis')
			}
			this.advance()
			return expr
		}

		// Number literal
		if (token.type === TokenType.NUMBER) {
			this.advance()
			return {
				type: 'NumberLiteral',
				value: token.value as number,
			}
		}

		// String literal
		if (token.type === TokenType.STRING) {
			this.advance()
			return {
				type: 'StringLiteral',
				value: token.value as string,
			}
		}

		// Identifier or function call
		if (token.type === TokenType.IDENTIFIER) {
			const name = token.value as string
			this.advance()

			// Check for function call
			if (this.peek().type === TokenType.LPAREN) {
				this.advance()
				const args = this.parseFunctionArguments()
				if (this.peek().type !== TokenType.RPAREN) {
					throw new Error('Expected closing parenthesis')
				}
				this.advance()
				return {
					type: 'FunctionCall',
					name,
					arguments: args,
				}
			}

			// Just an identifier
			return {
				type: 'Identifier',
				name,
			}
		}

		throw new Error(`Unexpected token: ${token.value}`)
	}

	/**
	 * Parse function call arguments
	 */
	private parseFunctionArguments(): ASTNode[] {
		const args: ASTNode[] = []

		if (this.peek().type === TokenType.RPAREN) {
			return args
		}

		args.push(this.parseExpression(0))

		while (this.peek().type === TokenType.COMMA) {
			this.advance() // consume comma
			args.push(this.parseExpression(0))
		}

		return args
	}

	/**
	 * Get operator precedence
	 */
	private getPrecedence(type: TokenType): number {
		switch (type) {
			case TokenType.EQUALS:
				return 1 // Assignment has lowest precedence
			case TokenType.PLUS:
			case TokenType.MINUS:
				return 2
			case TokenType.STAR:
			case TokenType.SLASH:
			case TokenType.PERCENT:
				return 3
			case TokenType.CARET:
				return 4 // Exponentiation has highest precedence
			default:
				return 0
		}
	}

	/**
	 * Get unary operator precedence
	 */
	private getUnaryPrecedence(): number {
		return 5 // Higher than all binary operators
	}

	/**
	 * Check if token is a binary operator
	 */
	private isBinaryOperator(type: TokenType): boolean {
		return (
			type === TokenType.PLUS ||
			type === TokenType.MINUS ||
			type === TokenType.STAR ||
			type === TokenType.SLASH ||
			type === TokenType.PERCENT ||
			type === TokenType.CARET
		)
	}

	/**
	 * Get current token
	 */
	private peek(): Token {
		if (this.current >= this.tokens.length) {
			return { type: TokenType.EOF, value: '', position: -1 }
		}
		const token = this.tokens[this.current]
		if (token === undefined) {
			return { type: TokenType.EOF, value: '', position: -1 }
		}
		return token
	}

	/**
	 * Advance to next token
	 */
	private advance(): void {
		this.current++
	}
}

/**
 * Parse source code string into AST
 */
export function parseSource(source: string): ASTNode {
	const lexer = new Lexer(source)
	const tokens = lexer.tokenize()
	const parser = new Parser(tokens)
	return parser.parse()
}
