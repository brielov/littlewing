import type { CheckResult } from '../check/check.js';
import type { Type } from '../check/types.js';
import {
	AbstractTypeRef,
	ArrayType,
	forEachField,
	NUMBER,
	prune,
	RecordType,
	TypeVariable,
} from '../check/types.js';
import type { AbstractDefinition, FunctionDefinition, Signature } from '../define.js';
import type { Diagnostic } from '../diagnostics.js';
import { errorAt } from '../diagnostics.js';
import { EvaluationError } from '../errors.js';
import { charge, LimitExceededError, remainingSteps, step, stepBy } from '../limits.js';
import type { Num } from '../number.js';
import {
	add,
	compare,
	div,
	equals as numbersEqual,
	mod,
	mul,
	neg,
	parseNumber,
	pow,
	sub,
} from '../number.js';
import type {
	Binary,
	Call,
	Expression,
	For,
	Index,
	Member,
	Name,
	Node,
	Program as ProgramNode,
	RecordLiteral,
	Statement,
} from '../syntax/ast.js';
import { logicalSize } from './boundary.js';
import type { Frame, HostCall } from './operations.js';
import { Operations, readIndex } from './operations.js';
import type { RecordValue, Value } from './values.js';
import {
	buildRange,
	callCompare,
	codePoints,
	compareStrings,
	failure,
	newRecord,
	OBJECT_STEPS,
} from './values.js';

/** The largest value a program keeps from folding, as hosts keep programs a long time. */
const MAX_KEPT_SIZE = 1024;

/** How many warnings folding reports. Failures that stop compiling all count. */
const MAX_WARNINGS = 100;

const isSafe = Number.isSafeInteger;

/** An expression compiled to a function, so evaluating it skips the dispatch on its kind. */
export type Code = (frame: Frame) => Value;

interface Constant {
	readonly value: Value;
	/** Whether the program keeps this value, so what reads it needs no code of its own. */
	readonly kept: boolean;
}

interface Compiled {
	readonly code: Code;
	/** Set if the expression is constant: language section 8.2. */
	readonly constant: Constant | undefined;
}

/** Variables of the loops around an expression. */
interface Scope {
	readonly name: string;
	readonly slot: number;
	readonly parent: Scope | undefined;
}

export interface CompiledProgram {
	readonly code: Code;
	/** The slot of each input. */
	readonly inputSlots: ReadonlyMap<string, number>;
	/** The default of each `?=` that is a constant the program kept. */
	readonly defaults: ReadonlyMap<string, Value>;
	readonly diagnostics: readonly Diagnostic[];
}

const ORDER_TESTS = {
	'<': (order: number) => order < 0,
	'>': (order: number) => order > 0,
	'<=': (order: number) => order <= 0,
	'>=': (order: number) => order >= 0,
} as const;

function constantCode(value: Value, node: Node): Code {
	return (frame) => {
		step(frame, node);
		return value;
	};
}

function literal(value: Value, node: Node): Compiled {
	const kept = typeof value !== 'string' || value.length <= MAX_KEPT_SIZE;
	return { code: constantCode(value, node), constant: { value, kept } };
}

/*
 * The closures of literals and calls are built out here. A closure shares the scope
 * it is made in, and a method whose arrows use `this` keeps it in that scope, which
 * would tie every program to the compiler that made it.
 */

function buildArray(node: Node, codes: readonly Code[]): Code {
	return (frame) => {
		stepBy(frame, node, 1 + OBJECT_STEPS + codes.length);
		return codes.map((code) => code(frame));
	};
}

function buildRecord(
	node: Node,
	names: readonly (string | undefined)[],
	codes: readonly Code[],
): Code {
	return (frame) => {
		stepBy(frame, node, 1 + OBJECT_STEPS + codes.length);
		const result = newRecord();
		for (let i = 0; i < codes.length; i++) {
			const name = names[i];
			const value = (codes[i] as Code)(frame);
			if (name !== undefined) {
				result[name] = value;
				continue;
			}
			const operand = value as RecordValue;
			const keys = Object.keys(operand);
			stepBy(frame, node, keys.length);
			for (const key of keys) result[key] = operand[key];
		}
		return result;
	};
}

/** A call, whose first code is the value of its pipe if `piped` says it has one. */
function buildCall(
	node: Node,
	ops: Operations,
	call: HostCall,
	placeholders: readonly boolean[],
	piped: boolean,
	codes: readonly Code[],
): Code {
	const start = piped ? 1 : 0;
	return (frame) => {
		step(frame, node);
		const value = piped ? (codes[0] as Code)(frame) : undefined;
		let next = start;
		const values = placeholders.map((placeholder) =>
			placeholder ? value : (codes[next++] as Code)(frame),
		);
		frame.current = node;
		return ops.invoke(call, values, frame);
	};
}

/** Whether a type holds nothing a folded value could not keep. */
function isPlainType(type: Type, seen: Set<object>): boolean {
	const current = prune(type);
	if (current instanceof ArrayType) {
		if (seen.has(current)) return true;
		seen.add(current);
		charge(1);
		return isPlainType(current.element, seen);
	}
	if (current instanceof RecordType) {
		if (!current.closed) return false;
		if (seen.has(current)) return true;
		seen.add(current);
		charge(1);
		let plain = true;
		forEachField(current, (_, field) => {
			charge(1);
			plain &&= isPlainType(field.type, seen);
		});
		return plain;
	}
	return current.tag === 'number' || current.tag === 'string' || current.tag === 'boolean';
}

/** Whether an operation on a type could run host code, as a generic one can. */
function canReachHost(type: Type, seen: Set<object>): boolean {
	const current = prune(type);
	if (current instanceof AbstractTypeRef || current instanceof TypeVariable) return true;
	if (current instanceof ArrayType) {
		if (seen.has(current)) return false;
		seen.add(current);
		charge(1);
		return canReachHost(current.element, seen);
	}
	if (current instanceof RecordType) {
		if (seen.has(current)) return false;
		seen.add(current);
		charge(1);
		let reaches = false;
		forEachField(current, (_, field) => {
			charge(1);
			reaches ||= canReachHost(field.type, seen);
		});
		return reaches;
	}
	return false;
}

/** The compiled form of a checked program, with everything constant folded on the way. */
export class Compiler {
	private readonly slots = new Map<string, number>();
	private readonly constants = new Map<string, Constant>();
	private readonly diagnostics: Diagnostic[] = [];
	/** Whether a type folds, as a program can ask about one over and over. */
	private readonly foldedTypes = new Map<Type, boolean>();
	private warnings = 0;
	/** False once the compile budget ran out, which only stops folding. */
	private folding = true;
	private slotCount = 0;
	private readonly ops: Operations;
	private readonly foldFrame: Frame = {
		slots: [],
		current: undefined,
		strings: undefined,
		bindings: new Map(),
		metered: true,
	};

	constructor(
		private readonly check: CheckResult,
		private readonly functions: ReadonlyMap<string, FunctionDefinition>,
	) {
		this.ops = new Operations(check.abstracts);
	}

	private newSlot(): number {
		return this.slotCount++;
	}

	private slotOf(name: string): number {
		let slot = this.slots.get(name);
		if (slot === undefined) {
			slot = this.newSlot();
			this.slots.set(name, slot);
		}
		return slot;
	}

	private typeOf(node: Expression): Type | undefined {
		const type = this.check.types.get(node);
		return type === undefined ? undefined : prune(type);
	}

	private keeps(value: Value, type: Type | undefined): boolean {
		if (type === undefined || !isPlainType(type, new Set())) return false;
		const size = logicalSize(value, type, new Map());
		charge(size);
		return size <= MAX_KEPT_SIZE;
	}

	/** Stop folding, as the budget ran out. Anything else thrown is not for here. */
	private stopFolding(error: unknown): void {
		const ranOut =
			error instanceof EvaluationError ||
			error instanceof LimitExceededError ||
			error instanceof RangeError;
		if (!ranOut) throw error;
		this.folding = false;
	}

	/** Whether an operation on a type folds. It does not once folding has stopped. */
	private foldsOn(type: Type | undefined): boolean {
		if (!this.folding || type === undefined) return false;
		const known = this.foldedTypes.get(type);
		if (known !== undefined) return known;
		try {
			const folds = !canReachHost(type, new Set());
			this.foldedTypes.set(type, folds);
			return folds;
		} catch (error) {
			this.stopFolding(error);
			return false;
		}
	}

	/**
	 * Build the closure of an expression from those of its children. If they are all
	 * constant, the same closure runs once on their values, so a fold always does what
	 * the code would.
	 */
	private fold(
		node: Expression,
		skipped: boolean,
		children: readonly Compiled[],
		build: (codes: readonly Code[]) => Code,
		constant = true,
	): Compiled {
		const code = build(children.map((child) => child.code));
		if (!constant || !this.folding) return { code, constant: undefined };

		const values: Code[] = [];
		for (const child of children) {
			if (child.constant === undefined) return { code, constant: undefined };
			const { value } = child.constant;
			values.push(() => value);
		}

		try {
			this.foldFrame.bindings.clear();
			const value = build(values)(this.foldFrame);
			const kept = this.keeps(value, this.typeOf(node));
			return { code: kept ? constantCode(value, node) : code, constant: { value, kept } };
		} catch (error) {
			if (!(error instanceof EvaluationError) || remainingSteps() < 0) this.stopFolding(error);
			else this.report(node, error, skipped);
			return { code, constant: undefined };
		}
	}

	/** A constant expression that fails: language section 8.2. */
	private report(node: Node, error: EvaluationError, skipped: boolean): void {
		const { start, end } = node;
		if (skipped) {
			if (this.warnings++ >= MAX_WARNINGS) return;
		}
		const diagnostic = skipped
			? ({
					code: 'may-fail',
					severity: 'warning',
					message: error.message,
					start,
					end,
				} satisfies Diagnostic)
			: errorAt(error.code, error.message, start, end);
		if (error.cause !== undefined) {
			Object.defineProperty(diagnostic, 'cause', { value: error.cause, enumerable: false });
		}
		this.diagnostics.push(diagnostic);
	}

	private warnCondition(condition: Compiled, node: Node): void {
		if (condition.constant === undefined || this.warnings++ >= MAX_WARNINGS) return;
		const { start, end } = node;
		this.diagnostics.push({
			code: 'constant-condition',
			severity: 'warning',
			message: `This condition is always ${condition.constant.value === true ? 'true' : 'false'}`,
			start,
			end,
		});
	}

	private name(node: Name, scope: Scope | undefined): Compiled {
		for (let current = scope; current !== undefined; current = current.parent) {
			if (current.name === node.name) {
				const { slot } = current;
				return {
					code: (frame) => {
						step(frame, node);
						return frame.slots[slot];
					},
					constant: undefined,
				};
			}
		}

		const constant = this.constants.get(node.name);
		if (constant?.kept === true) {
			return { code: constantCode(constant.value, node), constant };
		}
		const slot = this.slotOf(node.name);
		return {
			code: (frame) => {
				step(frame, node);
				return frame.slots[slot];
			},
			constant,
		};
	}

	private buildBinary(node: Binary, left: Code, right: Code, type: Type | undefined): Code {
		const { ops } = this;
		const isNumber = type === NUMBER;
		const abstract = type instanceof AbstractTypeRef ? type.definition : undefined;

		switch (node.operator) {
			case '&&':
				return (frame) => {
					step(frame, node);
					return left(frame) === false ? false : right(frame);
				};
			case '||':
				return (frame) => {
					step(frame, node);
					return left(frame) === true ? true : right(frame);
				};
			case '+':
				if (isNumber) {
					return (frame) => {
						step(frame, node);
						const a = left(frame);
						const b = right(frame);
						if (typeof a === 'number' && typeof b === 'number') {
							const sum = a + b;
							if (isSafe(sum)) return sum;
						}
						frame.current = node;
						return add(a as Num, b as Num);
					};
				}
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return ops.add(a, b, abstract);
				};
			case '-':
				if (isNumber) {
					return (frame) => {
						step(frame, node);
						const a = left(frame);
						const b = right(frame);
						if (typeof a === 'number' && typeof b === 'number') {
							const difference = a - b;
							if (isSafe(difference)) return difference;
						}
						frame.current = node;
						return sub(a as Num, b as Num);
					};
				}
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return ops.hook(abstract as AbstractDefinition, 'subtract', a, b);
				};
			case '*':
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					if (typeof a === 'number' && typeof b === 'number') {
						const product = a * b;
						// Adding zero makes a negative zero an ordinary one
						if (isSafe(product)) return product + 0;
					}
					frame.current = node;
					return mul(a as Num, b as Num);
				};
			case '/':
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return div(a as Num, b as Num);
				};
			case '%':
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					if (typeof a === 'number' && typeof b === 'number' && b !== 0) return (a % b) + 0;
					frame.current = node;
					return mod(a as Num, b as Num);
				};
			case '^':
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return pow(a as Num, b as Num);
				};
			case '==':
			case '!=': {
				const expected = node.operator === '==';
				if (isNumber) {
					return (frame) => {
						step(frame, node);
						const a = left(frame);
						const b = right(frame);
						if (typeof a === 'number' && typeof b === 'number') return (a === b) === expected;
						return numbersEqual(a as Num, b as Num) === expected;
					};
				}
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return ops.equal(a, b, type) === expected;
				};
			}
			case '<':
			case '>':
			case '<=':
			case '>=': {
				const test = ORDER_TESTS[node.operator];
				if (isNumber) {
					return (frame) => {
						step(frame, node);
						const a = left(frame);
						const b = right(frame);
						if (typeof a === 'number' && typeof b === 'number') return test(a - b);
						frame.current = node;
						return test(compare(a as Num, b as Num));
					};
				}
				return (frame) => {
					step(frame, node);
					const a = left(frame);
					const b = right(frame);
					frame.current = node;
					return test(
						abstract === undefined
							? compareStrings(a as string, b as string)
							: callCompare(abstract, a, b),
					);
				};
			}
		}
	}

	private binary(node: Binary, scope: Scope | undefined, skipped: boolean): Compiled {
		const { operator } = node;
		const shortCircuit = operator === '&&' || operator === '||';
		const left = this.expression(node.left, scope, skipped);
		const right = this.expression(node.right, scope, skipped || shortCircuit);
		const type = this.typeOf(node.left);
		return this.fold(
			node,
			skipped,
			[left, right],
			([first, second]) => this.buildBinary(node, first as Code, second as Code, type),
			shortCircuit || this.foldsOn(type),
		);
	}

	private member(node: Member, scope: Scope | undefined, skipped: boolean): Compiled {
		const { name } = node;
		return this.fold(node, skipped, [this.expression(node.object, scope, skipped)], ([object]) => {
			const read = object as Code;
			return (frame) => {
				step(frame, node);
				const value = (read(frame) as RecordValue)[name];
				if (value === undefined) {
					frame.current = node;
					throw failure('missing-value', `Field ${name.slice(0, 40)} is missing`);
				}
				return value;
			};
		});
	}

	/**
	 * The split of a string in a top-level name, which a loop can index many times.
	 * A name is bound once, so its slot holds one value for a whole evaluation.
	 */
	private splitter(
		node: Index,
		scope: Scope | undefined,
	): (frame: Frame, value: Value) => readonly string[] | string | undefined {
		const object = node.object;
		if (object.kind !== 'name') return () => undefined;
		for (let current = scope; current !== undefined; current = current.parent) {
			if (current.name === object.name) return () => undefined;
		}
		const slot = this.slotOf(object.name);
		return (frame, value) => {
			if (typeof value !== 'string') return undefined;
			frame.strings ??= [];
			const known = frame.strings[slot];
			if (known !== undefined) return known;
			const points = codePoints(value);
			frame.strings[slot] = points;
			return points;
		};
	}

	private index(node: Index, scope: Scope | undefined, skipped: boolean): Compiled {
		const object = this.expression(node.object, scope, skipped);
		const index = this.expression(node.index, scope, skipped);
		const split = this.splitter(node, scope);
		return this.fold(node, skipped, [object, index], ([first, second]) => {
			const read = first as Code;
			const at = second as Code;
			return (frame) => {
				step(frame, node);
				const container = read(frame);
				const position = at(frame);
				frame.current = node;
				const value = readIndex(container, position, split(frame, container));
				if (value === undefined) throw failure('missing-value', 'This index or key is missing');
				return value;
			};
		});
	}

	/** The code of the path of a `??`, in which undefined means a step was missing. */
	private path(node: Expression, scope: Scope | undefined, skipped: boolean): Code {
		if (node.kind === 'member') {
			const object = this.path(node.object, scope, skipped);
			const { name } = node;
			return (frame) => {
				step(frame, node);
				const value = object(frame);
				return value === undefined ? undefined : (value as RecordValue)[name];
			};
		}
		if (node.kind === 'index') {
			const object = this.path(node.object, scope, skipped);
			const index = this.expression(node.index, scope, true).code;
			const split = this.splitter(node, scope);
			return (frame) => {
				step(frame, node);
				const value = object(frame);
				if (value === undefined) return undefined;
				const position = index(frame);
				frame.current = node;
				return readIndex(value, position, split(frame, value));
			};
		}
		return this.expression(node, scope, skipped).code;
	}

	private record(node: RecordLiteral, scope: Scope | undefined, skipped: boolean): Compiled {
		const names = node.members.map((member) => (member.kind === 'field' ? member.name : undefined));
		const members = node.members.map((member) => this.expression(member.value, scope, skipped));
		return this.fold(node, skipped, members, (codes) => buildRecord(node, names, codes));
	}

	private showCall(node: Call, scope: Scope | undefined, skipped: boolean): Compiled {
		const { ops } = this;
		const argument = node.args[0] as Expression;
		const type = this.typeOf(argument);
		return this.fold(
			node,
			skipped,
			[this.expression(argument, scope, skipped)],
			([only]) => {
				const value = only as Code;
				return (frame) => {
					step(frame, node);
					const shown = value(frame);
					frame.current = node;
					return ops.show(shown, type);
				};
			},
			this.foldsOn(type),
		);
	}

	private call(node: Call, scope: Scope | undefined, skipped: boolean): Compiled {
		if (node.core === true) return this.showCall(node, scope, skipped);

		const { ops } = this;
		const definition = this.functions.get(node.name) as FunctionDefinition;
		const piped =
			node.piped === undefined ? undefined : this.expression(node.piped, scope, skipped);

		// A placeholder has no code of its own: the call reads what the pipe gave it
		const placeholders = node.args.map((arg) => arg.kind === 'placeholder');
		const children: Compiled[] = piped === undefined ? [] : [piped];
		for (const arg of node.args) {
			if (arg.kind !== 'placeholder') children.push(this.expression(arg, scope, skipped));
		}

		const call: HostCall = {
			label: node.name.slice(0, 40),
			definition,
			signature: this.check.calls.get(node) as Signature,
			argTypes: node.args.map((arg) =>
				this.typeOf(arg.kind === 'placeholder' ? (node.piped as Expression) : arg),
			),
			result: this.typeOf(node) as Type,
		};
		const isPiped = piped !== undefined;

		return this.fold(
			node,
			skipped,
			children,
			(codes) => buildCall(node, ops, call, placeholders, isPiped, codes),
			definition.pure === true,
		);
	}

	private loop(node: For, scope: Scope | undefined, skipped: boolean): Compiled {
		const iterable = this.expression(node.iterable, scope, skipped).code;
		const { accumulator } = node;
		const initial = accumulator && this.expression(accumulator.initial, scope, skipped).code;

		const itemSlot = this.newSlot();
		let inner: Scope = { name: node.variable, slot: itemSlot, parent: scope };
		const totalSlot = accumulator === null ? -1 : this.newSlot();
		if (accumulator !== null) {
			inner = { name: accumulator.name, slot: totalSlot, parent: inner };
		}

		const guarded = node.guard && this.expression(node.guard, inner, true);
		if (guarded !== null) this.warnCondition(guarded, node.guard as Expression);
		const guard = guarded === null ? null : guarded.code;
		const body = this.expression(node.body, inner, true).code;

		const code: Code = (frame) => {
			step(frame, node);
			const items = iterable(frame);
			const { slots } = frame;
			if (initial !== null) slots[totalSlot] = initial(frame);
			frame.current = node;
			const list = typeof items === 'string' ? codePoints(items) : (items as readonly Value[]);

			const results: Value[] = [];
			for (let i = 0; i < list.length; i++) {
				step(frame, node);
				slots[itemSlot] = list[i];
				if (guard !== null && guard(frame) !== true) continue;
				const value = body(frame);
				if (totalSlot === -1) results.push(value);
				else slots[totalSlot] = value;
			}
			if (totalSlot !== -1) return slots[totalSlot];
			stepBy(frame, node, OBJECT_STEPS);
			return results;
		};
		return { code, constant: undefined };
	}

	private conditional(
		node: Expression & { readonly kind: 'if' },
		scope: Scope | undefined,
		skipped: boolean,
	): Compiled {
		const test = this.expression(node.condition, scope, skipped);
		this.warnCondition(test, node.condition);
		const condition = test.code;
		const consequent = this.expression(node.consequent, scope, true).code;
		const alternate = this.expression(node.alternate, scope, true).code;
		return {
			code: (frame) => {
				step(frame, node);
				return condition(frame) === true ? consequent(frame) : alternate(frame);
			},
			constant: undefined,
		};
	}

	private range(
		node: Expression & { readonly kind: 'range' },
		scope: Scope | undefined,
		skipped: boolean,
	): Compiled {
		const from = this.expression(node.from, scope, skipped);
		const to = this.expression(node.to, scope, skipped);
		return this.fold(node, skipped, [from, to], ([first, second]) => {
			const start = first as Code;
			const end = second as Code;
			return (frame) => {
				step(frame, node);
				const low = start(frame);
				const high = end(frame);
				frame.current = node;
				return buildRange(low as Num, high as Num, node.inclusive);
			};
		});
	}

	private unary(
		node: Expression & { readonly kind: 'unary' },
		scope: Scope | undefined,
		skipped: boolean,
	): Compiled {
		const argument = this.expression(node.argument, scope, skipped);
		return this.fold(node, skipped, [argument], ([only]) => {
			const value = only as Code;
			if (node.operator === '!') {
				return (frame) => {
					step(frame, node);
					return value(frame) !== true;
				};
			}
			return (frame) => {
				step(frame, node);
				const number = value(frame) as Num;
				if (typeof number !== 'number') return neg(number);
				return number === 0 ? 0 : -number;
			};
		});
	}

	private fallback(
		node: Expression & { readonly kind: 'fallback' },
		scope: Scope | undefined,
		skipped: boolean,
	): Compiled {
		const path = this.path(node.path, scope, skipped);
		const fallback = this.expression(node.fallback, scope, true).code;
		return {
			code: (frame) => {
				step(frame, node);
				const value = path(frame);
				return value === undefined ? fallback(frame) : value;
			},
			constant: undefined,
		};
	}

	private array(
		node: Expression & { readonly kind: 'array' },
		scope: Scope | undefined,
		skipped: boolean,
	): Compiled {
		const elements = node.elements.map((element) => this.expression(element, scope, skipped));
		return this.fold(node, skipped, elements, (codes) => buildArray(node, codes));
	}

	private expression(node: Expression, scope: Scope | undefined, skipped: boolean): Compiled {
		switch (node.kind) {
			case 'number':
				return literal(parseNumber(node.text.replaceAll('_', '')) as Num, node);
			case 'string':
			case 'boolean':
				return literal(node.value, node);
			case 'name':
				return this.name(node, scope);
			case 'binary':
				return this.binary(node, scope, skipped);
			case 'unary':
				return this.unary(node, scope, skipped);
			case 'fallback':
				return this.fallback(node, scope, skipped);
			case 'range':
				return this.range(node, scope, skipped);
			case 'array':
				return this.array(node, scope, skipped);
			case 'record':
				return this.record(node, scope, skipped);
			case 'member':
				return this.member(node, scope, skipped);
			case 'index':
				return this.index(node, scope, skipped);
			case 'call':
				return this.call(node, scope, skipped);
			case 'if':
				return this.conditional(node, scope, skipped);
			case 'for':
				return this.loop(node, scope, skipped);
			case 'placeholder':
			case 'pipe':
			case 'template':
				// Desugaring leaves none of these, and a call reads its own placeholders
				throw new TypeError(`Unexpected ${node.kind}`);
		}
	}

	/** The code of a statement, or undefined if everything that reads it has the value. */
	private statement(statement: Statement, defaults: Map<string, Value>): Code | undefined {
		if (statement.kind !== 'binding') return this.expression(statement, undefined, false).code;

		const { name } = statement;
		if (statement.input) {
			const slot = this.slotOf(name);
			const value = this.expression(statement.value, undefined, true);
			if (value.constant?.kept === true) defaults.set(name, value.constant.value);
			const { code } = value;
			return (frame) => {
				const { slots } = frame;
				if (slots[slot] === undefined) slots[slot] = code(frame);
				return undefined;
			};
		}

		const value = this.expression(statement.value, undefined, false);
		if (value.constant !== undefined) this.constants.set(name, value.constant);
		if (value.constant?.kept === true) return undefined;

		const slot = this.slotOf(name);
		const { code } = value;
		return (frame) => {
			frame.slots[slot] = code(frame);
			return undefined;
		};
	}

	compile(program: ProgramNode): CompiledProgram {
		const inputSlots = new Map<string, number>();
		for (const name of this.check.inputTypes.keys()) inputSlots.set(name, this.slotOf(name));

		const defaults = new Map<string, Value>();
		const statements: Code[] = [];
		for (const statement of program.statements) {
			const code = this.statement(statement, defaults);
			if (code !== undefined) statements.push(code);
		}

		// What folding did not keep is dropped here, as hosts keep programs a long time
		this.constants.clear();
		this.foldFrame.slots.length = 0;
		this.foldFrame.strings = undefined;
		this.foldFrame.bindings.clear();

		const code: Code = (frame) => {
			let result: Value;
			for (let i = 0; i < statements.length; i++) result = (statements[i] as Code)(frame);
			return result;
		};
		return { code, inputSlots, defaults, diagnostics: this.diagnostics };
	}
}
