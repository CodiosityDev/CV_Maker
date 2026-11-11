import { expect, test, type Locator, type Page } from '@playwright/test';
import { aiConciseInput, conciseFromText } from '../../src/lib/core/ats/concise.ts';
import {
	AI_CONCISE_LIMITS,
	type AiConciseInput,
	type AiQuota
} from '../../src/lib/core/ai/types.ts';
import { redactContacts } from '../../src/lib/core/ai/redact.ts';
import { SCAN_MAX_PASTE_CHARS } from '../../src/lib/core/scan/types.ts';

interface LiteRequest {
	task: 'concise';
	concise: AiConciseInput;
}

interface MockApi {
	quota: AiQuota;
	liteRequests: LiteRequest[];
	requests: { method: string; path: string }[];
	outside: string[];
	unexpected: string[];
	errors: string[];
	expectedHttpErrors: number[];
	mode: 'ok' | 'quota' | 'unavailable';
	shorter: string;
	waitForLite?: Promise<void>;
}

interface HeldSaveWindow {
	conciseSaveGate?: {
		held: boolean;
		released: boolean;
		writes: number;
		key: string;
		release: () => void;
		restore: () => void;
	};
}

const fullName = 'Nadia Rahasia Ringkas';
const email = 'nadia.rahasia@example.com';
const phone = '081234567890';
const link = 'https://linkedin.com/in/nadia-rahasia';
const title = 'CV Nadia — Keringkasan';
const summary =
	'Lulusan Informatika yang mengembangkan REST API menggunakan PHP dan MySQL. Mendokumentasikan proyek kampus untuk tim pengembang.';
const contactOnlySummary = 'Alamat: Jalan Panjang Nomor Dua Jakarta Selatan';
const tight = 'Membangun REST API dengan PHP dan MySQL untuk 3 modul aplikasi';
const secondTight = 'Mengolah 40 laporan administrasi bulanan menggunakan Microsoft Excel';
const wordy =
	'Bertanggung jawab untuk melakukan berbagai macam kegiatan administrasi kantor dan juga membantu dalam proses pengarsipan dokumen-dokumen penting perusahaan dengan baik setiap harinya selama masa magang berlangsung';
const shorter = 'Mengelola administrasi kantor dan mengarsipkan dokumen perusahaan selama magang';
const markup = '<img src=x onerror="window.conciseXss=true">';
const jobPost = 'PHP, Laravel, RESTful API, MySQL';
const mocks = new WeakMap<Page, MockApi>();
const panel = (page: Page) => page.getByTestId('concise-panel');
const score = (page: Page) => panel(page).getByTestId('concise-score');
const requestAi = (page: Page) => panel(page).getByTestId('concise-ai-request');
const consent = (page: Page) =>
	page.getByRole('dialog', { name: 'Cek keringkasan dengan AI?', exact: true });

function cvText(bullet = wordy, profile = summary) {
	return [
		fullName,
		'Web Developer',
		`${email} | ${phone}`,
		link,
		'Alamat: Jalan Rahasia No. 9, Bandung',
		'RINGKASAN',
		profile,
		'PENDIDIKAN',
		'Kampus Contoh, S1 Informatika, 2021 - 2025',
		'PENGALAMAN',
		'Web Developer Intern — Studio Contoh',
		'Jan 2024 - Jun 2024',
		`• ${tight}`,
		`• ${bullet}`,
		'KEAHLIAN',
		'PHP, MySQL'
	].join('\n');
}

function textFile(text = cvText()) {
	return { name: 'cv-ringkas.txt', mimeType: 'text/plain', buffer: Buffer.from(text) };
}

async function mockApi(page: Page, baseURL: string | undefined) {
	if (!baseURL) throw new Error('Conciseness tests require the local preview base URL.');
	const origin = new URL(baseURL).origin;
	const state: MockApi = {
		quota: {
			limit: 3,
			remaining: 3,
			resetsAt: '2026-11-12T17:00:00.000Z',
			lite: { limit: 20, remaining: 20 }
		},
		liteRequests: [],
		requests: [],
		outside: [],
		unexpected: [],
		errors: [],
		expectedHttpErrors: [],
		mode: 'ok',
		shorter
	};
	mocks.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const status = message.text().match(/^Failed to load resource:.*status of (429|503)\b/);
		const expected = status ? state.expectedHttpErrors.indexOf(Number(status[1])) : -1;
		if (expected >= 0) state.expectedHttpErrors.splice(expected, 1);
		else state.errors.push(message.text());
	});
	page.on('request', (request) => {
		state.requests.push({ method: request.method(), path: new URL(request.url()).pathname });
	});
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			state.outside.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	await page.route('**/api/hello', async (route) => {
		if (!['GET', 'POST'].includes(route.request().method()))
			state.unexpected.push(`${route.request().method()} /api/hello`);
		return route.fulfill({ json: { visitors: 1234 } });
	});
	await page.route('**/api/ai/**', async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path === '/api/ai/quota' && request.method() === 'GET')
			return route.fulfill({ json: state.quota });
		if (path === '/api/ai/device' && request.method() === 'POST')
			return route.fulfill({ json: { token: 'v1.e2e-concise-anonymous' } });
		if (path === '/api/ai/lite' && request.method() === 'POST') {
			const body = request.postDataJSON() as LiteRequest;
			state.liteRequests.push(body);
			if (state.waitForLite) await state.waitForLite;
			if (state.mode === 'quota') {
				state.quota = { ...state.quota, lite: { limit: 20, remaining: 0 } };
				state.expectedHttpErrors.push(429);
				// The actual lite endpoint does not attach the shared AI quota to this error.
				return route.fulfill({ status: 429, json: { error: 'quota' } });
			}
			if (state.mode === 'unavailable') {
				state.expectedHttpErrors.push(503);
				return route.fulfill({ status: 503, json: { error: 'unavailable' } });
			}
			state.quota = {
				...state.quota,
				lite: { limit: 20, remaining: Math.max(0, (state.quota.lite?.remaining ?? 20) - 1) }
			};
			return route.fulfill({
				json: {
					result: {
						task: 'concise',
						points: body.concise.points.map((point) =>
							point.text.startsWith('Bertanggung jawab')
								? { score: 25, issues: ['filler', 'tooLong'], shorter: state.shorter }
								: null
						)
					},
					lite: state.quota.lite
				}
			});
		}
		state.unexpected.push(`${request.method()} ${path}`);
		return route.fulfill({ status: 500, json: { error: 'failed' } });
	});
	return state;
}

async function openScanner(page: Page) {
	await page.goto('/cek-ats');
	await expect(page.getByRole('heading', { name: 'Cek ATS', level: 1, exact: true })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

async function upload(page: Page, text = cvText()) {
	await page.locator('#ats-file').setInputFiles(textFile(text));
	await expect(page.getByTestId('scan-score')).toBeVisible();
	await expect(score(page)).toBeVisible();
}

async function pasteCv(page: Page, text = cvText()) {
	await page.getByRole('tab', { name: 'Tempel teks CV', exact: true }).click();
	await page.locator('#ats-paste-text').fill(text);
	await page.locator('#scan-paste-submit').click();
	await expect(page.getByTestId('scan-score')).toBeVisible();
	await expect(score(page)).toBeVisible();
}

async function agree(page: Page) {
	await expect(consent(page)).toBeVisible();
	await consent(page).getByRole('button', { name: 'Setuju & cek', exact: true }).click();
}

async function fits(page: Page, label: string) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		),
		label
	).toBeLessThanOrEqual(0);
}

async function advance(page: Page, heading: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(heading);
}

// All local data goes through the same wizard controls an applicant uses.
async function reachReview(page: Page, profile = summary) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await page.getByLabel(/^Email\b/).fill(email);
	await page.getByLabel(/^Nomor HP\b/).fill(phone);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await school.fill('Kampus Contoh');
	await school.press('Escape');
	await advance(page, 'Pengalaman kerja / magang');
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	const experience = page.locator('.collection-steps .item-card').last();
	const role = experience.getByRole('combobox', { name: 'Posisi / peran', exact: true });
	await role.fill('Web Developer Intern');
	await role.press('Escape');
	await experience.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
	for (const [index, value] of [tight, secondTight, wordy].entries()) {
		await experience.getByRole('button', { name: 'Tambah poin', exact: true }).click();
		await experience.getByRole('textbox', { name: `Poin ${index + 1}`, exact: true }).fill(value);
	}
	const bulletId = await experience
		.getByRole('textbox', { name: 'Poin 3', exact: true })
		.getAttribute('id');
	if (!bulletId) throw new Error('The third experience bullet requires a stable field id.');
	await advance(page, 'Organisasi & kepanitiaan');
	await advance(page, 'Proyek', true);
	await advance(page, 'Keahlian & pencapaian', true);
	await advance(page, 'Ringkasan profil', true);
	await page.getByLabel('Ringkasan profil', { exact: true }).fill(profile);
	await advance(page, 'Tinjau CV-mu');
	await expect(panel(page)).toBeVisible();
	await expect(score(page)).toBeVisible();
	return { bulletId, id: new URL(page.url()).pathname.split('/').at(-1)! };
}

async function bulletValues(fields: Locator) {
	return fields.evaluateAll((elements) =>
		elements.map((element) => (element as HTMLTextAreaElement).value)
	);
}

// Hold the first real save's completion, leaving native writes and subsequent UI actions intact.
async function holdFirstSave(page: Page) {
	await page.evaluate(() => {
		const prototype = IDBRequest.prototype;
		const descriptor = Object.getOwnPropertyDescriptor(prototype, 'addEventListener');
		const original = prototype.addEventListener;
		const gate = {
			held: false,
			released: false,
			writes: 0,
			key: '',
			release: () => {},
			restore: () => {}
		};
		let captured = false;
		let resume: (() => void) | undefined;
		function restorePrototype() {
			if (descriptor) Object.defineProperty(prototype, 'addEventListener', descriptor);
			else Reflect.deleteProperty(prototype, 'addEventListener');
		}
		gate.release = () => {
			gate.released = true;
			const callback = resume;
			resume = undefined;
			callback?.();
		};
		gate.restore = () => {
			restorePrototype();
			gate.release();
		};
		(window as unknown as HeldSaveWindow).conciseSaveGate = gate;
		Object.defineProperty(prototype, 'addEventListener', {
			configurable: true,
			writable: true,
			value: function (
				this: IDBRequest,
				type: string,
				listener: EventListenerOrEventListenerObject | null,
				options?: boolean | AddEventListenerOptions
			) {
				const source = this.source;
				if (
					type === 'success' &&
					listener &&
					source instanceof IDBObjectStore &&
					source.name === 'cvs' &&
					this.transaction?.mode === 'readwrite'
				) {
					const first = !captured;
					captured = true;
					const wrapped = (event: Event) => {
						this.removeEventListener('success', wrapped);
						gate.writes += 1;
						gate.key = typeof this.result === 'string' ? this.result : '';
						const invoke = () => {
							if (typeof listener === 'function') listener.call(this, event);
							else listener.handleEvent(event);
						};
						if (first) {
							gate.held = true;
							if (gate.released) invoke();
							else resume = invoke;
						} else {
							restorePrototype();
							invoke();
						}
					};
					Reflect.apply(original, this, [type, wrapped, options]);
					return;
				}
				Reflect.apply(original, this, [type, listener, options]);
			}
		});
	});
}

test.afterEach(async ({ page }) => {
	const api = mocks.get(page);
	if (!api) return;
	expect(api.outside, 'No outside AI provider, tracker, or asset is contacted').toEqual([]);
	expect(api.unexpected, 'Only the documented mocked API methods are used').toEqual([]);
	expect(api.errors, 'No unexpected console errors or unhandled page errors').toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
	test.describe(`${theme} theme`, () => {
		test.beforeEach(async ({ page }) => {
			await page.addInitScript((value) => localStorage.setItem('cvmaker.theme', value), theme);
		});

		test('pasted CV uses the file pipeline and distinguishes missing Laravel from the REST API alias', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			await openScanner(page);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			const uploadTab = page.getByRole('tab', { name: 'Upload file CV', exact: true });
			const pasteTab = page.getByRole('tab', { name: 'Tempel teks CV', exact: true });
			await uploadTab.focus();
			await page.keyboard.press('End');
			await expect(pasteTab).toBeFocused();
			await expect(pasteTab).toHaveAttribute('aria-selected', 'true');
			const field = page.locator('#ats-paste-text');
			await expect(field).toHaveAttribute('maxlength', String(SCAN_MAX_PASTE_CHARS));
			await page.locator('#scan-paste-submit').click();
			await expect(field).toHaveAttribute('aria-invalid', 'true');
			const inlineError = page.locator('#ats-paste-text-error');
			await expect(inlineError).toHaveText('File tidak berisi teks.');
			const errorId = await inlineError.getAttribute('id');
			expect((await field.getAttribute('aria-describedby'))?.split(' ')).toContain(errorId);
			await field.fill(cvText());
			await page.getByLabel('Tempel lowongan (opsional)', { exact: true }).fill(jobPost);
			api.requests.length = 0;
			await page.locator('#scan-paste-submit').click();
			await expect(page.getByTestId('scan-score')).toBeVisible();
			await expect(
				page.getByTestId('ats-keywords-missing').getByText('Laravel', { exact: true })
			).toBeVisible();
			for (const term of ['PHP', 'REST API', 'MySQL'])
				await expect(
					page.getByTestId('ats-keywords-present').getByText(term, { exact: true })
				).toBeVisible();
			await expect(page.getByTestId('ats-keywords').locator('.keyword-summary')).toContainText(
				'3 dari 4 (75%)'
			);
			await expect(page.getByTestId('ats-keywords-missing-summary')).toHaveText(
				'CV kamu belum memuat 1 dari 4 kata kunci lowongan: Laravel.'
			);
			const pastedScore = await page.getByTestId('scan-score').innerText();
			const pastedStats = await page.getByTestId('scan-stats').innerText();
			const pastedConcise = await score(page).innerText();
			expect(api.requests.filter((request) => request.path.startsWith('/api/'))).toEqual([]);
			await pasteTab.focus();
			await page.keyboard.press('Home');
			await expect(uploadTab).toBeFocused();
			await upload(page);
			await expect(page.getByTestId('scan-score')).toHaveText(pastedScore);
			await expect(page.getByTestId('scan-stats')).toHaveText(pastedStats);
			await expect(score(page)).toHaveText(pastedConcise);
			await page
				.getByLabel('Tempel lowongan (opsional)', { exact: true })
				.fill('QuokkaStack QuokkaStack');
			await expect(
				page.getByTestId('ats-keywords-missing').getByText('QuokkaStack', { exact: true })
			).toBeVisible();
			await expect(page.getByTestId('ats-keywords').locator('.keyword-summary')).toContainText(
				'0 dari 1 (0%)'
			);
			await expect(page.getByTestId('ats-keywords-missing-summary')).toHaveText(
				'CV kamu belum memuat 1 dari 1 kata kunci lowongan: QuokkaStack.'
			);
			await fits(page, 'Paste, file, and keyword results fit the viewport');
		});

		test('local wordiness shows reasons and plain filler spans, while a concise CV has no wordy list', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			await openScanner(page);
			api.requests.length = 0;
			const text = cvText(`${wordy} ${markup}`);
			await upload(page, text);
			await expect(score(page)).toContainText(String(conciseFromText(text).score));
			const point = panel(page).getByTestId('concise-issues').getByTestId('concise-point');
			await expect(point).toHaveCount(1);
			await expect(point).toHaveAttribute('data-level', 'veryWordy');
			await expect(point).toContainText(markup);
			await expect(point).toContainText('Terlalu panjang');
			await expect(point).toContainText('Ada kata yang tidak menambah informasi');
			const filler = point.getByTestId('concise-filler');
			expect((await filler.allTextContents()).map((text) => text.toLowerCase())).toEqual(
				expect.arrayContaining(['bertanggung jawab untuk', 'berbagai macam', 'dengan baik'])
			);
			expect(
				await filler.evaluateAll((elements) =>
					elements.every((element) => element.tagName === 'SPAN')
				)
			).toBe(true);
			await expect(panel(page).locator('img, script')).toHaveCount(0);
			await expect(point.getByTestId('concise-fix')).toHaveCount(0);
			expect(api.requests.filter((request) => request.path.startsWith('/api/'))).toEqual([]);
			await fits(page, 'Local wordy text and literal markup fit');
			await upload(page, cvText(secondTight));
			await expect(panel(page).getByTestId('concise-issues')).toHaveCount(0);
			await expect(panel(page).locator('details.okay')).toHaveJSProperty('open', false);
			await expect(score(page)).toContainText('100');
			await fits(page, 'Concise empty state fits');
			const noPoints = [
				fullName,
				email,
				phone,
				'PENDIDIKAN',
				'Kampus Contoh, 2021 - 2025',
				'KEAHLIAN',
				'PHP, MySQL'
			].join('\n');
			await page.locator('#ats-file').setInputFiles(textFile(noPoints));
			await expect(page.getByTestId('scan-score')).toBeVisible();
			await expect(panel(page)).toHaveCount(0);
			await expect(page.getByTestId('concise-issues')).toHaveCount(0);
			await fits(page, 'A CV without points does not leave a stale conciseness card');
		});

		test('free AI consent sends exactly redacted points and updates lite uses without spending the daily three', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			api.shorter = `${shorter} ${markup}`;
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'clipboard', {
					configurable: true,
					value: {
						writeText: async (text: string) => {
							(window as unknown as { conciseCopied: string }).conciseCopied = text;
						}
					}
				});
			});
			await openScanner(page);
			const clippedContact =
				[60, 60, 60, 60, 52].map((length) => 'a'.repeat(length)).join('.') + '.comx';
			expect(clippedContact).toHaveLength(301);
			const text = [
				fullName,
				`${email} | ${phone} | ${link}`,
				'RINGKASAN',
				contactOnlySummary,
				'PENDIDIKAN',
				'Kampus Contoh, 2021 - 2025',
				'PENGALAMAN',
				`• ${clippedContact}`,
				`• ${wordy} ${email} ${phone} ${link}`,
				'KEAHLIAN',
				'PHP, MySQL'
			].join('\n');
			await upload(page, text);
			await requestAi(page).click();
			await expect(consent(page)).toBeVisible();
			const expected = aiConciseInput(conciseFromText(text), 'id');
			expect(expected.points[0]?.text).toBe('');
			expect(expected.points[1]?.text).toHaveLength(AI_CONCISE_LIMITS.bullet);
			expect(redactContacts(expected.points[1]!.text)).toBe('');
			const expectedPoints = expected.points
				.map((point) => ({
					...point,
					text: redactContacts(point.text)
						.trim()
						.slice(
							0,
							point.kind === 'summary' ? AI_CONCISE_LIMITS.summary : AI_CONCISE_LIMITS.bullet
						)
				}))
				.filter((point) => point.text);
			expect(expectedPoints).toHaveLength(1);
			const preview = consent(page).getByTestId('concise-ai-input-point');
			await expect(preview).toHaveCount(expectedPoints.length);
			const visiblePoints = await bulletValues(preview);
			expect(visiblePoints).toEqual(expectedPoints.map((point) => point.text));
			for (let index = 0; index < expectedPoints.length; index++)
				await expect(preview.nth(index)).toHaveJSProperty('readOnly', true);
			for (const secret of [fullName, email, phone, link, 'Jalan Rahasia'])
				expect(visiblePoints.join('\n')).not.toContain(secret);
			await fits(page, 'Free AI consent fits');
			await consent(page).getByRole('button', { name: 'Batal', exact: true }).click();
			expect(api.liteRequests).toHaveLength(0);
			await requestAi(page).click();
			await agree(page);
			await expect(panel(page).getByTestId('concise-shorter')).toContainText(api.shorter);
			await expect(
				panel(page)
					.getByTestId('concise-point')
					.filter({ hasText: wordy })
					.getByTestId('concise-shorter')
			).toContainText(api.shorter);
			const contactPoint = panel(page).locator('[data-point-key="summary"]');
			await expect(contactPoint.locator('.point-text')).toHaveText(contactOnlySummary);
			await expect(contactPoint.getByTestId('concise-shorter')).toHaveCount(0);
			expect(api.liteRequests).toEqual([
				{ task: 'concise', concise: { locale: 'id', points: expectedPoints } }
			]);
			await expect(panel(page).getByTestId('concise-lite-quota')).toContainText('19');
			await expect(page.getByTestId('ai-review').getByTestId('ai-quota')).toContainText('3');
			expect(api.quota.remaining).toBe(3);
			expect(api.requests.some((request) => request.path === '/api/ai/run')).toBe(false);
			await expect(panel(page).locator('img, script')).toHaveCount(0);
			await expect(
				panel(page).getByRole('button', { name: 'Pakai versi ringkas', exact: true })
			).toHaveCount(0);
			await panel(page).getByRole('button', { name: 'Salin versi ringkas', exact: true }).click();
			expect(
				await page.evaluate(() => (window as unknown as { conciseCopied: string }).conciseCopied)
			).toBe(api.shorter);
			expect(
				await page.evaluate(() =>
					Boolean((window as unknown as { conciseXss?: boolean }).conciseXss)
				)
			).toBe(false);
			await page.getByRole('button', { name: 'English', exact: true }).click();
			await expect(requestAi(page)).toHaveText('Check with AI (free)');
			await fits(page, 'Safe AI suggestion and English controls fit');
			await upload(page, cvText(secondTight));
			await expect(panel(page).getByTestId('concise-shorter')).toHaveCount(0);
			await expect(score(page)).toContainText('100');
		});

		test('503 retains the local report and 429 without shared quota disables only the free check with a reason', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			await openScanner(page);
			await upload(page);
			const before = await score(page).innerText();
			api.mode = 'unavailable';
			await requestAi(page).click();
			await agree(page);
			await expect(panel(page).getByRole('alert')).toContainText('tidak tersedia');
			await expect(score(page)).toHaveText(before);
			await expect(
				panel(page).getByTestId('concise-issues').getByTestId('concise-point')
			).toContainText(wordy);
			await expect(requestAi(page)).toBeEnabled();
			api.mode = 'quota';
			await requestAi(page).click();
			if (await consent(page).isVisible()) await agree(page);
			await expect(requestAi(page)).toBeDisabled();
			await expect(panel(page)).toContainText(/(?:batas|jatah|habis)/i);
			await expect(score(page)).toHaveText(before);
			await expect(
				panel(page).getByTestId('concise-issues').getByTestId('concise-point')
			).toContainText(wordy);
			await expect(page.getByTestId('ai-review').getByTestId('ai-quota')).toContainText('3');
			await expect(
				page.getByTestId('ai-review').getByRole('button', { name: 'Minta saran AI', exact: true })
			).not.toBeDisabled();
			expect(api.liteRequests).toHaveLength(2);
			expect(api.quota.remaining).toBe(3);
			// A positive device balance cannot lift a same-day IP/global lite limit.
			api.quota = { ...api.quota, lite: { limit: 20, remaining: 20 } };
			const sameDay = page.waitForResponse(
				(response) => new URL(response.url()).pathname === '/api/ai/quota'
			);
			await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
			await sameDay;
			await page.waitForLoadState('networkidle');
			await expect(requestAi(page)).toBeDisabled();
			await expect(panel(page)).toContainText('Batas cek gratis tercapai.');
			// The server's later daily reset marker clears only the cached lite block.
			api.mode = 'ok';
			api.quota = { ...api.quota, resetsAt: '2026-11-13T17:00:00.000Z' };
			const newDay = page.waitForResponse(
				(response) => new URL(response.url()).pathname === '/api/ai/quota'
			);
			await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
			await newDay;
			await expect(requestAi(page)).toBeEnabled();
			await expect(panel(page).getByRole('alert')).toHaveCount(0);
			await expect(score(page)).toHaveText(before);
			expect(api.liteRequests).toHaveLength(2);
			expect(api.requests.some((request) => request.path === '/api/ai/run')).toBe(false);
			await fits(page, 'Unavailable and quota messages fit');
		});

		test('changing the pasted source resets results and ignores an older in-flight AI reply', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			let release = () => {};
			api.waitForLite = new Promise<void>((resolve) => {
				release = resolve;
			});
			try {
				await openScanner(page);
				await pasteCv(page);
				await requestAi(page).click();
				await agree(page);
				await expect.poll(() => api.liteRequests.length).toBe(1);
				await page.locator('#ats-paste-text').fill(cvText(secondTight));
				await page.locator('#scan-paste-submit').click();
				await expect(score(page)).toContainText('100');
				const response = page.waitForResponse(
					(response) => new URL(response.url()).pathname === '/api/ai/lite'
				);
				release();
				await response;
				await page.waitForLoadState('networkidle');
				await expect(panel(page).getByTestId('concise-shorter')).toHaveCount(0);
				await expect(panel(page).getByTestId('concise-issues')).toHaveCount(0);
				await expect(score(page)).toContainText('100');
				await expect(consent(page)).toHaveCount(0);
				await fits(page, 'Changed source stays local and fits');
			} finally {
				release();
			}
		});

		test('the wizard fixes the exact third bullet rather than the first bullet', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			const { bulletId } = await reachReview(page);
			const point = panel(page).getByTestId('concise-point').filter({ hasText: wordy });
			await expect(point).toHaveCount(1);
			await expect(point).toHaveAttribute('data-point-key', /\|2$/);
			await point.getByTestId('concise-fix').click();
			await expect(page.locator('.step-heading h1')).toHaveText('Pengalaman kerja / magang');
			await expect(page.locator(`[id="${bulletId}"]`)).toBeFocused();
			await expect(page.locator(`[id="${bulletId}"]`)).toHaveValue(wordy);
			expect(api.liteRequests).toHaveLength(0);
			await fits(page, 'Third bullet target fits in wizard');
		});

		test('editor fixes focus the exact bullet and applying a suggestion changes only that bullet in one undo step', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			const { bulletId, id } = await reachReview(page, contactOnlySummary);
			await page.getByRole('button', { name: 'Selesai', exact: true }).click();
			await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
			await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
			await page.getByText('Ubah lagi', { exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
			const editor = page.getByTestId('full-editor');
			await editor.getByRole('button', { name: 'Cek ATS', exact: true }).click();
			await expect(panel(page)).toBeVisible();
			await panel(page)
				.getByTestId('concise-point')
				.filter({ hasText: wordy })
				.getByTestId('concise-fix')
				.click();
			const third = page.locator(`[id="${bulletId}"]`);
			await expect(third).toBeFocused();
			await editor.getByRole('button', { name: 'Cek ATS', exact: true }).click();
			await expect(panel(page)).toBeVisible();
			await requestAi(page).click();
			await expect(consent(page)).toBeVisible();
			expect(await bulletValues(consent(page).getByTestId('concise-ai-input-point'))).toEqual([
				tight,
				secondTight,
				wordy
			]);
			await agree(page);
			const point = panel(page).getByTestId('concise-point').filter({ hasText: wordy });
			await expect(point.getByTestId('concise-shorter')).toContainText(shorter);
			await point.getByRole('button', { name: 'Pakai versi ringkas', exact: true }).click();
			await page.keyboard.press('Escape');
			await expect(third).toHaveValue(shorter);
			const section = editor.locator(
				'[data-testid="editor-section"][data-section-key="experience"]'
			);
			const bullets = section.getByRole('textbox', { name: /^Poin [123]$/ });
			expect(await bulletValues(bullets)).toEqual([tight, secondTight, shorter]);
			const profile = editor.locator('[data-testid="editor-section"][data-section-key="summary"]');
			const profileToggle = profile.locator('[data-section-toggle]');
			if ((await profileToggle.getAttribute('aria-expanded')) !== 'true')
				await profileToggle.click();
			await expect(profile.getByLabel('Ringkasan profil', { exact: true })).toHaveValue(
				contactOnlySummary
			);
			await editor.getByRole('button', { name: 'Urungkan', exact: true }).click();
			expect(await bulletValues(bullets)).toEqual([tight, secondTight, wordy]);
			await expect(profile.getByLabel('Ringkasan profil', { exact: true })).toHaveValue(
				contactOnlySummary
			);
			await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
			expect(api.liteRequests).toHaveLength(1);
			await fits(page, 'Applied and undone third bullet fits editor');
		});

		test('a saved CV keeps a queued undo when ordinary navigation interrupts its first pending save', async ({
			page,
			baseURL
		}) => {
			const api = await mockApi(page, baseURL);
			const { id } = await reachReview(page);
			await page.getByRole('button', { name: 'Selesai', exact: true }).click();
			await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
			await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
			await openScanner(page);
			await page.getByRole('tab', { name: 'CV dari CV Maker', exact: true }).click();
			await page.getByRole('button', { name: new RegExp(title) }).click();
			await expect(panel(page)).toBeVisible();
			await requestAi(page).click();
			await agree(page);
			const original = panel(page).getByTestId('concise-point').filter({ hasText: wordy });
			await expect(original.getByTestId('concise-shorter')).toContainText(shorter);
			await holdFirstSave(page);
			try {
				await original.getByRole('button', { name: 'Pakai versi ringkas', exact: true }).click();
				await expect
					.poll(() =>
						page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.held)
					)
					.toBe(true);
				expect(
					await page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.key)
				).toBe(id);
				await expect(panel(page).locator('.point-text').filter({ hasText: shorter })).toHaveText(
					shorter
				);
				for (const value of [tight, secondTight])
					await expect(panel(page).locator('.point-text').filter({ hasText: value })).toHaveText(
						value
					);
				await expect(page.locator('#saved-concise-undo')).toBeEnabled();
				await page.locator('#saved-concise-undo').click();
				await expect(panel(page).getByTestId('concise-issues')).toContainText(wordy);
				await expect(page.locator('#saved-concise-undo')).toHaveCount(0);
				await expect(page.getByTestId('saved-concise-state')).toHaveAttribute(
					'data-save-state',
					'saving'
				);
				expect(
					await page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.writes)
				).toBe(1);
				await page
					.locator('.site-header .create-action')
					.getByRole('link', { name: 'Buat CV', exact: true })
					.click();
				await expect(page).toHaveURL(/\/buat$/);
				expect(
					await page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.released)
				).toBe(false);
				await page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.release());
				await expect
					.poll(() =>
						page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.writes)
					)
					.toBe(2);
				await page.goBack();
				await expect(page).toHaveURL(/\/cek-ats$/);
				await page.getByRole('tab', { name: 'CV dari CV Maker', exact: true }).click();
				await page.getByRole('button', { name: new RegExp(title) }).click();
				await expect(panel(page).getByTestId('concise-issues')).toContainText(wordy);
				await expect(panel(page).locator('[data-point-key="summary"] .point-text')).toHaveText(
					summary
				);
				await page.reload();
				await page.getByRole('tab', { name: 'CV dari CV Maker', exact: true }).click();
				await page.getByRole('button', { name: new RegExp(title) }).click();
				await expect(panel(page).getByTestId('concise-issues')).toContainText(wordy);
				await expect(panel(page).locator('[data-point-key="summary"] .point-text')).toHaveText(
					summary
				);
				for (const value of [tight, secondTight])
					await expect(panel(page).locator('.point-text').filter({ hasText: value })).toHaveText(
						value
					);
				expect(api.liteRequests).toHaveLength(1);
				await fits(page, 'Queued undo and unchanged summary persist after navigation and reload');
			} finally {
				await page.evaluate(() => (window as unknown as HeldSaveWindow).conciseSaveGate?.restore());
			}
		});
	});
}
