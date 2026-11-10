import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app';
import type { ChatMessage, ChatProvider } from '../../server/src/ai';
import { memoryQuotaStore } from '../../server/src/quota';
import { buildMessages, maxTokensFor, parseAnswer } from '../../server/src/tasks';
import {
	aiReviewInputFromCv,
	aiReviewInputFromScan,
	createAiClient,
	redactContacts,
	redactCvText
} from '../../src/lib/core/ai/index';
import { parseAiRequest } from '../../src/lib/core/ai/schema';
import type { AiRequest, AiReviewInput } from '../../src/lib/core/ai/types';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';

const CV_TEXT = `Rina Putri Lestari
Fresh Graduate Sistem Informasi
rina.lestari@gmail.com | +62 812-3456-7890 | linkedin.com/in/rinalestari | @rinalestari
Alamat: Jl. Veteran No. 10, Malang
PENDIDIKAN
Universitas Brawijaya, 2021 - 2025
0812 3456 7890
PENGALAMAN
• Membuat 12 dashboard penjualan mingguan dengan Power BI
• bantu bantu bikin laporan bulanan untuk manajer`;

describe('redaction (what the AI review may see)', () => {
	it('drops the header block, emails, phones, links, handles and address lines', () => {
		const text = redactCvText(CV_TEXT);
		for (const secret of ['Rina Putri', 'gmail', '812', 'linkedin', '@rina', 'Veteran', 'Malang'])
			expect(text).not.toContain(secret);
		expect(text).toContain('Universitas Brawijaya, 2021 - 2025');
		expect(text).toContain('Membuat 12 dashboard');
		expect(text.split('\n')[0]).toBe('PENDIDIKAN');
	});

	it('keeps years, GPAs and money amounts; is idempotent', () => {
		const text = 'IPK 3.65/4.00\n2019 - 2023\nOmzet Rp 10.000.000\nNode.js, Vue.js';
		expect(redactContacts(text)).toBe(text);
		expect(redactContacts(redactContacts(CV_TEXT))).toBe(redactContacts(CV_TEXT));
	});

	it('without any heading, drops the first line (the name)', () => {
		expect(redactCvText('Budi Santoso\nSuka belajar data')).toBe('Suka belajar data');
	});

	it('builds valid review requests from a file and from an app CV, never with contact details', () => {
		const fromScan = aiReviewInputFromScan({ text: CV_TEXT }, 'Butuh SQL', 'Data Analyst');
		expect(fromScan.locale).toBe('id');
		expect(parseAiRequest({ task: 'review', review: fromScan })).toBeDefined();

		const cv = structuredClone(sampleCvAts);
		const fromCv = aiReviewInputFromCv(cv);
		expect(parseAiRequest({ task: 'review', review: fromCv })).toBeDefined();
		const sent = JSON.stringify(fromCv);
		for (const value of [
			cv.personal.fullName,
			cv.personal.email,
			cv.personal.phone,
			cv.personal.city
		])
			if (value) expect(sent).not.toContain(value);
		expect(fromCv.cvText).toContain('EDUCATION');
	});

	it('the schema rejects an empty or oversized review and unknown fields', () => {
		const review: AiReviewInput = { locale: 'id', targetRole: '', cvText: 'x', jobPost: '' };
		expect(parseAiRequest({ task: 'review', review })).toBeDefined();
		expect(parseAiRequest({ task: 'review', review: { ...review, cvText: '' } })).toBeUndefined();
		expect(
			parseAiRequest({ task: 'review', review: { ...review, cvText: 'x'.repeat(8001) } })
		).toBeUndefined();
		expect(
			parseAiRequest({ task: 'review', review: { ...review, email: 'a@b.co' } })
		).toBeUndefined();
		expect(parseAiRequest({ task: 'review', profile: {} })).toBeUndefined();
	});
});

describe('review prompt and answer checking', () => {
	const review: AiReviewInput = {
		locale: 'id',
		targetRole: 'Data Analyst',
		cvText: redactCvText(CV_TEXT),
		jobPost: 'Kualifikasi: menguasai SQL, Tableau, dan Python. Lulusan S1.'
	};
	const request: AiRequest = { task: 'review', review };

	it('re-redacts on the server and gives the review a bigger answer budget', () => {
		const leaky: AiRequest = {
			task: 'review',
			review: { ...review, cvText: `${review.cvText}\nhubungi rina@gmail.com 081234567890` }
		};
		const content = JSON.stringify(buildMessages(leaky));
		expect(content).not.toContain('rina@gmail.com');
		expect(content).not.toContain('081234567890');
		expect(content).toContain('JOB POST');
		expect(maxTokensFor(request)).toBeGreaterThan(
			maxTokensFor({ task: 'headline', profile: {} as never })
		);
	});

	it('keeps only rewrites of real CV lines, keywords really missing from the CV, and known numbers', () => {
		const answer = JSON.stringify({
			overview: 'CV sudah rapi, tetapi pengalaman perlu hasil yang terukur hingga 50%.',
			strengths: [
				'Ada pengalaman dashboard Power BI',
				'Ada pengalaman dashboard Power BI',
				'Membuat 40 dashboard'
			],
			improvements: [
				{ title: 'Tambahkan ringkasan', detail: 'Tulis 2 kalimat tentang target posisi.' },
				{ title: '', detail: 'tanpa judul' }
			],
			rewrites: [
				{
					before: 'bantu bantu bikin laporan bulanan untuk manajer',
					after: 'Menyusun laporan bulanan untuk manajer penjualan'
				},
				{ before: 'Memimpin tim 20 orang di Google', after: 'Memimpin tim 20 orang' }
			],
			missingKeywords: ['Tableau', 'Python', 'Power BI', 'Kubernetes']
		});
		const result = parseAnswer(request, `Berikut hasilnya:\n${answer}`);
		expect(result).toEqual({
			task: 'review',
			overview: 'CV sudah rapi, tetapi pengalaman perlu hasil yang terukur hingga 50%.',
			strengths: ['Ada pengalaman dashboard Power BI', 'Membuat [isi angka] dashboard'],
			improvements: [
				{ title: 'Tambahkan ringkasan', detail: 'Tulis 2 kalimat tentang target posisi.' }
			],
			rewrites: [
				{
					before: 'bantu bantu bikin laporan bulanan untuk manajer',
					after: 'Menyusun laporan bulanan untuk manajer penjualan'
				}
			],
			missingKeywords: ['Tableau', 'Python']
		});
		expect(
			parseAnswer({ task: 'review', review: { ...review, jobPost: '' } }, answer)
		).toMatchObject({ missingKeywords: [] });
		expect(parseAnswer(request, '{"overview":"ok"}')).toBeUndefined();
	});
});

describe('HTTP: a review uses 1 of the daily uses', () => {
	let server: Server | undefined;
	const ORIGIN = 'https://cvmaker.codiosity.com';
	afterEach(
		() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
	);
	beforeEach(() => {
		const data = new Map<string, string>();
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: {
				getItem: (k: string) => data.get(k) ?? null,
				setItem: (k: string, v: string) => void data.set(k, v),
				removeItem: (k: string) => void data.delete(k)
			}
		});
	});

	it('charges one use, sends redacted text with a bigger budget, and the client returns the review', async () => {
		const calls: { messages: ChatMessage[]; maxTokens?: number }[] = [];
		const provider: ChatProvider = {
			async complete(messages, options) {
				calls.push({ messages, maxTokens: options?.maxTokens });
				return {
					model: 'm',
					text: JSON.stringify({
						overview: 'CV cukup jelas untuk posisi Data Analyst, tetapi ringkasan belum ada.',
						strengths: [],
						improvements: [{ title: 'Tambahkan ringkasan', detail: 'Dua kalimat di bagian atas.' }],
						rewrites: [],
						missingKeywords: []
					})
				};
			}
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
			store: memoryQuotaStore(),
			provider
		});
		server = createServer((req, res) => void handle(req, res));
		await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;
		const client = createAiClient({
			baseUrl: `http://127.0.0.1:${port}/api/ai`,
			fetch: (input, init) =>
				fetch(input, {
					...init,
					headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN }
				})
		});

		const { result, quota } = await client.review({
			locale: 'id',
			targetRole: 'Data Analyst',
			cvText: CV_TEXT, // NOT redacted by the caller: the client must do it
			jobPost: ''
		});
		expect(result.improvements[0]?.title).toBe('Tambahkan ringkasan');
		expect(quota).toMatchObject({ limit: 3, remaining: 2 });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.maxTokens).toBe(1600);
		const sent = JSON.stringify(calls[0]?.messages);
		for (const secret of ['Rina Putri', 'gmail', '3456', 'linkedin', 'Veteran'])
			expect(sent).not.toContain(secret);
	});
});
