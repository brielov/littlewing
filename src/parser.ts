import * as ast from './ast'
import {
	type Cursor,
	createCursor,
	nextToken,
	readText,
	type Token,
	TokenKind,
} from './lexer'
import type { ASTNode, Operator } from './types'
import { getTokenPrecedence } from './utils'

/**
 * Set of binary operator token kinds for O(1) lookup
 */
const BINARY_OPERATOR_TOKENS = new Set([
	TokenKind.Plus,
	TokenKind.Minus,
	TokenKind.Star,
	TokenKind.Slash,
	TokenKind.Percent,
	TokenKind.Caret,
	TokenKind.EqEq,
	TokenKind.NotEq,
	TokenKind.Lt,
	TokenKind.Gt,
	TokenKind.Le,
	TokenKind.Ge,
	TokenKind.And,
	TokenKind.Or,
])

/**
 * Parser using Pratt parsing (top-down operator precedence)
 * Implements an efficient O(n) parsing algorithm
 * Uses lazy lexing - calls lexer on-demand instead of receiving all tokens upfront
 */
export class Parser {
	private cursor: Cursor
	private currentToken: Token

	constructor(cursor: Cursor) {
		this.cursor = cursor
		this.currentToken = nextToken(cursor)
	}

	/**
	 * Parse tokens into an AST
	 * Supports multiple statements separated by semicolons or newlines
	 */
	parse(): ASTNode {
		const statements: ASTNode[] = []

		while (this.peekKind() !== TokenKind.Eof) {
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
			const tokenKind = this.peekKind()
			const precedence = getTokenPrecedence(tokenKind)

			if (precedence < minPrecedence) {
				break
			}

			if (tokenKind === TokenKind.Eq) {
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
			} else if (tokenKind === TokenKind.Question) {
				// Ternary conditional expression (right-associative)
				this.advance() // consume ?
				const consequent = this.parseExpression(0)
				if (this.peekKind() !== TokenKind.Colon) {
					throw new Error('Expected : in ternary expression')
				}
				this.advance() // consume :
				// Use precedence for right-associativity
				const alternate = this.parseExpression(precedence)
				left = ast.conditional(left, consequent, alternate)
			} else if (this.isBinaryOperator(tokenKind)) {
				// Binary operation
				const operator = this.getOperatorFromToken(this.currentToken)
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
		const tokenKind = this.peekKind()

		// Unary minus
		if (tokenKind === TokenKind.Minus) {
			this.advance()
			const argument = this.parseExpression(this.getUnaryPrecedence())
			return ast.unaryOp('-', argument)
		}

		// Logical NOT
		if (tokenKind === TokenKind.Bang) {
			this.advance()
			const argument = this.parseExpression(this.getUnaryPrecedence())
			return ast.unaryOp('!', argument)
		}

		// Parenthesized expression
		if (tokenKind === TokenKind.LParen) {
			this.advance()
			const expr = this.parseExpression(0)
			if (this.peekKind() !== TokenKind.RParen) {
				throw new Error('Expected closing parenthesis')
			}
			this.advance()
			return expr
		}

		// Number literal
		if (tokenKind === TokenKind.Number) {
			const token = this.currentToken
			this.advance()
			const value = Number.parseFloat(readText(this.cursor, token))
			return ast.number(value)
		}

		// Identifier or function call
		if (tokenKind === TokenKind.Identifier) {
			const token = this.currentToken
			const name = readText(this.cursor, token)
			this.advance()

			// Check for function call
			if (this.peekKind() === TokenKind.LParen) {
				this.advance()
				const args = this.parseFunctionArguments()
				if (this.peekKind() !== TokenKind.RParen) {
					throw new Error('Expected closing parenthesis')
				}
				this.advance()
				return ast.functionCall(name, args)
			}

			// Just an identifier
			return ast.identifier(name)
		}

		const token = this.currentToken
		const tokenText = readText(this.cursor, token)
		throw new Error(`Unexpected token: ${tokenText}`)
	}

	/**
	 * Parse function call arguments
	 */
	private parseFunctionArguments(): ASTNode[] {
		const args: ASTNode[] = []

		// Empty argument list
		if (this.peekKind() === TokenKind.RParen) {
			return args
		}

		// Parse first argument
		args.push(this.parseExpression(0))

		// Parse remaining arguments
		while (this.peekKind() === TokenKind.Comma) {
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
	 * Check if token kind is a binary operator (O(1) Set lookup)
	 */
	private isBinaryOperator(kind: TokenKind): boolean {
		return BINARY_OPERATOR_TOKENS.has(kind)
	}

	/**
	 * Get the operator string from a token
	 * Extracts the text representation of an operator token
	 */
	private getOperatorFromToken(token: Token): Operator {
		return readText(this.cursor, token) as Operator
	}

	/**
	 * Get current token kind without advancing
	 */
	private peekKind(): TokenKind {
		return this.currentToken[0]
	}

	/**
	 * Advance to next token by calling lexer
	 */
	private advance(): void {
		this.currentToken = nextToken(this.cursor)
	}
}

/**
 * Parse source code string into AST
 * Convenience function that creates cursor and parser
 *
 * @param source - The source code to parse
 * @returns Parsed AST
 */
export function parse(source: string): ASTNode {
	const cursor = createCursor(source)
	const parser = new Parser(cursor)
	return parser.parse()
}
