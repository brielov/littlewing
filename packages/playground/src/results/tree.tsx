import type { syntax } from 'littlewing';
import { useState } from 'react';

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

/** The syntax tree of a program, each node opening to its children. */
export function SyntaxTree({ program }: { program: syntax.Program }) {
	const entry = { label: 'Program', children: program.statements.map(statementEntry) };
	return <AstEntryNode entry={entry} />;
}

function AstEntryNode({ entry }: { entry: AstEntry }) {
	const [open, setOpen] = useState(false);
	const children = entry.children ?? [];
	const label = (
		<>
			<span className="text-(--color-accent)">{entry.label}</span>
			{entry.value !== undefined && <span className="text-(--color-fg-muted)">{entry.value}</span>}
		</>
	);
	return (
		<div className="text-xs">
			{children.length > 0 ? (
				<button
					type="button"
					className="flex w-full cursor-pointer items-center gap-1 py-0.5 text-left"
					onClick={() => setOpen((was) => !was)}
					aria-expanded={open}
				>
					<span className="inline-block w-3 text-center text-(--color-fg-muted)">
						{open ? '▾' : '▸'}
					</span>
					{label}
				</button>
			) : (
				<div className="flex items-center gap-1 py-0.5">
					<span className="inline-block w-3" />
					{label}
				</div>
			)}
			{open && children.length > 0 && (
				<div className="ml-1.5 border-l border-(--color-border) pl-2.5">
					{children.map((child, i) => (
						<AstEntryNode key={i} entry={child} />
					))}
				</div>
			)}
		</div>
	);
}
