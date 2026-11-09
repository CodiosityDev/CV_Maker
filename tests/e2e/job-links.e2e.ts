import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

const cvTitle = 'CV Raka — Lowongan';
const name = 'Raka Pratama';
const keyword = 'Web Developer';
const city = 'Bandung';
const sites = ['linkedin', 'jobstreet', 'glints', 'kalibrr', 'indeed'] as const;
const heading = (page: Page) => page.locator('.step-heading h1');
const panel = (page: Page) => page.getByTestId('job-links');
const cards = (page: Page) => page.getByTestId('cv-card');
const externalRequests = new WeakMap<BrowserContext, string[]>();

interface CvOptions {
	keyword?: string;
	city?: string;
	incognito?: boolean;
	experienceRole?: string;
}

async function advance(page: Page, nextHeading: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText(nextHeading);
}

async function createPersonal(page: Page, options: CvOptions = {}) {
	await page.goto('/buat');
	if (options.incognito) {
		await page
			.locator('.app-header')
			.getByRole('button', { name: 'Mode Incognito', exact: true })
			.click();
		await page
			.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
			.getByRole('button', { name: 'Nyalakan', exact: true })
			.click();
		await expect(page.locator('.app-header button[aria-label="Mode Incognito"]')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	}
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill(options.keyword ?? keyword);
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(name);
	await page.getByLabel(/^Email\b/).fill('raka.pratama@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	const location = page.getByRole('combobox', { name: 'Kota / kabupaten', exact: true });
	await location.fill(options.city ?? city);
	await location.press('Escape');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
}

// All CV content comes through the real wizard; no repository seed or development route is used.
async function reachDone(page: Page, options: CvOptions = {}) {
	await createPersonal(page, options);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const education = page.locator('.collection-steps .item-card').last();
	await education
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await education.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await education.getByRole('combobox', { name: 'Jurusan', exact: true }).fill('Sistem Informasi');
	const start = education.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('07');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2020');
	const end = education.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('12');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2024');
	await advance(page, 'Pengalaman kerja / magang');
	if (options.experienceRole) {
		await page
			.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true })
			.click();
		const experience = page.locator('.collection-steps .item-card').last();
		const role = experience.getByRole('combobox', { name: 'Posisi / peran', exact: true });
		await role.fill(options.experienceRole);
		await role.press('Escape');
		await experience.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
	}
	await advance(page, 'Organisasi & kepanitiaan', !options.experienceRole);
	for (const next of ['Proyek', 'Keahlian & pencapaian', 'Ringkasan profil', 'Tinjau CV-mu']) {
		await advance(page, next, true);
	}
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await expect(panel(page)).toBeVisible();
}

async function dashboard(page: Page) {
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(1);
}

async function cardAction(page: Page, action: string) {
	const card = cards(page).first();
	const direct = card.getByRole('button', { name: action, exact: true });
	if (await direct.isVisible()) await direct.click();
	else {
		await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
		await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click();
	}
}

async function showJobs(page: Page) {
	await cardAction(page, 'Cari lowongan');
	const dialog = page.getByRole('dialog', { name: 'Cari lowongan', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByTestId('job-links')).toBeVisible();
	return dialog;
}

async function assertLinks(scope: Locator, expectedKeyword = keyword, expectedCity = city) {
	const links = scope.locator('a[data-job-site]');
	await expect(links).toHaveCount(5);
	const hrefs: string[] = [];
	for (const site of sites) {
		const link = scope.locator(`a[data-job-site="${site}"]`);
		await expect(link).toHaveAttribute('target', '_blank');
		const rel = (await link.getAttribute('rel'))?.split(/\s+/) ?? [];
		expect(rel).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
		await expect(link).toHaveAccessibleName(/membuka tab baru/);
		const href = await link.getAttribute('href');
		if (!href) throw new Error(`The ${site} link must have a destination.`);
		hrefs.push(href);
		expect(new URL(href).protocol).toBe('https:');
		expect(
			await link.evaluate((element) => element.getBoundingClientRect().height)
		).toBeGreaterThanOrEqual(44);
		await expect(link).toContainText(
			site === 'glints' || site === 'kalibrr' || !expectedCity
				? 'seluruh Indonesia'
				: `di ${expectedCity}`
		);
	}
	const linkedinHref = await scope.locator('a[data-job-site="linkedin"]').getAttribute('href');
	if (!linkedinHref) throw new Error('LinkedIn destination is missing.');
	const linkedin = new URL(linkedinHref);
	expect(linkedin.searchParams.get('keywords')).toBe(expectedKeyword);
	expect(linkedin.searchParams.get('location')).toContain(expectedCity || 'Indonesia');
	if (expectedKeyword === keyword) expect(linkedinHref).toContain('keywords=Web+Developer');
	if (expectedCity) expect(linkedinHref).toContain(`location=${expectedCity}`);
	return hrefs;
}

async function fitsReferenceWidths(page: Page, scope: Locator) {
	const initial = page.viewportSize();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(scope).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			),
			`job links fit ${width}px`
		).toBeLessThanOrEqual(0);
	}
	if (initial) await page.setViewportSize(initial);
}

test.beforeEach(async ({ context, baseURL }) => {
	const requests: string[] = [];
	externalRequests.set(context, requests);
	const localOrigin = new URL(baseURL ?? 'http://localhost:4173').origin;
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin === localOrigin || !['http:', 'https:'].includes(url.protocol))
			return route.continue();
		requests.push(url.href);
		return route.abort('blockedbyclient');
	});
});

test.afterEach(async ({ context }) => {
	expect(externalRequests.get(context), 'job links make no third-party requests').toEqual([]);
});

test('done offers five accessible local-query job links and related titles never change the CV', async ({
	page,
	context
}) => {
	await reachDone(page);
	await expect(
		panel(page).getByRole('heading', { name: 'Cari lowongan Web Developer', exact: true })
	).toBeVisible();
	await expect(panel(page)).toContainText('Hanya posisi dan kota yang dikirim');
	await assertLinks(panel(page));
	await fitsReferenceWidths(page, panel(page));
	const choice = panel(page).getByRole('button').first();
	await expect(choice).toBeVisible();
	const related = (await choice.innerText()).trim();
	expect(related).not.toBe(keyword);
	await choice.click();
	await expect(choice).toHaveAttribute('aria-pressed', 'true');
	await assertLinks(panel(page), related);
	await panel(page)
		.getByRole('button', { name: `Kembali ke ${keyword}`, exact: true })
		.click();
	await assertLinks(panel(page));
	await expect(panel(page).locator('a[data-job-site="linkedin"]')).toBeFocused();
	await choice.click();
	await page.reload();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await assertLinks(panel(page));
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(
		panel(page).getByRole('heading', { name: 'Find jobs for Web Developer', exact: true })
	).toBeVisible();
	await expect(panel(page).locator('a[data-job-site="glints"]')).toContainText('across Indonesia');
	await expect(panel(page).locator('a[data-job-site="linkedin"]')).toHaveAccessibleName(/new tab/i);
	expect(context.pages()).toHaveLength(1);
	await page.getByRole('button', { name: 'Bahasa Indonesia', exact: true }).click();
	const route = new URL(page.url()).pathname;
	await page.goto(`${route}?step=target#targetRole`);
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await expect(page.locator('[id="targetRole"]')).toHaveValue(keyword);
});

test('dashboard opens the same links and clears the job dialog when another tab deletes its CV', async ({
	page,
	context
}) => {
	await createPersonal(page);
	await dashboard(page);
	const dialog = await showJobs(page);
	const original = await assertLinks(dialog);
	await fitsReferenceWidths(page, dialog);
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await showJobs(page);
	expect(await assertLinks(dialog)).toEqual(original);
	const other = await context.newPage();
	try {
		await other.goto('/cv');
		await expect(cards(other)).toHaveCount(1);
		await cardAction(other, 'Hapus');
		await other
			.getByRole('dialog', { name: 'Hapus CV ini?', exact: true })
			.getByRole('button', { name: 'Hapus', exact: true })
			.click();
		await expect(cards(page)).toHaveCount(0);
		await expect(dialog).not.toBeVisible();
		await expect(panel(page)).toHaveCount(0);
		await expect(page.getByText(keyword, { exact: true })).toHaveCount(0);
	} finally {
		await other.close();
	}
});

test('an empty query has no outgoing job links and its target action opens career direction from done and dashboard', async ({
	page
}) => {
	await reachDone(page, { keyword: '' });
	await expect(panel(page).locator('a[data-job-site]')).toHaveCount(0);
	await panel(page).getByRole('link', { name: 'Isi posisi tujuan', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await expect(page.locator('[id="targetRole"]')).toBeFocused();
	await expect(page.locator('[id="targetRole"]')).toHaveValue('');
	await dashboard(page);
	const dialog = await showJobs(page);
	await expect(dialog.locator('a[data-job-site]')).toHaveCount(0);
	await dialog.getByRole('link', { name: 'Isi posisi tujuan', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await expect(page.locator('[id="targetRole"]')).toBeFocused();
	await expect(page.locator('[id="targetRole"]')).toHaveValue('');
	await page.reload();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await expect(page.locator('[id="targetRole"]')).toHaveValue('');
});

test('an experience role is the fallback keyword and no city means every site searches Indonesia', async ({
	page
}) => {
	await reachDone(page, { keyword: '', city: '', experienceRole: 'Penjinak Naga' });
	await expect(
		panel(page).getByRole('heading', { name: 'Cari lowongan Penjinak Naga', exact: true })
	).toBeVisible();
	await assertLinks(panel(page), 'Penjinak Naga', '');
	await expect(panel(page).getByRole('button')).toHaveCount(0);
});

test('incognito warns about browser history and expiry removes an open job dialog', async ({
	page
}) => {
	await page.clock.install();
	await createPersonal(page, { incognito: true });
	await dashboard(page);
	const dialog = await showJobs(page);
	await assertLinks(dialog);
	await expect(dialog).toContainText('Situs kerja yang dibuka tercatat di riwayat browser');
	await page.clock.fastForward('03:02:00');
	await expect(cards(page)).toHaveCount(0);
	await expect(dialog).not.toBeVisible();
	await expect(panel(page)).toHaveCount(0);
	await expect(page.getByText(name, { exact: true })).toHaveCount(0);
	await expect(page.getByText(keyword, { exact: true })).toHaveCount(0);
});
