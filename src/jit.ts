import { type ASTNode, NodeKind } from './ast'
import { optimize } from './optimizer'
import { parse } from './parser'
import type { ExecutionContext, RuntimeValue } from './types'
import { collectAllIdentifiers } from './utils'
import { visit } from './visitor'

/**
 * Compiled expression that can be executed multiple times
 * Provides faster repeated execution compared to tree-walk interpreter
 */
export interface CompiledExpression {
	/**
	 * Execute the compiled expression with optional context
	 * @param context - Execution context with variables and functions
	 * @returns The evaluated result
	 */
	execute: (context?: ExecutionContext) => RuntimeValue

	/**
	 * Generated JavaScript source code (for debugging and inspection)
	 */
	source: string
}

/**
 * Compile source code or AST to a JavaScript function for faster repeated execution
 *
 * JIT compilation trades compilation time for execution speed:
 * - First call: Parse + Optimize + Compile (~10-50µs depending on size)
 * - Subsequent calls: Direct JavaScript execution (~1-5µs, 5-10x faster)
 *
 * The compiler automatically optimizes the AST before code generation:
 * - Constant folding: `2 + 3` → `5` (safe constants only)
 * - Dead code elimination: removes unused variable assignments
 * - Expression simplification: `1 ? x : y` → `x`
 *
 * Optimization is safe because:
 * - Constant folding errors (e.g., division by zero) propagate to compile-time
 * - Variables that could be external are preserved (no unsafe DCE)
 * - The optimizer respects ExecutionContext override semantics
 *
 * The compiler generates optimized JavaScript code:
 * - Uses comma operator instead of IIFEs for better performance
 * - Only initializes variables that are actually used
 * - Pre-declares temporary variables for reuse
 *
 * Best for expressions that are evaluated many times with different contexts.
 *
 * Security: Uses `new Function()` to generate executable code. Safe for trusted
 * input only. For untrusted input, use the tree-walk interpreter instead.
 *
 * @param input - Either a source code string or an AST node
 * @returns Compiled expression that can be executed multiple times
 * @throws {Error} If compilation fails or AST contains invalid operations (e.g., constant division by zero)
 *
 * @example
 * ```typescript
 * const expr = compile('x * 2 + y')
 * expr.execute({ variables: { x: 10, y: 5 } }) // 25
 * expr.execute({ variables: { x: 20, y: 3 } }) // 43
 * ```
 *
 * @example Automatic optimization
 * ```typescript
 * const expr = compile('2 + 3 * 4')  // Automatically optimized to 14
 * expr.execute() // Fast execution of pre-folded constant
 * ```
 */
export function compile(input: string | ASTNode): CompiledExpression {
	// Parse if needed (lexer/parser handle validation)
	const parsedAst = typeof input === 'string' ? parse(input) : input

	// Optimize AST before code generation for smaller, faster code
	// This may throw if there are constant errors (e.g., division by zero in constants)
	const ast = optimize(parsedAst)

	const jsCode = generateJavaScript(ast)

	// Inject helper functions at the top of generated code
	const fullCode = `${HELPER_FUNCTIONS}\n\n${jsCode}`

	// Create function with context parameter
	// Using new Function is safe here because we control the code generation
	const fn = new Function('__context', fullCode) as (
		context: ExecutionContext,
	) => RuntimeValue

	return {
		execute: (context: ExecutionContext = {}) => {
			return fn(context)
		},
		source: fullCode,
	}
}

/**
 * Helper functions injected into generated code
 * These avoid repetitive code generation and enable better JIT optimization
 */
const HELPER_FUNCTIONS = `
// Helper function for throwing errors (avoids string concatenation overhead)
function __throw(msg) { throw new Error(msg); }

// Temporary variables for optimized operations
let __r;      // For division/modulo right operand
let __fn;     // For function lookup
let __val;    // For assignment value
`.trim()

/**
 * Generate JavaScript code from an AST node
 * Uses the visitor pattern to transform each node type
 * Optimizes variable initialization to only process used variables
 *
 * @param node - The AST node to compile
 * @returns JavaScript code as a string
 */
function generateJavaScript(node: ASTNode): string {
	const lines: string[] = []

	// Collect variable metadata
	const assignedVars = collectAssignedVariables(node)
	const referencedVars = collectAllIdentifiers(node)
	const literalAssignments = collectLiteralAssignments(node)

	// Generate initialization code (optimized)
	lines.push('// Context accessors')
	lines.push('const __ext = __context.variables || {};')
	lines.push('const __fns = __context.functions || {};')
	lines.push('const __extKeys = new Set(Object.keys(__ext));') // Track which variables are external
	lines.push('')

	// Only initialize variables that are actually used
	// This avoids unnecessary property lookups for unused variables
	const allVars = new Set([
		...Array.from(assignedVars),
		...Array.from(referencedVars),
	])
	if (allVars.size > 0) {
		lines.push('// Variable declarations')
		for (const name of Array.from(allVars)) {
			// Optimize literal assignments: let foo = __ext.foo ?? 1
			// This is faster than runtime conditionals and cleaner code
			const literalValue = literalAssignments.get(name)
			if (literalValue !== undefined) {
				lines.push(`let ${name} = __ext.${name} ?? ${literalValue};`)
			} else {
				// Non-literal or no assignment: initialize from external context
				lines.push(`let ${name} = __ext.${name};`)
			}
		}
		lines.push('')
	}

	// Generate main execution code
	lines.push('// Execute program')
	const code = compileNode(node, literalAssignments)
	lines.push(`return ${code};`)

	return lines.join('\n')
}

/**
 * Collect all variables that are assigned in the AST
 * These are variables that appear on the LHS of assignments
 *
 * Unlike collectAllIdentifiers() which collects all identifier references,
 * this function only collects assignment targets (LHS of =).
 *
 * @param node - AST node to traverse
 * @returns Set of assigned variable names
 */
function collectAssignedVariables(node: ASTNode): Set<string> {
	const names = new Set<string>()

	visit<void>(node, {
		Program: (n, recurse) => {
			for (const stmt of n[1]) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		Identifier: () => {},
		BinaryOp: (n, recurse) => {
			recurse(n[1])
			recurse(n[3])
		},
		UnaryOp: (n, recurse) => {
			recurse(n[2])
		},
		FunctionCall: (n, recurse) => {
			for (const arg of n[2]) {
				recurse(arg)
			}
		},
		Assignment: (n, recurse) => {
			// Collect LHS (variable being assigned)
			names.add(n[1])
			// Also recurse into RHS to find nested assignments
			recurse(n[2])
		},
		ConditionalExpression: (n, recurse) => {
			recurse(n[1])
			recurse(n[2])
			recurse(n[3])
		},
	})

	return names
}

/**
 * Collect all literal assignments (e.g., x = 5, y = 3.14)
 * These can be optimized by initializing directly: let x = __ext.x ?? 5
 *
 * Only returns the FIRST literal assignment for each variable.
 * Variables with multiple assignments or non-literal assignments are excluded.
 *
 * @param node - AST node to traverse
 * @returns Map of variable name to literal value (as string for code generation)
 */
function collectLiteralAssignments(node: ASTNode): Map<string, string> {
	const literals = new Map<string, string>()
	const nonLiterals = new Set<string>()

	visit<void>(node, {
		Program: (n, recurse) => {
			for (const stmt of n[1]) {
				recurse(stmt)
			}
		},
		NumberLiteral: () => {},
		Identifier: () => {},
		BinaryOp: (n, recurse) => {
			recurse(n[1])
			recurse(n[3])
		},
		UnaryOp: (n, recurse) => {
			recurse(n[2])
		},
		FunctionCall: (n, recurse) => {
			for (const arg of n[2]) {
				recurse(arg)
			}
		},
		Assignment: (n, recurse) => {
			const name = n[1]
			const value = n[2]

			// Check if already seen (multiple assignments) or marked as non-literal
			if (literals.has(name) || nonLiterals.has(name)) {
				// Multiple assignments: not safe to optimize
				literals.delete(name)
				nonLiterals.add(name)
				return
			}

			// Check if value is a NumberLiteral
			if (value[0] === NodeKind.NumberLiteral) {
				const num = value[1]
				// Handle special numeric values
				if (Number.isNaN(num)) {
					literals.set(name, 'NaN')
				} else if (!Number.isFinite(num)) {
					literals.set(name, num > 0 ? 'Infinity' : '-Infinity')
				} else {
					literals.set(name, String(num))
				}
			} else {
				// Non-literal assignment: mark as non-optimizable
				nonLiterals.add(name)
				// Still recurse to find nested assignments
				recurse(value)
			}
		},
		ConditionalExpression: (n, recurse) => {
			recurse(n[1])
			recurse(n[2])
			recurse(n[3])
		},
	})

	return literals
}

/**
 * Compile a single AST node to JavaScript code
 * Returns a JavaScript expression as a string
 * Uses comma operator instead of IIFEs for better performance
 *
 * @param node - The AST node to compile
 * @param literalAssignments - Map of variables already initialized with literals (can skip assignment)
 * @returns JavaScript code representing the node
 */
function compileNode(
	node: ASTNode,
	literalAssignments: Map<string, string> = new Map(),
): string {
	// Helper: generate identifier access code
	// Variables with literal assignments are always defined (initialized with ?? operator)
	const compileIdentifier = (name: string): string => {
		if (literalAssignments.has(name)) {
			// Variable has literal default, always defined (let x = __ext.x ?? 5)
			return name
		}
		// Variable might be undefined, need runtime check
		return `(${name} !== undefined ? ${name} : __throw('Undefined variable: ${name}'))`
	}
	return visit<string>(node, {
		// Program: execute statements sequentially, return last result
		// Tuple: [kind, statements]
		Program: (n, recurse) => {
			const statements = n[1]
			if (statements.length === 0) {
				return '0'
			}
			if (statements.length === 1) {
				const stmt = statements[0]
				return stmt ? recurse(stmt) : '0'
			}

			// Multiple statements: use comma operator for best performance
			// (expr1, expr2, expr3) evaluates all and returns last
			const stmts = statements.map(recurse)
			return `(${stmts.join(', ')})`
		},

		// Number literal: direct value
		// Tuple: [kind, value]
		NumberLiteral: (n) => {
			const value = n[1]
			// Handle special numeric values
			if (Number.isNaN(value)) return 'NaN'
			if (!Number.isFinite(value)) {
				return value > 0 ? 'Infinity' : '-Infinity'
			}
			return String(value)
		},

		// Identifier: variable reference
		// Tuple: [kind, name]
		Identifier: (n) => {
			const name = n[1]
			return compileIdentifier(name)
		},

		// Binary operation
		// Tuple: [kind, left, operator, right]
		BinaryOp: (n, recurse) => {
			const left = recurse(n[1])
			const operator = n[2]
			const right = recurse(n[3])

			// Handle special operators that need translation
			switch (operator) {
				case '^':
					// Exponentiation: ^ -> **
					return `(${left} ** ${right})`
				case '==':
					// Equality: return 1 or 0 (not boolean)
					return `(${left} === ${right} ? 1 : 0)`
				case '!=':
					// Inequality: return 1 or 0
					return `(${left} !== ${right} ? 1 : 0)`
				case '<':
					return `(${left} < ${right} ? 1 : 0)`
				case '>':
					return `(${left} > ${right} ? 1 : 0)`
				case '<=':
					return `(${left} <= ${right} ? 1 : 0)`
				case '>=':
					return `(${left} >= ${right} ? 1 : 0)`
				case '&&':
					// Logical AND: both must be non-zero
					return `(${left} !== 0 && ${right} !== 0 ? 1 : 0)`
				case '||':
					// Logical OR: at least one must be non-zero
					return `(${left} !== 0 || ${right} !== 0 ? 1 : 0)`
				case '/':
					// Division by zero check using short-circuit OR
					// More compact than comma operator: (__r = right) === 0 || left / __r throws if zero
					return `((__r = ${right}) === 0 && __throw('Division by zero'), ${left} / __r)`
				case '%':
					// Modulo by zero check using short-circuit AND
					return `((__r = ${right}) === 0 && __throw('Modulo by zero'), ${left} % __r)`
				default:
					// Direct operators: +, -, *
					return `(${left} ${operator} ${right})`
			}
		},

		// Unary operation
		// Tuple: [kind, operator, argument]
		UnaryOp: (n, recurse) => {
			const operator = n[1]
			const arg = recurse(n[2])

			if (operator === '-') {
				// Negation
				return `(-${arg})`
			}
			if (operator === '!') {
				// Logical NOT: 0 -> 1, non-zero -> 0
				return `(${arg} === 0 ? 1 : 0)`
			}

			throw new Error(`Unknown unary operator: ${operator}`)
		},

		// Function call
		// Tuple: [kind, name, arguments]
		FunctionCall: (n, recurse) => {
			const name = n[1]
			const args = n[2].map(recurse)

			// Generate runtime function lookup and call
			// Use short-circuit evaluation for cleaner, faster code
			const argsStr = args.length > 0 ? args.join(', ') : ''
			return `((__fn = __fns.${name}) === undefined ? __throw('Undefined function: ${name}') : typeof __fn !== 'function' ? __throw('${name} is not a function') : __fn(${argsStr}))`
		},

		// Assignment
		// Tuple: [kind, name, value]
		Assignment: (n, recurse) => {
			const name = n[1]

			// OPTIMIZATION: If this is a literal assignment, it's already initialized
			// with "let x = __ext.x ?? 5" so we just return the variable
			if (literalAssignments.has(name)) {
				// Variable is already initialized with the literal value
				// Just return the variable (it already has the correct value)
				return name
			}

			// Non-literal assignment: must evaluate RHS for side effects
			const value = recurse(n[2])

			// CRITICAL: External variables take precedence, but we must still evaluate RHS
			// for side effects (e.g., function calls with NOW())
			//
			// Strategy:
			// 1. Evaluate RHS into temp variable
			// 2. If variable is external (from context), return it (ignore evaluated RHS)
			// 3. Otherwise, assign evaluated RHS and return it
			//
			// Using comma operator: (__val = RHS, __extKeys.has('name') ? name : (name = __val))
			return `((__val = ${value}), (__extKeys.has('${name}') ? ${name} : (${name} = __val)))`
		},

		// Conditional expression (ternary)
		// Tuple: [kind, condition, consequent, alternate]
		ConditionalExpression: (n, recurse) => {
			const condition = recurse(n[1])
			const consequent = recurse(n[2])
			const alternate = recurse(n[3])

			// Condition is truthy if !== 0
			return `(${condition} !== 0 ? ${consequent} : ${alternate})`
		},
	})
}
