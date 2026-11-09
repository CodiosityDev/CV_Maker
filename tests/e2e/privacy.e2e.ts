import { expect, test, type Locator, type Page } from '@playwright/test';

const secretName = 'Rahasia Warnet';
const cvTitle = `CV ${secretName}`;
const linkedIn = 'https://www.linkedin.com/in/rahasia-warnet';
const heading = (page: Page) => page.locator('.step-heading h1');
const cards = (page: Page) => page.getByTestId('cv-card');
const removed = (page: Page) => page.getByTestId('removed-cv');

async function createPersonal(page: Page, incognito = false, addLink = false) {
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
		await expect(page.locator('.app-header button[aria-label="Mode Incognito"]')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	}
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Staf Administrasi');
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await page.getByLabel(/^Email\b/).fill('rahasia.warnet@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	if (addLink) {
		await page.getByRole('button', { name: 'Tambah Tautan', exact: true }).click();
		await page.getByLabel('Nama tautan', { exact: true }).fill('LinkedIn');
		await page.getByLabel('URL', { exact: true }).fill(linkedIn);
	}
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(heading(page)).toHaveText(title);
}

async function dashboard(page: Page) {
	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(1);
}

async function cardAction(page: Page, card: Locator, name: string) {
	const direct = card.getByRole('button', { name, exact: true });
	if (await direct.isVisible()) await direct.click();
	else {
		await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
		await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
	}
}

async function erase(page: Page, action: 'delete' | 'wipe') {
	if (action === 'delete') {
		await cardAction(page, cards(page).first(), 'Hapus');
		await page
			.getByRole('dialog', { name: 'Hapus CV ini?', exact: true })
			.getByRole('button', { name: 'Hapus', exact: true })
			.click();
	} else {
		await page
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
		const confirmation = page.getByRole('dialog', { name: 'Hapus semua data?', exact: true });
		await confirmation.getByLabel('Kata konfirmasi', { exact: true }).fill('hapus ');
		await confirmation
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
	}
	await expect(cards(page)).toHaveCount(0);
}

async function expectNoSecret(page: Page) {
	await expect(page.getByText(secretName)).toHaveCount(0);
	const copies = await page.evaluate(() => {
		const contents = [
			document.body.textContent ?? '',
			...Array.from(
				document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
				(field) => field.value
			)
		];
		return contents.some((text) =>
			/Rahasia Warnet|rahasia\.warnet@example\.com|linkedin\.com\/in\/rahasia-warnet/.test(text)
		);
	});
	expect(copies, 'no deleted CV data remains in text, closed dialogs or field values').toBe(false);
}

async function expectRemoved(page: Page) {
	await expect(removed(page)).toBeVisible();
	await expect(removed(page)).toContainText('CV ini sudah dihapus di tab lain.');
	await expect(
		removed(page).getByRole('link', { name: 'Buat CV baru', exact: true })
	).toBeVisible();
	await expect(removed(page).getByRole('link', { name: 'CV Saya', exact: true })).toBeVisible();
	await expectNoSecret(page);
}

for (const action of ['delete', 'wipe'] as const) {
	test(`cross-tab ${action} removes wizard and print copies without leaving empty editing controls`, async ({
		page,
		context
	}) => {
		await createPersonal(page);
		const id = new URL(page.url()).pathname.split('/').at(-1);
		if (!id) throw new Error('The real wizard must have a CV id.');
		const print = await context.newPage();
		const other = await context.newPage();
		try {
			await print.goto(`/cv/${id}/print`);
			await expect(print.getByTestId('print-paper')).toContainText(secretName);
			await other.goto('/cv');
			await expect(cards(other)).toHaveCount(1);
			await erase(other, action);
			await expectRemoved(page);
			await expect(page.locator('.toolbar, .workspace, .bottom-actions')).toHaveCount(0);
			await expect(page.getByTestId('cv-preview')).toHaveCount(0);
			await expect(page.getByLabel(/^Nama lengkap\b/)).toHaveCount(0);
			await page.keyboard.press('Control+z');
			await expectNoSecret(page);
			await expectRemoved(print);
			await expect(print.getByTestId('print-paper')).toHaveCount(0);
			await expect(print.getByTestId('print-toolbar')).toHaveCount(0);
			await removed(page).getByRole('link', { name: 'CV Saya', exact: true }).click();
			await expect(page).toHaveURL(/\/cv$/);
			await expect(cards(page)).toHaveCount(0);
		} finally {
			await print.close();
			await other.close();
		}
	});
}

test('dashboard forgets deleted titles from closed menu rename and delete dialogs', async ({
	page,
	context
}) => {
	await createPersonal(page);
	await dashboard(page);
	const card = cards(page).first();
	const originalViewport = page.viewportSize();
	const more = card.getByRole('button', { name: /^Aksi lain untuk / });
	if (!(await more.isVisible())) await page.setViewportSize({ width: 360, height: 780 });
	await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
	await page.keyboard.press('Escape');
	if (originalViewport) await page.setViewportSize(originalViewport);
	await cardAction(page, card, 'Ganti nama');
	await page
		.getByRole('dialog', { name: 'Ganti nama CV', exact: true })
		.getByLabel(/^Judul CV\b/)
		.fill(`${cvTitle} Tertunda`);
	await page.keyboard.press('Escape');
	await cardAction(page, card, 'Hapus');
	await page.keyboard.press('Escape');
	const other = await context.newPage();
	try {
		await other.goto('/cv');
		await expect(cards(other)).toHaveCount(1);
		await erase(other, 'delete');
		await expect(cards(page)).toHaveCount(0);
		await expectNoSecret(page);
		await expectNoSecret(other);
	} finally {
		await other.close();
	}
});

for (const incognito of [true, false]) {
	test(`${incognito ? 'incognito' : 'normal'} print title restores afterprint and after the one-second fallback`, async ({
		page
	}) => {
		await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await createPersonal(page, incognito);
		await dashboard(page);
		await cards(page).getByRole('button', { name: 'Unduh', exact: true }).click();
		await page.getByRole('link', { name: 'PDF untuk melamar', exact: true }).click();
		await expect(page.getByTestId('print-paper')).toContainText(secretName);
		const print = page
			.getByTestId('print-toolbar')
			.getByRole('button', { name: 'Simpan sebagai PDF', exact: true });
		await expect(print).toBeEnabled();
		const originalTitle = await page.title();
		await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'));
		await page.evaluate(() => {
			window.print = () => {
				document.documentElement.dataset.printTitle = document.title;
			};
		});
		const expectedTitle = incognito ? 'CV' : 'CV_Rahasia_Warnet_Staf_Administrasi';
		await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
		await expect(page).toHaveTitle(expectedTitle);
		await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
		await expect(page).toHaveTitle(originalTitle);
		await print.click();
		expect(await page.evaluate(() => document.documentElement.dataset.printTitle)).toBe(
			expectedTitle
		);
		await expect(page).toHaveTitle(expectedTitle);
		await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
		await expect(page).toHaveTitle(originalTitle);
		await print.click();
		await page.clock.runFor(999);
		await expect(page).toHaveTitle(expectedTitle);
		await page.clock.runFor(1);
		await expect(page).toHaveTitle(originalTitle);
		await page.evaluate(() => {
			window.print = () => {
				throw new Error('Print unavailable');
			};
		});
		await print.click();
		await expect(page).toHaveTitle(originalTitle);
		await expect(page.locator('.notification[data-kind="error"]')).toContainText(
			'Menu cetak belum bisa dibuka'
		);
	});
}

async function reachReviewWithLink(page: Page) {
	await createPersonal(page, false, true);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await page.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await page.getByRole('combobox', { name: 'Jurusan', exact: true }).fill('Sistem Informasi');
	const start = page.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('07');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2020');
	const end = page.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('12');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2024');
	await advance(page, 'Pengalaman kerja / magang');
	for (const title of [
		'Organisasi & kepanitiaan',
		'Proyek',
		'Keahlian & pencapaian',
		'Ringkasan profil',
		'Tinjau CV-mu'
	])
		await advance(page, title, true);
}

test('preview and thumbnail links stay in the app while print links keep their destination', async ({
	page,
	context
}) => {
	await context.route(linkedIn, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: '<title>LinkedIn fixture</title><p>LinkedIn fixture</p>'
		})
	);
	await reachReviewWithLink(page);
	const url = page.url();
	const count = context.pages().length;
	const link = page.getByTestId('cv-preview').locator('a[href*="linkedin.com/in/rahasia-warnet"]');
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(url);
	await link.focus();
	await link.press('Enter');
	await expect(page).toHaveURL(url);
	await link.click({ modifiers: ['Control'] });
	await link.click({ button: 'middle' });
	await expect(page).toHaveURL(url);
	const thumbnail = page.getByTestId('template-thumbnail').first();
	await thumbnail.scrollIntoViewIfNeeded();
	const thumbnailLink = thumbnail.locator('a[href*="linkedin.com/in/rahasia-warnet"]');
	await expect(thumbnailLink).toHaveCount(1);
	const event = await thumbnailLink.evaluate((anchor) => {
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		return { allowed: anchor.dispatchEvent(click), prevented: click.defaultPrevented };
	});
	expect(event).toEqual({ allowed: false, prevented: true });
	expect(context.pages()).toHaveLength(count);
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await page
		.getByTestId('export-panel')
		.getByRole('link', { name: 'PDF untuk melamar', exact: true })
		.click();
	await expect(page.getByTestId('print-paper')).toContainText(secretName);
	expect(context.pages()).toHaveLength(count);
	await page
		.getByTestId('print-paper')
		.locator('a[href*="linkedin.com/in/rahasia-warnet"]')
		.click();
	await expect(page).toHaveURL(linkedIn);
	await expect(page).toHaveTitle('LinkedIn fixture');
});
