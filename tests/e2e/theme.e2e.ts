import { expect, test, type Page } from '@playwright/test';

const themeButton = (page: Page) => page.getByTestId('theme-toggle');
const theme = (page: Page) => page.locator('html');

async function toggle(page: Page, value: 'dark' | 'light') {
	await themeButton(page).click();
	await expect(theme(page)).toHaveAttribute('data-theme', value);
	await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', value);
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

async function createReview(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Tema');
	await page.getByLabel(/^Email\b/).fill('nadia.tema@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await page.getByRole('button', { name: 'Tambah Tautan', exact: true }).click();
	await page.getByLabel('Nama tautan', { exact: true }).fill('LinkedIn');
	await page.getByLabel('URL', { exact: true }).fill('https://www.linkedin.com/in/nadia-tema');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await school.fill('Kampus Contoh');
	await school.press('Escape');
	await advance(page, 'Pengalaman kerja / magang');
	for (const title of [
		'Organisasi & kepanitiaan',
		'Proyek',
		'Keahlian & pencapaian',
		'Ringkasan profil',
		'Tinjau CV-mu'
	])
		await advance(page, title, true);
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function openIncognito(page: Page) {
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Nyalakan', exact: true })
		.click();
	await expect(
		page.locator('.app-header').getByRole('button', { name: 'Mode Incognito', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
}

async function endIncognito(page: Page) {
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Mode Incognito aktif', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
}

test('new visitors get dark even on a light system, and the explicit light choice survives reload', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	await expect(theme(page)).toHaveCSS('color-scheme', 'dark');
	await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#17152b');
	const bootstrap = page.locator('head script[src$="/theme-init.js"]');
	await expect(bootstrap).toHaveCount(1);
	expect(await bootstrap.getAttribute('defer')).toBeNull();
	expect(await bootstrap.getAttribute('async')).toBeNull();
	await expect(themeButton(page)).toHaveAccessibleName('Gunakan tema terang');
	await themeButton(page).focus();
	await page.keyboard.press('Enter');
	await expect(theme(page)).toHaveAttribute('data-theme', 'light');
	expect(await page.evaluate(() => localStorage.getItem('cvmaker.theme'))).toBe('light');
	await page.reload();
	await expect(theme(page)).toHaveAttribute('data-theme', 'light');
	await expect(theme(page)).toHaveCSS('color-scheme', 'light');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f2ff');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(themeButton(page)).toHaveAccessibleName('Use dark theme');
	await toggle(page, 'dark');
});

test('the synchronous bootstrap applies saved light before application hydration', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('cvmaker.theme', 'light'));
	// Keep the app entry from hydrating; the external head script must apply the preference itself.
	await page.route('**/_app/immutable/entry/**', (route) => route.abort());
	await page.goto('/');
	await expect(theme(page)).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
	await expect(theme(page)).toHaveCSS('background-color', 'rgb(243, 242, 255)');
});

test('blocked preference storage keeps the dark default and an in-memory theme switch usable', async ({
	page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('Blocked for this test', 'SecurityError');
			}
		});
	});
	await page.goto('/');
	await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	await toggle(page, 'light');
	await toggle(page, 'dark');
});

test('dark preview thumbnails editor paper and print output remain white', async ({ page }) => {
	const id = await createReview(page);
	await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByTestId('template-thumbnail').first()).toHaveCSS(
		'background-color',
		'rgb(255, 255, 255)'
	);
	await expect(page.getByTestId('cv-preview').locator('.paper')).toHaveCSS(
		'background-color',
		'rgb(255, 255, 255)'
	);
	await page.keyboard.press('Tab');
	const previewLink = page
		.getByTestId('cv-preview')
		.locator('a[href="https://www.linkedin.com/in/nadia-tema"]');
	await previewLink.focus();
	await expect(previewLink).toHaveCSS('outline-color', 'rgb(113, 102, 177)');
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await page.getByText('Ubah lagi', { exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
	await expect(page.getByTestId('cv-preview').locator('.paper')).toHaveCSS(
		'background-color',
		'rgb(255, 255, 255)'
	);
	await page.getByTestId('full-editor').getByRole('button', { name: 'Unduh', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Unduh', exact: true })
		.getByRole('link', { name: 'PDF untuk melamar', exact: true })
		.click();
	await expect(page.getByTestId('print-paper')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(page.getByTestId('print-paper')).toContainText('Nadia Tema');
	await page.keyboard.press('Tab');
	const printLink = page
		.getByTestId('print-paper')
		.locator('a[href="https://www.linkedin.com/in/nadia-tema"]');
	await printLink.focus();
	await expect(printLink).toHaveCSS('outline-color', 'rgb(113, 102, 177)');
	await page.emulateMedia({ media: 'print' });
	await expect(theme(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(theme(page)).toHaveCSS('color-scheme', 'light');
});

test('wiping all data removes the preference and resets the sender and another normal tab to dark', async ({
	page,
	context
}) => {
	await page.goto('/cv');
	await toggle(page, 'light');
	const other = await context.newPage();
	try {
		await other.goto('/buat');
		await expect(theme(other)).toHaveAttribute('data-theme', 'light');
		await page
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
		const confirmation = page.getByRole('dialog', { name: 'Hapus semua data?', exact: true });
		await confirmation.getByLabel('Kata konfirmasi', { exact: true }).fill('hapus ');
		await confirmation
			.getByRole('button', { name: 'Hapus semua data di perangkat ini', exact: true })
			.click();
		await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
		await expect(theme(other)).toHaveAttribute('data-theme', 'dark');
		expect(await page.evaluate(() => localStorage.getItem('cvmaker.theme'))).toBeNull();
		await page.reload();
		await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	} finally {
		await other.close();
	}
});

test('incognito theme choices never write storage and ending restores the normal preference', async ({
	page
}) => {
	await page.goto('/buat');
	await toggle(page, 'light');
	await openIncognito(page);
	await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	await page.evaluate(() => {
		const state = window as typeof window & { themeWrites?: string[] };
		state.themeWrites = [];
		const original = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'cvmaker.theme') state.themeWrites?.push(value);
			return original.call(this, key, value);
		};
	});
	await toggle(page, 'light');
	await toggle(page, 'dark');
	expect(
		await page.evaluate(() => (window as typeof window & { themeWrites?: string[] }).themeWrites)
	).toEqual([]);
	expect(await page.evaluate(() => localStorage.getItem('cvmaker.theme'))).toBe('light');
	await toggle(page, 'light');
	await page.reload();
	await expect(theme(page)).toHaveAttribute('data-theme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('cvmaker.theme'))).toBe('light');
	await endIncognito(page);
	await expect(theme(page)).toHaveAttribute('data-theme', 'light');
});

test('app header stays in one row with 44px controls at every reference width in both themes', async ({
	page
}) => {
	await page.goto('/buat');
	for (const privateMode of [false, true]) {
		if (privateMode) await openIncognito(page);
		for (const value of ['dark', 'light'] as const) {
			if ((await theme(page).getAttribute('data-theme')) !== value) await toggle(page, value);
			for (const width of [320, 360, 480, 600, 640, 768, 1280]) {
				await page.setViewportSize({ width, height: 900 });
				const layout = await page.locator('.header-inner').evaluate((header) => {
					const controls = [
						...header.querySelectorAll<HTMLElement>(
							'.brand, .language-switcher button, .incognito-toggle, .theme-toggle, .app-menu > summary'
						)
					].map((control) => {
						const box = control.getBoundingClientRect();
						return { width: box.width, height: box.height, center: box.y + box.height / 2 };
					});
					return {
						overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
						innerHeight: header.getBoundingClientRect().height,
						controls
					};
				});
				expect(
					layout.overflow,
					`${value} incognito=${privateMode} at ${width}px`
				).toBeLessThanOrEqual(0);
				expect(layout.innerHeight).toBeGreaterThanOrEqual(66);
				for (const control of layout.controls) {
					expect(control.width).toBeGreaterThanOrEqual(44);
					expect(control.height).toBeGreaterThanOrEqual(44);
				}
				expect(
					Math.max(...layout.controls.map((control) => control.center)) -
						Math.min(...layout.controls.map((control) => control.center))
				).toBeLessThanOrEqual(2);
			}
		}
	}
});
