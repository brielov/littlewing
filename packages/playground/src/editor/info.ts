import type { FunctionDescription } from 'littlewing';
import { parameterText, signatureText } from '../language/catalog.ts';

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

/** A name with its type, as `price: number`. */
export function typedInfo(name: string, type: string): HTMLElement {
	const root = document.createElement('div');
	root.className = 'lw-info';
	const line = document.createElement('code');
	line.className = 'lw-signature';
	line.textContent = `${name}: ${type}`;
	root.append(line);
	return root;
}
