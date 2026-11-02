import { run, type syntax } from 'littlewing';
import { useEffect, useRef, useState } from 'react';
import { FUNCTIONS, LIMITS } from './environment.ts';
import type { UseEvaluationReturn } from './use-evaluation.ts';

interface SidebarProps {
	evaluation: UseEvaluationReturn;
}

export function Sidebar({ evaluation }: SidebarProps) {
	const { result, inputVariables, overrides, ast, timing, setOverride, clearOverride } = evaluation;

	return (
		<div
			className="flex h-full w-full flex-col overflow-y-auto"
			style={{
				backgroundColor: 'var(--color-bg)',
			}}
		>
			<VariablesSection
				inputVariables={inputVariables}
				overrides={overrides}
				setOverride={setOverride}
				clearOverride={clearOverride}
			/>
			<OutputSection result={result} />
			<PerformanceSection timing={timing} />
			<AstSection ast={ast} />
		</div>
	);
}

// --- Variables Section ---

interface VariablesSectionProps {
	inputVariables: UseEvaluationReturn['inputVariables'];
	overrides: ReadonlyMap<string, unknown>;
	setOverride: (name: string, value: unknown) => void;
	clearOverride: (name: string) => void;
}

function VariablesSection({
	inputVariables,
	overrides,
	setOverride,
	clearOverride,
}: VariablesSectionProps) {
	return (
		<section style={{ borderBottom: '1px solid var(--color-border)' }}>
			<SectionHeader>Variables</SectionHeader>
			{inputVariables.length === 0 ? (
				<p className="px-4 pb-4 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
					No input variables detected.
				</p>
			) : (
				<div className="flex flex-col gap-2 px-4 pb-4">
					{inputVariables.map((v) => (
						<VariableRow
							key={v.name}
							name={v.name}
							type={v.type}
							defaultValue={v.defaultValue}
							override={overrides.get(v.name)}
							setOverride={setOverride}
							clearOverride={clearOverride}
						/>
					))}
				</div>
			)}
		</section>
	);
}

interface VariableRowProps {
	name: string;
	type: string;
	defaultValue: unknown;
	override: unknown;
	setOverride: (name: string, value: unknown) => void;
	clearOverride: (name: string) => void;
}

function VariableRow({
	name,
	type,
	defaultValue,
	override,
	setOverride,
	clearOverride,
}: VariableRowProps) {
	const isOverridden = override !== undefined;
	const currentValue = isOverridden ? override : defaultValue;
	const inputId = `var-${name}`;

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<label
					htmlFor={inputId}
					className="text-xs font-medium"
					style={{ fontFamily: '"Maple Mono", monospace' }}
				>
					{name}
				</label>
				<TypeBadge type={type} />
				{isOverridden && (
					<button
						type="button"
						onClick={() => clearOverride(name)}
						className="ml-auto cursor-pointer text-xs"
						style={{ color: 'var(--color-fg-muted)' }}
						title="Reset to default"
						aria-label={`Reset ${name} to default`}
					>
						&times;
					</button>
				)}
			</div>
			<VariableInput
				inputId={inputId}
				name={name}
				type={type}
				currentValue={currentValue}
				setOverride={setOverride}
				clearOverride={clearOverride}
			/>
		</div>
	);
}

function TypeBadge({ type }: { type: string }) {
	return (
		<span
			className="rounded px-1.5 py-0.5 text-[10px] uppercase"
			style={{
				backgroundColor: 'var(--color-bg-secondary)',
				color: 'var(--color-fg-muted)',
			}}
		>
			{type}
		</span>
	);
}

interface VariableInputProps {
	inputId: string;
	name: string;
	type: string;
	currentValue: unknown;
	setOverride: (name: string, value: unknown) => void;
	clearOverride: (name: string) => void;
}

function VariableInput({
	inputId,
	name,
	type,
	currentValue,
	setOverride,
	clearOverride,
}: VariableInputProps) {
	const inputStyle = {
		backgroundColor: 'var(--color-bg-secondary)',
		color: 'var(--color-fg)',
		border: '1px solid var(--color-border)',
		fontFamily: '"Maple Mono", monospace',
	};

	switch (type) {
		case 'number':
			return (
				<NumberInput
					inputId={inputId}
					name={name}
					currentValue={currentValue as number | undefined}
					setOverride={setOverride}
					inputStyle={inputStyle}
				/>
			);

		case 'string':
			return (
				<input
					id={inputId}
					type="text"
					className="rounded px-2 py-1 text-xs"
					style={inputStyle}
					value={textOf(currentValue)}
					onChange={(e) => setOverride(name, e.target.value)}
				/>
			);

		case 'boolean':
			return (
				<button
					id={inputId}
					type="button"
					onClick={() => setOverride(name, !currentValue)}
					className="cursor-pointer rounded px-2 py-1 text-left text-xs"
					style={inputStyle}
					aria-label={`Toggle ${name}`}
				>
					{currentValue === undefined ? 'default' : textOf(currentValue)}
				</button>
			);

		case 'date':
			return (
				<input
					id={inputId}
					type="date"
					className="rounded px-2 py-1 text-xs"
					style={inputStyle}
					value={textOf(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainDate.from(e.target.value));
						}
					}}
				/>
			);

		case 'time':
			return (
				<input
					id={inputId}
					type="time"
					className="rounded px-2 py-1 text-xs"
					step="1"
					style={inputStyle}
					value={textOf(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainTime.from(e.target.value));
						}
					}}
				/>
			);

		case 'datetime':
			return (
				<input
					id={inputId}
					type="datetime-local"
					className="rounded px-2 py-1 text-xs"
					step="1"
					style={inputStyle}
					value={textOf(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainDateTime.from(e.target.value));
						}
					}}
				/>
			);

		case 'array':
		case 'record':
		case 'any':
			return (
				<ExpressionInput
					inputId={inputId}
					name={name}
					type={type}
					currentValue={currentValue}
					setOverride={setOverride}
					clearOverride={clearOverride}
				/>
			);

		default:
			return (
				<span
					className="rounded px-2 py-1 text-xs"
					style={{
						backgroundColor: 'var(--color-bg-secondary)',
						color: 'var(--color-fg-muted)',
					}}
				>
					{formatValue(currentValue)}
				</span>
			);
	}
}

function NumberInput({
	inputId,
	name,
	currentValue,
	setOverride,
	inputStyle,
}: {
	inputId: string;
	name: string;
	currentValue: number | undefined;
	setOverride: (name: string, value: unknown) => void;
	inputStyle: React.CSSProperties;
}) {
	const ref = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (ref.current && ref.current !== document.activeElement) {
			ref.current.value = currentValue === undefined ? '' : String(currentValue);
		}
	}, [currentValue]);

	return (
		<input
			ref={ref}
			id={inputId}
			type="number"
			step="any"
			className="rounded px-2 py-1 text-xs"
			style={inputStyle}
			defaultValue={currentValue}
			onChange={(e) => {
				const n = e.target.valueAsNumber;
				if (!Number.isNaN(n)) {
					setOverride(name, n);
				}
			}}
		/>
	);
}

/** The text of a value that has one: a number, string, boolean, date or time. */
function textOf(value: unknown): string {
	return value === undefined ? '' : String(value as string);
}

/** Whether what an expression gave is a value of a type, as far as the sidebar can tell. */
function fits(type: string, value: unknown): boolean {
	if (type === 'array') return Array.isArray(value);
	if (type === 'record') return typeof value === 'object' && !Array.isArray(value);
	return true;
}

function ExpressionInput({
	inputId,
	name,
	type,
	currentValue,
	setOverride,
	clearOverride,
}: {
	inputId: string;
	name: string;
	type: string;
	currentValue: unknown;
	setOverride: (name: string, value: unknown) => void;
	clearOverride: (name: string) => void;
}) {
	// With no value yet, the program's own default applies, which may not be a constant.
	// What is shown of a value is not always source, so once a value comes from the text
	// typed here, that text stays, and only a value from elsewhere replaces it.
	const shownFor = (value: unknown): string => (value === undefined ? '' : formatValue(value));
	const [text, setText] = useState(() => shownFor(currentValue));
	const [error, setError] = useState(false);
	const applied = useRef({ value: currentValue, text });

	useEffect(() => {
		if (currentValue === applied.current.value) return;
		const shown = shownFor(currentValue);
		applied.current = { value: currentValue, text: shown };
		setText(shown);
		setError(false);
	}, [currentValue]);

	function tryEvaluate(value: string): boolean {
		if (value === '') {
			applied.current = { value: undefined, text: '' };
			clearOverride(name);
			setError(false);
			return true;
		}
		try {
			const options = { functions: FUNCTIONS, limits: LIMITS, numbers: 'decimal' } as const;
			const result = run(value, options);
			if (fits(type, result)) {
				applied.current = { value: result, text: value };
				setOverride(name, result);
				setError(false);
				return true;
			}
		} catch {
			// Ignore parse errors during typing
		}
		return false;
	}

	return (
		<input
			id={inputId}
			type="text"
			className="rounded px-2 py-1 text-xs"
			style={{
				backgroundColor: 'var(--color-bg-secondary)',
				color: 'var(--color-fg)',
				border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
				fontFamily: '"Maple Mono", monospace',
			}}
			value={text}
			placeholder="an expression, or the default"
			onChange={(e) => {
				setText(e.target.value);
				tryEvaluate(e.target.value);
			}}
			onBlur={() => {
				if (text !== applied.current.text && !tryEvaluate(text)) {
					setError(true);
				}
			}}
		/>
	);
}

// --- Output Section ---

function OutputSection({ result }: { result: UseEvaluationReturn['result'] }) {
	return (
		<section style={{ borderBottom: '1px solid var(--color-border)' }}>
			<SectionHeader>Output</SectionHeader>
			<div className="px-4 pb-4">
				{result === null ? (
					<span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
						No output
					</span>
				) : result.ok ? (
					<pre
						className="whitespace-pre-wrap text-xs"
						style={{ color: 'var(--color-success)', fontFamily: '"Maple Mono", monospace' }}
					>
						{formatValue(result.value)}
					</pre>
				) : (
					<pre
						className="whitespace-pre-wrap text-xs"
						style={{ color: 'var(--color-error)', fontFamily: '"Maple Mono", monospace' }}
					>
						{result.error}
					</pre>
				)}
			</div>
		</section>
	);
}

// --- Performance Section ---

function PerformanceSection({ timing }: { timing: UseEvaluationReturn['timing'] }) {
	if (timing === null) return null;

	const rows: Array<[string, number]> = [
		['Compile', timing.compileMs],
		['Evaluate', timing.evaluateMs],
		['Total', timing.totalMs],
	];

	return (
		<section style={{ borderBottom: '1px solid var(--color-border)' }}>
			<SectionHeader>Performance</SectionHeader>
			<div className="px-4 pb-4">
				<table className="w-full text-xs">
					<tbody>
						{rows.map(([label, ms]) => (
							<tr key={label}>
								<td className="py-0.5" style={{ color: 'var(--color-fg-muted)' }}>
									{label}
								</td>
								<td className="py-0.5 text-right" style={{ fontFamily: '"Maple Mono", monospace' }}>
									{ms.toFixed(2)} ms
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

// --- AST Section ---

function AstSection({ ast }: { ast: syntax.Program | null }) {
	if (ast === null) return null;

	return (
		<section style={{ borderBottom: '1px solid var(--color-border)' }}>
			<SectionHeader>AST</SectionHeader>
			<div className="px-4 pb-4">
				<AstNode node={ast} />
			</div>
		</section>
	);
}

/**
 * Build a structured representation of an AST node for rendering.
 * Returns the node name, scalar properties, and child nodes.
 */
interface AstEntry {
	label: string;
	value?: string;
	children?: AstEntry[];
}

function labelled(label: string, node: syntax.Expression): AstEntry {
	return { label, children: [buildAstEntries(node)] };
}

function statementEntry(statement: syntax.Statement): AstEntry {
	if (statement.kind !== 'binding') return buildAstEntries(statement);
	return {
		label: statement.input ? 'Input' : 'Binding',
		value: statement.name,
		children: [buildAstEntries(statement.value)],
	};
}

function memberEntry(member: syntax.RecordMember): AstEntry {
	return member.kind === 'field'
		? { label: 'Field', value: member.name, children: [buildAstEntries(member.value)] }
		: { label: 'Spread', children: [buildAstEntries(member.value)] };
}

function buildAstEntries(node: syntax.Expression): AstEntry {
	const recurse = buildAstEntries;

	switch (node.kind) {
		case 'number':
			return { label: 'Number', value: node.text };
		case 'string':
			return { label: 'String', value: `"${node.value}"` };
		case 'template':
			return {
				label: 'Template',
				children: node.parts.map((part) =>
					typeof part === 'string' ? { label: 'Text', value: `"${part}"` } : recurse(part),
				),
			};
		case 'boolean':
			return { label: 'Boolean', value: String(node.value) };
		case 'name':
			return { label: 'Name', value: node.name };
		case 'array':
			return { label: 'Array', children: node.elements.map(recurse) };
		case 'record':
			return { label: 'Record', children: node.members.map(memberEntry) };
		case 'member':
			return { label: 'Member', value: node.name, children: [recurse(node.object)] };
		case 'binary':
			return {
				label: 'Binary',
				value: node.operator,
				children: [labelled('left', node.left), labelled('right', node.right)],
			};
		case 'unary':
			return { label: 'Unary', value: node.operator, children: [recurse(node.argument)] };
		case 'fallback':
			return {
				label: 'Fallback',
				children: [labelled('path', node.path), labelled('fallback', node.fallback)],
			};
		case 'call':
			return {
				label: 'Call',
				value: node.name,
				children: node.args.length > 0 ? node.args.map(recurse) : undefined,
			};
		case 'if':
			return {
				label: 'If',
				children: [
					labelled('condition', node.condition),
					labelled('consequent', node.consequent),
					labelled('alternate', node.alternate),
				],
			};
		case 'for':
			return {
				label: 'For',
				value: node.variable,
				children: [
					labelled('iterable', node.iterable),
					...(node.guard ? [labelled('guard', node.guard)] : []),
					...(node.accumulator
						? [
								{
									label: 'accumulator',
									value: node.accumulator.name,
									children: [recurse(node.accumulator.initial)],
								},
							]
						: []),
					labelled('body', node.body),
				],
			};
		case 'index':
			return {
				label: 'Index',
				children: [labelled('object', node.object), labelled('index', node.index)],
			};
		case 'range':
			return {
				label: 'Range',
				value: node.inclusive ? '..=' : '..',
				children: [labelled('from', node.from), labelled('to', node.to)],
			};
		case 'pipe':
			return {
				label: 'Pipe',
				value: node.name,
				children: [labelled('value', node.value), ...(node.args ?? []).map(recurse)],
			};
		case 'placeholder':
			return { label: 'Placeholder', value: '?' };
	}
}

function AstNode({ node }: { node: syntax.Program }) {
	const entry = { label: 'Program', children: node.statements.map(statementEntry) };
	return <AstEntryNode entry={entry} />;
}

function AstEntryNode({ entry }: { entry: AstEntry }) {
	const [open, setOpen] = useState(false);
	const hasChildren = entry.children && entry.children.length > 0;

	const monoStyle = { fontFamily: '"Maple Mono", monospace' };

	return (
		<div className="text-xs" style={monoStyle}>
			{hasChildren ? (
				<button
					type="button"
					className="flex items-center gap-1 py-0.5 text-left"
					style={{
						cursor: 'pointer',
						width: '100%',
						border: 'none',
						background: 'transparent',
						padding: 0,
						color: 'inherit',
					}}
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
					aria-label={`Toggle ${entry.label}`}
				>
					<span className="inline-block w-3 text-center" style={{ color: 'var(--color-fg-muted)' }}>
						{open ? '\u25BE' : '\u25B8'}
					</span>
					<span style={{ color: 'var(--color-accent)' }}>{entry.label}</span>
					{entry.value !== undefined && (
						<span style={{ color: 'var(--color-fg-muted)' }}>{entry.value}</span>
					)}
				</button>
			) : (
				<div className="flex items-center gap-1 py-0.5">
					<span className="inline-block w-3" />
					<span style={{ color: 'var(--color-accent)' }}>{entry.label}</span>
					{entry.value !== undefined && (
						<span style={{ color: 'var(--color-fg-muted)' }}>{entry.value}</span>
					)}
				</div>
			)}
			{open && hasChildren && (
				<div className="ml-3" style={{ borderLeft: '1px solid var(--color-border)' }}>
					<div className="ml-2">
						{entry.children!.map((child, i) => (
							<AstEntryNode key={i} entry={child} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// --- Shared ---

function SectionHeader({ children }: { children: React.ReactNode }) {
	return (
		<h2
			className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
			style={{ color: 'var(--color-fg-muted)' }}
		>
			{children}
		</h2>
	);
}

/**
 * Format a value for display. A program can nest arrays deeper than the call stack
 * can walk, which must not take the page down with it.
 */
function formatValue(value: unknown): string {
	try {
		return formatNested(value);
	} catch {
		return '(too deeply nested to display)';
	}
}

function formatNested(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(formatNested).join(', ')}]`;
	}
	if (typeof value === 'string') {
		return `"${value}"`;
	}
	// A record has no prototype, so it has no text of its own
	if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === null) {
		const fields = Object.entries(value).map(([name, field]) => `${name}: ${formatNested(field)}`);
		return fields.length === 0 ? '{}' : `{ ${fields.join(', ')} }`;
	}
	return String(value);
}
