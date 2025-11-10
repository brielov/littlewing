import { describe, expect, test } from 'bun:test'
import type {
	ASTNode,
	Assignment,
	BinaryOp,
	FunctionCall,
	NumberLiteral,
	Program,
} from '../src'
import {
	ast,
	Executor,
	execute,
	isAssignment,
	isBinaryOp,
	isFunctionCall,
	isIdentifier,
	isNumberLiteral,
	isProgram,
	isUnaryOp,
	optimize,
	parseSource,
} from '../src'

describe('Optimizer', () => {
	test('constant folding binary operations', () => {
		const node = optimize(parseSource('2 + 3'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(5)
	})

	test('constant folding with multiplication', () => {
		const node = optimize(parseSource('4 * 5'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(20)
	})

	test('constant folding complex expression', () => {
		const node = optimize(parseSource('2 + 3 * 4'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(14)
	})

	test('constant folding with exponentiation', () => {
		const node = optimize(parseSource('2 ^ 3'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(8)
	})

	test('constant folding unary minus', () => {
		const node = optimize(parseSource('-5'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(-5)
	})

	test('constant folding nested unary and binary', () => {
		const node = optimize(parseSource('-(2 + 3)'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(-5)
	})

	test('does not fold with variables', () => {
		const node = optimize(parseSource('x + 3'))
		// Should remain a binary operation since x is not a literal
		expect(isBinaryOp(node)).toBe(true)
		const binaryNode = node as BinaryOp
		expect(binaryNode.operator).toBe('+')
		expect(binaryNode.left.type).toBe('Identifier')
		// Right side should be optimized
		expect(isNumberLiteral(binaryNode.right)).toBe(true)
	})

	test('partial folding in assignments', () => {
		const node = optimize(parseSource('x = 2 + 3'))
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as Assignment
		expect(assignNode.name).toBe('x')
		// Value should be folded to 5
		expect(isNumberLiteral(assignNode.value)).toBe(true)
		expect((assignNode.value as NumberLiteral).value).toBe(5)
	})

	test('multiple statements with folding', () => {
		const node = optimize(parseSource('x = 5; y = 2 * 3'))
		// With local optimization, variables are NOT propagated or eliminated
		// (they might be overridden by context). Only RHS expressions are folded.
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode.statements.length).toBe(2)
		// Second assignment's RHS should be folded to 6
		const stmt2 = programNode.statements[1]!
		expect(isAssignment(stmt2)).toBe(true)
		expect(isNumberLiteral((stmt2 as Assignment).value)).toBe(true)
		expect(((stmt2 as Assignment).value as NumberLiteral).value).toBe(6)
	})

	test('scientific notation folding', () => {
		const node = optimize(parseSource('1e6 + 2e6'))
		expect(isNumberLiteral(node)).toBe(true)
		expect((node as NumberLiteral).value).toBe(3000000)
	})

	test('manual optimize() function', () => {
		const unoptimized = parseSource('10 * 5')
		const optimized = optimize(unoptimized)
		expect(isNumberLiteral(optimized)).toBe(true)
		expect((optimized as NumberLiteral).value).toBe(50)
	})

	test('execution result same with or without optimization', () => {
		const source = '2 + 3 * 4 - 1'
		const unoptimized = execute(source)
		const optimizedAst = optimize(parseSource(source))
		const executor = new Executor()
		const optimized = executor.execute(optimizedAst)
		expect(optimized).toBe(unoptimized)
		expect(optimized).toBe(13)
	})

	test('division by zero error during folding', () => {
		expect(() => optimize(parseSource('1 / 0'))).toThrow('Division by zero')
	})

	test('modulo by zero error during folding', () => {
		expect(() => optimize(parseSource('10 % 0'))).toThrow('Modulo by zero')
	})

	test('function call arguments are optimized recursively', () => {
		// MAX(2 + 3, 4 * 5) should optimize to MAX(5, 20)
		const node = optimize(parseSource('MAX(2 + 3, 4 * 5)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode.arguments.length).toBe(2)
		// First argument should be folded to 5
		const firstArg = funcNode.arguments[0]!
		expect(isNumberLiteral(firstArg)).toBe(true)
		expect((firstArg as NumberLiteral).value).toBe(5)
		// Second argument should be folded to 20
		const secondArg = funcNode.arguments[1]!
		expect(isNumberLiteral(secondArg)).toBe(true)
		expect((secondArg as NumberLiteral).value).toBe(20)
	})

	test('nested function calls with constant folding', () => {
		// MAX(MIN(10, 5 + 5), 2 ^ 3) should optimize to MAX(MIN(10, 10), 8)
		const node = optimize(parseSource('MAX(MIN(10, 5 + 5), 2 ^ 3)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode.name).toBe('MAX')
		// First arg should be nested function call with optimized args
		const firstArg = funcNode.arguments[0]!
		expect(isFunctionCall(firstArg)).toBe(true)
		const minFunc = firstArg as FunctionCall
		expect(minFunc.name).toBe('MIN')
		const minFirstArg = minFunc.arguments[0]!
		const minSecondArg = minFunc.arguments[1]!
		expect(isNumberLiteral(minFirstArg)).toBe(true)
		expect((minFirstArg as NumberLiteral).value).toBe(10)
		expect(isNumberLiteral(minSecondArg)).toBe(true)
		expect((minSecondArg as NumberLiteral).value).toBe(10)
		// Second arg should be folded to 8
		const secondArg = funcNode.arguments[1]!
		expect(isNumberLiteral(secondArg)).toBe(true)
		expect((secondArg as NumberLiteral).value).toBe(8)
	})

	test('assignment with deeply nested expression', () => {
		// x = -(3 + 4) * 2 should optimize to x = -14
		const node = optimize(parseSource('x = -(3 + 4) * 2'))
		expect(isAssignment(node)).toBe(true)
		const assignNode = node as Assignment
		expect(assignNode.name).toBe('x')
		expect(isNumberLiteral(assignNode.value)).toBe(true)
		expect((assignNode.value as NumberLiteral).value).toBe(-14)
	})

	test('function call with nested unary and binary ops', () => {
		// ABS(-(2 + 3) * 4) should optimize to ABS(-20)
		const node = optimize(parseSource('ABS(-(2 + 3) * 4)'))
		expect(isFunctionCall(node)).toBe(true)
		const funcNode = node as FunctionCall
		expect(funcNode.name).toBe('ABS')
		const arg = funcNode.arguments[0]!
		expect(isNumberLiteral(arg)).toBe(true)
		expect((arg as NumberLiteral).value).toBe(-20)
	})

	test('program with multiple complex statements', () => {
		// Multiple statements with various levels of nesting
		const source = 'a = 2 + 3; b = -(4 * 5); MAX(a, 10 + 10)'
		const node = optimize(parseSource(source))
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// With local optimization:
		// - 'a' assignment RHS is folded to 5, but variable is NOT propagated
		// - 'b' assignment RHS is folded to -20, variable is NOT eliminated
		// - Function call arguments are folded where possible
		expect(programNode.statements.length).toBe(3)

		// First assignment: a = 5 (folded)
		const stmt1 = programNode.statements[0]!
		expect(isAssignment(stmt1)).toBe(true)
		const assign1 = stmt1 as Assignment
		expect(assign1.name).toBe('a')
		expect(isNumberLiteral(assign1.value)).toBe(true)
		expect((assign1.value as NumberLiteral).value).toBe(5)

		// Second assignment: b = -20 (folded)
		const stmt2 = programNode.statements[1]!
		expect(isAssignment(stmt2)).toBe(true)
		const assign2 = stmt2 as Assignment
		expect(assign2.name).toBe('b')
		expect(isNumberLiteral(assign2.value)).toBe(true)
		expect((assign2.value as NumberLiteral).value).toBe(-20)

		// Third statement: function call with second arg folded to 20
		const stmt3 = programNode.statements[2]!
		expect(isFunctionCall(stmt3)).toBe(true)
		const funcCall = stmt3 as FunctionCall
		expect(funcCall.name).toBe('MAX')
		// First arg is identifier 'a' (not propagated)
		const arg1 = funcCall.arguments[0]!
		expect(isIdentifier(arg1)).toBe(true)
		// Second arg should be folded to 20
		const arg2 = funcCall.arguments[1]!
		expect(isNumberLiteral(arg2)).toBe(true)
		expect((arg2 as NumberLiteral).value).toBe(20)
	})

	test('variables not propagated (might be overridden by context)', () => {
		const source = 'x = 5; x + 10'
		const node = optimize(parseSource(source))
		// Variables are NOT propagated because they might be overridden by context
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode.statements.length).toBe(2)
		// Assignment remains
		const stmt0 = programNode.statements[0]!
		expect(isAssignment(stmt0)).toBe(true)
		// Expression remains with identifier
		const stmt1 = programNode.statements[1]!
		expect(isBinaryOp(stmt1)).toBe(true)
	})

	test('execution with context override shows why propagation is unsafe', () => {
		const source = 'x = 5; x + 10'

		// Without context: x = 5, result = 15
		const result1 = execute(source)
		expect(result1).toBe(15)

		// With context override: x = 100 (from context), result = 110
		const result2 = execute(source, { variables: { x: 100 } })
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
		const optimized = optimize(parseSource(source))
		expect(isProgram(optimized)).toBe(true)

		// But execution still works correctly
		const result = execute(source)
		expect(result).toBeCloseTo(1647.01, 2)

		// And context overrides work as expected
		const resultWithOverride = execute(source, {
			variables: { principal: 2000 },
		})
		expect(resultWithOverride).toBeCloseTo(3294.02, 2)
	})

	test('preserves external variables', () => {
		const source = 'x = external + 10; x * 2'
		const node = optimize(parseSource(source))

		// Cannot fully optimize because 'external' is not assigned
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		expect(programNode.statements.length).toBe(2)

		// First statement should still be an assignment
		const stmt1 = programNode.statements[0]!
		expect(isAssignment(stmt1)).toBe(true)

		// Second statement references x, which cannot be inlined
		const stmt2 = programNode.statements[1]!
		expect(isBinaryOp(stmt2)).toBe(true)
	})

	test('mixed constant and external variables', () => {
		const source = 'a = 5; b = external; c = a + b; c'
		const node = optimize(parseSource(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// 'a' can be propagated but 'external' and 'b' cannot
		expect(programNode.statements.length).toBeGreaterThan(1)

		// Verify that we still reference external variable
		const json = JSON.stringify(node)
		expect(json).toContain('external')
	})

	test('function calls prevent full folding', () => {
		const source = 'x = 5; y = NOW(); x + y'
		const node = optimize(parseSource(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// Cannot fully fold because NOW() is a function call
		expect(programNode.statements.length).toBeGreaterThan(1)

		// But 'x' should still be propagated
		const json = JSON.stringify(node)
		expect(json).toContain('NOW')
	})

	test('variable reassignment prevents propagation', () => {
		const source = 'x = 5; x = 10; x'
		const node = optimize(parseSource(source))

		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// Cannot propagate x because it's reassigned
		expect(programNode.statements.length).toBe(3)

		// All three statements should remain
		const stmt1 = programNode.statements[0]!
		const stmt2 = programNode.statements[1]!
		const stmt3 = programNode.statements[2]!
		expect(isAssignment(stmt1)).toBe(true)
		expect(isAssignment(stmt2)).toBe(true)
		expect(isIdentifier(stmt3)).toBe(true)
	})

	test('complex arithmetic preserves variables', () => {
		const source = 'a = 2; b = 3; c = 4; result = a * b + c ^ 2; result'
		const node = optimize(parseSource(source))

		// Variables are not propagated (might be overridden by context)
		expect(isProgram(node)).toBe(true)
		const programNode = node as Program
		// 5 statements: a=2, b=3, c=4, result=..., result
		expect(programNode.statements.length).toBe(5)
		// But we can verify execution still works
		const result = new Executor().execute(node)
		expect(result).toBe(22) // 2 * 3 + 4^2 = 22
	})

	test('execution result unchanged after optimization', () => {
		const source = 'x = 10; y = 20; z = x + y; z * 2'

		const unoptimized = parseSource(source)
		const optimized = optimize(unoptimized)

		const result1 = new Executor().execute(unoptimized)
		const result2 = new Executor().execute(optimized)

		expect(result1).toBe(result2)
		expect(result1).toBe(60)
	})

	test('division by zero caught at execution time', () => {
		const source = 'x = 10; y = 0; x / y'

		// Optimizer doesn't propagate variables, so no error during optimization
		const optimized = optimize(parseSource(source))
		expect(isProgram(optimized)).toBe(true)

		// Error happens during execution
		expect(() => execute(source)).toThrow('Division by zero')
	})

	test('modulo by zero caught at execution time', () => {
		const source = 'x = 10; y = 0; x % y'

		// Optimizer doesn't propagate variables, so no error during optimization
		const optimized = optimize(parseSource(source))
		expect(isProgram(optimized)).toBe(true)

		// Error happens during execution
		expect(() => execute(source)).toThrow('Modulo by zero')
	})

	test('constant folding for ternary (true condition)', () => {
		const ast1 = parseSource('1 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(100)
	})

	test('constant folding for ternary (false condition)', () => {
		const ast1 = parseSource('0 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(50)
	})

	test('ternary with constant comparison', () => {
		const ast1 = parseSource('5 > 3 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(100)

		const ast2 = parseSource('5 < 3 ? 100 : 50')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(50)
	})

	test('complex ternary optimization', () => {
		const source = 'x = 10; y = 5; result = x > y ? 100 : 50; result'
		const ast1 = parseSource(source)
		const optimized = optimize(ast1)
		// Variables are not propagated, structure is preserved
		expect(isProgram(optimized)).toBe(true)
		// But execution still works correctly
		const result = execute(source)
		expect(result).toBe(100)
	})

	test('nested ternary optimization', () => {
		const ast1 = parseSource('1 ? 1 ? 100 : 200 : 300')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(100)
	})

	test('constant folding for comparison operators', () => {
		// Constant comparisons are folded
		const ast1 = parseSource('5 == 5')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(1)

		const ast2 = parseSource('10 < 5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(0)

		// But variables are NOT propagated
		const ast3 = parseSource('x = 10; y = 5; z = x > y; z')
		const optimized3 = optimize(ast3)
		expect(isProgram(optimized3)).toBe(true)
		// Execution still works correctly
		const result = execute('x = 10; y = 5; z = x > y; z')
		expect(result).toBe(1)
	})

	test('constant folding for &&', () => {
		expect(optimize(parseSource('1 && 1'))).toEqual(ast.number(1))
		expect(optimize(parseSource('1 && 0'))).toEqual(ast.number(0))
		expect(optimize(parseSource('0 && 1'))).toEqual(ast.number(0))
		expect(optimize(parseSource('5 && 3'))).toEqual(ast.number(1))
	})

	test('constant folding for ||', () => {
		expect(optimize(parseSource('1 || 1'))).toEqual(ast.number(1))
		expect(optimize(parseSource('1 || 0'))).toEqual(ast.number(1))
		expect(optimize(parseSource('0 || 1'))).toEqual(ast.number(1))
		expect(optimize(parseSource('0 || 0'))).toEqual(ast.number(0))
	})

	test('logical operators with comparisons', () => {
		expect(optimize(parseSource('5 > 3 && 10 > 8'))).toEqual(ast.number(1))
		expect(optimize(parseSource('5 < 3 || 10 > 8'))).toEqual(ast.number(1))
		expect(optimize(parseSource('5 < 3 && 10 < 8'))).toEqual(ast.number(0))
	})

	test('unary operation with variable (cannot fold)', () => {
		// Test unary operation that can't be folded (lines 61, 64-67 in optimizer.ts)
		const ast1 = parseSource('-x')
		const optimized = optimize(ast1)
		// Should still be a unary op because x is a variable, not a literal
		expect(isUnaryOp(optimized)).toBe(true)
		const unaryNode = optimized as { argument: unknown }
		expect(isIdentifier(unaryNode.argument as ASTNode)).toBe(true)
	})

	test('constant folding for logical NOT', () => {
		// !0 should fold to 1
		const ast1 = parseSource('!0')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(1)

		// !5 should fold to 0
		const ast2 = parseSource('!5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(0)

		// !-10 should fold to 0
		const ast3 = parseSource('!-10')
		const optimized3 = optimize(ast3)
		expect(isNumberLiteral(optimized3)).toBe(true)
		expect((optimized3 as NumberLiteral).value).toBe(0)
	})

	test('constant folding for double NOT', () => {
		// !!0 should fold to 0
		const ast1 = parseSource('!!0')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(0)

		// !!5 should fold to 1
		const ast2 = parseSource('!!5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(1)
	})

	test('NOT with variable cannot fold', () => {
		const ast1 = parseSource('!x')
		const optimized = optimize(ast1)
		expect(isUnaryOp(optimized)).toBe(true)
		const unaryNode = optimized as { operator: string; argument: unknown }
		expect(unaryNode.operator).toBe('!')
		expect(isIdentifier(unaryNode.argument as ASTNode)).toBe(true)
	})

	test('NOT with arithmetic folding', () => {
		// !(2 + 3) should fold to !5 then to 0
		const ast1 = parseSource('!(2 + 3)')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(0)

		// !(5 - 5) should fold to !0 then to 1
		const ast2 = parseSource('!(5 - 5)')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(1)
	})

	test('NOT in conditional expression', () => {
		// !0 ? 100 : 50 should fold condition then whole expression to 100
		const ast1 = parseSource('!0 ? 100 : 50')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(100)

		// !5 ? 100 : 50 should fold to 50
		const ast2 = parseSource('!5 ? 100 : 50')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(50)
	})

	test('mixed unary operators', () => {
		// -!5 should fold to -(0) = -0
		const ast1 = parseSource('-!5')
		const optimized1 = optimize(ast1)
		expect(isNumberLiteral(optimized1)).toBe(true)
		expect((optimized1 as NumberLiteral).value).toBe(-0) // -0 is valid (signed zero)

		// !-5 should fold to !(−5) = 0
		const ast2 = parseSource('!-5')
		const optimized2 = optimize(ast2)
		expect(isNumberLiteral(optimized2)).toBe(true)
		expect((optimized2 as NumberLiteral).value).toBe(0)
	})
})
