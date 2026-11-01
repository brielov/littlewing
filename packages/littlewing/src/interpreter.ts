import type {
	ArrayLiteral,
	ASTNode,
	BinaryOp,
	ForExpression,
	FunctionCall,
	Operator,
	PipeExpression,
} from './ast.js';
import { NodeKind } from './ast.js';
import { EvaluationError } from './errors.js';
import { charge, chargeValue, isTrusted, LimitExceededError, setBudget, step } from './limits.js';
import { parse } from './parser.js';
import type { ExecutionContext, ExecutionResult, HostFunction, RuntimeValue } from './types.js';
import {
	assertBoolean,
	assertNumber,
	assertRuntimeValue,
	buildRange,
	deepEquals,
	evaluateBinaryOperation,
	logicalSize,
	resolveIndex,
	toIndexable,
	typeOf,
	validateHomogeneousArray,
} from './utils.js';

/**
 * Default evaluation budget. See `ExecutionLimits.maxSteps`.
 */
export const DEFAULT_MAX_STEPS = 20_000_000;

/**
 * Steps an array costs on top of its elements, for the object itself.
 */
const ARRAY_STEPS = 2;

const AND_CONTEXT = "Operator '&&'";
const OR_CONTEXT = "Operator '||'";

type Bindings = Readonly<Record<string, HostFunction>>;

/**
 * State of one evaluation. Variables live in slots numbered at compile time.
 */
interface Frame {
	/** Tells this evaluation from any other */
	readonly id: number;
	readonly functions: Bindings | undefined;
	readonly slots: (RuntimeValue | undefined)[];
	/** Which slots hold a variable injected by the host, which assignments must not overwrite */
	readonly external: boolean[];
	/** Strings already split for indexing, by slot, once something has been indexed */
	indexable: (readonly string[] | string | undefined)[] | undefined;
	/** The host's variables as they were at the start, if the scope is wanted */
	readonly hostScope: Map<string, RuntimeValue> | undefined;
	/** The node to blame for a failure */
	current: ASTNode | undefined;
}

/**
 * An AST node compiled to a function, so that evaluating it skips the dispatch on
 * its kind. Each closure knows its node, and only touches `frame.current` to fail.
 */
type Code = (frame: Frame) => RuntimeValue;

interface CompilationUnit {
	readonly slots: Map<string, number>;
	/**
	 * Code by node, for an AST from the host, which can share nodes: walking it as a
	 * tree could take exponentially long. What a string parses to is a tree, and skips this.
	 */
	readonly compiled: Map<ASTNode, Code> | undefined;
}

interface CompiledProgram {
	readonly code: Code;
	/** The slot of each variable the program mentions */
	readonly slots: ReadonlyMap<string, number>;
	/** The slots of a new frame */
	readonly emptySlots: readonly (RuntimeValue | undefined)[];
}

function slotOf({ slots }: CompilationUnit, name: string): number {
	let slot = slots.get(name);
	if (slot === undefined) {
		slot = slots.size;
		slots.set(name, slot);
	}
	return slot;
}

/**
 * Bind a slot during evaluation, dropping what was derived from its old value.
 */
function bind(frame: Frame, slot: number, value: RuntimeValue): void {
	frame.slots[slot] = value;
	if (frame.indexable !== undefined) frame.indexable[slot] = undefined;
}

function resolveFunction(name: string, frame: Frame): HostFunction {
	const { functions } = frame;
	if (functions === undefined || !Object.hasOwn(functions, name)) {
		throw new Error(`Undefined function: ${name}`);
	}
	const fn = functions[name];
	if (typeof fn !== 'function') {
		throw new Error(`${name} is not a function`);
	}
	return fn;
}

/**
 * A call site remembers the function it found for the length of one evaluation, so
 * a loop looks a name up once. It keeps a number rather than the frame, which would
 * hold on to the values of the last evaluation for as long as the AST lives.
 */
function createFunctionCache(
	node: FunctionCall | PipeExpression,
): (frame: Frame) => { fn: HostFunction; trusted: boolean } {
	let cachedFor = 0;
	let cached = { fn: undefined as unknown as HostFunction, trusted: false };
	return (frame) => {
		if (frame.id !== cachedFor) {
			const fn = resolveFunction(node.name, frame);
			cached = { fn, trusted: isTrusted(fn) };
			cachedFor = frame.id;
		}
		return cached;
	};
}

function invoke(
	fn: HostFunction,
	trusted: boolean,
	node: FunctionCall | PipeExpression,
	args: RuntimeValue[],
	frame: Frame,
): RuntimeValue {
	frame.current = node;
	if (!trusted) {
		for (const arg of args) {
			// A host function may read its argument in full, aliases and all
			if (Array.isArray(arg)) charge(logicalSize(arg, new Map()));
			else chargeValue(arg);
		}
	}
	const result = fn(...args);
	if (!trusted && typeof result !== 'number' && typeof result !== 'string') {
		if (typeof result !== 'boolean') assertRuntimeValue(result, `Function ${node.name}`);
	}
	return chargeResult(result);
}

/**
 * Finish a call to a trusted function, whose result only needs paying for.
 */
function chargeResult(result: RuntimeValue): RuntimeValue {
	if (typeof result === 'object' || typeof result === 'string') chargeValue(result);
	return result;
}

function compileCall(node: FunctionCall, unit: CompilationUnit): Code {
	const args = node.args.map((arg) => compile(arg, unit));
	const lookup = createFunctionCache(node);
	const [first, second] = args;

	// Most calls take one or two arguments, and a trusted function takes them directly
	if (args.length === 1) {
		const only = first as Code;
		return (frame) => {
			step(frame, node);
			frame.current = node;
			const { fn, trusted } = lookup(frame);
			const a = only(frame);
			if (!trusted) return invoke(fn, false, node, [a], frame);
			frame.current = node;
			return chargeResult(fn(a));
		};
	}
	if (args.length === 2) {
		const left = first as Code;
		const right = second as Code;
		return (frame) => {
			step(frame, node);
			frame.current = node;
			const { fn, trusted } = lookup(frame);
			const a = left(frame);
			const b = right(frame);
			if (!trusted) return invoke(fn, false, node, [a, b], frame);
			frame.current = node;
			return chargeResult(fn(a, b));
		};
	}

	return (frame) => {
		step(frame, node);
		frame.current = node;
		const { fn, trusted } = lookup(frame);
		return invoke(
			fn,
			trusted,
			node,
			args.map((arg) => arg(frame)),
			frame,
		);
	};
}

function compilePipe(node: PipeExpression, unit: CompilationUnit): Code {
	const value = compile(node.value, unit);
	const args = node.args.map((arg) =>
		arg.kind === NodeKind.Placeholder ? undefined : compile(arg, unit),
	);
	const lookup = createFunctionCache(node);
	const [first, second] = args;

	if (args.length === 1 && first === undefined) {
		return (frame) => {
			step(frame, node);
			const piped = value(frame);
			frame.current = node;
			const { fn, trusted } = lookup(frame);
			return trusted ? chargeResult(fn(piped)) : invoke(fn, false, node, [piped], frame);
		};
	}
	if (args.length === 2) {
		return (frame) => {
			step(frame, node);
			const piped = value(frame);
			frame.current = node;
			const { fn, trusted } = lookup(frame);
			const a = first === undefined ? piped : first(frame);
			const b = second === undefined ? piped : second(frame);
			if (!trusted) return invoke(fn, false, node, [a, b], frame);
			frame.current = node;
			return chargeResult(fn(a, b));
		};
	}

	return (frame) => {
		step(frame, node);
		const piped = value(frame);
		frame.current = node;
		const { fn, trusted } = lookup(frame);
		return invoke(
			fn,
			trusted,
			node,
			args.map((arg) => (arg === undefined ? piped : arg(frame))),
			frame,
		);
	};
}

function compileFor(node: ForExpression, unit: CompilationUnit): Code {
	const iterable = compile(node.iterable, unit);
	const initial = node.accumulator && compile(node.accumulator.initial, unit);
	const itemSlot = slotOf(unit, node.variable);
	const totalSlot = node.accumulator && slotOf(unit, node.accumulator.name);
	const guard = node.guard && compile(node.guard, unit);
	const body = compile(node.body, unit);
	const guardNode = node.guard;

	return (frame) => {
		step(frame, node);
		const items = iterable(frame);
		if (!Array.isArray(items) && typeof items !== 'string') {
			frame.current = node;
			throw new TypeError(`For expression expected array or string, got ${typeOf(items)}`);
		}

		let total = initial === null ? undefined : initial(frame);

		// The loop variable and accumulator are locals, so assignments to them must take
		// effect even if the host injected a variable of the same name
		const { external, slots: values } = frame;
		const outerItem = values[itemSlot];
		const itemWasExternal = external[itemSlot] === true;
		if (itemWasExternal) external[itemSlot] = false;
		const outerTotal = totalSlot === null ? undefined : values[totalSlot];
		const totalWasExternal = totalSlot !== null && external[totalSlot] === true;
		if (totalWasExternal) external[totalSlot] = false;

		const results: RuntimeValue[] = [];
		// Strings iterate by code point
		for (const item of items as Iterable<RuntimeValue>) {
			// Iterating a string allocates a string per character
			frame.current = node;
			charge(1);
			bind(frame, itemSlot, item);
			if (totalSlot !== null) bind(frame, totalSlot, total as RuntimeValue);

			if (guard !== null) {
				const keep = guard(frame);
				frame.current = guardNode as ASTNode;
				assertBoolean(keep, 'For guard');
				if (!keep) continue;
			}

			const value = body(frame);
			if (totalSlot === null) {
				results.push(value);
			} else {
				total = value;
			}
		}

		bind(frame, itemSlot, outerItem as RuntimeValue);
		if (itemWasExternal) external[itemSlot] = true;
		if (totalSlot !== null) {
			bind(frame, totalSlot, outerTotal as RuntimeValue);
			if (totalWasExternal) external[totalSlot] = true;
			return total as RuntimeValue;
		}

		frame.current = node;
		validateHomogeneousArray(results);
		charge(ARRAY_STEPS);
		// A pushed array keeps room for 16 more elements
		return results.slice();
	};
}

function compileArray(node: ArrayLiteral, unit: CompilationUnit): Code {
	const elements = node.elements.map((element) => compile(element, unit));
	return (frame) => {
		step(frame, node);
		frame.current = node;
		charge(ARRAY_STEPS);
		// Unlike pushing, which reserves room for 16 more, this sizes the array exactly
		const values = elements.map((element) => element(frame));
		frame.current = node;
		validateHomogeneousArray(values);
		return values;
	};
}

function compileBinary(node: BinaryOp, unit: CompilationUnit): Code {
	const left = compile(node.left, unit);
	const right = compile(node.right, unit);
	const { operator } = node;

	if (operator === '&&' || operator === '||') {
		const context = operator === '&&' ? AND_CONTEXT : OR_CONTEXT;
		const shortCircuit = operator === '||';
		return (frame) => {
			step(frame, node);
			const a = left(frame);
			frame.current = node;
			assertBoolean(a, context, 'left');
			if (a === shortCircuit) return a;
			const b = right(frame);
			frame.current = node;
			assertBoolean(b, context, 'right');
			return b;
		};
	}

	// The common cases on numbers need neither a type check per operator nor a switch
	const slow = (a: RuntimeValue, b: RuntimeValue, frame: Frame): RuntimeValue => {
		frame.current = node;
		return evaluateBinaryOperation(operator, a, b);
	};
	const numeric = (operate: (a: number, b: number) => RuntimeValue): Code => {
		return (frame) => {
			step(frame, node);
			const a = left(frame);
			const b = right(frame);
			return typeof a === 'number' && typeof b === 'number' ? operate(a, b) : slow(a, b, frame);
		};
	};

	switch (operator as Exclude<Operator, '&&' | '||'>) {
		case '+':
			return (frame) => {
				step(frame, node);
				const a = left(frame);
				const b = right(frame);
				return typeof a === 'number' && typeof b === 'number' ? a + b : slow(a, b, frame);
			};
		case '-':
			return (frame) => {
				step(frame, node);
				const a = left(frame);
				const b = right(frame);
				return typeof a === 'number' && typeof b === 'number' ? a - b : slow(a, b, frame);
			};
		case '*':
			return (frame) => {
				step(frame, node);
				const a = left(frame);
				const b = right(frame);
				return typeof a === 'number' && typeof b === 'number' ? a * b : slow(a, b, frame);
			};
		case '<':
			return numeric((a, b) => a < b);
		case '>':
			return numeric((a, b) => a > b);
		case '<=':
			return numeric((a, b) => a <= b);
		case '>=':
			return numeric((a, b) => a >= b);
		case '==':
			return (frame) => {
				step(frame, node);
				const a = left(frame);
				const b = right(frame);
				frame.current = node;
				return deepEquals(a, b);
			};
		default:
			return (frame) => {
				step(frame, node);
				const a = left(frame);
				const b = right(frame);
				return slow(a, b, frame);
			};
	}
}

function compile(node: ASTNode, unit: CompilationUnit): Code {
	if (unit.compiled === undefined) return compileNode(node, unit);

	let code = unit.compiled.get(node);
	if (code === undefined) {
		code = compileNode(node, unit);
		unit.compiled.set(node, code);
	}
	return code;
}

function compileNode(node: ASTNode, unit: CompilationUnit): Code {
	switch (node.kind) {
		case NodeKind.Program: {
			const statements = node.statements.map((statement) => compile(statement, unit));
			return (frame) => {
				step(frame, node);
				let result: RuntimeValue = 0;
				for (const statement of statements) {
					result = statement(frame);
				}
				return result;
			};
		}

		case NodeKind.NumberLiteral:
		case NodeKind.StringLiteral:
		case NodeKind.BooleanLiteral: {
			const { value } = node;
			return (frame) => {
				step(frame, node);
				return value;
			};
		}

		case NodeKind.ArrayLiteral:
			return compileArray(node, unit);

		case NodeKind.Identifier: {
			const slot = slotOf(unit, node.name);
			return (frame) => {
				step(frame, node);
				const value = frame.slots[slot];
				if (value === undefined) {
					frame.current = node;
					throw new Error(`Undefined variable: ${node.name}`);
				}
				return value;
			};
		}

		case NodeKind.BinaryOp:
			return compileBinary(node, unit);

		case NodeKind.UnaryOp: {
			const argument = compile(node.argument, unit);
			if (node.operator === '-') {
				return (frame) => {
					step(frame, node);
					const value = argument(frame);
					frame.current = node;
					assertNumber(value, "Operator '-' (unary)");
					return -value;
				};
			}
			return (frame) => {
				step(frame, node);
				const value = argument(frame);
				frame.current = node;
				assertBoolean(value, "Operator '!'");
				return !value;
			};
		}

		case NodeKind.FunctionCall:
			return compileCall(node, unit);

		case NodeKind.Assignment: {
			const value = compile(node.value, unit);
			const slot = slotOf(unit, node.name);
			return (frame) => {
				step(frame, node);
				const result = value(frame);
				if (frame.external[slot]) {
					return frame.slots[slot] as RuntimeValue;
				}
				bind(frame, slot, result);
				return result;
			};
		}

		case NodeKind.IfExpression: {
			const condition = compile(node.condition, unit);
			const consequent = compile(node.consequent, unit);
			const alternate = compile(node.alternate, unit);
			return (frame) => {
				step(frame, node);
				const test = condition(frame);
				frame.current = node;
				assertBoolean(test, 'If condition');
				return test ? consequent(frame) : alternate(frame);
			};
		}

		case NodeKind.IndexAccess: {
			const object = compile(node.object, unit);
			const index = compile(node.index, unit);
			// A variable splits its string once, as long as nothing writes to it
			const slot = node.object.kind === NodeKind.Identifier ? slotOf(unit, node.object.name) : -1;
			return (frame) => {
				step(frame, node);
				const value = object(frame);
				let target: RuntimeValue = value;
				if (typeof value === 'string') {
					frame.current = node;
					if (slot === -1) {
						target = toIndexable(value);
					} else {
						frame.indexable ??= [];
						target = frame.indexable[slot] ?? toIndexable(value);
						frame.indexable[slot] = target as readonly string[] | string;
					}
				}
				const position = index(frame);
				frame.current = node;
				if (Array.isArray(target) || typeof target === 'string') {
					return resolveIndex(target, position);
				}
				throw new TypeError(`Index access expected array or string, got ${typeOf(value)}`);
			};
		}

		case NodeKind.RangeExpression: {
			const from = compile(node.from, unit);
			const to = compile(node.to, unit);
			const { inclusive } = node;
			return (frame) => {
				step(frame, node);
				const start = from(frame);
				const end = to(frame);
				frame.current = node;
				assertNumber(start, 'Range start');
				assertNumber(end, 'Range end');
				return buildRange(start, end, inclusive);
			};
		}

		case NodeKind.PipeExpression:
			return compilePipe(node, unit);

		case NodeKind.Placeholder:
			return (frame) => {
				step(frame, node);
				frame.current = node;
				throw new Error('Placeholder outside pipe expression');
			};

		case NodeKind.ForExpression:
			return compileFor(node, unit);
	}
}

function compileProgram(node: ASTNode, unit: CompilationUnit): CompiledProgram {
	const code = compile(node, unit);
	// Closures keep the unit reachable, and this has no use after compiling
	unit.compiled?.clear();
	const emptySlots: undefined[] = [];
	while (emptySlots.length < unit.slots.size) emptySlots.push(undefined);
	return { code, slots: unit.slots, emptySlots };
}

/**
 * Compiled programs by AST, so that reusing an AST reuses its code. An AST the host
 * keeps must not change once evaluated, as its nodes are read-only.
 */
const programs = new WeakMap<ASTNode, CompiledProgram>();

/**
 * Compile a program, with failures reported like those of running it. Only an AST
 * can be evaluated again, as nothing else holds on to what a string parsed to.
 */
function prepare(input: string | ASTNode, node: ASTNode): CompiledProgram {
	try {
		if (typeof input === 'string') {
			return compileProgram(node, { slots: new Map(), compiled: undefined });
		}
		let program = programs.get(node);
		if (program === undefined) {
			program = compileProgram(node, { slots: new Map(), compiled: new Map() });
			programs.set(node, program);
		}
		return program;
	} catch (cause) {
		throw new EvaluationError(messageOf(cause), undefined, undefined, { cause });
	}
}

/**
 * Shared by frames that no variable of the host reaches, and so never written to.
 */
const NO_EXTERNALS: boolean[] = [];

let lastFrameId = 0;

function createFrame(
	program: CompiledProgram,
	context: ExecutionContext,
	includeScope: boolean,
): Frame {
	const slots = program.emptySlots.slice();
	const hostScope = includeScope ? new Map<string, RuntimeValue>() : undefined;
	let external = NO_EXTERNALS;

	const injected = context.variables;
	if (injected) {
		for (const name of Object.keys(injected)) {
			const value = injected[name];
			if (value === undefined) continue;
			assertRuntimeValue(value, `Variable ${name}`);
			hostScope?.set(name, value);
			const slot = program.slots.get(name);
			if (slot !== undefined) {
				slots[slot] = value;
				if (external === NO_EXTERNALS) external = [];
				external[slot] = true;
			}
		}
	}

	return {
		id: ++lastFrameId,
		functions: context.functions,
		slots,
		external,
		indexable: undefined,
		hostScope,
		current: undefined,
	};
}

/**
 * Collect the variables of a finished evaluation, the host's own included.
 */
function collectScope(program: CompiledProgram, frame: Frame): Map<string, RuntimeValue> {
	const scope = frame.hostScope as Map<string, RuntimeValue>;
	for (const [name, slot] of program.slots) {
		const value = frame.slots[slot];
		if (value !== undefined) scope.set(name, value);
	}
	return scope;
}

/**
 * Get the text of whatever was thrown, which a host function can make hostile.
 */
function messageOf(cause: unknown): string {
	try {
		return String(cause instanceof Error ? cause.message : cause);
	} catch {
		return 'Unknown error';
	}
}

/**
 * Fail if what the host is about to receive is too large to read. A value can
 * alias itself exponentially, so its size bears no relation to the work done.
 */
function assertReadable(
	value: RuntimeValue,
	program: CompiledProgram,
	frame: Frame,
	includeScope: boolean,
	maxSteps: number,
): void {
	if (!includeScope && typeof value !== 'object' && typeof value !== 'string') return;

	const seen = new Map<RuntimeValue, number>();
	let size = logicalSize(value, seen);
	if (includeScope) {
		for (const slot of program.slots.values()) {
			const bound = frame.slots[slot];
			// Every other variable is read on its own, even if it aliases another
			if (bound !== undefined && !frame.external[slot] && bound !== value) {
				size += logicalSize(bound, seen);
			}
		}
	}
	if (size > maxSteps) {
		throw new LimitExceededError('Evaluation result exceeds the step limit');
	}
}

/**
 * Shared setup for the public evaluation functions.
 */
function run(
	input: string | ASTNode,
	context: ExecutionContext,
	includeScope: boolean,
): { value: RuntimeValue; scope: Map<string, RuntimeValue> | undefined } {
	const maxSteps = context.limits?.maxSteps ?? DEFAULT_MAX_STEPS;
	if (typeof maxSteps !== 'number' || Number.isNaN(maxSteps)) {
		throw new TypeError('limits.maxSteps must be a number');
	}

	const node = typeof input === 'string' ? parse(input) : input;
	const program = prepare(input, node);

	// Validating the host's own values is not work done by the program
	const outerBudget = setBudget(Number.POSITIVE_INFINITY);
	try {
		const frame = createFrame(program, context, includeScope);
		setBudget(maxSteps);
		try {
			const value = program.code(frame);
			frame.current = node;
			assertReadable(value, program, frame, includeScope, maxSteps);
			return { value, scope: includeScope ? collectScope(program, frame) : undefined };
		} catch (cause) {
			throw new EvaluationError(messageOf(cause), frame.current?.start, frame.current?.end, {
				cause,
			});
		}
	} finally {
		setBudget(outerBudget);
	}
}

/**
 * Evaluate source code or AST with given context
 */
export function evaluate(input: string | ASTNode, context: ExecutionContext = {}): RuntimeValue {
	return run(input, context, false).value;
}

/**
 * Evaluate source code or AST and return the full variable scope, which
 * includes variables supplied by the context.
 */
export function evaluateScope(
	input: string | ASTNode,
	context: ExecutionContext = {},
): Record<string, RuntimeValue> {
	return evaluateWithScope(input, context).scope;
}

/**
 * Evaluate source code or AST and return both the result value and full variable scope.
 */
export function evaluateWithScope(
	input: string | ASTNode,
	context: ExecutionContext = {},
): ExecutionResult {
	const { value, scope } = run(input, context, true);
	return { value, scope: Object.fromEntries(scope as Map<string, RuntimeValue>) };
}
