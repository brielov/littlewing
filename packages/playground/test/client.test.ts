import { describe, expect, test } from 'bun:test';
import { Evaluator } from '../src/evaluation/client.ts';
import type { Request, Response } from '../src/evaluation/protocol.ts';

/** A stand-in worker that answers only when told to. */
class FakeWorker extends EventTarget {
	readonly received: Request[] = [];
	terminated = false;
	postMessage(request: Request) {
		this.received.push(request);
	}
	send(data: unknown) {
		this.dispatchEvent(new MessageEvent('message', { data }));
	}
	ready() {
		this.send({ ready: true });
	}
	answer(request: Request, phase: Response['phase'] = 'done') {
		this.send({ id: request.id, source: request.source, phase } as Response);
	}
	terminate() {
		this.terminated = true;
	}
}

function setup() {
	const workers: FakeWorker[] = [];
	const answered: Response[] = [];
	const evaluator = new Evaluator(
		() => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker as unknown as Worker;
		},
		(response) => answered.push(response),
	);
	return { workers, answered, evaluator };
}

describe('Evaluator', () => {
	test('nothing is sent before the worker is ready', () => {
		const { workers, evaluator } = setup();
		evaluator.evaluate('a', {});
		expect(workers[0]!.received).toEqual([]);
		workers[0]!.ready();
		expect(workers[0]!.received.map(({ source }) => source)).toEqual(['a']);
		evaluator.dispose();
	});

	test('one at a time, and only the latest of those waiting', () => {
		const { workers, answered, evaluator } = setup();
		const worker = workers[0]!;
		worker.ready();
		evaluator.evaluate('a', {});
		evaluator.evaluate('b', {});
		evaluator.evaluate('c', {});
		expect(worker.received.map(({ source }) => source)).toEqual(['a']);
		worker.answer(worker.received[0]!, 'compiled');
		expect(worker.received.length).toBe(1);
		worker.answer(worker.received[0]!);
		expect(worker.received.map(({ source }) => source)).toEqual(['a', 'c']);
		worker.answer(worker.received[1]!);
		expect(answered.map(({ source, phase }) => `${source} ${phase}`)).toEqual([
			'a compiled',
			'a done',
			'c done',
		]);
		evaluator.dispose();
	});

	test('a stale answer is dropped', () => {
		const { workers, answered, evaluator } = setup();
		workers[0]!.ready();
		evaluator.evaluate('a', {});
		workers[0]!.answer({ id: 99, source: 'old', given: {} });
		expect(answered).toEqual([]);
		evaluator.dispose();
	});

	test('once disposed, nothing is answered, a late failure included', () => {
		const { workers, answered, evaluator } = setup();
		evaluator.evaluate('a', {});
		evaluator.dispose();
		workers[0]!.dispatchEvent(new Event('error'));
		expect(answered).toEqual([]);
		expect(workers[0]!.terminated).toBe(true);
	});

	test('a worker that fails after loading is replaced', () => {
		const { workers, answered, evaluator } = setup();
		workers[0]!.ready();
		evaluator.evaluate('a', {});
		workers[0]!.dispatchEvent(new Event('error'));
		expect(workers[0]!.terminated).toBe(true);
		expect(answered.map(({ outcome }) => outcome?.ok === false && outcome.message)).toEqual([
			'The evaluator stopped',
		]);
		evaluator.evaluate('b', {});
		workers[1]!.ready();
		expect(workers[1]!.received.map(({ source }) => source)).toEqual(['b']);
		evaluator.dispose();
	});

	test('a worker that cannot load answers everything with why', () => {
		const { workers, answered, evaluator } = setup();
		evaluator.evaluate('a', {});
		workers[0]!.dispatchEvent(new Event('error'));
		evaluator.evaluate('b', {});
		expect(
			answered.map(({ source, outcome }) => `${source} ${outcome?.ok === false && outcome.code}`),
		).toEqual(['a internal-error', 'b internal-error']);
		evaluator.dispose();
	});
});
