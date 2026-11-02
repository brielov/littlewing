import { useState } from 'react';
import type { Shown } from '../evaluation/protocol.ts';

/** A short text of a value, for one line: `[1, 2, …]`, `{ a: 1, … }`. */
export function preview(value: Shown, room = 60): string {
	switch (value.kind) {
		case 'number':
		case 'date':
		case 'time':
		case 'datetime':
		case 'other':
			return value.text;
		case 'string':
			return value.more === undefined
				? JSON.stringify(value.value)
				: `${JSON.stringify(value.value).slice(0, -1)}…"`;
		case 'boolean':
			return String(value.value);
		case 'elided':
			return '…';
		case 'array':
		case 'record': {
			const [open, close] = value.kind === 'array' ? ['[', ']'] : ['{ ', ' }'];
			const count =
				(value.kind === 'array' ? value.items.length : value.fields.length) + value.more;
			if (count === 0) return value.kind === 'array' ? '[]' : '{}';
			// Only as many parts as fit, however many there are
			let text = '';
			for (let i = 0; i < count; i++) {
				const part =
					value.kind === 'array'
						? value.items[i] && preview(value.items[i]!, room)
						: value.fields[i] && `${value.fields[i]![0]}: ${preview(value.fields[i]![1], room)}`;
				const next = part === undefined ? undefined : `${text}${i > 0 ? ', ' : ''}${part}`;
				if (next === undefined || next.length > room)
					return `${open}${text}${text ? ', ' : ''}…${close}`;
				text = next;
			}
			return `${open}${text}${close}`;
		}
	}
}

/** How many elements or fields an open value lists. */
const SHOWN = 200;

/** The class that colors a value as the editor colors its literal. */
function tone(value: Shown): string {
	if (value.kind === 'string') return 'tok-string';
	if (value.kind === 'boolean') return 'tok-boolean';
	if (value.kind === 'elided') return 'text-(--color-fg-muted)';
	return '';
}

/** A value, with arrays and records that open to their elements. */
export function ValueView({
	value,
	open: initiallyOpen = false,
}: {
	value: Shown;
	open?: boolean;
}) {
	const [open, setOpen] = useState(initiallyOpen);
	if (value.kind === 'string' && value.more !== undefined) {
		return (
			<span className="break-all whitespace-pre-wrap">
				<span className="tok-string">{preview(value)}</span>{' '}
				<span className="text-(--color-fg-muted)">
					and {value.more.toLocaleString()} more characters
				</span>
			</span>
		);
	}
	if (value.kind !== 'array' && value.kind !== 'record') {
		return <span className={`break-all whitespace-pre-wrap ${tone(value)}`}>{preview(value)}</span>;
	}
	const entries =
		value.kind === 'array'
			? value.items.map((item, i) => [String(i), item] as const)
			: value.fields;
	if (entries.length === 0) return <span>{preview(value)}</span>;

	const count = entries.length + value.more;
	const size = `${count.toLocaleString()} ${value.kind === 'array' ? 'element' : 'field'}${count === 1 ? '' : 's'}`;
	const shown = Math.min(entries.length, SHOWN);
	const hidden = count - shown;
	return (
		<span className="inline-flex flex-col">
			<button
				type="button"
				className="inline-flex cursor-pointer items-baseline gap-1 text-left"
				onClick={() => setOpen((was) => !was)}
				aria-expanded={open}
			>
				<span className="w-3 shrink-0 text-(--color-fg-muted)">{open ? '▾' : '▸'}</span>
				{open ? (
					<span className="text-(--color-fg-muted)">{size}</span>
				) : (
					<span className="break-all">{preview(value)}</span>
				)}
			</button>
			{open && (
				<span className="ml-1.5 flex flex-col border-l border-(--color-border) pl-2.5">
					{entries.slice(0, shown).map(([key, item]) => (
						<span key={key} className="flex gap-2">
							<span className="shrink-0 text-(--color-fg-muted)">{key}</span>
							<ValueView value={item} />
						</span>
					))}
					{hidden > 0 && (
						<span className="text-(--color-fg-muted)">… {hidden.toLocaleString()} more</span>
					)}
				</span>
			)}
		</span>
	);
}
