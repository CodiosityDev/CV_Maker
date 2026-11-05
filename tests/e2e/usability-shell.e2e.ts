import { expect, test, type Page } from '@playwright/test';

async function personal(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByLabel('Nama lengkap').fill('Alya Putri');
	await page.getByLabel('Email', { exact: false }).fill('alya@example.com');
	await page.getByLabel('Nomor HP').fill('081234567890');
}

async function assertBar(page: Page, width: number) {
	await page.setViewportSize({ width, height: 780 });
	const bar = page.locator('.bottom-actions');
	const geometry = await bar.evaluate((element) => {
		const buttons = [...element.querySelectorAll('button')].map((button) => {
			const rect = button.getBoundingClientRect();
			return {
				center: rect.y + rect.height / 2,
				width: rect.width,
				height: rect.height,
				wraps: getComputedStyle(button).whiteSpace !== 'nowrap'
			};
		});
		return {
			height: element.getBoundingClientRect().height,
			buttons,
			overflow: document.documentElement.scrollWidth - innerWidth
		};
	});
	expect(geometry.height).toBeLessThanOrEqual(64);
	expect(geometry.overflow).toBe(0);
	const centers = geometry.buttons.map((button) => button.center);
	expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
	for (const button of geometry.buttons) {
		expect(button.width).toBeGreaterThanOrEqual(44);
		expect(button.height).toBeGreaterThanOrEqual(44);
		expect(button.wraps).toBe(false);
	}
}

test('counters appear at 80 percent and keep descriptions linked for inputs and textareas', async ({
	page
}) => {
	await personal(page);
	const name = page.getByLabel('Nama lengkap');
	await expect(page.locator('.counter')).toHaveCount(0);
	await name.fill('A'.repeat(79));
	await expect(page.locator('[id="personal.fullName-count"]')).toHaveCount(0);
	await name.fill('A'.repeat(80));
	await expect(page.locator('[id="personal.fullName-count"]')).toHaveText('80/100');
	await expect(name).toHaveAttribute('aria-describedby', /personal\.fullName-count/);
	await name.fill('Alya Putri');
	await expect(name).not.toHaveAttribute('aria-describedby', /-count/);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const thesis = page.getByLabel('Judul skripsi / tugas akhir', { exact: true });
	const limit = Number(await thesis.getAttribute('maxlength'));
	await thesis.fill('a'.repeat(Math.ceil(limit * 0.8) - 1));
	await expect(thesis.locator('..').locator('.counter')).toHaveCount(0);
	await thesis.fill('a'.repeat(Math.ceil(limit * 0.8)));
	const counter = thesis.locator('..').locator('.counter');
	await expect(counter).toBeVisible();
	await expect(thesis).toHaveAttribute('aria-describedby', (await counter.getAttribute('id'))!);
});

test('mobile actions stay in one 64px row for required optional and review steps in both languages', async ({
	page
}) => {
	await personal(page);
	for (const width of [320, 360]) await assertBar(page, width);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Contoh');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	for (const width of [320, 360]) {
		await assertBar(page, width);
		await expect(page.locator('.bottom-actions button')).toHaveCount(4);
	}
	await page.getByRole('button', { name: 'English', exact: true }).click();
	for (const width of [320, 360]) await assertBar(page, width);
	for (let step = 4; step <= 8; step++)
		await page.getByRole('button', { name: 'Skip', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Review your CV');
	await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
	for (const width of [320, 360]) await assertBar(page, width);
	await page.getByRole('button', { name: 'Bahasa Indonesia', exact: true }).click();
	for (const width of [320, 360]) await assertBar(page, width);
});

test('app header fits one row and its menu supports keyboard Escape and outside dismissal', async ({
	page
}) => {
	await page.goto('/buat');
	const menu = page.locator('.app-menu > summary');
	await expect(menu).toBeVisible();
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 780 });
		const centers = await page
			.locator('.app-header .brand, .app-header .language-switcher, .app-header .app-menu')
			.evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return rect.y + rect.height / 2;
				})
			);
		expect(centers).toHaveLength(3);
		expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
	}
	await menu.focus();
	await menu.press('Enter');
	await expect(menu).toHaveAttribute('aria-expanded', 'true');
	await page.keyboard.press('Tab');
	await expect(page.locator('.app-header nav a').first()).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(menu).toBeFocused();
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	await menu.click();
	await page.locator('main h1').click();
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
});
