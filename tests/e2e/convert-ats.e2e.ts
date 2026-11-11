import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

interface Quota {
	limit: number;
	remaining: number;
	resetsAt: string;
}
interface ConvertRequest {
	task: 'convert';
	convert: { locale: 'id' | 'en'; targetRole: string; cvText: string; jobPost: string };
}
interface Api {
	quota: Quota;
	quotaCalls: number;
	runs: ConvertRequest[];
	polls: number;
	jobIds: string[];
	requests: { method: string; path: string }[];
	external: string[];
	unexpected: string[];
	errors: string[];
	mode: 'done' | 'failed';
	startGate?: Promise<void>;
	jobGate?: Promise<void>;
}
interface HeldSaveWindow {
	conversionSaveGate?: {
		held: boolean;
		released: boolean;
		key: string;
		release: () => void;
		restore: () => void;
	};
}

const pdf = fileURLToPath(new URL('../fixtures/scan-simple.pdf', import.meta.url));
const fullName = 'Rina Putri Lestari';
const email = 'rina@gmail.com';
const phone = '081234567890';
const originalSummary =
	'Lulusan Sistem Informasi yang mengolah data penjualan dengan SQL dan Python.';
const aiSummary =
	'Lulusan Sistem Informasi dengan pengalaman mengolah [isi angka] laporan penjualan.';
const aiBullet = 'Meningkatkan ketepatan laporan [add number]% dengan Python.';
const looseLine = 'Saya ingin memeriksa ulang bagian ini sebelum mengirim lamaran.';
const panel = (page: Page) => page.getByTestId('convert-panel');
const review = (page: Page) => page.getByTestId('conversion-review');
const aiButton = (page: Page) =>
	panel(page).getByRole('button', { name: 'Rapikan dengan AI (1 jatah)', exact: true });
const localButton = (page: Page) =>
	panel(page).getByRole('button', { name: 'Ubah tanpa AI', exact: true });
const consent = (page: Page) =>
	page.getByRole('dialog', { name: 'Ubah CV dengan AI?', exact: true });
const mocks = new WeakMap<Page, Api>();

function quota(remaining = 3): Quota {
	return { limit: 3, remaining, resetsAt: '2026-11-11T17:00:00.000Z' };
}

function deferred() {
	let release = () => {};
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

function cvText(marker = originalSummary) {
	return `${fullName}
Fresh Graduate Sistem Informasi
${email} | ${phone} | https://linkedin.com/in/rina-convert
Domisili: Jl. Rahasia No. 9, Malang
RINGKASAN
${marker}
PENDIDIKAN
Universitas Brawijaya
S1 Sistem Informasi, 2021 - 2025, IPK 3.65/4.00
PENGALAMAN KERJA
Data Analyst Intern - PT Maju Jaya | Jan 2024 - Jun 2024
- bantu bikin 12 dashboard penjualan pakai Power BI
- bersihin data transaksi pakai Python
KEAHLIAN
SQL, Python, Power BI`;
}

function textFile(marker?: string) {
	return { name: 'cv-konversi.txt', mimeType: 'text/plain', buffer: Buffer.from(cvText(marker)) };
}

function convertedResult() {
	return {
		task: 'convert',
		draft: {
			targetRole: 'Data Analyst',
			headline: 'Fresh Graduate Sistem Informasi',
			summary: aiSummary,
			education: [
				{
					institution: 'Universitas Brawijaya',
					degree: 'S1',
					major: 'Sistem Informasi',
					gpa: '3.65',
					gpaScale: '4.00',
					dates: { start: '2021-01', end: '2025-01', current: false },
					highlights: []
				}
			],
			experience: [
				{
					type: 'internship',
					role: 'Data Analyst Intern',
					company: 'PT Maju Jaya',
					location: '',
					dates: { start: '2024-01', end: '2024-06', current: false },
					bullets: ['Membuat 12 dashboard penjualan dengan Power BI.', aiBullet]
				}
			],
			organizations: [],
			projects: [],
			skills: { hard: ['SQL'], tools: ['Python', 'Power BI'], soft: [] },
			languages: [],
			certifications: [],
			awards: []
		},
		monthGuessed: 2,
		suggestedSkills: ['Tableau', 'Statistik'],
		notes: [
			{
				title: 'Periksa hasil terukur',
				detail: 'Ganti penanda angka dengan hasil yang benar-benar kamu kerjakan.'
			}
		]
	};
}

// A valid PDF without text exercises the same imageOnly state as a scanned image PDF.
function unreadablePdf() {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>',
		'<< /Length 0 >>\nstream\n\nendstream'
	];
	let text = '%PDF-1.4\n';
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(Buffer.byteLength(text));
		text += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xref = Buffer.byteLength(text);
	text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	text += offsets
		.slice(1)
		.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
		.join('');
	text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return { name: 'cv-gambar.pdf', mimeType: 'application/pdf', buffer: Buffer.from(text) };
}

async function mockApi(page: Page, baseURL: string | undefined, remaining = 3) {
	if (!baseURL) throw new Error('A local preview baseURL is required.');
	const origin = new URL(baseURL).origin;
	const state: Api = {
		quota: quota(remaining),
		quotaCalls: 0,
		runs: [],
		polls: 0,
		jobIds: [],
		requests: [],
		external: [],
		unexpected: [],
		errors: [],
		mode: 'done'
	};
	mocks.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page
		.context()
		.on('page', (other) => other.on('pageerror', (error) => state.errors.push(error.message)));
	await page.context().route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		state.requests.push({ method: request.method(), path: url.pathname });
		if (url.origin !== origin) {
			state.external.push(url.href);
			return route.abort('blockedbyclient');
		}
		if (url.pathname === '/api/hello' && ['GET', 'POST'].includes(request.method()))
			return route.fulfill({ json: { visitors: 1234 } });
		if (url.pathname === '/api/ai/quota' && request.method() === 'GET') {
			state.quotaCalls += 1;
			return route.fulfill({ json: state.quota });
		}
		if (url.pathname === '/api/ai/device' && request.method() === 'POST')
			return route.fulfill({ json: { token: 'v1.e2e-convert-anonymous' } });
		if (url.pathname === '/api/ai/run' && request.method() === 'POST') {
			const body = request.postDataJSON() as ConvertRequest;
			if (body.task !== 'convert') state.unexpected.push(`Unexpected AI task ${body.task}`);
			state.runs.push(body);
			if (state.startGate) await state.startGate;
			state.quota = { ...state.quota, remaining: Math.max(0, state.quota.remaining - 1) };
			const job = `e2e-convert-job-${state.runs.length}`;
			state.jobIds.push(job);
			return route.fulfill({ status: 202, json: { job, quota: state.quota } });
		}
		if (url.pathname === '/api/ai/job' && request.method() === 'GET') {
			const id = url.searchParams.get('id');
			if (!id || !state.jobIds.includes(id)) state.unexpected.push(`Unknown job id ${id}`);
			if (!request.headers()['x-device-token'])
				state.unexpected.push('Polling without device token');
			state.polls += 1;
			if (state.polls === 1) return route.fulfill({ json: { status: 'pending' } });
			if (state.jobGate) await state.jobGate;
			if (state.mode === 'failed') {
				state.quota = quota();
				return route.fulfill({ status: 503, json: { error: 'unavailable', quota: state.quota } });
			}
			return route.fulfill({
				json: { status: 'done', result: convertedResult(), quota: state.quota }
			});
		}
		if (url.pathname.startsWith('/api/')) {
			state.unexpected.push(`${request.method()} ${url.pathname}`);
			return route.fulfill({ status: 500, json: { error: 'failed' } });
		}
		return route.continue();
	});
	return state;
}

async function openScanner(page: Page) {
	await page.goto('/cek-ats');
	await expect(page.getByRole('tab', { name: 'Upload file CV', exact: true })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

async function uploadText(page: Page, marker?: string) {
	await page.locator('#ats-file').setInputFiles(textFile(marker));
	await expect(page.getByTestId('scan-score')).toBeVisible();
	await expect(panel(page)).toBeVisible();
}

async function accept(page: Page) {
	await expect(consent(page)).toBeVisible();
	await consent(page).getByRole('button', { name: 'Kirim & pakai 1 jatah', exact: true }).click();
}

async function startAi(page: Page) {
	await aiButton(page).click();
	await accept(page);
}

async function waitForReview(page: Page, api: Api) {
	await expect.poll(() => api.polls).toBeGreaterThanOrEqual(1);
	await expect(review(page)).toBeVisible();
}

async function waitForHeldJob(api: Api) {
	await expect.poll(() => api.polls).toBeGreaterThanOrEqual(1);
	await expect.poll(() => api.polls).toBeGreaterThanOrEqual(2);
}

async function finishHeldJob(page: Page, release: () => void) {
	const response = page.waitForResponse(
		(answer) => new URL(answer.url()).pathname === '/api/ai/job'
	);
	release();
	await (await response).finished();
	await page.evaluate(
		() =>
			new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
	);
}

async function openSection(page: Page, key: string) {
	const editor = page.getByTestId('full-editor');
	if ((page.viewportSize()?.width ?? 0) < 1024)
		await editor.getByRole('button', { name: 'Ubah', exact: true }).click();
	const section = page.locator(`[data-testid="editor-section"][data-section-key="${key}"]`);
	const toggle = section.locator('button[aria-expanded]').first();
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	return section;
}

async function savedEditor(page: Page) {
	await review(page).getByRole('button', { name: 'Simpan & buka editor', exact: true }).click();
	await expect(page).toHaveURL(/\/cv\/[^/]+\/edit$/);
	await expect(page.getByTestId('full-editor')).toBeVisible();
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
}

async function noSavedCv(page: Page) {
	await page.goto('/cv');
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(page.getByTestId('cv-card')).toHaveCount(0);
}

async function noCvBeforeSaving(page: Page) {
	const other = await page.context().newPage();
	try {
		await other.goto('/cv');
		await expect(other.getByTestId('dashboard-empty')).toBeVisible();
		await expect(other.getByTestId('cv-card')).toHaveCount(0);
	} finally {
		await other.close();
	}
}

async function fits(page: Page, label: string) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		),
		label
	).toBeLessThanOrEqual(0);
}

async function startIncognito(page: Page) {
	const toggle = page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true });
	await toggle.click();
	await page
		.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Nyalakan', exact: true })
		.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

async function endIncognito(page: Page) {
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Mode Incognito aktif', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
}

test.afterEach(async ({ page }) => {
	const api = mocks.get(page);
	if (!api) return;
	expect(api.external, 'All external requests are blocked and none should be attempted').toEqual(
		[]
	);
	expect(api.unexpected, 'All API calls follow the mocked conversion contract').toEqual([]);
	expect(api.errors, 'No unhandled browser errors').toEqual([]);
});

test('keyboard PDF conversion stays local until explicit save and opens populated education in the editor', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await openScanner(page);
	api.requests.length = 0;
	const input = page.locator('#ats-file');
	await input.focus();
	const chooser = page.waitForEvent('filechooser');
	await page.keyboard.press('Enter');
	await (await chooser).setFiles(pdf);
	await expect(page.getByTestId('scan-score')).toHaveText('80/100');
	await page.waitForLoadState('networkidle');
	await localButton(page).focus();
	await page.keyboard.press('Enter');
	await expect(review(page)).toBeVisible();
	await expect(review(page).getByTestId('conversion-contacts')).toContainText(email);
	await expect(review(page).getByTestId('conversion-notes')).toContainText(/nama/i);
	expect(api.requests.filter(({ path }) => path.startsWith('/api/'))).toEqual([]);
	expect(api.runs).toHaveLength(0);
	await savedEditor(page);
	await expect(page.getByLabel(/^Email\b/)).toHaveValue(email);
	expect((await page.getByLabel(/^Nomor HP\b/).inputValue()).replace(/\D/g, '')).toBe(
		'6281234567890'
	);
	const education = await openSection(page, 'education');
	await expect(education.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ })).toHaveValue(
		'Universitas Brawijaya'
	);
	await page.reload();
	const reloaded = await openSection(page, 'education');
	await expect(reloaded.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ })).toHaveValue(
		'Universitas Brawijaya'
	);
	await openScanner(page);
	await page.getByRole('tab', { name: 'CV dari CV Maker', exact: true }).click();
	await page.locator('.cv-list button').first().click();
	await expect(page.getByTestId('ats-panel')).toBeVisible();
	await expect(panel(page)).toHaveCount(0);
});

test('local review retains unplaced lines, allows copying, and cancel saves no CV', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					(window as unknown as { convertCopied: string }).convertCopied = text;
				}
			}
		})
	);
	await openScanner(page);
	await page.locator('#ats-file').setInputFiles({
		name: 'bebas.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from(`Budi Santoso\n${looseLine}`)
	});
	await expect(page.getByTestId('scan-score')).toBeVisible();
	await localButton(page).click();
	await expect(review(page).getByTestId('conversion-unplaced')).toContainText(looseLine);
	await review(page).getByRole('button', { name: 'Salin baris', exact: true }).click();
	expect(
		await page.evaluate(() => (window as unknown as { convertCopied: string }).convertCopied)
	).toContain(looseLine);
	await noCvBeforeSaving(page);
	await review(page).getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(review(page)).toHaveCount(0);
	await expect(page.getByTestId('scan-score')).toBeVisible();
	await noSavedCv(page);
});

test('AI consent sends only redacted convert input, reports job stages and saves only the chosen skill', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const started = deferred();
	api.startGate = started.promise;
	await openScanner(page);
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Data Analyst');
	await page.keyboard.press('Escape');
	await page.getByLabel('Tempel lowongan (opsional)', { exact: true }).fill('SQL, Tableau');
	await uploadText(page);
	try {
		await aiButton(page).click();
		await expect(consent(page).getByTestId('convert-consent-input')).toContainText(
			'Universitas Brawijaya'
		);
		for (const secret of [fullName, email, phone, 'linkedin.com', 'Jl. Rahasia'])
			await expect(consent(page).getByTestId('convert-consent-input')).not.toContainText(secret);
		await consent(page).getByRole('button', { name: 'Batal', exact: true }).click();
		expect(api.runs).toHaveLength(0);
		await aiButton(page).click();
		const preview = await consent(page).getByTestId('convert-consent-input').textContent();
		await accept(page);
		await expect(panel(page).getByTestId('convert-status')).toContainText('Mengirim');
		await expect.poll(() => api.runs.length).toBe(1);
		expect(api.runs[0]).toMatchObject({
			task: 'convert',
			convert: { targetRole: 'Data Analyst', jobPost: 'SQL, Tableau', cvText: preview }
		});
		for (const secret of [fullName, email, phone, 'linkedin.com', 'Jl. Rahasia'])
			expect(JSON.stringify(api.runs[0])).not.toContain(secret);
		started.release();
		await expect(panel(page).getByTestId('convert-status')).toContainText('AI sedang menyusun');
		await expect(panel(page)).toContainText(/sisa 2\b/i);
		await waitForReview(page, api);
		await expect(review(page).getByTestId('conversion-contacts')).toContainText(fullName);
		await expect(review(page).getByTestId('conversion-contacts')).toContainText(email);
		await expect(review(page).getByTestId('conversion-ai-notes')).toContainText(
			'Periksa hasil terukur'
		);
		await expect(review(page).getByTestId('conversion-placeholders').locator('mark')).toHaveText([
			'[isi angka]',
			'[add number]'
		]);
		const skills = review(page).getByTestId('conversion-skills');
		await expect(skills.getByRole('checkbox')).toHaveCount(2);
		await expect(skills.getByRole('checkbox', { name: 'Tableau', exact: true })).not.toBeChecked();
		await expect(
			skills.getByRole('checkbox', { name: 'Statistik', exact: true })
		).not.toBeChecked();
		await skills.getByRole('checkbox', { name: 'Statistik', exact: true }).check();
		await savedEditor(page);
		const section = await openSection(page, 'skills');
		await expect(
			section.getByRole('button', { name: 'Hapus Statistik', exact: true })
		).toBeVisible();
		await expect(section.getByRole('button', { name: 'Hapus Tableau', exact: true })).toHaveCount(
			0
		);
		await page.reload();
		const reloaded = await openSection(page, 'skills');
		await expect(
			reloaded.getByRole('button', { name: 'Hapus Statistik', exact: true })
		).toBeVisible();
		await expect(reloaded.getByRole('button', { name: 'Hapus Tableau', exact: true })).toHaveCount(
			0
		);
	} finally {
		started.release();
	}
});

test('a failed background job refunds quota and offers the local conversion path', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	api.mode = 'failed';
	await openScanner(page);
	await uploadText(page);
	await startAi(page);
	await expect(panel(page)).toContainText(/sisa 2\b/i);
	await expect.poll(() => api.polls).toBeGreaterThanOrEqual(1);
	await expect(panel(page).getByRole('alert')).toContainText(/sementara|tersedia|coba lagi/i);
	await expect(panel(page)).toContainText(/sisa 3\b/i);
	await expect(localButton(page)).toBeEnabled();
	await localButton(page).click();
	await expect(review(page)).toBeVisible();
	await expect(review(page).getByTestId('conversion-contacts')).toContainText(fullName);
	await review(page).getByRole('button', { name: 'Batal', exact: true }).click();
	await noSavedCv(page);
});

test('cancelling an AI review discards the draft instead of creating a dashboard CV', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await openScanner(page);
	await uploadText(page);
	await startAi(page);
	await waitForReview(page, api);
	await noCvBeforeSaving(page);
	await review(page).getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(localButton(page)).toBeVisible();
	await expect(review(page)).toHaveCount(0);
	await noSavedCv(page);
});

test('cancelling a started job keeps the honest quota warning and ignores the late result', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const job = deferred();
	api.jobGate = job.promise;
	await openScanner(page);
	await uploadText(page);
	try {
		await startAi(page);
		await expect(panel(page)).toContainText(/sisa 2\b/i);
		await expect(panel(page)).toContainText(/jatah.*tetap|tetap.*terpakai/i);
		await waitForHeldJob(api);
		await panel(page).getByRole('button', { name: 'Batal', exact: true }).click();
		await finishHeldJob(page, job.release);
		await expect(review(page)).toHaveCount(0);
		await expect(localButton(page)).toBeEnabled();
		await noSavedCv(page);
	} finally {
		job.release();
	}
});

test('resetting the upload while a job is pending saves only the replacement file when explicitly requested', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const job = deferred();
	api.jobGate = job.promise;
	const replacement = 'FileKeduaTerbaru memakai Python untuk menyusun laporan penjualan.';
	await openScanner(page);
	await uploadText(page, 'FilePertamaLama mengolah data dengan SQL.');
	try {
		await startAi(page);
		await waitForHeldJob(api);
		await page.getByRole('button', { name: 'Scan file lain', exact: true }).click();
		await uploadText(page, replacement);
		await finishHeldJob(page, job.release);
		await expect(review(page)).toHaveCount(0);
		await localButton(page).click();
		await expect(review(page)).toBeVisible();
		await savedEditor(page);
		const summary = await openSection(page, 'summary');
		await expect(summary.getByLabel('Ringkasan profil', { exact: true })).toHaveValue(replacement);
		expect(api.runs).toHaveLength(1);
	} finally {
		job.release();
	}
});

test('a mode change during a pending normal job cannot bring its draft into an Incognito session', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const job = deferred();
	api.jobGate = job.promise;
	await openScanner(page);
	await uploadText(page);
	try {
		await startAi(page);
		await waitForHeldJob(api);
		// Real application links and history preserve the tab's module state across this mode change.
		await page
			.locator('.site-header .create-action')
			.getByRole('link', { name: 'Buat CV', exact: true })
			.click();
		await expect(page).toHaveURL(/\/buat$/);
		await startIncognito(page);
		await page.goBack();
		await expect(page).toHaveURL(/\/cek-ats$/);
		await expect(page.getByRole('tab', { name: 'Upload file CV', exact: true })).toBeVisible();
		await expect(page.getByTestId('scan-score')).toHaveCount(0);
		await finishHeldJob(page, job.release);
		await expect(review(page)).toHaveCount(0);
		await expect(page.getByText(aiSummary, { exact: true })).toHaveCount(0);
		await page
			.locator('.site-header .create-action')
			.getByRole('link', { name: 'Buat CV', exact: true })
			.click();
		await expect(
			page.locator('.app-header').getByRole('button', { name: 'Mode Incognito', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await endIncognito(page);
		await noSavedCv(page);
	} finally {
		job.release();
	}
});

test('wiping data in another tab removes the pending conversion and ignores its late answer', async ({
	page,
	context,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const job = deferred();
	api.jobGate = job.promise;
	const other = await context.newPage();
	await openScanner(page);
	await uploadText(page);
	try {
		await startAi(page);
		await waitForHeldJob(api);
		await other.goto('/cv');
		await other
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
		const dialog = other.getByRole('dialog', { name: 'Hapus semua data?', exact: true });
		await dialog.getByRole('textbox', { name: 'Kata konfirmasi', exact: true }).fill('hapus ');
		await dialog
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByTestId('scan-score')).toHaveCount(0);
		await expect(panel(page)).toHaveCount(0);
		await finishHeldJob(page, job.release);
		await expect(review(page)).toHaveCount(0);
		await expect(page.getByText(fullName, { exact: true })).toHaveCount(0);
		await expect(other.getByTestId('cv-card')).toHaveCount(0);
		await noSavedCv(page);
	} finally {
		job.release();
		await other.close();
	}
});

test('an image-only PDF explains why conversion is unavailable and offers a new CV', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	await page.locator('#ats-file').setInputFiles(unreadablePdf());
	await expect(page.getByTestId('scan-image-only')).toBeVisible();
	await expect(page.getByTestId('scan-image-only')).toContainText(/tidak bisa dibaca/i);
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toHaveAttribute(
		'href',
		'/buat'
	);
	await expect(aiButton(page)).toHaveCount(0);
	await expect(localButton(page)).toHaveCount(0);
});

test('English keyboard conversion remains available with zero AI uses and fits both themes at every width', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL, 0);
	await openScanner(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const input = page.locator('#ats-file');
	await expect(input).toHaveAccessibleName('Choose a CV file');
	await input.focus();
	const chooser = page.waitForEvent('filechooser');
	await page.keyboard.press('Enter');
	await (
		await chooser
	).setFiles({
		name: 'graduate.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from(
			`Rina Graduate\n${email} ${phone}\nSUMMARY\nInformation Systems graduate with experience using SQL and Python for sales reporting.\nEDUCATION\nUniversity of Leeds, Bachelor of Science, 2021 - 2025\nSKILLS\nSQL, Python`
		)
	});
	await expect(page.getByTestId('scan-score')).toBeVisible();
	const local = panel(page).getByRole('button', { name: 'Convert without AI', exact: true });
	await expect(local).toBeEnabled();
	await expect(
		panel(page).getByRole('button', { name: 'Improve with AI (1 request)', exact: true })
	).toBeDisabled();
	await local.focus();
	await page.keyboard.press('Enter');
	await expect(
		review(page).getByRole('heading', { name: 'Review the converted CV', exact: true })
	).toBeVisible();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await fits(page, `English dark review ${width}`);
	}
	await page.getByTestId('theme-toggle').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await fits(page, `English light review ${width}`);
	}
	await review(page).getByRole('button', { name: 'Cancel', exact: true }).focus();
	await page.keyboard.press('Enter');
	await noSavedCv(page);
});

test('cancelling before the 202 reply ignores the late onStarted callback and finished job', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	const start = deferred();
	const job = deferred();
	api.startGate = start.promise;
	api.jobGate = job.promise;
	await openScanner(page);
	await uploadText(page);
	try {
		await startAi(page);
		await expect.poll(() => api.runs.length).toBe(1);
		await expect(panel(page).getByTestId('convert-status')).toContainText('Mengirim');
		await panel(page).getByRole('button', { name: 'Batal', exact: true }).click();
		start.release();
		await waitForHeldJob(api);
		await finishHeldJob(page, job.release);
		await expect(panel(page).getByTestId('convert-status')).toHaveCount(0);
		await expect(review(page)).toHaveCount(0);
		await expect(localButton(page)).toBeEnabled();
		await noSavedCv(page);
	} finally {
		start.release();
		job.release();
	}
});

test('a target change during a held repository completion blocks new work until the stale save is removed', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await openScanner(page);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Data Analyst');
	await target.press('Escape');
	await uploadText(page);
	await localButton(page).click();
	await expect(review(page)).toBeVisible();
	const instance = await panel(page).locator('h2').first().getAttribute('id');
	expect(instance).toBeTruthy();
	if (!instance) throw new Error('The mounted conversion panel must have a heading id.');
	await page.evaluate(() => {
		const prototype = IDBRequest.prototype;
		const descriptor = Object.getOwnPropertyDescriptor(prototype, 'addEventListener');
		const original = prototype.addEventListener;
		const gate = {
			held: false,
			released: false,
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
		(window as unknown as HeldSaveWindow).conversionSaveGate = gate;
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
					!captured &&
					type === 'success' &&
					listener &&
					source instanceof IDBObjectStore &&
					source.name === 'cvs' &&
					this.transaction?.mode === 'readwrite'
				) {
					captured = true;
					const wrapped = (event: Event) => {
						this.removeEventListener('success', wrapped);
						gate.held = true;
						gate.key = typeof this.result === 'string' ? this.result : '';
						const invoke = () => {
							if (typeof listener === 'function') listener.call(this, event);
							else listener.handleEvent(event);
						};
						if (gate.released) invoke();
						else resume = invoke;
					};
					Reflect.apply(original, this, [type, wrapped, options]);
					restorePrototype();
					return;
				}
				Reflect.apply(original, this, [type, listener, options]);
			}
		});
	});
	try {
		await review(page).getByRole('button', { name: 'Simpan & buka editor', exact: true }).click();
		await expect
			.poll(() =>
				page.evaluate(() => (window as unknown as HeldSaveWindow).conversionSaveGate?.held)
			)
			.toBe(true);
		expect(
			await page.evaluate(() => (window as unknown as HeldSaveWindow).conversionSaveGate?.key)
		).toBeTruthy();
		await target.fill('Frontend Developer');
		await target.press('Escape');
		await expect(panel(page).locator('h2').first()).toHaveAttribute('id', instance);
		await expect(aiButton(page)).toBeDisabled();
		await expect(localButton(page)).toBeDisabled();
		await expect(panel(page).getByRole('status').filter({ hasText: 'Menyimpan CV' })).toBeVisible();
		await page.evaluate(() => (window as unknown as HeldSaveWindow).conversionSaveGate?.release());
		await expect(localButton(page)).toBeEnabled();
		await expect(review(page)).toHaveCount(0);
		await noCvBeforeSaving(page);
		await localButton(page).click();
		await expect(review(page)).toBeVisible();
		await savedEditor(page);
		const career = page.getByTestId('full-editor').locator('details[data-section-key="target"]');
		if ((await career.getAttribute('open')) === null) await career.locator('summary').click();
		await expect(
			career.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		).toHaveValue('Frontend Developer');
		await page.goto('/cv');
		await expect(page.getByTestId('cv-card')).toHaveCount(1);
		await expect(page.getByTestId('cv-card')).toContainText('CV ATS Frontend Developer');
		expect(api.runs).toHaveLength(0);
	} finally {
		if (!page.isClosed())
			await page.evaluate(() =>
				(window as unknown as HeldSaveWindow).conversionSaveGate?.restore()
			);
	}
});
