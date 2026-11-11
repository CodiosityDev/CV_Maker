import { expect, test, type Page } from '@playwright/test';

/** Every link in the open menu must be the topmost element where it is drawn (not covered). */
async function expectMenuOnTop(page: Page) {
	const covered = await page.evaluate(() => {
		const nav = document.querySelector('.app-menu[open] nav');
		if (!nav) return ['menu not open'];
		return Array.from(nav.querySelectorAll('a')).flatMap((link) => {
			const box = link.getBoundingClientRect();
			const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
			return hit && link.contains(hit) ? [] : [link.textContent?.trim() ?? '?'];
		});
	});
	expect(covered).toEqual([]);
}

test('the app menu stays above the sticky CV preview in the wizard', async ({ page }) => {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Menu');
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	await page.locator('.app-menu summary').click();
	await expect(page.locator('.app-menu nav')).toBeVisible();
	await expectMenuOnTop(page);
});
