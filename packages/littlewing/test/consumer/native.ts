// Compiled with `lib: ["ESNext"]`: a project using the global Temporal needs no casts.
import { define, defineType, run, t, type AbstractType, type FunctionDefinition } from 'littlewing';
import { date } from 'littlewing/temporal';

const day: Temporal.PlainDate = Temporal.PlainDate.from('2024-01-01');

export const YEAR_OF: FunctionDefinition = define({
	args: [date],
	returns: t.number(),
	run: (value) => {
		const narrowed: Temporal.PlainDate = value;
		return narrowed.year;
	},
});

export const result: unknown = run('YEAR_OF(d)', {
	functions: { YEAR_OF },
	inputs: { d: date },
	variables: { d: day },
});

export const instant: AbstractType<Temporal.Instant> = defineType<Temporal.Instant>({
	name: 'instant',
	is: (value) => value instanceof Temporal.Instant,
});

export const SAME: FunctionDefinition = define({
	args: [instant],
	returns: instant,
	run: (value) => {
		const narrowed: Temporal.Instant = value;
		return narrowed;
	},
});
