import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app';
import type { ChatMessage, ChatProvider } from '../../server/src/ai';
import { openAiCompatibleProvider } from '../../server/src/ai';
import { loadConfig } from '../../server/src/config';
import {
	ipSubject,
	issueDeviceToken,
	nextWibMidnight,
	verifyDeviceToken,
	wibDay
} from '../../server/src/identity';
import { consume, memoryQuotaStore } from '../../server/src/quota';
import { cleanText, guardNumbers, parseAnswer } from '../../server/src/tasks';
import type { AiProfile, AiRequest } from '../../src/lib/core/ai/types';

const SECRET = '0123456789abcdef0123456789abcdef-test';
const ORIGIN = 'https://cvmaker.codiosity.com';

const profile: AiProfile = {
	locale: 'id',
	targetRole: 'Data Analyst',
	education: [
		{ degree: 'S1', major: 'Sistem Informasi', institution: 'Universitas Brawijaya', gpa: '3.65' }
	],
	experience: [
		{
			type: 'internship',
			role: 'Data Analyst Intern',
			company: 'PT Contoh',
			bullets: ['Membuat 12 dashboard penjualan']
		}
	],
	organizations: [],
	projects: [],
	skills: { hard: ['SQL', 'Python'], tools: ['Excel'], soft: [] },
	certifications: [],
	summary: ''
};

describe('identity', () => {
	it('signs device tokens and rejects forged ones', () => {
		const token = issueDeviceToken(SECRET);
		const id = verifyDeviceToken(SECRET, token);
		expect(id).toMatch(/^[\w-]{22}$/);
		expect(verifyDeviceToken('another-secret-another-secret-0000', token)).toBeUndefined();
		expect(
			verifyDeviceToken(SECRET, token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'))
		).toBeUndefined();
		expect(verifyDeviceToken(SECRET, 'v1.AAAAAAAAAAAAAAAAAAAAAA.forged')).toBeUndefined();
		expect(verifyDeviceToken(SECRET, undefined)).toBeUndefined();
		expect(verifyDeviceToken(SECRET, 'x'.repeat(500))).toBeUndefined();
	});

	it('never stores raw IPs', () => {
		const subject = ipSubject(SECRET, '203.0.113.7');
		expect(subject).not.toContain('203');
		expect(subject).toBe(ipSubject(SECRET, '203.0.113.7'));
	});

	it('resets the day at 00:00 WIB', () => {
		// 16:59 UTC = 23:59 WIB; 17:00 UTC = 00:00 WIB next day.
		expect(wibDay(Date.UTC(2026, 10, 9, 16, 59))).toBe('2026-11-09');
		expect(wibDay(Date.UTC(2026, 10, 9, 17, 0))).toBe('2026-11-10');
		expect(nextWibMidnight(Date.UTC(2026, 10, 9, 8, 0))).toBe('2026-11-09T17:00:00.000Z');
	});
});

describe('quota', () => {
	it('takes from every scope or from none', async () => {
		const store = memoryQuotaStore();
		const keys = [
			{ scope: 'device' as const, subject: 'd', limit: 3 },
			{ scope: 'ip' as const, subject: 'i', limit: 1 }
		];
		expect(await consume(store, keys, '2026-11-09')).toBeUndefined();
		expect(await consume(store, keys, '2026-11-09')).toBe('ip');
		// The device unit taken before the IP was full is given back.
		expect(await store.used('device', 'd', '2026-11-09')).toBe(1);
		expect(await consume(store, keys, '2026-11-10')).toBeUndefined();
	});
});

describe('answer checking', () => {
	it('removes markdown, emoji, links and list markers but keeps names with digits', () => {
		expect(cleanText('**Junior Data Analyst** 🚀', 120)).toBe('Junior Data Analyst');
		expect(cleanText('- 3D Modeling', 40)).toBe('3D Modeling');
		expect(cleanText('1. Power BI', 40)).toBe('Power BI');
		expect(cleanText('Lihat https://contoh.com atau email a@b.co', 120)).toBe('Lihat atau email');
		expect(cleanText('"Data Analyst | SQL"', 120)).toBe('Data Analyst | SQL');
		expect(cleanText('kata '.repeat(40), 50).length).toBeLessThanOrEqual(50);
	});

	it('replaces numbers that are not in the CV with a placeholder', () => {
		expect(guardNumbers('IPK 3.65 dan 12 dashboard', profile)).toBe('IPK 3.65 dan 12 dashboard');
		expect(guardNumbers('Efisiensi naik 40% dalam 5 tahun', profile)).toBe(
			'Efisiensi naik [isi angka] dalam [isi angka] tahun'
		);
		expect(guardNumbers('Lulusan S1 dan Web3', profile)).toBe('Lulusan S1 dan Web3');
		expect(guardNumbers('Up 40%', { ...profile, locale: 'en' })).toBe('Up [add number]');
	});

	const request = (task: AiRequest['task']): AiRequest => ({ task, profile });

	it('accepts JSON wrapped in fences and returns at most 3 unique headlines', () => {
		const text =
			'```json\n{"headlines":["Data Analyst | SQL","data analyst | sql","Fresh Graduate SI","Junior Analyst","Extra"]}\n```';
		expect(parseAnswer(request('headline'), text)).toEqual({
			task: 'headline',
			headlines: ['Data Analyst | SQL', 'Fresh Graduate SI', 'Junior Analyst']
		});
	});

	it('drops skills the CV already has and caps each group', () => {
		const text = JSON.stringify({
			hard: ['SQL', 'sql', 'Data Cleaning', 'Statistika', 'A', 'B1', 'C1', 'D1', 'E1'],
			tools: ['Excel', 'Power BI'],
			soft: ['Komunikasi']
		});
		const result = parseAnswer(request('skills'), text);
		expect(result).toMatchObject({ task: 'skills', tools: ['Power BI'], soft: ['Komunikasi'] });
		if (result?.task !== 'skills') throw new Error('expected skills');
		expect(result.hard).not.toContain('SQL');
		expect(result.hard.length).toBeLessThanOrEqual(6);
	});

	it('rejects answers without usable content', () => {
		expect(parseAnswer(request('summary'), 'Maaf, saya tidak bisa.')).toBeUndefined();
		expect(parseAnswer(request('summary'), '{"summary":"Pendek."}')).toBeUndefined();
		expect(parseAnswer(request('headline'), '{"headlines":[]}')).toBeUndefined();
	});
});

describe('config', () => {
	const env = {
		APP_SECRET: SECRET,
		AI_BASE_URL: 'https://router.example.com/v1/',
		AI_API_KEY: 'key'
	};
	it('reads defaults and refuses weak or missing secrets', () => {
		const config = loadConfig(env);
		expect(config.ai.baseUrl).toBe('https://router.example.com/v1');
		expect(config.limits.device).toBe(3);
		expect(config.db).toBeUndefined();
		expect(() => loadConfig({ ...env, APP_SECRET: 'short' })).toThrow(/APP_SECRET/);
		expect(() => loadConfig({ ...env, AI_API_KEY: '' })).toThrow(/AI_API_KEY/);
		expect(() => loadConfig({ ...env, DB_NAME: 'el_cvmaker' })).toThrow(/DB_USER/);
	});
	it('never puts the key in error messages', () => {
		try {
			loadConfig({ ...env, AI_BASE_URL: 'ftp://x', AI_API_KEY: 'super-secret-key' });
		} catch (error) {
			expect(String(error)).not.toContain('super-secret-key');
			return;
		}
		throw new Error('expected an error');
	});
});

describe('provider', () => {
	it('falls back to the next model and sends the key only as a bearer header', async () => {
		const seen: { model: string; auth: string | null }[] = [];
		const fakeFetch = (async (_url: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { model: string };
			seen.push({ model: body.model, auth: new Headers(init?.headers).get('authorization') });
			if (body.model === 'first') return new Response('{}', { status: 500 });
			return Response.json({ choices: [{ message: { content: '{"summary":"ok"}' } }] });
		}) as typeof fetch;
		const provider = openAiCompatibleProvider({
			baseUrl: 'https://router.example.com/v1',
			apiKey: 'k',
			models: ['first', 'second'],
			timeoutMs: 1000,
			fetch: fakeFetch
		});
		const answer = await provider.complete([{ role: 'user', content: 'x' }]);
		expect(answer.model).toBe('second');
		expect(seen).toEqual([
			{ model: 'first', auth: 'Bearer k' },
			{ model: 'second', auth: 'Bearer k' }
		]);
	});
});

// ---------------------------------------------------------------------------
// HTTP API against a real local server with a fake AI
// ---------------------------------------------------------------------------

let server: Server | undefined;
afterEach(
	() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
);

const ADS_ORIGIN = 'https://iklan.codiosity.com';

async function startApi(
	provider: ChatProvider,
	options: { now?: () => number; adsEnabled?: boolean } = {}
) {
	const store = memoryQuotaStore();
	const limits = { device: 3, ip: 100, devicesPerIp: 10, global: 100, visitorsPerIp: 3 };
	const ads = {
		enabled: options.adsEnabled ?? false,
		origin: ADS_ORIGIN,
		perDevice: 10,
		perIp: 100,
		minSeconds: 15
	};
	const handle = createApp({
		config: { appOrigin: ORIGIN, appSecret: SECRET, limits, ads },
		store,
		provider,
		now: options.now
	});
	server = createServer((req, res) => void handle(req, res));
	await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	const base = `http://127.0.0.1:${port}`;
	const call = (path: string, init: RequestInit = {}) =>
		fetch(`${base}${path}`, {
			...init,
			headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...init.headers }
		});
	return { call, store };
}

const goodProvider = (messages: ChatMessage[][] = []): ChatProvider => ({
	async complete(input) {
		messages.push(input);
		return { text: '{"headlines":["Fresh Graduate Sistem Informasi | Data Analyst"]}', model: 'm' };
	}
});

describe('HTTP API', () => {
	it('issues a token, spends the daily quota, then refuses', async () => {
		const sent: ChatMessage[][] = [];
		const { call } = await startApi(goodProvider(sent));
		expect(await (await call('/api/ai/quota')).json()).toMatchObject({ limit: 3, remaining: 3 });
		const { token } = (await (await call('/api/ai/device', { method: 'POST' })).json()) as {
			token: string;
		};
		const run = () =>
			call('/api/ai/run', {
				method: 'POST',
				headers: { 'X-Device-Token': token },
				body: JSON.stringify({ task: 'headline', profile })
			});
		for (const remaining of [2, 1, 0]) {
			const response = await run();
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({ quota: { remaining } });
		}
		const refused = await run();
		expect(refused.status).toBe(429);
		expect(await refused.json()).toMatchObject({ error: 'quota', quota: { remaining: 0 } });
		// The AI saw the profile, never contact details.
		expect(sent).toHaveLength(3);
		expect(JSON.stringify(sent)).toContain('Sistem Informasi');
	});

	it('does not charge the user when the AI fails', async () => {
		const { call } = await startApi({
			async complete() {
				throw new Error('down');
			}
		});
		const { token } = (await (await call('/api/ai/device', { method: 'POST' })).json()) as {
			token: string;
		};
		const response = await call('/api/ai/run', {
			method: 'POST',
			headers: { 'X-Device-Token': token },
			body: JSON.stringify({ task: 'headline', profile })
		});
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'unavailable' });
		const quota = await call('/api/ai/quota', { headers: { 'X-Device-Token': token } });
		expect(await quota.json()).toMatchObject({ remaining: 3 });
	});

	it('health reports the quota database, so a deploy with a broken DB fails', async () => {
		const { call, store } = await startApi(goodProvider());
		expect((await call('/api/health')).status).toBe(200);
		store.used = async () => {
			throw new Error('ECONNREFUSED');
		};
		const broken = await call('/api/health');
		expect(broken.status).toBe(503);
		expect(await broken.json()).toEqual({ ok: false });
	});

	it('rejects other websites, forged tokens, unknown fields and huge bodies', async () => {
		const { call } = await startApi(goodProvider());
		const { token } = (await (await call('/api/ai/device', { method: 'POST' })).json()) as {
			token: string;
		};
		const post = (body: string, headers: Record<string, string> = {}) =>
			call('/api/ai/run', {
				method: 'POST',
				headers: { 'X-Device-Token': token, ...headers },
				body
			});
		const valid = JSON.stringify({ task: 'headline', profile });
		expect((await post(valid, { Origin: 'https://evil.example' })).status).toBe(403);
		expect((await post(valid, { 'X-Device-Token': 'v1.AAAAAAAAAAAAAAAAAAAAAA.x' })).status).toBe(
			401
		);
		expect(
			(await post(JSON.stringify({ task: 'headline', profile: { ...profile, email: 'a@b.c' } })))
				.status
		).toBe(400);
		expect((await post(JSON.stringify({ task: 'essay', profile }))).status).toBe(400);
		expect(
			(await post(JSON.stringify({ task: 'headline', profile, pad: 'x'.repeat(40_000) }))).status
		).toBe(413);
	});
});

describe('rewarded ads (+1 use per ad, max 10 per day)', () => {
	async function setup() {
		let clock = Date.UTC(2026, 10, 9, 5, 0);
		const api = await startApi(goodProvider(), { now: () => clock, adsEnabled: true });
		const { token } = (await (await api.call('/api/ai/device', { method: 'POST' })).json()) as {
			token: string;
		};
		const start = async () => {
			const response = await api.call('/api/ai/reward/start', {
				method: 'POST',
				headers: { 'X-Device-Token': token }
			});
			return { status: response.status, body: (await response.json()) as { adUrl?: string } };
		};
		const claim = (ticket: string, origin = ADS_ORIGIN) =>
			api.call('/api/ai/reward/claim', {
				method: 'POST',
				headers: { Origin: origin, 'Content-Type': 'text/plain' },
				body: JSON.stringify({ ticket })
			});
		const quota = async () =>
			(await (
				await api.call('/api/ai/quota', { headers: { 'X-Device-Token': token } })
			).json()) as { limit: number; remaining: number; rewards?: { remaining: number } };
		return { ...api, token, start, claim, quota, wait: (s: number) => (clock += s * 1000) };
	}
	const ticketOf = (adUrl: string | undefined) => (adUrl ?? '').split('#')[1] ?? '';

	it('adds one use per watched ad and reports rewards left', async () => {
		const t = await setup();
		expect(await t.quota()).toMatchObject({ limit: 3, remaining: 3, rewards: { remaining: 10 } });
		const { body } = await t.start();
		expect(body.adUrl?.startsWith(`${ADS_ORIGIN}/#r1.`)).toBe(true);
		t.wait(20);
		const claimed = await t.claim(ticketOf(body.adUrl));
		expect(claimed.status).toBe(200);
		expect(claimed.headers.get('access-control-allow-origin')).toBe(ADS_ORIGIN);
		expect(await t.quota()).toMatchObject({ limit: 4, remaining: 4, rewards: { remaining: 9 } });
	});

	it('refuses claims that are too fast, replayed, forged or from another site', async () => {
		const t = await setup();
		const ticket = ticketOf((await t.start()).body.adUrl);
		expect((await t.claim(ticket)).status).toBe(400); // 0 s: no ad is that short
		t.wait(20);
		expect((await t.claim(ticket, 'https://evil.example')).status).toBe(403);
		expect((await t.claim(ticket.slice(0, -2) + 'xx')).status).toBe(400);
		expect((await t.claim(ticket)).status).toBe(200);
		expect((await t.claim(ticket)).status).toBe(400); // single use
		t.wait(31 * 60);
		const old = ticketOf((await t.start()).body.adUrl);
		t.wait(31 * 60);
		expect((await t.claim(old)).status).toBe(400); // expired
		expect(await t.quota()).toMatchObject({ limit: 4 });
	});

	it('stops at 10 ads per device per day and resets the next day', async () => {
		const t = await setup();
		for (let i = 0; i < 10; i += 1) {
			const ticket = ticketOf((await t.start()).body.adUrl);
			t.wait(20);
			expect((await t.claim(ticket)).status).toBe(200);
		}
		expect(await t.quota()).toMatchObject({ limit: 13, rewards: { remaining: 0 } });
		const refused = await t.start();
		expect(refused.status).toBe(429);
		t.wait(24 * 60 * 60);
		expect(await t.quota()).toMatchObject({ limit: 3, remaining: 3, rewards: { remaining: 10 } });
	});

	it('is invisible and refused while ads are switched off', async () => {
		const api = await startApi(goodProvider());
		const { token } = (await (await api.call('/api/ai/device', { method: 'POST' })).json()) as {
			token: string;
		};
		const quota = await (
			await api.call('/api/ai/quota', { headers: { 'X-Device-Token': token } })
		).json();
		expect(quota).not.toHaveProperty('rewards');
		const start = await api.call('/api/ai/reward/start', {
			method: 'POST',
			headers: { 'X-Device-Token': token }
		});
		expect(start.status).toBe(503);
	});
});

describe('visitor counter (from 0, never resets)', () => {
	const visitor = (n: number) => `visitor-${String(n).padStart(14, '0')}`;
	const hello = (
		call: (path: string, init?: RequestInit) => Promise<Response>,
		id: string,
		ip = '198.51.100.1'
	) =>
		call('/api/hello', {
			method: 'POST',
			headers: { 'X-Real-IP': ip },
			body: JSON.stringify({ visitor: id })
		});

	it('starts at 0 and counts each visitor once per day, adding up across days', async () => {
		let time = Date.UTC(2026, 10, 9, 3, 0);
		const { call } = await startApi(goodProvider(), { now: () => time });
		expect(await (await call('/api/hello')).json()).toEqual({ visitors: 0 });
		expect(await (await hello(call, visitor(1))).json()).toEqual({ visitors: 1 });
		expect(await (await hello(call, visitor(1))).json()).toEqual({ visitors: 1 });
		expect(await (await hello(call, visitor(2))).json()).toEqual({ visitors: 2 });
		time += 24 * 60 * 60 * 1000;
		// Next day: the same visitor counts again; the total keeps growing.
		expect(await (await hello(call, visitor(1))).json()).toEqual({ visitors: 3 });
		expect(await (await call('/api/hello')).json()).toEqual({ visitors: 3 });
	});

	it('never stores the visitor id or the IP', async () => {
		const { call, store } = await startApi(goodProvider());
		const subjects: string[] = [];
		const increment = store.increment.bind(store);
		store.increment = async (scope, subject, day, limit) => {
			subjects.push(subject);
			return increment(scope, subject, day, limit);
		};
		await hello(call, visitor(7), '203.0.113.9');
		expect(subjects).toHaveLength(2);
		expect(subjects.join(' ')).not.toContain(visitor(7));
		expect(subjects.join(' ')).not.toContain('203.0.113.9');
	});

	it('caps new visitors per IP so a script cannot inflate the count', async () => {
		const { call } = await startApi(goodProvider());
		for (let n = 1; n <= 5; n++) await hello(call, visitor(n), '198.51.100.20');
		expect(await (await call('/api/hello')).json()).toEqual({ visitors: 3 });
		expect(await (await hello(call, visitor(9), '198.51.100.21')).json()).toEqual({
			visitors: 4
		});
	});

	it('rejects other websites and malformed ids', async () => {
		const { call } = await startApi(goodProvider());
		const other = await call('/api/hello', {
			method: 'POST',
			headers: { Origin: 'https://evil.example' },
			body: JSON.stringify({ visitor: visitor(1) })
		});
		expect(other.status).toBe(403);
		for (const id of ['short', `${visitor(1)}x`, 'a/b/c/d/e/f/g/h/i/j/k/', 42]) {
			const response = await call('/api/hello', {
				method: 'POST',
				body: JSON.stringify({ visitor: id })
			});
			expect(response.status).toBe(400);
		}
		expect(await (await call('/api/hello')).json()).toEqual({ visitors: 0 });
	});
});
