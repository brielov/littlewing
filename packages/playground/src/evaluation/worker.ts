/// <reference lib="webworker" />
import type { Message, Request, Response } from './protocol.ts';

// The polyfill loads only where Temporal is missing, before the library reads dates
if (typeof globalThis.Temporal === 'undefined') await import('temporal-polyfill/global');
const { analyze } = await import('./analyze.ts');

const post = (message: Message) => self.postMessage(message);

/** Compiles and runs programs off the page's thread, one request at a time. */
self.addEventListener('message', (event: MessageEvent<Request>) => {
	const request = event.data;
	let response: Response;
	try {
		response = analyze(request, post);
	} catch (error) {
		// A fault in the playground or the library, which should still say something
		const message = error instanceof Error ? error.message : String(error);
		response = {
			id: request.id,
			phase: 'done',
			source: request.source,
			rejected: [],
			problems: [],
			inputs: undefined,
			outcome: { ok: false, message, code: 'internal-error' },
			scope: [],
			types: undefined,
			timing: undefined,
		};
	}
	post(response);
});

// Its modules are loaded, so what it is sent from now on runs at once
post({ ready: true });
