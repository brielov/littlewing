import * as ast from "./ast";
import { type ASTNode, NodeKind, type Operator } from "./ast";
import { ParseError } from "./errors";
import {
	type Comment,
	type Cursor,
	createCursor,
	nextToken,
	readStringValue,
	readText,
	type Token,
	TokenKind,
} from "./lexer";
import { getTokenPrecedence } from "./utils";

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
	TokenKind.DotDot,
	TokenKind.DotDotEq,
]);

interface ParserState {
	cursor: Cursor;
	currentToken: Token;
}

/**
 * Parse source code string into AST
 */
export function parse(source: string): ASTNode {
	const cursor = createCursor(source);
	const state: ParserState = {
		cursor,
		currentToken: nextToken(cursor),
	};

	const statements: ASTNode[] = [];
	const statementOffsets: number[] = [];

	while (state.currentToken[0] !== TokenKind.Eof) {
		statementOffsets.push(state.currentToken[1]);
		statements.push(parseExpression(state, 0));
	}

	if (statements.length === 0) {
		throw new ParseError("Empty program", 0, 0);
	}

	const annotated = attachComments(source, statements, statementOffsets, cursor.comments);

	// Unwrap single-statement Programs unless there are program-level trailing comments,
	// which require a Program node to emit correctly (own-line vs inline distinction).
	if (annotated.statements.length === 1 && !annotated.programTrailing) {
		const stmt = annotated.statements[0];
		if (stmt === undefined) {
			throw new ParseError("Unexpected empty statements array", 0, 0);
		}
		return stmt;
	}

	const program: ast.Program = {
		kind: NodeKind.Program,
		statements: annotated.statements,
		...(annotated.programTrailing ? { trailingComments: annotated.programTrailing } : {}),
	};
	return program;
}

/**
 * Check if a comment is inline (on the same line as preceding code).
 * Walks backward from the comment offset looking for non-whitespace before a newline.
 */
function isInlineComment(source: string, commentOffset: number): boolean {
	for (let i = commentOffset - 1; i >= 0; i--) {
		const ch = source.charCodeAt(i);
		if (ch === 0x0a || ch === 0x0d) return false;
		if (ch !== 0x20 && ch !== 0x09 && ch !== 0x3b) return true;
	}
	return false;
}

/**
 * Find the index of the last statement whose start offset <= commentOffset.
 * Returns -1 if the comment precedes all statements.
 */
function findPrecedingStatement(
	statementOffsets: readonly number[],
	commentOffset: number,
): number {
	let result = -1;
	for (let i = 0; i < statementOffsets.length; i++) {
		const offset = statementOffsets[i];
		if (offset !== undefined && offset <= commentOffset) {
			result = i;
		} else {
			break;
		}
	}
	return result;
}

/**
 * Find the index of the first statement whose start offset > commentOffset.
 * Returns -1 if no such statement exists.
 */
function findFollowingStatement(
	statementOffsets: readonly number[],
	commentOffset: number,
): number {
	for (let i = 0; i < statementOffsets.length; i++) {
		const offset = statementOffsets[i];
		if (offset !== undefined && offset > commentOffset) {
			return i;
		}
	}
	return -1;
}

interface AttachResult {
	statements: ASTNode[];
	programTrailing: string[] | undefined;
}

/**
 * Attach collected comments to statements.
 *
 * - Inline comments (on the same line as code) → trailingComments on the preceding statement
 * - Own-line comments before a statement → leadingComments on the following statement
 * - Own-line comments after the last statement → programTrailing (trailingComments on Program)
 */
function attachComments(
	source: string,
	statements: readonly ASTNode[],
	statementOffsets: readonly number[],
	comments: readonly Comment[],
): AttachResult {
	if (comments.length === 0) {
		return { statements: statements.slice(), programTrailing: undefined };
	}

	const leadingByStmt = new Map<number, string[]>();
	const trailingByStmt = new Map<number, string[]>();
	let programTrailing: string[] | undefined;

	for (const comment of comments) {
		if (isInlineComment(source, comment.offset)) {
			// Inline comment: attach as trailing on the preceding statement
			const idx = findPrecedingStatement(statementOffsets, comment.offset);
			if (idx >= 0) {
				const existing = trailingByStmt.get(idx);
				if (existing) {
					existing.push(comment.text);
				} else {
					trailingByStmt.set(idx, [comment.text]);
				}
			} else {
				// Inline comment before any statement (shouldn't happen, but handle gracefully)
				const following = findFollowingStatement(statementOffsets, comment.offset);
				if (following >= 0) {
					const existing = leadingByStmt.get(following);
					if (existing) {
						existing.push(comment.text);
					} else {
						leadingByStmt.set(following, [comment.text]);
					}
				}
			}
		} else {
			// Own-line comment: attach as leading on the following statement
			const following = findFollowingStatement(statementOffsets, comment.offset);
			if (following >= 0) {
				const existing = leadingByStmt.get(following);
				if (existing) {
					existing.push(comment.text);
				} else {
					leadingByStmt.set(following, [comment.text]);
				}
			} else {
				// After the last statement
				if (!programTrailing) {
					programTrailing = [];
				}
				programTrailing.push(comment.text);
			}
		}
	}

	const result: ASTNode[] = [];
	for (let i = 0; i < statements.length; i++) {
		let stmt = statements[i] as ASTNode;
		const leading = leadingByStmt.get(i);
		const trailing = trailingByStmt.get(i);
		if (leading || trailing) {
			stmt = {
				...stmt,
				...(leading ? { leadingComments: leading } : {}),
				...(trailing ? { trailingComments: trailing } : {}),
			};
		}
		result.push(stmt);
	}

	return { statements: result, programTrailing };
}

function parseExpression(state: ParserState, minPrecedence: number): ASTNode {
	let left = parsePrefix(state);

	while (true) {
		// Postfix: bracket indexing (highest precedence, chains naturally)
		if (peekKind(state) === TokenKind.LBracket) {
			advance(state); // consume [
			const index = parseExpression(state, 0);
			if (peekKind(state) !== TokenKind.RBracket) {
				throw new ParseError(
					"Expected closing bracket",
					state.currentToken[1],
					state.currentToken[2],
				);
			}
			advance(state); // consume ]
			left = ast.indexAccess(left, index);
			continue;
		}

		// Infix: binary operators (including ranges)
		const kind = state.currentToken[0];
		const precedence = getTokenPrecedence(kind);

		if (precedence === 0 || precedence < minPrecedence) {
			break;
		}

		left = parseInfix(state, left, precedence);
	}

	return left;
}

function parsePrefix(state: ParserState): ASTNode {
	const tokenKind = peekKind(state);

	// Unary minus
	if (tokenKind === TokenKind.Minus) {
		advance(state);
		const argument = parseExpression(state, UNARY_PRECEDENCE);
		return ast.unaryOp("-", argument);
	}

	// Logical NOT
	if (tokenKind === TokenKind.Bang) {
		advance(state);
		const argument = parseExpression(state, UNARY_PRECEDENCE);
		return ast.unaryOp("!", argument);
	}

	// Parenthesized expression
	if (tokenKind === TokenKind.LParen) {
		advance(state);
		const expr = parseExpression(state, 0);
		if (peekKind(state) !== TokenKind.RParen) {
			throw new ParseError(
				"Expected closing parenthesis",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state);
		return expr;
	}

	// Array literal
	if (tokenKind === TokenKind.LBracket) {
		advance(state); // consume [
		const elements: ASTNode[] = [];
		if (peekKind(state) !== TokenKind.RBracket) {
			elements.push(parseExpression(state, 0));
			while (peekKind(state) === TokenKind.Comma) {
				advance(state); // consume comma
				elements.push(parseExpression(state, 0));
			}
		}
		if (peekKind(state) !== TokenKind.RBracket) {
			throw new ParseError(
				"Expected closing bracket",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume ]
		return ast.array(elements);
	}

	// If expression
	if (tokenKind === TokenKind.If) {
		advance(state); // consume 'if'
		const condition = parseExpression(state, 0);
		if (peekKind(state) !== TokenKind.Then) {
			throw new ParseError(
				'Expected "then" in if expression',
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume 'then'
		const consequent = parseExpression(state, 0);
		if (peekKind(state) !== TokenKind.Else) {
			throw new ParseError(
				'Expected "else" in if expression',
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume 'else'
		const alternate = parseExpression(state, 0);
		return ast.ifExpr(condition, consequent, alternate);
	}

	// For expression
	if (tokenKind === TokenKind.For) {
		advance(state); // consume 'for'
		if (peekKind(state) !== TokenKind.Identifier) {
			throw new ParseError(
				'Expected identifier after "for"',
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		const variableName = readText(state.cursor, state.currentToken);
		advance(state); // consume variable name
		if (peekKind(state) !== TokenKind.In) {
			throw new ParseError(
				'Expected "in" in for expression',
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume 'in'
		const iterable = parseExpression(state, 0);
		let guard: ASTNode | null = null;
		if (peekKind(state) === TokenKind.When) {
			advance(state); // consume 'when'
			guard = parseExpression(state, 0);
		}
		let accumulator: { readonly name: string; readonly initial: ASTNode } | null = null;
		if (peekKind(state) === TokenKind.Into) {
			advance(state); // consume 'into'
			if (peekKind(state) !== TokenKind.Identifier) {
				throw new ParseError(
					'Expected identifier after "into"',
					state.currentToken[1],
					state.currentToken[2],
				);
			}
			const accName = readText(state.cursor, state.currentToken);
			advance(state); // consume accumulator name
			if (peekKind(state) !== TokenKind.Eq) {
				throw new ParseError(
					'Expected "=" after accumulator name',
					state.currentToken[1],
					state.currentToken[2],
				);
			}
			advance(state); // consume '='
			const initial = parseExpression(state, 0);
			accumulator = { name: accName, initial };
		}
		if (peekKind(state) !== TokenKind.Then) {
			throw new ParseError(
				'Expected "then" in for expression',
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume 'then'
		const body = parseExpression(state, 0);
		return ast.forExpr(variableName, iterable, guard, accumulator, body);
	}

	// Number literal
	if (tokenKind === TokenKind.Number) {
		const token = state.currentToken;
		advance(state);
		const value = Number.parseFloat(readText(state.cursor, token));
		return ast.number(value);
	}

	// String literal
	if (tokenKind === TokenKind.String) {
		const token = state.currentToken;
		advance(state);
		const value = readStringValue(state.cursor, token);
		return ast.string(value);
	}

	// Identifier, boolean literal, or function call
	if (tokenKind === TokenKind.Identifier) {
		const token = state.currentToken;
		const name = readText(state.cursor, token);
		advance(state);

		// Boolean literals
		if (name === "true") {
			return ast.boolean(true);
		}
		if (name === "false") {
			return ast.boolean(false);
		}

		// Check for function call
		if (peekKind(state) === TokenKind.LParen) {
			advance(state);
			const args = parseFunctionArguments(state);
			if (peekKind(state) !== TokenKind.RParen) {
				throw new ParseError(
					"Expected closing parenthesis",
					state.currentToken[1],
					state.currentToken[2],
				);
			}
			advance(state);
			return ast.functionCall(name, args);
		}

		// Just an identifier
		return ast.identifier(name);
	}

	const token = state.currentToken;
	const tokenText = readText(state.cursor, token);
	throw new ParseError(`Unexpected token: ${tokenText}`, token[1], token[2]);
}

function parseInfix(state: ParserState, left: ASTNode, precedence: number): ASTNode {
	const tokenKind = peekKind(state);

	// Assignment (right-associative)
	if (tokenKind === TokenKind.Eq) {
		if (left.kind !== NodeKind.Identifier) {
			throw new ParseError(
				"Invalid assignment target",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		const identName = left.name;
		advance(state);
		const value = parseExpression(state, precedence);
		return ast.assign(identName, value);
	}

	// Range operators
	if (tokenKind === TokenKind.DotDot || tokenKind === TokenKind.DotDotEq) {
		const inclusive = tokenKind === TokenKind.DotDotEq;
		advance(state);
		const right = parseExpression(state, precedence + 1);
		return ast.rangeExpr(left, right, inclusive);
	}

	// Pipe operator
	if (tokenKind === TokenKind.Pipe) {
		advance(state); // consume |>
		if (peekKind(state) !== TokenKind.Identifier) {
			throw new ParseError(
				"Expected function name after |>",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		const name = readText(state.cursor, state.currentToken);
		advance(state); // consume function name
		if (peekKind(state) !== TokenKind.LParen) {
			throw new ParseError(
				"Expected ( after function name in pipe expression",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume (
		const args = parsePipeArguments(state);
		if (peekKind(state) !== TokenKind.RParen) {
			throw new ParseError(
				"Expected closing parenthesis",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		advance(state); // consume )
		let hasPlaceholder = false;
		for (const arg of args) {
			if (arg.kind === NodeKind.Placeholder) {
				hasPlaceholder = true;
				break;
			}
		}
		if (!hasPlaceholder) {
			throw new ParseError(
				"Pipe expression requires at least one ? placeholder",
				state.currentToken[1],
				state.currentToken[2],
			);
		}
		return ast.pipeExpr(left, name, args);
	}

	// Binary operators
	if (isBinaryOperator(tokenKind)) {
		const operator = readText(state.cursor, state.currentToken) as Operator;
		advance(state);
		const isRightAssociative = operator === "^";
		const right = parseExpression(state, isRightAssociative ? precedence : precedence + 1);
		return ast.binaryOp(left, operator, right);
	}

	throw new ParseError(
		"Unexpected token in infix position",
		state.currentToken[1],
		state.currentToken[2],
	);
}

function parseFunctionArguments(state: ParserState): ASTNode[] {
	if (peekKind(state) === TokenKind.RParen) {
		return [];
	}

	const args: ASTNode[] = [];
	args.push(parseExpression(state, 0));

	while (peekKind(state) === TokenKind.Comma) {
		advance(state);
		args.push(parseExpression(state, 0));
	}

	return args;
}

function parsePipeArguments(state: ParserState): ASTNode[] {
	if (peekKind(state) === TokenKind.RParen) {
		return [];
	}

	const args: ASTNode[] = [];
	args.push(parsePipeArg(state));

	while (peekKind(state) === TokenKind.Comma) {
		advance(state);
		args.push(parsePipeArg(state));
	}

	return args;
}

function parsePipeArg(state: ParserState): ASTNode {
	if (peekKind(state) === TokenKind.Question) {
		advance(state); // consume ?
		return ast.placeholder();
	}
	return parseExpression(state, 0);
}

const UNARY_PRECEDENCE = 8;

function isBinaryOperator(kind: TokenKind): boolean {
	return BINARY_OPERATOR_TOKENS.has(kind);
}

function peekKind(state: ParserState): TokenKind {
	return state.currentToken[0];
}

function advance(state: ParserState): void {
	state.currentToken = nextToken(state.cursor);
}
