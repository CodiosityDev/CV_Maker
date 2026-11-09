import { expect, test, type Locator, type Page } from '@playwright/test';

const heading = (page: Page) => page.locator('.step-heading h1');
const panel = (page: Page) => page.getByTestId('ats-panel');
const score = (page: Page) => page.getByTestId('ats-score');
const cards = (page: Page) => page.getByTestId('cv-card');
const title = 'CV Nadia — Pemeriksaan ATS';
const jobPost =
	'Dicari staf dengan SQL dan Microsoft Excel. SQL digunakan untuk pelaporan rinci. Pelaporan rinci disusun tiap pekan.';

async function advance(page: Page, nextHeading: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText(nextHeading);
}

async function dates(scope: Locator, startYear: string, endYear: string) {
	const start = scope.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('07');
	await start.getByLabel('Tahun', { exact: true }).selectOption(startYear);
	const end = scope.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('12');
	await end.getByLabel('Tahun', { exact: true }).selectOption(endYear);
}

async function addExperience(page: Page, complete: boolean) {
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	const item = page.locator('.collection-steps .item-card').last();
	await item
		.getByRole('combobox', { name: 'Posisi / peran', exact: true })
		.fill(complete ? 'Administrasi Intern' : 'Staf Administrasi');
	await item
		.getByLabel('Perusahaan / tempat kerja', { exact: true })
		.fill(complete ? 'Studio Pertama' : 'PT Contoh Kedua');
	if (complete) await dates(item, '2023', '2023');
	await item.getByRole('button', { name: 'Tambah poin', exact: true }).click();
	const bullet = item.getByRole('textbox', { name: 'Poin 1', exact: true });
	await bullet.fill(
		complete
			? 'Mengelola 12 laporan administrasi bulanan untuk tim operasional.'
			: 'Penyusunan laporan administrasi bulanan menggunakan Microsoft Excel untuk tim keuangan.'
	);
	const id = await bullet.getAttribute('id');
	if (!id) throw new Error('The visible experience bullet must have a field id.');
	return id;
}

// Applicants create this fixture using the real wizard; tests never seed repositories or /dev.
async function reachReview(page: Page, twoExperiences = false) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Staf Administrasi');
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Putri');
	await page.getByLabel(/^Email\b/).fill('nadia.putri@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const education = page.locator('.collection-steps .item-card').last();
	await education
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await education.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await education.getByRole('combobox', { name: 'Jurusan', exact: true }).fill('Sistem Informasi');
	await dates(education, '2020', '2024');
	await advance(page, 'Pengalaman kerja / magang');
	if (twoExperiences) await addExperience(page, true);
	const bulletId = await addExperience(page, false);
	await advance(page, 'Organisasi & kepanitiaan');
	await advance(page, 'Proyek', true);
	await advance(page, 'Keahlian & pencapaian', true);
	const tools = page.getByRole('region', { name: 'Tools & software', exact: true });
	await tools
		.getByRole('combobox', { name: 'Tools & software', exact: true })
		.fill('Microsoft Excel');
	await tools.getByRole('combobox', { name: 'Tools & software', exact: true }).press('Enter');
	await expect(
		tools.getByRole('button', { name: 'Hapus Microsoft Excel', exact: true })
	).toBeVisible();
	await advance(page, 'Ringkasan profil');
	await advance(page, 'Tinjau CV-mu', true);
	await expect(panel(page)).toBeVisible();
	await expect(score(page)).toHaveText(/^(?:100|[1-9]?\d)\/100$/);
	await expect(panel(page)).not.toHaveAttribute('aria-busy', 'true');
	return { bulletId };
}

async function showTips(page: Page) {
	const tips = panel(page).locator('[data-level="tip"]');
	if (!(await tips.evaluate((element) => (element as HTMLDetailsElement).open))) {
		await tips.locator('summary').click();
	}
	await expect(tips).toHaveJSProperty('open', true);
	return tips;
}

async function openDashboard(page: Page) {
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(1);
}

async function checkFromDashboard(page: Page) {
	const card = cards(page).filter({ has: page.getByRole('heading', { name: title, exact: true }) });
	const direct = card
		.getByRole('link', { name: 'Cek ATS', exact: true })
		.or(card.getByRole('button', { name: 'Cek ATS', exact: true }));
	if (await direct.isVisible()) {
		await direct.click();
	} else {
		await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
		const menu = page.getByRole('dialog');
		await menu
			.getByRole('link', { name: 'Cek ATS', exact: true })
			.or(menu.getByRole('button', { name: 'Cek ATS', exact: true }))
			.click();
	}
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	await expect(panel(page)).toBeVisible();
	await expect(score(page)).toHaveText(/^(?:100|[1-9]?\d)\/100$/);
}

async function openKeywords(page: Page) {
	const details = panel(page)
		.locator('details')
		.filter({
			has: page.locator('summary').filter({ hasText: 'Cocokkan dengan lowongan' })
		});
	if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
		await details.locator('summary').click();
	}
	return panel(page).getByLabel('Tempel teks lowongan di sini', { exact: true });
}

async function fitsReferenceWidths(page: Page) {
	const initial = page.viewportSize();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(panel(page)).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `ATS panel and keyword chips fit ${width}px`).toBeLessThanOrEqual(0);
	}
	if (initial) await page.setViewportSize(initial);
}

test('ATS counts match the grouped checks and a tip opens the targeted experience bullet', async ({
	page
}) => {
	const { bulletId } = await reachReview(page, true);
	await expect(panel(page)).toContainText(
		'Skor ini perkiraan berdasarkan aturan umum ATS, bukan jaminan lolos.'
	);
	const levels = ['error', 'warn', 'tip'] as const;
	const counts: Record<(typeof levels)[number], number> = { error: 0, warn: 0, tip: 0 };
	for (const level of levels) {
		const group = panel(page).locator(`[data-level="${level}"]`);
		if (!(await group.count())) continue;
		counts[level] = await group.locator('button[data-check-id]').count();
		await expect(group).toHaveAttribute('data-count', String(counts[level]));
	}
	const displayedCounts = (await panel(page).getByTestId('ats-summary').innerText()).match(/\d+/g);
	expect(displayedCounts?.map(Number)).toEqual(levels.map((level) => counts[level]));
	expect(counts.warn).toBeGreaterThan(0);
	expect(counts.tip).toBeGreaterThan(0);
	const tips = panel(page).locator('[data-level="tip"]');
	await expect(tips).toHaveJSProperty('open', false);
	await showTips(page);
	const targets = await panel(page)
		.locator('button[data-check-id]')
		.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
	for (const height of targets) expect(height).toBeGreaterThanOrEqual(44);
	await tips.locator('[data-check-id="bulletNoVerb"]').click();
	await expect(heading(page)).toHaveText('Pengalaman kerja / magang');
	const bullet = page.locator(`[id="${bulletId}"]`);
	await expect(bullet).toBeFocused();
	await expect(bullet.locator('xpath=ancestor::details[1]')).toHaveJSProperty('open', true);
	await expect(bullet).toHaveValue(/Penyusunan laporan administrasi/);
	await openDashboard(page);
	await checkFromDashboard(page);
	await panel(page).locator('[data-check-id="missingDates"]').click();
	await expect(heading(page)).toHaveText('Pengalaman kerja / magang');
	const dateId = bulletId.replace(/\.bullets\.\d+$/, '.dates-month');
	await expect(page.locator(`[id="${dateId}"]`)).toBeFocused();
});

test('a missing email is a mandatory check that returns focus to the personal email field', async ({
	page
}) => {
	await reachReview(page);
	const originalScore = Number((await score(page).innerText()).split('/')[0]);
	await showTips(page);
	await panel(page).locator('[data-check-id="missingHeadline"]').click();
	await expect(heading(page)).toHaveText('Data diri');
	await page.getByLabel(/^Email\b/).fill('');
	await openDashboard(page);
	await checkFromDashboard(page);
	const errorGroup = panel(page).locator('[data-level="error"]');
	await expect(errorGroup).toBeVisible();
	const missingEmail = errorGroup.locator('[data-check-id="missingEmail"]');
	await expect(missingEmail).toContainText('Email belum diisi.');
	await expect
		.poll(async () => Number((await score(page).innerText()).split('/')[0]))
		.toBeLessThan(originalScore);
	await missingEmail.click();
	await expect(heading(page)).toHaveText('Data diri');
	await expect(page.locator('[id="personal.email"]')).toBeFocused();
	await expect(page.locator('[id="personal.email"]')).toHaveValue('');
});

test('known job keywords can be added to hard skills and undone while pasted text stays temporary', async ({
	page
}) => {
	await reachReview(page);
	let job = await openKeywords(page);
	await expect(job).toHaveAttribute('maxlength', '20000');
	await job.fill(jobPost);
	const missing = panel(page).getByTestId('ats-keywords-missing');
	const present = panel(page).getByTestId('ats-keywords-present');
	const sql = missing.getByRole('button', { name: /^Tambahkan SQL ke keahlian teknis$/i });
	await expect(sql).toBeVisible();
	await expect(present).toContainText('Microsoft Excel');
	await expect(missing.getByText('pelaporan rinci', { exact: true })).toBeVisible();
	await expect(missing.getByRole('button', { name: /pelaporan rinci/i })).toHaveCount(0);
	await fitsReferenceWidths(page);
	await sql.click();
	await expect(present.getByText('SQL', { exact: true })).toBeVisible();
	await expect(job).toBeFocused();
	const undo = page.locator('.notification').getByRole('button', { name: 'Urungkan', exact: true });
	await expect(undo).toBeVisible();
	await undo.click();
	await expect(sql).toBeVisible();
	await expect(present.getByText('SQL', { exact: true })).toHaveCount(0);
	await expect(job).toBeFocused();
	await sql.click();
	await expect(present.getByText('SQL', { exact: true })).toBeVisible();
	await expect(job).toBeFocused();
	await page.getByRole('button', { name: 'Kembali', exact: true }).click();
	await expect(heading(page)).toHaveText('Ringkasan profil');
	await page.getByRole('button', { name: 'Kembali', exact: true }).click();
	await expect(heading(page)).toHaveText('Keahlian & pencapaian');
	const hard = page.getByRole('region', { name: 'Keahlian teknis', exact: true });
	await expect(hard.getByText('SQL', { exact: true })).toHaveCount(1);
	await expect(
		page
			.getByRole('region', { name: 'Tools & software', exact: true })
			.getByText('SQL', { exact: true })
	).toHaveCount(0);
	await page.locator('.toolbar').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(hard.getByText('SQL', { exact: true })).toHaveCount(0);
	await advance(page, 'Ringkasan profil');
	await advance(page, 'Tinjau CV-mu', true);
	job = await openKeywords(page);
	await job.fill(jobPost);
	await expect(sql).toBeVisible();
	const beforeClear = await score(page).innerText();
	await job.fill('');
	await expect(missing).not.toBeVisible();
	await expect(present).not.toBeVisible();
	await expect(score(page)).toHaveText(beforeClear);
	await job.fill(jobPost);
	await expect(sql).toBeVisible();
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	await page.reload();
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	job = await openKeywords(page);
	await expect(job).toHaveValue('');
	await expect(missing).not.toBeVisible();
	await expect(score(page)).toHaveText(/^(?:100|[1-9]?\d)\/100$/);
});

test('done links back to the ATS panel and the dashboard opens a completed CV at review', async ({
	page
}) => {
	await reachReview(page);
	const reportScore = await score(page).innerText();
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	const done = page.getByTestId('ats-done-summary');
	await expect(done).toContainText(`Skor ATS: ${reportScore}`);
	await done
		.getByRole('link', { name: 'Cek lagi', exact: true })
		.or(done.getByRole('button', { name: 'Cek lagi', exact: true }))
		.click();
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	await expect(panel(page)).toBeVisible();
	await expect(panel(page)).toBeFocused();
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await page.getByRole('link', { name: 'Ke CV Saya', exact: true }).click();
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).not.toContainText('Belum selesai');
	await expect(cards(page)).not.toContainText(/Skor ATS:/);
	await checkFromDashboard(page);
	await expect(panel(page)).toBeFocused();
	await expect(page).toHaveURL(/[?&]step=review(?:&|#|$)/);
	await page.reload();
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	await expect(panel(page)).toBeVisible();
	await expect(score(page)).toHaveText(/^(?:100|[1-9]?\d)\/100$/);
	await expect(page).toHaveURL(/[?&]step=review(?:&|#|$)/);
	await expect(await openKeywords(page)).toHaveValue('');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(panel(page).getByRole('heading', { name: 'Check ATS', exact: true })).toBeVisible();
	await expect(panel(page).locator('[data-check-id="missingSummary"]')).toContainText(
		'Profile summary is missing.'
	);
	await expect(score(page)).toHaveText(/^(?:100|[1-9]?\d)\/100$/);
});
