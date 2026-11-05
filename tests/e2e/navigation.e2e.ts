import { expect, test } from '@playwright/test';

test('phone menu opens, closes with Escape, and closes after navigation', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 780 });
	await page.goto('/');
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	const controlled = await menu.getAttribute('aria-controls');
	expect(controlled).toBeTruthy();
	const navigation = page.locator(`[id="${controlled}"]`);
	await expect(navigation).not.toBeVisible();
	await menu.click();
	await expect(menu).toHaveAttribute('aria-expanded', 'true');
	await expect(navigation).toBeVisible();
	await expect(navigation.getByRole('link')).toHaveCount(5);
	expect(
		await navigation
			.getByRole('link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')))
	).toEqual(['/', '/buat', '/faq', '/tentang', 'https://codiosity.com']);
	await page.keyboard.press('Escape');
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	await expect(menu).toBeFocused();
	await expect(navigation).not.toBeVisible();
	await menu.press('Enter');
	await navigation.getByRole('link', { name: 'FAQ', exact: true }).click();
	await expect(page).toHaveURL(/\/faq$/);
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('FAQ');
});

test('site navigation marks only the current page and links to existing routes', async ({
	page
}) => {
	for (const path of ['/', '/faq', '/tentang']) {
		await page.goto(path);
		const menu = page.getByRole('button', { name: 'Menu', exact: true });
		if (await menu.isVisible()) await menu.click();
		const active = page.locator('header nav a[aria-current="page"]');
		await expect(active).toHaveCount(1);
		await expect(active).toHaveAttribute('href', path);
		await expect(page.locator('a[href="/cv"]')).toHaveCount(0);
	}
	await page.goto('/buat');
	await page.locator('.app-menu > summary').click();
	await expect(page.locator('header nav a[href="/"]')).toBeVisible();
	await expect(page.locator('header nav a[href="/faq"]')).toBeVisible();
	await expect(page.locator('a[href="/cv"]')).toHaveCount(0);
});

test('Codiosity attribution and external navigation have safe, explicit links', async ({
	page
}) => {
	for (const path of ['/', '/faq', '/tentang']) {
		await page.goto(path);
		const links = page.locator('a[href="https://codiosity.com"]');
		expect(await links.count()).toBeGreaterThanOrEqual(path === '/' ? 2 : 3);
		for (const link of await links.all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
			await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
		}
		const externalNav = page.locator('header nav a[href="https://codiosity.com"]');
		await expect(externalNav).toContainText('(membuka tab baru)');
		await expect(externalNav.locator('[aria-hidden="true"]')).toContainText('↗');
	}
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('header nav a[href="https://codiosity.com"]')).toContainText(
		'(opens in a new tab)'
	);
});
