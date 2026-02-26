import type { Monaco } from "@monaco-editor/react";
import {
	type RuntimeValue,
	defaultContext,
	evaluateScope,
	extractAssignedVariables,
	parse,
	typeOf,
} from "littlewing";
import type { CancellationToken, IDisposable, Position, editor, languages } from "monaco-editor";
import { FUNCTION_SIGNATURES, formatSignature } from "./function-metadata.ts";
import tomorrowNightTheme from "./themes/tomorrow-night.json";
import tomorrowTheme from "./themes/tomorrow.json";

const KEYWORDS = ["if", "then", "else", "for", "in", "when", "into"];
const BUILTINS = Object.keys(defaultContext.functions ?? {});

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
 * Format a RuntimeValue for display in hover tooltips.
 */
function formatValue(value: RuntimeValue): string {
	if (typeof value === "string") return `"${value}"`;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		if (value.length > 5) {
			const head = value.slice(0, 5).map(formatValue).join(", ");
			return `[${head}, ... (${value.length} items)]`;
		}
		return `[${value.map(formatValue).join(", ")}]`;
	}
	return String(value);
}

/**
 * Shared language state persisted through HMR so existing providers can
 * read updates from newer module instances.
 */
interface PlaygroundLanguageState {
	hoverScope: Record<string, RuntimeValue> | null;
	providerDisposables: IDisposable[];
	modelScopeCache: Map<string, { version: number; scope: Record<string, RuntimeValue> | null }>;
}

const languageState: PlaygroundLanguageState = import.meta.hot?.data?.languageState ?? {
	hoverScope: null,
	providerDisposables: [],
	modelScopeCache: new Map(),
};

function getModelScope(model: editor.ITextModel): Record<string, RuntimeValue> | null {
	const modelId = model.uri.toString();
	const version = model.getVersionId();
	const cached = languageState.modelScopeCache.get(modelId);
	if (cached && cached.version === version) {
		return cached.scope;
	}

	let scope: Record<string, RuntimeValue> | null = null;
	try {
		scope = evaluateScope(parse(model.getValue()), defaultContext);
	} catch {
		scope = null;
	}

	languageState.modelScopeCache.set(modelId, { version, scope });
	return scope;
}

/**
 * Update the scope used by the hover provider to display variable types and values.
 */
export function setHoverScope(scope: Record<string, RuntimeValue> | null): void {
	languageState.hoverScope = scope;
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

	monaco.languages.register({ id: "littlewing" });

	monaco.languages.setMonarchTokensProvider("littlewing", {
		keywords: KEYWORDS,
		builtins: BUILTINS,

		operators: [
			"=",
			"==",
			"!=",
			"<",
			">",
			"<=",
			">=",
			"&&",
			"||",
			"|>",
			"+",
			"-",
			"*",
			"/",
			"%",
			"^",
			"!",
			"..",
			"..=",
		],

		tokenizer: {
			root: [
				// Comments
				[/\/\/.*$/, "comment"],

				// Strings
				[/"/, "string", "@string"],

				// Numbers
				[/\d+\.\d+/, "number.float"],
				[/\d+/, "number"],

				// Identifiers, keywords, booleans, builtins
				[
					/[a-zA-Z_]\w*/,
					{
						cases: {
							"@keywords": "keyword",
							true: "constant.language.boolean",
							false: "constant.language.boolean",
							"@builtins": "support.function",
							"@default": "identifier",
						},
					},
				],

				// Operators (order matters: longest match first)
				[/\.\.=/, "operator"],
				[/\.\./, "operator"],
				[/[=!<>]=/, "operator"],
				[/&&/, "operator"],
				[/\|\|/, "operator"],
				[/\|>/, "operator"],
				[/\?/, "operator"],
				[/[+\-*/%^=!<>]/, "operator"],

				// Brackets
				[/[[\]()]/, "@brackets"],

				// Comma
				[/,/, "delimiter"],

				// Whitespace
				[/\s+/, "white"],
			],

			string: [
				[/[^"\\]+/, "string"],
				[/\\./, "string.escape"],
				[/"/, "string", "@pop"],
			],
		},
	});

	monaco.languages.setLanguageConfiguration("littlewing", {
		comments: { lineComment: "//" },
		brackets: [
			["[", "]"],
			["(", ")"],
		],
		autoClosingPairs: [
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
			{ open: '"', close: '"', notIn: ["string"] },
		],
		surroundingPairs: [
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
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
		...["true", "false"].map((b) => ({
			label: b,
			kind: monaco.languages.CompletionItemKind.Constant,
			insertText: b,
		})),
		...BUILTINS.map((f) => {
			const sig = FUNCTION_SIGNATURES[f];
			return {
				label: f,
				kind: monaco.languages.CompletionItemKind.Function,
				insertText: `${f}($0)`,
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				detail: sig ? formatSignature(f) : undefined,
			};
		}),
	];

	languageState.providerDisposables.push(
		monaco.languages.registerCompletionItemProvider("littlewing", {
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
		monaco.languages.registerSignatureHelpProvider("littlewing", {
			signatureHelpTriggerCharacters: ["(", ","],
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
					if (ch === ")") {
						depth++;
					} else if (ch === "(") {
						if (depth === 0) {
							funcEnd = i;
							break;
						}
						depth--;
					} else if (ch === "," && depth === 0) {
						commas++;
					}
				}

				if (funcEnd < 0) return null;

				// Extract the function name before the "("
				const before = text.slice(0, funcEnd);
				const match = /([A-Z_][A-Z0-9_]*)\s*$/i.exec(before);
				if (!match) return null;

				const funcName = match[1]!;
				const sig = FUNCTION_SIGNATURES[funcName];
				if (!sig) return null;

				const paramLabels = sig.parameters.map((p) => `${p.label}: ${p.type}`);
				const label = `${funcName}(${paramLabels.join(", ")})`;

				return {
					value: {
						signatures: [
							{
								label,
								documentation: sig.description,
								parameters: sig.parameters.map((p) => ({
									label: `${p.label}: ${p.type}`,
									documentation: p.description,
								})),
							},
						],
						activeSignature: 0,
						activeParameter: Math.min(commas, sig.parameters.length - 1),
					},
					dispose: () => {},
				};
			},
		}),
	);

	// --- Hover provider ---

	languageState.providerDisposables.push(
		monaco.languages.registerHoverProvider("littlewing", {
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
				const sig = FUNCTION_SIGNATURES[word.word];
				if (sig) {
					const signature = formatSignature(word.word);
					return {
						contents: [{ value: `\`\`\`\n${signature}\n\`\`\`` }, { value: sig.description }],
						range,
					};
				}

				// Variable hover
				const runtimeScope = languageState.hoverScope;
				if (runtimeScope && Object.hasOwn(runtimeScope, word.word)) {
					const value = runtimeScope[word.word] as RuntimeValue;
					const type = typeOf(value);
					const preview = formatValue(value);
					return {
						contents: [{ value: `\`\`\`\n${word.word}: ${type} = ${preview}\n\`\`\`` }],
						range,
					};
				}

				const modelScope = getModelScope(model);
				if (modelScope && Object.hasOwn(modelScope, word.word)) {
					const value = modelScope[word.word] as RuntimeValue;
					const type = typeOf(value);
					const preview = formatValue(value);
					return {
						contents: [{ value: `\`\`\`\n${word.word}: ${type} = ${preview}\n\`\`\`` }],
						range,
					};
				}

				return null;
			},
		}),
	);

	// --- Code action provider (quick fix suggestions for typos) ---

	languageState.providerDisposables.push(
		monaco.languages.registerCodeActionProvider("littlewing", {
			provideCodeActions: (
				model: editor.ITextModel,
				_range: unknown,
				context: languages.CodeActionContext,
			): languages.ProviderResult<languages.CodeActionList> => {
				const actions: languages.CodeAction[] = [];

				for (const marker of context.markers) {
					const msg = marker.message;

					let prefix: string;
					let candidates: string[];

					if (msg.startsWith("Undefined variable: ")) {
						prefix = "Undefined variable: ";
						// Collect variable names from all available sources.
						// hoverScope/modelScope may be null when evaluation fails,
						// so also extract assigned names directly from the AST.
						const names = new Set<string>();
						const runtimeScope = languageState.hoverScope;
						if (runtimeScope) {
							for (const key of Object.keys(runtimeScope)) names.add(key);
						}
						const modelScope = getModelScope(model);
						if (modelScope) {
							for (const key of Object.keys(modelScope)) names.add(key);
						}
						try {
							for (const name of extractAssignedVariables(parse(model.getValue()))) {
								names.add(name);
							}
						} catch {
							// Parse failure — no additional candidates
						}
						candidates = [...names];
					} else if (msg.startsWith("Undefined function: ")) {
						prefix = "Undefined function: ";
						candidates = BUILTINS;
					} else {
						continue;
					}

					// Extract the undefined name: text between prefix and " (line ..." suffix
					const suffixIndex = msg.indexOf(" (line ", prefix.length);
					if (suffixIndex < 0) continue;
					const name = msg.slice(prefix.length, suffixIndex);
					if (name.length === 0) continue;

					// Score candidates by Levenshtein distance
					const scored: { candidate: string; distance: number }[] = [];
					for (const candidate of candidates) {
						const distance = levenshteinDistance(name, candidate);
						if (distance > 0 && distance <= 3 && distance < name.length) {
							scored.push({ candidate, distance });
						}
					}

					scored.sort((a, b) => a.distance - b.distance);
					const top = scored.slice(0, 3);

					for (let i = 0; i < top.length; i++) {
						const { candidate } = top[i]!;
						actions.push({
							title: `Replace with '${candidate}'`,
							kind: "quickfix",
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
	monaco.editor.defineTheme("tomorrow", tomorrowTheme);
	monaco.editor.defineTheme("tomorrow-night", tomorrowNightTheme);
}
