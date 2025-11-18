import * as ast from './ast'
import { type ASTNode, NodeKind, type Operator } from './ast'
import {
	type Cursor,
	createCursor,
	nextToken,
	readText,
	type Token,
	TokenKind,
} from './lexer'
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
 * Parser state object (mutable cursor for efficient iteration)
 */
interface ParserState {
	cursor: Cursor
	currentToken: Token
}

/**
 * Parse source code string into AST
 * Implements Pratt parsing (top-down operator precedence)
 * Uses lazy lexing - calls lexer on-demand instead of receiving all tokens upfront
 *
 * @param source - The source code to parse
 * @returns Parsed AST
 */
export function parse(source: string): ASTNode {
	const cursor = createCursor(source)
	const state: ParserState = {
		cursor,
		currentToken: nextToken(cursor),
	}

	const statements: ASTNode[] = []

	while (state.currentToken[0] !== TokenKind.Eof) {
		statements.push(parseExpression(state, 0))
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
 * This is the core of the parser - coordinates prefix and infix parsing
 *
 * @param state - Parser state
 * @param minPrecedence - Minimum precedence for operators to bind
 * @returns Parsed expression AST node
 */
function parseExpression(state: ParserState, minPrecedence: number): ASTNode {
	let left = parsePrefix(state)

	while (true) {
		const kind = state.currentToken[0]
		const precedence = getTokenPrecedence(kind)

		// Break if precedence is too low or token is not an infix operator (precedence = 0)
		if (precedence === 0 || precedence < minPrecedence) {
			break
		}

		left = parseInfix(state, left, precedence)
	}

	return left
}

/**
 * Parse prefix expressions (NUD - Null Denotation)
 * Handles unary operators, literals, identifiers, grouping, and function calls
 *
 * @param state - Parser state
 * @returns Parsed prefix expression AST node
 */
function parsePrefix(state: ParserState): ASTNode {
	const tokenKind = peekKind(state)

	// Unary minus
	if (tokenKind === TokenKind.Minus) {
		advance(state)
		const argument = parseExpression(state, UNARY_PRECEDENCE)
		return ast.unaryOp('-', argument)
	}

	// Logical NOT
	if (tokenKind === TokenKind.Bang) {
		advance(state)
		const argument = parseExpression(state, UNARY_PRECEDENCE)
		return ast.unaryOp('!', argument)
	}

	// Parenthesized expression
	if (tokenKind === TokenKind.LParen) {
		advance(state)
		const expr = parseExpression(state, 0)
		if (peekKind(state) !== TokenKind.RParen) {
			throw new Error('Expected closing parenthesis')
		}
		advance(state)
		return expr
	}

	// Number literal
	if (tokenKind === TokenKind.Number) {
		const token = state.currentToken
		advance(state)
		const value = Number.parseFloat(readText(state.cursor, token))
		return ast.number(value)
	}

	// Identifier or function call
	if (tokenKind === TokenKind.Identifier) {
		const token = state.currentToken
		const name = readText(state.cursor, token)
		advance(state)

		// Check for function call
		if (peekKind(state) === TokenKind.LParen) {
			advance(state)
			const args = parseFunctionArguments(state)
			if (peekKind(state) !== TokenKind.RParen) {
				throw new Error('Expected closing parenthesis')
			}
			advance(state)
			return ast.functionCall(name, args)
		}

		// Just an identifier
		return ast.identifier(name)
	}

	const token = state.currentToken
	const tokenText = readText(state.cursor, token)
	throw new Error(`Unexpected token: ${tokenText}`)
}

/**
 * Parse infix expressions (LED - Left Denotation)
 * Handles binary operators, assignment, and ternary conditional
 *
 * @param state - Parser state
 * @param left - Left-hand side expression already parsed
 * @param precedence - Precedence of the current operator
 * @returns Parsed infix expression AST node
 */
function parseInfix(
	state: ParserState,
	left: ASTNode,
	precedence: number,
): ASTNode {
	const tokenKind = peekKind(state)

	// Assignment (right-associative)
	if (tokenKind === TokenKind.Eq) {
		if (left[0] !== NodeKind.Identifier) {
			throw new Error('Invalid assignment target')
		}
		const identName = left[1] // Extract name from Identifier tuple
		advance(state) // consume =
		// Use precedence (not precedence + 1) for right-associativity
		// This allows: x = y = 5 and x = 5 > 3 ? 100 : 50
		const value = parseExpression(state, precedence)
		return ast.assign(identName, value)
	}

	// Ternary conditional expression (right-associative)
	if (tokenKind === TokenKind.Question) {
		advance(state) // consume ?
		const consequent = parseExpression(state, 0)
		if (peekKind(state) !== TokenKind.Colon) {
			throw new Error('Expected : in ternary expression')
		}
		advance(state) // consume :
		// Use precedence for right-associativity
		const alternate = parseExpression(state, precedence)
		return ast.conditional(left, consequent, alternate)
	}

	// Binary operators
	if (isBinaryOperator(tokenKind)) {
		const operator = readText(state.cursor, state.currentToken) as Operator
		advance(state) // consume operator
		// Right-associative operators (^) use precedence
		// Left-associative operators (+, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||) use precedence + 1
		const isRightAssociative = operator === '^'
		const right = parseExpression(
			state,
			isRightAssociative ? precedence : precedence + 1,
		)
		return ast.binaryOp(left, operator, right)
	}

	throw new Error('Unexpected token in infix position')
}

/**
 * Parse function call arguments
 *
 * @param state - Parser state
 * @returns Array of argument AST nodes
 */
function parseFunctionArguments(state: ParserState): ASTNode[] {
	// Empty argument list
	if (peekKind(state) === TokenKind.RParen) {
		return []
	}

	const args: ASTNode[] = []

	// Parse first argument
	args.push(parseExpression(state, 0))

	// Parse remaining arguments
	while (peekKind(state) === TokenKind.Comma) {
		advance(state) // consume comma
		args.push(parseExpression(state, 0))
	}

	return args
}

/**
 * Unary operator precedence constant
 * Value is 7 which is higher than add/sub (6) but lower than exponentiation (8)
 * This means:
 * - Binds tighter than addition: -2 + 3 parses as (-2) + 3 = 1
 * - Binds looser than exponentiation: -2^2 parses as -(2^2) = -4, not (-2)^2 = 4
 * Matches the behavior of Python, JavaScript, and most languages
 */
const UNARY_PRECEDENCE = 7

/**
 * Check if token kind is a binary operator (O(1) Set lookup)
 *
 * @param kind - Token kind to check
 * @returns True if the token is a binary operator
 */
function isBinaryOperator(kind: TokenKind): boolean {
	return BINARY_OPERATOR_TOKENS.has(kind)
}

/**
 * Get current token kind without advancing
 *
 * @param state - Parser state
 * @returns Current token kind
 */
function peekKind(state: ParserState): TokenKind {
	return state.currentToken[0]
}

/**
 * Advance to next token by calling lexer
 *
 * @param state - Parser state
 */
function advance(state: ParserState): void {
	state.currentToken = nextToken(state.cursor)
}
