import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';

async function completeCv(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	const heading = page.locator('.step-heading h1');
	await expect(heading).toHaveText('Bahasa & posisi tujuan');
	await page
		.getByRole('combobox', { name: 'Posisi yang dituju', exact: true })
		.fill('Junior Web Developer');
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Alya — Web Developer');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(heading).toHaveText('Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('alya.putri@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(heading).toHaveText('Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await page.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
	await page.getByRole('combobox', { name: 'Jurusan', exact: true }).fill('Teknik Informatika');
	const start = page.getByRole('group', { name: 'Mulai', exact: true });
	await start.getByLabel('Bulan', { exact: true }).selectOption('09');
	await start.getByLabel('Tahun', { exact: true }).selectOption('2020');
	const end = page.getByRole('group', { name: 'Selesai', exact: true });
	await end.getByLabel('Bulan', { exact: true }).selectOption('07');
	await end.getByLabel('Tahun', { exact: true }).selectOption('2024');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	for (const title of [
		'Pengalaman kerja / magang',
		'Organisasi & kepanitiaan',
		'Proyek',
		'Keahlian & pencapaian'
	]) {
		await expect(heading).toHaveText(title);
		await page.getByRole('button', { name: 'Lewati', exact: true }).click();
	}
	await expect(heading).toHaveText('Ringkasan profil');
	await page
		.getByLabel('Ringkasan profil', { exact: true })
		.fill(
			'Lulusan Teknik Informatika yang menguasai TypeScript dan SQL. Siap berkontribusi sebagai Junior Web Developer.'
		);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(heading).toHaveText('Tinjau CV-mu');
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(heading).toHaveText('CV-mu tersimpan');
	await expect(page.getByTestId('export-panel')).toBeVisible();
}

async function bytes(download: Download) {
	expect(await download.failure()).toBeNull();
	const path = await download.path();
	expect(path).toBeTruthy();
	return readFile(path!);
}

test('done offers real Word and text downloads and copies CV text', async ({
	page,
	context,
	browserName
}) => {
	await completeCv(page);
	const panel = page.getByTestId('export-panel');
	await expect(panel.getByRole('heading', { name: 'Unduh CV', exact: true })).toBeVisible();
	await expect(panel.getByRole('link', { name: 'PDF untuk melamar', exact: true })).toBeVisible();
	await expect(panel).toContainText('PDF ini berisi teks asli sehingga terbaca ATS.');

	const wordEvent = page.waitForEvent('download');
	await panel.getByRole('button', { name: 'Word (.docx)', exact: true }).click();
	const word = await wordEvent;
	expect(word.suggestedFilename()).toBe('CV_Alya_Putri_Junior_Web_Developer.docx');
	const wordBytes = await bytes(word);
	expect(wordBytes.byteLength).toBeGreaterThan(0);
	expect(wordBytes.subarray(0, 2).toString()).toBe('PK');

	const textEvent = page.waitForEvent('download');
	await panel.getByRole('button', { name: 'Teks (.txt)', exact: true }).click();
	const text = await textEvent;
	expect(text.suggestedFilename()).toBe('CV_Alya_Putri_Junior_Web_Developer.txt');
	const textBytes = await bytes(text);
	expect(textBytes.byteLength).toBeGreaterThan(0);
	expect(textBytes.toString('utf8')).toContain('ALYA PUTRI');
	expect(textBytes.toString('utf8')).toContain('Universitas Contoh');

	if (browserName === 'chromium') {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await panel.getByRole('button', { name: 'Salin teks', exact: true }).click();
		await expect(page.getByRole('status', { name: 'Notifikasi', exact: true })).toContainText(
			'Teks disalin'
		);
		expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('ALYA PUTRI');
	} else {
		await page.evaluate(() =>
			Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
		);
		await panel.getByRole('button', { name: 'Salin teks', exact: true }).click();
		await expect(panel.getByLabel('Teks CV untuk disalin', { exact: true })).toHaveValue(
			/Alya Putri/i
		);
	}
});

test('clipboard denial has a selectable fallback and PDF page prints only the CV', async ({
	page
}, testInfo) => {
	await completeCv(page);
	const panel = page.getByTestId('export-panel');
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: () =>
					Promise.reject(new DOMException('Clipboard permission denied', 'NotAllowedError'))
			}
		});
	});
	await panel.getByRole('button', { name: 'Salin teks', exact: true }).click();
	const fallback = panel.getByLabel('Teks CV untuk disalin', { exact: true });
	await expect(fallback).toHaveValue(/Alya Putri/i);
	await expect(fallback).toHaveAttribute('readonly', '');
	await expect(fallback).toBeFocused();
	await panel.getByRole('button', { name: 'Pilih semua teks', exact: true }).click();
	expect(
		await fallback.evaluate((element) => {
			const field = element as HTMLTextAreaElement;
			return { start: field.selectionStart, end: field.selectionEnd, length: field.value.length };
		})
	).toEqual({
		start: 0,
		end: (await fallback.inputValue()).length,
		length: (await fallback.inputValue()).length
	});

	await panel.getByRole('link', { name: 'PDF untuk melamar', exact: true }).click();
	await expect(page).toHaveURL(/\/cv\/[a-f\d-]+\/print$/);
	const paper = page.getByTestId('print-paper');
	await expect(paper.getByRole('heading', { name: 'Alya Putri', exact: true })).toBeVisible();
	await expect(paper).toContainText('Universitas Contoh');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		)
	).toBeLessThanOrEqual(0);
	const toolbar = page.getByTestId('print-toolbar');
	await expect(toolbar).toBeVisible();
	await expect(page.locator('.app-header')).toBeVisible();
	await page.getByText('Cara menyimpan sebagai PDF', { exact: true }).click();
	await expect(
		page.locator('.print-guide dt').filter({ hasText: /Android.*Chrome/ })
	).toBeVisible();

	const originalTitle = await page.title();
	await page.evaluate(() => {
		document.documentElement.dataset.printCalls = '0';
		window.print = () => {
			document.documentElement.dataset.printCalls = String(
				Number(document.documentElement.dataset.printCalls) + 1
			);
			document.documentElement.dataset.printTitle = document.title;
		};
	});
	await toolbar.getByRole('button', { name: 'Simpan sebagai PDF', exact: true }).click();
	expect(await page.evaluate(() => document.documentElement.dataset.printCalls)).toBe('1');
	expect(await page.evaluate(() => document.documentElement.dataset.printTitle)).toBe(
		'CV_Alya_Putri_Junior_Web_Developer'
	);
	await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
	await expect(page).toHaveTitle(originalTitle);

	await page.emulateMedia({ media: 'print' });
	await expect(page.locator('.app-header')).not.toBeVisible();
	await expect(toolbar).not.toBeVisible();
	await expect(page.locator('.print-guide')).not.toBeVisible();
	await expect(paper).toBeVisible();
	expect(await paper.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
	if (testInfo.project.name === 'desktop-1280') {
		const pdf = await page.pdf({
			path: testInfo.outputPath('cv.pdf'),
			format: 'A4',
			preferCSSPageSize: true,
			printBackground: true,
			displayHeaderFooter: false
		});
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(pdf.byteLength).toBeGreaterThan(1_000);
	}
});

test('missing print CV explains the problem and returns to My CVs', async ({ page }) => {
	await page.goto('/cv/id-tidak-ada/print');
	await expect(
		page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
	).toBeVisible();
	await expect(page.getByTestId('print-paper')).toHaveCount(0);
	await page.getByRole('link', { name: 'Kembali ke CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(page.getByRole('heading', { level: 1, name: 'CV Saya', exact: true })).toBeVisible();
});
