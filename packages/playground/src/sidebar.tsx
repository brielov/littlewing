import { type ASTNode, type RuntimeValue, visit } from "littlewing";
import { useState } from "react";
import type { UseEvaluationReturn } from "./use-evaluation.ts";

interface SidebarProps {
	evaluation: UseEvaluationReturn;
}

export function Sidebar({ evaluation }: SidebarProps) {
	const { result, inputVariables, overrides, scope, ast, timing, setOverride, clearOverride } =
		evaluation;

	return (
		<div
			className="flex h-full flex-col overflow-y-auto"
			style={{
				borderLeft: "1px solid var(--color-border)",
				backgroundColor: "var(--color-bg)",
			}}
		>
			<VariablesSection
				inputVariables={inputVariables}
				overrides={overrides}
				setOverride={setOverride}
				clearOverride={clearOverride}
			/>
			<OutputSection result={result} />
			<ScopeSection scope={scope} />
			<PerformanceSection timing={timing} />
			<AstSection ast={ast} />
		</div>
	);
}

// --- Variables Section ---

interface VariablesSectionProps {
	inputVariables: UseEvaluationReturn["inputVariables"];
	overrides: Map<string, RuntimeValue>;
	setOverride: (name: string, value: RuntimeValue) => void;
	clearOverride: (name: string) => void;
}

function VariablesSection({
	inputVariables,
	overrides,
	setOverride,
	clearOverride,
}: VariablesSectionProps) {
	return (
		<section style={{ borderBottom: "1px solid var(--color-border)" }}>
			<SectionHeader>Variables</SectionHeader>
			{inputVariables.length === 0 ? (
				<p className="px-4 pb-4 text-xs" style={{ color: "var(--color-fg-muted)" }}>
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
	defaultValue: RuntimeValue;
	override: RuntimeValue | undefined;
	setOverride: (name: string, value: RuntimeValue) => void;
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

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="text-xs font-medium" style={{ fontFamily: '"Maple Mono", monospace' }}>
					{name}
				</span>
				<TypeBadge type={type} />
				{isOverridden && (
					<button
						type="button"
						onClick={() => clearOverride(name)}
						className="ml-auto cursor-pointer text-xs"
						style={{ color: "var(--color-fg-muted)" }}
						title="Reset to default"
					>
						&times;
					</button>
				)}
			</div>
			<VariableInput
				name={name}
				type={type}
				currentValue={currentValue}
				setOverride={setOverride}
			/>
		</div>
	);
}

function TypeBadge({ type }: { type: string }) {
	return (
		<span
			className="rounded px-1.5 py-0.5 text-[10px] uppercase"
			style={{
				backgroundColor: "var(--color-bg-secondary)",
				color: "var(--color-fg-muted)",
			}}
		>
			{type}
		</span>
	);
}

interface VariableInputProps {
	name: string;
	type: string;
	currentValue: RuntimeValue;
	setOverride: (name: string, value: RuntimeValue) => void;
}

function VariableInput({ name, type, currentValue, setOverride }: VariableInputProps) {
	const inputStyle = {
		backgroundColor: "var(--color-bg-secondary)",
		color: "var(--color-fg)",
		border: "1px solid var(--color-border)",
		fontFamily: '"Maple Mono", monospace',
	};

	switch (type) {
		case "number":
			return (
				<input
					type="number"
					className="rounded px-2 py-1 text-xs"
					style={inputStyle}
					value={String(currentValue)}
					onChange={(e) => {
						const n = Number(e.target.value);
						if (!Number.isNaN(n)) {
							setOverride(name, n);
						}
					}}
				/>
			);

		case "string":
			return (
				<input
					type="text"
					className="rounded px-2 py-1 text-xs"
					style={inputStyle}
					value={String(currentValue)}
					onChange={(e) => setOverride(name, e.target.value)}
				/>
			);

		case "boolean":
			return (
				<button
					type="button"
					onClick={() => setOverride(name, !currentValue)}
					className="cursor-pointer rounded px-2 py-1 text-left text-xs"
					style={inputStyle}
				>
					{String(currentValue)}
				</button>
			);

		case "date":
			return (
				<input
					type="date"
					className="rounded px-2 py-1 text-xs"
					style={inputStyle}
					value={String(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainDate.from(e.target.value));
						}
					}}
				/>
			);

		case "time":
			return (
				<input
					type="time"
					className="rounded px-2 py-1 text-xs"
					step="1"
					style={inputStyle}
					value={String(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainTime.from(e.target.value));
						}
					}}
				/>
			);

		case "datetime":
			return (
				<input
					type="datetime-local"
					className="rounded px-2 py-1 text-xs"
					step="1"
					style={inputStyle}
					value={String(currentValue)}
					onChange={(e) => {
						if (e.target.value) {
							setOverride(name, Temporal.PlainDateTime.from(e.target.value));
						}
					}}
				/>
			);

		default:
			return (
				<span
					className="rounded px-2 py-1 text-xs"
					style={{
						backgroundColor: "var(--color-bg-secondary)",
						color: "var(--color-fg-muted)",
					}}
				>
					{formatValue(currentValue)}
				</span>
			);
	}
}

// --- Output Section ---

function OutputSection({ result }: { result: UseEvaluationReturn["result"] }) {
	return (
		<section style={{ borderBottom: "1px solid var(--color-border)" }}>
			<SectionHeader>Output</SectionHeader>
			<div className="px-4 pb-4">
				{result === null ? (
					<span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
						No output
					</span>
				) : result.ok ? (
					<pre
						className="whitespace-pre-wrap text-xs"
						style={{ color: "var(--color-success)", fontFamily: '"Maple Mono", monospace' }}
					>
						{formatValue(result.value)}
					</pre>
				) : (
					<pre
						className="whitespace-pre-wrap text-xs"
						style={{ color: "var(--color-error)", fontFamily: '"Maple Mono", monospace' }}
					>
						{result.error}
					</pre>
				)}
			</div>
		</section>
	);
}

// --- Scope Section ---

function ScopeSection({ scope }: { scope: Record<string, RuntimeValue> | null }) {
	if (scope === null) return null;

	const entries = Object.entries(scope);
	if (entries.length === 0) return null;

	return (
		<section style={{ borderBottom: "1px solid var(--color-border)" }}>
			<SectionHeader>Scope</SectionHeader>
			<div className="px-4 pb-4">
				<table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
					<tbody>
						{entries.map(([name, value]) => (
							<tr key={name}>
								<td
									className="py-0.5"
									style={{
										color: "var(--color-fg-muted)",
										fontFamily: '"Maple Mono", monospace',
										width: "40%",
									}}
								>
									{name}
								</td>
								<td
									className="truncate py-0.5 text-right"
									style={{ fontFamily: '"Maple Mono", monospace' }}
									title={formatValue(value)}
								>
									{formatValue(value)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

// --- Performance Section ---

function PerformanceSection({ timing }: { timing: UseEvaluationReturn["timing"] }) {
	if (timing === null) return null;

	const rows: Array<[string, number]> = [
		["Parse", timing.parseMs],
		["Optimize", timing.optimizeMs],
		["Evaluate", timing.evaluateMs],
		["Total", timing.totalMs],
	];

	return (
		<section style={{ borderBottom: "1px solid var(--color-border)" }}>
			<SectionHeader>Performance</SectionHeader>
			<div className="px-4 pb-4">
				<table className="w-full text-xs">
					<tbody>
						{rows.map(([label, ms]) => (
							<tr key={label}>
								<td className="py-0.5" style={{ color: "var(--color-fg-muted)" }}>
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

function AstSection({ ast }: { ast: ASTNode | null }) {
	if (ast === null) return null;

	return (
		<section style={{ borderBottom: "1px solid var(--color-border)" }}>
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

function buildAstEntries(node: ASTNode): AstEntry {
	return visit<AstEntry>(node, {
		Program: (n, recurse) => ({
			label: "Program",
			children: n.statements.map(recurse),
		}),
		NumberLiteral: (n) => ({
			label: "NumberLiteral",
			value: String(n.value),
		}),
		StringLiteral: (n) => ({
			label: "StringLiteral",
			value: `"${n.value}"`,
		}),
		BooleanLiteral: (n) => ({
			label: "BooleanLiteral",
			value: String(n.value),
		}),
		ArrayLiteral: (n, recurse) => ({
			label: "ArrayLiteral",
			children: n.elements.map(recurse),
		}),
		Identifier: (n) => ({
			label: "Identifier",
			value: n.name,
		}),
		BinaryOp: (n, recurse) => ({
			label: "BinaryOp",
			value: n.operator,
			children: [
				{ label: "left", children: [recurse(n.left)] },
				{ label: "right", children: [recurse(n.right)] },
			],
		}),
		UnaryOp: (n, recurse) => ({
			label: "UnaryOp",
			value: n.operator,
			children: [recurse(n.argument)],
		}),
		FunctionCall: (n, recurse) => ({
			label: "FunctionCall",
			value: n.name,
			children: n.args.length > 0 ? n.args.map(recurse) : undefined,
		}),
		Assignment: (n, recurse) => ({
			label: "Assignment",
			value: n.name,
			children: [recurse(n.value)],
		}),
		IfExpression: (n, recurse) => ({
			label: "IfExpression",
			children: [
				{ label: "condition", children: [recurse(n.condition)] },
				{ label: "consequent", children: [recurse(n.consequent)] },
				{ label: "alternate", children: [recurse(n.alternate)] },
			],
		}),
		ForExpression: (n, recurse) => ({
			label: "ForExpression",
			value: n.variable,
			children: [
				{ label: "iterable", children: [recurse(n.iterable)] },
				...(n.guard ? [{ label: "guard", children: [recurse(n.guard)] }] : []),
				{ label: "body", children: [recurse(n.body)] },
			],
		}),
		IndexAccess: (n, recurse) => ({
			label: "IndexAccess",
			children: [
				{ label: "object", children: [recurse(n.object)] },
				{ label: "index", children: [recurse(n.index)] },
			],
		}),
		RangeExpression: (n, recurse) => ({
			label: "RangeExpression",
			value: n.inclusive ? "..=" : "..",
			children: [
				{ label: "start", children: [recurse(n.start)] },
				{ label: "end", children: [recurse(n.end)] },
			],
		}),
	});
}

function AstNode({ node }: { node: ASTNode }) {
	const entry = buildAstEntries(node);
	return <AstEntryNode entry={entry} defaultOpen />;
}

function AstEntryNode({ entry, defaultOpen = false }: { entry: AstEntry; defaultOpen?: boolean }) {
	const [open, setOpen] = useState(defaultOpen);
	const hasChildren = entry.children && entry.children.length > 0;

	const monoStyle = { fontFamily: '"Maple Mono", monospace' };

	return (
		<div className="text-xs" style={monoStyle}>
			<div
				className="flex items-center gap-1 py-0.5"
				style={{ cursor: hasChildren ? "pointer" : "default" }}
				onClick={hasChildren ? () => setOpen((o) => !o) : undefined}
			>
				{hasChildren ? (
					<span className="inline-block w-3 text-center" style={{ color: "var(--color-fg-muted)" }}>
						{open ? "\u25BE" : "\u25B8"}
					</span>
				) : (
					<span className="inline-block w-3" />
				)}
				<span style={{ color: "var(--color-accent)" }}>{entry.label}</span>
				{entry.value !== undefined && (
					<span style={{ color: "var(--color-fg-muted)" }}>{entry.value}</span>
				)}
			</div>
			{open && hasChildren && (
				<div className="ml-3" style={{ borderLeft: "1px solid var(--color-border)" }}>
					<div className="ml-2">
						{entry.children!.map((child, i) => (
							<AstEntryNode key={i} entry={child} defaultOpen />
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
			style={{ color: "var(--color-fg-muted)" }}
		>
			{children}
		</h2>
	);
}

function formatValue(value: RuntimeValue): string {
	if (Array.isArray(value)) {
		return `[${value.map(formatValue).join(", ")}]`;
	}
	if (typeof value === "string") {
		return `"${value}"`;
	}
	return String(value);
}
