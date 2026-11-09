import { expect, test, type Locator, type Page } from '@playwright/test';

const heading = (page: Page) => page.locator('.step-heading h1');
const educationCard = (page: Page) => page.locator('.collection-steps .item-card').last();
const degreeField = (page: Page) => educationCard(page).locator('input[id$=".degree"]');
const scoreField = (page: Page) => educationCard(page).locator('input[id$=".gpa"]');
const scaleField = (page: Page) => educationCard(page).locator('input[id$=".gpaScale"]');
const thesisField = (page: Page) => educationCard(page).locator('textarea[id$=".thesisTitle"]');
const thesis = 'Analisis kualitas air sungai';

// Create the fixture through the applicant-facing wizard, without importing or seeding core data.
async function reachEducation(page: Page, cvLocale: 'id' | 'en' = 'id') {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page.locator('#locale').selectOption(cvLocale);
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Dina — Pendidikan');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText('Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Dina Larasati');
	await page.getByLabel(/^Email\b/).fill('dina.larasati@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText('Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = educationCard(page).getByRole('combobox', {
		name: 'Nama sekolah / kampus',
		exact: false
	});
	await school.fill('Sekolah Nusantara');
	await school.press('Escape');
	return educationCard(page);
}

async function setDegree(page: Page, value: string) {
	await degreeField(page).fill(value);
	await degreeField(page).press('Escape');
}

async function openPreview(page: Page) {
	const open = page.getByRole('button', { name: /^(Lihat Preview|View preview)$/, exact: true });
	if (await open.isVisible()) await open.click();
	const preview = page.getByTestId('cv-preview');
	await expect(preview).toBeVisible();
	return preview;
}

async function closePreview(page: Page) {
	const dialog = page.getByRole('dialog', { name: /^(Preview CV|CV preview)$/, exact: true });
	if (await dialog.isVisible()) {
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
	}
}

async function assertPreview(page: Page, texts: string[]) {
	const preview = await openPreview(page);
	for (const text of texts) await expect(preview).toContainText(text);
	await closePreview(page);
}

async function fitsReferenceWidths(page: Page, scope: Locator) {
	const original = page.viewportSize();
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
			`education fields fit ${width}px`
		).toBeLessThanOrEqual(0);
	}
	if (original) await page.setViewportSize(original);
}

test('school grades replace IPK reactively and returning to S1 preserves the hidden thesis', async ({
	page
}) => {
	const card = await reachEducation(page);
	await expect(scaleField(page)).toHaveValue('4.00');
	await setDegree(page, 'S1');
	await thesisField(page).fill(thesis);
	await scoreField(page).fill('85');
	await setDegree(page, 'SMA');
	await expect(card.getByLabel('Nilai rata-rata rapor', { exact: true })).toBeVisible();
	await expect(card.getByLabel('Nilai maksimal', { exact: true })).toHaveValue('100');
	await expect(card).toContainText('Contoh: 85 dari 100.');
	await expect(card.getByLabel('IPK', { exact: true })).toHaveCount(0);
	await expect(thesisField(page)).toHaveCount(0);
	await assertPreview(page, ['Nilai rata-rata 85/100', `Karya tulis: ${thesis}`]);
	await fitsReferenceWidths(page, card);
	await setDegree(page, 'S1');
	await expect(card.getByLabel('IPK', { exact: true })).toBeVisible();
	await expect(card.getByLabel('Skala IPK', { exact: true })).toHaveValue('4.00');
	await expect(thesisField(page)).toBeVisible();
	await expect(thesisField(page)).toHaveValue(thesis);
	await scoreField(page).fill('3.85');
	await assertPreview(page, ['IPK 3.85/4.00', thesis]);
	await fitsReferenceWidths(page, card);
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	await page.reload();
	await expect(thesisField(page)).toHaveValue(thesis);
	await expect(degreeField(page)).toHaveValue('S1');
	await expect(scaleField(page)).toHaveValue('4.00');
});

test('degree and automatic scale undo together while manual scales are retained', async ({
	page
}) => {
	await reachEducation(page);
	await setDegree(page, 'S1');
	await scoreField(page).fill('85');
	await setDegree(page, 'SMA');
	await expect(scaleField(page)).toHaveValue('100');
	// A score edit separates adjacent degree edits using the store's ordinary coalescing contract.
	await scoreField(page).fill('86');
	await setDegree(page, 'S1');
	await expect(scaleField(page)).toHaveValue('4.00');
	await page.locator('.toolbar').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(degreeField(page)).toHaveValue('SMA');
	await expect(scaleField(page)).toHaveValue('100');
	await page.locator('.toolbar').getByRole('button', { name: 'Ulangi', exact: true }).click();
	await expect(degreeField(page)).toHaveValue('S1');
	await expect(scaleField(page)).toHaveValue('4.00');
	await scaleField(page).fill('10');
	await setDegree(page, 'SMA');
	await expect(scaleField(page)).toHaveValue('10');
	await setDegree(page, 'S1');
	await expect(scaleField(page)).toHaveValue('10');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	await page.reload();
	await setDegree(page, 'SMA');
	await expect(scaleField(page)).toHaveValue('10');
	await setDegree(page, 'S1');
	await scaleField(page).fill('100');
	await scoreField(page).fill('87');
	await scaleField(page).fill('10');
	await page.locator('.toolbar').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(scaleField(page)).toHaveValue('100');
	await setDegree(page, 'SMA');
	await expect(scaleField(page)).toHaveValue('100');
	await setDegree(page, 'S1');
	await expect(scaleField(page)).toHaveValue('100');
	await scaleField(page).fill('');
	await setDegree(page, 'SMA');
	await expect(scaleField(page)).toHaveValue('100');
	await setDegree(page, 'S1');
	await expect(scaleField(page)).toHaveValue('4.00');
});

test('degree suggestions and preview follow CV English while form labels follow UI English', async ({
	page
}) => {
	const card = await reachEducation(page, 'en');
	const degree = degreeField(page);
	await degree.click();
	await expect(page.getByRole('option', { name: "Bachelor's Degree", exact: true })).toBeVisible();
	await expect(page.getByRole('option', { name: 'Senior High School', exact: true })).toBeVisible();
	await expect(page.getByRole('option', { name: 'S1', exact: true })).toHaveCount(0);
	await expect(page.getByRole('option', { name: 'SMA', exact: true })).toHaveCount(0);
	await degree.fill('Senior High');
	await page.getByRole('option', { name: 'Senior High School', exact: true }).click();
	await expect(degree).toHaveValue('Senior High School');
	await expect(scaleField(page)).toHaveValue('100');
	await scoreField(page).fill('85');
	await assertPreview(page, ['Senior High School', 'Average grade 85/100']);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(card.getByLabel('Average report grade', { exact: true })).toBeVisible();
	await expect(card.getByLabel('Maximum', { exact: true })).toHaveValue('100');
	await expect(card).toContainText('Example: 85 out of 100.');
	await expect(thesisField(page)).toHaveCount(0);
	await fitsReferenceWidths(page, card);
	await degree.fill('Bachelor');
	await page.getByRole('option', { name: "Bachelor's Degree", exact: true }).click();
	await card.locator('input[id$=".major"]').fill('Computer Science');
	await card.locator('input[id$=".major"]').press('Escape');
	await expect(card.getByLabel('GPA', { exact: true })).toBeVisible();
	await expect(card.getByLabel('GPA scale', { exact: true })).toHaveValue('4.00');
	await expect(card.getByLabel('Thesis / final project title', { exact: true })).toBeVisible();
	await scoreField(page).fill('3.85');
	const preview = await openPreview(page);
	await expect(preview).toContainText("Bachelor's Degree, Computer Science");
	await expect(preview).toContainText('GPA 3.85/4.00');
	await expect(preview).not.toContainText(/\bS1\b/);
	await closePreview(page);
	await fitsReferenceWidths(page, card);
});
