import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { createApp } from '../../server/src/app';
import type { ChatProvider } from '../../server/src/ai';
import { createJobStore } from '../../server/src/jobs';
import { memoryQuotaStore } from '../../server/src/quota';
import { parseAnswer } from '../../server/src/tasks';
import { createAiClient, AiError } from '../../src/lib/core/ai/index';
import type { AiRequest, AiReviewInput } from '../../src/lib/core/ai/types';
import { convertLocally, findDates, parseCvText } from '../../src/lib/core/convert/index';
import { cvDocumentSchema } from '../../src/lib/core/schema/schema';

const MESSY_CV = `Rina Putri Lestari
Fresh Graduate Sistem Informasi
rina.lestari@gmail.com | 0812-3456-7890 | linkedin.com/in/rinalestari
Domisili: Jl. Veteran No. 10, Malang
Saya lulusan baru yang suka mengolah data dan senang belajar hal baru setiap hari.
PENDIDIKAN
Universitas Brawijaya
S1 Sistem Informasi, 2021 - 2025, IPK 3.65/4.00
PENGALAMAN KERJA
Data Analyst Intern - PT Maju Jaya | Jan 2024 – Jun 2024
- bantu bikin 12 dashboard penjualan pakai power bi
- bersihin data transaksi pakai python
Kasir Paruh Waktu - Toko Sinar | 2022 - 2023
- melayani pembeli
ORGANISASI
Ketua Divisi Riset, Himpunan Mahasiswa SI (Agustus 2022 - Sekarang)
• ngadain survei kepuasan mahasiswa
KEAHLIAN
SQL, Python, Excel • Power BI | komunikasi
BAHASA
Inggris (aktif, TOEFL ITP 550), Jawa (ibu)
SERTIFIKASI
Google Data Analytics Certificate - Coursera, 2024`;

describe('dates', () => {
	it('reads Indonesian and English ranges and flags year-only dates', () => {
		expect(findDates('Jan 2024 – Jun 2024')).toMatchObject({
			range: { start: '2024-01', end: '2024-06', current: false },
			guessed: false
		});
		expect(findDates('Agustus 2022 - Sekarang')?.range).toEqual({
			start: '2022-08',
			end: undefined,
			current: true
		});
		expect(findDates('03/2023 s.d. 11/2023')?.range).toMatchObject({
			start: '2023-03',
			end: '2023-11'
		});
		expect(findDates('PT X | 2021 - 2025')).toMatchObject({
			range: { start: '2021-01', end: '2025-01' },
			guessed: true,
			rest: 'PT X'
		});
		expect(findDates('Mei 2023 to present')?.range.current).toBe(true);
		expect(findDates('tidak ada tanggal')).toBeUndefined();
	});
});

describe('on-device conversion (free)', () => {
	it('splits a messy CV into contacts and sections', () => {
		const { draft, contacts, notes, locale } = parseCvText(MESSY_CV);
		expect(locale).toBe('id');
		expect(contacts).toMatchObject({
			fullName: 'Rina Putri Lestari',
			email: 'rina.lestari@gmail.com',
			city: 'Malang'
		});
		expect(contacts.phone).toBe('+62 812-3456-7890');
		expect(contacts.links).toEqual([
			{ label: 'LinkedIn', url: 'https://linkedin.com/in/rinalestari' }
		]);
		expect(draft.headline).toBe('Fresh Graduate Sistem Informasi');
		expect(draft.summary).toContain('mengolah data');

		expect(draft.education).toHaveLength(1);
		expect(draft.education[0]).toMatchObject({
			institution: 'Universitas Brawijaya',
			degree: 'S1',
			major: 'Sistem Informasi',
			gpa: '3.65',
			gpaScale: '4.00',
			dates: { start: '2021-01', end: '2025-01' }
		});
		expect(draft.experience).toHaveLength(2);
		expect(draft.experience[0]).toMatchObject({
			type: 'internship',
			role: 'Data Analyst Intern',
			company: 'PT Maju Jaya',
			dates: { start: '2024-01', end: '2024-06', current: false }
		});
		expect(draft.experience[0]?.bullets).toHaveLength(2);
		expect(draft.experience[1]).toMatchObject({ type: 'parttime', company: 'Toko Sinar' });
		expect(draft.organizations[0]).toMatchObject({
			role: 'Ketua Divisi Riset',
			name: 'Himpunan Mahasiswa SI',
			dates: { start: '2022-08', current: true }
		});
		expect(draft.skills.hard).toEqual(['SQL', 'Python', 'Excel', 'Power BI', 'komunikasi']);
		expect(draft.languages).toEqual([
			{ name: 'Inggris', level: 'fluent', score: 'TOEFL ITP 550' },
			{ name: 'Jawa', level: 'native', score: '' }
		]);
		expect(draft.certifications[0]).toMatchObject({
			name: 'Google Data Analytics Certificate',
			issuer: 'Coursera',
			date: '2024-01'
		});
		expect(notes.map((n) => n.id)).toContain('monthGuessed');
	});

	it('builds a valid, completed ATS CV and never loses unplaced text silently', () => {
		const { cv, notes, unplaced } = convertLocally(
			{ text: MESSY_CV },
			{ targetRole: 'Data Analyst' }
		);
		expect(v.safeParse(cvDocumentSchema, cv).success).toBe(true);
		expect(cv).toMatchObject({
			kind: 'ats',
			title: 'CV ATS Data Analyst',
			targetRole: 'Data Analyst',
			status: { wizardCompleted: true }
		});
		expect(cv.personal.links[0]?.url).toBe('https://linkedin.com/in/rinalestari');
		expect(unplaced).toEqual([]);
		expect(notes.every((n) => n.messageKey === `ats.convert.notes.${n.id}`)).toBe(true);

		const noHeadings = convertLocally({
			text: 'Budi\nSuka bekerja keras dan jujur dalam semua hal.'
		});
		expect(noHeadings.unplaced.length).toBeGreaterThan(0);
		expect(noHeadings.notes.map((n) => n.id)).toEqual(
			expect.arrayContaining(['missingContact', 'notParsed'])
		);
	});
});

describe('AI answer checks (server)', () => {
	const input: AiReviewInput = {
		locale: 'id',
		targetRole: 'Data Analyst',
		cvText: MESSY_CV.split('\n').slice(4).join('\n'),
		jobPost: 'Dicari Data Analyst yang menguasai SQL dan Tableau'
	};
	const request: AiRequest = { task: 'convert', convert: input };

	it('keeps real facts, drops invented ones and guards numbers', () => {
		const answer = {
			targetRole: '',
			headline: 'Fresh Graduate Sistem Informasi | SQL, Python',
			summary: 'Lulusan S1 Sistem Informasi dengan pengalaman magang analisis data selama 6 bulan.',
			education: [
				{
					institution: 'Univ. Brawijaya',
					degree: 'S1',
					major: 'Sistem Informasi',
					gpa: '3.65',
					gpaScale: '4.00',
					start: '2021',
					end: '2025'
				},
				{ institution: 'Harvard University', degree: 'S2', major: 'Data', start: '2026-01' }
			],
			experience: [
				{
					type: 'internship',
					role: 'Data Analyst Intern',
					company: 'PT Maju Jaya',
					start: '2024-01',
					end: '2024-06',
					bullets: [
						'Membuat 12 dashboard penjualan dengan Power BI',
						'Meningkatkan penjualan 40% lewat analisis data'
					]
				},
				{ type: 'fulltime', role: 'Analyst', company: 'Google Indonesia', start: '2019-01' },
				{ type: 'ceo', role: 'Kasir', company: 'Toko Sinar', start: '2022', end: '2023' }
			],
			organizations: [
				{
					name: 'Himpunan Mahasiswa SI',
					role: 'Ketua Divisi Riset',
					start: '2022-08',
					end: 'present'
				}
			],
			skills: {
				hard: ['SQL', 'Python', 'Machine Learning'],
				tools: ['Power BI', 'Excel'],
				soft: ['Komunikasi']
			},
			languages: [
				{ name: 'Inggris', level: 'fluent', score: 'TOEFL ITP 550' },
				{ name: 'Jepang', level: 'basic' }
			],
			certifications: [
				{ name: 'Google Data Analytics Certificate', issuer: 'Coursera', date: '2024' },
				{ name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2024' }
			],
			awards: [],
			suggestedSkills: ['Tableau', 'SQL', 'Statistik'],
			notes: [
				{ title: 'Tambahkan hasil terukur', detail: 'Tulis dampak dashboard di PT Maju Jaya.' }
			]
		};
		const result = parseAnswer(request, JSON.stringify(answer));
		expect(result?.task).toBe('convert');
		if (result?.task !== 'convert') return;
		const { draft } = result;
		expect(draft.targetRole).toBe('Data Analyst');
		expect(draft.education.map((e) => e.institution)).toEqual(['Univ. Brawijaya']);
		expect(draft.education[0]).toMatchObject({
			gpa: '3.65',
			gpaScale: '4.00',
			dates: { start: '2021-01', end: '2025-01' }
		});
		expect(draft.experience.map((e) => e.company)).toEqual(['PT Maju Jaya', 'Toko Sinar']);
		expect(draft.experience[1]?.type).toBe('fulltime');
		expect(draft.experience[0]?.bullets).toEqual([
			'Membuat 12 dashboard penjualan dengan Power BI',
			'Meningkatkan penjualan [isi angka] lewat analisis data'
		]);
		expect(draft.summary).toContain('[isi angka] bulan');
		expect(draft.organizations[0]?.dates).toEqual({
			start: '2022-08',
			end: undefined,
			current: true
		});
		expect(draft.skills).toEqual({
			hard: ['SQL', 'Python'],
			tools: ['Power BI', 'Excel'],
			soft: ['Komunikasi']
		});
		expect(draft.languages.map((l) => l.name)).toEqual(['Inggris']);
		expect(draft.certifications.map((c) => c.name)).toEqual(['Google Data Analytics Certificate']);
		expect(result.suggestedSkills).toEqual(['Tableau', 'Statistik']);
		expect(result.monthGuessed).toBe(5);
		expect(result.notes).toHaveLength(1);
	});

	it('rejects an answer with nothing usable', () => {
		expect(parseAnswer(request, '{"education":[{"institution":"Harvard"}]}')).toBeUndefined();
		expect(parseAnswer(request, 'maaf')).toBeUndefined();
	});
});

describe('background jobs', () => {
	it('only the starting device can read a job; one running job per device', async () => {
		let release: (value: string) => void = () => {};
		const jobs = createJobStore<string>();
		const id = jobs.start('device-a', () => new Promise((resolve) => (release = resolve)));
		expect(jobs.get(id, 'device-b')).toBeUndefined();
		expect(jobs.get(id, 'device-a')).toEqual({ status: 'pending' });
		expect(jobs.canStart('device-a')).toBe('device');
		expect(jobs.canStart('device-b')).toBe('ok');
		release('done!');
		await Promise.resolve();
		await Promise.resolve();
		expect(jobs.get(id, 'device-a')).toEqual({ status: 'done', value: 'done!' });
		expect(jobs.canStart('device-a')).toBe('ok');
	});

	it('forgets results after a short time', async () => {
		let clock = 0;
		const jobs = createJobStore<string>(() => clock);
		const id = jobs.start('d', async () => 'x');
		await Promise.resolve();
		await Promise.resolve();
		expect(jobs.get(id, 'd')?.status).toBe('done');
		clock += 3 * 60 * 1000;
		expect(jobs.get(id, 'd')).toBeUndefined();
	});
});

describe('HTTP: convert uses 1 use, runs in the background, refunds on failure', () => {
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
				setItem: (k: string, val: string) => void data.set(k, val),
				removeItem: (k: string) => void data.delete(k)
			}
		});
	});

	async function start(provider: ChatProvider) {
		const handle = createApp({
			config: {
				appOrigin: ORIGIN,
				appSecret: '0123456789abcdef0123456789abcdef-test',
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
			store: memoryQuotaStore(),
			provider
		});
		server = createServer((req, res) => void handle(req, res));
		await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;
		return createAiClient({
			baseUrl: `http://127.0.0.1:${port}/api/ai`,
			fetch: (url, init) =>
				fetch(url, {
					...init,
					headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN }
				})
		});
	}

	const input: AiReviewInput = { locale: 'id', targetRole: '', cvText: MESSY_CV, jobPost: '' };

	it('returns the converted draft and the quota; the AI never sees contact details', async () => {
		const seen: string[] = [];
		const client = await start({
			async complete(messages, options) {
				seen.push(JSON.stringify(messages), String(options?.maxTokens), String(options?.timeoutMs));
				await new Promise((resolve) => setTimeout(resolve, 30));
				return {
					model: 'm',
					text: JSON.stringify({
						summary: 'Lulusan S1 Sistem Informasi yang terbiasa mengolah data penjualan.',
						education: [
							{ institution: 'Universitas Brawijaya', degree: 'S1', major: 'Sistem Informasi' }
						],
						skills: { hard: ['SQL'] }
					})
				};
			}
		});
		const started: number[] = [];
		const { result, quota } = await client.convert(input, {
			pollMs: 10,
			onStarted: (q) => started.push(q.remaining)
		});
		expect(started).toEqual([2]);
		expect(quota.remaining).toBe(2);
		expect(result.draft.education[0]?.institution).toBe('Universitas Brawijaya');
		const [messages, maxTokens, timeout] = seen;
		for (const secret of ['Rina Putri', 'gmail', '3456', 'linkedin', 'Veteran'])
			expect(messages).not.toContain(secret);
		expect(Number(maxTokens)).toBeGreaterThan(2000);
		expect(Number(timeout)).toBeGreaterThan(30_000);
	});

	it('gives the use back when the AI fails, and the error reaches the browser', async () => {
		const client = await start({
			async complete() {
				throw new Error('down');
			}
		});
		const error = await client.convert(input, { pollMs: 10 }).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AiError);
		expect((error as AiError).code).toBe('unavailable');
		expect((error as AiError).quota?.remaining).toBe(3);
		expect((await client.quota()).remaining).toBe(3);
	});
});
