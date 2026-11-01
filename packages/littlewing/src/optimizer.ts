import * as ast from './ast.js';
import {
	type ArrayLiteral,
	type ASTNode,
	type BooleanLiteral,
	forEachChild,
	isBooleanLiteral,
	isNumberLiteral,
	isStringLiteral,
	mapChildren,
	NodeKind,
	type NumberLiteral,
	type Operator,
	type Program,
	type StringLiteral,
} from './ast.js';
import { setBudget } from './limits.js';
import type { RuntimeValue } from './types.js';
import {
	buildRange,
	collectFreeIdentifiers,
	evaluateBinaryOperation,
	resolveIndex,
} from './utils.js';

/**
 * Longest string literal folding may produce. Propagation can double a string
 * per statement, so this keeps a short program from building an enormous one.
 */
const MAX_FOLDED_STRING_LENGTH = 4096;

/**
 * Longest string constant copied to where it is read. Each copy adds its whole
 * length to the output, and folding an index into one has to split it again.
 */
const MAX_PROPAGATED_STRING_LENGTH = 64;

/**
 * Most elements a range may expand to. Beyond this an array literal is both
 * larger and slower to evaluate than the range it replaced.
 */
const MAX_FOLDED_RANGE_LENGTH = 64;

export interface OptimizeOptions {
	/**
	 * The variables the host may supply through `ExecutionContext.variables`.
	 * Passing this enables constant propagation, which treats every other
	 * variable as fully determined by the program.
	 */
	readonly externalVariables?: ReadonlySet<string>;
	/**
	 * Keep every assignment, so that `evaluateScope` reports the same variables as
	 * it does for the original program. By default only the program's result is
	 * preserved: assignments that do not contribute to it are removed, so a variable
	 * can go missing from the scope or show the value it held before.
	 */
	readonly preserveScope?: boolean;
}

type Literal = NumberLiteral | StringLiteral | BooleanLiteral;

function isLiteral(node: ASTNode): node is Literal {
	return isNumberLiteral(node) || isStringLiteral(node) || isBooleanLiteral(node);
}

/**
 * Check if an array literal is guaranteed to construct: all literals of one kind.
 */
function isConstantArray(node: ArrayLiteral): boolean {
	const first = node.elements[0];
	return node.elements.every((element) => isLiteral(element) && element.kind === first?.kind);
}

/**
 * Get the items of a constant that can be indexed at compile time.
 */
function constantItems(node: ASTNode): readonly RuntimeValue[] | undefined {
	if (isStringLiteral(node)) return Array.from(node.value);
	if (node.kind === NodeKind.ArrayLiteral && isConstantArray(node)) {
		return node.elements.map((element) => (element as Literal).value);
	}
	return undefined;
}

/**
 * Check if evaluating a node can neither fail nor have any effect, which makes it
 * safe to remove: a constant, or a variable certain to be assigned already. Calling
 * a function or applying an operator is excluded, as each of those may throw.
 */
function isInert(node: ASTNode, isAssigned: (name: string) => boolean): boolean {
	if (isLiteral(node)) return true;
	if (node.kind === NodeKind.Identifier) return isAssigned(node.name);
	return node.kind === NodeKind.ArrayLiteral && isConstantArray(node);
}

/**
 * Carry comments over to the node that replaces `original`, around any of its own.
 */
function preserveComments<T extends ASTNode>(original: ASTNode, replacement: T): T {
	const { leadingComments, trailingComments } = original;
	if (!leadingComments && !trailingComments) return replacement;
	return {
		...replacement,
		...(leadingComments
			? { leadingComments: [...leadingComments, ...(replacement.leadingComments ?? [])] }
			: {}),
		...(trailingComments
			? { trailingComments: [...(replacement.trailingComments ?? []), ...trailingComments] }
			: {}),
	};
}

/**
 * Build the literal that replaces `node`, if the language can spell `value`.
 * There is no literal for non-finite numbers, so those stay as expressions.
 */
function toLiteral(value: Literal['value'], node: ASTNode): ASTNode | undefined {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return undefined;
		return preserveComments(node, ast.number(value, node.start, node.end));
	}
	if (typeof value === 'string') {
		if (value.length > MAX_FOLDED_STRING_LENGTH) return undefined;
		return preserveComments(node, ast.string(value, node.start, node.end));
	}
	return preserveComments(node, ast.boolean(value, node.start, node.end));
}

/**
 * Evaluate an operation on constants, returning undefined if it fails. A failure
 * has to stay in the program: it may be in code that never runs.
 */
function attempt<T>(operation: () => T): T | undefined {
	try {
		return operation();
	} catch {
		return undefined;
	}
}

/**
 * Fold a node whose children are already folded.
 */
function foldOperation(node: ASTNode): ASTNode {
	switch (node.kind) {
		case NodeKind.BinaryOp: {
			const { left, operator, right } = node;
			if (!isLiteral(left) || !isLiteral(right)) return node;
			// `&&` and `||` were folded on the way down
			const eager = operator as Exclude<Operator, '&&' | '||'>;
			// An operation on literals gives a number, string or boolean
			const result = attempt(
				() => evaluateBinaryOperation(eager, left.value, right.value) as Literal['value'],
			);
			return (result !== undefined && toLiteral(result, node)) || node;
		}

		case NodeKind.UnaryOp: {
			const { argument, operator } = node;
			if (operator === '-' && isNumberLiteral(argument)) {
				return toLiteral(-argument.value, node) ?? node;
			}
			if (operator === '!' && isBooleanLiteral(argument)) {
				return toLiteral(!argument.value, node) ?? node;
			}
			return node;
		}

		case NodeKind.IndexAccess: {
			const { index, object } = node;
			if (!isNumberLiteral(index)) return node;
			const items = constantItems(object);
			if (!items) return node;
			const item = attempt(() => resolveIndex(items, index.value) as Literal['value']);
			return (item !== undefined && toLiteral(item, node)) || node;
		}

		case NodeKind.RangeExpression: {
			const { from, inclusive, to } = node;
			if (!isNumberLiteral(from) || !isNumberLiteral(to)) return node;
			if (to.value - from.value + (inclusive ? 1 : 0) > MAX_FOLDED_RANGE_LENGTH) return node;
			const values = attempt(() => buildRange(from.value, to.value, inclusive));
			if (!values) return node;
			const elements = values.map((value) => ast.number(value, node.start, node.end));
			return preserveComments(node, ast.array(elements, node.start, node.end));
		}

		default:
			return node;
	}
}

/**
 * Create a function that folds constants in a tree, replacing variables found in
 * `constants` with their values.
 */
function createFolder(constants: ReadonlyMap<string, Literal>): (node: ASTNode) => ASTNode {
	const fold = (node: ASTNode): ASTNode => {
		switch (node.kind) {
			case NodeKind.NumberLiteral:
			case NodeKind.StringLiteral:
			case NodeKind.BooleanLiteral:
			case NodeKind.Placeholder:
				return node;

			case NodeKind.Identifier: {
				const constant = constants.get(node.name);
				return constant === undefined ? node : (toLiteral(constant.value, node) ?? node);
			}

			case NodeKind.BinaryOp: {
				const { operator } = node;
				if (operator === '&&' || operator === '||') {
					const left = fold(node.left);
					// The right side of a short circuit never runs
					if (isBooleanLiteral(left) && left.value === (operator === '||')) {
						return preserveComments(node, ast.boolean(left.value, node.start, node.end));
					}
					const right = fold(node.right);
					if (isBooleanLiteral(left) && isBooleanLiteral(right)) {
						return preserveComments(node, ast.boolean(right.value, node.start, node.end));
					}
					return left === node.left && right === node.right ? node : { ...node, left, right };
				}
				return foldOperation(mapChildren(node, fold));
			}

			case NodeKind.IfExpression: {
				const condition = fold(node.condition);
				if (isBooleanLiteral(condition)) {
					const branch = condition.value ? node.consequent : node.alternate;
					// A placeholder only counts directly inside a pipe, and this `if` is in the way
					if (branch.kind !== NodeKind.Placeholder) {
						return preserveComments(node, fold(branch));
					}
				}
				const consequent = fold(node.consequent);
				const alternate = fold(node.alternate);
				return condition === node.condition &&
					consequent === node.consequent &&
					alternate === node.alternate
					? node
					: { ...node, condition, consequent, alternate };
			}

			case NodeKind.IndexAccess: {
				const folded = foldOperation(mapChildren(node, fold));
				// A variable splits its string once, where a literal would on every access
				const keepsVariable =
					folded.kind === NodeKind.IndexAccess &&
					node.object.kind === NodeKind.Identifier &&
					isStringLiteral(folded.object);
				return keepsVariable ? { ...folded, object: node.object } : folded;
			}

			default:
				return foldOperation(mapChildren(node, fold));
		}
	};
	return fold;
}

/**
 * Find the variables whose top-level assignment is the only write to them
 * anywhere in the program, which makes that assignment's value their value.
 */
function findPropagatable(program: Program, externalVariables: ReadonlySet<string>): Set<string> {
	const writes = new Map<string, number>();
	const countWrite = (name: string): void => {
		writes.set(name, (writes.get(name) ?? 0) + 1);
	};
	const visit = (node: ASTNode): void => {
		if (node.kind === NodeKind.Identifier || isLiteral(node)) return;
		if (node.kind === NodeKind.Assignment) {
			countWrite(node.name);
		} else if (node.kind === NodeKind.ForExpression) {
			// Loop bindings count as writes, ruling out anything they shadow
			countWrite(node.variable);
			if (node.accumulator) countWrite(node.accumulator.name);
		}
		forEachChild(node, visit);
	};
	visit(program);

	const propagatable = new Set<string>();
	for (const statement of program.statements) {
		if (
			statement.kind === NodeKind.Assignment &&
			writes.get(statement.name) === 1 &&
			!externalVariables.has(statement.name)
		) {
			propagatable.add(statement.name);
		}
	}
	return propagatable;
}

function isPropagatable(node: ASTNode): node is Literal {
	if (isStringLiteral(node)) return node.value.length <= MAX_PROPAGATED_STRING_LENGTH;
	return isLiteral(node);
}

/**
 * Fold statements in order. Each constant assignment becomes visible to the
 * statements after it, so references that run before it stay untouched.
 */
function foldStatements(
	program: Program,
	externalVariables: ReadonlySet<string> | undefined,
): ASTNode[] {
	const propagatable = externalVariables && findPropagatable(program, externalVariables);
	const constants = new Map<string, Literal>();
	const fold = createFolder(constants);

	return program.statements.map((statement) => {
		const folded = fold(statement);
		if (
			folded.kind === NodeKind.Assignment &&
			propagatable?.has(folded.name) &&
			isPropagatable(folded.value)
		) {
			constants.set(folded.name, folded.value);
		}
		return folded;
	});
}

/**
 * Remove statements that cannot affect the program's result. Walks backwards,
 * tracking which variables are read by the statements that remain.
 */
function eliminateDeadCode(statements: readonly ASTNode[], preserveScope: boolean): ASTNode[] {
	const firstAssigned = new Map<string, number>();
	statements.forEach((statement, i) => {
		if (statement.kind === NodeKind.Assignment && !firstAssigned.has(statement.name)) {
			firstAssigned.set(statement.name, i);
		}
	});

	const live = new Set<string>();
	const kept: ASTNode[] = [];

	for (let i = statements.length - 1; i >= 0; i--) {
		const statement = statements[i] as ASTNode;
		const isResult = i === statements.length - 1;
		const isAssigned = (name: string): boolean => (firstAssigned.get(name) ?? i) < i;

		if (statement.kind === NodeKind.Assignment) {
			const isDead = !preserveScope && !live.has(statement.name);
			if (!isResult && isDead && isInert(statement.value, isAssigned)) continue;
			// Whatever this assignment overwrites is dead unless read further up
			live.delete(statement.name);
		} else if (!isResult && isInert(statement, isAssigned)) {
			continue;
		}

		collectFreeIdentifiers(statement, live);
		kept.push(statement);
	}

	return kept.reverse();
}

/**
 * Optimize an AST using constant folding, constant propagation, and dead code
 * elimination.
 *
 * The result evaluates exactly like the original: to the same value or the same
 * failure, with the same function calls. Only the variables `evaluateScope`
 * reports may differ, and hold earlier values, unless `preserveScope` is set.
 */
export function optimize(node: ASTNode, options: OptimizeOptions = {}): ASTNode {
	// A host function may call this mid-evaluation, but the result must not depend
	// on what that evaluation has left
	const outerBudget = setBudget(Number.POSITIVE_INFINITY);
	try {
		return node.kind === NodeKind.Program
			? optimizeProgram(node, options)
			: createFolder(new Map())(node);
	} finally {
		setBudget(outerBudget);
	}
}

function optimizeProgram(program: Program, options: OptimizeOptions): ASTNode {
	if (program.statements.length === 0) return program;

	const folded = foldStatements(program, options.externalVariables);
	const statements = eliminateDeadCode(folded, options.preserveScope ?? false);

	// Unwrap single-statement Programs, consistent with how parse() works
	return statements.length > 1
		? { ...program, statements }
		: preserveComments(program, statements[0] as ASTNode);
}
