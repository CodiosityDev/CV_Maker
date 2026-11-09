import { beforeEach, describe, expect, it } from 'vitest';
import {
	AiError,
	aiCanRun,
	aiErrorMessageKey,
	aiProfileFromCv,
	createAiClient
} from '../../src/lib/core/ai/index';
import { parseAiRequest } from '../../src/lib/core/ai/schema';
import { AI_DEVICE_STORAGE_KEY } from '../../src/lib/core/ai/types';
import { LOCAL_STORAGE_KEYS } from '../../src/lib/core/storage/repo';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { atsEn } from '../../src/lib/i18n/messages/ats.en';
import { atsId } from '../../src/lib/i18n/messages/ats.id';
import type { CVDocument } from '../../src/lib/core/schema/types';

const cv = (): CVDocument => structuredClone(sampleCvAts);

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

describe('AI profile (what leaves the device)', () => {
	it('never contains contact details or the photo', () => {
		const doc = cv();
		const sent = JSON.stringify(aiProfileFromCv(doc));
		for (const secret of [
			doc.personal.fullName,
			doc.personal.email,
			doc.personal.phone,
			doc.personal.city,
			...doc.personal.links.map((link) => link.url)
		]) {
			if (secret) expect(sent).not.toContain(secret);
		}
		expect(sent).not.toContain('photo');
		expect(sent).toContain(doc.targetRole ?? '');
	});

	it('always passes the server schema, even for oversized CVs', () => {
		const doc = cv();
		doc.summary = 'x'.repeat(5000);
		doc.experience = Array.from({ length: 20 }, (_, i) => ({
			id: `e${i}`,
			type: 'internship' as const,
			role: 'R'.repeat(400),
			company: 'C',
			dates: { current: false },
			bullets: Array.from({ length: 8 }, () => 'b'.repeat(900))
		}));
		for (const task of ['headline', 'summary', 'skills'] as const) {
			expect(parseAiRequest({ task, profile: aiProfileFromCv(doc) })).toBeDefined();
		}
	});

	it('knows when there is enough to ask', () => {
		const doc = cv();
		expect(aiCanRun('headline', doc)).toBe(true);
		const empty: CVDocument = {
			...doc,
			targetRole: '',
			education: [],
			experience: [],
			organizations: [],
			projects: []
		};
		expect(aiCanRun('headline', empty)).toBe(false);
		expect(aiCanRun('skills', { ...empty, targetRole: 'Data Analyst' })).toBe(true);
	});
});

describe('AI client', () => {
	function fakeServer(responses: Response[]) {
		const calls: { url: string; init?: RequestInit }[] = [];
		const fetchImpl = (async (url: string, init?: RequestInit) => {
			calls.push({ url, init });
			const next = responses.shift();
			if (!next) throw new Error('no more responses');
			return next;
		}) as typeof fetch;
		return { calls, client: createAiClient({ fetch: fetchImpl }) };
	}
	const quota = { limit: 3, remaining: 2, resetsAt: '2026-11-09T17:00:00.000Z' };

	it('gets a device token once, keeps it, and sends only the profile', async () => {
		const { calls, client } = fakeServer([
			Response.json({ token: 'v1.token' }),
			Response.json({ result: { task: 'headline', headlines: ['A'] }, quota }),
			Response.json({ result: { task: 'headline', headlines: ['B'] }, quota })
		]);
		await client.run('headline', cv());
		await client.run('headline', cv());
		expect(calls.map((c) => c.url)).toEqual(['/api/ai/device', '/api/ai/run', '/api/ai/run']);
		expect(localStorage.getItem(AI_DEVICE_STORAGE_KEY)).toBe('v1.token');
		const runInit = calls[1]?.init;
		expect(new Headers(runInit?.headers).get('x-device-token')).toBe('v1.token');
		expect(runInit?.credentials).toBe('omit');
		expect(JSON.parse(String(runInit?.body))).toEqual({
			task: 'headline',
			profile: aiProfileFromCv(cv())
		});
	});

	it('turns server errors into AiError codes with the quota', async () => {
		localStorage.setItem(AI_DEVICE_STORAGE_KEY, 'v1.token');
		const { client } = fakeServer([
			Response.json({ error: 'quota', quota: { ...quota, remaining: 0 } }, { status: 429 })
		]);
		const error = await client.run('summary', cv()).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AiError);
		expect((error as AiError).code).toBe('quota');
		expect((error as AiError).quota?.remaining).toBe(0);
	});

	it('replaces a rejected token and retries once', async () => {
		localStorage.setItem(AI_DEVICE_STORAGE_KEY, 'v1.old');
		const { calls, client } = fakeServer([
			Response.json({ error: 'invalid' }, { status: 401 }),
			Response.json({ token: 'v1.new' }),
			Response.json({ result: { task: 'summary', summary: 'S'.repeat(50) }, quota })
		]);
		const { result } = await client.run('summary', cv());
		expect(result.task).toBe('summary');
		expect(calls).toHaveLength(3);
		expect(localStorage.getItem(AI_DEVICE_STORAGE_KEY)).toBe('v1.new');
	});

	it('treats an HTML error page from nginx (API down) as unavailable', async () => {
		localStorage.setItem(AI_DEVICE_STORAGE_KEY, 'v1.token');
		const { client } = fakeServer([
			new Response('<html>502 Bad Gateway</html>', {
				status: 502,
				headers: { 'Content-Type': 'text/html' }
			})
		]);
		const error = await client.run('skills', cv()).catch((e: unknown) => e);
		expect((error as AiError).code).toBe('unavailable');
	});

	it('reports network failures as unavailable/offline, never as a crash', async () => {
		const client = createAiClient({
			fetch: (async () => {
				throw new TypeError('network');
			}) as typeof fetch
		});
		const error = await client.quota().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AiError);
		expect(['unavailable', 'offline']).toContain((error as AiError).code);
	});
});

describe('AI messages and wipe', () => {
	it('has a message for every error code in both languages', () => {
		for (const code of ['quota', 'busy', 'offline', 'unavailable', 'invalid', 'failed'] as const) {
			const [, , key] = aiErrorMessageKey(code).split('.');
			expect(atsId.ai.errors[key as typeof code]).toBeTruthy();
			expect(atsEn.ai.errors[key as typeof code]).toBeTruthy();
		}
	});

	it('"delete all data" also removes the AI device token', () => {
		expect(LOCAL_STORAGE_KEYS).toContain(AI_DEVICE_STORAGE_KEY);
	});
});
