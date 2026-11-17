import { expect, test, type Page, type Route } from '@playwright/test';

const cvTitle = 'CV Dibagikan';
const fullName = 'Nadia Berbagi';
const email = 'nadia.berbagi@example.com';
const phone = '081234567890';

interface Api {
	user: Record<string, unknown> | null;
	providers: { google: boolean; password: boolean };
	saved: Record<string, unknown>[];
	shares: Record<string, unknown>[];
	publicShare?: Record<string, unknown>;
	publicPassword?: string;
}

async function mockApi(page: Page, api: Api) {
	await page.route('**/api/hello', (route) => route.fulfill({ json: { visitors: 1, online: 1 } }));
	await page.route('**/api/auth/**', async (route: Route) => {
		const url = new URL(route.request().url());
		const method = route.request().method();
		if (url.pathname === '/api/auth/me')
			return route.fulfill({ json: { user: api.user, providers: api.providers } });
		if (url.pathname === '/api/auth/register' && method === 'POST') {
			const body = route.request().postDataJSON() as { email: string; name: string };
			api.user = {
				id: 'u1',
				email: body.email,
				name: body.name,
				verified: false,
				hasPassword: true,
				google: false
			};
			return route.fulfill({ json: { user: api.user } });
		}
		return route.fulfill({ status: 404, json: { error: 'notFound' } });
	});
	await page.route('**/api/shares**', async (route: Route) => {
		const method = route.request().method();
		if (method === 'GET') return route.fulfill({ json: { shares: api.shares } });
		if (method === 'PUT') {
			const body = route.request().postDataJSON() as Record<string, unknown>;
			api.saved.push(body);
			const info = {
				cvId: new URL(route.request().url()).pathname.split('/').at(-1),
				slug: 'k7f2q9abcd23',
				access: body.access,
				discoverable: body.discoverable,
				settings: body.settings,
				hasPassword: false,
				expiresAt: null,
				viewCount: 0,
				updatedAt: new Date().toISOString()
			};
			api.shares = [info];
			return route.fulfill({ json: info });
		}
		return route.fulfill({ status: 404, json: { error: 'notFound' } });
	});
	await page.route('**/api/s/**', async (route: Route) => {
		const request = route.request();
		if (!api.publicShare) return route.fulfill({ status: 404, json: { error: 'notFound' } });
		if (api.publicPassword) {
			const given =
				request.method() === 'POST'
					? (request.postDataJSON() as { password?: string }).password
					: undefined;
			if (given !== api.publicPassword)
				return route.fulfill({ status: 401, json: { error: 'password' } });
		}
		return route.fulfill({ json: api.publicShare });
	});
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

// The CV is created through normal controls; no repository imports or direct IndexedDB seed.
async function createCv(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await page.getByLabel(/^Email\b/).fill(email);
	await page.getByLabel(/^Nomor HP\b/).fill(phone);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await school.fill('Kampus Berbagi');
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
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

const verifiedUser = {
	id: 'u1',
	email: 'nadia@example.com',
	name: 'Nadia',
	verified: true,
	hasPassword: false,
	google: true
};

test('without login settings on the server, sign-in says it is not available', async ({ page }) => {
	await mockApi(page, {
		user: null,
		providers: { google: false, password: false },
		saved: [],
		shares: []
	});
	await page.goto('/masuk');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Masuk ke CV Maker');
	await expect(page.getByText('Login belum tersedia. Coba lagi nanti.')).toBeVisible();
});

test('a visitor registers with email and lands on "CV Saya" signed in', async ({ page }) => {
	const api: Api = {
		user: null,
		providers: { google: true, password: true },
		saved: [],
		shares: []
	};
	await mockApi(page, api);
	await page.goto('/masuk?next=%2Fcv');
	const google = page.getByRole('link', { name: 'Masuk dengan Google' });
	await expect(google).toHaveAttribute('href', '/api/auth/google?next=%2Fcv');
	await page.getByRole('button', { name: 'Daftar', exact: true }).click();
	await page.getByLabel('Nama (opsional)').fill('Nadia');
	await page.getByLabel(/^Email/).fill('nadia@example.com');
	await page.getByLabel(/^Kata sandi/).fill('rahasia-panjang-1');
	await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await page.locator('details.app-menu summary').click();
	await expect(page.getByRole('link', { name: 'Akun', exact: true })).toHaveAttribute(
		'href',
		'/akun'
	);
});

test('sharing from the editor uploads only what the user chose to show', async ({
	page
}, testInfo) => {
	const api: Api = {
		user: verifiedUser,
		providers: { google: true, password: false },
		saved: [],
		shares: []
	};
	await mockApi(page, api);
	const id = await createCv(page);
	await page.goto(`/cv/${id}/edit`);
	await page.getByRole('button', { name: 'Bagikan', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Bagikan CV' });
	const panel = dialog.getByTestId('share-panel');
	await expect(panel.getByRole('radio', { name: /Siapa saja yang punya link/ })).toBeChecked();
	// Safe defaults: contact details off, with a warning.
	await expect(panel.getByRole('switch', { name: 'Nomor HP' })).toHaveAttribute(
		'aria-checked',
		'false'
	);
	await expect(panel.getByText(/Recruiter tidak bisa menghubungimu/)).toBeVisible();
	await panel.getByRole('switch', { name: 'Email' }).click();
	await expect(panel.getByText(/Recruiter tidak bisa menghubungimu/)).toHaveCount(0);
	await page.screenshot({ path: testInfo.outputPath('share-dialog.png') });
	await panel.getByRole('button', { name: 'Simpan & bagikan', exact: true }).click();

	await expect(panel.getByLabel('Link CV')).toHaveValue(/\/u\/k7f2q9abcd23$/);
	expect(api.saved).toHaveLength(1);
	const body = api.saved[0] as {
		access: string;
		settings: { showEmail: boolean; showPhone: boolean };
		snapshot: { personal: { phone: string; email: string; fullName: string }; letters?: unknown };
		photo: unknown;
	};
	expect(body.access).toBe('link');
	expect(body.settings).toMatchObject({ showEmail: true, showPhone: false });
	expect(body.snapshot.personal.fullName).toBe(fullName);
	expect(body.snapshot.personal.email).toBe(email);
	expect(body.snapshot.personal.phone).toBe('');
	expect(body.snapshot.letters).toBeUndefined();
	expect(body.photo).toBeNull();
});

test('signed-out users are asked to sign in before sharing', async ({ page }) => {
	await mockApi(page, {
		user: null,
		providers: { google: true, password: false },
		saved: [],
		shares: []
	});
	const id = await createCv(page);
	await page.goto(`/cv/${id}/edit`);
	await page.getByRole('button', { name: 'Bagikan', exact: true }).click();
	const link = page.getByRole('link', { name: 'Masuk untuk membagikan', exact: true });
	await expect(link).toHaveAttribute('href', `/masuk?next=${encodeURIComponent(`/cv/${id}/edit`)}`);
});

test('the shared page shows the CV, asks for a password, and handles missing links', async ({
	page
}, testInfo) => {
	const api: Api = {
		user: null,
		providers: { google: false, password: false },
		saved: [],
		shares: []
	};
	await mockApi(page, api);

	await page.goto('/u/tidak-ada-link');
	await expect(page.getByRole('heading', { name: 'Link tidak tersedia' })).toBeVisible();

	const id = await createCv(page);
	// Build a realistic snapshot from the real CV through the export of the app: reuse the editor data.
	const snapshot = await page.evaluate(async (cvId) => {
		const request = indexedDB.open('cvmaker');
		const db: IDBDatabase = await new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const cv = await new Promise<Record<string, unknown>>((resolve) => {
			const get = db.transaction('cvs').objectStore('cvs').get(cvId);
			get.onsuccess = () => resolve(get.result as Record<string, unknown>);
		});
		db.close();
		const personal = { ...(cv.personal as Record<string, unknown>), phone: '', email: '' };
		return { ...cv, personal };
	}, id);
	api.publicShare = { snapshot, photo: null, allowDownload: true, discoverable: false };
	api.publicPassword = 'rahasia';

	await page.goto('/u/k7f2q9abcd23');
	await expect(page.getByRole('heading', { name: 'CV ini dilindungi sandi' })).toBeVisible();
	await page.getByLabel('Sandi').fill('salah');
	await page.getByRole('button', { name: 'Buka CV', exact: true }).click();
	await expect(page.getByText('Sandi salah.')).toBeVisible();
	await page.getByLabel('Sandi').fill('rahasia');
	await page.getByRole('button', { name: 'Buka CV', exact: true }).click();

	const paper = page.getByTestId('shared-paper');
	await expect(paper).toContainText(fullName);
	await expect(paper).not.toContainText(phone);
	await expect(page.getByRole('button', { name: 'Unduh PDF', exact: true })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	await page.screenshot({ path: testInfo.outputPath('shared-page.png') });

	await page.getByRole('button', { name: 'Laporkan', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Laporkan CV ini' })).toBeVisible();
});
