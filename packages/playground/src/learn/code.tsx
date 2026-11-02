import { useMemo } from 'react';
import { highlight, lex, spanClass } from '../language/tokens.ts';

/** Littlewing source, colored as the editor colors it. */
export function Code({ source }: { source: string }) {
	const pieces = useMemo(() => {
		const spans = highlight(source, lex(source));
		const out: { text: string; className: string }[] = [];
		let last = 0;
		for (const span of spans) {
			if (span.from > last) out.push({ text: source.slice(last, span.from), className: '' });
			out.push({ text: source.slice(span.from, span.to), className: spanClass(span) });
			last = span.to;
		}
		if (last < source.length) out.push({ text: source.slice(last), className: '' });
		return out;
	}, [source]);
	return (
		<code>
			{pieces.map(({ text, className }, i) =>
				className === '' ? (
					text
				) : (
					<span key={i} className={className}>
						{text}
					</span>
				),
			)}
		</code>
	);
}
