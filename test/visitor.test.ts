import { describe, expect, test } from 'bun:test'
import {
	type ASTNode,
	add,
	assign,
	binaryOp,
	conditional,
	divide,
	functionCall,
	identifier,
	isNumberLiteral,
	multiply,
	NodeKind,
	negate,
	number,
	program,
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
				NumberLiteral: ([, value]) => value,
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
			const node = identifier('x')
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: () => '',
				Identifier: ([, name]) => name,
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: () => '',
				ConditionalExpression: () => '',
			})
			expect(result).toBe('x')
		})

		test('visits BinaryOp node', () => {
			const node = add(number(2), number(3))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: ([, value]) => value,
				Identifier: () => 0,
				BinaryOp: ([, left, _, right], recurse) =>
					recurse(left) + recurse(right),
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(5)
		})

		test('visits UnaryOp node', () => {
			const node = negate(number(5))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: ([, value]) => value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: ([, , arg], recurse) => -recurse(arg),
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: () => 0,
			})
			expect(result).toBe(-5)
		})

		test('visits FunctionCall node', () => {
			const node = functionCall('sum', [number(1), number(2)])
			const result = visit<string>(node, {
				Program: () => '',
				NumberLiteral: ([, value]) => String(value),
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: ([, name, args], recurse) => {
					const argsStr = args.map(recurse).join(',')
					return `${name}(${argsStr})`
				},
				Assignment: () => '',
				ConditionalExpression: () => '',
			})
			expect(result).toEqual('sum(1,2)')
		})

		test('visits Assignment node', () => {
			const node = assign('x', number(10))
			const result = visit(node, {
				Program: () => '',
				NumberLiteral: ([, value]) => String(value),
				Identifier: () => '',
				BinaryOp: () => '',
				UnaryOp: () => '',
				FunctionCall: () => '',
				Assignment: ([, name, value], recurse) => `${name}=${recurse(value)}`,
				ConditionalExpression: () => '',
			})
			expect(result).toBe('x=10')
		})

		test('visits ConditionalExpression node', () => {
			const node = conditional(number(1), number(100), number(200))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: ([, value]) => value,
				Identifier: () => 0,
				BinaryOp: () => 0,
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: () => 0,
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) =>
					recurse(condition) !== 0 ? recurse(consequent) : recurse(alternate),
			})
			expect(result).toBe(100)
		})

		test('visits Program node', () => {
			const node = program([number(1), number(2), number(3)])
			const result = visit(node, {
				Program: ([, statements], recurse) =>
					statements.map(recurse).reduce((a, b) => a + b, 0),
				NumberLiteral: ([, value]) => value,
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
			const node = multiply(add(number(2), number(3)), number(4))
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: ([, value]) => value,
				Identifier: () => 0,
				BinaryOp: ([, left, operator, right], recurse) => {
					const leftVal = recurse(left)
					const rightVal = recurse(right)
					if (operator === '+') return leftVal + rightVal
					if (operator === '*') return leftVal * rightVal
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
			const node = add(
				multiply(add(number(1), number(2)), add(number(3), number(4))),
				number(5),
			)
			const result = visit(node, {
				Program: () => 0,
				NumberLiteral: ([, value]) => value,
				Identifier: () => 0,
				BinaryOp: ([, left, operator, right], recurse) => {
					const leftVal = recurse(left)
					const rightVal = recurse(right)
					if (operator === '+') return leftVal + rightVal
					if (operator === '*') return leftVal * rightVal
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
			const node = program([
				assign('x', number(5)),
				assign('y', number(10)),
				add(identifier('x'), identifier('y')),
			])

			const variables = new Map<string, number>()
			const result = visit(node, {
				Program: ([, statements], recurse) => {
					let lastResult = 0
					for (const stmt of statements) {
						lastResult = recurse(stmt)
					}
					return lastResult
				},
				NumberLiteral: ([, value]) => value,
				Identifier: ([, name]) => variables.get(name) ?? 0,
				BinaryOp: ([, left, operator, right], recurse) => {
					if (operator === '+') {
						return recurse(left) + recurse(right)
					}
					return 0
				},
				UnaryOp: () => 0,
				FunctionCall: () => 0,
				Assignment: ([, name, value], recurse) => {
					const val = recurse(value)
					variables.set(name, val)
					return val
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
			const node = add(number(2), number(3))
			const transformed = visit<ASTNode>(node, {
				Program: ([, statements], recurse) => program(statements.map(recurse)),
				NumberLiteral: ([, value]) => number(value * 2),
				Identifier: (n) => n,
				BinaryOp: ([, left, operator, right], recurse) =>
					binaryOp(recurse(left), operator, recurse(right)),
				UnaryOp: ([, operator, argument], recurse) =>
					unaryOp(operator, recurse(argument)),
				FunctionCall: ([, name, args], recurse) =>
					functionCall(name, args.map(recurse)),
				Assignment: ([, name, value], recurse) => assign(name, recurse(value)),
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) =>
					conditional(
						recurse(condition),
						recurse(consequent),
						recurse(alternate),
					),
			})

			expect(transformed[0]).toBe(NodeKind.BinaryOp)
			if (transformed[0] === NodeKind.BinaryOp) {
				expect(isNumberLiteral(transformed[1])).toBe(true)
				expect(isNumberLiteral(transformed[3])).toBe(true)
				if (
					isNumberLiteral(transformed[1]) &&
					isNumberLiteral(transformed[3])
				) {
					expect(transformed[1][1]).toBe(4)
					expect(transformed[3][1]).toBe(6)
				}
			}
		})

		test('transforms AST by constant folding', () => {
			const node = add(number(2), number(3))
			const folded = visit<ASTNode>(node, {
				Program: ([, statements], recurse) => program(statements.map(recurse)),
				NumberLiteral: (n) => n,
				Identifier: (n) => n,
				BinaryOp: ([, left, operator, right], recurse) => {
					const leftNode = recurse(left)
					const rightNode = recurse(right)
					if (isNumberLiteral(leftNode) && isNumberLiteral(rightNode)) {
						if (operator === '+') {
							return number(leftNode[1] + rightNode[1])
						}
					}
					return binaryOp(leftNode, operator, rightNode)
				},
				UnaryOp: ([, operator, argument], recurse) =>
					unaryOp(operator, recurse(argument)),
				FunctionCall: ([, name, args], recurse) =>
					functionCall(name, args.map(recurse)),
				Assignment: ([, name, value], recurse) => assign(name, recurse(value)),
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) =>
					conditional(
						recurse(condition),
						recurse(consequent),
						recurse(alternate),
					),
			})

			expect(isNumberLiteral(folded)).toBe(true)
			if (isNumberLiteral(folded)) {
				expect(folded[1]).toBe(5)
			}
		})
	})

	describe('fold pattern', () => {
		test('counts total nodes in AST', () => {
			const node = add(number(2), multiply(number(3), number(4)))
			const count = visit(node, {
				Program: ([, statements], recurse) =>
					1 + statements.reduce((sum, stmt) => sum + recurse(stmt), 0),
				NumberLiteral: () => 1,
				Identifier: () => 1,
				BinaryOp: ([, left, , right], recurse) =>
					1 + recurse(left) + recurse(right),
				UnaryOp: ([, , argument], recurse) => 1 + recurse(argument),
				FunctionCall: ([, , args], recurse) =>
					1 + args.reduce((sum, arg) => sum + recurse(arg), 0),
				Assignment: ([, , value], recurse) => 1 + recurse(value),
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) => 1 + recurse(condition) + recurse(consequent) + recurse(alternate),
			})
			expect(count).toBe(5) // 1 add + 1 mul + 3 numbers
		})

		test('collects all variable names', () => {
			const node = parse('x = 5; y = x + 10; z = y * 2')
			const variables: string[] = []

			visit(node, {
				Program: ([, statements], recurse) => {
					statements.forEach(recurse)
					return undefined
				},
				NumberLiteral: () => undefined,
				Identifier: ([, name]) => {
					variables.push(name)
					return undefined
				},
				BinaryOp: ([, left, , right], recurse) => {
					recurse(left)
					recurse(right)
					return undefined
				},
				UnaryOp: ([, , argument], recurse) => {
					recurse(argument)
					return undefined
				},
				FunctionCall: ([, , args], recurse) => {
					args.forEach(recurse)
					return undefined
				},
				Assignment: ([, , value], recurse) => {
					recurse(value)
					return undefined
				},
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) => {
					recurse(condition)
					recurse(consequent)
					recurse(alternate)
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
				Program: ([, statements], recurse) =>
					1 + Math.max(...statements.map(recurse), 0),
				NumberLiteral: () => 1,
				Identifier: () => 1,
				BinaryOp: ([, left, , right], recurse) =>
					1 + Math.max(recurse(left), recurse(right)),
				UnaryOp: ([, , argument], recurse) => 1 + recurse(argument),
				FunctionCall: ([, , args], recurse) =>
					1 + Math.max(...args.map(recurse), 0),
				Assignment: ([, , value], recurse) => 1 + recurse(value),
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) =>
					1 +
					Math.max(recurse(condition), recurse(consequent), recurse(alternate)),
			})

			expect(depth).toBe(4) // add -> divide -> subtract -> number
		})
	})

	describe('walk pattern', () => {
		test('performs side effects during traversal', () => {
			const node = add(number(2), number(3))
			const visited: string[] = []

			visit(node, {
				Program: ([, statements], recurse) => {
					visited.push('Program')
					statements.forEach(recurse)
				},
				NumberLiteral: ([, value]) => {
					visited.push(`Number:${value}`)
				},
				Identifier: ([, name]) => {
					visited.push(`Identifier:${name}`)
				},
				BinaryOp: ([, left, operator, right], recurse) => {
					visited.push(`BinaryOp:${operator}`)
					recurse(left)
					recurse(right)
				},
				UnaryOp: ([, operator, argument], recurse) => {
					visited.push(`UnaryOp:${operator}`)
					recurse(argument)
				},
				FunctionCall: ([, name, args], recurse) => {
					visited.push(`FunctionCall:${name}`)
					args.forEach(recurse)
				},
				Assignment: ([, name, value], recurse) => {
					visited.push(`Assignment:${name}`)
					recurse(value)
				},
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) => {
					visited.push('ConditionalExpression')
					recurse(condition)
					recurse(consequent)
					recurse(alternate)
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
				Identifier: ([, name]) => {
					variables.push(name)
					return undefined
				},
			},
			(n, recurse) => {
				// Default: recurse into children
				if (n[0] === NodeKind.Program) {
					n[1].forEach(recurse)
				} else if (n[0] === NodeKind.BinaryOp) {
					recurse(n[1])
					recurse(n[3])
				} else if (n[0] === NodeKind.Assignment) {
					recurse(n[2])
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
				NumberLiteral: ([, value]) => value,
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
				NumberLiteral: ([, value]) => number(value * 10),
			},
			(n, recurse) => {
				// Default: reconstruct node with recursed children
				if (n[0] === NodeKind.BinaryOp) {
					return binaryOp(recurse(n[1]), n[2], recurse(n[3]))
				}
				return n
			},
		)

		expect(transformed[0]).toBe(NodeKind.BinaryOp)
		if (transformed[0] === NodeKind.BinaryOp) {
			expect(isNumberLiteral(transformed[1])).toBe(true)
			expect(isNumberLiteral(transformed[3])).toBe(true)
			if (isNumberLiteral(transformed[1]) && isNumberLiteral(transformed[3])) {
				expect(transformed[1][1]).toBe(20)
				expect(transformed[3][1]).toBe(30)
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
				FunctionCall: ([, name, args], recurse) => {
					functionNames.push(name)
					args.forEach(recurse) // Still recurse to find nested calls
					return undefined
				},
			},
			(n, recurse) => {
				// Default: recurse into all children
				if (n[0] === NodeKind.Program) {
					n[1].forEach(recurse)
				} else if (n[0] === NodeKind.BinaryOp) {
					recurse(n[1])
					recurse(n[3])
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
				Program: ([, statements], recurse) => program(statements.map(recurse)),
				NumberLiteral: (n) => n,
				Identifier: ([, name]) =>
					name === from ? identifier(to) : identifier(name),
				BinaryOp: ([, left, operator, right], recurse) =>
					binaryOp(recurse(left), operator, recurse(right)),
				UnaryOp: ([, operator, argument], recurse) =>
					unaryOp(operator, recurse(argument)),
				FunctionCall: ([, name, args], recurse) =>
					functionCall(name, args.map(recurse)),
				Assignment: ([, name, value], recurse) => assign(name, recurse(value)),
				ConditionalExpression: (
					[, condition, consequent, alternate],
					recurse,
				) =>
					conditional(
						recurse(condition),
						recurse(consequent),
						recurse(alternate),
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
				Identifier: ([, name]) => {
					if (name === 'foo') foundFoo = true
					return undefined
				},
			},
			(n, recurse) => {
				if (n[0] === NodeKind.Program) n[1].forEach(recurse)
				else if (n[0] === NodeKind.BinaryOp) {
					recurse(n[1])
					recurse(n[3])
				} else if (n[0] === NodeKind.Assignment) recurse(n[2])
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
					Identifier: ([, name]) => {
						vars.push(name)
						return undefined
					},
				},
				(n, recurse) => {
					if (n[0] === NodeKind.Program) {
						n[1].forEach(recurse)
					} else if (n[0] === NodeKind.BinaryOp) {
						recurse(n[1])
						recurse(n[3])
					} else if (n[0] === NodeKind.UnaryOp) {
						recurse(n[2])
					} else if (n[0] === NodeKind.FunctionCall) {
						n[2].forEach(recurse)
					} else if (n[0] === NodeKind.Assignment) {
						recurse(n[2])
					} else if (n[0] === NodeKind.ConditionalExpression) {
						recurse(n[1])
						recurse(n[2])
						recurse(n[3])
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
