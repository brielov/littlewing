import { hoverTooltip } from '@codemirror/view';
import { FUNCTION_DESCRIPTIONS } from '../language/catalog.ts';
import { TokenKind } from '../language/tokens.ts';
import { functionInfo, typedInfo } from './info.ts';
import { analysisField, lexedField, tokenAt } from './state.ts';

/** What a name is, shown when the pointer rests on it. */
export const hover = hoverTooltip((view, position, side) => {
	const { tokens } = view.state.field(lexedField);
	const token = tokenAt(tokens, position, side);
	if (token?.kind !== TokenKind.Identifier) return null;

	const name = view.state.sliceDoc(token.from, token.to);
	const description = FUNCTION_DESCRIPTIONS.get(name);
	const type = view.state.field(analysisField).inputTypes.get(name);
	let dom: HTMLElement;
	if (description !== undefined) dom = functionInfo(name, description);
	else if (type !== undefined) dom = typedInfo(name, type);
	else return null;

	return { pos: token.from, end: token.to, above: true, create: () => ({ dom }) };
});
