import type { FunctionDescription, TypeDescription } from 'littlewing';
import { parameterText, signatureText } from '../language/catalog.ts';
import type { NameSymbol, SymbolKind } from '../language/scope.ts';
import { typeText } from '../language/types.ts';

/** A function as a tooltip shows it: each way to call it, then what it does. */
export function functionInfo(
	name: string,
	description: FunctionDescription,
	active?: { argument: number },
): HTMLElement {
	const root = document.createElement('div');
	root.className = 'lw-info';
	for (const overload of description.overloads) {
		const line = document.createElement('code');
		line.className = 'lw-signature';
		if (active === undefined) {
			line.textContent = signatureText(name, overload);
		} else {
			// The parameter being typed stands out
			line.append(`${name}(`);
			overload.args.forEach((parameter, i) => {
				if (i > 0) line.append(', ');
				const text = parameterText(parameter);
				if (i === active.argument) {
					const strong = document.createElement('strong');
					strong.textContent = text;
					line.append(strong);
				} else {
					line.append(text);
				}
			});
			line.append(`) → ${overload.returns}`);
		}
		root.append(line);
	}
	if (description.doc !== undefined) {
		const doc = document.createElement('p');
		doc.textContent = description.doc;
		root.append(doc);
	}
	return root;
}

const KINDS: Record<SymbolKind, string> = {
	binding: 'binding',
	input: 'input with a default',
	free: 'input',
	loop: 'loop variable',
	accumulator: 'accumulator',
};

/** A name with what it is and its type, as `price: number`, under `input`. */
export function nameInfo(
	symbol: NameSymbol,
	type: TypeDescription | undefined,
	current: boolean,
): HTMLElement {
	const root = document.createElement('div');
	root.className = 'lw-info';
	const line = document.createElement('code');
	line.className = 'lw-signature';
	line.textContent = type === undefined ? symbol.name : `${symbol.name}: ${typeText(type)}`;
	const kind = document.createElement('p');
	// A type error elsewhere leaves the types of the last program that had them
	const stale = type !== undefined && !current ? ', as last known' : '';
	kind.textContent = `${KINDS[symbol.kind]}${stale}`;
	root.append(line, kind);
	return root;
}
