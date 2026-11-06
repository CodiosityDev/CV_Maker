import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('late suggestion data refreshes an unchanged query after its debounce', async ({ page }) => {
	const manifest = JSON.parse(
		await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8')
	) as Record<string, { file: string }>;
	const chunk = manifest['src/lib/core/suggest/data/en.ts']?.file;
	expect(chunk, 'The English suggestion data must have its own lazy chunk').toBeTruthy();
	let release: () => void = () => {};
	const pendingData = new Promise<void>((resolve) => {
		release = resolve;
	});
	let requested: () => void = () => {};
	const dataRequested = new Promise<void>((resolve) => {
		requested = resolve;
	});
	await page.route(`**/${chunk}`, async (route) => {
		requested();
		await pendingData;
		await route.continue();
	});
	try {
		await page.clock.install();
		await page.goto('/buat');
		await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
		await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
		await page.locator('#locale').selectOption('en');
		await dataRequested;
		const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
		await target.fill('nurs');
		// Consume the real input debounce while the data request is still held back.
		await page.clock.runFor(400);
		await expect(target).toHaveValue('nurs');
		await expect(page.getByRole('option', { name: 'Nurse', exact: true })).toHaveCount(0);
		release();
		await page.clock.resume();
		// No further typing or focus change: the newly loaded provider data must refresh the list.
		const nurse = page.getByRole('option', { name: 'Nurse', exact: true });
		await expect(nurse).toBeVisible();
		await expect(target).toHaveValue('nurs');
		await target.press('ArrowDown');
		await expect(nurse).toHaveAttribute('aria-selected', 'true');
		await target.press('Enter');
		await expect(target).toHaveValue('Nurse');
	} finally {
		release();
		await page.unrouteAll({ behavior: 'wait' });
	}
});
