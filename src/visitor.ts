import type {
	ASTNode,
	Assignment,
	BinaryOp,
	ConditionalExpression,
	FunctionCall,
	Identifier,
	NumberLiteral,
	Program,
	UnaryOp,
} from './types'

/**
 * Type-safe visitor pattern for AST traversal.
 *
 * A visitor is an object with handler functions for each AST node type.
 * Each handler receives:
 * - The node (correctly typed based on node.type)
 * - A recurse function to visit child nodes with the same visitor
 *
 * The visitor pattern centralizes AST traversal logic and ensures
 * exhaustive handling of all node types at compile time.
 *
 * Time complexity: O(n) where n is the number of nodes in the AST
 * Space complexity: O(d) where d is the maximum depth (recursion stack)
 *
 * @template T The return type of visitor handlers
 *
 * @example
 * // Count all nodes in an AST
 * const nodeCount = visit(ast, {
 *   Program: (n, recurse) => 1 + n.statements.reduce((sum, stmt) => sum + recurse(stmt), 0),
 *   NumberLiteral: () => 1,
 *   Identifier: () => 1,
 *   BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
 *   UnaryOp: (n, recurse) => 1 + recurse(n.argument),
 *   FunctionCall: (n, recurse) => 1 + n.arguments.reduce((sum, arg) => sum + recurse(arg), 0),
 *   Assignment: (n, recurse) => 1 + recurse(n.value),
 *   ConditionalExpression: (n, recurse) => 1 + recurse(n.condition) + recurse(n.consequent) + recurse(n.alternate),
 * })
 *
 * @example
 * // Transform AST: constant folding
 * const optimized = visit(ast, {
 *   NumberLiteral: (n) => n,
 *   Identifier: (n) => n,
 *   BinaryOp: (n, recurse) => {
 *     const left = recurse(n.left)
 *     const right = recurse(n.right)
 *     if (isNumberLiteral(left) && isNumberLiteral(right)) {
 *       return ast.number(left.value + right.value)
 *     }
 *     return ast.binaryOp(left, n.operator, right)
 *   },
 *   // ... other handlers
 * })
 */
export type Visitor<T> = {
	/**
	 * Handle a Program node (multiple statements)
	 */
	Program: (node: Program, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle a NumberLiteral node
	 */
	NumberLiteral: (node: NumberLiteral, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle an Identifier node (variable reference)
	 */
	Identifier: (node: Identifier, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle a BinaryOp node (binary operation)
	 */
	BinaryOp: (node: BinaryOp, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle a UnaryOp node (unary operation)
	 */
	UnaryOp: (node: UnaryOp, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle a FunctionCall node
	 */
	FunctionCall: (node: FunctionCall, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle an Assignment node (variable assignment)
	 */
	Assignment: (node: Assignment, recurse: (n: ASTNode) => T) => T

	/**
	 * Handle a ConditionalExpression node (ternary operator)
	 */
	ConditionalExpression: (
		node: ConditionalExpression,
		recurse: (n: ASTNode) => T,
	) => T
}

/**
 * Visit an AST node using a visitor object with type-specific handlers.
 *
 * This function implements the visitor pattern for AST traversal.
 * All node types must have handlers (exhaustive by design).
 * TypeScript enforces exhaustiveness at compile time via the switch statement.
 *
 * The visitor pattern provides several benefits:
 * - DRY: Centralizes traversal logic across all modules
 * - Type safety: Handlers receive correctly-typed nodes
 * - Exhaustiveness: Compile-time guarantee that all node types are handled
 * - Flexibility: Supports transform, fold, and walk patterns
 *
 * @template T The return type of visitor handlers
 * @param node The AST node to visit
 * @param visitor Object with handlers for each node type
 * @returns The result of visiting the node
 *
 * @example
 * // Evaluate an AST (fold pattern)
 * const result = visit(ast, {
 *   Program: (n, recurse) => {
 *     let result = 0
 *     for (const stmt of n.statements) {
 *       result = recurse(stmt)
 *     }
 *     return result
 *   },
 *   NumberLiteral: (n) => n.value,
 *   BinaryOp: (n, recurse) => {
 *     const left = recurse(n.left)
 *     const right = recurse(n.right)
 *     return left + right // simplified
 *   },
 *   // ... other handlers
 * })
 *
 * @example
 * // Transform an AST (transform pattern)
 * const transformed = visit(ast, {
 *   NumberLiteral: (n) => ast.number(n.value * 2), // Double all numbers
 *   BinaryOp: (n, recurse) => ast.binaryOp(
 *     recurse(n.left),
 *     n.operator,
 *     recurse(n.right)
 *   ),
 *   // ... other handlers
 * })
 *
 * @example
 * // Walk an AST (walk pattern - side effects)
 * visit(ast, {
 *   NumberLiteral: (n) => { console.log('Number:', n.value) },
 *   Identifier: (n) => { console.log('Variable:', n.name) },
 *   // ... other handlers
 * })
 */
export function visit<T>(node: ASTNode, visitor: Visitor<T>): T {
	// visit() is just visitPartial() with a default handler that throws
	// This eliminates code duplication while maintaining exhaustiveness checking
	return visitPartial(node, visitor, (node) => {
		// This should never be reached because Visitor<T> requires all handlers
		// But we throw just in case
		throw new Error(`No handler for node type: ${node.type}`)
	})
}

/**
 * Visit an AST node using a partial visitor with a default handler.
 *
 * Unlike `visit()` which requires exhaustive handlers, `visitPartial()` allows
 * you to handle only specific node types. Unhandled nodes are processed by
 * the default handler.
 *
 * This is useful for:
 * - Analysis passes that only care about certain node types
 * - Transformations that only modify specific nodes
 * - Walking the tree to collect information
 *
 * @template T The return type of visitor handlers
 * @param node The AST node to visit
 * @param visitor Object with optional handlers for node types
 * @param defaultHandler Handler for unhandled node types
 * @returns The result of visiting the node
 *
 * @example
 * // Collect all variable names (only care about Identifier nodes)
 * const variables: string[] = []
 * visitPartial(
 *   ast,
 *   {
 *     Identifier: (n) => {
 *       variables.push(n.name)
 *       return undefined
 *     }
 *   },
 *   (node, recurse) => {
 *     // Default: recurse into children for all other node types
 *     if (node.type === 'BinaryOp') {
 *       recurse(node.left)
 *       recurse(node.right)
 *     }
 *     // ... handle other node types' children
 *     return undefined
 *   }
 * )
 *
 * @example
 * // Transform only BinaryOp nodes, keep everything else as-is
 * const transformed = visitPartial(
 *   ast,
 *   {
 *     BinaryOp: (n, recurse) => ast.binaryOp(
 *       recurse(n.left),
 *       '+', // Force all operators to addition
 *       recurse(n.right)
 *     )
 *   },
 *   (node, recurse) => node // Default: identity (no transformation)
 * )
 */
export function visitPartial<T>(
	node: ASTNode,
	visitor: Partial<Visitor<T>>,
	defaultHandler: (node: ASTNode, recurse: (n: ASTNode) => T) => T,
): T {
	const recurse = (n: ASTNode): T => visitPartial(n, visitor, defaultHandler)

	// Use switch for type-safe dispatch - TypeScript narrows node type in each case
	switch (node.type) {
		case 'Program':
			return visitor.Program
				? visitor.Program(node, recurse)
				: defaultHandler(node, recurse)
		case 'NumberLiteral':
			return visitor.NumberLiteral
				? visitor.NumberLiteral(node, recurse)
				: defaultHandler(node, recurse)
		case 'Identifier':
			return visitor.Identifier
				? visitor.Identifier(node, recurse)
				: defaultHandler(node, recurse)
		case 'BinaryOp':
			return visitor.BinaryOp
				? visitor.BinaryOp(node, recurse)
				: defaultHandler(node, recurse)
		case 'UnaryOp':
			return visitor.UnaryOp
				? visitor.UnaryOp(node, recurse)
				: defaultHandler(node, recurse)
		case 'FunctionCall':
			return visitor.FunctionCall
				? visitor.FunctionCall(node, recurse)
				: defaultHandler(node, recurse)
		case 'Assignment':
			return visitor.Assignment
				? visitor.Assignment(node, recurse)
				: defaultHandler(node, recurse)
		case 'ConditionalExpression':
			return visitor.ConditionalExpression
				? visitor.ConditionalExpression(node, recurse)
				: defaultHandler(node, recurse)
	}
}
