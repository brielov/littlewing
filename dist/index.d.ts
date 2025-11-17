/**
* Runtime value type - only numbers
*/
type RuntimeValue = number;
/**
* Binary operator types
*/
type Operator = "+" | "-" | "*" | "/" | "%" | "^" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "&&" | "||";
/**
* Execution context providing global functions and variables
* Functions must accept zero or more number arguments and return a number
* Variables must be numbers
*/
interface ExecutionContext {
	functions?: Record<string, (...args: RuntimeValue[]) => RuntimeValue>;
	variables?: Record<string, RuntimeValue>;
}
/**
* Token types for lexer output
*/
declare enum TokenType {
	NUMBER = "NUMBER",
	IDENTIFIER = "IDENTIFIER",
	PLUS = "PLUS",
	MINUS = "MINUS",
	STAR = "STAR",
	SLASH = "SLASH",
	PERCENT = "PERCENT",
	CARET = "CARET",
	EXCLAMATION = "EXCLAMATION",
	DOUBLE_EQUALS = "DOUBLE_EQUALS",
	NOT_EQUALS = "NOT_EQUALS",
	LESS_THAN = "LESS_THAN",
	GREATER_THAN = "GREATER_THAN",
	LESS_EQUAL = "LESS_EQUAL",
	GREATER_EQUAL = "GREATER_EQUAL",
	LOGICAL_AND = "LOGICAL_AND",
	LOGICAL_OR = "LOGICAL_OR",
	LPAREN = "LPAREN",
	RPAREN = "RPAREN",
	EQUALS = "EQUALS",
	COMMA = "COMMA",
	QUESTION = "QUESTION",
	COLON = "COLON",
	EOF = "EOF"
}
/**
* Token produced by lexer
*/
interface Token {
	type: TokenType;
	value: string | number;
	position: number;
}
/**
* AST Node - base type
*/
type ASTNode = Program | NumberLiteral | Identifier | BinaryOp | UnaryOp | FunctionCall | Assignment | ConditionalExpression;
/**
* Program node (multiple statements)
*/
interface Program {
	type: "Program";
	statements: ASTNode[];
}
/**
* Number literal (123, 45.67)
*/
interface NumberLiteral {
	type: "NumberLiteral";
	value: number;
}
/**
* Identifier (variable or function name)
*/
interface Identifier {
	type: "Identifier";
	name: string;
}
/**
* Binary operation (a + b, x * y, etc.)
*/
interface BinaryOp {
	type: "BinaryOp";
	left: ASTNode;
	operator: Operator;
	right: ASTNode;
}
/**
* Unary operation (-x, !x, etc.)
*/
interface UnaryOp {
	type: "UnaryOp";
	operator: "-" | "!";
	argument: ASTNode;
}
/**
* Function call (now(), abs(-5), etc.)
*/
interface FunctionCall {
	type: "FunctionCall";
	name: string;
	arguments: ASTNode[];
}
/**
* Variable assignment (x = 5)
*/
interface Assignment {
	type: "Assignment";
	name: string;
	value: ASTNode;
}
/**
* Conditional expression (ternary operator: condition ? consequent : alternate)
* Returns consequent if condition !== 0, otherwise returns alternate
*/
interface ConditionalExpression {
	type: "ConditionalExpression";
	condition: ASTNode;
	consequent: ASTNode;
	alternate: ASTNode;
}
/**
* Type guard functions for discriminated union narrowing
*/
declare function isNumberLiteral(node: ASTNode): node is NumberLiteral;
declare function isIdentifier(node: ASTNode): node is Identifier;
declare function isBinaryOp(node: ASTNode): node is BinaryOp;
declare function isUnaryOp(node: ASTNode): node is UnaryOp;
declare function isFunctionCall(node: ASTNode): node is FunctionCall;
declare function isAssignment(node: ASTNode): node is Assignment;
declare function isProgram(node: ASTNode): node is Program;
declare function isConditionalExpression(node: ASTNode): node is ConditionalExpression;
/**
* Extracts input variables from an AST.
*
* Input variables are those whose values can be determined without knowing
* the values of other variables in the script. This includes:
* - Literals (10, -5, 3.14)
* - Unary minus of literals (-10)
* - Constant expressions (2 + 3, -5 * 2)
* - Function calls with constant arguments (MAX(10, 20), NOW())
*
* Computed variables (those that reference other variables) are excluded.
*
* @param ast - The AST to analyze (can be a single statement or Program node)
* @returns Array of input variable names
*
* @example
* ```typescript
* const ast = parse('price = 100; tax = price * 0.08')
* extractInputVariables(ast) // ['price']
* ```
*/
declare function extractInputVariables(ast: ASTNode): string[];
declare namespace exports_ast {
	export { unaryOp, subtract, program, number, notEquals, negate, multiply, modulo, logicalOr, logicalNot, logicalAnd, lessThan, lessEqual, identifier, greaterThan, greaterEqual, functionCall, exponentiate, equals, divide, conditional, binaryOp, assign, add };
}
/**
* Builder functions for creating AST nodes manually
*/
/**
* Create a program node
*/
declare function program(statements: ASTNode[]): Program;
/**
* Create a number literal node
*/
declare function number(value: number): NumberLiteral;
/**
* Create an identifier node
*/
declare function identifier(name: string): Identifier;
/**
* Create a binary operation node
*/
declare function binaryOp(left: ASTNode, operator: Operator, right: ASTNode): BinaryOp;
/**
* Create a unary operation node (unary minus or logical NOT)
*/
declare function unaryOp(operator: "-" | "!", argument: ASTNode): UnaryOp;
/**
* Create a function call node
*/
declare function functionCall(name: string, args?: ASTNode[]): FunctionCall;
/**
* Create a variable assignment node
*/
declare function assign(name: string, value: ASTNode): Assignment;
/**
* Create a conditional expression node (ternary operator)
*/
declare function conditional(condition: ASTNode, consequent: ASTNode, alternate: ASTNode): ConditionalExpression;
/**
* Convenience functions for common operations
*/
/**
* Create an addition operation
*/
declare function add(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a subtraction operation
*/
declare function subtract(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a multiplication operation
*/
declare function multiply(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a division operation
*/
declare function divide(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a modulo operation
*/
declare function modulo(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create an exponentiation operation
*/
declare function exponentiate(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a negation operation
*/
declare function negate(argument: ASTNode): UnaryOp;
/**
* Create a logical NOT operation
*/
declare function logicalNot(argument: ASTNode): UnaryOp;
/**
* Comparison operator convenience functions
*/
/**
* Create an equality comparison (==)
*/
declare function equals(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a not-equals comparison (!=)
*/
declare function notEquals(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a less-than comparison (<)
*/
declare function lessThan(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a greater-than comparison (>)
*/
declare function greaterThan(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a less-than-or-equal comparison (<=)
*/
declare function lessEqual(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a greater-than-or-equal comparison (>=)
*/
declare function greaterEqual(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Logical operator convenience functions
*/
/**
* Create a logical AND operation (&&)
*/
declare function logicalAnd(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Create a logical OR operation (||)
*/
declare function logicalOr(left: ASTNode, right: ASTNode): BinaryOp;
/**
* Generate source code from an AST node
*/
declare function generate(node: ASTNode): string;
/**
* Default execution context with common Math functions and date/time utilities
* Users can use this as-is or spread it into their own context
*
* All functions use UPPERCASE naming convention to avoid collisions with user variables.
* All date-related functions work with timestamps (milliseconds since Unix epoch)
* to maintain the language's numbers-only type system.
*
* @example
* // Use as-is
* execute('ABS(-5)', defaultContext)
*
* @example
* // Spread into custom context
* execute('NOW() + FROM_MINUTES(5)', {
*   ...defaultContext,
*   variables: { customVar: 42 }
* })
*
* @example
* // Work with timestamps
* const result = execute('NOW() + FROM_DAYS(7)', defaultContext)
* const futureDate = new Date(result) // Convert back to Date if needed
*
* @example
* // Calculate time differences
* const ts1 = Date.now()
* const ts2 = ts1 + 1000 * 60 * 60 * 3 // 3 hours later
* execute('DIFFERENCE_IN_HOURS(ts1, ts2)', { ...defaultContext, variables: { ts1, ts2 } })
*/
declare const defaultContext: ExecutionContext;
/**
* Options for customizing the humanization output
*/
interface HumanizeOptions {
	/**
	* Enable HTML output with wrapper tags
	* @default false
	*/
	html?: boolean;
	/**
	* CSS classes to apply to different node types when html is true
	*/
	htmlClasses?: {
		number?: string;
		identifier?: string;
		operator?: string;
		function?: string;
	};
	/**
	* Custom phrases for function names
	* Maps function name to human-readable phrase
	* Example: { 'MAX': 'the maximum of', 'CUSTOM': 'my custom function with' }
	*/
	functionPhrases?: Record<string, string>;
	/**
	* Custom phrases for operators
	* Overrides default operator text
	*/
	operatorPhrases?: Partial<Record<Operator, string>>;
	/**
	* Use more verbose, descriptive phrasing
	* @default false
	*/
	verbose?: boolean;
}
/**
* Humanize an AST node into human-readable English text
*
* @param node - The AST node to humanize
* @param options - Optional configuration for the output
* @returns Human-readable English text
*
* @example
* ```typescript
* const ast = parse('price * quantity > 100 ? (price * quantity - discount) * (1 + tax_rate) : MAX(price * quantity, 50)')
* const text = humanize(ast)
* // "if price times quantity is greater than 100 then (price times quantity minus discount) times (1 plus tax_rate), otherwise the maximum of price times quantity and 50"
* ```
*
* @example
* ```typescript
* // With HTML formatting
* const text = humanize(ast, {
*   html: true,
*   htmlClasses: {
*     identifier: 'variable',
*     operator: 'op',
*     number: 'num'
*   }
* })
* ```
*/
declare function humanize(node: ASTNode, options?: HumanizeOptions): string;
/**
* Evaluate source code or AST with given context
* @param input - Either a source code string or an AST node
* @param context - Optional execution context with variables and functions
*/
declare function evaluate(input: string | ASTNode, context?: ExecutionContext): RuntimeValue;
/**
* Optimize an AST using constant folding, expression simplification, and dead code elimination.
*
* This optimizer performs SAFE optimizations that preserve program semantics:
* - Constant folding: Evaluates arithmetic with literal operands at compile-time
* - Function argument pre-evaluation: Simplifies expressions passed to functions
* - Conditional folding: Evaluates ternary with constant condition
* - Dead code elimination: Removes unused variable assignments
*
* Optimizations that are NOT performed (because they're unsafe with context variables):
* - Variable propagation: Variables can be overridden by ExecutionContext
* - Cross-statement analysis: Each statement may affect external state
*
* Time complexity: O(n) where n is the number of AST nodes
* Space complexity: O(d) where d is the max depth (recursion stack)
*
* Algorithm properties:
* - Sound: Preserves program semantics exactly
* - Safe: No assumptions about variable values
* - Local: Only optimizes within individual expressions
*
* @param node - The AST node to optimize
* @returns Optimized AST node
*/
declare function optimize(node: ASTNode): ASTNode;
/**
* Parse source code string into AST
* Convenience function that creates lexer and parser
*
* @param source - The source code to parse
* @returns Parsed AST
*/
declare function parse(source: string): ASTNode;
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
type Visitor<T> = {
	/**
	* Handle a Program node (multiple statements)
	*/
	Program: (node: Program, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle a NumberLiteral node
	*/
	NumberLiteral: (node: NumberLiteral, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle an Identifier node (variable reference)
	*/
	Identifier: (node: Identifier, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle a BinaryOp node (binary operation)
	*/
	BinaryOp: (node: BinaryOp, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle a UnaryOp node (unary operation)
	*/
	UnaryOp: (node: UnaryOp, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle a FunctionCall node
	*/
	FunctionCall: (node: FunctionCall, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle an Assignment node (variable assignment)
	*/
	Assignment: (node: Assignment, recurse: (n: ASTNode) => T) => T;
	/**
	* Handle a ConditionalExpression node (ternary operator)
	*/
	ConditionalExpression: (node: ConditionalExpression, recurse: (n: ASTNode) => T) => T;
};
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
declare function visit<T>(node: ASTNode, visitor: Visitor<T>): T;
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
declare function visitPartial<T>(node: ASTNode, visitor: Partial<Visitor<T>>, defaultHandler: (node: ASTNode, recurse: (n: ASTNode) => T) => T): T;
export { visitPartial, visit, parse, optimize, isUnaryOp, isProgram, isNumberLiteral, isIdentifier, isFunctionCall, isConditionalExpression, isBinaryOp, isAssignment, humanize, generate, extractInputVariables, evaluate, defaultContext, exports_ast as ast, Visitor, UnaryOp, TokenType, Token, RuntimeValue, Program, Operator, NumberLiteral, Identifier, HumanizeOptions, FunctionCall, ExecutionContext, ConditionalExpression, BinaryOp, Assignment, ASTNode };
