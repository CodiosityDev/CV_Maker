import { expect, test, type Locator, type Page } from '@playwright/test';

async function startBullets(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	const next = page.getByRole('button', { name: 'Lanjut', exact: true });
	await next.click();
	await page.getByLabel('Nama lengkap').fill('Nadia Prameswari');
	await page.getByLabel('Email', { exact: false }).fill('nadia@example.com');
	await page.getByLabel('Nomor HP').fill('081234567890');
	await next.click();
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page.getByLabel('Nama sekolah / kampus').fill('Universitas Nusantara');
	await next.click();
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	await page.getByLabel('Posisi / peran', { exact: true }).fill('Data Analyst Intern');
	await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('PT Nusantara');
	const bullets = page.locator('.bullets');
	await bullets.getByRole('button', { name: 'Tambah poin', exact: true }).click();
	return bullets;
}

async function paste(field: Locator, text: string) {
	await field.focus();
	await field.evaluate((element, value) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData('text/plain', value);
		element.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
		);
	}, text);
}

const undo = (page: Page) => page.getByRole('button', { name: 'Urungkan', exact: true }).click();

test('bullet Enter and empty Backspace manage focus and each change can be undone', async ({
	page
}) => {
	const bullets = await startBullets(page);
	const fields = bullets.getByRole('textbox');
	await fields.first().fill('Mengolah 200 baris data penjualan');
	await fields.first().press('End');
	await fields.first().press('Enter');
	await expect(fields).toHaveCount(2);
	await expect(fields.nth(1)).toBeFocused();
	await expect(fields.nth(1)).toHaveValue('');
	await undo(page);
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toHaveValue('Mengolah 200 baris data penjualan');
	await fields.first().press('End');
	await fields.first().press('Enter');
	await fields.nth(1).press('Backspace');
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toBeFocused();
	await undo(page);
	await expect(fields).toHaveCount(2);
	await expect(fields.nth(1)).toHaveValue('');
	await bullets.getByRole('button', { name: 'Hapus poin 2', exact: true }).click();
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toBeFocused();
	await undo(page);
	await expect(fields).toHaveCount(2);
	await expect(bullets.locator('.counter')).toHaveCount(0);
	await fields.first().fill('a'.repeat(240));
	await expect(bullets.locator('.counter')).toHaveText('240/300');
});

test('multi-line bullet paste strips list markers and is one undo step', async ({ page }) => {
	const bullets = await startBullets(page);
	const fields = bullets.getByRole('textbox');
	await paste(fields.first(), '- a\n- b\n- c');
	await expect(fields).toHaveCount(3);
	for (const [index, text] of ['a', 'b', 'c'].entries())
		await expect(fields.nth(index)).toHaveValue(text);
	await expect(fields.nth(2)).toBeFocused();
	await undo(page);
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toHaveValue('');
	await paste(fields.first(), '• Satu\n* Dua\n1. Tiga\na) Empat');
	await expect(fields).toHaveCount(4);
	for (const [index, text] of ['Satu', 'Dua', 'Tiga', 'Empat'].entries())
		await expect(fields.nth(index)).toHaveValue(text);
	await undo(page);
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toHaveValue('');
});

test('bullet Alt arrows and touch menu reorder, announce the result, and support undo', async ({
	page
}) => {
	const bullets = await startBullets(page);
	const fields = bullets.getByRole('textbox');
	await paste(fields.first(), '- Pertama\n- Kedua\n- Ketiga');
	await fields.first().press('Alt+ArrowDown');
	await expect(fields.nth(0)).toHaveValue('Kedua');
	await expect(fields.nth(1)).toHaveValue('Pertama');
	await expect(fields.nth(1)).toBeFocused();
	await expect(bullets.locator('[aria-live="polite"]')).toHaveText('Poin 1 dipindah ke 2.');
	await undo(page);
	await expect(fields.first()).toHaveValue('Pertama');
	await expect(fields.nth(1)).toHaveValue('Kedua');
	const menu = bullets.locator('.point-menu').first();
	const trigger = menu.locator('summary');
	await expect(menu.getByRole('button', { name: 'Turun', exact: true })).not.toBeVisible();
	await trigger.click();
	await expect(menu.getByRole('button', { name: 'Naik', exact: true })).toBeDisabled();
	await menu.getByRole('button', { name: 'Turun', exact: true }).click();
	await expect(fields.nth(1)).toHaveValue('Pertama');
	await expect(fields.nth(1)).toBeFocused();
	await expect(menu).not.toHaveAttribute('open');
	await undo(page);
	await expect(fields.first()).toHaveValue('Pertama');
	await trigger.click();
	await menu.getByRole('button', { name: 'Turun', exact: true }).focus();
	await page.keyboard.press('Escape');
	await expect(menu).not.toHaveAttribute('open');
	await expect(trigger).toBeFocused();
});

test('bullet examples append and the eight-point limit prevents extra entries', async ({
	page
}) => {
	const bullets = await startBullets(page);
	const fields = bullets.getByRole('textbox');
	await fields.first().fill('Mengolah data penjualan mingguan');
	await bullets.locator('.bullet-examples > summary').click();
	const example = bullets.locator('.example-chip').first();
	const exampleText = await example.innerText();
	await example.click();
	await expect(fields).toHaveCount(2);
	await expect(fields.first()).toHaveValue('Mengolah data penjualan mingguan');
	await expect(fields.nth(1)).toHaveValue(exampleText);
	await undo(page);
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toHaveValue('Mengolah data penjualan mingguan');
	await fields.first().fill('');
	await paste(
		fields.first(),
		Array.from({ length: 9 }, (_, index) => `- Poin ${index + 1}`).join('\n')
	);
	await expect(fields).toHaveCount(8);
	await expect(fields.nth(7)).toHaveValue('Poin 8');
	await expect(bullets.getByRole('button', { name: 'Tambah poin', exact: true })).toBeDisabled();
	await expect(bullets.locator('.limit')).toHaveText('Maksimal 8 poin.');
	await expect(example).toBeDisabled();
	await fields.nth(7).press('End');
	await fields.nth(7).press('Enter');
	await expect(fields).toHaveCount(8);
	await expect(fields.nth(7)).toHaveValue('Poin 8');
	await undo(page);
	await expect(fields).toHaveCount(1);
	await expect(fields.first()).toHaveValue('');
});
