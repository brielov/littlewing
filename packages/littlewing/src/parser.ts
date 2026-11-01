import * as ast from './ast.js';
import { type ASTNode, NodeKind, type Operator } from './ast.js';
import { ParseError } from './errors.js';
import {
	type Comment,
	type Cursor,
	createCursor,
	nextToken,
	readStringValue,
	readText,
	type Token,
	TokenKind,
} from './lexer.js';
import { getTokenPrecedence, Precedence } from './utils.js';

/**
 * Deepest allowed nesting of sub-expressions. Each level costs the parser several
 * stack frames, so this stays well below what the call stack can hold.
 */
const MAX_NESTING = 256;

/**
 * Tallest allowed AST for one statement. Operator chains grow the tree without
 * recursing here, but every later pass recurses once per level, so this keeps
 * those passes within the call stack while leaving room for long formulas like
 * `a + b + c + ...`.
 */
const MAX_HEIGHT = 1024;

interface ParserState {
	cursor: Cursor;
	currentToken: Token;
	/** End offset of the most recently consumed token */
	previousEnd: number;
	/** Current nesting of the expression being parsed */
	nesting: number;
	/** Deepest AST level reached by the expression being parsed */
	height: number;
	/**
	 * How many delimiters (brackets, or keyword pairs like `if`/`then`) surround
	 * the current position. Line breaks inside them never end an expression.
	 */
	enclosed: number;
}

/**
 * Parse source code string into AST
 */
export function parse(source: string): ASTNode {
	const cursor = createCursor(source);
	const state: ParserState = {
		cursor,
		currentToken: nextToken(cursor),
		previousEnd: 0,
		nesting: 0,
		height: 0,
		enclosed: 0,
	};

	const statements: ASTNode[] = [];
	const statementOffsets: number[] = [];
	let programEnd = 0;

	while (true) {
		while (peekKind(state) === TokenKind.Semicolon) advance(state);
		if (peekKind(state) === TokenKind.Eof) break;

		statementOffsets.push(state.currentToken[1]);
		statements.push(parseExpression(state, Precedence.None));
		programEnd = state.previousEnd;

		const kind = peekKind(state);
		if (kind !== TokenKind.Semicolon && kind !== TokenKind.Eof && !cursor.newlineBefore) {
			throw errorAtToken(state, `Expected end of statement, got ${describeToken(state)}`);
		}
	}

	if (statements.length === 0) {
		throw new ParseError('Empty program', 0, 0);
	}

	const annotated = attachComments(source, statements, statementOffsets, cursor.comments);

	// Unwrap single-statement Programs unless there are program-level trailing comments,
	// which require a Program node to emit correctly (own-line vs inline distinction).
	if (annotated.statements.length === 1 && !annotated.programTrailing) {
		return annotated.statements[0] as ASTNode;
	}

	const program = ast.program(annotated.statements, statementOffsets[0], programEnd);
	return annotated.programTrailing
		? { ...program, trailingComments: annotated.programTrailing }
		: program;
}

/**
 * Check if a comment is inline (on the same line as preceding code), given that
 * code precedes it somewhere in the source.
 */
function isInlineComment(source: string, commentOffset: number): boolean {
	let i = commentOffset - 1;
	let ch = source.charCodeAt(i);
	while (ch === 0x20 || ch === 0x09 || ch === 0x3b) {
		ch = source.charCodeAt(--i);
	}
	return ch !== 0x0a && ch !== 0x0d;
}

interface AttachResult {
	statements: readonly ASTNode[];
	programTrailing: string[] | undefined;
}

/**
 * Attach collected comments to statements.
 *
 * - Inline comments (on the same line as code) → trailingComments on the preceding statement
 * - Own-line comments before a statement → leadingComments on the following statement
 * - Own-line comments after the last statement → programTrailing (trailingComments on Program)
 *
 * Comments and statements are both in source order, so one merge pass places them all.
 */
function attachComments(
	source: string,
	statements: readonly ASTNode[],
	statementOffsets: readonly number[],
	comments: readonly Comment[],
): AttachResult {
	if (comments.length === 0) {
		return { statements, programTrailing: undefined };
	}

	const leading: (string[] | undefined)[] = [];
	const trailing: (string[] | undefined)[] = [];
	let programTrailing: string[] | undefined;
	// Number of statements that start before the current comment
	let started = 0;

	for (const comment of comments) {
		while (
			started < statementOffsets.length &&
			(statementOffsets[started] as number) <= comment.offset
		) {
			started++;
		}

		if (started > 0 && isInlineComment(source, comment.offset)) {
			(trailing[started - 1] ??= []).push(comment.text);
		} else if (started < statements.length) {
			(leading[started] ??= []).push(comment.text);
		} else {
			(programTrailing ??= []).push(comment.text);
		}
	}

	const result = statements.map((stmt, i) => {
		const leadingComments = leading[i];
		const trailingComments = trailing[i];
		if (!leadingComments && !trailingComments) return stmt;
		return {
			...stmt,
			...(leadingComments ? { leadingComments } : {}),
			...(trailingComments ? { trailingComments } : {}),
		};
	});

	return { statements: result, programTrailing };
}

function parseExpression(state: ParserState, minPrecedence: number): ASTNode {
	const start = state.currentToken[1];
	const entryNesting = state.nesting;
	const entryHeight = state.height;

	if (++state.nesting > MAX_NESTING) throw tooDeep(state, start);
	state.height = state.nesting;

	let left = parsePrefix(state);

	while (true) {
		const kind = peekKind(state);

		// `[` and `-` could continue the expression or start a new one.
		// At a line start they start a new statement, unless enclosed.
		if ((kind === TokenKind.LBracket || kind === TokenKind.Minus) && startsNewLine(state)) {
			break;
		}

		// Postfix: bracket indexing (highest precedence, chains naturally)
		if (kind === TokenKind.LBracket) {
			growTree(state, start);
			advance(state); // consume [
			const index = parseEnclosed(state);
			expect(state, TokenKind.RBracket, 'Expected closing bracket');
			left = ast.indexAccess(left, index, start, state.previousEnd);
			continue;
		}

		// Infix: binary operators (including ranges)
		const precedence = getTokenPrecedence(kind);

		if (precedence === Precedence.None || precedence < minPrecedence) {
			break;
		}

		growTree(state, start);
		left = parseInfix(state, left, precedence, start);
	}

	state.nesting = entryNesting;
	state.height = Math.max(entryHeight, state.height);
	return left;
}

/**
 * Parse an expression closed by a delimiter, where line breaks are insignificant.
 */
function parseEnclosed(state: ParserState): ASTNode {
	state.enclosed++;
	const expression = parseExpression(state, Precedence.None);
	state.enclosed--;
	return expression;
}

function parsePrefix(state: ParserState): ASTNode {
	const token = state.currentToken;
	const start = token[1];

	switch (token[0]) {
		case TokenKind.Minus:
		case TokenKind.Bang: {
			const operator = token[0] === TokenKind.Minus ? '-' : '!';
			advance(state);
			const argument = parseExpression(state, Precedence.Exponent);
			return ast.unaryOp(operator, argument, start, state.previousEnd);
		}

		case TokenKind.LParen: {
			advance(state);
			const expr = parseEnclosed(state);
			expect(state, TokenKind.RParen, 'Expected closing parenthesis');
			return expr;
		}

		case TokenKind.LBracket:
			return parseArrayLiteral(state);

		case TokenKind.If:
			return parseIfExpression(state);

		case TokenKind.For:
			return parseForExpression(state);

		case TokenKind.Number: {
			advance(state);
			const value = Number.parseFloat(readText(state.cursor, token));
			if (!Number.isFinite(value)) {
				throw new ParseError(
					`Number out of range: ${readText(state.cursor, token)}`,
					start,
					token[2],
				);
			}
			return ast.number(value, start, token[2]);
		}

		case TokenKind.String:
			advance(state);
			return ast.string(readStringValue(state.cursor, token), start, token[2]);

		case TokenKind.True:
		case TokenKind.False:
			advance(state);
			return ast.boolean(token[0] === TokenKind.True, start, token[2]);

		case TokenKind.Identifier: {
			const name = readText(state.cursor, token);
			advance(state);

			if (peekKind(state) === TokenKind.LParen && !startsNewLine(state)) {
				advance(state);
				const args = parseArguments(state, parseEnclosed);
				expect(state, TokenKind.RParen, 'Expected closing parenthesis');
				return ast.functionCall(name, args, start, state.previousEnd);
			}

			return ast.identifier(name, start, token[2]);
		}

		default:
			throw errorAtToken(state, `Unexpected ${describeToken(state)}`);
	}
}

function parseArrayLiteral(state: ParserState): ASTNode {
	const start = state.currentToken[1];
	advance(state); // consume [

	const elements: ASTNode[] = [];
	if (peekKind(state) !== TokenKind.RBracket) {
		elements.push(parseEnclosed(state));
		while (peekKind(state) === TokenKind.Comma) {
			advance(state); // consume comma
			elements.push(parseEnclosed(state));
		}
	}
	expect(state, TokenKind.RBracket, 'Expected closing bracket');
	return ast.array(elements, start, state.previousEnd);
}

/**
 * Parse an if expression. An `else if` chain is flat in the source however long
 * it runs, so it is parsed in a loop rather than one recursion per branch.
 */
function parseIfExpression(state: ParserState): ASTNode {
	const branches: { start: number; condition: ASTNode; consequent: ASTNode }[] = [];

	do {
		const start = state.currentToken[1];
		advance(state); // consume 'if'
		const condition = parseEnclosed(state);
		expect(state, TokenKind.Then, 'Expected "then" in if expression');
		const consequent = parseEnclosed(state);
		expect(state, TokenKind.Else, 'Expected "else" in if expression');
		branches.push({ start, condition, consequent });
	} while (peekKind(state) === TokenKind.If);

	let expression = parseExpression(state, Precedence.None);
	const end = state.previousEnd;

	for (let i = branches.length - 1; i >= 0; i--) {
		const { start, condition, consequent } = branches[i] as (typeof branches)[number];
		growTree(state, start);
		expression = ast.ifExpr(condition, consequent, expression, start, end);
	}
	return expression;
}

function parseForExpression(state: ParserState): ASTNode {
	const start = state.currentToken[1];
	advance(state); // consume 'for'

	const variable = expectName(state, 'Expected identifier after "for"');
	expect(state, TokenKind.In, 'Expected "in" in for expression');
	const iterable = parseEnclosed(state);

	let guard: ASTNode | null = null;
	if (peekKind(state) === TokenKind.When) {
		advance(state); // consume 'when'
		guard = parseEnclosed(state);
	}

	let accumulator: { readonly name: string; readonly initial: ASTNode } | null = null;
	if (peekKind(state) === TokenKind.Into) {
		advance(state); // consume 'into'
		const nameToken = state.currentToken;
		const name = expectName(state, 'Expected identifier after "into"');
		if (name === variable) {
			throw new ParseError(
				`Accumulator "${name}" must not share its name with the loop variable`,
				nameToken[1],
				nameToken[2],
			);
		}
		expect(state, TokenKind.Eq, 'Expected "=" after accumulator name');
		accumulator = { name, initial: parseEnclosed(state) };
	}

	expect(state, TokenKind.Then, 'Expected "then" in for expression');
	const body = parseExpression(state, Precedence.None);
	return ast.forExpr(variable, iterable, guard, accumulator, body, start, state.previousEnd);
}

function parseInfix(state: ParserState, left: ASTNode, precedence: number, start: number): ASTNode {
	const tokenKind = peekKind(state);

	switch (tokenKind) {
		// Assignment (right-associative)
		case TokenKind.Eq: {
			// A parenthesized target ends before the closing parenthesis
			if (left.kind !== NodeKind.Identifier || left.end !== state.previousEnd) {
				throw errorAtToken(state, 'Invalid assignment target');
			}
			advance(state);
			const value = parseExpression(state, precedence);
			return ast.assign(left.name, value, start, state.previousEnd);
		}

		case TokenKind.DotDot:
		case TokenKind.DotDotEq: {
			advance(state);
			const to = parseExpression(state, precedence + 1);
			return ast.rangeExpr(left, to, tokenKind === TokenKind.DotDotEq, start, state.previousEnd);
		}

		case TokenKind.Pipe:
			return parsePipe(state, left, start);

		default: {
			const operator = readText(state.cursor, state.currentToken) as Operator;
			advance(state);
			const isRightAssociative = tokenKind === TokenKind.Caret;
			const right = parseExpression(state, isRightAssociative ? precedence : precedence + 1);
			return ast.binaryOp(left, operator, right, start, state.previousEnd);
		}
	}
}

function parsePipe(state: ParserState, value: ASTNode, start: number): ASTNode {
	advance(state); // consume |>
	const name = expectName(state, 'Expected function name after |>');
	expect(state, TokenKind.LParen, 'Expected ( after function name in pipe expression');
	const args = parseArguments(state, parsePipeArgument);
	expect(state, TokenKind.RParen, 'Expected closing parenthesis');
	if (!args.some((arg) => arg.kind === NodeKind.Placeholder)) {
		throw new ParseError(
			'Pipe expression requires at least one ? placeholder',
			start,
			state.previousEnd,
		);
	}
	return ast.pipeExpr(value, name, args, start, state.previousEnd);
}

function parseArguments(
	state: ParserState,
	parseArgument: (state: ParserState) => ASTNode,
): ASTNode[] {
	if (peekKind(state) === TokenKind.RParen) {
		return [];
	}

	const args = [parseArgument(state)];
	while (peekKind(state) === TokenKind.Comma) {
		advance(state);
		args.push(parseArgument(state));
	}
	return args;
}

function parsePipeArgument(state: ParserState): ASTNode {
	if (peekKind(state) === TokenKind.Question) {
		const token = state.currentToken;
		advance(state); // consume ?
		return ast.placeholder(token[1], token[2]);
	}
	return parseEnclosed(state);
}

/**
 * Account for an operator wrapping everything parsed so far in a new AST level.
 */
function growTree(state: ParserState, start: number): void {
	if (++state.height > MAX_HEIGHT) throw tooDeep(state, start);
}

function tooDeep(state: ParserState, start: number): ParseError {
	return new ParseError('Expression is too deeply nested', start, state.currentToken[2]);
}

/**
 * Whether the current token sits on a new line where a line break ends an expression.
 */
function startsNewLine(state: ParserState): boolean {
	return state.cursor.newlineBefore && state.enclosed === 0;
}

function describeToken(state: ParserState): string {
	const text = readText(state.cursor, state.currentToken);
	return text === '' ? 'end of input' : `token: ${text}`;
}

function errorAtToken(state: ParserState, message: string): ParseError {
	return new ParseError(message, state.currentToken[1], state.currentToken[2]);
}

function peekKind(state: ParserState): TokenKind {
	return state.currentToken[0];
}

function advance(state: ParserState): void {
	state.previousEnd = state.currentToken[2];
	state.currentToken = nextToken(state.cursor);
}

function expect(state: ParserState, kind: TokenKind, message: string): void {
	if (peekKind(state) !== kind) {
		throw errorAtToken(state, message);
	}
	advance(state);
}

/**
 * Consume an identifier token and return its name.
 */
function expectName(state: ParserState, message: string): string {
	const name = readText(state.cursor, state.currentToken);
	expect(state, TokenKind.Identifier, message);
	return name;
}
