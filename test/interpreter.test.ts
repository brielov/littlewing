import { describe, expect, test } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import * as ast from '../src/ast'
import { evaluate, evaluateScope } from '../src/interpreter'
import { parse } from '../src/parser'
import { defaultContext } from '../src/stdlib'

describe('Interpreter', () => {
	test('execute number literal', () => {
		const result = evaluate('42')
		expect(result).toBe(42)
	})

	test('execute simple arithmetic', () => {
		const result = evaluate('2 + 3')
		expect(result).toBe(5)
	})

	test('execute decimal numbers', () => {
		expect(evaluate('0.2')).toBe(0.2)
		expect(evaluate('0.5')).toBe(0.5)
		expect(evaluate('0.999')).toBe(0.999)
	})

	test('execute decimal numbers in expressions', () => {
		expect(evaluate('0.2 + 0.3')).toBeCloseTo(0.5)
		expect(evaluate('0.5 * 2')).toBe(1)
		expect(evaluate('1 - 0.25')).toBe(0.75)
		expect(evaluate('0.1 + 0.2')).toBeCloseTo(0.3)
	})

	test('execute decimal numbers with variables', () => {
		expect(evaluate('x = 0.5; x * 2')).toBe(1)
		expect(evaluate('y = 0.25; y + 0.75')).toBe(1)
	})

	test('execute operator precedence', () => {
		const result = evaluate('2 + 3 * 4')
		expect(result).toBe(14)
	})

	test('execute exponentiation precedence', () => {
		expect(evaluate('2 * 3 ^ 2')).toBe(18) // 2 * 9
		expect(evaluate('2 ^ 3 * 4')).toBe(32) // 8 * 4
		expect(evaluate('(2 + 3) ^ 2')).toBe(25) // 5 ^ 2
	})

	test('execute exponentiation associativity (right-associative)', () => {
		expect(evaluate('2 ^ 3 ^ 2')).toBe(512) // 2 ^ (3 ^ 2)
		expect(evaluate('2 ^ 2 ^ 3')).toBe(256) // 2 ^ (2 ^ 3)
		expect(evaluate('4 ^ 3 ^ 2')).toBe(262144) // 4 ^ (3 ^ 2)

		expect(evaluate('2 ^ 3 ^ 2')).not.toBe(64)

		expect(evaluate('(2 ^ 3) ^ 2')).toBe(64)
		expect(evaluate('(2 ^ 2) ^ 3')).toBe(64)
	})

	test('execute parentheses', () => {
		const result = evaluate('(2 + 3) * 4')
		expect(result).toBe(20)
	})

	test('execute unary minus', () => {
		const result = evaluate('-5')
		expect(result).toBe(-5)
	})

	test('execute unary minus precedence', () => {
		expect(evaluate('5 + -3')).toBe(2)
		expect(evaluate('10 - -5')).toBe(15)
		expect(evaluate('-2 + 3')).toBe(1)

		expect(evaluate('2 * -3')).toBe(-6)
		expect(evaluate('-10 / 2')).toBe(-5)
		expect(evaluate('-2 * -3')).toBe(6)

		// Unary minus binds LOOSER than exponentiation
		expect(evaluate('-2 ^ 2')).toBe(-4) // -(2 ^ 2) = -4
		expect(evaluate('-2 ^ 3')).toBe(-8)
		expect(evaluate('-3 ^ 2')).toBe(-9)

		expect(evaluate('(-2) ^ 2')).toBe(4)
		expect(evaluate('(-2) ^ 3')).toBe(-8)
		expect(evaluate('(-3) ^ 2')).toBe(9)

		expect(evaluate('-2 ^ 2 + 3 * 4')).toBe(8)
		expect(evaluate('10 - 3 * 2 ^ 2 + 1')).toBe(-1)

		expect(evaluate('--5')).toBe(5)
		expect(evaluate('---5')).toBe(-5)
	})

	test('execute all operators', () => {
		expect(evaluate('10 - 3')).toBe(7)
		expect(evaluate('3 * 4')).toBe(12)
		expect(evaluate('10 / 2')).toBe(5)
		expect(evaluate('10 % 3')).toBe(1)
		expect(evaluate('2 ^ 3')).toBe(8)
		expect(evaluate('5 ^ 2')).toBe(25)
	})

	test('execute variable assignment', () => {
		const result = evaluate('x = 5')
		expect(result).toBe(5)
	})

	test('execute variable reference', () => {
		const result = evaluate('x = 5; x')
		expect(result).toBe(5)
	})

	test('execute complex expression with variables', () => {
		const result = evaluate('x = 2; y = 3; z = x + y')
		expect(result).toBe(5)
	})

	test('execute function call without arguments', () => {
		const result = evaluate('NOW()', {
			functions: { NOW: () => 12345 },
		})
		expect(result).toBe(12345)
	})

	test('execute function call with arguments', () => {
		const result = evaluate('ABS(-5)', {
			functions: {
				ABS: (x) => {
					if (typeof x !== 'number') throw new TypeError('expected number')
					return Math.abs(x)
				},
			},
		})
		expect(result).toBe(5)
	})

	test('execute with global variables', () => {
		const result = evaluate('i + 10', {
			variables: { i: 5 },
		})
		expect(result).toBe(15)
	})

	test('execute arithmetic with global variable', () => {
		const result = evaluate('x = i - 10', {
			variables: { i: 25 },
		})
		expect(result).toBe(15)
	})

	test('error on undefined variable', () => {
		expect(() => evaluate('x + 1')).toThrow('Undefined variable: x')
	})

	test('error on undefined function', () => {
		expect(() => evaluate('foo()')).toThrow('Undefined function: foo')
	})

	test('error on division by zero', () => {
		expect(() => evaluate('1 / 0')).toThrow('Division by zero')
	})

	test('error on modulo by zero', () => {
		expect(() => evaluate('10 % 0')).toThrow('Modulo by zero')
	})

	test('floating point arithmetic', () => {
		expect(evaluate('0.1 + 0.2')).toBeCloseTo(0.3)
		expect(evaluate('3.14 * 2')).toBeCloseTo(6.28)
	})
})

describe('Multi-type expressions', () => {
	test('string literals', () => {
		expect(evaluate('"hello"')).toBe('hello')
		expect(evaluate('"hello" + " world"')).toBe('hello world')
	})

	test('boolean literals', () => {
		expect(evaluate('true')).toBe(true)
		expect(evaluate('false')).toBe(false)
	})

	test('array literals', () => {
		expect(evaluate('[1, 2, 3]')).toEqual([1, 2, 3])
		expect(evaluate('["a", "b"]')).toEqual(['a', 'b'])
		expect(evaluate('[]')).toEqual([])
	})

	test('array concatenation', () => {
		expect(evaluate('[1, 2] + [3, 4]')).toEqual([1, 2, 3, 4])
	})

	test('heterogeneous array throws TypeError', () => {
		expect(() => evaluate('[1, "two"]')).toThrow(TypeError)
	})

	test('type errors for invalid operations', () => {
		expect(() => evaluate('"hello" - "world"')).toThrow(TypeError)
		expect(() => evaluate('"hello" * 2')).toThrow(TypeError)
		expect(() => evaluate('true + false')).toThrow(TypeError)
	})
})

describe('evaluate() function accepts string or AST', () => {
	test('evaluate() function accepts string', () => {
		const result = evaluate('2 + 3')
		expect(result).toBe(5)
	})

	test('evaluate() function accepts AST', () => {
		const astNode = parse('2 + 3')
		const result = evaluate(astNode)
		expect(result).toBe(5)
	})

	test('evaluate() with string and context', () => {
		const result = evaluate('x + 5', { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('evaluate() with AST and context', () => {
		const astNode = ast.binaryOp(ast.identifier('x'), '+', ast.number(5))
		const result = evaluate(astNode, { variables: { x: 10 } })
		expect(result).toBe(15)
	})

	test('evaluate() handles complex expressions as string', () => {
		const result = evaluate('x * 2 + 5', { variables: { x: 10 } })
		expect(result).toBe(25)
	})

	test('evaluate() handles complex expressions as AST', () => {
		const astNode = ast.binaryOp(
			ast.binaryOp(ast.identifier('x'), '*', ast.number(2)),
			'+',
			ast.number(5),
		)
		const result = evaluate(astNode, { variables: { x: 10 } })
		expect(result).toBe(25)
	})
})

describe('Logical NOT operator', () => {
	test('execute NOT on boolean', () => {
		expect(evaluate('!true')).toBe(false)
		expect(evaluate('!false')).toBe(true)
	})

	test('execute double NOT', () => {
		expect(evaluate('!!true')).toBe(true)
		expect(evaluate('!!false')).toBe(false)
	})

	test('execute NOT in conditional', () => {
		expect(evaluate('if !false then 100 else 50')).toBe(100)
	})

	test('execute NOT with comparison', () => {
		expect(evaluate('!(5 > 10)')).toBe(true)
		expect(evaluate('!(5 < 10)')).toBe(false)
	})

	test('execute NOT with logical AND', () => {
		expect(evaluate('!false && !false')).toBe(true)
	})

	test('execute NOT with logical OR', () => {
		expect(evaluate('!true || !false')).toBe(true)
	})

	test('execute NOT with boolean variable', () => {
		expect(evaluate('!x', { variables: { x: false } })).toBe(true)
		expect(evaluate('!x', { variables: { x: true } })).toBe(false)
	})

	test('NOT requires boolean operand', () => {
		expect(() => evaluate('!0')).toThrow(TypeError)
		expect(() => evaluate('!5')).toThrow(TypeError)
		expect(() => evaluate('!"hello"')).toThrow(TypeError)
	})
})

describe('If expression', () => {
	test('if with true condition', () => {
		expect(evaluate('if true then 100 else 50')).toBe(100)
	})

	test('if with false condition', () => {
		expect(evaluate('if false then 100 else 50')).toBe(50)
	})

	test('if with comparison', () => {
		expect(evaluate('if 5 > 3 then 100 else 50')).toBe(100)
		expect(evaluate('if 5 < 3 then 100 else 50')).toBe(50)
	})

	test('if requires boolean condition', () => {
		expect(() => evaluate('if 1 then 100 else 50')).toThrow(TypeError)
		expect(() => evaluate('if 0 then 100 else 50')).toThrow(TypeError)
	})

	test('nested if expressions', () => {
		expect(evaluate('if true then if true then 3 else 4 else 5')).toBe(3)
		expect(evaluate('if false then if true then 3 else 4 else 5')).toBe(5)
		expect(evaluate('if true then if false then 3 else 4 else 5')).toBe(4)
	})

	test('if in assignment', () => {
		expect(evaluate('x = if 5 > 3 then 100 else 50; x')).toBe(100)
	})
})

describe('For expression', () => {
	test('basic array iteration', () => {
		expect(evaluate('for x in [1, 2, 3] then x * 2')).toEqual([2, 4, 6])
	})

	test('string iteration', () => {
		expect(evaluate('for c in "abc" then c')).toEqual(['a', 'b', 'c'])
	})

	test('with when guard', () => {
		expect(evaluate('for x in [1, 2, 3, 4, 5] when x > 2 then x')).toEqual([
			3, 4, 5,
		])
	})

	test('with when guard and body transformation', () => {
		expect(evaluate('for x in [1, 2, 3, 4, 5] when x > 2 then x * 10')).toEqual(
			[30, 40, 50],
		)
	})

	test('empty result', () => {
		expect(evaluate('for x in [] then x')).toEqual([])
	})

	test('empty result from guard filtering all', () => {
		expect(evaluate('for x in [1, 2, 3] when false then x')).toEqual([])
	})

	test('iterable must be array or string', () => {
		expect(() => evaluate('for x in 5 then x')).toThrow(TypeError)
		expect(() => evaluate('for x in true then x')).toThrow(TypeError)
	})

	test('guard must be boolean', () => {
		expect(() => evaluate('for x in [1, 2] when x then x')).toThrow(TypeError)
	})

	test('result must be homogeneous', () => {
		expect(() =>
			evaluate('for x in [1, 2] then if x == 1 then "one" else 2'),
		).toThrow(TypeError)
	})

	test('loop variable scoping — restored after loop', () => {
		expect(evaluate('x = 99; for x in [1, 2, 3] then x * 2; x')).toBe(99)
	})

	test('loop variable scoping — deleted if not previously defined', () => {
		expect(() => evaluate('for x in [1, 2, 3] then x * 2; x')).toThrow(
			'Undefined variable: x',
		)
	})

	test('nested for expressions', () => {
		// Flatten [[1,2],[3,4]] would require different semantics,
		// but nesting works for independent iterations
		expect(
			evaluate('for x in [1, 2] then for y in [10, 20] then x + y'),
		).toEqual([
			[11, 21],
			[12, 22],
		])
	})

	test('for with context variables', () => {
		expect(
			evaluate('for x in arr then x + 1', {
				variables: { arr: [10, 20, 30] },
			}),
		).toEqual([11, 21, 31])
	})

	test('for with string produces string array', () => {
		const result = evaluate('for c in "hi" then c + c')
		expect(result).toEqual(['hh', 'ii'])
	})
})

describe('Bracket indexing', () => {
	test('array indexing', () => {
		expect(evaluate('[1, 2, 3][0]')).toBe(1)
		expect(evaluate('[1, 2, 3][2]')).toBe(3)
	})

	test('negative indexing', () => {
		expect(evaluate('[1, 2, 3][-1]')).toBe(3)
		expect(evaluate('[1, 2, 3][-3]')).toBe(1)
	})

	test('string indexing', () => {
		expect(evaluate('"hello"[0]')).toBe('h')
		expect(evaluate('"hello"[4]')).toBe('o')
		expect(evaluate('"hello"[-1]')).toBe('o')
	})

	test('chained indexing', () => {
		expect(evaluate('[[1, 2], [3, 4]][0][1]')).toBe(2)
		expect(evaluate('[[1, 2], [3, 4]][1][0]')).toBe(3)
	})

	test('indexing with variables', () => {
		expect(evaluate('arr = [10, 20, 30]; arr[1]')).toBe(20)
	})

	test('indexing with expression index', () => {
		expect(evaluate('[10, 20, 30][1 + 1]')).toBe(30)
	})

	test('out of bounds throws RangeError', () => {
		expect(() => evaluate('[1, 2, 3][5]')).toThrow(RangeError)
		expect(() => evaluate('[1, 2, 3][-4]')).toThrow(RangeError)
		expect(() => evaluate('"hi"[5]')).toThrow(RangeError)
	})

	test('non-integer index throws TypeError', () => {
		expect(() => evaluate('[1, 2, 3][1.5]')).toThrow(TypeError)
	})

	test('non-number index throws TypeError', () => {
		expect(() => evaluate('[1, 2, 3]["x"]')).toThrow(TypeError)
	})

	test('indexing non-array/string throws TypeError', () => {
		expect(() => evaluate('x = 5; x[0]')).toThrow(TypeError)
		expect(() => evaluate('x = true; x[0]')).toThrow(TypeError)
	})

	test('function call followed by indexing', () => {
		expect(
			evaluate('f()[0]', {
				functions: { f: () => [10, 20, 30] },
			}),
		).toBe(10)
	})
})

describe('Range expressions', () => {
	test('exclusive range', () => {
		expect(evaluate('1..5')).toEqual([1, 2, 3, 4])
	})

	test('inclusive range', () => {
		expect(evaluate('1..=5')).toEqual([1, 2, 3, 4, 5])
	})

	test('single element exclusive range', () => {
		expect(evaluate('1..2')).toEqual([1])
	})

	test('single element inclusive range', () => {
		expect(evaluate('1..=1')).toEqual([1])
	})

	test('empty exclusive range', () => {
		expect(evaluate('5..5')).toEqual([])
	})

	test('start > end throws RangeError', () => {
		expect(() => evaluate('5..3')).toThrow(RangeError)
	})

	test('non-integer start throws TypeError', () => {
		expect(() => evaluate('1.5..5')).toThrow(TypeError)
	})

	test('non-integer end throws TypeError', () => {
		expect(() => evaluate('1..5.5')).toThrow(TypeError)
	})

	test('non-number throws TypeError', () => {
		expect(() => evaluate('x = "a"; x..5')).toThrow(TypeError)
	})

	test('range with for comprehension', () => {
		expect(evaluate('for i in 1..=5 then i * 2')).toEqual([2, 4, 6, 8, 10])
	})

	test('range indexing', () => {
		expect(evaluate('(1..=3)[0]')).toBe(1)
		expect(evaluate('(0..5)[2]')).toBe(2)
	})

	test('range with arithmetic bounds', () => {
		expect(evaluate('(1 + 1)..(3 + 2)')).toEqual([2, 3, 4])
	})
})

describe('evaluateScope', () => {
	test('returns all assigned variables', () => {
		const scope = evaluateScope('x = 10; y = 20')
		expect(scope).toEqual({ x: 10, y: 20 })
	})

	test('returns computed variables', () => {
		const scope = evaluateScope('x = 10; y = x * 2')
		expect(scope).toEqual({ x: 10, y: 20 })
	})

	test('includes context variables in scope', () => {
		const scope = evaluateScope('y = x * 2', { variables: { x: 5 } })
		expect(scope).toEqual({ x: 5, y: 10 })
	})

	test('context variables override script assignments', () => {
		const scope = evaluateScope('x = 10; y = x * 2', { variables: { x: 100 } })
		expect(scope).toEqual({ x: 100, y: 200 })
	})

	test('returns empty object for expression without assignments', () => {
		const scope = evaluateScope('2 + 3')
		expect(scope).toEqual({})
	})

	test('works with function calls', () => {
		const scope = evaluateScope('x = ABS(-5); y = MAX(x, 10)', {
			functions: {
				ABS: (v) => {
					if (typeof v !== 'number') throw new TypeError('expected number')
					return Math.abs(v)
				},
				MAX: (...args) => {
					for (const a of args) {
						if (typeof a !== 'number') throw new TypeError('expected number')
					}
					return Math.max(...(args as number[]))
				},
			},
		})
		expect(scope).toEqual({ x: 5, y: 10 })
	})

	test('works with realistic formula', () => {
		const scope = evaluateScope(
			`
			totalTime = hoursPerWeek * 52
			hoursRecovered = totalTime * efficiencyGain
			valueRecovered = hoursRecovered * hourlyRate
			`,
			{
				variables: {
					hoursPerWeek: 40,
					efficiencyGain: 0.1,
					hourlyRate: 50,
				},
			},
		)
		expect(scope.totalTime).toBe(2080)
		expect(scope.hoursRecovered).toBe(208)
		expect(scope.valueRecovered).toBe(10400)
	})

	test('accepts AST input', () => {
		const node = parse('x = 5; y = x + 1')
		const scope = evaluateScope(node)
		expect(scope).toEqual({ x: 5, y: 6 })
	})

	test('supports multi-type variables in scope', () => {
		const scope = evaluateScope('x = "hello"; y = true; z = [1, 2, 3]')
		expect(scope).toEqual({ x: 'hello', y: true, z: [1, 2, 3] })
	})
})

describe('PlainTime and PlainDateTime integration', () => {
	test('PlainTime in variables', () => {
		const t = new Temporal.PlainTime(14, 30, 0)
		const result = evaluate('t', { variables: { t } })
		expect(result).toBeInstanceOf(Temporal.PlainTime)
	})

	test('PlainDateTime in variables', () => {
		const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 0)
		const result = evaluate('dt', { variables: { dt } })
		expect(result).toBeInstanceOf(Temporal.PlainDateTime)
	})

	test('TYPE() returns "time" for PlainTime', () => {
		const t = new Temporal.PlainTime(10, 0, 0)
		expect(evaluate('TYPE(t)', { ...defaultContext, variables: { t } })).toBe(
			'time',
		)
	})

	test('TYPE() returns "datetime" for PlainDateTime', () => {
		const dt = new Temporal.PlainDateTime(2024, 6, 15, 10, 0, 0)
		expect(evaluate('TYPE(dt)', { ...defaultContext, variables: { dt } })).toBe(
			'datetime',
		)
	})

	test('STR() converts PlainTime to ISO string', () => {
		const t = new Temporal.PlainTime(14, 30, 0)
		const result = evaluate('STR(t)', { ...defaultContext, variables: { t } })
		expect(typeof result).toBe('string')
		expect(result).toBe('14:30:00')
	})

	test('STR() converts PlainDateTime to ISO string', () => {
		const dt = new Temporal.PlainDateTime(2024, 6, 15, 14, 30, 0)
		const result = evaluate('STR(dt)', {
			...defaultContext,
			variables: { dt },
		})
		expect(typeof result).toBe('string')
		expect(result).toBe('2024-06-15T14:30:00')
	})
})
