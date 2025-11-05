import { Lexer } from './lexer'
import { type ASTNode, type Operator, type Token, TokenType } from './types'

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
				// Variable assignment (right-associative)
				if (left.type !== 'Identifier') {
					throw new Error('Invalid assignment target')
				}
				const identName = left.name
				this.advance() // consume =
				// Use precedence (not precedence + 1) for right-associativity
				// This allows: x = y = 5 and x = 5 > 3 ? 100 : 50
				const value = this.parseExpression(precedence)
				left = {
					type: 'Assignment',
					name: identName,
					value,
				}
			} else if (token.type === TokenType.NULLISH_ASSIGN) {
				// Nullish assignment (right-associative)
				// Assigns only if variable is undefined
				if (left.type !== 'Identifier') {
					throw new Error('Invalid assignment target')
				}
				const identName = left.name
				this.advance() // consume ??=
				const value = this.parseExpression(precedence)
				left = {
					type: 'NullishAssignment',
					name: identName,
					value,
				}
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
				left = {
					type: 'ConditionalExpression',
					condition: left,
					consequent,
					alternate,
				}
			} else if (this.isBinaryOperator(token.type)) {
				// Binary operation
				const operator = token.value as Operator
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
	 * Precedence hierarchy:
	 * 0: None
	 * 1: Assignment (=, ??=)
	 * 2: Ternary conditional (? :)
	 * 3: Logical OR (||)
	 * 4: Logical AND (&&)
	 * 5: Comparison (==, !=, <, >, <=, >=)
	 * 6: Addition/Subtraction (+, -)
	 * 7: Multiplication/Division/Modulo (*, /, %)
	 * 8: Exponentiation (^)
	 */
	private getPrecedence(type: TokenType): number {
		switch (type) {
			case TokenType.EQUALS:
			case TokenType.NULLISH_ASSIGN:
				return 1 // Assignment has lowest precedence
			case TokenType.QUESTION:
				return 2 // Ternary conditional
			case TokenType.LOGICAL_OR:
				return 3 // Logical OR
			case TokenType.LOGICAL_AND:
				return 4 // Logical AND (binds tighter than OR)
			case TokenType.DOUBLE_EQUALS:
			case TokenType.NOT_EQUALS:
			case TokenType.LESS_THAN:
			case TokenType.GREATER_THAN:
			case TokenType.LESS_EQUAL:
			case TokenType.GREATER_EQUAL:
				return 5 // Comparison operators
			case TokenType.PLUS:
			case TokenType.MINUS:
				return 6
			case TokenType.STAR:
			case TokenType.SLASH:
			case TokenType.PERCENT:
				return 7
			case TokenType.CARET:
				return 8 // Exponentiation has highest precedence
			default:
				return 0
		}
	}

	/**
	 * Get unary operator precedence
	 * Returns 6 which is higher than add/sub (6) but lower than exponentiation (8)
	 * This means: -2^2 parses as -(2^2) = -4, not (-2)^2 = 4
	 * This matches the behavior of Python, Ruby, and most languages
	 */
	private getUnaryPrecedence(): number {
		return 6
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
			type === TokenType.CARET ||
			type === TokenType.DOUBLE_EQUALS ||
			type === TokenType.NOT_EQUALS ||
			type === TokenType.LESS_THAN ||
			type === TokenType.GREATER_THAN ||
			type === TokenType.LESS_EQUAL ||
			type === TokenType.GREATER_EQUAL ||
			type === TokenType.LOGICAL_AND ||
			type === TokenType.LOGICAL_OR
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
 *
 * @param source - The source code to parse
 * @returns Parsed AST
 */
export function parseSource(source: string): ASTNode {
	const lexer = new Lexer(source)
	const tokens = lexer.tokenize()
	const parser = new Parser(tokens)
	return parser.parse()
}
