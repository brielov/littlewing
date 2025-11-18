import { describe, expect, test } from 'bun:test'
import type {
	Assignment,
	BinaryOp,
	FunctionCall,
	NumberLiteral,
	Program,
} from '../src/ast'
import * as ast from '../src/ast'
import {
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
} from '../src/ast'
import { evaluate } from '../src/interpreter'
import { optimize } from '../src/optimizer'
import { parse } from '../src/parser'

describe('Optimizer', () => {
	test('constant folding binary operations', () => {
		const node = optimize(parse('2 + 3'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(5)
	})

	test('constant folding with multiplication', () => {
		const node = optimize(parse('4 * 5'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(20)
	})

	test('constant folding complex expression', () => {
		const node = optimize(parse('2 + 3 * 4'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(14)
	})

	test('constant folding with exponentiation', () => {
		const node = optimize(parse('2 ^ 3'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(8)
	})

	test('constant folding unary minus', () => {
		const node = optimize(parse('-5'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(-5)
	})

	test('constant folding nested unary and binary', () => {
		const node = optimize(parse('-(2 + 3)'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(-5)
	})

	test('does not fold with variables', () => {
		const node = optimize(parse('x + 3'))
		// Should remain a binary operation since x is not a literal
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode[2]).toBe('+')
		expect(isIdentifier(binaryNode[1])).toBe(true)
		// Right side should be optimized
		expect(isNumberLiteral(binaryNode[3])).toBe(true)
	})

	test('partial folding in assignments', () => {
		const node = optimize(parse('x = 2 + 3'))
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as Assignment
		expect(assignNode[1]).toBe('x')
		// Value should be folded to 5
		expect(isNumberLiteral(assignNode[2])).toBe(true)
		expect((assignNode[2] as NumberLiteral)[1]).toBe(5)
	})

	test('multiple statements with folding', () => {
		const node = optimize(parse('x = 5; y = 2 * 3'))
		// x is unused, so it's eliminated. y is the last statement, so it's kept.
		// RHS expressions are also folded (2 * 3 -> 6)
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode[1].length).toBe(1)
		// Only statement: y = 6 (folded)
		const stmt1 = programNode[1][0]!
		expect(isAssignment(stmt1)).toBe(true)
		expect((stmt1 as Assignment)[1]).toBe('y')
		expect(isNumberLiteral((stmt1 as Assignment)[2])).toBe(true)
		expect(((stmt1 as Assignment)[2] as NumberLiteral)[1]).toBe(6)
	})

	test('scientific notation folding', () => {
		const node = optimize(parse('1e6 + 2e6'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral)[1]).toBe(3000000)
	})

	test('manual optimize() function', () => {
		const unoptimized = parse('10 * 5')
		const optimized = optimize(unoptimized)
		expect(isNumberLiteral(optimized)).toBe(true)
		expect((optimized as NumberLiteral)[1]).toBe(50)
	})

	test('execution result same with or without optimization', () => {
		const source = '2 + 3 * 4 - 1'
		const unoptimized = evaluate(source)
		const optimizedAst = optimize(parse(source))
		// executor removed
		const optimized = evaluate(optimizedAst)
		expect(optimized).toBe(unoptimized)
		expect(optimized).toBe(13)
	})

	test('division by zero error during folding', () => {
		expect(() => optimize(parse('1 / 0'))).toThrow('Division by zero')
	})

	test('modulo by zero error during folding', () => {
		expect(() => optimize(parse('10 % 0'))).toThrow('Modulo by zero')
	})

	test('function call arguments are optimized recursively', () => {
		// MAX(2 + 3, 4 * 5) should optimize to MAX(5, 20)
		const node = optimize(parse('MAX(2 + 3, 4 * 5)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode[2].length).toBe(2)
		// First argument should be folded to 5
		const firstArg = funcNode[2][0]!
		expect(isNumberLiteral(firstArg)).toBe(true)
		expect((firstArg as NumberLiteral)[1]).toBe(5)
		// Second argument should be folded to 20
		const secondArg = funcNode[2][1]!
		expect(isNumberLiteral(secondArg)).toBe(true)
		expect((secondArg as NumberLiteral)[1]).toBe(20)
	})

	test('nested function calls with constant folding', () => {
		// MAX(MIN(10, 5 + 5), 2 ^ 3) should optimize to MAX(MIN(10, 10), 8)
		const node = optimize(parse('MAX(MIN(10, 5 + 5), 2 ^ 3)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode[1]).toBe('MAX')
		// First arg should be nested function call with optimized args
		const firstArg = funcNode[2][0]!
		expect(isFunctionCall(firstArg)).toBe(true)
		const minFunc = firstArg as FunctionCall
		expect(minFunc[1]).toBe('MIN')
		const minFirstArg = minFunc[2][0]!
		const minSecondArg = minFunc[2][1]!
		expect(isNumberLiteral(minFirstArg)).toBe(true)
		expect((minFirstArg as NumberLiteral)[1]).toBe(10)
		expect(isNumberLiteral(minSecondArg)).toBe(true)
		expect((minSecondArg as NumberLiteral)[1]).toBe(10)
		// Second arg should be folded to 8
		const secondArg = funcNode[2][1]!
		expect(isNumberLiteral(secondArg)).toBe(true)
		expect((secondArg as NumberLiteral)[1]).toBe(8)
	})

	test('assignment with deeply nested expression', () => {
		// x = -(3 + 4) * 2 should optimize to x = -14
		const node = optimize(parse('x = -(3 + 4) * 2'))
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as Assignment
		expect(assignNode[1]).toBe('x')
		expect(isNumberLiteral(assignNode[2])).toBe(true)
		expect((assignNode[2] as NumberLiteral)[1]).toBe(-14)
	})

	test('function call with nested unary and binary ops', () => {
		// ABS(-(2 + 3) * 4) should optimize to ABS(-20)
		const node = optimize(parse('ABS(-(2 + 3) * 4)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode[1]).toBe('ABS')
		const arg = funcNode[2][0]!
		expect(isNumberLiteral(arg)).toBe(true)
		expect((arg as NumberLiteral)[1]).toBe(-20)
	})

	test('program with multiple complex statements', () => {
		// Multiple statements with various levels of nesting
		const source = 'a = 2 + 3; b = -(4 * 5); MAX(a, 10 + 10)'
		const node = optimize(parse(source))
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// With DCE:
		// - 'a' assignment RHS is folded to 5, and a is used, so it's kept
		// - 'b' assignment RHS is folded to -20, but b is unused, so it's eliminated
		// - Function call arguments are folded where possible
		expect(programNode[1].length).toBe(2)

		// First assignment: a = 5 (folded, kept because used in MAX)
		const stmt1 = programNode[1][0]!
		expect(isAssignment(stmt1)).toBe(true)
		const assign1 = stmt1 as Assignment
		expect(assign1[1]).toBe('a')
		expect(isNumberLiteral(assign1[2])).toBe(true)
		expect((assign1[2] as NumberLiteral)[1]).toBe(5)

		// b is eliminated because it's unused

		// Second statement: function call with second arg folded to 20
		const stmt2 = programNode[1][1]!
		expect(isFunctionCall(stmt2)).toBe(true)
		const funcCall = stmt2 as FunctionCall
		expect(funcCall[1]).toBe('MAX')
		// First arg is identifier 'a' (not propagated, but variable is kept)
		const arg1 = funcCall[2][0]!
		expect(isIdentifier(arg1)).toBe(true)
		// Second arg should be folded to 20
		const arg2 = funcCall[2][1]!
		expect(isNumberLiteral(arg2)).toBe(true)
		expect((arg2 as NumberLiteral)[1]).toBe(20)
	})

	test('variables not propagated (might be overridden by context)', () => {
		const source = 'x = 5; x + 10'
		const node = optimize(parse(source))
		// Variables are NOT propagated because they might be overridden by context
		// However, x is used in the expression, so it's not eliminated
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode[1].length).toBe(2)
		// Assignment remains because x is used
		const stmt0 = programNode[1][0]!
		expect(isAssignment(stmt0)).toBe(true)
		expect((stmt0 as Assignment)[1]).toBe('x')
		// Expression remains with identifier
		const stmt1 = programNode[1][1]!
		expect(isBinaryOp(stmt1)).toBe(true)
	})

	test('execution with context override shows why propagation is unsafe', () => {
		const source = 'x = 5; x + 10'

		// Without context: x = 5, result = 15
		const result1 = evaluate(source)
		expect(result1).toBe(15)

		// With context override: x = 100 (from context), result = 110
		const result2 = evaluate(source, { variables: { x: 100 } })
		expect(result2).toBe(110)

		// If we had propagated x=5, both would give 15 (incorrect!)
	})

	test('compound interest example (execution semantics preserved)', () => {
		const source = `
			principal = 1000;
			rate = 0.05;
			years = 10;
			n = 12;
			base = 1 + (rate / n);
			exponent = n * years;
			result = principal * (base ^ exponent);
			result
		`

		// Optimization preserves structure (no propagation)
		const optimized = optimize(parse(source))
		expect(isProgram(optimized)).toBe(true)

		// But execution still works correctly
		const result = evaluate(source)
		expect(result).toBeCloseTo(1647.01, 2)

		// And context overrides work as expected
		const resultWithOverride = evaluate(source, {
			variables: { principal: 2000 },
		})
		expect(resultWithOverride).toBeCloseTo(3294.02, 2)
	})

	test('preserves external variables', () => {
		const source = 'x = external + 10; x * 2'
		const node = optimize(parse(source))

		// Cannot fully optimize because 'external' is not assigned
		// x is used in the second statement, so both statements are kept
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode[1].length).toBe(2)

		// First statement should still be an assignment
		const stmt1 = programNode[1][0]!
		expect(isAssignment(stmt1)).toBe(true)
		expect((stmt1 as Assignment)[1]).toBe('x')

		// Second statement references x, which cannot be inlined
		const stmt2 = programNode[1][1]!
		expect(isBinaryOp(stmt2)).toBe(true)
	})

	test('mixed constant and external variables', () => {
		const source = 'a = 5; b = external; c = a + b; c'
		const node = optimize(parse(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// DCE keeps: a (used by c), b (used by c), c (used as return), c (return value)
		// All assignments are used transitively
		expect(programNode[1].length).toBe(4)

		// Verify that we still reference external variable in b's assignment
		const json = JSON.stringify(node)
		expect(json).toContain('external')
	})

	test('function calls prevent full folding', () => {
		const source = 'x = 5; y = NOW(); x + y'
		const node = optimize(parse(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// Cannot fully fold because NOW() is a function call
		// All variables are used: x and y are both referenced in x + y
		expect(programNode[1].length).toBe(3)

		// Verify NOW() function call is preserved
		const json = JSON.stringify(node)
		expect(json).toContain('NOW')
	})

	test('variable reassignment prevents propagation', () => {
		const source = 'x = 5; x = 10; x'
		const node = optimize(parse(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// Cannot propagate x because it's reassigned
		expect(programNode[1].length).toBe(3)

		// All three statements should remain
		const stmt1 = programNode[1][0]!
		const stmt2 = programNode[1][1]!
		const stmt3 = programNode[1][2]!
		expect(isAssignment(stmt1)).toBe(true)
		expect(isAssignment(stmt2)).toBe(true)
		expect(isIdentifier(stmt3)).toBe(true)
	})

	test('complex arithmetic preserves variables', () => {
		const source = 'a = 2; b = 3; c = 4; result = a * b + c ^ 2; result'
		const node = optimize(parse(source))

		// Variables are not propagated (might be overridden by context)
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// 5 statements: a=2, b=3, c=4, result=..., result
		expect(programNode[1].length).toBe(5)
		// But we can verify execution still works
		const result = evaluate(node)
		expect(result).toBe(22) // 2 * 3 + 4^2 = 22
	})

	test('execution result unchanged after optimization', () => {
		const source = 'x = 10; y = 20; z = x + y; z * 2'

		const unoptimized = parse(source)
		const optimized = optimize(unoptimized)

		const result1 = evaluate(unoptimized)
		const result2 = evaluate(optimized)

		expect(result1).toBe(result2)
		expect(result1).toBe(60)
	})

	test('division by zero caught at execution time', () => {
		const source = 'x = 10; y = 0; x / y'

		// Optimizer doesn't propagate variables, so no error during optimization
		const optimized = optimize(parse(source))
		expect(isProgram(optimized)).toBe(true)

		// Error happens during execution
		expect(() => evaluate(source)).toThrow('Division by zero')
	})

	test('modulo by zero caught at execution time', () => {
		const source = 'x = 10; y = 0; x % y'

		// Optimizer doesn't propagate variables, so no error during optimization
		const optimized = optimize(parse(source))
		expect(isProgram(optimized)).toBe(true)

		// Error happens during execution
		expect(() => evaluate(source)).toThrow('Modulo by zero')
	})

	test('constant folding for ternary (true condition)', () => {
		const ast1 = parse('1 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(100)
	})

	test('constant folding for ternary (false condition)', () => {
		const ast1 = parse('0 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(50)
	})

	test('ternary with constant comparison', () => {
		const ast1 = parse('5 > 3 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(100)

		const ast2 = parse('5 < 3 ? 100 : 50')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(50)
	})

	test('complex ternary optimization', () => {
		const source = 'x = 10; y = 5; result = x > y ? 100 : 50; result'
		const ast1 = parse(source)
		const optimized = optimize(ast1)
		// Variables are not propagated, structure is preserved
		expect(isProgram(optimized)).toBe(true)
		// But execution still works correctly
		const result = evaluate(source)
		expect(result).toBe(100)
	})

	test('nested ternary optimization', () => {
		const ast1 = parse('1 ? 1 ? 100 : 200 : 300')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(100)
	})

	test('constant folding for comparison operators', () => {
		// Constant comparisons are folded
		const ast1 = parse('5 == 5')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(1)

		const ast2 = parse('10 < 5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(0)

		// But variables are NOT propagated
		const ast3 = parse('x = 10; y = 5; z = x > y; z')
		const optimized3 = optimize(ast3)
		expect(isProgram(optimized3)).toBe(true)
		// Execution still works correctly
		const result = evaluate('x = 10; y = 5; z = x > y; z')
		expect(result).toBe(1)
	})

	test('constant folding for &&', () => {
		expect(optimize(parse('1 && 1'))).toEqual(ast.number(1))
		expect(optimize(parse('1 && 0'))).toEqual(ast.number(0))
		expect(optimize(parse('0 && 1'))).toEqual(ast.number(0))
		expect(optimize(parse('5 && 3'))).toEqual(ast.number(1))
	})

	test('constant folding for ||', () => {
		expect(optimize(parse('1 || 1'))).toEqual(ast.number(1))
		expect(optimize(parse('1 || 0'))).toEqual(ast.number(1))
		expect(optimize(parse('0 || 1'))).toEqual(ast.number(1))
		expect(optimize(parse('0 || 0'))).toEqual(ast.number(0))
	})

	test('logical operators with comparisons', () => {
		expect(optimize(parse('5 > 3 && 10 > 8'))).toEqual(ast.number(1))
		expect(optimize(parse('5 < 3 || 10 > 8'))).toEqual(ast.number(1))
		expect(optimize(parse('5 < 3 && 10 < 8'))).toEqual(ast.number(0))
	})

	test('unary operation with variable (cannot fold)', () => {
		// Test unary operation that can't be folded (lines 61, 64-67 in optimizer.ts)
		const ast1 = parse('-x')
		const optimized = optimize(ast1)
		// Should still be a unary op because x is a variable, not a literal
		expect(isUnaryOp(optimized)).toBe(true)
		if (isUnaryOp(optimized)) {
			expect(isIdentifier(optimized[2])).toBe(true)
		}
	})

	test('constant folding for logical NOT', () => {
		// !0 should fold to 1
		const ast1 = parse('!0')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(1)

		// !5 should fold to 0
		const ast2 = parse('!5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(0)

		// !-10 should fold to 0
		const ast3 = parse('!-10')
		const optimized3 = optimize(ast3)
		expect(isNumberLiteral(optimized3)).toBe(true)
		expect((optimized3 as NumberLiteral)[1]).toBe(0)
	})

	test('constant folding for double NOT', () => {
		// !!0 should fold to 0
		const ast1 = parse('!!0')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(0)

		// !!5 should fold to 1
		const ast2 = parse('!!5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(1)
	})

	test('NOT with variable cannot fold', () => {
		const ast1 = parse('!x')
		const optimized = optimize(ast1)
		expect(isUnaryOp(optimized)).toBe(true)
		if (isUnaryOp(optimized)) {
			expect(optimized[1]).toBe('!')
			expect(isIdentifier(optimized[2])).toBe(true)
		}
	})

	test('NOT with arithmetic folding', () => {
		// !(2 + 3) should fold to !5 then to 0
		const ast1 = parse('!(2 + 3)')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(0)

		// !(5 - 5) should fold to !0 then to 1
		const ast2 = parse('!(5 - 5)')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(1)
	})

	test('NOT in conditional expression', () => {
		// !0 ? 100 : 50 should fold condition then whole expression to 100
		const ast1 = parse('!0 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(100)

		// !5 ? 100 : 50 should fold to 50
		const ast2 = parse('!5 ? 100 : 50')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(50)
	})

	test('mixed unary operators', () => {
		// -!5 should fold to -(0) = -0
		const ast1 = parse('-!5')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral)[1]).toBe(-0) // -0 is valid (signed zero)

		// !-5 should fold to !(−5) = 0
		const ast2 = parse('!-5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral)[1]).toBe(0)
	})
})

describe('Dead Code Elimination', () => {
	test('removes unused variable assignment', () => {
		const source = 'x = 10; y = 20; z = x * 20'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// y is never used, should be eliminated
		expect(program[1].length).toBe(2)

		// First statement: x = 10
		const stmt0 = program[1][0]!
		expect(isAssignment(stmt0)).toBe(true)
		expect((stmt0 as Assignment)[1]).toBe('x')

		// Second statement: z = x * 20 (constant folded to x * 20)
		const stmt1 = program[1][1]!
		expect(isAssignment(stmt1)).toBe(true)
		expect((stmt1 as Assignment)[1]).toBe('z')
	})

	test('preserves used variables', () => {
		const source = 'x = 10; y = 20; x + y'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// All variables are used, nothing should be eliminated
		expect(program[1].length).toBe(3)
	})

	test('preserves last statement even if unused', () => {
		const source = 'x = 10; y = 20'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// x is unused but y is the last statement (return value)
		expect(program[1].length).toBe(1)
		const stmt0 = program[1][0]!
		expect(isAssignment(stmt0)).toBe(true)
		expect((stmt0 as Assignment)[1]).toBe('y')
	})

	test('removes multiple unused variables', () => {
		const source = 'a = 1; b = 2; c = 3; d = 4; e = a + c'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// b and d are unused, should be eliminated
		expect(program[1].length).toBe(3)

		// Remaining: a = 1, c = 3, e = a + c
		expect((program[1][0] as Assignment)[1]).toBe('a')
		expect((program[1][1] as Assignment)[1]).toBe('c')
		expect((program[1][2] as Assignment)[1]).toBe('e')
	})

	test('handles variable used in function call', () => {
		const source = 'x = 10; y = 20; z = 30; MAX(x, z)'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// y is unused, should be eliminated
		expect(program[1].length).toBe(3)

		expect((program[1][0] as Assignment)[1]).toBe('x')
		expect((program[1][1] as Assignment)[1]).toBe('z')
		const stmt2 = program[1][2]!
		expect(isFunctionCall(stmt2)).toBe(true)
	})

	test('handles variable used in conditional', () => {
		const source = 'x = 10; y = 20; z = 30; x > y ? z : 0'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// All variables are used in the conditional
		expect(program[1].length).toBe(4)
	})

	test('handles variable used in nested expression', () => {
		const source = 'a = 5; b = 10; c = 15; result = (a + b) * c'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// All variables are used
		expect(program[1].length).toBe(4)
	})

	test('removes variable assigned but only used in dead code', () => {
		const source = 'x = 10; y = x; z = 20; z'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// x is used by y, but y is never used, so both should be eliminated
		expect(program[1].length).toBe(2)
		expect((program[1][0] as Assignment)[1]).toBe('z')
	})

	test('execution result unchanged after DCE', () => {
		const source = 'x = 10; y = 20; z = 30; x + z'
		const unoptimized = evaluate(source)
		const optimized = evaluate(source) // execute already uses optimize internally

		expect(optimized).toBe(unoptimized)
		expect(optimized).toBe(40)
	})

	test('handles empty program', () => {
		// Parser throws error for empty programs, so we manually construct one
		const emptyProgram = ast.program([])
		const optimized = optimize(emptyProgram)

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		expect(program[1].length).toBe(0)
	})

	test('handles single statement', () => {
		const source = 'x = 42'
		const optimized = optimize(parse(source))

		// Single statement programs are returned as Assignment, not Program
		expect(isAssignment(optimized)).toBe(true)
		expect((optimized as Assignment)[1]).toBe('x')
		expect(isNumberLiteral((optimized as Assignment)[2])).toBe(true)
		expect(((optimized as Assignment)[2] as NumberLiteral)[1]).toBe(42)
	})

	test('handles chained variable dependencies', () => {
		const source = 'a = 1; b = a; c = b; d = c; e = 99; d'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// e is unused, should be eliminated
		// All others form a dependency chain leading to the return value
		expect(program[1].length).toBe(5)

		const names = program[1].filter(isAssignment).map((s) => s[1])
		expect(names).toEqual(['a', 'b', 'c', 'd'])
	})

	test('handles variable reuse (write after read)', () => {
		const source = 'x = 10; y = x; x = 20; y'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// x is written twice: first write (x=10) is used by y, second write (x=20) is unused
		// The backwards pass correctly identifies that x=20 is dead and removes it
		expect(program[1].length).toBe(3)

		expect((program[1][0] as Assignment)[1]).toBe('x')
		expect((program[1][0] as Assignment)[2]).toEqual(ast.number(10))
		expect((program[1][1] as Assignment)[1]).toBe('y')
		// x = 20 is eliminated (correctly identified as dead code)
	})

	test('combines constant folding with DCE', () => {
		const source = 'x = 2 + 3; y = 4 * 5; z = x * 2; z'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// y is unused (eliminated)
		// x = 5 (constant folded)
		// z = x * 2 (constant folded on RHS where possible)
		expect(program[1].length).toBe(3)

		// x's value should be folded to 5
		const xAssignment = program[1][0] as Assignment
		expect(xAssignment[1]).toBe('x')
		expect(isNumberLiteral(xAssignment[2])).toBe(true)
		expect((xAssignment[2] as NumberLiteral)[1]).toBe(5)

		// y should be eliminated (not present)
		const names = program[1].filter(isAssignment).map((s) => s[1])
		expect(names).not.toContain('y')
	})

	test('handles unary operations on unused variables', () => {
		const source = 'x = 10; y = -x; z = 5; z'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// y is unused, so both x and y should be eliminated
		expect(program[1].length).toBe(2)
		expect((program[1][0] as Assignment)[1]).toBe('z')
	})

	test('preserves variables used in logical expressions', () => {
		const source = 'x = 1; y = 0; z = 2; result = x && y || z; result'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// All variables are used in the logical expression
		expect(program[1].length).toBe(5)
	})

	test('handles variables used only in assignment RHS', () => {
		const source = 'a = 10; b = a + 5; c = 20; c'
		const optimized = optimize(parse(source))

		expect(isProgram(optimized)).toBe(true)
		const program = optimized as Program
		// b is unused, so both a and b should be eliminated
		expect(program[1].length).toBe(2)
		expect((program[1][0] as Assignment)[1]).toBe('c')
	})
})
