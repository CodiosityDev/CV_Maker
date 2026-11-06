import { expect, test, type Page } from '@playwright/test';

const banner = (page: Page) => page.getByRole('region', { name: 'Mode Incognito', exact: true });
const cards = (page: Page) => page.getByTestId('cv-card');
const saved = (page: Page) => page.getByTestId('save-status');
const secretName = 'Rahasia Warnet';
const normalTitle = 'CV Normal Nadia';
const expiredMessage = 'CV di sesi incognito ini dihapus otomatis karena 3 jam tidak ada perubahan';

async function createPersonal(page: Page, title: string) {
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
}

async function createNormal(page: Page) {
	await page.goto('/buat');
	await createPersonal(page, normalTitle);
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Tersimpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	await page.goto('/buat');
	await expect(page.locator('.resume-card')).toHaveCount(1);
}

async function startIncognito(page: Page) {
	await page.getByRole('button', { name: 'Nyalakan Mode Incognito', exact: true }).click();
	await expect(banner(page)).toBeVisible();
	await expect(banner(page)).toContainText('Mode Incognito aktif');
	await expect(page.locator('.resume-card')).toHaveCount(0);
}

async function endIncognito(page: Page) {
	await banner(page).getByRole('button', { name: 'Akhiri & hapus', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Sudah mengunduh CV kamu?');
	await dialog.getByRole('button', { name: 'Akhiri & hapus', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(banner(page)).toHaveCount(0);
}

async function expectOnlyNormalCv(page: Page) {
	await page.goto('/cv');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText(normalTitle);
	await expect(cards(page)).toContainText('Nadia Tersimpan');
	await expect(cards(page)).not.toContainText(secretName);
}

test('incognito separates tabs, disables autofill and loses only session CVs on reload', async ({
	page,
	context
}) => {
	await createNormal(page);
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	for (const label of [/^Nama lengkap\b/, /^Email\b/, /^Nomor HP\b/]) {
		await expect(page.getByLabel(label)).toHaveAttribute('autocomplete', 'off');
	}
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');

	const other = await context.newPage();
	try {
		await expectOnlyNormalCv(other);
		await expect(banner(other)).toHaveCount(0);
	} finally {
		await other.close();
	}

	const dialogs: string[] = [];
	page.on('dialog', async (dialog) => {
		dialogs.push(dialog.type());
		await dialog.accept();
	});
	await page.reload();
	expect(dialogs).toEqual(['beforeunload']);
	await expect(banner(page)).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
	).toBeVisible();
	await page.getByRole('link', { name: 'Buat CV baru', exact: true }).click();
	await expect(page.locator('.resume-card')).toHaveCount(0);

	const end = banner(page).getByRole('button', { name: 'Akhiri & hapus', exact: true });
	await end.click();
	const confirmation = page.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true });
	await expect(confirmation).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(confirmation).not.toBeVisible();
	await expect(end).toBeFocused();
	await expect(banner(page)).toBeVisible();
	await endIncognito(page);
	await expectOnlyNormalCv(page);
});

test('ending from an open wizard discards an unsaved edit without saving it to normal storage', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-11-06T04:00:00Z') });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await createNormal(page);
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	// Freeze the 500 ms autosave debounce before editing, so ending must discard pending changes.
	await page.clock.pauseAt(new Date('2026-11-06T04:01:00Z'));
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await endIncognito(page);
	await page.clock.runFor(1_000);
	await expectOnlyNormalCv(page);
});

test('three idle hours erase an open CV, stop edits and leave the tab incognito', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	const name = page.getByLabel(/^Nama lengkap\b/);
	await name.fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(banner(page)).toContainText(/Dihapus otomatis pukul \d{2}[.:]\d{2}/);
	const previewButton = page.getByRole('button', { name: 'Lihat Preview', exact: true });
	const previewDialog = page.getByRole('dialog', { name: 'Preview CV', exact: true });
	if (await previewButton.isVisible()) {
		await previewButton.click();
		await expect(previewDialog).toBeVisible();
		await expect(page.getByTestId('cv-preview')).toContainText(secretName);
	}
	await page.clock.fastForward('03:02:00');
	await expect(previewDialog).not.toBeVisible();
	await expect(page.getByTestId('cv-preview')).toHaveCount(0);
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toBeVisible();
	await expect(name).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Lanjut', exact: true })).toBeDisabled();
	await page.keyboard.type('Tidak boleh tersimpan');
	await expect(name).toHaveValue(secretName);
	await expect(banner(page)).toBeVisible();
	await expect(banner(page)).not.toContainText(/Dihapus otomatis pukul/);
	await page.getByRole('link', { name: 'Buat CV baru', exact: true }).click();
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await page.getByRole('link', { name: 'Lihat semua CV', exact: true }).click();
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByRole('status').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(banner(page)).toBeVisible();
});

test('incognito information and ending confirmation translate to English', async ({ page }) => {
	await page.goto('/buat');
	await startIncognito(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const active = page.getByRole('region', { name: 'Incognito Mode', exact: true });
	await expect(active).toBeVisible();
	await active.getByRole('button', { name: 'Info', exact: true }).click();
	const info = page.getByRole('dialog');
	await expect(info).toContainText(/only in this tab/i);
	await expect(info).toContainText(/refresh/i);
	await page.keyboard.press('Escape');
	await expect(info).not.toBeVisible();
	await active.getByRole('button', { name: 'End & erase', exact: true }).click();
	const end = page.getByRole('dialog', { name: 'End Incognito Mode?', exact: true });
	await expect(end).toBeVisible();
	await end.getByRole('button', { name: 'End & erase', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(active).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Turn on Incognito Mode', exact: true })
	).toBeVisible();
});

test('edits move the deadline and idle expiry refreshes an already open dashboard', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	const name = page.getByLabel(/^Nama lengkap\b/);
	await name.fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	const deadline = banner(page).getByRole('status');
	await expect(deadline).toContainText(/Dihapus otomatis pukul \d{2}[.:]\d{2}/);
	const originalDeadline = await deadline.innerText();
	await page.clock.fastForward('00:02:00');
	await name.fill(`${secretName} Baru`);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(deadline).not.toHaveText(originalDeadline);

	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText(`${secretName} Baru`);
	await page.clock.fastForward('03:02:00');
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByRole('status').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(banner(page)).toBeVisible();
	await expect(deadline).toHaveCount(0);

	await page.locator('.page-heading').getByRole('link', { name: 'Buat CV', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await createPersonal(page, 'CV Sesi Baru');
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toHaveCount(0);
	await expect(banner(page)).toBeVisible();
	await expect(deadline).toBeVisible();
});

test('idle expiry removes the CV and PDF action from an already open print page', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(cards(page)).toHaveCount(1);
	await cards(page).getByRole('button', { name: 'Unduh', exact: true }).click();
	await page.getByRole('link', { name: 'PDF untuk melamar', exact: true }).click();
	await expect(page).toHaveURL(/\/cv\/[a-f\d-]+\/print$/);
	const paper = page.getByTestId('print-paper');
	await expect(paper.getByRole('heading', { name: secretName, exact: true })).toBeVisible();
	await expect(paper.locator('[data-template]')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true })).toBeEnabled();
	await page.clock.fastForward('03:02:00');
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toBeVisible();
	await expect(paper.locator('[data-template]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true })).toHaveCount(
		0
	);
	await expect(banner(page)).toBeVisible();
});
