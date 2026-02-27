import type { ASTNode } from "./ast";
import { NodeKind } from "./ast";
import { parse } from "./parser";
import type { ExecutionContext, RuntimeValue } from "./types";
import {
	assertBoolean,
	assertNumber,
	buildRange,
	evaluateBinaryOperation,
	resolveIndex,
	typeOf,
	validateHomogeneousArray,
} from "./utils";
/**
 * Evaluate an AST node with given context
 */
function evaluateNode(
	node: ASTNode,
	context: ExecutionContext,
	variables: Map<string, RuntimeValue>,
	externalVariables: Set<string>,
): RuntimeValue {
	const recurse = (n: ASTNode): RuntimeValue =>
		evaluateNode(n, context, variables, externalVariables);

	switch (node.kind) {
		case NodeKind.Program: {
			let result: RuntimeValue = 0;
			for (const statement of node.statements) {
				result = recurse(statement);
			}
			return result;
		}

		case NodeKind.NumberLiteral:
			return node.value;

		case NodeKind.StringLiteral:
			return node.value;

		case NodeKind.BooleanLiteral:
			return node.value;

		case NodeKind.ArrayLiteral: {
			const elements = node.elements.map(recurse);
			validateHomogeneousArray(elements);
			return elements;
		}

		case NodeKind.Identifier: {
			const value = variables.get(node.name);
			if (value === undefined) {
				throw new Error(`Undefined variable: ${node.name}`);
			}
			return value;
		}

		case NodeKind.BinaryOp: {
			// Short-circuit && and ||
			if (node.operator === "&&") {
				const left = recurse(node.left);
				assertBoolean(left, "Operator '&&'", "left");
				if (!left) return false;
				const right = recurse(node.right);
				assertBoolean(right, "Operator '&&'", "right");
				return right;
			}

			if (node.operator === "||") {
				const left = recurse(node.left);
				assertBoolean(left, "Operator '||'", "left");
				if (left) return true;
				const right = recurse(node.right);
				assertBoolean(right, "Operator '||'", "right");
				return right;
			}

			const left = recurse(node.left);
			const right = recurse(node.right);
			return evaluateBinaryOperation(node.operator, left, right);
		}

		case NodeKind.UnaryOp: {
			const arg = recurse(node.argument);

			if (node.operator === "-") {
				assertNumber(arg, "Operator '-' (unary)");
				return -arg;
			}

			if (node.operator === "!") {
				assertBoolean(arg, "Operator '!'");
				return !arg;
			}

			throw new Error(`Unknown unary operator: ${String(node.operator)}`);
		}

		case NodeKind.FunctionCall: {
			const fn = context.functions?.[node.name];
			if (fn === undefined) {
				throw new Error(`Undefined function: ${node.name}`);
			}
			if (typeof fn !== "function") {
				throw new Error(`${node.name} is not a function`);
			}

			const evaluatedArgs = node.args.map(recurse);
			return fn(...evaluatedArgs);
		}

		case NodeKind.Assignment: {
			const value = recurse(node.value);

			if (externalVariables.has(node.name)) {
				const externalValue = variables.get(node.name);
				if (externalValue !== undefined) {
					return externalValue;
				}
			}

			variables.set(node.name, value);
			return value;
		}

		case NodeKind.IfExpression: {
			const condition = recurse(node.condition);
			assertBoolean(condition, "If condition");
			return condition ? recurse(node.consequent) : recurse(node.alternate);
		}

		case NodeKind.IndexAccess: {
			const object = recurse(node.object);
			const index = recurse(node.index);

			if (Array.isArray(object)) {
				return resolveIndex(object, index);
			}
			if (typeof object === "string") {
				return resolveIndex(object, index);
			}
			throw new TypeError(`Index access expected array or string, got ${typeOf(object)}`);
		}

		case NodeKind.RangeExpression: {
			const start = recurse(node.start);
			const end = recurse(node.end);
			assertNumber(start, "Range start");
			assertNumber(end, "Range end");
			return buildRange(start, end, node.inclusive);
		}

		case NodeKind.PipeExpression: {
			const pipedValue = recurse(node.value);
			const fn = context.functions?.[node.name];
			if (fn === undefined) {
				throw new Error(`Undefined function: ${node.name}`);
			}
			if (typeof fn !== "function") {
				throw new Error(`${node.name} is not a function`);
			}
			const evaluatedArgs = node.args.map((arg) =>
				arg.kind === NodeKind.Placeholder ? pipedValue : recurse(arg),
			);
			return fn(...evaluatedArgs);
		}

		case NodeKind.Placeholder:
			throw new Error("Placeholder outside pipe expression");

		case NodeKind.ForExpression: {
			const iterable = recurse(node.iterable);

			let items: readonly RuntimeValue[];
			if (Array.isArray(iterable)) {
				items = iterable;
			} else if (typeof iterable === "string") {
				items = Array.from(iterable);
			} else {
				throw new TypeError(`For expression expected array or string, got ${typeOf(iterable)}`);
			}

			const previousValue = variables.get(node.variable);
			const hadPreviousValue = variables.has(node.variable);

			const restoreLoopVar = () => {
				if (hadPreviousValue) {
					variables.set(node.variable, previousValue as RuntimeValue);
				} else {
					variables.delete(node.variable);
				}
			};

			// Accumulator mode: reduce/fold
			if (node.accumulator) {
				let acc = recurse(node.accumulator.initial);
				const prevAcc = variables.get(node.accumulator.name);
				const hadPrevAcc = variables.has(node.accumulator.name);

				for (const item of items) {
					variables.set(node.variable, item);

					if (node.guard) {
						const guardValue = recurse(node.guard);
						assertBoolean(guardValue, "For guard");
						if (!guardValue) continue;
					}

					variables.set(node.accumulator.name, acc);
					acc = recurse(node.body);
				}

				// Restore accumulator variable
				if (hadPrevAcc) {
					variables.set(node.accumulator.name, prevAcc as RuntimeValue);
				} else {
					variables.delete(node.accumulator.name);
				}

				restoreLoopVar();
				return acc;
			}

			// Map mode: collect into array
			const result: RuntimeValue[] = [];
			for (const item of items) {
				variables.set(node.variable, item);

				if (node.guard) {
					const guardValue = recurse(node.guard);
					assertBoolean(guardValue, "For guard");
					if (!guardValue) continue;
				}

				result.push(recurse(node.body));
			}

			restoreLoopVar();
			validateHomogeneousArray(result);
			return result;
		}
	}
}

/**
 * Shared setup for evaluate and evaluateScope.
 */
function run(
	input: string | ASTNode,
	context: ExecutionContext = {},
): { value: RuntimeValue; variables: Map<string, RuntimeValue> } {
	const node = typeof input === "string" ? parse(input) : input;
	const entries = Object.entries(context.variables || {});
	const variables = new Map(entries);
	const externalVariables = new Set(entries.map(([key]) => key));

	const value = evaluateNode(node, context, variables, externalVariables);
	return { value, variables };
}

/**
 * Evaluate source code or AST with given context
 */
export function evaluate(input: string | ASTNode, context: ExecutionContext = {}): RuntimeValue {
	return run(input, context).value;
}

/**
 * Evaluate source code or AST and return the full variable scope.
 */
export function evaluateScope(
	input: string | ASTNode,
	context: ExecutionContext = {},
): Record<string, RuntimeValue> {
	const { variables } = run(input, context);
	return Object.fromEntries(variables);
}
