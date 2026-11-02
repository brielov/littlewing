// Compiled against the built package as a strict consumer would: no global
// Temporal, no skipLibCheck, isolatedModules on.
import {
	type AbstractType,
	compile,
	type CompileOptions,
	type CompileResult,
	Decimal,
	type DecimalLike,
	define,
	defineType,
	type Diagnostic,
	evaluate,
	type EvaluateOptions,
	type FieldDescription,
	type FunctionDefinition,
	type InputDescription,
	type InputSchema,
	parse,
	type Program,
	type RoundingMode,
	t,
	type syntax,
	type Type,
	type TypeDescription,
} from 'littlewing';
import { ABS } from 'littlewing/std';
import { date, temporalFunctions, YEAR } from 'littlewing/temporal';
import { NOW } from 'littlewing/clock';

export const result: CompileResult = compile('1 + 1', { functions: { ABS, YEAR, NOW } });

export function inputsOf(source: string): InputSchema | readonly Diagnostic[] {
	const compiled = compile(source, { functions: temporalFunctions });
	return compiled.ok ? compiled.program.inputs : compiled.diagnostics;
}

export function total(source: string): unknown {
	const compiled = compile(source);
	return compiled.ok ? evaluate(compiled.program, { numbers: 'decimal' }) : undefined;
}

export const DISCOUNT: FunctionDefinition = define({
	args: [t.number('price'), t.number('percent')],
	returns: t.number(),
	pure: true,
	run: (price, percent) => price.times(Decimal.from(1).minus(percent.div(100))),
});

class Money {
	constructor(readonly cents: number) {}
}

export const money: AbstractType<Money> = defineType<Money>({
	name: 'money',
	is: (value) => value instanceof Money,
});

export const MONEY: FunctionDefinition = define({
	args: [t.number()],
	returns: money,
	run: (cents) => new Money(cents.toNumber()),
});

export const tree: syntax.Program = parse('1').program;

export const dateType: unknown = date;

export function kindOf(description: TypeDescription): string {
	return description.kind;
}

// @ts-expect-error `run` must be checked against what `returns` allows
export const WRONG: FunctionDefinition = define({ args: [], returns: t.number(), run: () => 'x' });

// @ts-expect-error A date is not a number
export const notANumber: number = date;

export const options: CompileOptions = { limits: { maxSteps: 1000 } };
export const evaluating: EvaluateOptions = { numbers: 'decimal' };
export const mode: RoundingMode = 'half_even';
export const amount: DecimalLike = '1.5';
export const parameter: Type = t.number();
export function requiredOf(input: InputDescription): boolean {
	return input.required;
}
export function fieldRequired(field: FieldDescription): boolean {
	return field.required;
}
export function outputOf(program: Program): TypeDescription {
	return program.output;
}
