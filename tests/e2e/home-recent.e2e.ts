import { expect, test, type Page } from '@playwright/test';

const cvTitle = 'CV Magang Beranda';
const fullName = 'Nadia Beranda';

// The CV is created through normal controls; no repository imports or direct IndexedDB seed.
async function createCv(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

test('first visit: no CV strip and no database is created', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByTestId('home-recent')).toHaveCount(0);
	const names = await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name));
	expect(names).not.toContain('cvmaker');
});

test('returning visitor sees their CV as a paper preview and can hide it', async ({
	page
}, testInfo) => {
	const id = await createCv(page);
	await page.goto('/');

	const strip = page.getByTestId('home-recent');
	await expect(strip.getByRole('heading', { name: 'Lanjutkan CV-mu', level: 2 })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	const card = strip.getByTestId('home-recent-card');
	await expect(card).toHaveCount(1);
	await expect(card.getByText('Belum selesai', { exact: true })).toBeVisible();
	await expect(card.getByText(/Diedit/)).toBeVisible();
	// The thumbnail is the real template with the user's data, hidden from assistive tech.
	await expect(card.getByTestId('template-thumbnail')).toContainText(fullName);
	await expect(card.getByTestId('template-thumbnail')).toHaveAttribute('aria-hidden', 'true');
	await expect(strip.getByRole('link', { name: 'Buat CV baru', exact: true })).toHaveAttribute(
		'href',
		'/buat'
	);
	await expect(strip.getByRole('link', { name: 'Lihat semua CV', exact: true })).toHaveAttribute(
		'href',
		'/cv'
	);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	await page.screenshot({ path: testInfo.outputPath('home-recent.png'), fullPage: false });

	// The whole card opens the unfinished CV in the wizard.
	const link = card.getByRole('link', { name: cvTitle, exact: true });
	await expect(link).toHaveAttribute('href', `/buat/${id}`);
	await link.click();
	await expect(page).toHaveURL(new RegExp(`/buat/${id}$`));

	// Hide from the home page (shared computer), then turn it back on from "CV Saya".
	await page.goto('/');
	await strip.getByRole('button', { name: 'Sembunyikan dari beranda', exact: true }).click();
	await expect(strip).toHaveCount(0);
	const showAgain = page.getByRole('button', { name: 'Tampilkan lagi', exact: true });
	await expect(showAgain).toBeFocused();
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('home-recent')).toHaveCount(0);

	await page.goto('/cv');
	const toggle = page.getByRole('switch', { name: 'Tampilkan CV di beranda' });
	await expect(toggle).toHaveAttribute('aria-checked', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-checked', 'true');
	await page.goto('/');
	await expect(page.getByTestId('home-recent-card')).toHaveCount(1);
});

test('the strip follows the UI language', async ({ page }) => {
	await createCv(page);
	await page.goto('/');
	await expect(page.getByTestId('home-recent')).toBeVisible();
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Continue your CV', level: 2 })).toBeVisible();
	await expect(page.getByText('Not finished', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Continue your CV', level: 2 })).toBeVisible();
});

test('a CV can be deleted from the home page after confirming', async ({ page }, testInfo) => {
	await createCv(page);
	await page.goto('/');
	const card = page.getByTestId('home-recent-card');
	await expect(card).toHaveCount(1);
	const remove = card.getByRole('button', { name: `Hapus ${cvTitle}`, exact: true });
	await remove.click();
	const confirm = card.getByRole('group', { name: /Hapus CV ini\? Link yang pernah dibagikan/ });
	await expect(confirm).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('home-delete-confirm.png') });
	// Cancel keeps the CV and returns focus to the delete button.
	await confirm.getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(confirm).toHaveCount(0);
	await expect(remove).toBeFocused();
	await remove.click();
	await card.getByRole('button', { name: 'Hapus', exact: true }).click();
	await expect(page.getByText('CV dihapus.')).toBeVisible();
	// It was the only CV: the strip disappears and the landing page stays.
	await expect(page.getByTestId('home-recent')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.goto('/cv');
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
});
