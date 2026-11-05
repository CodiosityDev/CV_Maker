import { expect, test, type Page } from '@playwright/test';

const heading = (page: Page) => page.locator('.step-heading h1');
const nextButton = (page: Page) => page.getByRole('button', { name: 'Lanjut', exact: true });
const saved = (page: Page) => page.getByTestId('save-status');

async function fitsViewport(page: Page, context: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, `${context}: document must fit viewport`).toBeLessThanOrEqual(0);
}

async function createCv(page: Page, kind: 'ats' | 'creative' = 'ats') {
	await page.goto('/buat');
	await page
		.getByRole('button', {
			name: kind === 'ats' ? 'Pilih CV ATS' : 'Pilih CV Creative',
			exact: true
		})
		.click();
	await expect(page).toHaveURL(/\/buat\/[a-f\d-]+$/);
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
}

async function advance(page: Page, title: string, skip = false) {
	await (
		skip ? page.getByRole('button', { name: 'Lewati', exact: true }) : nextButton(page)
	).click();
	await expect(heading(page)).toHaveText(title);
	await expect(heading(page), `Focus moves to heading: ${title}`).toBeFocused();
}

async function enterPersonal(page: Page, kind: 'ats' | 'creative' = 'ats') {
	await createCv(page, kind);
	await advance(page, 'Data diri');
}

async function fillPersonal(page: Page) {
	await page.getByLabel('Nama lengkap').fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('alya.putri@example.com');
	const phone = page.getByLabel('Nomor HP');
	await phone.fill('081234567890');
	await phone.blur();
	await expect(phone).toHaveValue('+62 812-3456-7890');
}

async function addEducation(page: Page) {
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await page.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await page.getByRole('combobox', { name: 'Jurusan', exact: true }).fill('Teknik Informatika');
	await expect(page.getByLabel('Skala IPK', { exact: true })).toHaveValue('4.00');
	const start = page.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('09');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2020');
	const end = page.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('07');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2024');
}

async function reachExperience(page: Page) {
	await enterPersonal(page);
	await fillPersonal(page);
	await advance(page, 'Pendidikan');
	await addEducation(page);
	await advance(page, 'Pengalaman kerja / magang');
}

async function skipToSummary(page: Page) {
	for (const title of [
		'Organisasi & kepanitiaan',
		'Proyek',
		'Keahlian & pencapaian',
		'Ringkasan profil'
	])
		await advance(page, title, true);
}

async function visiblePreview(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		await page.getByRole('button', { name: 'Lihat Preview', exact: true }).click();
		const sheet = page.getByRole('dialog', { name: 'Preview CV', exact: true });
		await expect(sheet).toBeVisible();
		return sheet.getByTestId('cv-preview');
	}
	return page.locator('aside').getByTestId('cv-preview');
}

test('ATS happy path reaches review and done with saved content and heading focus', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	await createCv(page);
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Junior Web Developer');
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Alya — Web Developer');
	await fitsViewport(page, 'target');
	await advance(page, 'Data diri');
	await fillPersonal(page);
	await expect(page.locator('input[type="file"]')).toHaveCount(0);
	await fitsViewport(page, 'personal');
	await advance(page, 'Pendidikan');
	await addEducation(page);
	await fitsViewport(page, 'education');
	await advance(page, 'Pengalaman kerja / magang');
	await skipToSummary(page);
	await page
		.getByLabel('Ringkasan profil', { exact: true })
		.fill(
			'Lulusan Teknik Informatika dengan pengalaman proyek web. Menguasai TypeScript dan SQL, siap berkontribusi sebagai Junior Web Developer.'
		);
	await advance(page, 'Tinjau CV-mu');
	await expect(page.getByText('CV siap', { exact: true })).toBeVisible();
	const preview = page.getByTestId('cv-preview');
	await expect(preview.getByRole('heading', { level: 1 })).toHaveText('Alya Putri');
	await expect(
		preview.getByRole('heading', { level: 2, name: 'Pendidikan', exact: true })
	).toBeVisible();
	await expect(preview).toContainText('Universitas Contoh');
	await fitsViewport(page, 'review');
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await expect(heading(page)).toBeFocused();
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(heading(page)).toHaveText('CV-mu tersimpan');
	await expect(page.getByTestId('cv-preview')).toContainText('Alya Putri');
	await page.getByRole('button', { name: 'Ubah lagi', exact: true }).click();
	await expect(heading(page)).toHaveText('Tinjau CV-mu');
	await expect(heading(page)).toBeFocused();
	await fitsViewport(page, 'done and review again');
	expect(errors, 'Wizard must have no runtime or console errors').toEqual([]);
});

test('empty personal fields show linked errors, focus the first field, and block Next', async ({
	page
}) => {
	await enterPersonal(page);
	await nextButton(page).click();
	await expect(heading(page)).toHaveText('Data diri');
	const name = page.getByLabel('Nama lengkap');
	await expect(name).toBeFocused();
	for (const label of ['Nama lengkap', 'Email', 'Nomor HP']) {
		const field = page.getByLabel(label);
		await expect(field, label).toHaveAttribute('aria-invalid', 'true');
		const errorId = (await field.getAttribute('aria-describedby'))
			?.split(' ')
			.find((id) => id.endsWith('-error'));
		expect(errorId, `${label}: aria-describedby must include its error`).toBeTruthy();
		await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Wajib diisi.');
	}
	await name.fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('email-belum-valid');
	await page.getByLabel('Nomor HP').fill('abc');
	await nextButton(page).click();
	await expect(page.getByLabel('Email', { exact: false })).toBeFocused();
	await expect(
		page.getByText('Format email belum benar. Contoh: nama@email.com', { exact: true })
	).toBeVisible();
	await expect(heading(page)).toHaveText('Data diri');
});

test('autosaved name and current step survive reload and an unfinished CV can be resumed', async ({
	page
}) => {
	await enterPersonal(page);
	await page.getByLabel('Nama lengkap').fill('Nama yang tersimpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	const cvUrl = page.url();
	await page.reload();
	await expect(heading(page)).toHaveText('Data diri');
	await expect(page.getByLabel('Nama lengkap')).toHaveValue('Nama yang tersimpan');
	await page.goto('/buat');
	await expect(
		page.getByRole('heading', { name: 'Lanjutkan CV yang belum selesai', exact: true })
	).toBeVisible();
	const resume = page.locator('.resume-card');
	await expect(resume).toHaveCount(1);
	await expect(resume).toContainText('Terakhir diubah:');
	await resume.click();
	await expect(page).toHaveURL(cvUrl);
	await expect(heading(page)).toHaveText('Data diri');
	await expect(page.getByLabel('Nama lengkap')).toHaveValue('Nama yang tersimpan');
});

test('Undo and Redo restore content while retaining wizard progress', async ({ page }) => {
	await enterPersonal(page);
	const name = page.getByLabel('Nama lengkap');
	await name.fill('Nama awal');
	await page.getByLabel('Headline singkat', { exact: true }).fill('Lulusan baru');
	await name.fill('Nama setelah perubahan');
	await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(name).toHaveValue('Nama awal');
	await expect(heading(page)).toHaveText('Data diri');
	await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
	await expect(name).toHaveValue('Nama setelah perubahan');
	await heading(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(name).toHaveValue('Nama awal');
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(name).toHaveValue('Nama setelah perubahan');
});

test('an unknown CV id has a clear missing state and a working create link', async ({ page }) => {
	await page.goto('/buat/id-tidak-ada');
	await expect(
		page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
	).toBeVisible();
	await page.getByRole('link', { name: 'Buat CV baru', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(page.getByRole('button', { name: 'Pilih CV ATS', exact: true })).toBeVisible();
});

test('live preview shows typed text and the mobile preview closes with Escape and restores focus', async ({
	page
}) => {
	await enterPersonal(page);
	await page.getByLabel('Nama lengkap').fill('Nama di preview');
	const preview = await visiblePreview(page);
	await expect(preview.getByRole('heading', { level: 1 })).toHaveText('Nama di preview');
	await expect(preview.locator('img, table')).toHaveCount(0);
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		const sheet = page.getByRole('dialog', { name: 'Preview CV', exact: true });
		const close = sheet.getByRole('button', { name: 'Tutup', exact: true });
		await close.focus();
		await page.keyboard.press('Tab');
		await expect(close).toBeFocused();
		await page.keyboard.press('Shift+Tab');
		await expect(close).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(sheet).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Lihat Preview', exact: true })).toBeFocused();
	}
});

test('review links jump to a partially completed optional item and focus its invalid field', async ({
	page
}) => {
	await reachExperience(page);
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Perusahaan Contoh');
	await skipToSummary(page);
	await advance(page, 'Tinjau CV-mu', true);
	await expect(
		page.getByRole('heading', { name: 'Ada bagian yang perlu dilengkapi', exact: true })
	).toBeVisible();
	await page
		.getByRole('button', { name: /^Pengalaman kerja \/ magang — Posisi \/ peran:/ })
		.click();
	await expect(heading(page)).toHaveText('Pengalaman kerja / magang');
	const role = page.getByRole('combobox', { name: 'Posisi / peran', exact: true });
	await expect(role).toBeFocused();
	await expect(role).toHaveAttribute('aria-invalid', 'true');
});

test('CV content language remains independent of the UI language', async ({ page }) => {
	await createCv(page);
	await page.getByLabel('Bahasa isi CV', { exact: true }).selectOption('en');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await advance(page, 'Data diri');
	await fillPersonal(page);
	await advance(page, 'Pendidikan');
	await addEducation(page);
	let preview = await visiblePreview(page);
	await expect(preview.getByRole('heading', { name: 'Education', exact: true })).toBeVisible();
	if ((page.viewportSize()?.width ?? 0) < 1024) await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(
		page.getByRole('combobox', { name: 'School / university', exact: false })
	).toHaveValue('Universitas Contoh');
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await page.getByLabel('CV content language', { exact: true }).selectOption('id');
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	if ((page.viewportSize()?.width ?? 0) < 1024)
		await page.getByRole('button', { name: 'View preview', exact: true }).click();
	preview = page.getByTestId('cv-preview');
	await expect(preview.getByRole('heading', { name: 'Pendidikan', exact: true })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('Creative photo errors are translated and a valid photo can be replaced and removed', async ({
	page
}) => {
	await enterPersonal(page, 'creative');
	const upload = page.getByLabel('Foto profil (opsional)', { exact: true });
	await upload.setInputFiles({
		name: 'bukan-gambar.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('Ini teks biasa')
	});
	await expect(page.getByRole('alert')).toHaveText('Pilih file gambar, misalnya JPEG atau PNG.');
	await expect(upload).toHaveAttribute('aria-invalid', 'true');
	await upload.setInputFiles({
		name: 'rusak.png',
		mimeType: 'image/png',
		buffer: Buffer.from('bukan data PNG')
	});
	await expect(page.getByRole('alert')).toHaveText('Gambar belum bisa dibaca. Coba foto lain.');
	const image = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 2;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas unavailable');
		context.fillStyle = '#0f766e';
		context.fillRect(0, 0, 2, 2);
		return canvas.toDataURL('image/png').split(',')[1]!;
	});
	const fixture = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') };
	await upload.setInputFiles(fixture);
	const photo = page.getByRole('img', { name: 'Foto profil CV', exact: true });
	await expect(photo).toBeVisible();
	await expect(photo).toHaveAttribute('src', /^blob:/);
	const firstUrl = await photo.getAttribute('src');
	await upload.setInputFiles({ ...fixture, name: 'foto-baru.png' });
	await expect(photo).not.toHaveAttribute('src', firstUrl!);
	await expect(page.getByRole('alert')).toHaveCount(0);
	await page.getByRole('button', { name: 'Hapus foto', exact: true }).click();
	await expect(photo).toHaveCount(0);
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(heading(page)).toHaveText('Data diri');
	await expect(page.getByRole('img', { name: 'Foto profil CV', exact: true })).toHaveCount(0);
});

test('type quiz remains advisory and wizard fits 320, 360, 768 and 1280px', async ({
	page
}, testInfo) => {
	await page.setViewportSize({ width: 320, height: 780 });
	await page.goto('/buat');
	await page
		.getByLabel('Bagaimana kamu akan mengirim lamaran?', { exact: true })
		.selectOption('direct');
	await page
		.getByLabel('Apakah kamu melamar di bidang desain atau kreatif?', { exact: true })
		.selectOption('yes');
	await expect(page.locator('.recommended-card')).toContainText('CV Creative');
	await fitsViewport(page, '320px type quiz');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await advance(page, 'Data diri');
	await page
		.getByLabel('Nama lengkap')
		.fill('Nama panjang untuk memeriksa preview tanpa scroll horizontal');
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await fitsViewport(page, `${width}px personal form`);
		const preview = await visiblePreview(page);
		await expect(preview.getByRole('heading', { level: 1 })).toHaveText(
			'Nama panjang untuk memeriksa preview tanpa scroll horizontal'
		);
		await fitsViewport(page, `${width}px visible A4 preview`);
		const paperWidth = await preview
			.locator('.paper')
			.evaluate((element) => element.getBoundingClientRect().width);
		const frameWidth = await preview
			.locator('.viewport')
			.evaluate((element) => element.getBoundingClientRect().width);
		expect(paperWidth, `${width}px scaled A4 width fits its frame`).toBeLessThanOrEqual(
			frameWidth + 1
		);
		await page.screenshot({ path: testInfo.outputPath(`wizard-${width}.png`), fullPage: false });
		if (width < 1024) await page.keyboard.press('Escape');
	}
});
