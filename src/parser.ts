import * as ast from './ast'
import { type ASTNode, NodeKind, type Operator } from './ast'
import {
	type Cursor,
	createCursor,
	nextToken,
	readStringValue,
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

interface ParserState {
	cursor: Cursor
	currentToken: Token
}

/**
 * Parse source code string into AST
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

	if (statements.length === 1) {
		const singleStatement = statements[0]
		if (singleStatement === undefined) {
			throw new Error('Unexpected empty statements array')
		}
		return singleStatement
	}

	return ast.program(statements)
}

function parseExpression(state: ParserState, minPrecedence: number): ASTNode {
	let left = parsePrefix(state)

	while (true) {
		const kind = state.currentToken[0]
		const precedence = getTokenPrecedence(kind)

		if (precedence === 0 || precedence < minPrecedence) {
			break
		}

		left = parseInfix(state, left, precedence)
	}

	return left
}

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

	// Array literal
	if (tokenKind === TokenKind.LBracket) {
		advance(state) // consume [
		const elements: ASTNode[] = []
		if (peekKind(state) !== TokenKind.RBracket) {
			elements.push(parseExpression(state, 0))
			while (peekKind(state) === TokenKind.Comma) {
				advance(state) // consume comma
				elements.push(parseExpression(state, 0))
			}
		}
		if (peekKind(state) !== TokenKind.RBracket) {
			throw new Error('Expected closing bracket')
		}
		advance(state) // consume ]
		return ast.array(elements)
	}

	// Number literal
	if (tokenKind === TokenKind.Number) {
		const token = state.currentToken
		advance(state)
		const value = Number.parseFloat(readText(state.cursor, token))
		return ast.number(value)
	}

	// String literal
	if (tokenKind === TokenKind.String) {
		const token = state.currentToken
		advance(state)
		const value = readStringValue(state.cursor, token)
		return ast.string(value)
	}

	// Identifier, boolean literal, or function call
	if (tokenKind === TokenKind.Identifier) {
		const token = state.currentToken
		const name = readText(state.cursor, token)
		advance(state)

		// Boolean literals
		if (name === 'true') {
			return ast.boolean(true)
		}
		if (name === 'false') {
			return ast.boolean(false)
		}

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

function parseInfix(
	state: ParserState,
	left: ASTNode,
	precedence: number,
): ASTNode {
	const tokenKind = peekKind(state)

	// Assignment (right-associative)
	if (tokenKind === TokenKind.Eq) {
		if (left.kind !== NodeKind.Identifier) {
			throw new Error('Invalid assignment target')
		}
		const identName = left.name
		advance(state)
		const value = parseExpression(state, precedence)
		return ast.assign(identName, value)
	}

	// Ternary conditional expression (right-associative)
	if (tokenKind === TokenKind.Question) {
		advance(state)
		const consequent = parseExpression(state, 0)
		if (peekKind(state) !== TokenKind.Colon) {
			throw new Error('Expected : in ternary expression')
		}
		advance(state)
		const alternate = parseExpression(state, precedence)
		return ast.conditional(left, consequent, alternate)
	}

	// Binary operators
	if (isBinaryOperator(tokenKind)) {
		const operator = readText(state.cursor, state.currentToken) as Operator
		advance(state)
		const isRightAssociative = operator === '^'
		const right = parseExpression(
			state,
			isRightAssociative ? precedence : precedence + 1,
		)
		return ast.binaryOp(left, operator, right)
	}

	throw new Error('Unexpected token in infix position')
}

function parseFunctionArguments(state: ParserState): ASTNode[] {
	if (peekKind(state) === TokenKind.RParen) {
		return []
	}

	const args: ASTNode[] = []
	args.push(parseExpression(state, 0))

	while (peekKind(state) === TokenKind.Comma) {
		advance(state)
		args.push(parseExpression(state, 0))
	}

	return args
}

const UNARY_PRECEDENCE = 7

function isBinaryOperator(kind: TokenKind): boolean {
	return BINARY_OPERATOR_TOKENS.has(kind)
}

function peekKind(state: ParserState): TokenKind {
	return state.currentToken[0]
}

function advance(state: ParserState): void {
	state.currentToken = nextToken(state.cursor)
}
