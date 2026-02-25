import { describe, expect, test } from 'bun:test'
import {
	type ASTNode,
	add,
	array,
	assign,
	binaryOp,
	boolean,
	divide,
	forExpr,
	functionCall,
	identifier,
	ifExpr,
	isBinaryOp,
	isNumberLiteral,
	multiply,
	NodeKind,
	negate,
	number,
	program,
	string,
	subtract,
	unaryOp,
} from '../src/ast'
import { parse } from '../src/parser'
import { visit, visitPartial } from '../src/visitor'

describe('visit', () => {
	describe('basic traversal', () => {
		test('visits NumberLiteral node', () => {
			const node = number(42)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(42)
		})

		test('visits Identifier node', () => {
			const node = identifier('x')
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: () => '',
				StringLiteral: () => '',
				BooleanLiteral: () => '',
				ArrayLiteral: () => '',
				Identifier: (n) => n.name,
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: () => '',
				IfExpression: () => '',
				ForExpression: () => '',
			})
			expect(result).toBe('x')
		})

		test('visits BinaryOp node', () => {
			const node = add(number(2), number(3))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => recurse(n.left) + recurse(n.right),
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(5)
		})

		test('visits UnaryOp node', () => {
			const node = negate(number(5))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: (n, recurse) => -recurse(n.argument),
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(-5)
		})

		test('visits FunctionCall node', () => {
			const node = functionCall('sum', [number(1), number(2)])
			const result = visit<string>(node, {
				Program: () => '',
				NumberLiteral: (n) => String(n.value),
				StringLiteral: (n) => `"${n.value}"`,
				BooleanLiteral: (n) => String(n.value),
				ArrayLiteral: () => '[]',
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: (n, recurse) => {
					const argsStr = n.args.map(recurse).join(',')
					return `${n.name}(${argsStr})`
				},
				Assignment: () => '',
				IfExpression: () => '',
				ForExpression: () => '',
			})
			expect(result).toEqual('sum(1,2)')
		})

		test('visits Assignment node', () => {
			const node = assign('x', number(10))
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: (n) => String(n.value),
				StringLiteral: (n) => `"${n.value}"`,
				BooleanLiteral: (n) => String(n.value),
				ArrayLiteral: () => '[]',
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: (n, recurse) => `${n.name}=${recurse(n.value)}`,
				IfExpression: () => '',
				ForExpression: () => '',
			})
			expect(result).toBe('x=10')
		})

		test('visits IfExpression node', () => {
			const node = ifExpr(boolean(true), number(100), number(200))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: (n) => (n.value ? 1 : 0),
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: (n, recurse) =>
					recurse(n.condition) !== 0
						? recurse(n.consequent)
						: recurse(n.alternate),
				ForExpression: () => 0,
			})
			expect(result).toBe(100)
		})

		test('visits ForExpression node', () => {
			const node = forExpr(
				'x',
				array([number(1), number(2), number(3)]),
				null,
				identifier('x'),
			)
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: (n) => String(n.value),
				StringLiteral: (n) => n.value,
				BooleanLiteral: (n) => String(n.value),
				ArrayLiteral: (n, recurse) => `[${n.elements.map(recurse).join(', ')}]`,
				Identifier: (n) => n.name,
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: () => '',
				IfExpression: () => '',
				ForExpression: (n, recurse) =>
					`for ${n.variable} in ${recurse(n.iterable)} then ${recurse(n.body)}`,
			})
			expect(result).toBe('for x in [1, 2, 3] then x')
		})

		test('visits Program node', () => {
			const node = program([number(1), number(2), number(3)])
			const result = visit(node, {
				Program: (n, recurse) =>
					n.statements.map(recurse).reduce((a, b) => a + b, 0),
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(6)
		})

		test('visits StringLiteral node', () => {
			const node = string('hello')
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: () => '',
				StringLiteral: (n) => n.value,
				BooleanLiteral: () => '',
				ArrayLiteral: () => '',
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: () => '',
				IfExpression: () => '',
				ForExpression: () => '',
			})
			expect(result).toBe('hello')
		})

		test('visits BooleanLiteral node', () => {
			const node = boolean(true)
			const result = visit(node, {
				Program: () => false,
				NumberLiteral: () => false,
				StringLiteral: () => false,
				BooleanLiteral: (n) => n.value,
				ArrayLiteral: () => false,
				Identifier: () => false,
				BinaryOp: () => false,
				UnaryOp: () => false,
				FunctionCall: () => false,
				Assignment: () => false,
				IfExpression: () => false,
				ForExpression: () => false,
			})
			expect(result).toBe(true)
		})

		test('visits ArrayLiteral node', () => {
			const node = array([number(1), number(2), number(3)])
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: (n, recurse) =>
					n.elements.reduce((sum, el) => sum + recurse(el), 0),
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(6)
		})
	})

	describe('recursive behavior', () => {
		test('recursively visits nested BinaryOp nodes', () => {
			// (2 + 3) * 4
			const node = multiply(add(number(2), number(3)), number(4))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => {
					const leftVal = recurse(n.left)
					const rightVal = recurse(n.right)
					if (n.operator === '+') return leftVal + rightVal
					if (n.operator === '*') return leftVal * rightVal
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(20)
		})

		test('recursively visits deeply nested expressions', () => {
			// ((1 + 2) * (3 + 4)) + 5
			const node = add(
				multiply(add(number(1), number(2)), add(number(3), number(4))),
				number(5),
			)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => {
					const leftVal = recurse(n.left)
					const rightVal = recurse(n.right)
					if (n.operator === '+') return leftVal + rightVal
					if (n.operator === '*') return leftVal * rightVal
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				IfExpression: () => 0,
				ForExpression: () => 0,
			})
			expect(result).toBe(26) // (3 * 7) + 5
		})

		test('recursively visits Program with multiple statements', () => {
			const node = program([
				assign('x', number(5)),
				assign('y', number(10)),
				add(identifier('x'), identifier('y')),
			])

			const variables = new Map<string, number>()
			const result = visit(node, {
				Program: (n, recurse) => {
					let lastResult = 0
					for (const stmt of n.statements) {
						lastResult = recurse(stmt)
					}
					return lastResult
				},
				NumberLiteral: (n) => n.value,
				StringLiteral: () => 0,
				BooleanLiteral: () => 0,
				ArrayLiteral: () => 0,
				Identifier: (n) => variables.get(n.name) ?? 0,
				BinaryOp: (n, recurse) => {
					if (n.operator === '+') {
						return recurse(n.left) + recurse(n.right)
					}
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: (n, recurse) => {
					const val = recurse(n.value)
					variables.set(n.name, val)
					return val
				},
				IfExpression: () => 0,
				ForExpression: () => 0,
			})

			expect(result).toBe(15)
			expect(variables.get('x')).toBe(5)
			expect(variables.get('y')).toBe(10)
		})
	})

	describe('transform pattern', () => {
		test('transforms AST by doubling all numbers', () => {
			const node = add(number(2), number(3))
			const transformed = visit<ASTNode>(node, {
				Program: (n, recurse) => program(n.statements.map(recurse)),
				NumberLiteral: (n) => number(n.value * 2),
				StringLiteral: (n) => n,
				BooleanLiteral: (n) => n,
				ArrayLiteral: (n, recurse) => array(n.elements.map(recurse)),
				Identifier: (n) => n,
				BinaryOp: (n, recurse) =>
					binaryOp(recurse(n.left), n.operator, recurse(n.right)),
				UnaryOp: (n, recurse) => unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) => functionCall(n.name, n.args.map(recurse)),
				Assignment: (n, recurse) => assign(n.name, recurse(n.value)),
				IfExpression: (n, recurse) =>
					ifExpr(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
				ForExpression: (n, recurse) =>
					forExpr(
						n.variable,
						recurse(n.iterable),
						n.guard ? recurse(n.guard) : null,
						recurse(n.body),
					),
			})

			expect(transformed.kind).toBe(NodeKind.BinaryOp)
			if (isBinaryOp(transformed)) {
				expect(isNumberLiteral(transformed.left)).toBe(true)
				expect(isNumberLiteral(transformed.right)).toBe(true)
				if (
					isNumberLiteral(transformed.left) &&
					isNumberLiteral(transformed.right)
				) {
					expect(transformed.left.value).toBe(4)
					expect(transformed.right.value).toBe(6)
				}
			}
		})

		test('transforms AST by constant folding', () => {
			const node = add(number(2), number(3))
			const folded = visit<ASTNode>(node, {
				Program: (n, recurse) => program(n.statements.map(recurse)),
				NumberLiteral: (n) => n,
				StringLiteral: (n) => n,
				BooleanLiteral: (n) => n,
				ArrayLiteral: (n, recurse) => array(n.elements.map(recurse)),
				Identifier: (n) => n,
				BinaryOp: (n, recurse) => {
					const leftNode = recurse(n.left)
					const rightNode = recurse(n.right)
					if (isNumberLiteral(leftNode) && isNumberLiteral(rightNode)) {
						if (n.operator === '+') {
							return number(leftNode.value + rightNode.value)
						}
					}
					return binaryOp(leftNode, n.operator, rightNode)
				},
				UnaryOp: (n, recurse) => unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) => functionCall(n.name, n.args.map(recurse)),
				Assignment: (n, recurse) => assign(n.name, recurse(n.value)),
				IfExpression: (n, recurse) =>
					ifExpr(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
				ForExpression: (n, recurse) =>
					forExpr(
						n.variable,
						recurse(n.iterable),
						n.guard ? recurse(n.guard) : null,
						recurse(n.body),
					),
			})

			expect(isNumberLiteral(folded)).toBe(true)
			if (isNumberLiteral(folded)) {
				expect(folded.value).toBe(5)
			}
		})
	})

	describe('fold pattern', () => {
		test('counts total nodes in AST', () => {
			const node = add(number(2), multiply(number(3), number(4)))
			const count = visit(node, {
				Program: (n, recurse) =>
					1 + n.statements.reduce((sum, stmt) => sum + recurse(stmt), 0),
				NumberLiteral: () => 1,
				StringLiteral: () => 1,
				BooleanLiteral: () => 1,
				ArrayLiteral: (n, recurse) =>
					1 + n.elements.reduce((sum, el) => sum + recurse(el), 0),
				Identifier: () => 1,
				BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
				UnaryOp: (n, recurse) => 1 + recurse(n.argument),
				FunctionCall: (n, recurse) =>
					1 + n.args.reduce((sum, arg) => sum + recurse(arg), 0),
				Assignment: (n, recurse) => 1 + recurse(n.value),
				IfExpression: (n, recurse) =>
					1 +
					recurse(n.condition) +
					recurse(n.consequent) +
					recurse(n.alternate),
				ForExpression: (n, recurse) =>
					1 +
					recurse(n.iterable) +
					(n.guard ? recurse(n.guard) : 0) +
					recurse(n.body),
			})
			expect(count).toBe(5) // 1 add + 1 mul + 3 numbers
		})

		test('collects all variable names', () => {
			const node = parse('x = 5; y = x + 10; z = y * 2')
			const variables: string[] = []

			visit(node, {
				Program: (n, recurse) => {
					n.statements.forEach(recurse)
					return undefined
				},
				NumberLiteral: () => undefined,
				StringLiteral: () => undefined,
				BooleanLiteral: () => undefined,
				ArrayLiteral: (n, recurse) => {
					n.elements.forEach(recurse)
					return undefined
				},
				Identifier: (n) => {
					variables.push(n.name)
					return undefined
				},
				BinaryOp: (n, recurse) => {
					recurse(n.left)
					recurse(n.right)
					return undefined
				},
				UnaryOp: (n, recurse) => {
					recurse(n.argument)
					return undefined
				},
				FunctionCall: (n, recurse) => {
					n.args.forEach(recurse)
					return undefined
				},
				Assignment: (n, recurse) => {
					recurse(n.value)
					return undefined
				},
				IfExpression: (n, recurse) => {
					recurse(n.condition)
					recurse(n.consequent)
					recurse(n.alternate)
					return undefined
				},
				ForExpression: (n, recurse) => {
					recurse(n.iterable)
					if (n.guard) recurse(n.guard)
					recurse(n.body)
					return undefined
				},
			})

			// x and y appear in identifiers (not just assignments)
			expect(variables).toEqual(['x', 'y'])
		})

		test('computes maximum depth of AST', () => {
			const node = add(
				multiply(number(1), number(2)),
				divide(subtract(number(3), number(4)), number(5)),
			)

			const depth = visit(node, {
				Program: (n, recurse) => 1 + Math.max(...n.statements.map(recurse), 0),
				NumberLiteral: () => 1,
				StringLiteral: () => 1,
				BooleanLiteral: () => 1,
				ArrayLiteral: (n, recurse) =>
					1 + Math.max(...n.elements.map(recurse), 0),
				Identifier: () => 1,
				BinaryOp: (n, recurse) =>
					1 + Math.max(recurse(n.left), recurse(n.right)),
				UnaryOp: (n, recurse) => 1 + recurse(n.argument),
				FunctionCall: (n, recurse) => 1 + Math.max(...n.args.map(recurse), 0),
				Assignment: (n, recurse) => 1 + recurse(n.value),
				IfExpression: (n, recurse) =>
					1 +
					Math.max(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
				ForExpression: (n, recurse) =>
					1 +
					Math.max(
						recurse(n.iterable),
						n.guard ? recurse(n.guard) : 0,
						recurse(n.body),
					),
			})

			expect(depth).toBe(4) // add -> divide -> subtract -> number
		})
	})

	describe('walk pattern', () => {
		test('performs side effects during traversal', () => {
			const node = add(number(2), number(3))
			const visited: string[] = []

			visit(node, {
				Program: (n, recurse) => {
					visited.push('Program')
					n.statements.forEach(recurse)
				},
				NumberLiteral: (n) => {
					visited.push(`Number:${n.value}`)
				},
				StringLiteral: (n) => {
					visited.push(`String:${n.value}`)
				},
				BooleanLiteral: (n) => {
					visited.push(`Boolean:${n.value}`)
				},
				ArrayLiteral: (n, recurse) => {
					visited.push('Array')
					n.elements.forEach(recurse)
				},
				Identifier: (n) => {
					visited.push(`Identifier:${n.name}`)
				},
				BinaryOp: (n, recurse) => {
					visited.push(`BinaryOp:${n.operator}`)
					recurse(n.left)
					recurse(n.right)
				},
				UnaryOp: (n, recurse) => {
					visited.push(`UnaryOp:${n.operator}`)
					recurse(n.argument)
				},
				FunctionCall: (n, recurse) => {
					visited.push(`FunctionCall:${n.name}`)
					n.args.forEach(recurse)
				},
				Assignment: (n, recurse) => {
					visited.push(`Assignment:${n.name}`)
					recurse(n.value)
				},
				IfExpression: (n, recurse) => {
					visited.push('IfExpression')
					recurse(n.condition)
					recurse(n.consequent)
					recurse(n.alternate)
				},
				ForExpression: (n, recurse) => {
					visited.push('ForExpression')
					recurse(n.iterable)
					if (n.guard) recurse(n.guard)
					recurse(n.body)
				},
			})

			expect(visited).toEqual(['BinaryOp:+', 'Number:2', 'Number:3'])
		})
	})
})

describe('visitPartial', () => {
	test('handles only specified node types', () => {
		const node = parse('x = 5; y = x + 10')
		const variables: string[] = []

		visitPartial(
			node,
			{
				Identifier: (n) => {
					variables.push(n.name)
					return undefined
				},
			},
			(n, recurse) => {
				// Default: recurse into children
				if (n.kind === NodeKind.Program) {
					for (const stmt of n.statements) recurse(stmt)
				} else if (n.kind === NodeKind.BinaryOp) {
					recurse(n.left)
					recurse(n.right)
				} else if (n.kind === NodeKind.Assignment) {
					recurse(n.value)
				}
				return undefined
			},
		)

		expect(variables).toEqual(['x'])
	})

	test('uses default handler for unhandled node types', () => {
		const node = add(number(2), number(3))
		const result = visitPartial(
			node,
			{
				NumberLiteral: (n) => n.value,
			},
			() => 0, // Default: return 0
		)

		// BinaryOp is not handled, so it returns 0 from default
		expect(result).toBe(0)
	})

	test('transforms only specific node types', () => {
		const node = add(number(2), number(3))
		const transformed = visitPartial<ASTNode>(
			node,
			{
				NumberLiteral: (n) => number(n.value * 10),
			},
			(n, recurse) => {
				// Default: reconstruct node with recursed children
				if (n.kind === NodeKind.BinaryOp) {
					return binaryOp(recurse(n.left), n.operator, recurse(n.right))
				}
				return n
			},
		)

		expect(transformed.kind).toBe(NodeKind.BinaryOp)
		if (isBinaryOp(transformed)) {
			expect(isNumberLiteral(transformed.left)).toBe(true)
			expect(isNumberLiteral(transformed.right)).toBe(true)
			if (
				isNumberLiteral(transformed.left) &&
				isNumberLiteral(transformed.right)
			) {
				expect(transformed.left.value).toBe(20)
				expect(transformed.right.value).toBe(30)
			}
		}
	})

	test('identity transformation (returns node as-is)', () => {
		const node = add(number(2), number(3))
		const result = visitPartial(
			node,
			{}, // No handlers
			(n) => n, // Default: identity
		)

		expect(result).toBe(node) // Same reference
	})

	test('collects specific information without full visitor', () => {
		const node = parse('MAX(x + y, 100) + MIN(a, b)')
		const functionNames: string[] = []

		visitPartial(
			node,
			{
				FunctionCall: (n, recurse) => {
					functionNames.push(n.name)
					n.args.forEach(recurse) // Still recurse to find nested calls
					return undefined
				},
			},
			(n, recurse) => {
				// Default: recurse into all children
				if (n.kind === NodeKind.Program) {
					for (const stmt of n.statements) recurse(stmt)
				} else if (n.kind === NodeKind.BinaryOp) {
					recurse(n.left)
					recurse(n.right)
				}
				return undefined
			},
		)

		expect(functionNames).toEqual(['MAX', 'MIN'])
	})
})

describe('visitor examples from real use cases', () => {
	test('example: replaceIdentifier (rename variable)', () => {
		const replaceIdentifier = (
			node: ASTNode,
			from: string,
			to: string,
		): ASTNode => {
			return visit(node, {
				Program: (n, recurse) => program(n.statements.map(recurse)),
				NumberLiteral: (n) => n,
				StringLiteral: (n) => n,
				BooleanLiteral: (n) => n,
				ArrayLiteral: (n, recurse) => array(n.elements.map(recurse)),
				Identifier: (n) =>
					n.name === from ? identifier(to) : identifier(n.name),
				BinaryOp: (n, recurse) =>
					binaryOp(recurse(n.left), n.operator, recurse(n.right)),
				UnaryOp: (n, recurse) => unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) => functionCall(n.name, n.args.map(recurse)),
				Assignment: (n, recurse) => assign(n.name, recurse(n.value)),
				IfExpression: (n, recurse) =>
					ifExpr(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
				ForExpression: (n, recurse) =>
					forExpr(
						n.variable,
						recurse(n.iterable),
						n.guard ? recurse(n.guard) : null,
						recurse(n.body),
					),
			})
		}

		const original = parse('x = 5; y = x + 10')
		const renamed = replaceIdentifier(original, 'x', 'foo')

		// Verify the identifier was renamed
		let foundFoo = false
		visitPartial(
			renamed,
			{
				Identifier: (n) => {
					if (n.name === 'foo') foundFoo = true
					return undefined
				},
			},
			(n, recurse) => {
				if (n.kind === NodeKind.Program)
					for (const stmt of n.statements) recurse(stmt)
				else if (n.kind === NodeKind.BinaryOp) {
					recurse(n.left)
					recurse(n.right)
				} else if (n.kind === NodeKind.Assignment) recurse(n.value)
				return undefined
			},
		)

		expect(foundFoo).toBe(true)
	})

	test('example: extractVariables (find all variable references)', () => {
		const extractVariables = (node: ASTNode): string[] => {
			const vars: string[] = []
			visitPartial(
				node,
				{
					Identifier: (n) => {
						vars.push(n.name)
						return undefined
					},
				},
				(n, recurse) => {
					if (n.kind === NodeKind.Program) {
						for (const stmt of n.statements) recurse(stmt)
					} else if (n.kind === NodeKind.BinaryOp) {
						recurse(n.left)
						recurse(n.right)
					} else if (n.kind === NodeKind.UnaryOp) {
						recurse(n.argument)
					} else if (n.kind === NodeKind.FunctionCall) {
						n.args.forEach(recurse)
					} else if (n.kind === NodeKind.Assignment) {
						recurse(n.value)
					} else if (n.kind === NodeKind.IfExpression) {
						recurse(n.condition)
						recurse(n.consequent)
						recurse(n.alternate)
					} else if (n.kind === NodeKind.ForExpression) {
						recurse(n.iterable)
						if (n.guard) recurse(n.guard)
						recurse(n.body)
					} else if (n.kind === NodeKind.ArrayLiteral) {
						n.elements.forEach(recurse)
					}
					return undefined
				},
			)
			return [...new Set(vars)]
		}

		const node = parse('x = 5; y = x + z; result = y * 2')
		const vars = extractVariables(node)

		expect(vars.sort()).toEqual(['x', 'y', 'z'].sort())
	})
})
