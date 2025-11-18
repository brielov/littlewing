import { describe, expect, test } from 'bun:test'
import { compile } from '../src/jit'
import { parse } from '../src/parser'
import { defaultContext } from '../src/stdlib'

describe('JIT Compiler', () => {
	describe('Regression Tests', () => {
		test('evaluates assignment RHS even when external variable exists (side effects)', () => {
			let callCount = 0
			const expr = compile('x = COUNTER(); x')
			const context = {
				functions: {
					COUNTER: () => {
						callCount++
						return callCount
					},
				},
				variables: { x: 100 },
			}

			// COUNTER() should be called even though x is overridden
			const result = expr.execute(context)
			expect(result).toBe(100) // External x takes precedence
			expect(callCount).toBe(1) // But COUNTER() was still called (side effect)
		})

		test('only initializes variables that are used', () => {
			// Script uses x and y, but external context has z too
			const expr = compile('x + y')
			const source = expr.source

			// Should declare x and y
			expect(source).toContain('let x')
			expect(source).toContain('let y')

			// Should NOT declare z (not used in script)
			expect(source).not.toContain('let z')
		})

		test('handles multiple statements without IIFE overhead', () => {
			const expr = compile('a = 1; b = 2; c = 3; a + b + c')
			const source = expr.source

			// Should use comma operator, not IIFE
			expect(source).not.toContain('function()')
			expect(source).toContain(',') // Comma operator for sequencing
		})

		test('uses comma operator for division by zero check', () => {
			const expr = compile('10 / x')
			const source = expr.source

			// Should not use IIFE
			expect(source).not.toContain('function()')

			// Should use comma operator pattern
			expect(source).toContain('__r')
		})

		test('preserves side effects in nested assignments', () => {
			let xCalls = 0
			let yCalls = 0
			const expr = compile('x = LOGX(); y = LOGY(); x + y')
			const context = {
				functions: {
					LOGX: () => {
						xCalls++
						return xCalls
					},
					LOGY: () => {
						yCalls++
						return yCalls
					},
				},
				variables: { x: 100 }, // Only x is external
			}

			const result = expr.execute(context)

			// x is external so result should be 100 + 1 = 101
			expect(result).toBe(101)

			// Both LOG calls should have happened (side effects preserved)
			expect(xCalls).toBe(1)
			expect(yCalls).toBe(1)
		})
	})

	describe('Basic Compilation', () => {
		test('compiles number literals', () => {
			const expr = compile('42')
			expect(expr.execute()).toBe(42)
		})

		test('compiles decimal numbers', () => {
			const expr = compile('3.14')
			expect(expr.execute()).toBe(3.14)
		})

		test('compiles negative numbers', () => {
			const expr = compile('-10')
			expect(expr.execute()).toBe(-10)
		})

		test('compiles scientific notation', () => {
			const expr = compile('1.5e6')
			expect(expr.execute()).toBe(1500000)
		})

		test('generates valid JavaScript source', () => {
			const expr = compile('2 + 3')
			expect(expr.source).toContain('return')
			expect(typeof expr.source).toBe('string')
		})
	})

	describe('Arithmetic Operations', () => {
		test('compiles addition', () => {
			const expr = compile('2 + 3')
			expect(expr.execute()).toBe(5)
		})

		test('compiles subtraction', () => {
			const expr = compile('10 - 3')
			expect(expr.execute()).toBe(7)
		})

		test('compiles multiplication', () => {
			const expr = compile('4 * 5')
			expect(expr.execute()).toBe(20)
		})

		test('compiles division', () => {
			const expr = compile('20 / 4')
			expect(expr.execute()).toBe(5)
		})

		test('compiles modulo', () => {
			const expr = compile('10 % 3')
			expect(expr.execute()).toBe(1)
		})

		test('compiles exponentiation', () => {
			const expr = compile('2 ^ 8')
			expect(expr.execute()).toBe(256)
		})

		test('handles division by zero', () => {
			// Constant division by zero throws at compile time (optimizer catches it)
			expect(() => compile('10 / 0')).toThrow('Division by zero')

			// Variable division by zero throws at runtime
			const expr = compile('x / y')
			expect(() => expr.execute({ variables: { x: 10, y: 0 } })).toThrow(
				'Division by zero',
			)
		})

		test('handles modulo by zero', () => {
			// Constant modulo by zero throws at compile time (optimizer catches it)
			expect(() => compile('10 % 0')).toThrow('Modulo by zero')

			// Variable modulo by zero throws at runtime
			const expr = compile('x % y')
			expect(() => expr.execute({ variables: { x: 10, y: 0 } })).toThrow(
				'Modulo by zero',
			)
		})

		test('respects operator precedence', () => {
			const expr = compile('2 + 3 * 4')
			expect(expr.execute()).toBe(14)
		})

		test('handles nested operations', () => {
			const expr = compile('(2 + 3) * (4 - 1)')
			expect(expr.execute()).toBe(15)
		})
	})

	describe('Comparison Operations', () => {
		test('compiles equality', () => {
			expect(compile('5 == 5').execute()).toBe(1)
			expect(compile('5 == 3').execute()).toBe(0)
		})

		test('compiles inequality', () => {
			expect(compile('5 != 3').execute()).toBe(1)
			expect(compile('5 != 5').execute()).toBe(0)
		})

		test('compiles less than', () => {
			expect(compile('3 < 5').execute()).toBe(1)
			expect(compile('5 < 3').execute()).toBe(0)
		})

		test('compiles greater than', () => {
			expect(compile('5 > 3').execute()).toBe(1)
			expect(compile('3 > 5').execute()).toBe(0)
		})

		test('compiles less than or equal', () => {
			expect(compile('3 <= 5').execute()).toBe(1)
			expect(compile('5 <= 5').execute()).toBe(1)
			expect(compile('7 <= 5').execute()).toBe(0)
		})

		test('compiles greater than or equal', () => {
			expect(compile('5 >= 3').execute()).toBe(1)
			expect(compile('5 >= 5').execute()).toBe(1)
			expect(compile('3 >= 5').execute()).toBe(0)
		})
	})

	describe('Logical Operations', () => {
		test('compiles logical AND', () => {
			expect(compile('1 && 1').execute()).toBe(1)
			expect(compile('1 && 0').execute()).toBe(0)
			expect(compile('0 && 1').execute()).toBe(0)
			expect(compile('0 && 0').execute()).toBe(0)
		})

		test('compiles logical OR', () => {
			expect(compile('1 || 1').execute()).toBe(1)
			expect(compile('1 || 0').execute()).toBe(1)
			expect(compile('0 || 1').execute()).toBe(1)
			expect(compile('0 || 0').execute()).toBe(0)
		})

		test('compiles logical NOT', () => {
			expect(compile('!0').execute()).toBe(1)
			expect(compile('!1').execute()).toBe(0)
			expect(compile('!5').execute()).toBe(0)
		})

		test('combines logical operators', () => {
			expect(compile('1 && 1 || 0').execute()).toBe(1)
			expect(compile('0 && 1 || 1').execute()).toBe(1)
		})
	})

	describe('Unary Operations', () => {
		test('compiles negation', () => {
			expect(compile('-5').execute()).toBe(-5)
			expect(compile('-(2 + 3)').execute()).toBe(-5)
		})

		test('compiles logical NOT', () => {
			expect(compile('!1').execute()).toBe(0)
			expect(compile('!0').execute()).toBe(1)
		})
	})

	describe('Variables', () => {
		test('compiles variable assignment', () => {
			const expr = compile('x = 10')
			expect(expr.execute()).toBe(10)
		})

		test('compiles variable reference', () => {
			const expr = compile('x = 10; x')
			expect(expr.execute()).toBe(10)
		})

		test('handles multiple assignments', () => {
			const expr = compile('x = 5; y = 10; x + y')
			expect(expr.execute()).toBe(15)
		})

		test('supports external variables', () => {
			const expr = compile('x + y')
			expect(expr.execute({ variables: { x: 10, y: 20 } })).toBe(30)
		})

		test('external variables override assignments', () => {
			const expr = compile('x = 5; x')
			expect(expr.execute({ variables: { x: 100 } })).toBe(100)
		})

		test('throws on undefined variable', () => {
			const expr = compile('x')
			expect(() => expr.execute()).toThrow('Undefined variable: x')
		})

		test('handles complex variable expressions', () => {
			const expr = compile('a = 2; b = 3; c = a * b; d = c + 1; d')
			expect(expr.execute()).toBe(7)
		})
	})

	describe('Function Calls', () => {
		test('compiles built-in math functions', () => {
			expect(compile('ABS(-5)').execute(defaultContext)).toBe(5)
			expect(compile('MIN(3, 1, 4)').execute(defaultContext)).toBe(1)
			expect(compile('MAX(3, 1, 4)').execute(defaultContext)).toBe(4)
		})

		test('compiles nested function calls', () => {
			const expr = compile('ABS(MIN(-5, -10))')
			expect(expr.execute(defaultContext)).toBe(10)
		})

		test('compiles functions with expressions as arguments', () => {
			const expr = compile('MAX(2 + 3, 4 * 2)')
			expect(expr.execute(defaultContext)).toBe(8)
		})

		test('supports custom functions', () => {
			const expr = compile('DOUBLE(5)')
			const context = {
				functions: {
					DOUBLE: (x: number) => x * 2,
				},
			}
			expect(expr.execute(context)).toBe(10)
		})

		test('throws on undefined function', () => {
			const expr = compile('UNKNOWN(5)')
			expect(() => expr.execute()).toThrow('Undefined function: UNKNOWN')
		})

		test('merges custom and default functions', () => {
			const expr = compile('CUSTOM(ABS(-5))')
			const context = {
				...defaultContext,
				functions: {
					...defaultContext.functions,
					CUSTOM: (x: number) => x * 2,
				},
			}
			expect(expr.execute(context)).toBe(10)
		})
	})

	describe('Conditional Expressions', () => {
		test('compiles ternary conditional', () => {
			expect(compile('1 ? 100 : 50').execute()).toBe(100)
			expect(compile('0 ? 100 : 50').execute()).toBe(50)
		})

		test('evaluates condition correctly', () => {
			expect(compile('5 > 3 ? 100 : 50').execute()).toBe(100)
			expect(compile('2 > 5 ? 100 : 50').execute()).toBe(50)
		})

		test('handles nested conditionals', () => {
			const expr = compile('1 ? (1 ? 10 : 20) : 30')
			expect(expr.execute()).toBe(10)
		})

		test('works with variables', () => {
			const expr = compile('x > 10 ? 100 : 50')
			expect(expr.execute({ variables: { x: 15 } })).toBe(100)
			expect(expr.execute({ variables: { x: 5 } })).toBe(50)
		})
	})

	describe('Programs (Multiple Statements)', () => {
		test('executes multiple statements', () => {
			const expr = compile('x = 10; y = 20; z = x + y; z')
			expect(expr.execute()).toBe(30)
		})

		test('returns last statement value', () => {
			const expr = compile('x = 10; y = 20; x + y')
			expect(expr.execute()).toBe(30)
		})

		test('handles complex programs', () => {
			const expr = compile(`
				principal = 1000
				rate = 0.05
				years = 3
				result = principal * ((1 + rate) ^ years)
				result
			`)
			expect(expr.execute()).toBeCloseTo(1157.625, 2)
		})
	})

	describe('AST Input', () => {
		test('accepts pre-parsed AST', () => {
			const ast = parse('2 + 3')
			const expr = compile(ast)
			expect(expr.execute()).toBe(5)
		})

		test('works with complex AST', () => {
			const ast = parse('x = 10; y = x * 2; y + 5')
			const expr = compile(ast)
			expect(expr.execute()).toBe(25)
		})
	})

	describe('Edge Cases', () => {
		test('division by zero throws error', () => {
			// Constant division by zero throws at compile time
			expect(() => compile('0 / 0')).toThrow('Division by zero')
		})

		test('handles Infinity', () => {
			// Constant 1 / 0 throws at compile time
			expect(() => compile('1 / 0')).toThrow('Division by zero')
		})

		test('handles very large numbers', () => {
			const expr = compile('1e308')
			expect(expr.execute()).toBe(1e308)
		})

		test('handles very small numbers', () => {
			const expr = compile('1e-308')
			expect(expr.execute()).toBe(1e-308)
		})

		test('handles decimal shorthand', () => {
			const expr = compile('.5 + .25')
			expect(expr.execute()).toBe(0.75)
		})
	})

	describe('Integration with Interpreter', () => {
		test('produces same results as interpreter for arithmetic', () => {
			const { evaluate } = require('../src/interpreter')
			const source = '2 + 3 * 4 - 5 / 2'
			const compiled = compile(source)
			const interpreted = evaluate(source)
			expect(compiled.execute()).toBe(interpreted)
		})

		test('produces same results for variables', () => {
			const { evaluate } = require('../src/interpreter')
			const source = 'x = 10; y = 20; x * y + 5'
			const compiled = compile(source)
			const interpreted = evaluate(source)
			expect(compiled.execute()).toBe(interpreted)
		})

		test('produces same results with context', () => {
			const { evaluate } = require('../src/interpreter')
			const source = 'x + y'
			const context = { variables: { x: 10, y: 20 } }
			const compiled = compile(source)
			const interpreted = evaluate(source, context)
			expect(compiled.execute(context)).toBe(interpreted)
		})

		test('produces same results for conditionals', () => {
			const { evaluate } = require('../src/interpreter')
			const source = 'x > 10 ? 100 : 50'
			const context1 = { variables: { x: 15 } }
			const context2 = { variables: { x: 5 } }
			const compiled = compile(source)
			expect(compiled.execute(context1)).toBe(evaluate(source, context1))
			expect(compiled.execute(context2)).toBe(evaluate(source, context2))
		})

		test('produces same results with functions', () => {
			const { evaluate } = require('../src/interpreter')
			const source = 'ABS(-5) + MAX(3, 7) + MIN(10, 5)'
			const compiled = compile(source)
			const interpreted = evaluate(source, defaultContext)
			expect(compiled.execute(defaultContext)).toBe(interpreted)
		})
	})

	describe('Variable Initialization Optimization', () => {
		test('literal assignments use ?? operator at initialization', () => {
			const expr = compile('foo = 1; bar = 2; foo + bar')
			const source = expr.source

			// Should use ?? operator for literal assignments
			expect(source).toContain('let foo = __ext.foo ?? 1')
			expect(source).toContain('let bar = __ext.bar ?? 2')

			// Should not have __val assignment for literals
			expect(source).not.toContain('__val = 1')
			expect(source).not.toContain('__val = 2')

			// Execution should work correctly
			expect(expr.execute()).toBe(3)
			expect(expr.execute({ variables: { foo: 100 } })).toBe(102)
		})

		test('non-literal assignments still evaluate side effects', () => {
			let calls = 0
			const expr = compile('x = COUNTER(); y = 2; x + y')
			const context = {
				functions: {
					COUNTER: () => {
						calls++
						return calls
					},
				},
				variables: { x: 100 },
			}

			// y should be optimized (literal)
			expect(expr.source).toContain('let y = __ext.y ?? 2')

			// x should NOT be optimized (has side effects)
			expect(expr.source).toContain('let x = __ext.x')
			expect(expr.source).not.toContain('?? COUNTER')

			// Execute and verify side effect happens
			const result = expr.execute(context)
			expect(result).toBe(102) // x=100 (external) + y=2
			expect(calls).toBe(1) // COUNTER was called
		})

		test('multiple assignments prevent optimization', () => {
			const expr = compile('x = 1; x = 2; x')
			const source = expr.source

			// Multiple assignments to x means no optimization
			expect(source).not.toContain('?? 1')
			expect(source).not.toContain('?? 2')
			expect(source).toContain('let x = __ext.x')

			// Multiple assignments should work correctly
			expect(expr.execute()).toBe(2)

			// External override should still take precedence
			expect(expr.execute({ variables: { x: 100 } })).toBe(100)
		})
	})

	describe('Automatic Optimization', () => {
		test('automatically optimizes constant expressions', () => {
			const expr = compile('2 + 3 * 4')

			// Should be optimized to 14 at compile time
			expect(expr.execute()).toBe(14)

			// Check generated source contains optimized constant
			expect(expr.source).toContain('14')
		})

		test('folds constants before code generation', () => {
			const expr = compile('x = 10; y = 2 + 3; x + y')

			// y = 2 + 3 should be optimized to y = 5
			expect(expr.execute()).toBe(15)

			// Source should contain the folded value
			const source = expr.source
			expect(source).toContain('5') // 2 + 3 folded to 5
		})

		test('removes dead code before compilation', () => {
			const expr = compile('x = 10; y = 20; z = x + 5; z')
			const source = expr.source

			// y is never used, should be eliminated
			expect(source).not.toMatch(/\by\b/)

			// x and z are used
			expect(source).toContain('x')
			expect(source).toContain('z')
		})

		test('optimization preserves external variable semantics', () => {
			const expr = compile('x = 2 + 3; y = x * 2; y')

			// Even though 2 + 3 is constant-folded, x can still be overridden
			const result1 = expr.execute()
			expect(result1).toBe(10) // x = 5, y = 10

			const result2 = expr.execute({ variables: { x: 100 } })
			expect(result2).toBe(200) // x = 100 (external), y = 200
		})

		test('constant division by zero throws at compile time', () => {
			// Constant division by zero should be caught during optimization
			expect(() => compile('10 / 0')).toThrow('Division by zero')
			expect(() => compile('5 % 0')).toThrow('Modulo by zero')
		})

		test('variable division by zero throws at runtime', () => {
			// Non-constant division by zero should throw at runtime
			const expr = compile('x / y')
			expect(() => expr.execute({ variables: { x: 10, y: 0 } })).toThrow(
				'Division by zero',
			)
		})
	})

	describe('Performance Characteristics', () => {
		test('compiles once, executes many times', () => {
			const expr = compile('x * 2 + y')

			// Should be able to execute multiple times
			expect(expr.execute({ variables: { x: 1, y: 2 } })).toBe(4)
			expect(expr.execute({ variables: { x: 5, y: 3 } })).toBe(13)
			expect(expr.execute({ variables: { x: 10, y: 5 } })).toBe(25)
		})

		test('handles repeated execution with different contexts', () => {
			const expr = compile('principal * rate')

			for (let i = 1; i <= 100; i++) {
				const result = expr.execute({
					variables: { principal: 1000 * i, rate: 0.05 },
				})
				expect(result).toBe(1000 * i * 0.05)
			}
		})
	})
})
