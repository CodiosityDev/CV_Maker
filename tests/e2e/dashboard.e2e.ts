import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

const cards = (page: Page) => page.getByTestId('cv-card');

async function createCv(page: Page, title: string) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	await page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true }).fill('Perawat');
	await page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true }).press('Escape');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Putri');
	await expect(page.getByTestId('save-status')).toHaveText('Tersimpan ✓');
	await page.goto('/cv');
	await expect(page.getByRole('heading', { name: 'CV Saya', exact: true })).toBeVisible();
	await expect(
		cards(page).filter({ has: page.getByRole('heading', { name: title, exact: true }) })
	).toContainText('Nadia Putri');
}

async function cardAction(page: Page, card: Locator, name: string) {
	const direct = card.getByRole('button', { name, exact: true });
	if (await direct.isVisible()) {
		await direct.click();
	} else {
		await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
		await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
	}
}

async function renameCard(page: Page, card: Locator, title: string) {
	await cardAction(page, card, 'Ganti nama');
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel(/^Judul CV\b/).fill(title);
	await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(cards(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('dashboard duplicates, renames persistently and confirms permanent removal', async ({
	page
}) => {
	const originalTitle = 'CV Nadia — Perawat';
	const renamedTitle = 'CV Perawat — RS Sentosa';
	await createCv(page, originalTitle);
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page).first()).toContainText('Belum selesai');
	await expect(cards(page).getByRole('link', { name: 'Lanjutkan', exact: true })).toBeVisible();
	const download = cards(page).getByRole('button', { name: 'Unduh', exact: true });
	await download.click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('dialog')).toContainText(/belum selesai/i);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await expect(download).toBeFocused();

	await cardAction(page, cards(page).first(), 'Duplikat');
	await expect(cards(page)).toHaveCount(2);
	await renameCard(page, cards(page).first(), renamedTitle);
	await page.reload();
	await expect(cards(page)).toHaveCount(2);
	const renamed = cards(page).filter({
		has: page.getByRole('heading', { name: renamedTitle, exact: true })
	});
	await expect(renamed).toBeVisible();
	await cardAction(page, renamed, 'Hapus');
	const confirmation = page.getByRole('dialog');
	await expect(confirmation).toContainText(renamedTitle);
	await expect(confirmation).toContainText(/permanen/i);
	await confirmation.getByRole('button', { name: 'Hapus', exact: true }).click();
	await expect(confirmation).not.toBeVisible();
	await expect(cards(page)).toHaveCount(1);
	await expect(
		cards(page).getByRole('heading', { name: originalTitle, exact: true })
	).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('downloaded backup restores all CVs after typed wipe and malformed JSON changes nothing', async ({
	page
}) => {
	const title = 'CV Cadangan Nadia';
	await createCv(page, title);
	await cardAction(page, cards(page).first(), 'Duplikat');
	await expect(cards(page)).toHaveCount(2);
	const pendingDownload = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Backup semua CV', exact: true }).click();
	const download = await pendingDownload;
	expect(download.suggestedFilename()).toMatch(/^CVMaker_Backup_\d{4}-\d{2}-\d{2}\.json$/);
	const backupPath = await download.path();
	expect(backupPath).not.toBeNull();
	const contents = await readFile(backupPath!, 'utf8');
	expect(contents).toContain('Nadia Putri');
	expect(contents).toContain(title);

	await page
		.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
		.click();
	const wipe = page.getByRole('dialog');
	const confirm = wipe.getByRole('button', {
		name: 'Hapus semua data di perangkat ini',
		exact: true
	});
	await expect(confirm).toBeDisabled();
	const input = wipe.getByRole('textbox');
	await input.fill('HAPU');
	await expect(confirm).toBeDisabled();
	await input.fill('hapus ');
	await expect(confirm).toBeEnabled();
	await confirm.click();
	await expect(wipe).not.toBeVisible();
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Backup semua CV', exact: true })).toBeDisabled();

	await page.locator('input[type="file"]').setInputFiles(backupPath!);
	await expect(cards(page)).toHaveCount(2);
	await expect(page.getByRole('status').filter({ hasText: '2 CV dipulihkan' })).toBeVisible();
	await expect(cards(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
	const restoredTitles = await cards(page).getByRole('heading', { level: 2 }).allTextContents();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'rusak.json',
		mimeType: 'application/json',
		buffer: Buffer.from('bukan json')
	});
	await expect(page.getByRole('alert')).toContainText(/JSON/i);
	await expect(cards(page)).toHaveCount(2);
	expect(await cards(page).getByRole('heading', { level: 2 }).allTextContents()).toEqual(
		restoredTitles
	);
	await page.reload();
	await expect(cards(page)).toHaveCount(2);
});

test('wipe confirmation highlights the localized word and accepts keyboard casing and spaces', async ({
	page
}) => {
	await page.goto('/cv');
	for (const copy of [
		{
			locale: 'id',
			word: 'HAPUS',
			instruction: 'Ketik HAPUS untuk melanjutkan.',
			label: 'Kata konfirmasi',
			action: 'Hapus semua data di perangkat ini',
			title: 'Hapus semua data?',
			partial: 'HAPU',
			accepted: 'hapus '
		},
		{
			locale: 'en',
			word: 'DELETE',
			instruction: 'Type DELETE to continue.',
			label: 'Confirmation word',
			action: 'Delete all data on this device',
			title: 'Delete all data?',
			partial: 'DELET',
			accepted: 'delete '
		}
	]) {
		if (copy.locale === 'en') {
			await page.getByRole('button', { name: 'English', exact: true }).click();
			await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		}
		await page.getByRole('button', { name: copy.action, exact: true }).click();
		const dialog = page.getByRole('dialog', { name: copy.title, exact: true });
		const instruction = dialog.locator('#wipe-instruction');
		await expect(instruction).toHaveText(copy.instruction);
		await expect(instruction.locator('strong')).toHaveCount(1);
		await expect(instruction.locator('strong.confirm-word')).toHaveText(copy.word);
		const input = dialog.getByRole('textbox', { name: copy.label, exact: true });
		await expect(input).toHaveAttribute('aria-describedby', /(^|\s)wipe-instruction(\s|$)/);
		await expect(input).toHaveAttribute('autocapitalize', 'characters');
		const confirm = dialog.getByRole('button', { name: copy.action, exact: true });
		await input.fill(copy.partial);
		await expect(confirm).toBeDisabled();
		await input.fill(copy.accepted);
		await expect(confirm).toBeEnabled();
		await confirm.click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	}
});

test('dashboard receives actual saves and renames from another tab', async ({ page, context }) => {
	await createCv(page, 'CV tab pertama');
	const other = await context.newPage();
	try {
		await createCv(other, 'CV tab kedua');
		await expect(cards(page)).toHaveCount(2);
		await expect(
			cards(page).getByRole('heading', { name: 'CV tab kedua', exact: true })
		).toBeVisible();
		const second = cards(other).filter({
			has: other.getByRole('heading', { name: 'CV tab kedua', exact: true })
		});
		await renameCard(other, second, 'CV diubah dari tab lain');
		await expect(
			cards(page).getByRole('heading', { name: 'CV diubah dari tab lain', exact: true })
		).toBeVisible();
		await expect(
			cards(page).getByRole('heading', { name: 'CV tab kedua', exact: true })
		).toHaveCount(0);
	} finally {
		await other.close();
	}
});
