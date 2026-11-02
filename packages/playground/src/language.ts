import type { Monaco } from '@monaco-editor/react';
import {
	coreFunctions,
	describeFunction,
	type FunctionDescription,
	type OverloadDescription,
} from 'littlewing';
import type { CancellationToken, IDisposable, Position, editor, languages } from 'monaco-editor';
import { FUNCTIONS } from './use-evaluation.ts';
import tomorrowNightTheme from './themes/tomorrow-night.json';
import tomorrowTheme from './themes/tomorrow.json';

const KEYWORDS = ['if', 'then', 'else', 'for', 'in', 'when', 'into'];
const DESCRIPTIONS = new Map<string, FunctionDescription>(
	Object.entries({ ...coreFunctions, ...FUNCTIONS }).map(([name, definition]) => [
		name,
		describeFunction(definition),
	]),
);
const BUILTINS = [...DESCRIPTIONS.keys()];

/** A parameter as an editor shows it, as `digits?: number`. */
function parameterText(parameter: OverloadDescription['args'][number]): string {
	return `${parameter.name}${parameter.optional ? '?' : ''}: ${parameter.type}`;
}

/** One way to call a function, as `ROUND(value: number) → number`. */
function signatureText(name: string, overload: OverloadDescription): string {
	return `${name}(${overload.args.map(parameterText).join(', ')}) → ${overload.returns}`;
}

/** Every way to call a function, one to a line. */
function formatSignatures(name: string, description: FunctionDescription): string {
	return description.overloads.map((overload) => signatureText(name, overload)).join('\n');
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Case-insensitive since function names are uppercase and variables lowercase.
 */
function levenshteinDistance(a: string, b: string): number {
	const al = a.toLowerCase();
	const bl = b.toLowerCase();
	const m = al.length;
	const n = bl.length;

	// Use a single flat array for the DP matrix (two rows).
	let prev = new Uint16Array(n + 1);
	let curr = new Uint16Array(n + 1);

	for (let j = 0; j <= n; j++) prev[j] = j;

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = al.charCodeAt(i - 1) === bl.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(
				prev[j]! + 1, // deletion
				curr[j - 1]! + 1, // insertion
				prev[j - 1]! + cost, // substitution
			);
		}
		[prev, curr] = [curr, prev];
	}

	return prev[n]!;
}

/**
 * Shared language state persisted through HMR so existing providers can
 * read updates from newer module instances.
 */
interface PlaygroundLanguageState {
	hoverState: HoverState;
	providerDisposables: IDisposable[];
}

interface HoverState {
	inputTypes: ReadonlyMap<string, string>;
}

const languageState: PlaygroundLanguageState = import.meta.hot?.data?.languageState ?? {
	hoverState: { inputTypes: new Map() },
	providerDisposables: [],
};

/**
 * Update the compiler-derived metadata consumed by Monaco providers.
 */
export function setLanguageAnalysis(state: HoverState): void {
	languageState.hoverState = state;
}

/**
 * Previously registered provider disposables. Disposed on re-registration
 * so that Vite HMR doesn't accumulate duplicate providers.
 *
 * Persisted across HMR via `import.meta.hot.data` so the new module
 * instance can dispose providers registered by the old module.
 */
if (import.meta.hot) {
	import.meta.hot.data.languageState = languageState;
}

export function registerLittlewingLanguage(monaco: Monaco): void {
	// Dispose previous provider registrations (handles Vite HMR)
	for (const d of languageState.providerDisposables) d.dispose();
	languageState.providerDisposables.length = 0;

	monaco.languages.register({ id: 'littlewing' });

	monaco.languages.setMonarchTokensProvider('littlewing', {
		keywords: KEYWORDS,
		builtins: BUILTINS,

		operators: [
			'=',
			'==',
			'!=',
			'<',
			'>',
			'<=',
			'>=',
			'&&',
			'||',
			'|>',
			'+',
			'-',
			'*',
			'/',
			'%',
			'^',
			'!',
			'..',
			'..=',
		],

		tokenizer: {
			root: [
				// Comments
				[/\/\/.*$/, 'comment'],

				// Strings
				[/"/, 'string', '@string'],

				// Numbers
				[/\d+(\.\d+)?[eE][+-]?\d+/, 'number.float'],
				[/\d+\.\d+/, 'number.float'],
				[/\d+/, 'number'],

				// Identifiers, keywords, booleans, builtins
				[
					/[a-zA-Z_]\w*/,
					{
						cases: {
							'@keywords': 'keyword',
							true: 'constant.language.boolean',
							false: 'constant.language.boolean',
							'@builtins': 'support.function',
							'@default': 'identifier',
						},
					},
				],

				// Operators (order matters: longest match first)
				[/\.\.=/, 'operator'],
				[/\.\./, 'operator'],
				[/[=!<>]=/, 'operator'],
				[/&&/, 'operator'],
				[/\|\|/, 'operator'],
				[/\|>/, 'operator'],
				[/\?/, 'operator'],
				[/[+\-*/%^=!<>]/, 'operator'],

				// Brackets
				[/[[\]()]/, '@brackets'],

				// Comma and semicolon
				[/[,;]/, 'delimiter'],

				// Whitespace
				[/\s+/, 'white'],
			],

			string: [
				[/[^"\\]+/, 'string'],
				[/\\./, 'string.escape'],
				[/"/, 'string', '@pop'],
			],
		},
	});

	monaco.languages.setLanguageConfiguration('littlewing', {
		comments: { lineComment: '//' },
		brackets: [
			['[', ']'],
			['(', ')'],
			['{', '}'],
		],
		autoClosingPairs: [
			{ open: '[', close: ']' },
			{ open: '(', close: ')' },
			{ open: '{', close: '}' },
			{ open: '"', close: '"', notIn: ['string'] },
		],
		surroundingPairs: [
			{ open: '[', close: ']' },
			{ open: '(', close: ')' },
			{ open: '"', close: '"' },
		],
	});

	// --- Completion provider ---

	const completionItems = [
		...KEYWORDS.map((k) => ({
			label: k,
			kind: monaco.languages.CompletionItemKind.Keyword,
			insertText: k,
		})),
		...['true', 'false'].map((b) => ({
			label: b,
			kind: monaco.languages.CompletionItemKind.Constant,
			insertText: b,
		})),
		...[...DESCRIPTIONS].map(([name, description]) => ({
			label: name,
			kind: monaco.languages.CompletionItemKind.Function,
			insertText: `${name}($0)`,
			insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
			detail: formatSignatures(name, description),
		})),
	];

	languageState.providerDisposables.push(
		monaco.languages.registerCompletionItemProvider('littlewing', {
			provideCompletionItems: (model: editor.ITextModel, position: Position) => {
				const word = model.getWordUntilPosition(position);
				const range = {
					startLineNumber: position.lineNumber,
					startColumn: word.startColumn,
					endLineNumber: position.lineNumber,
					endColumn: word.endColumn,
				};
				return {
					suggestions: completionItems.map((item) => ({
						...item,
						range,
					})),
				};
			},
		}),
	);

	// --- Signature help provider ---

	languageState.providerDisposables.push(
		monaco.languages.registerSignatureHelpProvider('littlewing', {
			signatureHelpTriggerCharacters: ['(', ','],
			provideSignatureHelp: (
				model: editor.ITextModel,
				position: Position,
				_token: CancellationToken,
				_context: languages.SignatureHelpContext,
			): languages.ProviderResult<languages.SignatureHelpResult> => {
				const text = model.getValueInRange({
					startLineNumber: position.lineNumber,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column,
				});

				// Walk backward to find the enclosing function call
				let depth = 0;
				let commas = 0;
				let funcEnd = -1;

				for (let i = text.length - 1; i >= 0; i--) {
					const ch = text[i];
					if (ch === ')') {
						depth++;
					} else if (ch === '(') {
						if (depth === 0) {
							funcEnd = i;
							break;
						}
						depth--;
					} else if (ch === ',' && depth === 0) {
						commas++;
					}
				}

				if (funcEnd < 0) return null;

				// Extract the function name before the "("
				const before = text.slice(0, funcEnd);
				const match = /([A-Z_][A-Z0-9_]*)\s*$/i.exec(before);
				if (!match) return null;

				const funcName = match[1]!;
				const description = DESCRIPTIONS.get(funcName);
				if (description === undefined) return null;

				const signatures = description.overloads.map((overload) => ({
					label: signatureText(funcName, overload),
					documentation: description.doc,
					parameters: overload.args.map((parameter) => ({ label: parameterText(parameter) })),
				}));
				const longest = Math.max(...description.overloads.map(({ args }) => args.length));

				return {
					value: {
						signatures,
						activeSignature: 0,
						activeParameter: Math.min(commas, longest - 1),
					},
					dispose: () => {},
				};
			},
		}),
	);

	// --- Hover provider ---

	languageState.providerDisposables.push(
		monaco.languages.registerHoverProvider('littlewing', {
			provideHover: (
				model: editor.ITextModel,
				position: Position,
			): languages.ProviderResult<languages.Hover> => {
				const word = model.getWordAtPosition(position);
				if (!word) return null;

				const range = {
					startLineNumber: position.lineNumber,
					startColumn: word.startColumn,
					endLineNumber: position.lineNumber,
					endColumn: word.endColumn,
				};

				// Function hover
				const description = DESCRIPTIONS.get(word.word);
				if (description !== undefined) {
					const signatures = formatSignatures(word.word, description);
					return {
						contents: [
							{ value: `\`\`\`\n${signatures}\n\`\`\`` },
							{ value: description.doc ?? '' },
						],
						range,
					};
				}

				// Input hover
				const type = languageState.hoverState.inputTypes.get(word.word);
				if (type !== undefined) {
					return { contents: [{ value: `\`\`\`\n${word.word}: ${type}\n\`\`\`` }], range };
				}

				return null;
			},
		}),
	);

	// --- Code action provider (quick fix suggestions for typos) ---

	languageState.providerDisposables.push(
		monaco.languages.registerCodeActionProvider('littlewing', {
			provideCodeActions: (
				model: editor.ITextModel,
				_range: unknown,
				context: languages.CodeActionContext,
			): languages.ProviderResult<languages.CodeActionList> => {
				const actions: languages.CodeAction[] = [];

				for (const marker of context.markers) {
					// The diagnostic marks exactly the name
					if (marker.code !== 'unknown-function') continue;
					const name = model.getValueInRange(marker);
					if (name.length === 0) continue;

					// Score candidates by Levenshtein distance
					const scored: { candidate: string; distance: number }[] = [];
					for (const candidate of BUILTINS) {
						const distance = levenshteinDistance(name, candidate);
						if (candidate !== name && distance <= 3 && distance < name.length) {
							scored.push({ candidate, distance });
						}
					}

					scored.sort((a, b) => a.distance - b.distance);
					const top = scored.slice(0, 3);

					for (let i = 0; i < top.length; i++) {
						const { candidate } = top[i]!;
						actions.push({
							title: `Replace with '${candidate}'`,
							kind: 'quickfix',
							diagnostics: [marker],
							isPreferred: i === 0,
							edit: {
								edits: [
									{
										resource: model.uri,
										textEdit: {
											range: {
												startLineNumber: marker.startLineNumber,
												startColumn: marker.startColumn,
												endLineNumber: marker.endLineNumber,
												endColumn: marker.endColumn,
											},
											text: candidate,
										},
										versionId: model.getVersionId(),
									},
								],
							},
						});
					}
				}

				return { actions, dispose: () => {} };
			},
		}),
	);
}

export function registerLittlewingThemes(monaco: Monaco): void {
	monaco.editor.defineTheme('tomorrow', tomorrowTheme);
	monaco.editor.defineTheme('tomorrow-night', tomorrowNightTheme);
}
