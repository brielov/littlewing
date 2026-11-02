import { parse, type TypeDescription } from 'littlewing';
import { useEffect, useState } from 'react';
import type { Given, Input, Shown } from '../evaluation/protocol.ts';
import { typeText } from '../language/types.ts';
import { preview } from './value.tsx';

/** A number as the language writes it, which is what the program is given exactly. */
const NUMBER = /^-?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/;

const field =
	'w-full rounded border border-(--color-border) bg-(--color-bg-secondary) px-2 py-1 text-xs text-(--color-fg) outline-none focus:border-(--color-accent)';

type Control = Given['kind'];

/** Which control an input of `type` gets. */
function controlOf(type: TypeDescription): Control {
	switch (type.kind) {
		case 'number':
		case 'string':
		case 'boolean':
			return type.kind;
		case 'abstract':
			if (type.name === 'date' || type.name === 'time' || type.name === 'datetime')
				return type.name;
			return 'expression';
		default:
			return 'expression';
	}
}

/** What a control shows for a value given in it. */
function textOf(given: Given | undefined): string {
	if (given === undefined) return '';
	switch (given.kind) {
		case 'number':
		case 'date':
		case 'time':
		case 'datetime':
			return given.text;
		case 'string':
			return given.value;
		case 'boolean':
			return String(given.value);
		case 'expression':
			return given.source;
	}
}

/** What a control shows for the value an input had when the program ran. */
function currentText(current: Shown | undefined): string {
	if (current === undefined) return '';
	if (current.kind === 'string') return current.value;
	return preview(current);
}

interface InputRowProps {
	input: Input;
	given: Given | undefined;
	/** Why what was given could not be used, if it could not. */
	rejected: string | undefined;
	onGive: (name: string, given: Given) => void;
	onReset: (name: string) => void;
}

/** One input: its name, its type, and a control for its value. */
export function InputRow({ input, given, rejected, onGive, onReset }: InputRowProps) {
	const { name, type, required, defaulted } = input;
	const id = `input-${name}`;
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-baseline gap-2 text-xs">
				<label htmlFor={id} className="font-medium">
					{name}
				</label>
				<span className="truncate text-(--color-fg-muted)">{typeText(type)}</span>
				{!required && !defaulted && <span className="text-(--color-fg-muted)">optional</span>}
				{given !== undefined && (
					<button
						type="button"
						className="ml-auto cursor-pointer text-(--color-fg-muted) hover:text-(--color-fg)"
						onClick={() => onReset(name)}
						title={defaulted ? 'Back to the default' : 'Clear'}
					>
						reset
					</button>
				)}
			</div>
			<ControlFor
				id={id}
				input={input}
				given={given}
				invalid={rejected !== undefined}
				onGive={onGive}
				onReset={onReset}
			/>
			{rejected !== undefined && <p className="text-(--color-error)">{rejected}</p>}
		</div>
	);
}

interface ControlProps {
	id: string;
	input: Input;
	given: Given | undefined;
	invalid: boolean;
	onGive: (name: string, given: Given) => void;
	onReset: (name: string) => void;
}

function ControlFor({ id, input, given, invalid, onGive, onReset }: ControlProps) {
	const { name, current } = input;
	const control = controlOf(input.type);
	switch (control) {
		case 'boolean': {
			// What the program ran with, which a default can compute
			const value =
				given?.kind === 'boolean' ? given.value : current?.kind === 'boolean' && current.value;
			return (
				<label className="flex cursor-pointer items-center gap-2 text-xs">
					<input
						id={id}
						type="checkbox"
						className="accent-(--color-accent)"
						checked={value === true}
						onChange={(event) => onGive(name, { kind: 'boolean', value: event.target.checked })}
					/>
					<span className="tok-boolean">{String(value === true)}</span>
				</label>
			);
		}
		case 'date':
		case 'time':
		case 'datetime': {
			// What the program ran with, to the second, as the control takes it
			const shown = given === undefined ? currentText(current) : textOf(given);
			return (
				<input
					id={id}
					type={control === 'datetime' ? 'datetime-local' : control}
					step={control === 'date' ? undefined : 1}
					className={`${field} ${invalid ? 'border-(--color-error)' : ''}`}
					value={shown.replace(/\.\d+$/, '')}
					onChange={(event) => {
						if (event.target.value === '') onReset(name);
						else onGive(name, { kind: control, text: event.target.value });
					}}
				/>
			);
		}
		default:
			return (
				<TextControl
					id={id}
					control={control}
					name={name}
					given={given}
					placeholder={textOf(input.default) || currentText(current)}
					invalid={invalid}
					onGive={onGive}
					onReset={onReset}
				/>
			);
	}
}

interface TextControlProps {
	id: string;
	control: 'number' | 'string' | 'expression';
	name: string;
	given: Given | undefined;
	placeholder: string;
	invalid: boolean;
	onGive: (name: string, given: Given) => void;
	onReset: (name: string) => void;
}

/**
 * A text control, which keeps what is typed until it is a value: a number or an
 * expression that does not read yet is not sent, and is marked if left that way.
 * Emptying it goes back to the default, or to nothing.
 */
function TextControl({
	id,
	control,
	name,
	given,
	placeholder,
	invalid,
	onGive,
	onReset,
}: TextControlProps) {
	const [text, setText] = useState(textOf(given));
	const [unread, setUnread] = useState(false);

	// A reset, or another program, replaces what was typed
	useEffect(() => {
		setText(textOf(given));
		setUnread(false);
	}, [given]);

	/** Send what was typed, if it reads as a value, and tell whether it did. */
	const give = (value: string): boolean => {
		if (value === '' && control !== 'string') {
			onReset(name);
			return true;
		}
		if (control === 'number') {
			if (!NUMBER.test(value.trim())) return false;
			onGive(name, { kind: 'number', text: value.trim() });
		} else if (control === 'string') {
			onGive(name, { kind: 'string', value });
		} else {
			// Half an expression is not sent, as all it would say is that it is half
			if (parse(value).diagnostics.length > 0) return false;
			onGive(name, { kind: 'expression', source: value });
		}
		return true;
	};

	const marked = invalid || unread ? 'border-(--color-error)' : '';
	return (
		<input
			id={id}
			type="text"
			inputMode={control === 'number' ? 'decimal' : undefined}
			spellCheck={false}
			className={`${field} ${marked} ${control === 'string' ? 'tok-string' : ''}`}
			value={text}
			placeholder={placeholder}
			onChange={(event) => {
				setText(event.target.value);
				if (give(event.target.value)) setUnread(false);
			}}
			onBlur={() => setUnread(text !== textOf(given) && !(text === '' && given === undefined))}
		/>
	);
}
