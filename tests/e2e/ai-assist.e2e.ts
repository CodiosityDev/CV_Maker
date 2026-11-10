import { expect, test, type Locator, type Page } from '@playwright/test';

type Task = 'headline' | 'summary' | 'skills';
interface Quota {
	limit: number;
	remaining: number;
	resetsAt: string;
	rewards?: { limit: number; remaining: number };
}
interface RunRequest {
	task: Task;
	profile: Record<string, unknown>;
}
interface MockApi {
	quota: Quota;
	quotaCalls: number;
	rewardCalls: number;
	runs: RunRequest[];
	mode: 'ok' | 'quota' | 'unavailable';
	quotaUnavailable: boolean;
	waitForRun?: Promise<void>;
	unexpected: string[];
}

const fullName = 'Nama Rahasia AI';
const email = 'rahasia.ai@example.com';
const phone = '081234567890';
const linkedIn = 'https://www.linkedin.com/in/rahasia-ai';
const headlines = [
	'Web Developer dengan pengalaman proyek kampus',
	'Lulusan Sistem Informasi yang menguasai TypeScript',
	'Pengembang web pemula dengan fokus aksesibilitas'
];
const aiSummary =
	'Lulusan Sistem Informasi yang mengembangkan [isi angka] proyek web dan membantu [add number] anggota tim memakai TypeScript.';
const originalSummary = 'Ringkasan asli saya tentang proyek web kampus.';
const panels = (page: Page, task: Task) =>
	page.locator(`[data-testid="ai-assist"][data-ai-task="${task}"]`);
const saved = (page: Page) => page.getByTestId('save-status');
const consent = (page: Page) => page.getByRole('dialog', { name: 'Bantuan AI', exact: true });
const mocks = new WeakMap<Page, MockApi>();

function freshQuota(remaining = 3): Quota {
	return { limit: 3, remaining, resetsAt: '2026-11-11T17:00:00.000Z' };
}

async function mockApi(page: Page, quota = freshQuota()) {
	const state: MockApi = {
		quota,
		quotaCalls: 0,
		rewardCalls: 0,
		runs: [],
		mode: 'ok',
		quotaUnavailable: false,
		unexpected: []
	};
	mocks.set(page, state);
	await page.route('**/api/ai/**', async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path === '/api/ai/quota' && request.method() === 'GET') {
			state.quotaCalls += 1;
			if (state.quotaUnavailable)
				return route.fulfill({
					status: 502,
					contentType: 'text/html',
					body: '<html>Quota unavailable</html>'
				});
			return route.fulfill({ json: state.quota });
		}
		if (path === '/api/ai/device' && request.method() === 'POST') {
			return route.fulfill({ json: { token: 'v1.e2e-anonymous-token' } });
		}
		if (path === '/api/ai/reward/start' && request.method() === 'POST') {
			state.rewardCalls += 1;
			return route.fulfill({ json: { adUrl: 'https://iklan.codiosity.com/#e2e-reward-ticket' } });
		}
		if (path === '/api/ai/run' && request.method() === 'POST') {
			const body = request.postDataJSON() as RunRequest;
			state.runs.push(body);
			if (state.waitForRun) await state.waitForRun;
			if (state.mode === 'quota') {
				state.quota = { ...state.quota, remaining: 0 };
				return route.fulfill({ status: 429, json: { error: 'quota', quota: state.quota } });
			}
			if (state.mode === 'unavailable')
				return route.fulfill({
					status: 502,
					contentType: 'text/html',
					body: '<html>502 Bad Gateway</html>'
				});
			state.quota = { ...state.quota, remaining: Math.max(0, state.quota.remaining - 1) };
			const result =
				body.task === 'headline'
					? { task: 'headline', headlines }
					: body.task === 'summary'
						? { task: 'summary', summary: aiSummary }
						: {
								task: 'skills',
								hard: ['TypeScript', 'SQL', 'SQL'],
								tools: ['Git'],
								soft: ['Komunikasi']
							};
			return route.fulfill({ json: { result, quota: state.quota } });
		}
		state.unexpected.push(`${request.method()} ${path}`);
		return route.fulfill({ status: 500, json: { error: 'failed' } });
	});
	return state;
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

// Real wizard controls create the CV. Only API answers are mocked; no core import or DB seed.
async function reachEducation(page: Page, incognito = false) {
	await page.goto('/buat');
	if (incognito) {
		await page
			.locator('.app-header')
			.getByRole('button', { name: 'Mode Incognito', exact: true })
			.click();
		await page
			.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
			.getByRole('button', { name: 'Nyalakan', exact: true })
			.click();
	}
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Rahasia AI');
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Web Developer');
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await page.getByLabel(/^Email\b/).fill(email);
	await page.getByLabel(/^Nomor HP\b/).fill(phone);
	const city = page.getByRole('combobox', { name: 'Kota / kabupaten', exact: true });
	await city.fill('Bandung');
	await city.press('Escape');
	await page.getByRole('button', { name: 'Tambah Tautan', exact: true }).click();
	await page.getByLabel('Nama tautan', { exact: true }).fill('LinkedIn');
	await page.getByLabel('URL', { exact: true }).fill(linkedIn);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const institution = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await institution.fill('Kampus Contoh');
	await institution.press('Escape');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function reachHeadline(page: Page, incognito = false) {
	const id = await reachEducation(page, incognito);
	await page.getByRole('button', { name: 'Kembali', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	await expect(panels(page, 'headline')).toBeVisible();
	return id;
}

async function reachSkillsFromEducation(page: Page) {
	await advance(page, 'Pengalaman kerja / magang');
	await advance(page, 'Organisasi & kepanitiaan', true);
	await advance(page, 'Proyek', true);
	await advance(page, 'Keahlian & pencapaian', true);
}

async function reachSkills(page: Page) {
	await reachEducation(page);
	await reachSkillsFromEducation(page);
}

async function reachSummary(page: Page) {
	await reachSkills(page);
	await advance(page, 'Ringkasan profil', true);
}

function runButton(page: Page, task: Task) {
	return panels(page, task).getByRole('button', {
		name:
			task === 'headline'
				? 'Saran headline dengan AI'
				: task === 'skills'
					? 'Saran skill dengan AI'
					: /^(?:Tulis|Perbaiki) dengan AI$/,
		exact: true
	});
}

async function agree(page: Page) {
	await expect(consent(page)).toBeVisible();
	await consent(page).getByRole('button', { name: 'Setuju & lanjutkan', exact: true }).click();
	await expect(consent(page)).not.toBeVisible();
}

async function fitsWidths(page: Page, scope: Locator) {
	const original = page.viewportSize();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(scope).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			),
			`AI UI at ${width}px`
		).toBeLessThanOrEqual(0);
	}
	if (original) await page.setViewportSize(original);
}

async function browserStorage(page: Page) {
	return page.evaluate(() => ({
		local: Object.fromEntries(Object.entries(localStorage)),
		session: Object.fromEntries(Object.entries(sessionStorage))
	}));
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

async function settleResponse(page: Page, release: () => void) {
	const completed = page.waitForResponse(
		(response) => new URL(response.url()).pathname === '/api/ai/run'
	);
	release();
	await (await completed).finished();
	await page.evaluate(
		() =>
			new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
	);
}

test.afterEach(async ({ page }) => {
	expect(
		mocks.get(page)?.unexpected ?? [],
		'Every AI endpoint is mocked; no unexpected request is allowed'
	).toEqual([]);
});

test('consent cancellation sends no run; accepted headline choices use only sanitized profile and consent is shared across steps', async ({
	page,
	context
}) => {
	const api = await mockApi(page);
	const id = await reachHeadline(page);
	const field = page.getByLabel('Headline singkat', { exact: true });
	await field.fill('Headline asli saya');
	await runButton(page, 'headline').click();
	await expect(consent(page)).toContainText(/nama/i);
	await expect(consent(page)).toContainText('email');
	await expect(consent(page)).toContainText('00.00 WIB');
	await fitsWidths(page, consent(page));
	await consent(page).getByRole('button', { name: 'Batal', exact: true }).click();
	expect(api.runs).toHaveLength(0);
	await runButton(page, 'headline').click();
	await agree(page);
	for (const headline of headlines)
		await expect(
			panels(page, 'headline').getByRole('button', { name: headline, exact: true })
		).toBeVisible();
	await expect(panels(page, 'headline')).toContainText('Sisa 2 dari 3');
	await fitsWidths(page, panels(page, 'headline'));
	expect(api.runs).toHaveLength(1);
	expect(api.runs[0]?.task).toBe('headline');
	const profile = api.runs[0]!.profile;
	expect(Object.keys(profile).sort()).toEqual(
		[
			'locale',
			'targetRole',
			'education',
			'experience',
			'organizations',
			'projects',
			'skills',
			'certifications',
			'summary'
		].sort()
	);
	expect(profile.targetRole).toBe('Web Developer');
	expect(profile.education).toEqual([expect.objectContaining({ institution: 'Kampus Contoh' })]);
	for (const secret of [
		fullName,
		email,
		phone,
		'+62 812-3456-7890',
		'Bandung',
		linkedIn,
		'photoAssetId',
		'personal'
	])
		expect(JSON.stringify(api.runs[0])).not.toContain(secret);
	await panels(page, 'headline').getByRole('button', { name: headlines[0], exact: true }).click();
	await expect(field).toHaveValue(headlines[0]!);
	await page.locator('.toolbar').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(field).toHaveValue('Headline asli saya');
	await field.fill('Headline terakhir ditulis manual');
	for (const headline of headlines)
		await expect(
			panels(page, 'headline').getByRole('button', { name: headline, exact: true })
		).toHaveCount(0);
	await advance(page, 'Pendidikan');
	await reachSkillsFromEducation(page);
	await runButton(page, 'skills').click();
	await expect.poll(() => api.runs.length).toBe(2);
	await expect(consent(page)).not.toBeVisible();
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	const other = await context.newPage();
	try {
		const otherApi = await mockApi(other);
		await other.goto(`/buat/${id}`);
		await expect(other.locator('.step-heading h1')).toHaveText('Keahlian & pencapaian');
		await runButton(other, 'skills').click();
		await expect(consent(other)).toBeVisible();
		expect(otherApi.runs).toHaveLength(0);
	} finally {
		await other.close();
	}
});

test('summary suggestions stay in a marked preview until apply and can be ignored or undone', async ({
	page
}) => {
	await mockApi(page);
	await reachSummary(page);
	const field = page.getByLabel('Ringkasan profil', { exact: true });
	await expect(runButton(page, 'summary')).toHaveText('Tulis dengan AI');
	await field.fill(originalSummary);
	await expect(runButton(page, 'summary')).toHaveText('Perbaiki dengan AI');
	await runButton(page, 'summary').click();
	await agree(page);
	const preview = page.getByTestId('ai-summary-preview');
	await expect(preview).toContainText(aiSummary);
	await expect(field).toHaveValue(originalSummary);
	await expect(preview.locator('mark')).toHaveText(['[isi angka]', '[add number]']);
	await expect(panels(page, 'summary')).toContainText('Ganti dengan angka yang benar atau hapus');
	await panels(page, 'summary').getByRole('button', { name: 'Abaikan', exact: true }).click();
	await expect(preview).toHaveCount(0);
	await expect(field).toHaveValue(originalSummary);
	await runButton(page, 'summary').click();
	await expect(preview).toContainText(aiSummary);
	await expect(consent(page)).not.toBeVisible();
	await panels(page, 'summary')
		.getByRole('button', { name: 'Pakai teks ini', exact: true })
		.click();
	await expect(field).toHaveValue(aiSummary);
	await page
		.getByRole('status', { name: 'Notifikasi', exact: true })
		.getByRole('button', { name: 'Urungkan', exact: true })
		.click();
	await expect(field).toHaveValue(originalSummary);
});

test('AI skills deduplicate current and repeated suggestions and add each chip to its matching group', async ({
	page
}) => {
	await mockApi(page);
	await reachSkills(page);
	const technical = page.getByRole('combobox', { name: 'Keahlian teknis', exact: true });
	await technical.fill('TypeScript');
	await technical.press('Enter');
	await runButton(page, 'skills').click();
	await agree(page);
	const panel = panels(page, 'skills');
	await expect(
		panel.locator('[data-ai-group="hard"]').getByRole('button', { name: 'SQL', exact: true })
	).toHaveCount(1);
	await expect(panel.getByRole('button', { name: 'TypeScript', exact: true })).toHaveCount(0);
	for (const [group, skill, label] of [
		['hard', 'SQL', 'Keahlian teknis'],
		['tools', 'Git', 'Tools & software'],
		['soft', 'Komunikasi', 'Soft skill']
	] as const) {
		await panel
			.locator(`[data-ai-group="${group}"]`)
			.getByRole('button', { name: skill, exact: true })
			.click();
		await expect(
			page
				.locator('.skill-group')
				.filter({ has: page.getByRole('combobox', { name: label, exact: true }) })
				.locator('li > span')
				.filter({ hasText: new RegExp(`^${skill}$`) })
		).toHaveCount(1);
	}
	await runButton(page, 'skills').click();
	await expect(consent(page)).not.toBeVisible();
	await expect(runButton(page, 'skills')).toBeEnabled();
	await expect(
		panel.getByRole('button', { name: /^(?:SQL|Git|Komunikasi|TypeScript)$/ })
	).toHaveCount(0);
});

test('quota error is inline and disables further AI calls with the reset time', async ({
	page
}) => {
	const api = await mockApi(page);
	api.mode = 'quota';
	await reachHeadline(page);
	await runButton(page, 'headline').click();
	await agree(page);
	await expect(panels(page, 'headline')).toContainText(
		'Jatah bantuan AI hari ini sudah habis. Coba lagi besok setelah pukul 00.00 WIB.'
	);
	await expect(runButton(page, 'headline')).toBeDisabled();
	await expect(panels(page, 'headline')).toContainText('Sisa 0 dari 3');
	expect(api.runs).toHaveLength(1);
});

test('HTML 502 becomes an inline unavailable message; failed quota lookup stays unobtrusive', async ({
	page
}) => {
	const api = await mockApi(page);
	api.mode = 'unavailable';
	api.quotaUnavailable = true;
	await reachHeadline(page);
	const button = runButton(page, 'headline');
	await expect(button).toBeEnabled();
	await expect(panels(page, 'headline').getByText(/^Sisa \d+ dari \d+/)).toHaveCount(0);
	await button.click();
	await agree(page);
	await expect(panels(page, 'headline')).toContainText(
		'Bantuan AI sedang tidak tersedia. Coba lagi nanti.'
	);
	await expect(button).toBeEnabled();
	await expect(button).toBeFocused();
	await expect(page.getByLabel(/^Nama lengkap\b/)).toHaveValue(fullName);
});

test('reward opens an isolated dummy ad tab and visible CV refreshes quota without loading an ad frame', async ({
	page,
	context
}) => {
	const api = await mockApi(page, { ...freshQuota(0), rewards: { limit: 10, remaining: 3 } });
	await context.route('https://iklan.codiosity.com/**', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><title>Dummy rewarded ad</title><h1>Dummy ad only</h1>'
		})
	);
	await reachHeadline(page);
	const reward = panels(page, 'headline').getByRole('button', {
		name: 'Tonton iklan untuk +1 bantuan AI (sisa 3 iklan hari ini)',
		exact: true
	});
	await expect(runButton(page, 'headline')).toBeDisabled();
	await expect(reward).toBeVisible();
	const opened = context.waitForEvent('page');
	await reward.click();
	const popup = await opened;
	try {
		await expect(popup).toHaveURL('https://iklan.codiosity.com/?lang=id#e2e-reward-ticket');
		await expect(popup.getByRole('heading', { name: 'Dummy ad only', exact: true })).toBeVisible();
		expect(await popup.evaluate(() => window.opener)).toBeNull();
		expect(api.rewardCalls).toBe(1);
		const before = api.quotaCalls;
		api.quota = { ...freshQuota(1), limit: 4, rewards: { limit: 10, remaining: 2 } };
		await page.bringToFront();
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await expect.poll(() => api.quotaCalls).toBeGreaterThan(before);
		await expect(panels(page, 'headline')).toContainText('Sisa 1 dari 4');
		await expect(runButton(page, 'headline')).toBeEnabled();
		await expect(page.locator('iframe')).toHaveCount(0);
		await expect(page.getByText('Dummy ad only', { exact: true })).toHaveCount(0);
		expect(api.runs).toHaveLength(0);
	} finally {
		await popup.close();
	}
});

test('quota without rewards never advertises an ad action or ad explanation', async ({ page }) => {
	await mockApi(page, freshQuota(0));
	await reachHeadline(page);
	await expect(panels(page, 'headline')).toContainText('Sisa 0 dari 3');
	await expect(runButton(page, 'headline')).toBeDisabled();
	await expect(panels(page, 'headline').getByText(/iklan/i)).toHaveCount(0);
});

test('incognito consent and token stay in memory and ending the session ignores a pending result', async ({
	page
}) => {
	const api = await mockApi(page);
	await reachHeadline(page, true);
	const before = await browserStorage(page);
	await runButton(page, 'headline').click();
	await agree(page);
	await expect(
		panels(page, 'headline').getByRole('button', { name: headlines[0], exact: true })
	).toBeVisible();
	expect(await browserStorage(page)).toEqual(before);
	expect((await browserStorage(page)).local['cvmaker.aiDevice']).toBeUndefined();
	let release = () => {};
	api.waitForRun = new Promise<void>((done) => {
		release = done;
	});
	try {
		await runButton(page, 'headline').click();
		await expect.poll(() => api.runs.length).toBe(2);
		await expect(panels(page, 'headline').locator('button[aria-busy="true"]')).toContainText(
			'Sedang menyusun'
		);
		await endIncognito(page);
		await settleResponse(page, release);
		await expect(page.getByRole('button', { name: headlines[0], exact: true })).toHaveCount(0);
		await expect(page.getByText(fullName)).toHaveCount(0);
		await expect(page.getByTestId('ai-assist')).toHaveCount(0);
	} finally {
		release();
	}
});

test('deleting a CV in another tab removes a busy AI panel and ignores its late response', async ({
	page,
	context
}) => {
	const api = await mockApi(page);
	await reachHeadline(page);
	let release = () => {};
	api.waitForRun = new Promise<void>((done) => {
		release = done;
	});
	const other = await context.newPage();
	try {
		await runButton(page, 'headline').click();
		await agree(page);
		await expect.poll(() => api.runs.length).toBe(1);
		await expect(panels(page, 'headline').locator('button[aria-busy="true"]')).toContainText(
			'Sedang menyusun'
		);
		await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
		await other.goto('/cv');
		const card = other.getByTestId('cv-card').first();
		await expect(card).toBeVisible();
		const direct = card.getByRole('button', { name: 'Hapus', exact: true });
		if (await direct.isVisible()) await direct.click();
		else {
			await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
			await other.getByRole('dialog').getByRole('button', { name: 'Hapus', exact: true }).click();
		}
		await other
			.getByRole('dialog', { name: 'Hapus CV ini?', exact: true })
			.getByRole('button', { name: 'Hapus', exact: true })
			.click();
		await expect(page.getByTestId('removed-cv')).toBeVisible();
		await settleResponse(page, release);
		await expect(page.getByTestId('ai-assist')).toHaveCount(0);
		await expect(page.getByRole('button', { name: headlines[0], exact: true })).toHaveCount(0);
		await expect(page.getByText(fullName)).toHaveCount(0);
		expect(
			await page
				.locator('input, textarea')
				.evaluateAll((fields) =>
					fields.some((field) => (field as HTMLInputElement).value.includes('Rahasia'))
				)
		).toBe(false);
	} finally {
		release();
		await other.close();
	}
});

test('English UI translates consent and summary actions while placeholders stay marked plain text', async ({
	page
}) => {
	await mockApi(page);
	await reachSummary(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const panel = panels(page, 'summary');
	await panel.getByRole('button', { name: 'Write with AI', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'AI assistance', exact: true });
	await expect(dialog).toContainText('email');
	await dialog.getByRole('button', { name: 'Agree & continue', exact: true }).click();
	await expect(page.getByTestId('ai-summary-preview').locator('mark')).toHaveText([
		'[isi angka]',
		'[add number]'
	]);
	await expect(panel.getByRole('button', { name: 'Use this text', exact: true })).toBeVisible();
	await panel.getByRole('button', { name: 'Dismiss', exact: true }).click();
	await expect(page.getByLabel('Profile summary', { exact: true })).toHaveValue('');
});

test('a mode cycle with no AI panel mounted resets consent before resuming the normal CV', async ({
	page
}) => {
	const api = await mockApi(page);
	const id = await reachHeadline(page);
	await runButton(page, 'headline').click();
	await agree(page);
	await expect(
		panels(page, 'headline').getByRole('button', { name: headlines[0], exact: true })
	).toBeVisible();
	await advance(page, 'Pendidikan');
	await expect(page.getByTestId('ai-assist')).toHaveCount(0);
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Nyalakan', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(page.getByTestId('ai-assist')).toHaveCount(0);
	await endIncognito(page);
	// Follow an application link: a document reload would reset module state and mask this gap.
	const resume = page.locator(`.resume-card[href="/buat/${id}"]`);
	await expect(resume).toBeVisible();
	await resume.click();
	await expect(page.locator('.step-heading h1')).toHaveText('Pendidikan');
	await page.getByRole('button', { name: 'Kembali', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	await runButton(page, 'headline').click();
	await expect(consent(page)).toBeVisible();
	expect(api.runs).toHaveLength(1);
});

test('first pass: the headline suggestion works on Data diri with only the target role', async ({
	page
}) => {
	await mockApi(page);
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Web Developer');
	await target.press('Escape');
	await advance(page, 'Data diri');
	await expect(panels(page, 'headline')).toBeVisible();
	await expect(runButton(page, 'headline')).toBeEnabled();
	await expect(panels(page, 'headline')).not.toContainText('Isi posisi tujuan');
});
