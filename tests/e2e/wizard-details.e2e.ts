import { expect, test, type Locator, type Page } from '@playwright/test';

const stepHeading = (page: Page) => page.locator('.step-heading h1');
const saveStatus = (page: Page) => page.getByTestId('save-status');

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(stepHeading(page)).toHaveText(title);
}

async function start(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(stepHeading(page)).toHaveText('Arah kariermu');
}

async function reachExperience(page: Page) {
	await start(page);
	await advance(page, 'Data diri');
	await page.getByLabel('Nama lengkap').fill('Dina Larasati');
	await page.getByLabel('Email', { exact: false }).fill('dina@example.com');
	await page.getByLabel('Nomor HP').fill('081234567890');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page.getByLabel('Nama sekolah / kampus').fill('Universitas Nusantara');
	await advance(page, 'Pengalaman kerja / magang');
}

async function skipToSkills(page: Page) {
	await advance(page, 'Organisasi & kepanitiaan', true);
	await advance(page, 'Proyek', true);
	await advance(page, 'Keahlian & pencapaian', true);
}

async function setMonth(group: Locator, month: string, year: string) {
	await group.getByLabel('Bulan', { exact: true }).selectOption(month);
	await group.getByLabel('Tahun', { exact: true }).selectOption(year);
}

async function appendOwnAndExampleBullet(page: Page, text: string) {
	const bullets = page.locator('.bullets');
	await bullets
		.getByRole('button', { name: 'Tambah Kontribusi dan pencapaian', exact: true })
		.click();
	await bullets.getByRole('textbox').fill(text);
	await bullets.locator('summary').click();
	const example = await bullets.locator('.examples li p').first().innerText();
	await bullets.getByRole('button', { name: 'Pakai contoh', exact: true }).first().click();
	await expect(bullets.getByRole('textbox')).toHaveCount(2);
	await expect(bullets.getByRole('textbox').nth(0)).toHaveValue(text);
	await expect(bullets.getByRole('textbox').nth(1)).toHaveValue(example);
	return example;
}

test('collection entries preserve own bullets when examples are appended and date errors focus the end month', async ({
	page
}) => {
	await reachExperience(page);
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	await page.getByLabel('Jenis pengalaman', { exact: true }).selectOption('parttime');
	await page.getByLabel('Posisi / peran', { exact: true }).fill('Asisten laboratorium');
	await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Laboratorium Kampus');
	await page.getByLabel('Lokasi', { exact: true }).fill('Bandung');
	const ownExperience = 'Mendampingi 30 mahasiswa mengolah data praktikum';
	const experienceExample = await appendOwnAndExampleBullet(page, ownExperience);
	const startDate = page.getByRole('group', { name: 'Tanggal mulai', exact: true });
	const endDate = page.getByRole('group', { name: 'Tanggal selesai', exact: true });
	await setMonth(startDate, '05', '2025');
	await setMonth(endDate, '04', '2024');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(stepHeading(page)).toHaveText('Pengalaman kerja / magang');
	await expect(endDate.getByLabel('Bulan', { exact: true })).toBeFocused();
	await expect(endDate.getByLabel('Bulan', { exact: true })).toHaveAttribute(
		'aria-invalid',
		'true'
	);
	await expect(endDate).toContainText('Tanggal selesai tidak boleh sebelum tanggal mulai.');
	await endDate.getByLabel('Tahun', { exact: true }).selectOption('2026');
	await advance(page, 'Organisasi & kepanitiaan');
	await page.getByRole('button', { name: 'Tambah Organisasi & kepanitiaan', exact: true }).click();
	await page.getByLabel('Nama', { exact: true }).fill('Himpunan Mahasiswa');
	await page.getByLabel('Posisi / peran', { exact: true }).fill('Sekretaris');
	await page.getByLabel('Sampai sekarang', { exact: true }).check();
	const ownOrganisation = 'Menyusun notulen 12 rapat dan mengelola arsip kegiatan';
	await appendOwnAndExampleBullet(page, ownOrganisation);
	await advance(page, 'Proyek');
	await page.getByRole('button', { name: 'Tambah Proyek', exact: true }).click();
	await page.getByLabel('Nama', { exact: true }).fill('Dashboard Laboratorium');
	await page.getByLabel('Posisi / peran', { exact: true }).fill('Pengembang');
	await page.getByLabel('URL', { exact: true }).fill('https://example.com/portofolio');
	const ownProject = 'Membangun dashboard untuk memantau 5 ruang praktikum';
	await appendOwnAndExampleBullet(page, ownProject);
	await advance(page, 'Keahlian & pencapaian');
	await advance(page, 'Ringkasan profil', true);
	await advance(page, 'Tinjau CV-mu', true);
	await expect(page.getByText('CV siap', { exact: true })).toBeVisible();
	const preview = page.getByTestId('cv-preview');
	for (const text of [ownExperience, experienceExample, ownOrganisation, ownProject, 'Sekarang'])
		await expect(preview).toContainText(text);
	await expect(
		preview.getByRole('link', { name: 'example.com/portofolio', exact: true })
	).toHaveAttribute('href', 'https://example.com/portofolio');
	await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
	await page.reload();
	await expect(stepHeading(page)).toHaveText('Tinjau CV-mu');
	await expect(page.getByTestId('cv-preview')).toContainText(ownProject);
});

test('skill Enter stays on the step and languages, certifications, and awards survive reload', async ({
	page
}) => {
	await reachExperience(page);
	await skipToSkills(page);
	await page.getByRole('textbox', { name: 'Keahlian teknis', exact: true }).fill('SQL');
	await page.getByRole('textbox', { name: 'Keahlian teknis', exact: true }).press('Enter');
	await expect(stepHeading(page)).toHaveText('Keahlian & pencapaian');
	await expect(page.getByRole('region', { name: 'Keahlian teknis', exact: true })).toContainText(
		'SQL'
	);
	await page.getByRole('textbox', { name: 'Soft skill', exact: true }).fill('Komunikasi');
	await page.getByRole('textbox', { name: 'Soft skill', exact: true }).press('Enter');
	await page.getByRole('textbox', { name: 'Tools & software', exact: true }).fill('Excel');
	await page.getByRole('textbox', { name: 'Tools & software', exact: true }).press('Enter');
	await page.getByRole('button', { name: 'Tambah Bahasa', exact: true }).click();
	const language = page.getByRole('region', { name: 'Bahasa', exact: true });
	await language.getByLabel('Nama', { exact: true }).fill('Bahasa Inggris');
	await language.getByLabel('Tingkat kemampuan', { exact: true }).selectOption('professional');
	await language.getByLabel('Skor tes / keterangan', { exact: true }).fill('TOEFL ITP 550');
	await page.getByRole('button', { name: 'Tambah Sertifikasi & pelatihan', exact: true }).click();
	const certification = page.getByRole('region', { name: 'Sertifikasi & pelatihan', exact: true });
	await certification.getByLabel('Nama', { exact: true }).fill('Analisis Data Dasar');
	await certification
		.getByLabel('Penerbit / penyelenggara', { exact: true })
		.fill('Lembaga Pelatihan');
	await setMonth(certification.getByRole('group', { name: 'Tanggal', exact: true }), '06', '2025');
	await certification
		.getByLabel('URL sertifikat', { exact: true })
		.fill('https://example.com/sertifikat');
	await page.getByRole('button', { name: 'Tambah Prestasi & penghargaan', exact: true }).click();
	const award = page.getByRole('region', { name: 'Prestasi & penghargaan', exact: true });
	await award.getByLabel('Judul prestasi', { exact: true }).fill('Juara 2 Analisis Data');
	await award.getByLabel('Penerbit / penyelenggara', { exact: true }).fill('Universitas Nusantara');
	await setMonth(award.getByRole('group', { name: 'Tanggal', exact: true }), '02', '2024');
	await award.getByLabel('Deskripsi', { exact: true }).fill('Kompetisi tingkat universitas');
	await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
	await page.reload();
	await expect(stepHeading(page)).toHaveText('Keahlian & pencapaian');
	for (const label of ['SQL', 'Komunikasi', 'Excel'])
		await expect(page.getByRole('button', { name: `Hapus ${label}`, exact: true })).toBeVisible();
	await expect(language.getByLabel('Nama', { exact: true })).toHaveValue('Bahasa Inggris');
	await expect(language.getByLabel('Tingkat kemampuan', { exact: true })).toHaveValue(
		'professional'
	);
	await expect(language.getByLabel('Skor tes / keterangan', { exact: true })).toHaveValue(
		'TOEFL ITP 550'
	);
	await expect(certification.getByLabel('Nama', { exact: true })).toHaveValue(
		'Analisis Data Dasar'
	);
	await expect(certification.getByLabel('URL sertifikat', { exact: true })).toHaveValue(
		'https://example.com/sertifikat'
	);
	await expect(
		certification
			.getByRole('group', { name: 'Tanggal', exact: true })
			.getByLabel('Bulan', { exact: true })
	).toHaveValue('06');
	await expect(award.getByLabel('Judul prestasi', { exact: true })).toHaveValue(
		'Juara 2 Analisis Data'
	);
	await expect(award.getByLabel('Deskripsi', { exact: true })).toHaveValue(
		'Kompetisi tingkat universitas'
	);
	await page.getByRole('button', { name: 'Hapus SQL', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Hapus SQL', exact: true })).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Keahlian teknis', exact: true })).toBeFocused();
});

test('summary replacement can be cancelled, confirmed, and undone', async ({ page }) => {
	await reachExperience(page);
	await skipToSkills(page);
	await advance(page, 'Ringkasan profil', true);
	const summary = page.getByLabel('Ringkasan profil', { exact: true });
	const ownSummary = 'Lulusan baru dengan pengalaman proyek analisis data dan organisasi kampus.';
	await summary.fill(ownSummary);
	// A separate field edit creates a clear history boundary before replacing the summary.
	await page.getByRole('button', { name: 'Kembali', exact: true }).click();
	await page.getByRole('textbox', { name: 'Keahlian teknis', exact: true }).fill('Analisis data');
	await page.getByRole('textbox', { name: 'Keahlian teknis', exact: true }).press('Enter');
	await advance(page, 'Ringkasan profil');
	await page
		.locator('details')
		.filter({ has: page.locator('summary').filter({ hasText: /^Contoh untuk inspirasi$/ }) })
		.locator('summary')
		.click();
	const firstExample = page.locator('.examples article').first();
	const exampleText = await firstExample.locator('p').innerText();
	await firstExample.getByRole('button', { name: 'Pakai sebagai awal', exact: true }).click();
	const confirmation = page.getByRole('dialog', {
		name: 'Ganti ringkasanmu dengan contoh?',
		exact: true
	});
	await expect(confirmation).toBeVisible();
	await confirmation.getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(summary).toHaveValue(ownSummary);
	await firstExample.getByRole('button', { name: 'Pakai sebagai awal', exact: true }).click();
	await confirmation.getByRole('button', { name: 'Ganti ringkasan', exact: true }).click();
	await expect(summary).toHaveValue(exampleText);
	await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(summary).toHaveValue(ownSummary);
	await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
});

test('two tabs can reload an external update or explicitly keep their local version', async ({
	page,
	context
}) => {
	await start(page);
	await page.getByLabel('Judul CV', { exact: true }).fill('CV versi awal');
	await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
	const other = await context.newPage();
	try {
		await other.goto(page.url());
		await expect(other.getByLabel('Judul CV', { exact: true })).toHaveValue('CV versi awal');
		await page.getByLabel('Judul CV', { exact: true }).fill('CV diperbarui tab pertama');
		await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
		await expect(other.getByText('CV ini diubah di tab lain.', { exact: true })).toBeVisible();
		await other.getByRole('button', { name: 'Muat versi terbaru', exact: true }).click();
		await expect(other.getByLabel('Judul CV', { exact: true })).toHaveValue(
			'CV diperbarui tab pertama'
		);
		await expect(other.getByText('CV ini diubah di tab lain.', { exact: true })).toHaveCount(0);
		await other.getByLabel('Posisi yang dituju', { exact: true }).fill('Data Analyst');
		await expect(saveStatus(other)).toHaveText('Tersimpan di perangkat ini ✓');
		await expect(page.getByText('CV ini diubah di tab lain.', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Posisi yang dituju', { exact: true })).toHaveValue('');
		await page.getByRole('button', { name: 'Pakai versi ini', exact: true }).click();
		await expect(page.getByText('CV ini diubah di tab lain.', { exact: true })).toHaveCount(0);
		await expect(saveStatus(page)).toHaveText('Tersimpan di perangkat ini ✓');
		await other.reload();
		await expect(other.getByLabel('Posisi yang dituju', { exact: true })).toHaveValue('');
		await expect(other.getByLabel('Judul CV', { exact: true })).toHaveValue(
			'CV diperbarui tab pertama'
		);
	} finally {
		await other.close();
	}
});
