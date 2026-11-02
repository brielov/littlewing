import { coreFunctions, describeFunction, type FunctionDescription } from 'littlewing';
import * as clock from 'littlewing/clock';
import * as std from 'littlewing/std';
import { temporalFunctions } from 'littlewing/temporal';
import { useMemo, useState } from 'react';
import { signatureText } from '../language/catalog.ts';
import { Code } from './code.tsx';

interface Group {
	readonly title: string;
	/** Where a host gets them, or nothing for the core functions every program has. */
	readonly module: string | undefined;
	readonly functions: readonly (readonly [string, FunctionDescription])[];
}

function describeAll(definitions: object): [string, FunctionDescription][] {
	return Object.entries(definitions)
		.map(
			([name, definition]) => [name, describeFunction(definition)] as [string, FunctionDescription],
		)
		.sort(([a], [b]) => a.localeCompare(b));
}

const GROUPS: readonly Group[] = [
	{ title: 'Core', module: undefined, functions: describeAll(coreFunctions) },
	{ title: 'Standard', module: 'littlewing/std', functions: describeAll(std) },
	{
		title: 'Dates and times',
		module: 'littlewing/temporal',
		functions: describeAll(temporalFunctions),
	},
	{ title: 'Clock', module: 'littlewing/clock', functions: describeAll(clock) },
];

/** Every function, as the library describes it, found by name or by what it does. */
export function Reference({ onInsert }: { onInsert: (name: string) => void }) {
	const [query, setQuery] = useState('');
	const groups = useMemo(() => {
		const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		return GROUPS.map((group) => ({
			...group,
			functions: group.functions.filter(([name, description]) => {
				const text = `${name} ${description.doc ?? ''}`.toLowerCase();
				return words.every((word) => text.includes(word));
			}),
		})).filter((group) => group.functions.length > 0);
	}, [query]);

	return (
		<div className="h-full w-full overflow-y-auto px-4 py-6 text-sm sm:px-10">
			<div className="mx-auto max-w-3xl">
				<h1 className="mb-1 text-2xl font-semibold">Functions</h1>
				<p className="mb-4 text-(--color-fg-muted)">
					The core functions every program has, and the ones a host can add from the library's
					modules.
				</p>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search by name or by what it does"
					aria-label="Search functions"
					className="mb-6 w-full rounded border border-(--color-border) bg-(--color-bg-secondary) px-3 py-1.5 text-sm outline-none focus:border-(--color-accent)"
				/>
				{groups.length === 0 && <p className="text-(--color-fg-muted)">No function matches.</p>}
				{groups.map((group) => (
					<section key={group.title} className="mb-8">
						<h2 className="mb-3 flex items-baseline gap-3 border-b border-(--color-border) pb-1.5 text-base font-semibold">
							{group.title}
							{group.module !== undefined && (
								<code className="text-xs font-normal text-(--color-fg-muted)">{group.module}</code>
							)}
						</h2>
						<dl className="flex flex-col gap-4">
							{group.functions.map(([name, description]) => (
								<div key={name} id={`fn-${name}`}>
									<dt className="flex items-start justify-between gap-3">
										<span className="flex flex-col gap-0.5 text-[13px]">
											{description.overloads.map((overload, i) => (
												<Code key={i} source={signatureText(name, overload)} />
											))}
										</span>
										<button
											type="button"
											className="shrink-0 cursor-pointer text-xs text-(--color-accent) hover:underline"
											onClick={() => onInsert(name)}
											aria-label={`Insert ${name}`}
										>
											Insert
										</button>
									</dt>
									{description.doc !== undefined && (
										<dd className="mt-1 text-(--color-fg-muted)">{description.doc}</dd>
									)}
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</div>
	);
}
