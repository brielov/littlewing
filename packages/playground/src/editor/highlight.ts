import { RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import type { Style } from '../language/tokens.ts';
import { lexedField } from './state.ts';

const marks = new Map<Style, Decoration>();

function mark(style: Style): Decoration {
	let decoration = marks.get(style);
	if (decoration === undefined) {
		decoration = Decoration.mark({ class: `tok-${style}` });
		marks.set(style, decoration);
	}
	return decoration;
}

/** Colors for what is on screen, from the spans the whole document was lexed into. */
function decorate(view: EditorView): DecorationSet {
	const { spans } = view.state.field(lexedField);
	const builder = new RangeSetBuilder<Decoration>();
	// A span across two visible ranges is added once
	let next = 0;
	for (const { from, to } of view.visibleRanges) {
		// The first span that ends past `from`
		let low = next;
		let high = spans.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (spans[middle]!.to <= from) low = middle + 1;
			else high = middle;
		}
		for (let i = low; i < spans.length && spans[i]!.from < to; i++) {
			const span = spans[i]!;
			builder.add(span.from, span.to, mark(span.style));
			next = i + 1;
		}
	}
	return builder.finish();
}

export const highlighting = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = decorate(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) this.decorations = decorate(update.view);
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);
