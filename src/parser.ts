import * as ast from './ast'
import { Lexer } from './lexer'
import { type ASTNode, type Operator, type Token, TokenType } from './types'
import { getTokenPrecedence } from './utils'

/**
 * Set of binary operator token types for O(1) lookup
 */
const BINARY_OPERATOR_TOKENS = new Set([
	TokenType.PLUS,
	TokenType.MINUS,
	TokenType.STAR,
	TokenType.SLASH,
	TokenType.PERCENT,
	TokenType.CARET,
	TokenType.DOUBLE_EQUALS,
	TokenType.NOT_EQUALS,
	TokenType.LESS_THAN,
	TokenType.GREATER_THAN,
	TokenType.LESS_EQUAL,
	TokenType.GREATER_EQUAL,
	TokenType.LOGICAL_AND,
	TokenType.LOGICAL_OR,
])

/**
 * Parser using Pratt parsing (top-down operator precedence)
 * Implements an efficient O(n) parsing algorithm
 * Uses lazy lexing - calls lexer on-demand instead of receiving all tokens upfront
 */
export class Parser {
	private lexer: Lexer
	private currentToken: Token

	constructor(lexer: Lexer) {
		this.lexer = lexer
		this.currentToken = lexer.nextToken()
	}

	/**
	 * Parse tokens into an AST
	 * Supports multiple statements separated by semicolons or newlines
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
			const singleStatement = statements[0]
			if (singleStatement === undefined) {
				throw new Error('Unexpected empty statements array')
			}
			return singleStatement
		}

		return ast.program(statements)
	}

	/**
	 * Parse an expression with Pratt parsing (precedence climbing)
	 * This is the core of the parser - handles infix operators with proper precedence
	 */
	private parseExpression(minPrecedence: number): ASTNode {
		let left = this.parsePrefix()

		while (true) {
			const token = this.peek()
			const precedence = getTokenPrecedence(token.type)

			if (precedence < minPrecedence) {
				break
			}

			if (token.type === TokenType.EQUALS) {
				// Variable assignment (right-associative)
				if (left.type !== 'Identifier') {
					throw new Error('Invalid assignment target')
				}
				const identName = left.name
				this.advance() // consume =
				// Use precedence (not precedence + 1) for right-associativity
				// This allows: x = y = 5 and x = 5 > 3 ? 100 : 50
				const value = this.parseExpression(precedence)
				left = ast.assign(identName, value)
			} else if (token.type === TokenType.QUESTION) {
				// Ternary conditional expression (right-associative)
				this.advance() // consume ?
				const consequent = this.parseExpression(0)
				if (this.peek().type !== TokenType.COLON) {
					throw new Error('Expected : in ternary expression')
				}
				this.advance() // consume :
				// Use precedence for right-associativity
				const alternate = this.parseExpression(precedence)
				left = ast.conditional(left, consequent, alternate)
			} else if (this.isBinaryOperator(token.type)) {
				// Binary operation
				const operator = token.value as Operator
				this.advance() // consume operator
				// Right-associative operators (^) use precedence
				// Left-associative operators (+, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||) use precedence + 1
				const isRightAssociative = operator === '^'
				const right = this.parseExpression(
					isRightAssociative ? precedence : precedence + 1,
				)
				left = ast.binaryOp(left, operator, right)
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
			return ast.unaryOp('-', argument)
		}

		// Logical NOT
		if (token.type === TokenType.EXCLAMATION) {
			this.advance()
			const argument = this.parseExpression(this.getUnaryPrecedence())
			return ast.unaryOp('!', argument)
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
			return ast.number(token.value as number)
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
				return ast.functionCall(name, args)
			}

			// Just an identifier
			return ast.identifier(name)
		}

		throw new Error(`Unexpected token: ${token.value}`)
	}

	/**
	 * Parse function call arguments
	 */
	private parseFunctionArguments(): ASTNode[] {
		const args: ASTNode[] = []

		// Empty argument list
		if (this.peek().type === TokenType.RPAREN) {
			return args
		}

		// Parse first argument
		args.push(this.parseExpression(0))

		// Parse remaining arguments
		while (this.peek().type === TokenType.COMMA) {
			this.advance() // consume comma
			args.push(this.parseExpression(0))
		}

		return args
	}

	/**
	 * Get unary operator precedence
	 * Returns 7 which is higher than add/sub (6) but lower than exponentiation (8)
	 * This means:
	 * - Binds tighter than addition: -2 + 3 parses as (-2) + 3 = 1
	 * - Binds looser than exponentiation: -2^2 parses as -(2^2) = -4, not (-2)^2 = 4
	 * Matches the behavior of Python, JavaScript, and most languages
	 */
	private getUnaryPrecedence(): number {
		return 7
	}

	/**
	 * Check if token is a binary operator (O(1) Set lookup)
	 */
	private isBinaryOperator(type: TokenType): boolean {
		return BINARY_OPERATOR_TOKENS.has(type)
	}

	/**
	 * Get current token without advancing
	 */
	private peek(): Token {
		return this.currentToken
	}

	/**
	 * Advance to next token by calling lexer
	 */
	private advance(): void {
		this.currentToken = this.lexer.nextToken()
	}
}

/**
 * Parse source code string into AST
 * Convenience function that creates lexer and parser
 *
 * @param source - The source code to parse
 * @returns Parsed AST
 */
export function parseSource(source: string): ASTNode {
	const lexer = new Lexer(source)
	const parser = new Parser(lexer)
	return parser.parse()
}
