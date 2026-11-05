import { expect, test } from '@playwright/test';

test('wizard progress stays on one row with its accessible value at every viewport', async ({
	page
}) => {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByLabel('Nama lengkap').fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('alya@example.com');
	await page.getByLabel('Nomor HP').fill('081234567890');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page.getByLabel('Nama sekolah / kampus').fill('Universitas Contoh');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Pengalaman kerja / magang');
	const progress = page.getByRole('progressbar', { name: 'Langkah pembuatan CV', exact: true });
	await expect(page.locator('.stepper button, .stepper a')).toHaveCount(0);
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await expect(progress).toHaveAttribute('aria-valuenow', '4');
		await expect(progress).toHaveAttribute('aria-valuemin', '0');
		await expect(progress).toHaveAttribute('aria-valuemax', '10');
		await expect(progress).toHaveAttribute(
			'aria-valuetext',
			'Langkah 4 dari 10 · Pengalaman kerja / magang'
		);
		await expect(page.locator('.stepper [aria-current="step"]')).toHaveCount(1);
		await expect(page.locator('.stepper [aria-current="step"]')).toHaveAttribute(
			'aria-label',
			/Pengalaman/
		);
		const geometry = await page.locator('.progress-row').evaluate((row) => {
			const label = row.querySelector<HTMLElement>('.progress-label')!;
			const track = row.querySelector<HTMLElement>('[role="progressbar"]')!;
			const a = label.getBoundingClientRect();
			const b = track.getBoundingClientRect();
			return {
				labelHeight: a.height,
				lineHeight: parseFloat(getComputedStyle(label).lineHeight),
				centerDifference: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
				barWidth: b.width,
				overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
			};
		});
		expect(
			geometry.labelHeight,
			`${width}px: progress label must stay on one line`
		).toBeLessThanOrEqual(geometry.lineHeight + 1);
		expect(
			geometry.centerDifference,
			`${width}px: label and progress share a row`
		).toBeLessThanOrEqual(1);
		expect(geometry.barWidth, `${width}px: progress remains visible`).toBeGreaterThanOrEqual(32);
		expect(geometry.overflow, `${width}px: no horizontal scrolling`).toBe(0);
	}
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const englishTitle = await page.locator('.step-heading h1').innerText();
	expect(await page.getByRole('progressbar').getAttribute('aria-valuetext')).toContain(
		englishTitle
	);
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
	await expect(page.getByLabel('School / university')).toHaveValue('Universitas Contoh');
});

test('desktop site header shares one row from 1024px and keeps a logical focus sequence', async ({
	page
}) => {
	await page.goto('/');
	for (const width of [1024, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		const centers = await page
			.locator('header .brand, header nav, header .language-switcher, header .header-cta')
			.evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return rect.y + rect.height / 2;
				})
			);
		expect(centers).toHaveLength(4);
		expect(
			Math.max(...centers) - Math.min(...centers),
			`${width}px: logo, navigation, language and CTA share one row`
		).toBeLessThanOrEqual(1);
	}
	const logo = page.locator('header .brand');
	await logo.focus();
	for (const link of await page.locator('header nav a').all()) {
		await page.keyboard.press('Tab');
		await expect(link).toBeFocused();
	}
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Bahasa Indonesia', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'English', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('header .header-cta')).toBeFocused();
});
