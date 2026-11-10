import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app';
import { createPresence, MAX_PER_IP, ONLINE_WINDOW_MS } from '../../server/src/presence';
import { memoryQuotaStore } from '../../server/src/quota';
import { createVisitorCounter } from '../../src/lib/core/stats/index';

describe('online presence (server memory)', () => {
	it('counts visitors seen in the last 150 s, once each', () => {
		let clock = 0;
		const presence = createPresence(() => clock);
		presence.seen('a', 'ip1');
		presence.seen('a', 'ip1');
		presence.seen('b', 'ip2');
		expect(presence.online()).toBe(2);
		clock += ONLINE_WINDOW_MS - 1_000;
		presence.seen('b', 'ip2'); // b sends a heartbeat, a does not
		clock += 10_000;
		expect(presence.online()).toBe(1);
	});

	it('caps ids per IP so a script cannot inflate the number', () => {
		const presence = createPresence(() => 0);
		for (let i = 0; i < MAX_PER_IP + 30; i++) presence.seen(`fake-${i}`, 'one-ip');
		presence.seen('real', 'another-ip');
		expect(presence.online()).toBe(MAX_PER_IP + 1);
	});

	it('a browser that changes network keeps one slot', () => {
		const presence = createPresence(() => 0);
		presence.seen('phone', 'mobile-data');
		presence.seen('phone', 'wifi');
		expect(presence.online()).toBe(1);
		for (let i = 0; i < MAX_PER_IP - 1; i++) presence.seen(`x${i}`, 'mobile-data');
		presence.seen('one-more', 'mobile-data');
		expect(presence.online()).toBe(MAX_PER_IP + 1);
	});
});

describe('HTTP: online count and heartbeats', () => {
	let server: Server | undefined;
	const ORIGIN = 'https://cvmaker.codiosity.com';
	afterEach(
		() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
	);

	async function start() {
		const store = memoryQuotaStore();
		let writes = 0;
		const increment = store.increment.bind(store);
		store.increment = (...args) => {
			writes += 1;
			return increment(...args);
		};
		const handle = createApp({
			config: {
				appOrigin: ORIGIN,
				appSecret: '0123456789abcdef0123456789abcdef-test',
				limits: { device: 3, ip: 100, devicesPerIp: 10, global: 100, visitorsPerIp: 3 },
				ads: {
					enabled: false,
					origin: 'https://iklan.codiosity.com',
					perDevice: 10,
					perIp: 100,
					minSeconds: 15
				}
			},
			store,
			provider: { complete: async () => ({ text: '{}', model: 'm' }) }
		});
		server = createServer((req, res) => void handle(req, res));
		await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;
		const base = `http://127.0.0.1:${port}/api/hello`;
		const post = (body: unknown) =>
			fetch(base, {
				method: 'POST',
				headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			}).then((r) => r.json() as Promise<{ visitors: number; online: number }>);
		return { base, post, writes: () => writes };
	}

	const id = (n: number) => `visitor-${String(n).padStart(14, '0')}`;

	it('hello returns visitors and online; heartbeats never touch the database', async () => {
		const api = await start();
		expect(await api.post({ visitor: id(1) })).toEqual({ visitors: 1, online: 1 });
		expect(await api.post({ visitor: id(2) })).toEqual({ visitors: 2, online: 2 });
		const writes = api.writes();
		expect(await api.post({ visitor: id(1), beat: true })).toEqual({ visitors: 2, online: 2 });
		expect(await api.post({ visitor: id(3), beat: true })).toEqual({ visitors: 2, online: 3 });
		expect(api.writes()).toBe(writes);
		expect(await (await fetch(api.base)).json()).toEqual({ visitors: 2, online: 3 });
	});

	it('the browser client reports online from the first hello', async () => {
		const api = await start();
		const counter = createVisitorCounter({
			url: api.base,
			fetch: (u, i) =>
				fetch(u, { ...i, headers: { ...(i?.headers as Record<string, string>), Origin: ORIGIN } }),
			automated: () => false
		});
		const seen: number[] = [];
		counter.watchOnline((n) => seen.push(n));
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
		});
		expect(await counter.count()).toBe(1);
		expect(seen).toEqual([1]);
		const late: number[] = [];
		counter.watchOnline((n) => late.push(n));
		expect(late).toEqual([1]);
	});
});
