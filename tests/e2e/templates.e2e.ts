import { expect, test, type Locator, type Page } from '@playwright/test';

const atsTemplates = [
	{ id: 'ats-klasik', name: 'ATS Klasik' },
	{ id: 'ats-modern', name: 'ATS Modern' },
	{ id: 'ats-ringkas', name: 'ATS Ringkas' }
];
const creativeTemplates = [
	{ id: 'creative-sidebar', name: 'Creative Sidebar' },
	{ id: 'creative-header', name: 'Creative Header' },
	{ id: 'creative-timeline', name: 'Creative Timeline' }
];
const heading = (page: Page) => page.locator('.step-heading h1');
const picker = (page: Page) => page.getByTestId('template-picker');
const preview = (page: Page) => page.getByTestId('cv-preview');
const renderedTemplate = (page: Page) => preview(page).locator('.paper > [data-template]');

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText(title);
}

async function dates(scope: Locator, startYear: string, endYear: string) {
	const start = scope.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('07');
	await start.getByLabel('Tahun', { exact: true }).selectOption(startYear);
	const end = scope.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('12');
	await end.getByLabel('Tahun', { exact: true }).selectOption(endYear);
}

// Create and persist a real CV through the same wizard controls applicants use.
async function reachReview(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Junior Web Developer');
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Alya - Pilihan template');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('alya.putri@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const education = page.locator('.collection-steps .item-card').last();
	await education
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await education.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await education
		.getByRole('combobox', { name: 'Jurusan', exact: true })
		.fill('Teknik Informatika');
	await dates(education, '2020', '2024');
	await advance(page, 'Pengalaman kerja / magang');
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	const experience = page.locator('.collection-steps .item-card').last();
	await experience
		.getByRole('combobox', { name: 'Posisi / peran', exact: true })
		.fill('Web Developer Intern');
	await experience.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
	await dates(experience, '2023', '2023');
	await experience.getByRole('button', { name: 'Tambah poin', exact: true }).click();
	await experience
		.getByRole('textbox', { name: 'Poin 1', exact: true })
		.fill('Membangun tiga halaman web responsif menggunakan TypeScript.');
	await advance(page, 'Organisasi & kepanitiaan');
	for (const title of ['Proyek', 'Keahlian & pencapaian', 'Ringkasan profil']) {
		await advance(page, title, true);
	}
	await page
		.getByLabel('Ringkasan profil', { exact: true })
		.fill('Lulusan Teknik Informatika dengan pengalaman magang pengembangan web dan TypeScript.');
	await advance(page, 'Tinjau CV-mu');
	await expect(picker(page)).toBeVisible();
	await expect(preview(page)).toBeVisible();
}

async function contentIsRetained(page: Page) {
	const paper = renderedTemplate(page);
	await expect(
		paper.getByRole('heading', { level: 1, name: 'Alya Putri', exact: true })
	).toBeVisible();
	for (const text of ['Universitas Contoh', 'Web Developer Intern', 'Studio Contoh']) {
		await expect(paper).toContainText(text);
	}
}

async function chooseTemplate(page: Page, template: { id: string; name: string }) {
	const card = picker(page).locator(`[data-template-id="${template.id}"]`);
	await expect(card).toHaveRole('button');
	await expect(card).toHaveAccessibleName(new RegExp(template.name));
	await card.focus();
	await expect(card).toBeFocused();
	await card.press('Enter');
	await expect(card).toHaveAttribute('aria-pressed', 'true');
	await expect(picker(page).locator('[data-template-id][aria-pressed="true"]')).toHaveCount(1);
	await expect(card).toBeFocused();
	await expect(renderedTemplate(page)).toHaveAttribute('data-template', template.id);
	await contentIsRetained(page);
}

async function reloadSavedReview(page: Page) {
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	await page.reload();
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	await expect(picker(page)).toBeVisible();
}

async function fitsReferenceWidths(page: Page) {
	const initialViewport = page.viewportSize();
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(picker(page)).toBeVisible();
		await expect(preview(page)).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `Template picker and preview fit ${width}px`).toBeLessThanOrEqual(0);
	}
	if (initialViewport) await page.setViewportSize(initialViewport);
}

test('each ATS template has a named keyboard choice, updates preview, and survives reload', async ({
	page
}) => {
	await reachReview(page);
	await expect(picker(page).locator('[data-template-id]')).toHaveCount(3);
	await expect(picker(page).getByRole('radio')).toHaveCount(0);
	for (const template of atsTemplates) {
		await chooseTemplate(page, template);
		await reloadSavedReview(page);
		await expect(picker(page).locator(`[data-template-id="${template.id}"]`)).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(renderedTemplate(page)).toHaveAttribute('data-template', template.id);
		await contentIsRetained(page);
	}
	await fitsReferenceWidths(page);
});

test('Creative designs and a named accent persist without losing CV content', async ({ page }) => {
	await reachReview(page);
	const creative = picker(page).getByRole('button', { name: 'CV Creative', exact: true });
	await creative.focus();
	await creative.press('Enter');
	await expect(creative).toHaveAttribute('aria-pressed', 'true');
	await expect(picker(page).locator('[data-template-id]')).toHaveCount(3);
	await expect(
		picker(page).getByText('Kurang cocok untuk portal ATS', { exact: true })
	).toBeVisible();
	for (const template of creativeTemplates) await chooseTemplate(page, template);
	await expect(picker(page).getByRole('radio')).toHaveCount(6);
	const peach = picker(page).getByRole('radio', { name: 'Peach', exact: true });
	await peach.check();
	await expect(peach).toBeChecked();
	await expect
		.poll(async () =>
			renderedTemplate(page).evaluate((element) =>
				getComputedStyle(element).getPropertyValue('--accent').trim().toLowerCase()
			)
		)
		.toBe('#f2a97e');
	await reloadSavedReview(page);
	await expect(
		picker(page).getByRole('button', { name: 'CV Creative', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(picker(page).getByRole('radio', { name: 'Peach', exact: true })).toBeChecked();
	await expect(renderedTemplate(page)).toHaveAttribute('data-template', 'creative-timeline');
	await expect
		.poll(async () =>
			renderedTemplate(page).evaluate((element) =>
				getComputedStyle(element).getPropertyValue('--accent').trim().toLowerCase()
			)
		)
		.toBe('#f2a97e');
	await contentIsRetained(page);
	await fitsReferenceWidths(page);
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await page.getByRole('link', { name: 'Ke CV Saya', exact: true }).click();
	const card = page.getByTestId('cv-card').filter({ hasText: 'CV Alya - Pilihan template' });
	await expect(card).toContainText('CV Creative');
	await expect(card).toContainText('Creative Timeline');
});

for (const template of [atsTemplates[1]!, creativeTemplates[0]!]) {
	test(`${template.name} prints the chosen design and hides application controls`, async ({
		page
	}) => {
		await reachReview(page);
		if (template.id.startsWith('creative-')) {
			await picker(page).getByRole('button', { name: 'CV Creative', exact: true }).click();
			await picker(page).getByRole('radio', { name: 'Peach', exact: true }).check();
		}
		await chooseTemplate(page, template);
		await page.getByRole('button', { name: 'Selesai', exact: true }).click();
		await expect(heading(page)).toHaveText('CV-mu tersimpan');
		await page
			.getByTestId('export-panel')
			.getByRole('link', { name: 'PDF untuk melamar', exact: true })
			.click();
		await expect(page).toHaveURL(/\/cv\/[a-f\d-]+\/print$/);
		const paper = page.getByTestId('print-paper');
		const design = paper.locator(`[data-template="${template.id}"]`);
		await expect(design).toBeVisible();
		await expect(design.getByRole('heading', { level: 1 })).toHaveText('Alya Putri');
		await expect(design).toContainText('Web Developer Intern');
		await expect(design).toContainText('Studio Contoh');
		const toolbar = page.getByTestId('print-toolbar');
		await expect(toolbar).toBeVisible();
		await expect(page.locator('.app-header')).toBeVisible();
		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.app-header')).not.toBeVisible();
		await expect(toolbar).not.toBeVisible();
		await expect(page.locator('.print-guide')).not.toBeVisible();
		await expect(page.getByRole('button')).toHaveCount(0);
		await expect(design).toBeVisible();
		expect(await paper.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
		expect(await design.evaluate((element) => getComputedStyle(element).printColorAdjust)).toBe(
			'exact'
		);
		if (template.id.startsWith('creative-')) {
			expect(
				await design.evaluate((element) =>
					getComputedStyle(element).getPropertyValue('--accent').trim().toLowerCase()
				)
			).toBe('#f2a97e');
		}
	});
}
