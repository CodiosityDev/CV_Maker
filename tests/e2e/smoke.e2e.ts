import { expect, test } from '@playwright/test';

/**
 * Baseline guarantees for every content page:
 * - renders a visible <h1>
 * - no console errors (this also catches Content-Security-Policy violations)
 * - no horizontal scrolling at any tested viewport
 */
const CONTENT_PAGES = ['/', '/faq', '/privasi', '/tentang'];

for (const path of CONTENT_PAGES) {
	test(`content page ${path} renders cleanly`, async ({ page }) => {
		// Preview has no API server; keep console and CSP checks strict.
		await page.route('**/api/hello', async (route) => {
			if (route.request().method() !== 'GET') return route.fallback();
			await route.fulfill({ status: 200, json: { visitors: 0 } });
		});

		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});
		page.on('pageerror', (err) => errors.push(err.message));

		await page.goto(path);
		await expect(page.locator('h1')).toBeVisible();
		await page.waitForLoadState('networkidle');

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
		expect(errors, 'console errors (incl. CSP violations)').toEqual([]);
	});
}
