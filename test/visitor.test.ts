import { describe, expect, test } from 'bun:test'
import * as ast from '../src/ast'
import { parseSource } from '../src/parser'
import type { ASTNode } from '../src/types'
import { isNumberLiteral } from '../src/types'
import { visit, visitPartial } from '../src/visitor'

describe('visit', () => {
	describe('basic traversal', () => {
		test('visits NumberLiteral node', () => {
			const node = ast.number(42)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(42)
		})

		test('visits Identifier node', () => {
			const node = ast.identifier('x')
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: () => '',
				Identifier: (n) => n.name,
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: () => '',
				ConditionalExpression: () => '',
			})
			expect(result).toBe('x')
		})

		test('visits BinaryOp node', () => {
			const node = ast.add(ast.number(2), ast.number(3))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => recurse(n.left) + recurse(n.right),
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(5)
		})

		test('visits UnaryOp node', () => {
			const node = ast.negate(ast.number(5))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: (n, recurse) => -recurse(n.argument),
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(-5)
		})

		test('visits FunctionCall node', () => {
			const node = ast.functionCall('sum', [ast.number(1), ast.number(2)])
			const result = visit<string>(node, {
				Program: () => '',
				NumberLiteral: (n) => String(n.value),
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: (n, recurse) => {
					const args = n.arguments.map(recurse).join(',')
					return `${n.name}(${args})`
				},
				Assignment: () => '',
				ConditionalExpression: () => '',
			})
			expect(result).toEqual('sum(1,2)')
		})

		test('visits Assignment node', () => {
			const node = ast.assign('x', ast.number(10))
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: (n) => String(n.value),
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: (n, recurse) => `${n.name}=${recurse(n.value)}`,
				ConditionalExpression: () => '',
			})
			expect(result).toBe('x=10')
		})

		test('visits ConditionalExpression node', () => {
			const node = ast.conditional(
				ast.number(1),
				ast.number(100),
				ast.number(200),
			)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: (n, recurse) =>
					recurse(n.condition) !== 0
						? recurse(n.consequent)
						: recurse(n.alternate),
			})
			expect(result).toBe(100)
		})

		test('visits Program node', () => {
			const node = ast.program([ast.number(1), ast.number(2), ast.number(3)])
			const result = visit(node, {
				Program: (n, recurse) =>
					n.statements.map(recurse).reduce((a, b) => a + b, 0),
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(6)
		})
	})

	describe('recursive behavior', () => {
		test('recursively visits nested BinaryOp nodes', () => {
			// (2 + 3) * 4
			const node = ast.multiply(
				ast.add(ast.number(2), ast.number(3)),
				ast.number(4),
			)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => {
					const left = recurse(n.left)
					const right = recurse(n.right)
					if (n.operator === '+') return left + right
					if (n.operator === '*') return left * right
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(20)
		})

		test('recursively visits deeply nested expressions', () => {
			// ((1 + 2) * (3 + 4)) + 5
			const node = ast.add(
				ast.multiply(
					ast.add(ast.number(1), ast.number(2)),
					ast.add(ast.number(3), ast.number(4)),
				),
				ast.number(5),
			)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: (n) => n.value,
				Identifier: () => 0,
				BinaryOp: (n, recurse) => {
					const left = recurse(n.left)
					const right = recurse(n.right)
					if (n.operator === '+') return left + right
					if (n.operator === '*') return left * right
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(26) // (3 * 7) + 5
		})

		test('recursively visits Program with multiple statements', () => {
			const node = ast.program([
				ast.assign('x', ast.number(5)),
				ast.assign('y', ast.number(10)),
				ast.add(ast.identifier('x'), ast.identifier('y')),
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
					const value = recurse(n.value)
					variables.set(n.name, value)
					return value
				},
				ConditionalExpression: () => 0,
			})

			expect(result).toBe(15)
			expect(variables.get('x')).toBe(5)
			expect(variables.get('y')).toBe(10)
		})
	})

	describe('transform pattern', () => {
		test('transforms AST by doubling all numbers', () => {
			const node = ast.add(ast.number(2), ast.number(3))
			const transformed = visit<ASTNode>(node, {
				Program: (n, recurse) => ast.program(n.statements.map(recurse)),
				NumberLiteral: (n) => ast.number(n.value * 2),
				Identifier: (n) => n,
				BinaryOp: (n, recurse) =>
					ast.binaryOp(recurse(n.left), n.operator, recurse(n.right)),
				UnaryOp: (n, recurse) => ast.unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) =>
					ast.functionCall(n.name, n.arguments.map(recurse)),
				Assignment: (n, recurse) => ast.assign(n.name, recurse(n.value)),
				ConditionalExpression: (n, recurse) =>
					ast.conditional(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
			})

			expect(transformed.type).toBe('BinaryOp')
			if (transformed.type === 'BinaryOp') {
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
			const node = ast.add(ast.number(2), ast.number(3))
			const folded = visit<ASTNode>(node, {
				Program: (n, recurse) => ast.program(n.statements.map(recurse)),
				NumberLiteral: (n) => n,
				Identifier: (n) => n,
				BinaryOp: (n, recurse) => {
					const left = recurse(n.left)
					const right = recurse(n.right)
					if (isNumberLiteral(left) && isNumberLiteral(right)) {
						if (n.operator === '+') {
							return ast.number(left.value + right.value)
						}
					}
					return ast.binaryOp(left, n.operator, right)
				},
				UnaryOp: (n, recurse) => ast.unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) =>
					ast.functionCall(n.name, n.arguments.map(recurse)),
				Assignment: (n, recurse) => ast.assign(n.name, recurse(n.value)),
				ConditionalExpression: (n, recurse) =>
					ast.conditional(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
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
			const node = ast.add(
				ast.number(2),
				ast.multiply(ast.number(3), ast.number(4)),
			)
			const count = visit(node, {
				Program: (n, recurse) =>
					1 + n.statements.reduce((sum, stmt) => sum + recurse(stmt), 0),
				NumberLiteral: () => 1,
				Identifier: () => 1,
				BinaryOp: (n, recurse) => 1 + recurse(n.left) + recurse(n.right),
				UnaryOp: (n, recurse) => 1 + recurse(n.argument),
				FunctionCall: (n, recurse) =>
					1 + n.arguments.reduce((sum, arg) => sum + recurse(arg), 0),
				Assignment: (n, recurse) => 1 + recurse(n.value),
				ConditionalExpression: (n, recurse) =>
					1 +
					recurse(n.condition) +
					recurse(n.consequent) +
					recurse(n.alternate),
			})
			expect(count).toBe(5) // 1 add + 1 mul + 3 numbers
		})

		test('collects all variable names', () => {
			const node = parseSource('x = 5; y = x + 10; z = y * 2')
			const variables: string[] = []

			visit(node, {
				Program: (n, recurse) => {
					n.statements.forEach(recurse)
					return undefined
				},
				NumberLiteral: () => undefined,
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
					n.arguments.forEach(recurse)
					return undefined
				},
				Assignment: (n, recurse) => {
					recurse(n.value)
					return undefined
				},
				ConditionalExpression: (n, recurse) => {
					recurse(n.condition)
					recurse(n.consequent)
					recurse(n.alternate)
					return undefined
				},
			})

			// x and y appear in identifiers (not just assignments)
			expect(variables).toEqual(['x', 'y'])
		})

		test('computes maximum depth of AST', () => {
			const node = ast.add(
				ast.multiply(ast.number(1), ast.number(2)),
				ast.divide(ast.subtract(ast.number(3), ast.number(4)), ast.number(5)),
			)

			const depth = visit(node, {
				Program: (n, recurse) => 1 + Math.max(...n.statements.map(recurse), 0),
				NumberLiteral: () => 1,
				Identifier: () => 1,
				BinaryOp: (n, recurse) =>
					1 + Math.max(recurse(n.left), recurse(n.right)),
				UnaryOp: (n, recurse) => 1 + recurse(n.argument),
				FunctionCall: (n, recurse) =>
					1 + Math.max(...n.arguments.map(recurse), 0),
				Assignment: (n, recurse) => 1 + recurse(n.value),
				ConditionalExpression: (n, recurse) =>
					1 +
					Math.max(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
			})

			expect(depth).toBe(4) // add -> divide -> subtract -> number
		})
	})

	describe('walk pattern', () => {
		test('performs side effects during traversal', () => {
			const node = ast.add(ast.number(2), ast.number(3))
			const visited: string[] = []

			visit(node, {
				Program: (n, recurse) => {
					visited.push('Program')
					n.statements.forEach(recurse)
				},
				NumberLiteral: (n) => {
					visited.push(`Number:${n.value}`)
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
					n.arguments.forEach(recurse)
				},
				Assignment: (n, recurse) => {
					visited.push(`Assignment:${n.name}`)
					recurse(n.value)
				},
				ConditionalExpression: (n, recurse) => {
					visited.push('ConditionalExpression')
					recurse(n.condition)
					recurse(n.consequent)
					recurse(n.alternate)
				},
			})

			expect(visited).toEqual(['BinaryOp:+', 'Number:2', 'Number:3'])
		})
	})
})

describe('visitPartial', () => {
	test('handles only specified node types', () => {
		const node = parseSource('x = 5; y = x + 10')
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
				if (n.type === 'Program') {
					n.statements.forEach(recurse)
				} else if (n.type === 'BinaryOp') {
					recurse(n.left)
					recurse(n.right)
				} else if (n.type === 'Assignment') {
					recurse(n.value)
				}
				return undefined
			},
		)

		expect(variables).toEqual(['x'])
	})

	test('uses default handler for unhandled node types', () => {
		const node = ast.add(ast.number(2), ast.number(3))
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
		const node = ast.add(ast.number(2), ast.number(3))
		const transformed = visitPartial<ASTNode>(
			node,
			{
				NumberLiteral: (n) => ast.number(n.value * 10),
			},
			(n, recurse) => {
				// Default: reconstruct node with recursed children
				if (n.type === 'BinaryOp') {
					return ast.binaryOp(recurse(n.left), n.operator, recurse(n.right))
				}
				return n
			},
		)

		expect(transformed.type).toBe('BinaryOp')
		if (transformed.type === 'BinaryOp') {
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
		const node = ast.add(ast.number(2), ast.number(3))
		const result = visitPartial(
			node,
			{}, // No handlers
			(n) => n, // Default: identity
		)

		expect(result).toBe(node) // Same reference
	})

	test('collects specific information without full visitor', () => {
		const node = parseSource('MAX(x + y, 100) + MIN(a, b)')
		const functionNames: string[] = []

		visitPartial(
			node,
			{
				FunctionCall: (n, recurse) => {
					functionNames.push(n.name)
					n.arguments.forEach(recurse) // Still recurse to find nested calls
					return undefined
				},
			},
			(n, recurse) => {
				// Default: recurse into all children
				if (n.type === 'Program') {
					n.statements.forEach(recurse)
				} else if (n.type === 'BinaryOp') {
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
				Program: (n, recurse) => ast.program(n.statements.map(recurse)),
				NumberLiteral: (n) => n,
				Identifier: (n) => (n.name === from ? ast.identifier(to) : n),
				BinaryOp: (n, recurse) =>
					ast.binaryOp(recurse(n.left), n.operator, recurse(n.right)),
				UnaryOp: (n, recurse) => ast.unaryOp(n.operator, recurse(n.argument)),
				FunctionCall: (n, recurse) =>
					ast.functionCall(n.name, n.arguments.map(recurse)),
				Assignment: (n, recurse) => ast.assign(n.name, recurse(n.value)),
				ConditionalExpression: (n, recurse) =>
					ast.conditional(
						recurse(n.condition),
						recurse(n.consequent),
						recurse(n.alternate),
					),
			})
		}

		const original = parseSource('x = 5; y = x + 10')
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
				if (n.type === 'Program') n.statements.forEach(recurse)
				else if (n.type === 'BinaryOp') {
					recurse(n.left)
					recurse(n.right)
				} else if (n.type === 'Assignment') recurse(n.value)
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
					if (n.type === 'Program') {
						n.statements.forEach(recurse)
					} else if (n.type === 'BinaryOp') {
						recurse(n.left)
						recurse(n.right)
					} else if (n.type === 'UnaryOp') {
						recurse(n.argument)
					} else if (n.type === 'FunctionCall') {
						n.arguments.forEach(recurse)
					} else if (n.type === 'Assignment') {
						recurse(n.value)
					} else if (n.type === 'ConditionalExpression') {
						recurse(n.condition)
						recurse(n.consequent)
						recurse(n.alternate)
					}
					return undefined
				},
			)
			return [...new Set(vars)]
		}

		const node = parseSource('x = 5; y = x + z; result = y * 2')
		const vars = extractVariables(node)

		expect(vars.sort()).toEqual(['x', 'y', 'z'].sort())
	})
})
