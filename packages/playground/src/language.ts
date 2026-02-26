import type { Monaco } from "@monaco-editor/react";
import { defaultContext } from "littlewing";
import type { Position, editor } from "monaco-editor";
import tomorrowNightTheme from "./themes/tomorrow-night.json";
import tomorrowTheme from "./themes/tomorrow.json";

const KEYWORDS = ["if", "then", "else", "for", "in", "when", "into"];
const BUILTINS = Object.keys(defaultContext.functions ?? {});

export function registerLittlewingLanguage(monaco: Monaco): void {
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
		...BUILTINS.map((f) => ({
			label: f,
			kind: monaco.languages.CompletionItemKind.Function,
			insertText: `${f}($0)`,
			insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
		})),
	];

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
	});
}

export function registerLittlewingThemes(monaco: Monaco): void {
	monaco.editor.defineTheme("tomorrow", tomorrowTheme);
	monaco.editor.defineTheme("tomorrow-night", tomorrowNightTheme);
}
