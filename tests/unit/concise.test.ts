import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	aiConciseInput,
	conciseFromCv,
	conciseFromText,
	mergeConciseAi,
	rateConcise
} from '../../src/lib/core/ats/concise';
import { analyzeFull, analyzeScanFull } from '../../src/lib/core/ats/analyze';
import { conciseSendText, createAiClient } from '../../src/lib/core/ai/index';
import { parseAiLiteRequest } from '../../src/lib/core/ai/schema';
import {
	AI_CONCISE_LIMITS,
	type AiConciseInput,
	type ConciseResult
} from '../../src/lib/core/ai/types';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { createApp } from '../../server/src/app';
import type { ChatMessage, ChatProvider } from '../../server/src/ai';
import { memoryQuotaStore } from '../../server/src/quota';
import { buildConciseMessages, parseConcise, pointLanguage } from '../../server/src/tasks';
import type { CVDocument } from '../../src/lib/core/schema/types';

const WORDY =
	'Bertanggung jawab untuk melakukan berbagai macam kegiatan administrasi kantor dan juga membantu dalam proses pengarsipan dokumen-dokumen penting perusahaan dengan baik setiap harinya selama masa magang berlangsung';
const TIGHT = 'Merancang 40 layar aplikasi mobile reservasi klinik di Figma';

describe('rateConcise (on device)', () => {
	it('a tight bullet is ok; a rambling one is very wordy with reasons', () => {
		expect(rateConcise(TIGHT, 'bullet')).toMatchObject({ level: 'ok', issues: [] });
		expect(rateConcise(TIGHT, 'bullet').score).toBeGreaterThanOrEqual(90);
		const wordy = rateConcise(WORDY, 'bullet');
		expect(wordy.level).toBe('veryWordy');
		expect(wordy.issues).toEqual(expect.arrayContaining(['tooLong', 'filler']));
		expect(wordy.fillers).toEqual(
			expect.arrayContaining(['bertanggung jawab untuk', 'berbagai macam', 'dengan baik'])
		);
	});

	it('finds English filler, several ideas, repeated words and roundabout phrasing', () => {
		expect(
			rateConcise('Responsible for social media in order to grow followers', 'bullet').fillers
		).toEqual(['responsible for', 'in order to']);
		expect(
			rateConcise(
				'Mengelola akun Instagram kampus. Membuat konten mingguan untuk kampanye.',
				'bullet'
			).issues
		).toContain('multipleIdeas');
		expect(
			rateConcise('Membuat desain poster acara dan membuat desain banner', 'bullet').issues
		).toContain('repetition');
		expect(
			rateConcise('The report was prepared for the manager every week', 'bullet').issues
		).toContain('indirect');
		expect(rateConcise('Mengerjakan berbagai tugas tim', 'bullet').issues).toContain('vague');
		expect(rateConcise('Mengerjakan berbagai tugas untuk 3 tim', 'bullet').issues).not.toContain(
			'vague'
		);
	});

	it('a summary may be longer than a bullet before it counts as too long', () => {
		const sixty = Array.from({ length: 60 }, (_, i) => `kata${i}`).join(' ');
		expect(rateConcise(sixty, 'summary').issues).not.toContain('tooLong');
		expect(rateConcise(sixty, 'bullet').issues).toContain('tooLong');
		const long = Array.from({ length: 120 }, (_, i) => `kata${i}`).join(' ');
		expect(rateConcise(long, 'summary').issues).toContain('tooLong');
	});
});

describe('concise report', () => {
	const cv = (): CVDocument => structuredClone(sampleCvAts);

	it('rates the summary and every bullet of a CV with a target to fix it', () => {
		const doc = cv();
		doc.experience[0]!.bullets = [TIGHT, '  ', WORDY];
		const report = conciseFromCv(doc);
		expect(report.points[0]).toMatchObject({ key: 'summary', kind: 'summary' });
		const wordy = report.points.find((p) => p.text === WORDY);
		expect(wordy?.target).toMatchObject({
			step: 'experience',
			section: 'experience',
			itemId: doc.experience[0]!.id,
			field: 'bullets',
			bulletIndex: 2
		});
		expect(report.points.some((p) => p.text === '')).toBe(false);
		expect(report.wordy).toBeGreaterThanOrEqual(1);
		expect(report.score).toBeGreaterThan(0);
	});

	it('an empty CV has nothing to rate', () => {
		const doc = cv();
		doc.summary = '';
		for (const list of [doc.experience, doc.organizations, doc.projects, doc.education])
			list.length = 0;
		doc.custom = [];
		expect(conciseFromCv(doc)).toMatchObject({ score: undefined, points: [], wordy: 0 });
	});

	it('reads points from a CV file: bullets, long sentences and the summary, not titles', () => {
		const report = conciseFromText(
			[
				'RINGKASAN',
				'Lulusan Sistem Informasi yang tertarik pada analisis data.',
				'PENGALAMAN',
				'Data Analyst Intern — PT Maju',
				'Jan 2024 - Jun 2024',
				`• ${WORDY}`,
				'- Menyusun dasbor penjualan mingguan di Looker Studio',
				'Membantu tim dalam melakukan berbagai macam kegiatan analisis data penjualan bulanan'
			].join('\n')
		);
		expect(report.points.map((p) => p.kind)).toEqual(['summary', 'bullet', 'bullet', 'bullet']);
		expect(report.points.some((p) => p.text.includes('PT Maju'))).toBe(false);
		expect(report.points[1]!.text).toBe(WORDY);
	});

	it('is part of both full analyses', async () => {
		expect((await analyzeFull(cv())).concise.points.length).toBeGreaterThan(0);
		const scan = await analyzeScanFull({
			text: `PENGALAMAN\n• ${WORDY}`,
			pages: 1,
			layout: { imageOnly: false, columns: 1 }
		} as never);
		expect(scan.concise.points).toHaveLength(1);
	});
});

describe('AI input and merge', () => {
	it('sends the wordiest points first (in CV order), skips short ones and removes contacts', () => {
		const lines = Array.from({ length: 40 }, (_, i) =>
			i === 39 ? `• ${WORDY} hubungi rizky@mail.com` : `• ${TIGHT} nomor ${i}`
		);
		lines.unshift('PENGALAMAN', '• Membuat poster');
		const report = conciseFromText(lines.join('\n'));
		const input = aiConciseInput(report, 'id');
		expect(input.points).toHaveLength(AI_CONCISE_LIMITS.points);
		expect(input.points.at(-1)!.text).not.toContain('rizky@mail.com');
		expect(input.points.some((p) => p.text === 'Membuat poster')).toBe(false);
		expect(input.keys).toHaveLength(input.points.length);
		expect(
			parseAiLiteRequest({
				task: 'concise',
				concise: { locale: input.locale, points: input.points }
			})
		).toBeDefined();
	});

	it('blends AI and on-device scores; keeps shorter only for wordy points; skipped points stay', () => {
		const report = conciseFromText(`PENGALAMAN\n• ${WORDY}\n• ${TIGHT}`);
		const input = aiConciseInput(report, 'id');
		const result: ConciseResult = {
			task: 'concise',
			points: [
				{ score: 30, issues: ['vague'], shorter: 'Mengelola administrasi dan arsip dokumen' },
				null
			]
		};
		const merged = mergeConciseAi(report, input, result);
		expect(merged.ai).toBe(true);
		expect(merged.points[0]).toMatchObject({
			ai: true,
			level: 'veryWordy',
			shorter: 'Mengelola administrasi dan arsip dokumen'
		});
		expect(merged.points[0]!.issues).toEqual(expect.arrayContaining(['vague', 'filler']));
		expect(merged.points[1]).toEqual(report.points[1]);
	});
});

describe('AI input alignment (points and keys always match)', () => {
	const CONTACTS_ONLY =
		'rizky@mail.com 081234567890 https://rizky.dev www.rizky.id linkedin.com/in/rizky github.com/rizky';

	it('conciseSendText removes contacts, caps the length and is stable', () => {
		expect(conciseSendText('summary', CONTACTS_ONLY)).toBe('');
		const once = conciseSendText('bullet', `${WORDY} ${WORDY}`);
		expect(once.length).toBeLessThanOrEqual(AI_CONCISE_LIMITS.bullet);
		expect(conciseSendText('bullet', once)).toBe(once);
	});

	it('a cut that turns the end of a long token into a domain is redacted too', () => {
		const prefix = 'Membuat fitur pencarian aplikasi internal kampus ';
		const token = 'xxxxxxxxxx.comx';
		const text = `${prefix}${'y'.repeat(300 - prefix.length - token.length + 1)} ${token}`.slice(
			0,
			301
		);
		const sent = conciseSendText('bullet', text);
		expect(sent).not.toMatch(/\.com/);
		expect(conciseSendText('bullet', sent)).toBe(sent);
	});

	it('drops a point that is only contact details together with its key', () => {
		const report = conciseFromText(`RINGKASAN
${CONTACTS_ONLY}
PENGALAMAN
• ${WORDY}`);
		expect(report.points.map((p) => p.kind)).toEqual(['summary', 'bullet']);
		const input = aiConciseInput(report, 'id');
		expect(input.points).toHaveLength(1);
		expect(input.keys).toEqual([report.points[1]!.key]);
		const merged = mergeConciseAi(report, input, {
			task: 'concise',
			points: [{ score: 20, issues: ['filler'] }]
		});
		expect(merged.points[0]).toEqual(report.points[0]);
		expect(merged.points[1]!.ai).toBe(true);
	});

	it('the client refuses a hand-built input with an empty point instead of shifting answers', async () => {
		const client = createAiClient({
			fetch: (async () => {
				throw new Error('must not be called');
			}) as typeof fetch
		});
		const error = await client
			.concise({
				locale: 'id',
				points: [
					{ kind: 'summary', text: CONTACTS_ONLY },
					{ kind: 'bullet', text: WORDY }
				]
			})
			.catch((e: unknown) => e);
		expect((error as { code?: string }).code).toBe('invalid');
	});
});

describe('server: parseConcise', () => {
	const input: AiConciseInput = {
		locale: 'id',
		points: [
			{ kind: 'bullet', text: WORDY },
			{ kind: 'bullet', text: TIGHT },
			{
				kind: 'bullet',
				text: 'Membantu tim marketing PT Maju dalam berbagai hal terkait media sosial selama 3 bulan'
			}
		]
	};

	it('keeps valid answers, clamps scores, drops unknown issues', () => {
		const result = parseConcise(
			input,
			'```json\n{"points":[{"i":0,"score":140,"issues":["filler","bogus","filler"],"shorter":"Mengelola administrasi dan pengarsipan dokumen"},{"i":1,"score":92,"issues":["tooLong"],"shorter":"x"}]}\n```'
		);
		expect(result?.points[0]).toEqual({ score: 100, issues: ['filler'] });
		// tooLong on a 9-word bullet is nonsense; shorter never kept for a fine point.
		expect(result?.points[1]).toEqual({ score: 92, issues: [] });
		expect(result?.points[2]).toBeNull();
	});

	it('keeps a shorter version only without invented numbers or names and only when shorter', () => {
		const answer = (shorter: string) =>
			parseConcise(input, JSON.stringify({ points: [{ i: 2, score: 40, issues: [], shorter }] }))
				?.points[2]?.shorter;
		expect(answer('Mengelola media sosial tim marketing PT Maju selama 3 bulan')).toBe(
			'Mengelola media sosial tim marketing PT Maju selama 3 bulan'
		);
		expect(answer('Mengelola media sosial PT Maju selama 6 bulan')).toBeUndefined();
		expect(answer('Mengelola media sosial Tokopedia selama 3 bulan')).toBeUndefined();
		expect(answer(input.points[2]!.text)).toBeUndefined();
	});

	it('never keeps a translated rewrite (mixed-language CVs)', () => {
		const english: AiConciseInput = {
			locale: 'id',
			points: [
				{
					kind: 'bullet',
					text: 'Was responsible for handling various customer complaints in order to make sure that customers were satisfied with the service'
				}
			]
		};
		const answer = (shorter: string) =>
			parseConcise(english, JSON.stringify({ points: [{ i: 0, score: 50, issues: [], shorter }] }))
				?.points[0]?.shorter;
		expect(
			answer('Menangani keluhan pelanggan untuk memastikan kepuasan terhadap layanan')
		).toBeUndefined();
		expect(answer('Handled customer complaints to keep customers satisfied with the service')).toBe(
			'Handled customer complaints to keep customers satisfied with the service'
		);
		expect(pointLanguage('Figma, Looker Studio, SQL')).toBeUndefined();
		expect(pointLanguage('Merancang 40 layar aplikasi di Figma')).toBe('id');
		expect(JSON.stringify(buildConciseMessages(english))).toContain('never translate');
	});

	it('falls back to list order without "i", ignores duplicates, and gives up on garbage', () => {
		const result = parseConcise(
			input,
			'{"points":[{"score":20,"issues":[]},{"score":90,"issues":[]},{"i":0,"score":99,"issues":[]}]}'
		);
		expect(result?.points.map((p) => p?.score)).toEqual([20, 90, undefined]);
		expect(parseConcise(input, 'not json')).toBeUndefined();
		expect(parseConcise(input, '{"points":[{"i":0,"score":"high"}]}')).toBeUndefined();
	});

	it('removes contact details again before the model sees the points', () => {
		const messages = buildConciseMessages({
			locale: 'id',
			points: [{ kind: 'bullet', text: 'Hubungi saya di rizky@mail.com atau 0812-3456-7890 ya' }]
		});
		expect(JSON.stringify(messages)).not.toMatch(/rizky@mail\.com|3456/);
	});
});

const SECRET = '0123456789abcdef0123456789abcdef-test';
const ORIGIN = 'https://cvmaker.codiosity.com';
let server: Server | undefined;
afterEach(
	() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
);

async function startApi(main: ChatProvider, lite: ChatProvider) {
	const store = memoryQuotaStore();
	const handle = createApp({
		config: {
			appOrigin: ORIGIN,
			appSecret: SECRET,
			limits: {
				device: 3,
				ip: 100,
				devicesPerIp: 10,
				global: 100,
				visitorsPerIp: 3,
				lite: { device: 2, ip: 5, global: 100 }
			},
			ads: {
				enabled: false,
				origin: 'https://iklan.codiosity.com',
				perDevice: 10,
				perIp: 100,
				minSeconds: 15
			}
		},
		store,
		provider: main,
		liteProvider: lite
	});
	server = createServer((req, res) => void handle(req, res));
	await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	const call = (path: string, init: RequestInit = {}) =>
		fetch(`http://127.0.0.1:${port}${path}`, {
			...init,
			headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...init.headers }
		});
	const { token } = (await (await call('/api/ai/device', { method: 'POST' })).json()) as {
		token: string;
	};
	const post = (body: unknown, headers: Record<string, string> = { 'X-Device-Token': token }) =>
		call('/api/ai/lite', { method: 'POST', headers, body: JSON.stringify(body) });
	return { call, token, lite: post };
}

describe('HTTP: POST /api/ai/lite', () => {
	const body = {
		task: 'concise',
		concise: { locale: 'id', points: [{ kind: 'bullet', text: WORDY }] }
	};
	const answer =
		'{"points":[{"i":0,"score":30,"issues":["filler"],"shorter":"Mengelola administrasi dan arsip dokumen"}]}';

	it('uses the small model, never the daily uses, and has its own daily limit', async () => {
		const seen: { messages: ChatMessage[]; temperature?: number }[] = [];
		const main: ChatProvider = {
			async complete() {
				throw new Error('main model must not be used');
			}
		};
		const lite: ChatProvider = {
			async complete(messages, options) {
				seen.push({ messages, temperature: options?.temperature });
				return { text: answer, model: 'small' };
			}
		};
		const { call, token, lite: post } = await startApi(main, lite);
		for (const remaining of [1, 0]) {
			const response = await post(body);
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				result: { task: 'concise', points: [{ score: 30 }] },
				lite: { limit: 2, remaining }
			});
		}
		expect((await post(body)).status).toBe(429);
		expect(seen[0]!.temperature).toBeLessThanOrEqual(0.2);
		const quota = await (
			await call('/api/ai/quota', { headers: { 'X-Device-Token': token } })
		).json();
		expect(quota).toMatchObject({ remaining: 3, lite: { limit: 2, remaining: 0 } });
	});

	it('gives the free check back when the model fails; rejects bad requests', async () => {
		let fail = true;
		const lite: ChatProvider = {
			async complete() {
				if (fail) throw new Error('down');
				return { text: answer, model: 'small' };
			}
		};
		const { lite: post } = await startApi(lite, lite);
		expect((await post(body)).status).toBe(503);
		fail = false;
		expect(await (await post(body)).json()).toMatchObject({ lite: { remaining: 1 } });
		expect((await post({ task: 'concise', concise: { locale: 'id', points: [] } })).status).toBe(
			400
		);
		expect((await post({ task: 'review', review: {} })).status).toBe(400);
		expect((await post(body, {})).status).toBe(401);
	});
});

describe('client: aiClient.concise', () => {
	beforeEach(() => {
		const data = new Map<string, string>();
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				getItem: (k: string) => data.get(k) ?? null,
				setItem: (k: string, v: string) => void data.set(k, v),
				removeItem: (k: string) => void data.delete(k)
			},
			configurable: true
		});
	});

	it('posts redacted points to /lite with the device token', async () => {
		const calls: { url: string; init?: RequestInit }[] = [];
		const responses = [
			Response.json({ token: 'v1.token' }),
			Response.json({
				result: { task: 'concise', points: [null] },
				lite: { limit: 20, remaining: 19 }
			})
		];
		const client = createAiClient({
			fetch: (async (url: string, init?: RequestInit) => {
				calls.push({ url, init });
				return responses.shift()!;
			}) as typeof fetch
		});
		const answer = await client.concise({
			locale: 'id',
			points: [{ kind: 'bullet', text: `${WORDY} rizky@mail.com` }]
		});
		expect(answer.lite.remaining).toBe(19);
		expect(calls.map((c) => c.url)).toEqual(['/api/ai/device', '/api/ai/lite']);
		const sent = String(calls[1]!.init?.body);
		expect(sent).not.toContain('rizky@mail.com');
		expect(new Headers(calls[1]!.init?.headers).get('X-Device-Token')).toBe('v1.token');
	});
});
