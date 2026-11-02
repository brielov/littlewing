import {
	coreFunctions,
	describeFunction,
	type FunctionDescription,
	type OverloadDescription,
	type ParameterDescription,
} from 'littlewing';
import { FUNCTIONS } from '../environment.ts';

/** Every function a program here can call, by name, as the library describes it. */
export const FUNCTION_DESCRIPTIONS: ReadonlyMap<string, FunctionDescription> = new Map(
	Object.entries({ ...coreFunctions, ...FUNCTIONS })
		.map(([name, definition]) => [name, describeFunction(definition)] as const)
		.sort(([a], [b]) => a.localeCompare(b)),
);

/** A parameter as an editor shows it, as `digits?: number`. */
export function parameterText(parameter: ParameterDescription): string {
	return `${parameter.name}${parameter.optional ? '?' : ''}: ${parameter.type}`;
}

/** One way to call a function, as `ROUND(value: number, digits?: number) → number`. */
export function signatureText(name: string, overload: OverloadDescription): string {
	return `${name}(${overload.args.map(parameterText).join(', ')}) → ${overload.returns}`;
}

/** The edit distance between two names, ignoring case, as `round` is a slip for `ROUND`. */
export function distance(a: string, b: string): number {
	const left = a.toLowerCase();
	const right = b.toLowerCase();
	let previous = Array.from({ length: right.length + 1 }, (_, j) => j);
	for (let i = 1; i <= left.length; i++) {
		const current = [i];
		for (let j = 1; j <= right.length; j++) {
			const cost = left[i - 1] === right[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
		}
		previous = current;
	}
	return previous[right.length]!;
}

/** The names `name` is most likely a slip for, closest first. */
export function closest(name: string, candidates: Iterable<string>, limit = 3): string[] {
	// A third of the name can be wrong, as `LEN` is no slip for `LOWR`
	const most = Math.min(3, Math.ceil(name.length / 3));
	const scored: { candidate: string; score: number }[] = [];
	for (const candidate of candidates) {
		if (candidate === name) continue;
		const score = distance(name, candidate);
		if (score <= most) scored.push({ candidate, score });
	}
	scored.sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate));
	return scored.slice(0, limit).map(({ candidate }) => candidate);
}
