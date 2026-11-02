import type { TypeDescription } from 'littlewing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { typeText } from '../language/types.ts';
import { Evaluator } from './client.ts';
import type { Given, Input, Response } from './protocol.ts';

/** What the page knows about the program, from the worker that runs it. */
export interface Evaluation {
	/** The source `response` is about, which lags what is typed. */
	readonly source: string;
	/** The last response to have run to its end. */
	readonly response: Response | undefined;
	/** The problems of the latest source compiled, which come before it has run. */
	readonly problems: Response['problems'];
	/** The source `problems` are about. */
	readonly problemsSource: string;
	/** Whether something newer, a source or what an input is given, is being run. */
	readonly running: boolean;
	/** The inputs of the last program that compiled, which a broken one keeps. */
	readonly inputs: readonly Input[];
	readonly inputsCurrent: boolean;
	/** What was typed for inputs, by name. */
	readonly given: ReadonlyMap<string, Given>;
	readonly give: (name: string, given: Given) => void;
	readonly reset: (name: string) => void;
	/** The type of each top-level name, of the last program types were found for. */
	readonly types: ReadonlyMap<string, TypeDescription>;
	readonly typesCurrent: boolean;
}

/** A value typed for an input, which only holds while the input keeps its type. */
interface Typed {
	readonly type: string;
	readonly given: Given;
}

const NO_INPUTS: readonly Input[] = [];
const NO_TYPES: ReadonlyMap<string, TypeDescription> = new Map();

function spawn(): Worker {
	return new Worker(new URL('./worker.ts', import.meta.url), {
		type: 'module',
		name: 'littlewing',
	});
}

export function useEvaluation(source: string): Evaluation {
	const [latest, setLatest] = useState<Response | undefined>();
	const [response, setResponse] = useState<Response | undefined>();
	const [requested, setRequested] = useState(0);
	const [typed, setTyped] = useState<ReadonlyMap<string, Typed>>(() => new Map());
	const evaluator = useRef<Evaluator | null>(null);

	useEffect(() => {
		const created = new Evaluator(spawn, (answer) => {
			setLatest(answer);
			if (answer.phase === 'done') setResponse(answer);
		});
		evaluator.current = created;
		return () => {
			created.dispose();
			evaluator.current = null;
		};
	}, []);

	// What a broken program keeps from the last one that compiled
	const last = useRef<{ inputs: readonly Input[]; types: ReadonlyMap<string, TypeDescription> }>({
		inputs: NO_INPUTS,
		types: NO_TYPES,
	});
	// While a newer program runs, its inputs are known, though not what they hold
	const newest = latest?.phase === 'compiled' ? latest : response;
	const found = newest?.inputs ?? last.current.inputs;
	// A run that failed, or has not ended, says nothing of what an input held, which
	// is then what it last held, while the input keeps its type
	const inputs = useMemo(
		() =>
			found.map((input) => {
				if (input.current !== undefined) return input;
				const before = last.current.inputs.find(
					(old) =>
						old.name === input.name &&
						typeText(old.type) === typeText(input.type) &&
						old.defaultSource === input.defaultSource,
				);
				return before?.current === undefined ? input : { ...input, current: before.current };
			}),
		[found],
	);
	const types = useMemo(
		() => (latest?.types === undefined ? last.current.types : new Map(latest.types)),
		[latest],
	);
	useEffect(() => {
		last.current = { inputs, types };
	}, [inputs, types]);

	// Only what still fits the input it was typed for
	const given = useMemo(() => {
		const current = new Map<string, Given>();
		for (const { name, type } of inputs) {
			const value = typed.get(name);
			if (value?.type === typeText(type)) current.set(name, value.given);
		}
		return current;
	}, [inputs, typed]);

	// A response brings new inputs, and so a new map of what was given, which is
	// sent again only if what it holds changed, or the worker would never rest
	const givenKey = JSON.stringify([...given]);
	const givenNow = useRef(given);
	givenNow.current = given;
	useEffect(() => {
		const id = evaluator.current?.evaluate(source, Object.fromEntries(givenNow.current));
		if (id !== undefined) setRequested(id);
	}, [source, givenKey]);

	const give = useCallback(
		(name: string, value: Given) => {
			const input = inputs.find((candidate) => candidate.name === name);
			if (input === undefined) return;
			setTyped((was) => new Map(was).set(name, { type: typeText(input.type), given: value }));
		},
		[inputs],
	);
	const reset = useCallback((name: string) => {
		setTyped((was) => {
			const next = new Map(was);
			next.delete(name);
			return next;
		});
	}, []);

	return {
		source: response?.source ?? '',
		response,
		// What compiling found, and once the program has run, what running it found too
		...(latest?.phase === 'compiled' && response?.source === latest.source
			? { problems: response.problems, problemsSource: response.source }
			: { problems: latest?.problems ?? [], problemsSource: latest?.source ?? '' }),
		running: response?.id !== requested,
		inputs,
		inputsCurrent: newest?.inputs !== undefined,
		given,
		give,
		reset,
		types,
		typesCurrent: latest?.types !== undefined,
	};
}
