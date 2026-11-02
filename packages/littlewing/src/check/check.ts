import type {
	AbstractDefinition,
	AbstractType,
	FunctionDefinition,
	Signature,
	Type as HostType,
	TypeNode,
} from '../define.js';
import { isOptional, walkType } from '../define.js';
import type { Diagnostic } from '../diagnostics.js';
import { charge } from '../limits.js';
import type {
	Binary,
	Call,
	Expression,
	For,
	Index,
	Node,
	Program,
	RecordLiteral,
} from '../syntax/ast.js';
import type { InputSchema, InputDescription, TypeDescription } from './schema.js';
import { TypeDescriber } from './schema.js';
import type { LiteralMember, SpreadLiteral, WaitingCall } from './solver.js';
import { Solver } from './solver.js';
import type { FieldType, Type } from './types.js';
import {
	ADDABLE,
	ArrayType,
	BOOLEAN,
	closedRecord,
	EQUATABLE,
	ERROR,
	forEachField,
	INDEXABLE,
	NUMBER,
	openRecord,
	ORDERED,
	prune,
	pruneRecord,
	pruneRow,
	RecordType,
	SHOWABLE,
	SIZED,
	STRING,
	SUBTRACTABLE,
	TypeMeter,
	TypeVariable,
} from './types.js';

export interface CheckOptions {
	readonly functions: ReadonlyMap<string, FunctionDefinition>;
	readonly types?: readonly AbstractType[];
	readonly inputs?: Readonly<Record<string, HostType>>;
}

export interface InputType {
	readonly type: Type;
	readonly required: boolean;
}

export interface CheckResult {
	readonly program: Program;
	readonly diagnostics: readonly Diagnostic[];
	/** The inferred type of every expression. */
	readonly types: ReadonlyMap<Expression, Type>;
	/** The signature each call came to. */
	readonly calls: ReadonlyMap<Call, Signature>;
	/** The default of each `?=`, which a later stage can write down if it is a constant. */
	readonly defaults: ReadonlyMap<string, Expression>;
	/** The type of each input, for reading them. */
	readonly inputTypes: ReadonlyMap<string, InputType>;
	/** Every abstract type in reach, which a generic value can belong to. */
	readonly abstracts: readonly AbstractDefinition[];
	readonly outputType: Type;
	readonly inputs: InputSchema;
	readonly output: TypeDescription;
}

/** A variable of a loop in scope. */
interface Scope {
	readonly name: string;
	readonly type: Type;
	readonly parent: Scope | undefined;
}

interface Binding {
	/** The statement that binds it. */
	readonly index: number;
	readonly node: Node;
	type: Type;
	read: boolean;
}

interface Input {
	readonly type: Type;
	required: boolean;
	/** What first read it, or its `?=`. */
	readonly node: Node;
}

class Checker {
	readonly solver: Solver = new Solver();
	readonly types: Map<Expression, Type> = new Map();
	readonly bindings: Map<string, Binding> = new Map();
	readonly inputs: Map<string, Input> = new Map();
	/** Names of loops, which may not be inputs of the program. */
	readonly loopNames: { readonly name: string; readonly node: For }[] = [];
	readonly defaults: Map<string, Expression> = new Map();
	statement: number = 0;

	constructor(private readonly options: CheckOptions) {}

	/** Every abstract type in reach counts toward what a class allows. */
	knownTypes(): void {
		const { functions, types, inputs } = this.options;
		const seen = new Set<object>();
		const collect = (node: TypeNode): void => {
			charge(1);
			if (node.kind === 'abstract') this.solver.abstract(node.definition);
		};
		for (const type of types ?? []) this.solver.abstract(type.definition);
		for (const definition of functions.values()) {
			for (const signature of definition.overloads) {
				for (const arg of signature.args) walkType(arg, seen, collect);
				walkType(signature.returns, seen, collect);
			}
		}
		for (const type of Object.values(inputs ?? {})) walkType(type, seen, collect);
	}

	private note(node: Expression, type: Type): Type {
		this.types.set(node, type);
		return type;
	}

	private lookup(scope: Scope | undefined, name: string): Scope | undefined {
		let current = scope;
		while (current !== undefined) {
			if (current.name === name) return current;
			current = current.parent;
		}
		return undefined;
	}

	/** The type of a name. A read that is not `required` is a step of a path of `??`. */
	private readName(
		node: Expression & { kind: 'name' },
		scope: Scope | undefined,
		required: boolean,
	): Type {
		const { name } = node;
		const loop = this.lookup(scope, name);
		if (loop !== undefined) return loop.type;

		const binding = this.bindings.get(name);
		if (binding !== undefined) {
			binding.read = true;
			if (binding.index >= this.statement) {
				this.solver.report(
					'used-before-binding',
					`${name.slice(0, 40)} is read before it is bound`,
					node,
				);
				return ERROR;
			}
			return binding.type;
		}

		let input = this.inputs.get(name);
		if (input === undefined) {
			input = { type: this.solver.fresh(), required, node };
			this.inputs.set(name, input);
		}
		input.required ||= required;
		return input.type;
	}

	/** `e[i]`, which is a field read if the index is a string literal. */
	private indexType(node: Index, object: Type, scope: Scope | undefined, required: boolean): Type {
		const { solver } = this;
		const { index } = node;
		if (index.kind === 'string') {
			this.note(index, STRING);
			return solver.readField(object, index.value, required, node);
		}

		const indexType = this.typeOf(index, scope);
		if (!solver.require(object, INDEXABLE, node, 'This is indexed')) return ERROR;
		const shared = prune(object);
		const element =
			shared instanceof TypeVariable ? solver.container(shared, node.start, node) : solver.fresh();
		solver.solveIndex(object, indexType, element, node);
		return element;
	}

	/** The type of the path of a `??`, whose steps can all be missing. */
	private pathType(node: Expression, scope: Scope | undefined): Type {
		switch (node.kind) {
			case 'name':
				return this.note(node, this.readName(node, scope, false));
			case 'member':
				return this.note(
					node,
					this.solver.readField(this.pathType(node.object, scope), node.name, false, node),
				);
			case 'index':
				return this.note(
					node,
					this.indexType(node, this.pathType(node.object, scope), scope, false),
				);
			default:
				return this.typeOf(node, scope);
		}
	}

	private binaryType(node: Binary, scope: Scope | undefined): Type {
		const { solver } = this;
		const left = this.typeOf(node.left, scope);
		const right = this.typeOf(node.right, scope);
		const expect = (type: Type, expected: Type, side: Expression): void => {
			solver.unify(type, expected, side);
		};
		// Operands that are not one type are the whole mistake
		const same = (): boolean => {
			const errors = solver.errors.length;
			solver.unify(left, right, node);
			return solver.errors.length === errors;
		};

		switch (node.operator) {
			case '+':
				if (same()) solver.require(left, ADDABLE, node, '+ needs operands it can add');
				return left;
			case '-':
				if (same()) solver.require(left, SUBTRACTABLE, node, '- needs operands it can subtract');
				return left;
			case '*':
			case '/':
			case '%':
			case '^':
				expect(left, NUMBER, node.left);
				expect(right, NUMBER, node.right);
				return NUMBER;
			case '==':
			case '!=':
				if (same())
					solver.require(left, EQUATABLE, node, 'Comparing needs values that have equality');
				return BOOLEAN;
			case '<':
			case '>':
			case '<=':
			case '>=':
				if (same()) solver.require(left, ORDERED, node, 'Ordering needs values that have an order');
				return BOOLEAN;
			case '&&':
			case '||':
				expect(left, BOOLEAN, node.left);
				expect(right, BOOLEAN, node.right);
				return BOOLEAN;
		}
	}

	private callType(node: Call, scope: Scope | undefined): Type {
		const { solver } = this;
		if (node.core === true) {
			const value = this.typeOf(node.args[0] as Expression, scope);
			solver.require(value, SHOWABLE, node, 'Interpolation needs a value it can write');
			return STRING;
		}

		const piped = node.piped === undefined ? undefined : this.typeOf(node.piped, scope);
		const args = node.args.map((arg) => {
			if (arg.kind === 'placeholder' && piped !== undefined) return this.note(arg, piped);
			return this.typeOf(arg, scope);
		});

		const definition = this.options.functions.get(node.name);
		if (definition === undefined) {
			solver.report('unknown-function', `Unknown function ${node.name.slice(0, 40)}`, node);
			return ERROR;
		}

		const count = args.length;
		const overloads = definition.overloads.filter((signature) => {
			const required = signature.args.filter((arg) => !isOptional(arg)).length;
			return count >= required && count <= signature.args.length;
		});
		if (overloads.length === 0) {
			const message = `${node.name.slice(0, 40)} does not take ${count} arguments`;
			solver.report('wrong-argument-count', message, node);
			return ERROR;
		}

		const call: WaitingCall = {
			node,
			order: node.stepStart ?? node.start,
			overloads,
			args,
			argNodes: node.args,
			result: solver.fresh(),
			done: false,
		};
		if (overloads.length === 1) solver.commit(call, overloads[0] as Signature);
		else solver.calls.push(call);
		return call.result;
	}

	private recordType(node: RecordLiteral, scope: Scope | undefined): Type {
		const { solver } = this;
		const members: LiteralMember[] = [];
		let spreads = false;
		let failed = false;

		for (const member of node.members) {
			const type = this.typeOf(member.value, scope);
			if (member.kind === 'field') {
				members.push({ kind: 'field', name: member.name, type, node: member });
			} else {
				spreads = true;
				const operand = solver.operandRecord(type, member);
				failed ||= operand === undefined;
				members.push({ kind: 'spread', type: operand ?? ERROR, node: member });
			}
		}

		if (!spreads) {
			const fields = new Map<string, FieldType>();
			for (const member of members) {
				if (member.kind === 'field') fields.set(member.name, { type: member.type, required: true });
			}
			return closedRecord(fields);
		}
		if (failed) return ERROR;

		const result = openRecord();
		result.pending = [];
		const literal: SpreadLiteral = { node, order: node.start, members, result, done: false };
		solver.spreads.push(literal);
		solver.watchSpread(literal);
		return result;
	}

	private checkLoopName(name: string, node: For, scope: Scope | undefined): void {
		const taken = this.bindings.has(name) || this.lookup(scope, name) !== undefined;
		if (taken) {
			this.solver.report('duplicate-binding', `${name.slice(0, 40)} is already bound`, node);
		}
		this.loopNames.push({ name, node });
	}

	private forType(node: For, scope: Scope | undefined): Type {
		const { solver } = this;
		const iterable = this.typeOf(node.iterable, scope);
		const iterates = solver.require(
			iterable,
			SIZED,
			node.iterable,
			'A loop needs an array or a string',
		);
		const shared = prune(iterable);
		const element =
			shared instanceof TypeVariable
				? solver.container(shared, node.start, node.iterable)
				: solver.fresh();
		if (iterates) solver.solveIteration(iterable, element, node.iterable);

		const { variable, accumulator } = node;
		this.checkLoopName(variable, node, scope);
		let inner: Scope = { name: variable, type: element, parent: scope };

		let initial: Type | undefined;
		if (accumulator !== null) {
			if (accumulator.name === variable) {
				solver.report('duplicate-binding', 'A loop needs two different names', node);
			} else {
				this.checkLoopName(accumulator.name, node, scope);
			}
			initial = this.typeOf(accumulator.initial, scope);
			inner = { name: accumulator.name, type: initial, parent: inner };
		}

		if (node.guard !== null) {
			solver.unify(this.typeOf(node.guard, inner), BOOLEAN, node.guard);
		}

		const body = this.typeOf(node.body, inner);
		if (initial === undefined) return new ArrayType(body);
		solver.unify(body, initial, node.body);
		return initial;
	}

	typeOf(node: Expression, scope: Scope | undefined): Type {
		const { solver } = this;
		switch (node.kind) {
			case 'number':
				return this.note(node, NUMBER);
			case 'string':
				return this.note(node, STRING);
			case 'boolean':
				return this.note(node, BOOLEAN);
			case 'name':
				return this.note(node, this.readName(node, scope, true));
			case 'binary':
				return this.note(node, this.binaryType(node, scope));
			case 'unary': {
				const expected = node.operator === '-' ? NUMBER : BOOLEAN;
				solver.unify(this.typeOf(node.argument, scope), expected, node.argument);
				return this.note(node, expected);
			}
			case 'fallback': {
				const path = this.pathType(node.path, scope);
				const fallback = this.typeOf(node.fallback, scope);
				solver.unify(path, fallback, node);
				if (node.path.kind === 'name') {
					const { name } = node.path;
					if (this.lookup(scope, name) !== undefined || this.bindings.has(name)) {
						solver.warn('never-missing', `${name.slice(0, 40)} can never be missing`, node.path);
					}
				}
				return this.note(node, path);
			}
			case 'range': {
				solver.unify(this.typeOf(node.from, scope), NUMBER, node.from);
				solver.unify(this.typeOf(node.to, scope), NUMBER, node.to);
				return this.note(node, new ArrayType(NUMBER));
			}
			case 'array': {
				const element = solver.fresh();
				for (const item of node.elements) solver.unify(element, this.typeOf(item, scope), item);
				return this.note(node, new ArrayType(element));
			}
			case 'record':
				return this.note(node, this.recordType(node, scope));
			case 'member':
				return this.note(
					node,
					solver.readField(this.typeOf(node.object, scope), node.name, true, node),
				);
			case 'index':
				return this.note(node, this.indexType(node, this.typeOf(node.object, scope), scope, true));
			case 'call':
				return this.note(node, this.callType(node, scope));
			case 'if': {
				solver.unify(this.typeOf(node.condition, scope), BOOLEAN, node.condition);
				const consequent = this.typeOf(node.consequent, scope);
				solver.unify(consequent, this.typeOf(node.alternate, scope), node.alternate);
				return this.note(node, consequent);
			}
			case 'for':
				return this.note(node, this.forType(node, scope));
			case 'placeholder':
			case 'pipe':
			case 'template':
				// Desugaring leaves none of these, and the parser rejects a stray `?`
				return this.note(node, ERROR);
		}
	}

	/** Find every name a program binds, as a read can come before a binding. */
	collectBindings(program: Program): void {
		const { solver } = this;
		program.statements.forEach((statement, index) => {
			if (statement.kind !== 'binding') return;
			if (this.bindings.has(statement.name)) {
				solver.report(
					'duplicate-binding',
					`${statement.name.slice(0, 40)} is already bound`,
					statement,
				);
			} else {
				this.bindings.set(statement.name, { index, node: statement, type: ERROR, read: false });
			}
		});
	}

	checkStatements(program: Program): Type {
		const { solver } = this;
		let last: Type = ERROR;
		program.statements.forEach((statement, index) => {
			this.statement = index;
			if (statement.kind === 'binding') {
				const type = this.typeOf(statement.value, undefined);
				const binding = this.bindings.get(statement.name) as Binding;
				if (binding.index === index) binding.type = type;
				if (statement.input) {
					this.inputs.set(statement.name, { type, required: false, node: statement });
					this.defaults.set(statement.name, statement.value);
				}
				last = type;
			} else {
				last = this.typeOf(statement, undefined);
				if (index < program.statements.length - 1) {
					solver.warn('unused-statement', 'The value of this statement is lost', statement);
				}
			}
		});

		const final = program.statements[program.statements.length - 1];
		if (final?.kind === 'binding') {
			solver.report('missing-result', 'A program must end in an expression', final);
		}
		return last;
	}

	/** Apply what a host declared about inputs, once the program has said what it reads. */
	declareInputs(): void {
		const { inputs } = this.options;
		if (inputs === undefined) return;
		const scope = new Map<string, TypeVariable>();
		for (const name of Object.keys(inputs)) {
			const declared = this.solver.instantiate(inputs[name] as HostType, scope);
			const input = this.inputs.get(name);
			if (input !== undefined) this.solver.unify(input.type, declared, input.node);
		}
	}

	/**
	 * Move everything that can move. An overloaded call is retried whenever anything
	 * has changed, as any variable, class or field can decide it.
	 */
	private settle(): void {
		const { solver } = this;
		for (;;) {
			solver.drain();
			const decided = solver.calls.filter((call) => !call.done);
			for (const call of decided) solver.tryCall(call);
			if (!decided.some((call) => call.done) && solver.queue.length === 0) return;
		}
	}

	/** Solve what can be, then apply the rules of language section 6.5 in order. */
	solve(): void {
		const { solver } = this;
		const byOrder = (a: { order: number }, b: { order: number }): number => a.order - b.order;
		solver.spreads.sort(byOrder);
		solver.containers.sort(byOrder);
		solver.calls.sort(byOrder);

		let spreads = 0;
		let containers = 0;
		let calls = 0;
		let classed = 0;
		for (;;) {
			this.settle();

			while (spreads < solver.spreads.length && (solver.spreads[spreads] as SpreadLiteral).done) {
				spreads++;
			}
			// A result that met its own operand would wait forever, so what waits for
			// another literal only goes if every literal does
			let spread: SpreadLiteral | undefined;
			let blocked: SpreadLiteral | undefined;
			for (let i = spreads; i < solver.spreads.length; i++) {
				charge(1);
				const literal = solver.spreads[i] as SpreadLiteral;
				if (literal.done) continue;
				if (!solver.waitsOnSpread(literal)) {
					spread = literal;
					break;
				}
				if (blocked === undefined && !solver.blockedOnSpread(literal)) blocked = literal;
			}
			spread ??= blocked;
			if (spread !== undefined) {
				solver.openSpread(spread);
				classed = 0;
				continue;
			}

			let advanced = false;
			while (containers < solver.containers.length) {
				const { type, node } = solver.containers[containers] as (typeof solver.containers)[number];
				containers++;
				const variable = prune(type);
				if (variable instanceof TypeVariable && solver.allowsArrays(variable.classes)) {
					solver.unify(variable, new ArrayType(variable.element ?? solver.fresh()), node);
					advanced = true;
					break;
				}
			}
			if (advanced) {
				classed = 0;
				continue;
			}

			while (calls < solver.calls.length && (solver.calls[calls] as WaitingCall).done) calls++;
			const call = solver.calls[calls];
			if (call !== undefined) {
				solver.decideCall(call);
				classed = 0;
				continue;
			}

			while (classed < solver.classed.length) {
				charge(1);
				const variable = prune(solver.classed[classed] as TypeVariable);
				classed++;
				if (
					variable instanceof TypeVariable &&
					(variable.classes & (ADDABLE | SUBTRACTABLE | ORDERED)) !== 0 &&
					solver.allowsNumber(variable.classes)
				) {
					solver.unify(variable, NUMBER, { start: 0, end: 0 });
					advanced = true;
					break;
				}
			}
			if (!advanced) return;
		}
	}

	/** Whether any type contains itself, which only shows once records are merged. */
	private findCycle(): Expression | undefined {
		const done = new Set<object>();
		const open = new Set<object>();

		for (const [node, start] of this.types) {
			const stack: { readonly type: object; readonly children: Type[] }[] = [];
			const enter = (type: Type): boolean => {
				const current = prune(type);
				if (open.has(current)) return true;
				if (done.has(current)) return false;
				const children: Type[] = [];
				if (current instanceof ArrayType) children.push(current.element);
				else if (current instanceof RecordType) {
					forEachField(current, (_, field) => {
						children.push(field.type);
					});
					if (current.row !== undefined) {
						const { uniform } = pruneRow(current.row);
						if (uniform !== undefined) children.push(uniform);
					}
					if (current.uniform !== undefined) children.push(current.uniform);
				} else return false;
				open.add(current);
				stack.push({ type: current, children });
				return false;
			};

			if (enter(start)) return node;
			while (stack.length > 0) {
				charge(1);
				const top = stack[stack.length - 1] as (typeof stack)[number];
				const child = top.children.pop();
				if (child === undefined) {
					open.delete(top.type);
					done.add(top.type);
					stack.pop();
				} else if (enter(child)) {
					return node;
				}
			}
		}
		return undefined;
	}

	/** The rules that can only be judged once solving has ended. */
	finish(): void {
		const { solver } = this;

		for (const { name, node } of this.loopNames) {
			if (this.inputs.has(name) && !this.bindings.has(name)) {
				solver.report('duplicate-binding', `${name.slice(0, 40)} is an input of the program`, node);
			}
		}

		const cycle = this.findCycle();
		if (cycle !== undefined) {
			solver.mismatch('A type cannot contain itself', cycle);
			return;
		}
		if (solver.tooDeep !== undefined) {
			solver.report('type-too-large', 'Type is too deep', solver.tooDeep);
			return;
		}

		const compared = new Set<RecordType>();
		for (const { record, node } of solver.equatableRecords) {
			const current = pruneRecord(record);
			if (!current.closed && !compared.has(current)) {
				compared.add(current);
				solver.mismatch('A record with unknown fields cannot be compared', node);
			}
		}

		for (const literal of solver.spreads) {
			for (const member of literal.members) {
				if (member.kind !== 'spread') continue;
				const record = prune(member.type);
				if (!(record instanceof RecordType)) continue;
				let optional = false;
				forEachField(record, (_, field) => {
					charge(1);
					optional ||= !field.required || field.absent === true;
				});
				if (optional)
					solver.mismatch('A record with optional fields cannot be spread', member.node);
			}
		}

		const meter = new TypeMeter();
		for (const [node, type] of this.types) {
			charge(1);
			if (!meter.fits(type)) {
				solver.report('type-too-large', 'Type is too large', node);
				return;
			}
		}

		for (const [name, binding] of this.bindings) {
			if (!binding.read)
				solver.warn('unused-binding', `${name.slice(0, 40)} is never read`, binding.node);
		}
	}

	schema(describer: TypeDescriber): InputSchema {
		const schema = Object.create(null) as Record<string, InputDescription>;
		for (const [name, input] of this.inputs) {
			schema[name] = { type: describer.describe(input.type), required: input.required };
		}
		return schema;
	}
}

/**
 * Check a desugared program: names, then types, as language section 6 says. All
 * that it finds comes back as diagnostics.
 */
export function check(program: Program, options: CheckOptions): CheckResult {
	const checker = new Checker(options);
	const { solver } = checker;

	checker.knownTypes();
	checker.collectBindings(program);
	const output = checker.checkStatements(program);
	checker.declareInputs();
	checker.solve();
	checker.finish();

	const failed = solver.errors.length > 0;
	const describer = new TypeDescriber();
	return {
		program,
		diagnostics: [...solver.errors, ...solver.warnings].sort((a, b) => a.start - b.start),
		types: checker.types,
		calls: solver.resolved,
		defaults: checker.defaults,
		inputTypes: checker.inputs,
		abstracts: [...solver.abstracts.keys()],
		outputType: output,
		inputs: failed ? (Object.create(null) as InputSchema) : checker.schema(describer),
		output: failed ? { kind: 'generic', id: -1 } : describer.describe(output),
	};
}
