// Compiled with `lib: ["ESNext"]`: a project using the global Temporal needs no casts.
import {
	assertDate,
	defaultContext,
	evaluate,
	type HostFunction,
	type RuntimeValue,
} from 'littlewing';

const date = Temporal.PlainDate.from('2024-01-01');
const value: RuntimeValue = evaluate('d', { ...defaultContext, variables: { d: date } });

export const today: HostFunction = () => Temporal.Now.plainDateISO();

export function year(input: RuntimeValue): number {
	assertDate(input, 'year');
	const narrowed: Temporal.PlainDate = input;
	return narrowed.year;
}

// @ts-expect-error RuntimeValue must stay a precise union, not collapse to `any`
export const notAString: string = value;
