import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const source = resolve(import.meta.dirname, '../littlewing/src');

export default defineConfig({
	plugins: [react(), ...tailwindcss()],
	resolve: {
		alias: [
			{ find: /^littlewing$/, replacement: `${source}/index.ts` },
			{ find: /^littlewing\/(.+)$/, replacement: `${source}/$1.ts` },
		],
	},
});
