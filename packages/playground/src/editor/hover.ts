import { hoverTooltip } from '@codemirror/view';
import { FUNCTION_DESCRIPTIONS } from '../language/catalog.ts';
import { symbolAt } from '../language/scope.ts';
import { TokenKind } from '../language/tokens.ts';
import { functionInfo, nameInfo } from './info.ts';
import { analysisField, namesOf, symbolType, syntaxField, tokenAt } from './state.ts';

/** What a name is, shown when the pointer rests on it. */
export const hover = hoverTooltip((view, position, side) => {
	const { tokens } = view.state.field(syntaxField);
	const token = tokenAt(tokens, position, side);
	if (token?.kind !== TokenKind.Identifier) return null;

	// Names and functions are apart, and the tree says which this is
	const found = symbolAt(namesOf(view.state).symbols, token.from);
	let dom: HTMLElement;
	if (found !== undefined && found.occurrence.from === token.from) {
		const { symbol } = found;
		const { current } = view.state.field(analysisField);
		dom = nameInfo(symbol, symbolType(view.state, symbol), current);
	} else {
		const name = view.state.sliceDoc(token.from, token.to);
		const description = FUNCTION_DESCRIPTIONS.get(name);
		if (description === undefined) return null;
		dom = functionInfo(name, description);
	}
	return { pos: token.from, end: token.to, above: true, create: () => ({ dom }) };
});
