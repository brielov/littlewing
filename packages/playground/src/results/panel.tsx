import { parse, toLineColumn } from 'littlewing';
import { type ReactNode, useMemo } from 'react';
import type { Problem } from '../evaluation/protocol.ts';
import { typeText } from '../language/types.ts';
import type { Evaluation } from '../evaluation/hook.ts';
import { InputRow } from './inputs.tsx';
import { SyntaxTree } from './tree.tsx';
import { ValueView } from './value.tsx';

interface PanelProps {
	evaluation: Evaluation;
	/** Show a place in the source, as where a problem is. */
	onJump: (from: number, to: number) => void;
}

/** What a program gives, what it takes, the value of each name, and what is wrong with it. */
export function Panel({ evaluation, onJump }: PanelProps) {
	return (
		<div className="flex h-full w-full flex-col overflow-y-auto bg-(--color-bg) text-xs">
			<Result evaluation={evaluation} />
			<Inputs evaluation={evaluation} />
			<Names evaluation={evaluation} />
			<Problems source={evaluation.problemsSource} problems={evaluation.problems} onJump={onJump} />
			<Details evaluation={evaluation} />
		</div>
	);
}

function Section({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="border-b border-(--color-border) px-4 pt-2.5 pb-4">
			<h2 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold tracking-wider text-(--color-fg-muted) uppercase">
				{title}
				{aside !== undefined && (
					<span className="font-normal tracking-normal normal-case">{aside}</span>
				)}
			</h2>
			{children}
		</section>
	);
}

function Result({ evaluation }: { evaluation: Evaluation }) {
	const { response, running } = evaluation;
	const outcome = response?.outcome;
	const aside = running ? 'running…' : outcome?.ok ? typeText(outcome.type) : undefined;
	let body: ReactNode;
	if (response === undefined || evaluation.source.trim() === '') {
		body = (
			<p className="text-(--color-fg-muted)">Write a program, and what it gives shows here.</p>
		);
	} else if (outcome === undefined) {
		const errors = response.problems.filter(({ severity }) => severity === 'error').length;
		body = (
			<p className="text-(--color-fg-muted)">
				{errors === 1 ? 'One problem stops' : `${errors} problems stop`} the program from running.
			</p>
		);
	} else if (outcome.ok) {
		body = (
			<div className="text-sm">
				<ValueView value={outcome.value} open />
			</div>
		);
	} else {
		// A value typed for an input that was set aside is why it can be missing
		const aside = response.rejected;
		body = (
			<div className="flex flex-col gap-1">
				<p className="text-(--color-error)">
					{outcome.message} <span className="text-(--color-fg-muted)">{outcome.code}</span>
				</p>
				{aside.length > 0 && (
					<p className="text-(--color-fg-muted)">
						What was typed for {aside.map(({ name }) => name).join(', ')} could not be used.
					</p>
				)}
			</div>
		);
	}
	return (
		<Section title="Result" aside={aside}>
			{body}
		</Section>
	);
}

function Inputs({ evaluation }: { evaluation: Evaluation }) {
	const { inputs, inputsCurrent, given, give, reset } = evaluation;
	const rejected = new Map(
		evaluation.response?.rejected.map(({ name, message }) => [name, message]),
	);
	if (inputs.length === 0) return null;
	return (
		<Section title="Inputs" aside={inputsCurrent ? undefined : 'as last compiled'}>
			<div className="flex flex-col gap-2.5">
				{inputs.map((input) => (
					<InputRow
						key={input.name}
						input={input}
						given={given.get(input.name)}
						rejected={rejected.get(input.name)}
						onGive={give}
						onReset={reset}
					/>
				))}
			</div>
		</Section>
	);
}

function Names({ evaluation }: { evaluation: Evaluation }) {
	const scope = evaluation.response?.scope ?? [];
	if (scope.length === 0) return null;
	return (
		<Section title="Names">
			<div className="grid grid-cols-[max-content_1fr_max-content] gap-x-3 gap-y-1">
				{scope.map(({ name, type, value }) => (
					<div key={name} className="contents">
						<span className="font-medium">{name}</span>
						<span className="min-w-0">
							{value === undefined ? (
								<span className="text-(--color-fg-muted)">not run</span>
							) : (
								<ValueView value={value} />
							)}
						</span>
						<span
							className="max-w-32 truncate text-right text-(--color-fg-muted)"
							title={type && typeText(type)}
						>
							{type && typeText(type)}
						</span>
					</div>
				))}
			</div>
		</Section>
	);
}

function Problems({
	source,
	problems,
	onJump,
}: {
	source: string;
	problems: readonly Problem[];
	onJump: (from: number, to: number) => void;
}) {
	if (problems.length === 0) return null;
	return (
		<Section title="Problems" aside={String(problems.length)}>
			<ul className="flex flex-col gap-1">
				{problems.map((problem, i) => {
					const { line, column } = toLineColumn(source, Math.min(problem.from, source.length));
					const color =
						problem.severity === 'error' ? 'bg-(--color-error)' : 'bg-(--color-warning)';
					return (
						<li key={i}>
							<button
								type="button"
								className="flex w-full cursor-pointer items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-(--color-bg-secondary)"
								onClick={() => onJump(problem.from, problem.to)}
							>
								<span
									className={`inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full ${color}`}
								/>
								<span className="flex-1">{problem.message}</span>
								<span className="shrink-0 text-(--color-fg-muted)">
									{line}:{column}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</Section>
	);
}

function Details({ evaluation }: { evaluation: Evaluation }) {
	const { source, response } = evaluation;
	const program = useMemo(() => parse(source).program, [source]);
	const timing = response?.timing;
	return (
		<details className="group px-4 py-2.5">
			<summary className="cursor-pointer text-[11px] font-semibold tracking-wider text-(--color-fg-muted) uppercase">
				Details
			</summary>
			<div className="mt-2 flex flex-col gap-3">
				{timing !== undefined && (
					<dl className="grid grid-cols-[1fr_max-content] gap-y-0.5 text-(--color-fg-muted)">
						<dt>Compile</dt>
						<dd className="text-right tabular-nums">{timing.compileMs.toFixed(2)} ms</dd>
						<dt>Run</dt>
						<dd className="text-right tabular-nums">{timing.evaluateMs.toFixed(2)} ms</dd>
					</dl>
				)}
				{program.statements.length > 0 && <SyntaxTree program={program} />}
			</div>
		</details>
	);
}
