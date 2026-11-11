import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

interface Quota {
	limit: number;
	remaining: number;
	resetsAt: string;
	rewards?: { limit: number; remaining: number };
}
interface ReviewRequest {
	task: 'review';
	review: { locale: 'id' | 'en'; targetRole: string; cvText: string; jobPost: string };
}
interface Api {
	quota: Quota;
	quotaCalls: number;
	rewardCalls: number;
	runs: ReviewRequest[];
	requests: { method: string; path: string; type: string }[];
	external: string[];
	unexpected: string[];
	errors: string[];
	mode: 'ok' | 'failed';
	waitForRun?: Promise<void>;
}
interface StatusWindow {
	scanStatuses: string[];
	scanStatusObserver?: MutationObserver;
}

const fixture = fileURLToPath(new URL('../fixtures/scan-simple.pdf', import.meta.url));
const name = 'Rina Putri Lestari';
const email = 'rina@gmail.com';
const phone = '081234567890';
const originalBullet = 'bantu bantu bikin laporan bulanan untuk manajer';
const rewritten = 'Menyusun [isi angka] laporan dan membantu [add number] anggota tim.';
const overview = 'CV mudah dibaca, tetapi pencapaian pengalaman bisa dibuat lebih jelas.';
const literalMarkup = '<img src="https://outside.invalid/scan.png">';
const cvTitle = 'CV Rina — Cek ATS';
const score = (page: Page) => page.getByTestId('scan-score');
const ai = (page: Page) => page.getByTestId('ai-review');
const consent = (page: Page) =>
	page.getByRole('dialog', { name: 'Saran AI untuk CV', exact: true });
const runButton = (page: Page) =>
	ai(page).getByRole('button', { name: 'Minta saran AI', exact: true });
const mocks = new WeakMap<Page, Api>();

function freshQuota(remaining = 3): Quota {
	return { limit: 3, remaining, resetsAt: '2026-11-11T17:00:00.000Z' };
}

function cvText(marker = 'Mengolah data penjualan dengan SQL dan Python.') {
	return `${name}\nData Analyst\n${email} | ${phone}\nhttps://linkedin.com/in/rina-scan\nAlamat: Jl. Rahasia No. 9, Malang\nRINGKASAN\n${marker}\nPENDIDIKAN\nUniversitas Brawijaya, S1 Sistem Informasi, 2021 - 2025\nPENGALAMAN\n• ${originalBullet}\n• Membuat 12 dashboard penjualan untuk 5 cabang\nKEAHLIAN\nSQL, Python, Microsoft Excel`;
}

function textFile(marker?: string) {
	return { name: 'cv-rahasia.txt', mimeType: 'text/plain', buffer: Buffer.from(cvText(marker)) };
}

function docxFile() {
	const namespace = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
	const paragraph = (text: string, list = false) =>
		`<w:p>${list ? '<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>' : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
	const body = [
		paragraph(name),
		paragraph('RINGKASAN'),
		paragraph('Lulusan Sistem Informasi yang mengolah data penjualan dengan SQL.'),
		`<w:tbl><w:tr><w:tc>${paragraph('PENDIDIKAN')}</w:tc></w:tr></w:tbl>`,
		paragraph('Universitas Brawijaya, 2021 - 2025'),
		paragraph('PENGALAMAN'),
		paragraph(originalBullet, true),
		paragraph('Membuat 12 dashboard penjualan dengan SQL', true),
		paragraph('KEAHLIAN'),
		paragraph('SQL, Python')
	].join('');
	const bytes = zipSync({
		'[Content_Types].xml': strToU8('<Types/>'),
		'word/document.xml': strToU8(`<w:document ${namespace}><w:body>${body}</w:body></w:document>`),
		'word/header1.xml': strToU8(`<w:hdr ${namespace}>${paragraph(`${email} ${phone}`)}</w:hdr>`)
	});
	return {
		name: 'cv-tabel.docx',
		mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		buffer: Buffer.from(bytes)
	};
}

// A valid one-page PDF with no text operators exercises the unreadable-file state.
function unreadablePdf() {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>',
		'<< /Length 0 >>\nstream\n\nendstream'
	];
	let pdf = '%PDF-1.4\n';
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(Buffer.byteLength(pdf));
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xref = Buffer.byteLength(pdf);
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	pdf += offsets
		.slice(1)
		.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
		.join('');
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return { name: 'cv-tanpa-teks.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
}

async function mockApi(page: Page, baseURL: string | undefined, quota = freshQuota()) {
	if (!baseURL) throw new Error('The scanner tests require the configured local preview.');
	const origin = new URL(baseURL).origin;
	const state: Api = {
		quota,
		quotaCalls: 0,
		rewardCalls: 0,
		runs: [],
		requests: [],
		external: [],
		unexpected: [],
		errors: [],
		mode: 'ok'
	};
	mocks.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page.on('request', (request) => {
		const url = new URL(request.url());
		state.requests.push({
			method: request.method(),
			path: url.pathname,
			type: request.resourceType()
		});
	});
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			state.external.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	await page.route('**/api/hello', async (route) => {
		if (!['GET', 'POST'].includes(route.request().method())) {
			state.unexpected.push(`${route.request().method()} /api/hello`);
			return route.fulfill({ status: 500 });
		}
		return route.fulfill({ json: { visitors: 1234 } });
	});
	await page.route('**/api/ai/**', async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path === '/api/ai/quota' && request.method() === 'GET') {
			state.quotaCalls += 1;
			return route.fulfill({ json: state.quota });
		}
		if (path === '/api/ai/device' && request.method() === 'POST')
			return route.fulfill({ json: { token: 'v1.e2e-scan-anonymous' } });
		if (path === '/api/ai/reward/start' && request.method() === 'POST') {
			state.rewardCalls += 1;
			return route.fulfill({ json: { adUrl: 'https://iklan.codiosity.com/#e2e-scan-reward' } });
		}
		if (path === '/api/ai/run' && request.method() === 'POST') {
			state.runs.push(request.postDataJSON() as ReviewRequest);
			if (state.waitForRun) await state.waitForRun;
			if (state.mode === 'failed')
				return route.fulfill({ status: 500, json: { error: 'failed', quota: state.quota } });
			state.quota = { ...state.quota, remaining: Math.max(0, state.quota.remaining - 1) };
			return route.fulfill({
				json: {
					result: {
						task: 'review',
						overview,
						strengths: ['Ada pengalaman mengolah data dengan SQL.', literalMarkup],
						improvements: [
							{ title: 'Perjelas pencapaian', detail: 'Tambahkan hasil yang terukur.' }
						],
						rewrites: [{ before: originalBullet, after: rewritten }],
						missingKeywords: ['Tableau']
					},
					quota: state.quota
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
	await expect(page.getByRole('heading', { level: 1, name: 'Cek ATS', exact: true })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

async function uploadText(page: Page, marker?: string) {
	await page.locator('#ats-file').setInputFiles(textFile(marker));
	await expect(score(page)).toBeVisible();
}

async function fits(page: Page, label: string) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		),
		label
	).toBeLessThanOrEqual(0);
}

async function agree(page: Page) {
	await expect(consent(page)).toBeVisible();
	await consent(page).getByRole('button', { name: 'Kirim & pakai 1 jatah', exact: true }).click();
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

// The CV is created through normal controls; no repository imports or direct IndexedDB seed.
async function createDone(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(name);
	await page.getByLabel(/^Email\b/).fill(email);
	await page.getByLabel(/^Nomor HP\b/).fill(phone);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await school.fill('Kampus Cek ATS');
	await school.press('Escape');
	await advance(page, 'Pengalaman kerja / magang');
	for (const title of [
		'Organisasi & kepanitiaan',
		'Proyek',
		'Keahlian & pencapaian',
		'Ringkasan profil',
		'Tinjau CV-mu'
	])
		await advance(page, title, true);
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

test.afterEach(async ({ page }) => {
	const api = mocks.get(page);
	if (!api) return;
	expect(api.external, 'No outside site or AI provider is contacted').toEqual([]);
	expect(api.unexpected, 'Only the documented mocked API methods are used').toEqual([]);
	expect(api.errors, 'The scanner has no unhandled page errors').toEqual([]);
});

test('a real PDF is read locally with meaningful checks, contact and section summaries', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await openScanner(page);
	await expect(
		page.getByText('File dibaca di perangkatmu dan tidak di-upload ke server.', { exact: true })
	).toBeVisible();
	await page.evaluate(() => {
		const state = window as unknown as StatusWindow;
		state.scanStatuses = [];
		const record = () =>
			document.querySelectorAll('[role="status"]').forEach((element) => {
				if (element.textContent?.trim()) state.scanStatuses.push(element.textContent.trim());
			});
		state.scanStatusObserver = new MutationObserver(record);
		state.scanStatusObserver.observe(document.querySelector('main')!, {
			subtree: true,
			childList: true,
			characterData: true
		});
	});
	api.requests.length = 0;
	await page.locator('#ats-file').setInputFiles(fixture);
	await expect(score(page)).toHaveText('80/100');
	await expect(page.getByText('Cukup baik', { exact: true })).toBeVisible();
	await expect(page.locator('[data-check-id="noExperience"]')).toBeVisible();
	await expect(page.locator('[data-check-id="noSkills"]')).toBeVisible();
	await expect(page.locator('[data-check-id="tooShort"]')).toBeVisible();
	await expect(page.locator('[data-check-id="missingEmail"]')).toHaveCount(0);
	await expect(page.locator('[data-check-id="missingPhone"]')).toHaveCount(0);
	await expect(page.locator('[data-check-id] button')).toHaveCount(0);
	await expect(page.getByTestId('scan-sections').locator('li')).toHaveText([
		'Ringkasan profil',
		'Pendidikan'
	]);
	await expect(page.getByTestId('scan-contacts').locator('[data-found="true"]')).toHaveText([
		'Email: ditemukan',
		'Nomor HP: ditemukan'
	]);
	await expect(page.getByTestId('scan-contacts').locator('[data-found="false"]')).toHaveText([
		'LinkedIn: tidak ditemukan'
	]);
	await expect(page.getByTestId('scan-stats').locator('dd')).toHaveText(['1', '9']);
	const statuses = await page.evaluate(() => {
		const state = window as unknown as StatusWindow;
		state.scanStatusObserver?.disconnect();
		return state.scanStatuses.join('\n');
	});
	expect(statuses).toContain('Membaca file');
	expect(statuses).toContain('Menganalisis');
	await page.waitForLoadState('networkidle');
	expect(
		api.requests.filter((request) => request.path.startsWith('/api/')),
		'Local scan sends no API request'
	).toEqual([]);
	expect(api.requests.every((request) => request.method === 'GET')).toBe(true);
	expect(
		api.requests.every(
			(request) =>
				request.path.startsWith('/_app/') ||
				request.path.startsWith('/fonts/') ||
				request.path === '/theme-init.js'
		),
		'Only same-origin static assets are requested while scanning'
	).toBe(true);
	await fits(page, 'PDF report');
});

test('a DOCX dropped on the upload area finds tables, header contacts and matching job keywords', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	await page.getByLabel('Tempel lowongan (opsional)', { exact: true }).fill('SQL, Tableau');
	const file = docxFile();
	const transfer = await page.evaluateHandle(
		({ bytes, name, type }) => {
			const transfer = new DataTransfer();
			transfer.items.add(new File([new Uint8Array(bytes)], name, { type }));
			return transfer;
		},
		{ bytes: [...file.buffer], name: file.name, type: file.mimeType }
	);
	try {
		await page.getByTestId('scan-dropzone').dispatchEvent('drop', { dataTransfer: transfer });
		await expect(score(page)).toBeVisible();
		await expect(page.locator('[data-check-id="tables"]')).toBeVisible();
		await expect(page.locator('[data-check-id="contactInHeaderFooter"]')).toBeVisible();
		await expect(
			page.getByTestId('ats-keywords-present').getByText('SQL', { exact: true })
		).toBeVisible();
		await expect(
			page.getByTestId('ats-keywords-missing').getByText('Tableau', { exact: true })
		).toBeVisible();
		await expect(page.locator('[data-check-id="missingEmail"]')).toHaveCount(0);
	} finally {
		await transfer.dispose();
	}
});

test('unsupported, empty, oversized and damaged files show inline errors and allow a valid retry', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	for (const [name, buffer, message] of [
		[
			'cv.png',
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
			'Format file tidak didukung.'
		],
		['kosong.txt', Buffer.alloc(0), 'File tidak berisi teks.'],
		['besar.pdf', Buffer.alloc(5 * 1024 * 1024 + 1), 'File terlalu besar (maksimal 5 MB).'],
		['rusak.docx', Buffer.from('PK\x03\x04broken'), 'File rusak atau tidak bisa dibuka.']
	] as const) {
		await page
			.locator('#ats-file')
			.setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
		await expect(page.getByRole('alert')).toContainText(message);
		await expect(page.locator('#ats-file')).toHaveAttribute('aria-invalid', 'true');
		const errorId = await page.getByRole('alert').getAttribute('id');
		expect(
			(await page.locator('#ats-file').getAttribute('aria-describedby'))?.split(' ')
		).toContain(errorId);
		await expect(score(page)).toHaveCount(0);
	}
	await page.locator('#ats-file').setInputFiles(docxFile());
	await expect(score(page)).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a PDF without readable text shows a dedicated explanation and create action', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	await page.locator('#ats-file').setInputFiles(unreadablePdf());
	await expect(page.getByTestId('scan-image-only')).toBeVisible();
	await expect(page.getByText(/Teks di file ini tidak bisa dibaca/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toHaveAttribute(
		'href',
		'/buat'
	);
	await expect(page.getByRole('button', { name: 'Perbaiki', exact: true })).toHaveCount(0);
});

test('an existing CV is selected with keyboard tabs and its summary check opens the correct editor field', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	const id = await createDone(page);
	await openScanner(page);
	const upload = page.getByRole('tab', { name: 'Upload file CV', exact: true });
	const own = page.getByRole('tab', { name: 'CV dari CV Maker', exact: true });
	await upload.focus();
	await page.keyboard.press('ArrowRight');
	await expect(own).toBeFocused();
	await expect(own).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: new RegExp(cvTitle) }).click();
	const panel = page.getByTestId('ats-panel');
	await expect(panel.getByTestId('ats-score')).toBeVisible();
	await panel.locator('[data-check-id="missingSummary"]').click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit(?:[?#].*)?$`));
	await expect(page.locator('#summary')).toBeFocused();
});

test('AI consent previews redacted text, cancellation sends nothing, and accepted review renders safe results', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					(window as unknown as { scanCopied: string }).scanCopied = text;
				}
			}
		});
	});
	await openScanner(page);
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Data Analyst');
	await page.keyboard.press('Escape');
	await page.getByLabel('Tempel lowongan (opsional)', { exact: true }).fill('SQL, Tableau');
	await uploadText(page);
	await runButton(page).click();
	const input = consent(page).getByTestId('ai-review-input');
	await expect(input).toContainText('Universitas Brawijaya');
	for (const secret of [name, email, phone, 'linkedin.com', 'Jl. Rahasia'])
		await expect(input).not.toContainText(secret);
	await consent(page).getByRole('button', { name: 'Batal', exact: true }).click();
	expect(api.runs).toHaveLength(0);
	await runButton(page).click();
	const sentText = await consent(page).getByTestId('ai-review-input').textContent();
	await agree(page);
	await expect(page.getByTestId('ai-review-results')).toContainText(overview);
	await expect(
		page.getByTestId('ai-review-results').getByText(literalMarkup, { exact: true })
	).toBeVisible();
	await expect(page.getByTestId('ai-review-results').locator('img')).toHaveCount(0);
	expect(api.runs).toHaveLength(1);
	expect(api.runs[0]).toMatchObject({
		task: 'review',
		review: { targetRole: 'Data Analyst', jobPost: 'SQL, Tableau', cvText: sentText }
	});
	const body = JSON.stringify(api.runs[0]);
	for (const secret of [name, email, phone, 'linkedin.com', 'Jl. Rahasia'])
		expect(body).not.toContain(secret);
	const rewrites = page.getByTestId('ai-review-rewrites');
	await expect(rewrites.locator('mark')).toHaveText(['[isi angka]', '[add number]']);
	await rewrites.getByRole('button', { name: 'Salin', exact: true }).click();
	expect(await page.evaluate(() => (window as unknown as { scanCopied: string }).scanCopied)).toBe(
		rewritten
	);
	await expect(ai(page).getByRole('button', { name: 'Tableau', exact: true })).toHaveCount(0);
	await expect(ai(page)).toContainText('2');
	await fits(page, 'AI review');
});

test('zero quota disables review, a mocked reward refreshes it, and a failed review keeps the use', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL, {
		...freshQuota(0),
		rewards: { limit: 10, remaining: 3 }
	});
	await page.addInitScript(() => {
		const state = window as unknown as {
			scanAd: { url: string; openerNull: boolean; closed: boolean };
		};
		state.scanAd = { url: '', openerNull: false, closed: false };
		window.open = () =>
			({
				set opener(value: unknown) {
					state.scanAd.openerNull = value === null;
				},
				location: {
					replace(url: string) {
						state.scanAd.url = url;
					}
				},
				close() {
					state.scanAd.closed = true;
				}
			}) as unknown as Window;
	});
	await openScanner(page);
	await uploadText(page);
	await expect(runButton(page)).toBeDisabled();
	await ai(page)
		.getByRole('button', { name: /^Tonton iklan untuk \+1 bantuan AI/ })
		.click();
	await expect.poll(() => api.rewardCalls).toBe(1);
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { scanAd: { url: string } }).scanAd.url))
		.toContain('lang=id');
	expect(
		await page.evaluate(
			() => (window as unknown as { scanAd: { openerNull: boolean } }).scanAd.openerNull
		)
	).toBe(true);
	api.quota = { ...freshQuota(1), limit: 4, rewards: { limit: 10, remaining: 2 } };
	const calls = api.quotaCalls;
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect.poll(() => api.quotaCalls).toBeGreaterThan(calls);
	await expect(runButton(page)).toBeEnabled();
	api.mode = 'failed';
	await runButton(page).click();
	await agree(page);
	await expect(ai(page).getByRole('alert')).toContainText('Jatahmu tidak berkurang');
	expect(api.quota.remaining).toBe(1);
	api.mode = 'ok';
	await runButton(page).click();
	await expect(page.getByTestId('ai-review-results')).toContainText(overview);
	expect(api.runs).toHaveLength(2);
	await expect(runButton(page)).toBeDisabled();
});

test('scan another file clears every field and a reload never restores uploaded text or results', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	await expect(page.getByRole('tab', { name: 'CV dari CV Maker', exact: true })).toHaveCount(0);
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Data Analyst');
	await page.keyboard.press('Escape');
	await page.getByLabel('Tempel lowongan (opsional)', { exact: true }).fill('SQL, Tableau');
	await uploadText(page, 'RahasiaCanaryScan tidak boleh tersimpan di browser.');
	const storage = await page.evaluate(() =>
		JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })
	);
	expect(storage).not.toContain('RahasiaCanaryScan');
	expect(storage).not.toContain(name);
	await page.getByRole('button', { name: 'Scan file lain', exact: true }).click();
	await expect(score(page)).toHaveCount(0);
	await expect(page.locator('#ats-file')).toHaveValue('');
	await expect(page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })).toHaveValue(
		''
	);
	await expect(page.getByLabel('Tempel lowongan (opsional)', { exact: true })).toHaveValue('');
	await uploadText(page);
	await page.reload();
	await expect(score(page)).toHaveCount(0);
	await expect(page.getByTestId('ai-review-results')).toHaveCount(0);
	await expect(page.locator('#ats-file')).toHaveValue('');
	await page.goto('/cv');
	await expect(page.getByTestId('cv-card')).toHaveCount(0);
});

test('resetting while AI is pending ignores its late result and a new review uses only the new file', async ({
	page,
	baseURL
}) => {
	const api = await mockApi(page, baseURL);
	await openScanner(page);
	await uploadText(page, 'FilePertamaRahasia menggunakan SQL.');
	let release = () => {};
	api.waitForRun = new Promise<void>((done) => {
		release = done;
	});
	try {
		await runButton(page).click();
		await agree(page);
		await expect.poll(() => api.runs.length).toBe(1);
		await page.getByRole('button', { name: 'Scan file lain', exact: true }).click();
		await uploadText(page, 'FileKeduaTerbaru menggunakan Python.');
		const response = page.waitForResponse(
			(response) => new URL(response.url()).pathname === '/api/ai/run'
		);
		release();
		await response;
		api.waitForRun = undefined;
		await page.evaluate(
			() =>
				new Promise<void>((done) =>
					requestAnimationFrame(() => requestAnimationFrame(() => done()))
				)
		);
		await expect(page.getByTestId('ai-review-results')).toHaveCount(0);
		await runButton(page).click();
		await expect(page.getByTestId('ai-review-results')).toContainText(overview);
		expect(api.runs).toHaveLength(2);
		const second = api.runs[1]?.review;
		expect(second).toBeDefined();
		if (!second) throw new Error('The second accepted review must have a request body.');
		expect(second.cvText).toContain('FileKeduaTerbaru');
		expect(second.cvText).not.toContain('FilePertamaRahasia');
	} finally {
		release();
	}
});

test('English navigation and keyboard upload work in both themes without horizontal overflow', async ({
	page,
	baseURL
}) => {
	await mockApi(page, baseURL);
	await openScanner(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(
		page.getByRole('heading', { level: 1, name: 'ATS Check', exact: true })
	).toBeVisible();
	const choose = page.locator('#ats-file');
	await expect(choose).toHaveAccessibleName('Choose a CV file');
	await choose.focus();
	await expect(choose).toBeFocused();
	const chooser = page.waitForEvent('filechooser');
	await page.keyboard.press('Enter');
	await (await chooser).setFiles(textFile());
	await expect(score(page)).toBeVisible();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await fits(page, `English dark ${width}`);
	}
	await page.getByTestId('theme-toggle').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await fits(page, `English light ${width}`);
	}
});
