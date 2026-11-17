import { expect, test } from '@playwright/test';

test('admin signs in by URL and blocks a reported link', async ({ page }) => {
	const state = { admin: false, blocked: false, posts: [] as string[] };
	await page.route('**/api/admin/**', async (route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();
		state.posts.push(`${method} ${url.pathname}`);
		if (url.pathname === '/api/admin/me') return route.fulfill({ json: { admin: state.admin } });
		if (url.pathname === '/api/admin/login') {
			const body = route.request().postDataJSON() as { password: string };
			if (body.password !== 'benar-sekali-123')
				return route.fulfill({ status: 401, json: { error: 'credentials' } });
			state.admin = true;
			return route.fulfill({ json: { ok: true } });
		}
		if (url.pathname === '/api/admin/reports')
			return route.fulfill({
				json: {
					reports: [
						{
							shareId: 'aaaaaaaaaaaaaaaaaaaaaa',
							slug: 'contoh-link',
							access: 'link',
							blocked: state.blocked,
							ownerEmail: 'pemilik@example.com',
							total: 2,
							reasons: { spam: 1, 'personal-data': 1 },
							lastAt: '2026-11-17T08:00:00.000Z'
						}
					]
				}
			});
		if (url.pathname.endsWith('/block')) {
			state.blocked = (route.request().postDataJSON() as { blocked: boolean }).blocked;
			return route.fulfill({ json: { ok: true } });
		}
		return route.fulfill({ status: 404, json: { error: 'notFound' } });
	});

	await page.goto('/admin');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
	await page.getByLabel(/^Username/).fill('cvadmin');
	await page.getByLabel(/^Kata sandi/).fill('salah');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await expect(page.getByText('Username atau kata sandi salah.')).toBeVisible();
	await page.getByLabel(/^Kata sandi/).fill('benar-sekali-123');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();

	await expect(page.getByRole('heading', { name: 'Laporan CV yang dibagikan' })).toBeVisible();
	await expect(page.getByRole('link', { name: '/u/contoh-link' })).toBeVisible();
	await expect(page.getByText('Spam atau iklan: 1')).toBeVisible();
	await expect(page.getByText('Pemilik: pemilik@example.com')).toBeVisible();
	await page.getByRole('button', { name: 'Blokir', exact: true }).click();
	await expect(page.getByText('Link diblokir.')).toBeVisible();
	await expect(page.getByText('Diblokir', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Buka blokir', exact: true })).toBeVisible();
});
