import { expect, test } from '@playwright/test';

/**
 * Baseline guarantees for every content page:
 * - renders a visible <h1>
 * - no console errors (this also catches Content-Security-Policy violations)
 * - no horizontal scrolling at any tested viewport
 */
const CONTENT_PAGES = ['/'];

for (const path of CONTENT_PAGES) {
	test(`content page ${path} renders cleanly`, async ({ page }) => {
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
