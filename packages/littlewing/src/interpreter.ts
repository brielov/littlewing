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
 * Shared setup for evaluate and evaluateScope.
 *
 * evalNode is defined as a nested function so it captures context, variables,
 * and externalVariables once per run() call — eliminating the per-node closure
 * that a separate top-level function + recurse lambda would require.
 */
function run(
	input: string | ASTNode,
	context: ExecutionContext = {},
): { value: RuntimeValue; variables: Map<string, RuntimeValue> } {
	const node = typeof input === "string" ? parse(input) : input;
	const variables = new Map<string, RuntimeValue>();
	const externalVariables = new Set<string>();
	const vars = context.variables;
	if (vars) {
		for (const key of Object.keys(vars)) {
			variables.set(key, vars[key] as RuntimeValue);
			externalVariables.add(key);
		}
	}

	const value = evalNode(node);
	return { value, variables };

	function evalNode(node: ASTNode): RuntimeValue {
		switch (node.kind) {
			case NodeKind.Program: {
				let result: RuntimeValue = 0;
				for (const statement of node.statements) {
					result = evalNode(statement);
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
				const elems = node.elements;
				const elements: RuntimeValue[] = [];
				for (let i = 0; i < elems.length; i++) {
					elements.push(evalNode(elems[i] as ASTNode));
				}
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
					const left = evalNode(node.left);
					assertBoolean(left, "Operator '&&'", "left");
					if (!left) return false;
					const right = evalNode(node.right);
					assertBoolean(right, "Operator '&&'", "right");
					return right;
				}

				if (node.operator === "||") {
					const left = evalNode(node.left);
					assertBoolean(left, "Operator '||'", "left");
					if (left) return true;
					const right = evalNode(node.right);
					assertBoolean(right, "Operator '||'", "right");
					return right;
				}

				return evaluateBinaryOperation(node.operator, evalNode(node.left), evalNode(node.right));
			}

			case NodeKind.UnaryOp: {
				const arg = evalNode(node.argument);

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

				const nodeArgs = node.args;
				const evaluatedArgs: RuntimeValue[] = [];
				for (let i = 0; i < nodeArgs.length; i++) {
					evaluatedArgs.push(evalNode(nodeArgs[i] as ASTNode));
				}
				return fn(...evaluatedArgs);
			}

			case NodeKind.Assignment: {
				const value = evalNode(node.value);

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
				const condition = evalNode(node.condition);
				assertBoolean(condition, "If condition");
				return condition ? evalNode(node.consequent) : evalNode(node.alternate);
			}

			case NodeKind.IndexAccess: {
				const object = evalNode(node.object);
				const index = evalNode(node.index);

				if (Array.isArray(object)) {
					return resolveIndex(object, index);
				}
				if (typeof object === "string") {
					return resolveIndex(object, index);
				}
				throw new TypeError(`Index access expected array or string, got ${typeOf(object)}`);
			}

			case NodeKind.RangeExpression: {
				const start = evalNode(node.start);
				const end = evalNode(node.end);
				assertNumber(start, "Range start");
				assertNumber(end, "Range end");
				return buildRange(start, end, node.inclusive);
			}

			case NodeKind.PipeExpression: {
				const pipedValue = evalNode(node.value);
				const fn = context.functions?.[node.name];
				if (fn === undefined) {
					throw new Error(`Undefined function: ${node.name}`);
				}
				if (typeof fn !== "function") {
					throw new Error(`${node.name} is not a function`);
				}
				const pipeArgs = node.args;
				const evaluatedArgs: RuntimeValue[] = [];
				for (let i = 0; i < pipeArgs.length; i++) {
					const arg = pipeArgs[i] as ASTNode;
					evaluatedArgs.push(arg.kind === NodeKind.Placeholder ? pipedValue : evalNode(arg));
				}
				return fn(...evaluatedArgs);
			}

			case NodeKind.Placeholder:
				throw new Error("Placeholder outside pipe expression");

			case NodeKind.ForExpression: {
				const iterable = evalNode(node.iterable);

				let iterTarget: Iterable<RuntimeValue>;
				if (Array.isArray(iterable)) {
					iterTarget = iterable;
				} else if (typeof iterable === "string") {
					// Iterate code points directly — avoids Array.from() allocation
					iterTarget = iterable;
				} else {
					throw new TypeError(`For expression expected array or string, got ${typeOf(iterable)}`);
				}

				const previousValue = variables.get(node.variable);
				const hadPreviousValue = variables.has(node.variable);

				// Accumulator mode: reduce/fold
				if (node.accumulator) {
					let acc = evalNode(node.accumulator.initial);
					const prevAcc = variables.get(node.accumulator.name);
					const hadPrevAcc = variables.has(node.accumulator.name);

					for (const item of iterTarget) {
						variables.set(node.variable, item);

						if (node.guard) {
							const guardValue = evalNode(node.guard);
							assertBoolean(guardValue, "For guard");
							if (!guardValue) continue;
						}

						variables.set(node.accumulator.name, acc);
						acc = evalNode(node.body);
					}

					// Restore accumulator variable
					if (hadPrevAcc) {
						variables.set(node.accumulator.name, prevAcc as RuntimeValue);
					} else {
						variables.delete(node.accumulator.name);
					}

					// Restore loop variable
					if (hadPreviousValue) {
						variables.set(node.variable, previousValue as RuntimeValue);
					} else {
						variables.delete(node.variable);
					}
					return acc;
				}

				// Map mode: collect into array
				const result: RuntimeValue[] = [];
				for (const item of iterTarget) {
					variables.set(node.variable, item);

					if (node.guard) {
						const guardValue = evalNode(node.guard);
						assertBoolean(guardValue, "For guard");
						if (!guardValue) continue;
					}

					result.push(evalNode(node.body));
				}

				// Restore loop variable
				if (hadPreviousValue) {
					variables.set(node.variable, previousValue as RuntimeValue);
				} else {
					variables.delete(node.variable);
				}
				validateHomogeneousArray(result);
				return result;
			}
		}
	}
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
