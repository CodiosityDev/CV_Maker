import { beforeEach, describe, expect, it } from 'vitest';
import { createVisitorCounter, formatVisitors } from '../../src/lib/core/stats/index';
import { VISITOR_STORAGE_KEY } from '../../src/lib/core/stats/types';
import { LOCAL_STORAGE_KEYS } from '../../src/lib/core/storage/repo';

class MemoryStorage {
	private data = new Map<string, string>();
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, value);
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
}

beforeEach(() => {
	Object.defineProperty(globalThis, 'localStorage', {
		value: new MemoryStorage(),
		configurable: true
	});
});

interface Call {
	url: string;
	init: RequestInit;
}

function fakeFetch(calls: Call[], response: () => Response) {
	return (async (url: string, init: RequestInit = {}) => {
		calls.push({ url, init });
		return response();
	}) as unknown as typeof fetch;
}

const ok = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });

describe('visitor counter (browser)', () => {
	it('sends a random id (no personal data), keeps it, and asks once per page load', async () => {
		const calls: Call[] = [];
		const counter = createVisitorCounter({
			fetch: fakeFetch(calls, ok({ visitors: 1234 })),
			automated: () => false
		});
		expect(await counter.count()).toBe(1234);
		expect(await counter.count()).toBe(1234);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe('/api/hello');
		expect(calls[0]?.init.method).toBe('POST');
		const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
		expect(Object.keys(body)).toEqual(['visitor']);
		expect(body.visitor).toMatch(/^[\w-]{22}$/);
		expect(localStorage.getItem(VISITOR_STORAGE_KEY)).toBe(body.visitor);

		// The next page load reuses the same id (counted once per day by the server).
		const again: Call[] = [];
		await createVisitorCounter({
			fetch: fakeFetch(again, ok({ visitors: 1234 })),
			automated: () => false
		}).count();
		expect(JSON.parse(String(again[0]?.init.body))).toEqual({ visitor: body.visitor });
	});

	it('only reads the count in automated browsers', async () => {
		const calls: Call[] = [];
		await createVisitorCounter({
			fetch: fakeFetch(calls, ok({ visitors: 5 })),
			automated: () => true
		}).count();
		expect(calls[0]?.init.method).toBe('GET');
		expect(calls[0]?.init.body).toBeUndefined();
		expect(localStorage.getItem(VISITOR_STORAGE_KEY)).toBeNull();
	});

	it('returns undefined (hide the counter) when the API is missing or answers nonsense', async () => {
		const cases: (() => Response)[] = [
			() => new Response('<!doctype html>', { status: 404 }),
			() => new Response('{"error":"failed"}', { status: 500 }),
			ok({ visitors: -1 }),
			ok({ visitors: '12' }),
			() => new Response('not json', { status: 200 })
		];
		for (const response of cases) {
			const counter = createVisitorCounter({
				fetch: fakeFetch([], response),
				automated: () => false
			});
			expect(await counter.count()).toBeUndefined();
		}
		const offline = createVisitorCounter({
			fetch: (async () => {
				throw new TypeError('Failed to fetch');
			}) as unknown as typeof fetch,
			automated: () => false
		});
		expect(await offline.count()).toBeUndefined();
	});

	it('formats with the separator of each language and is wiped with the other app data', () => {
		expect(formatVisitors(1234567, 'id')).toBe('1.234.567');
		expect(formatVisitors(1234567, 'en')).toBe('1,234,567');
		expect(formatVisitors(0, 'id')).toBe('0');
		expect(LOCAL_STORAGE_KEYS).toContain(VISITOR_STORAGE_KEY);
	});
});
