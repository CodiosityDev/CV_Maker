import { expect, test } from '@playwright/test';

test('the chosen mark fits site and app headers and browser icons are served', async ({
	page,
	request
}) => {
	for (const route of ['/', '/buat']) {
		await page.goto(route);
		const header = page.locator(route === '/' ? '.site-header' : '.app-header');
		const brand = header.locator('a.brand');
		const mark = brand.locator('svg[data-logo="cv-maker"]');
		await expect(mark).toBeVisible();
		await expect(mark).toHaveAttribute('aria-hidden', 'true');
		await expect(brand).toHaveAccessibleName('Beranda');
		await expect(brand).toContainText('CV Maker');
		for (const width of [320, 360, 768, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await expect(mark).toBeVisible();
			const geometry = await header.evaluate((element) => {
				const brand = element.querySelector('.brand')!.getBoundingClientRect();
				const controls = [
					...element.querySelectorAll('.brand, .language-switcher, .incognito-toggle, .app-menu')
				].map((control) => control.getBoundingClientRect());
				return {
					overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
					brandWidth: brand.width,
					brandHeight: brand.height,
					centers: controls.map((control) => control.y + control.height / 2)
				};
			});
			expect(geometry.overflow, `${route} at ${width}px`).toBeLessThanOrEqual(0);
			expect(geometry.brandWidth).toBeGreaterThanOrEqual(44);
			expect(geometry.brandHeight).toBeGreaterThanOrEqual(44);
			if (route === '/buat') {
				expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThanOrEqual(
					1
				);
			}
		}
	}
	const favicon = await request.get('/favicon.svg');
	expect(favicon.status()).toBe(200);
	expect(favicon.headers()['content-type']).toContain('image/svg+xml');
	const iconLink = page.locator('link[rel="apple-touch-icon"]');
	const iconHref = await iconLink.getAttribute('href');
	expect(iconHref).not.toBeNull();
	const iconUrl = new URL(iconHref!, page.url());
	expect(iconUrl.origin).toBe(new URL(page.url()).origin);
	expect(iconUrl.pathname).toBe('/icons/apple-touch-icon.png');
	const appleIcon = await request.get(iconUrl.href);
	expect(appleIcon.status()).toBe(200);
	expect(appleIcon.headers()['content-type']).toContain('image/png');
	expect((await appleIcon.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
