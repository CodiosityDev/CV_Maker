import { expect, test, type Locator, type Page } from '@playwright/test';

const heading = (page: Page) => page.locator('.step-heading h1');
const cards = (page: Page) => page.locator('.collection-steps .item-card');

async function next(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText(title);
}
async function personal(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await next(page, 'Data diri');
	await page.getByLabel('Nama lengkap', { exact: false }).fill('Nadia Putri');
	await page.getByLabel('Email', { exact: false }).fill('nadia@example.com');
	await page.getByLabel('Nomor HP', { exact: false }).fill('081234567890');
}
async function experience(page: Page) {
	await personal(page);
	await next(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Nusantara');
	await next(page, 'Pengalaman kerja / magang');
}
async function addExperience(page: Page, role: string, company: string) {
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	const card = cards(page).last();
	await expect(card).toHaveAttribute('open', '');
	await expect(card.getByLabel('Jenis pengalaman', { exact: true })).toBeFocused();
	await card.getByRole('combobox', { name: 'Posisi / peran', exact: true }).fill(role);
	await card.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill(company);
	return card;
}
async function menu(card: Locator) {
	const row = card.locator('..');
	await row.locator('.action-menu > summary').click();
	return row.locator('.menu-actions');
}

test('cards add open with focus, collapse to meaningful dates, and keep only the first open on reload', async ({
	page
}) => {
	await experience(page);
	await addExperience(page, 'Data Analyst Intern', 'PT Nusantara Niaga Digital');
	const first = cards(page).first();
	const start = first.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('07');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2023');
	const end = first.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('12');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2023');
	const summary = first.locator('.card-summary');
	await expect(summary).toHaveText(
		'Data Analyst Intern — PT Nusantara Niaga Digital · Jul 2023 – Des 2023'
	);
	await summary.click();
	await expect(first).not.toHaveAttribute('open', '');
	await expect(summary).toBeVisible();
	await expect(
		first.getByRole('combobox', { name: 'Posisi / peran', exact: true, includeHidden: true })
	).not.toBeVisible();
	await addExperience(page, 'Asisten peneliti', 'Laboratorium Kampus');
	await expect(first).not.toHaveAttribute('open', '');
	await expect(page.getByTestId('save-status')).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(heading(page)).toHaveText('Pengalaman kerja / magang');
	await expect(cards(page).first()).toHaveAttribute('open', '');
	await expect(cards(page).nth(1)).not.toHaveAttribute('open', '');
	await expect(cards(page).nth(1).locator('.card-summary')).toHaveText(
		'Asisten peneliti — Laboratorium Kampus'
	);
	await cards(page).nth(1).locator('.card-summary').focus();
	await page.keyboard.press('Enter');
	await expect(
		cards(page).nth(1).getByRole('combobox', { name: 'Posisi / peran', exact: true })
	).toBeVisible();
});

test('item menus reorder atomically and delete with a working, focused Undo toast', async ({
	page
}) => {
	await experience(page);
	await addExperience(page, 'Analis data', 'Koperasi Kampus');
	await addExperience(page, 'Asisten lab', 'Laboratorium Kampus');
	const actions = await menu(cards(page).nth(1));
	await actions.getByRole('button', { name: 'Naik', exact: true }).click();
	await expect(cards(page).first().locator('.card-summary')).toHaveText(
		'Asisten lab — Laboratorium Kampus'
	);
	await expect(cards(page).first().locator('.card-summary')).toBeFocused();
	await expect(page.locator('.list-editor > [aria-live]')).toContainText('Asisten lab');
	await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page).first().locator('.card-summary')).toHaveText(
		'Analis data — Koperasi Kampus'
	);
	const remove = await menu(cards(page).first());
	await remove
		.getByRole('button', { name: 'Hapus Analis data — Koperasi Kampus', exact: true })
		.click();
	await expect(cards(page)).toHaveCount(1);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.locator('.toaster')).toContainText('Dihapus');
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		const notification = await page.locator('.toaster .notification').boundingBox();
		const actions = await page.locator('.bottom-actions').boundingBox();
		expect(notification).not.toBeNull();
		expect(actions).not.toBeNull();
		expect(notification!.y + notification!.height).toBeLessThanOrEqual(actions!.y);
	}
	await page.locator('.toaster').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page)).toHaveCount(2);
	await expect(cards(page).first().getByLabel('Jenis pengalaman', { exact: true })).toBeFocused();
	await expect(
		cards(page).first().getByRole('combobox', { name: 'Posisi / peran', exact: true })
	).toHaveValue('Analis data');
	await expect(page.locator('.toaster .notification')).toHaveCount(0);
	// Undoing the last row restores focus to that row, after the bound array updates.
	const lastActions = await menu(cards(page).last());
	await lastActions.getByRole('button', { name: /^Hapus / }).click();
	await page.locator('.toaster').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page)).toHaveCount(2);
	await expect(cards(page).last().getByLabel('Jenis pengalaman', { exact: true })).toBeFocused();
	// Two consecutive deletions must remain two separate history steps.
	for (let index = 0; index < 2; index += 1) {
		const action = await menu(cards(page).first());
		await action.getByRole('button', { name: /^Hapus / }).click();
	}
	await expect(cards(page)).toHaveCount(0);
	await page.locator('.history').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page)).toHaveCount(1);
	await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page)).toHaveCount(2);
});

test('education, organisation, project, language, certificate, award and link cards have specific summaries', async ({
	page
}) => {
	await personal(page);
	const links = page.getByRole('region', { name: 'Tautan', exact: true });
	await links.getByRole('button', { name: 'Tambah Tautan', exact: true }).click();
	await expect(links.getByLabel('Nama tautan', { exact: true })).toBeFocused();
	await links.getByLabel('Nama tautan', { exact: true }).fill('Portofolio');
	await links.getByLabel('URL', { exact: true }).fill('https://example.com');
	await expect(links.locator('.card-summary')).toHaveText('Portofolio');
	await next(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await expect(
		page.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
	).toBeFocused();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Nusantara');
	await expect(cards(page).first().locator('.card-summary')).toHaveText('Universitas Nusantara');
	await next(page, 'Pengalaman kerja / magang');
	await next(page, 'Organisasi & kepanitiaan', true);
	await page.getByRole('button', { name: 'Tambah Organisasi & kepanitiaan', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Nama', exact: true })).toBeFocused();
	await page.getByRole('textbox', { name: 'Nama', exact: true }).fill('BEM Fakultas');
	await page.getByRole('combobox', { name: 'Posisi / peran', exact: true }).fill('Sekretaris');
	await expect(cards(page).first().locator('.card-summary')).toHaveText(
		'Sekretaris — BEM Fakultas'
	);
	await next(page, 'Proyek');
	await page.getByRole('button', { name: 'Tambah Proyek', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Nama', exact: true })).toBeFocused();
	await page.getByRole('textbox', { name: 'Nama', exact: true }).fill('Situs Perpustakaan');
	await expect(cards(page).first().locator('.card-summary')).toHaveText('Situs Perpustakaan');
	await next(page, 'Keahlian & pencapaian');
	for (const entry of [
		{
			label: 'Bahasa',
			add: 'Tambah Bahasa',
			field: 'Nama',
			role: 'combobox' as const,
			value: 'Jepang',
			summary: 'Jepang — Dasar'
		},
		{
			label: 'Sertifikasi & pelatihan',
			add: 'Tambah Sertifikasi & pelatihan',
			field: 'Nama',
			role: 'textbox' as const,
			value: 'SQL Dasar',
			summary: 'SQL Dasar'
		},
		{
			label: 'Prestasi & penghargaan',
			add: 'Tambah Prestasi & penghargaan',
			field: 'Judul prestasi',
			role: 'textbox' as const,
			value: 'Juara Lomba Data',
			summary: 'Juara Lomba Data'
		}
	]) {
		const section = page.getByRole('region', { name: entry.label, exact: true });
		await section.getByRole('button', { name: entry.add, exact: true }).click();
		await expect(section.getByRole(entry.role, { name: entry.field, exact: true })).toBeFocused();
		await section.getByRole(entry.role, { name: entry.field, exact: true }).fill(entry.value);
		await expect(section.locator('.card-summary')).toHaveText(entry.summary);
		await section.locator('.card-summary').click();
		const field = section.getByRole(entry.role, {
			name: entry.field,
			exact: true,
			includeHidden: true
		});
		await expect(field).toHaveCount(1);
		await expect(field).not.toBeVisible();
	}
});

test('an Undo toast expires on a later edit instead of undoing unrelated content', async ({
	page
}) => {
	await experience(page);
	await addExperience(page, 'Analis data', 'Koperasi Kampus');
	await addExperience(page, 'Asisten lab', 'Laboratorium Kampus');
	const remove = await menu(cards(page).first());
	await remove.getByRole('button', { name: /^Hapus / }).click();
	await expect(
		page.locator('.toaster').getByRole('button', { name: 'Urungkan', exact: true })
	).toBeVisible();
	const role = cards(page).first().getByRole('combobox', { name: 'Posisi / peran', exact: true });
	await role.fill('Asisten peneliti');
	await expect(page.locator('.toaster .notification')).toHaveCount(0);
	await page.locator('.history').getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(cards(page)).toHaveCount(1);
	await expect(role).toHaveValue('Asisten lab');
});

test('an end date before the start date is flagged at once and clears when fixed', async ({
	page
}) => {
	await experience(page);
	const card = await addExperience(page, 'Kasir', 'Toko Sinar');
	const start = card.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('10');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2018');
	const end = card.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('09');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2017');
	const message = card.getByText('Tanggal selesai tidak boleh sebelum tanggal mulai.');
	await expect(message).toBeVisible();
	await end.getByLabel('Tahun', { exact: true }).selectOption('2019');
	await expect(message).toHaveCount(0);
});
