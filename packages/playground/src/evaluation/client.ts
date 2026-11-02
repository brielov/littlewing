import type { Given, Message, Request, Response } from './protocol.ts';

/** How long a program may run before the worker running it is replaced. */
export const TIMEOUT_MS = 5_000;

/** How long a worker may take to load, over a slow connection, before it is given up on. */
export const LOAD_MS = 30_000;

interface Running {
	readonly request: Request;
	readonly timer: ReturnType<typeof setTimeout>;
	/** What compiling found, which still holds if the run never ends. */
	compiled: Response | undefined;
}

/**
 * Sends programs to a worker, one at a time: while one runs, only the latest of
 * those asked for since waits, as the ones before it are already out of date.
 * A program that runs too long has its worker replaced, as nothing else stops it.
 * The clock starts once the worker says it is ready, so loading it is not counted.
 */
export class Evaluator {
	private worker: Worker;
	private ready = false;
	private broken = false;
	private disposed = false;
	private loading: ReturnType<typeof setTimeout> | undefined;
	private running: Running | undefined;
	private waiting: Request | undefined;
	private nextId = 1;

	private readonly respond: (response: Response) => void;

	constructor(
		private readonly spawn: () => Worker,
		respond: (response: Response) => void,
	) {
		this.respond = (response) => {
			if (!this.disposed) respond(response);
		};
		this.worker = this.start();
	}

	private start(): Worker {
		this.ready = false;
		const worker = this.spawn();
		const loading = setTimeout(() => {
			if (worker === this.worker && !this.ready) this.fail('The evaluator did not load');
		}, LOAD_MS);
		this.loading = loading;
		worker.addEventListener('message', (event: MessageEvent<Message>) => {
			if (worker !== this.worker) return;
			const message = event.data;
			if ('ready' in message) {
				clearTimeout(loading);
				this.ready = true;
				this.sendWaiting();
			} else {
				this.received(message);
			}
		});
		worker.addEventListener('error', (event) => {
			if (worker !== this.worker) return;
			event.preventDefault();
			clearTimeout(loading);
			// One that never loaded will not load now; one that ran has failed once
			if (this.ready) this.restart('The evaluator stopped', 'internal-error');
			else this.fail('The evaluator could not start');
		});
		return worker;
	}

	/** Run `source` when the worker is free, and tell which request that is. */
	evaluate(source: string, given: Readonly<Record<string, Given>>): number {
		const id = this.nextId++;
		if (this.disposed) return id;
		const request = { id, source, given };
		if (this.broken) {
			this.answer(request, undefined, 'The evaluator could not start', 'internal-error');
			return id;
		}
		this.waiting = request;
		if (this.running === undefined) this.sendWaiting();
		return id;
	}

	/** Stop for good: nothing more runs, and nothing more is answered. */
	dispose(): void {
		this.disposed = true;
		clearTimeout(this.loading);
		if (this.running !== undefined) clearTimeout(this.running.timer);
		this.running = undefined;
		this.waiting = undefined;
		this.worker.terminate();
	}

	private sendWaiting(): void {
		const request = this.waiting;
		if (request === undefined || !this.ready) return;
		this.waiting = undefined;
		const timer = setTimeout(() => this.timedOut(), TIMEOUT_MS);
		this.running = { request, timer, compiled: undefined };
		this.worker.postMessage(request);
	}

	private received(response: Response): void {
		const running = this.running;
		if (running?.request.id !== response.id) return;
		this.respond(response);
		if (response.phase === 'compiled') {
			running.compiled = response;
			return;
		}
		clearTimeout(running.timer);
		this.running = undefined;
		this.sendWaiting();
	}

	/** Answer a request that did not run to its end, with what compiling found of it. */
	private answer(
		request: Request,
		compiled: Response | undefined,
		message: string,
		code: string,
	): void {
		this.respond({
			id: request.id,
			source: request.source,
			rejected: [],
			problems: [],
			inputs: undefined,
			scope: [],
			types: undefined,
			timing: undefined,
			...compiled,
			phase: 'done',
			outcome: { ok: false, message, code },
		});
	}

	private timedOut(): void {
		this.restart(`Stopped after ${TIMEOUT_MS / 1000} seconds`, 'timeout');
	}

	/** Replace the worker, answering what it was running with why. */
	private restart(message: string, code: string): void {
		const running = this.running;
		this.running = undefined;
		if (running !== undefined) clearTimeout(running.timer);
		this.worker.terminate();
		this.worker = this.start();
		if (running !== undefined) this.answer(running.request, running.compiled, message, code);
	}

	/** A worker that cannot load will not load later, so everything is answered now. */
	private fail(message: string): void {
		this.broken = true;
		for (const pending of [
			this.running,
			this.waiting && { request: this.waiting, compiled: undefined },
		]) {
			if (pending === undefined) continue;
			if ('timer' in pending) clearTimeout(pending.timer);
			this.answer(pending.request, pending.compiled, message, 'internal-error');
		}
		this.running = undefined;
		this.waiting = undefined;
	}
}
