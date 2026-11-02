import { EditorView } from '@codemirror/view';

/**
 * The editor in the page's Tomorrow colors, which are CSS variables that follow
 * the color scheme, so the theme never has to be swapped.
 */
export const theme = EditorView.theme({
	'&': {
		height: '100%',
		color: 'var(--color-fg)',
		backgroundColor: 'var(--color-bg)',
		fontSize: '14px',
	},
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': {
		fontFamily: "'Maple Mono', monospace",
		lineHeight: '22px',
		fontVariantLigatures: 'contextual',
	},
	'.cm-content': { padding: '16px 0', caretColor: 'var(--editor-cursor)' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-cursor)', borderLeftWidth: '2px' },
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
		{ backgroundColor: 'var(--color-selection)' },
	'.cm-activeLine': { backgroundColor: 'var(--color-bg-secondary)' },
	'.cm-gutters': {
		backgroundColor: 'var(--color-bg)',
		color: 'var(--editor-line-number)',
		border: 'none',
	},
	'.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 16px', minWidth: '24px' },
	'.cm-activeLineGutter': {
		backgroundColor: 'transparent',
		color: 'var(--editor-line-number-active)',
	},
	'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
		backgroundColor: 'rgb(0 100 0 / 0.1)',
		outline: '1px solid var(--editor-bracket-match)',
	},
	'.cm-nonmatchingBracket': { backgroundColor: 'transparent' },
	'.cm-selectionMatch': {
		backgroundColor: 'color-mix(in srgb, var(--color-selection) 60%, transparent)',
	},
	// The base theme's colors are for a light page, and these follow the scheme
	'.cm-searchMatch': {
		backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
		outline: '1px solid var(--color-warning)',
	},
	'.cm-snippetField': {
		backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
	},
	'.cm-snippetFieldPosition': { borderLeftColor: 'var(--color-accent)' },
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: 'color-mix(in srgb, var(--color-warning) 25%, transparent)',
	},
	'.cm-tooltip': {
		backgroundColor: 'var(--color-bg-secondary)',
		color: 'var(--color-fg)',
		border: '1px solid var(--color-border)',
		borderRadius: '6px',
		fontFamily: "'Maple Mono', monospace",
		fontSize: '12px',
		boxShadow: '0 4px 16px rgb(0 0 0 / 0.12)',
		overflow: 'hidden',
	},
	'.cm-tooltip-autocomplete > ul': { fontFamily: "'Maple Mono', monospace", maxHeight: '16em' },
	'.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px', lineHeight: '20px' },
	'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
		backgroundColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
		color: 'var(--color-fg)',
	},
	'.cm-completionDetail': {
		color: 'var(--color-fg-muted)',
		fontStyle: 'normal',
		marginLeft: '8px',
	},
	'.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--color-accent)' },
	'.cm-completionInfo': { whiteSpace: 'pre-wrap', padding: '6px 10px', maxWidth: '420px' },
	'.cm-diagnostic': { padding: '6px 10px', borderLeftWidth: '3px', fontFamily: 'inherit' },
	'.cm-diagnostic-error': { borderLeftColor: 'var(--color-error)' },
	'.cm-diagnostic-warning': { borderLeftColor: 'var(--color-warning)' },
	'.cm-diagnosticSource': { color: 'var(--color-fg-muted)', opacity: 1 },
	'.cm-diagnosticAction': {
		backgroundColor: 'var(--color-accent)',
		color: 'var(--color-bg)',
		borderRadius: '4px',
		padding: '1px 8px',
		font: 'inherit',
	},
	'.cm-lintRange-error': {
		backgroundImage: 'none',
		textDecoration: 'underline wavy var(--color-error)',
		textUnderlineOffset: '4px',
	},
	'.cm-lintRange-warning': {
		backgroundImage: 'none',
		textDecoration: 'underline wavy var(--color-warning)',
		textUnderlineOffset: '4px',
	},
	// Marks nest and their classes merge, so a faded range keeps the underlines in it
	'.cm-lintRange-hint': { backgroundImage: 'none', opacity: '0.55' },
	'.cm-diagnostic-hint': { borderLeftColor: 'var(--color-fg-muted)' },
	'.cm-panels': { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-fg)' },
	'.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--color-border)' },
	'.cm-textfield': {
		backgroundColor: 'var(--color-bg)',
		border: '1px solid var(--color-border)',
		borderRadius: '4px',
	},
	'.cm-button': {
		backgroundImage: 'none',
		backgroundColor: 'var(--color-bg)',
		border: '1px solid var(--color-border)',
		borderRadius: '4px',
	},
	'.lw-reference': { backgroundColor: 'var(--editor-reference)' },
	'.lw-definition': { backgroundColor: 'var(--editor-reference-definition)' },
	'.lw-rename': { padding: '6px', display: 'grid', gap: '4px', minWidth: '220px' },
	'.lw-rename input': {
		font: 'inherit',
		fontSize: '13px',
		color: 'var(--color-fg)',
		backgroundColor: 'var(--color-bg)',
		border: '1px solid var(--color-accent)',
		borderRadius: '4px',
		padding: '2px 6px',
		outline: 'none',
	},
	'.lw-rename p': { margin: '0 2px', color: 'var(--color-fg-muted)', fontSize: '11px' },
	'.lw-rename p.lw-rename-error': { color: 'var(--color-error)' },
	'.lw-info': { padding: '6px 10px', maxWidth: '480px', display: 'grid', gap: '2px' },
	'.lw-signature': { whiteSpace: 'pre-wrap' },
	'.lw-signature strong': {
		color: 'var(--color-accent)',
		fontWeight: 'normal',
		textDecoration: 'underline',
	},
	'.lw-info p': { margin: '4px 0 0', color: 'var(--color-fg-muted)', fontFamily: 'inherit' },
});
