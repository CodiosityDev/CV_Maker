import { expect, test, type Page } from '@playwright/test';

const banner = (page: Page) => page.getByRole('region', { name: 'Mode Incognito', exact: true });
const cards = (page: Page) => page.getByTestId('cv-card');
const saved = (page: Page) => page.getByTestId('save-status');
const headerControl = (page: Page, locale: 'id' | 'en' = 'id') =>
	page.locator('.app-header').getByRole('button', {
		name: locale === 'id' ? 'Mode Incognito' : 'Incognito Mode',
		exact: true
	});
const secretName = 'Rahasia Warnet';
const normalTitle = 'CV Normal Nadia';
const expiredMessage = 'CV di sesi incognito ini dihapus otomatis karena 3 jam tidak ada perubahan';

async function createPersonal(page: Page, title: string, kind: 'ats' | 'creative' = 'ats') {
	await page
		.getByRole('button', {
			name: kind === 'ats' ? 'Pilih CV ATS' : 'Pilih CV Creative',
			exact: true
		})
		.click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
}

async function createNormal(page: Page) {
	await page.goto('/buat');
	await createPersonal(page, normalTitle);
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Tersimpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	await page.goto('/buat');
	await expect(page.locator('.resume-card')).toHaveCount(1);
}

async function startIncognito(page: Page) {
	const control = headerControl(page);
	await expect(control).toHaveAttribute('aria-pressed', 'false');
	await control.click();
	const confirmation = page.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true });
	await expect(confirmation).toBeVisible();
	await expect(confirmation).toContainText('hilang saat tab ditutup atau di-refresh');
	await expect(confirmation).toContainText('Ctrl+Shift+N');
	await confirmation.getByRole('button', { name: 'Nyalakan', exact: true }).click();
	await expect(confirmation).not.toBeVisible();
	await expect(control).toHaveAttribute('aria-pressed', 'true');
	await expect(banner(page)).toBeVisible();
	await expect(banner(page)).toContainText('Mode Incognito aktif');
	await expect(page.locator('.resume-card')).toHaveCount(0);
}

async function endIncognito(page: Page) {
	await headerControl(page).click();
	const info = page.getByRole('dialog', { name: 'Mode Incognito aktif', exact: true });
	await expect(info).toBeVisible();
	await info.getByRole('button', { name: 'Akhiri & hapus', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Sudah mengunduh CV kamu?');
	await dialog.getByRole('button', { name: 'Akhiri & hapus', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(banner(page)).toHaveCount(0);
	await expect(headerControl(page)).toHaveAttribute('aria-pressed', 'false');
}

async function expectOnlyNormalCv(page: Page) {
	await page.goto('/cv');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText(normalTitle);
	await expect(cards(page)).toContainText('Nadia Tersimpan');
	await expect(cards(page)).not.toContainText(secretName);
}

test('incognito separates tabs, disables autofill and loses only session CVs on reload', async ({
	page,
	context
}) => {
	await createNormal(page);
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	for (const label of [/^Nama lengkap\b/, /^Email\b/, /^Nomor HP\b/]) {
		await expect(page.getByLabel(label)).toHaveAttribute('autocomplete', 'off');
	}
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');

	const other = await context.newPage();
	try {
		await expectOnlyNormalCv(other);
		await expect(banner(other)).toHaveCount(0);
	} finally {
		await other.close();
	}

	const dialogs: string[] = [];
	page.on('dialog', async (dialog) => {
		dialogs.push(dialog.type());
		await dialog.accept();
	});
	await page.reload();
	expect(dialogs).toEqual(['beforeunload']);
	await expect(banner(page)).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
	).toBeVisible();
	await page.getByRole('link', { name: 'Buat CV baru', exact: true }).click();
	await expect(page.locator('.resume-card')).toHaveCount(0);

	const end = banner(page).getByRole('button', { name: 'Akhiri & hapus', exact: true });
	await end.click();
	const confirmation = page.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true });
	await expect(confirmation).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(confirmation).not.toBeVisible();
	await expect(end).toBeFocused();
	await expect(banner(page)).toBeVisible();
	await endIncognito(page);
	await expectOnlyNormalCv(page);
});

test('ending from an open wizard discards an unsaved edit without saving it to normal storage', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-11-06T04:00:00Z') });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await createNormal(page);
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	// Freeze the 500 ms autosave debounce before editing, so ending must discard pending changes.
	await page.clock.pauseAt(new Date('2026-11-06T04:01:00Z'));
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await endIncognito(page);
	await page.clock.runFor(1_000);
	await expectOnlyNormalCv(page);
});

test('three idle hours erase an open CV, stop edits and leave the tab incognito', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	const name = page.getByLabel(/^Nama lengkap\b/);
	await name.fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(banner(page)).toContainText(/Dihapus otomatis pukul \d{2}[.:]\d{2}/);
	const previewButton = page.getByRole('button', { name: 'Lihat Preview', exact: true });
	const previewDialog = page.getByRole('dialog', { name: 'Preview CV', exact: true });
	if (await previewButton.isVisible()) {
		await previewButton.click();
		await expect(previewDialog).toBeVisible();
		await expect(page.getByTestId('cv-preview')).toContainText(secretName);
	}
	await page.clock.fastForward('03:02:00');
	await expect(previewDialog).not.toBeVisible();
	await expect(page.getByTestId('cv-preview')).toHaveCount(0);
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toBeVisible();
	await expect(name).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Lanjut', exact: true })).toBeDisabled();
	await page.keyboard.type('Tidak boleh tersimpan');
	// The erased CV is purged from memory too: no personal data left on screen (security review).
	await expect(name).toHaveValue('');
	await expect(page.getByText(secretName)).toHaveCount(0);
	expect(
		await page
			.locator('input, textarea')
			.evaluateAll((fields) =>
				fields.some((field) => (field as HTMLInputElement).value.includes('Rahasia'))
			)
	).toBe(false);
	await expect(banner(page)).toBeVisible();
	await expect(banner(page)).not.toContainText(/Dihapus otomatis pukul/);
	await page.getByRole('link', { name: 'Buat CV baru', exact: true }).click();
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await page.getByRole('link', { name: 'Lihat semua CV', exact: true }).click();
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByRole('status').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(banner(page)).toBeVisible();
});

test('incognito information and ending confirmation translate to English', async ({ page }) => {
	await page.goto('/buat');
	await startIncognito(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const active = page.getByRole('region', { name: 'Incognito Mode', exact: true });
	await expect(active).toBeVisible();
	const control = headerControl(page, 'en');
	await expect(control).toHaveAttribute('aria-pressed', 'true');
	await control.click();
	const info = page.getByRole('dialog', { name: 'Incognito Mode is on', exact: true });
	await expect(info).toContainText(/only in this tab/i);
	await expect(info).toContainText(/refresh/i);
	await page.keyboard.press('Escape');
	await expect(info).not.toBeVisible();
	await expect(control).toBeFocused();
	await control.click();
	await info.getByRole('button', { name: 'End & erase', exact: true }).click();
	const end = page.getByRole('dialog', { name: 'End Incognito Mode?', exact: true });
	await expect(end).toBeVisible();
	await end.getByRole('button', { name: 'End & erase', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(active).toHaveCount(0);
	await expect(control).toHaveAttribute('aria-pressed', 'false');
});

test('edits move the deadline and idle expiry refreshes an already open dashboard', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	const name = page.getByLabel(/^Nama lengkap\b/);
	await name.fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	const deadline = banner(page).getByRole('status');
	await expect(deadline).toContainText(/Dihapus otomatis pukul \d{2}[.:]\d{2}/);
	const originalDeadline = await deadline.innerText();
	await page.clock.fastForward('00:02:00');
	await name.fill(`${secretName} Baru`);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(deadline).not.toHaveText(originalDeadline);

	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText(`${secretName} Baru`);
	await page.clock.fastForward('03:02:00');
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByRole('status').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(banner(page)).toBeVisible();
	await expect(deadline).toHaveCount(0);

	await page.locator('.page-heading').getByRole('link', { name: 'Buat CV', exact: true }).click();
	await expect(page).toHaveURL(/\/buat$/);
	await createPersonal(page, 'CV Sesi Baru');
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toHaveCount(0);
	await expect(banner(page)).toBeVisible();
	await expect(deadline).toBeVisible();
});

test('idle expiry removes the CV and PDF action from an already open print page', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/buat');
	await startIncognito(page);
	await createPersonal(page, 'CV Rahasia Warnet');
	await page.getByLabel(/^Nama lengkap\b/).fill(secretName);
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	const menu = page.locator('.app-menu');
	await menu.locator('summary').click();
	await menu.getByRole('link', { name: 'CV Saya', exact: true }).click();
	await expect(cards(page)).toHaveCount(1);
	await cards(page).getByRole('button', { name: 'Unduh', exact: true }).click();
	await page.getByRole('link', { name: 'PDF untuk melamar', exact: true }).click();
	await expect(page).toHaveURL(/\/cv\/[a-f\d-]+\/print$/);
	const paper = page.getByTestId('print-paper');
	await expect(paper.getByRole('heading', { name: secretName, exact: true })).toBeVisible();
	await expect(paper.locator('[data-template]')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true })).toBeEnabled();
	await page.clock.fastForward('03:02:00');
	await expect(page.getByRole('alert').filter({ hasText: expiredMessage })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buat CV baru', exact: true })).toBeVisible();
	await expect(paper.locator('[data-template]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true })).toHaveCount(
		0
	);
	await expect(banner(page)).toBeVisible();
});

test('starting from an unsaved normal wizard preserves its CV before switching repositories', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-11-06T04:00:00Z') });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/buat');
	await createPersonal(page, 'CV Tetap Tersimpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	// Do not let the 500 ms debounce save this edit: the header's before-start guard must flush it.
	await page.clock.pauseAt(new Date('2026-11-06T04:01:00Z'));
	await page.getByLabel(/^Nama lengkap\b/).fill('Tetap Tersimpan');
	await startIncognito(page);
	await expect(page).toHaveURL(/\/buat$/);
	await page.clock.runFor(1_000);
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await page.clock.resume();
	await page.getByRole('link', { name: 'Lihat semua CV', exact: true }).click();
	await expect(page).toHaveURL(/\/cv$/);
	await expect(cards(page)).toHaveCount(0);
	await expect(page.getByTestId('dashboard-empty')).toBeVisible();
	await endIncognito(page);
	await page.goto('/cv');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText('CV Tetap Tersimpan');
	await expect(cards(page)).toContainText('Tetap Tersimpan');
	await page.reload();
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText('Tetap Tersimpan');
});

test('a failed normal save cancels header activation and a successful retry preserves the CV', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-11-06T04:00:00Z') });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/buat');
	await createPersonal(page, 'CV Gagal Simpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	const wizardUrl = page.url();
	await page.clock.pauseAt(new Date('2026-11-06T04:01:00Z'));
	await page.evaluate(() => {
		const nativePut = IDBObjectStore.prototype.put;
		const hooks = window as typeof window & { restoreCvPut?: () => void };
		hooks.restoreCvPut = () => {
			IDBObjectStore.prototype.put = nativePut;
			delete hooks.restoreCvPut;
		};
		IDBObjectStore.prototype.put = function (
			this: IDBObjectStore,
			...args: Parameters<IDBObjectStore['put']>
		) {
			if (this.name === 'cvs')
				throw new DOMException('Simulated full storage', 'QuotaExceededError');
			return nativePut.apply(this, args);
		};
	});
	await page.getByLabel(/^Nama lengkap\b/).fill('Tetap di Editor');
	const control = headerControl(page);
	await control.click();
	const confirmation = page.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true });
	await confirmation.getByRole('button', { name: 'Nyalakan', exact: true }).click();
	await expect(saved(page)).toHaveAttribute('data-save-state', 'error');
	await expect(page).toHaveURL(wizardUrl);
	// Native modal dialogs make the page behind them inert; inspect this retained control directly.
	await expect(page.locator('.app-header button[aria-label="Mode Incognito"]')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.locator('.incognito-banner')).toHaveCount(0);
	await expect(confirmation).toBeVisible();
	await expect(page.locator('.notification[data-kind="error"]')).toContainText(
		'CV belum tersimpan. Coba simpan lagi sebelum menyalakan Mode Incognito.'
	);
	await page.evaluate(() => {
		(window as typeof window & { restoreCvPut?: () => void }).restoreCvPut?.();
	});
	await confirmation.getByRole('button', { name: 'Nyalakan', exact: true }).click();
	await expect(confirmation).not.toBeVisible();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(control).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await endIncognito(page);
	await page.goto('/cv');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText('CV Gagal Simpan');
	await expect(cards(page)).toContainText('Tetap di Editor');
});

test('the header can safely start incognito from a normal print page', async ({ page }) => {
	await createNormal(page);
	await page.getByRole('link', { name: 'Lihat semua CV', exact: true }).click();
	await cards(page).getByRole('button', { name: 'Unduh', exact: true }).click();
	await page.getByRole('link', { name: 'PDF untuk melamar', exact: true }).click();
	await expect(page.getByTestId('print-paper')).toContainText('Nadia Tersimpan');
	await startIncognito(page);
	await expect(page).toHaveURL(/\/buat$/);
	await expect(page.getByTestId('print-paper')).toHaveCount(0);
	await endIncognito(page);
	await expectOnlyNormalCv(page);
});

test('the incognito header control stays in one accessible row in both states and languages', async ({
	page
}) => {
	await page.goto('/buat');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	async function checkHeader(locale: 'id' | 'en', active: boolean) {
		const control = headerControl(page, locale);
		await expect(control).toHaveAttribute('aria-pressed', String(active));
		const label =
			locale === 'id'
				? active
					? 'Incognito aktif'
					: 'Incognito'
				: active
					? 'Incognito active'
					: 'Incognito';
		for (const width of [320, 360, 768, 1280]) {
			await page.setViewportSize({ width, height: 780 });
			await expect(control).toBeVisible();
			if (width < 480) await expect(control.getByText(label, { exact: true })).not.toBeVisible();
			else await expect(control.getByText(label, { exact: true })).toBeVisible();
			const geometry = await control.evaluate((button) => {
				const header = button.closest('.app-header')!;
				const brand = header.querySelector('.brand')!;
				const languages = header.querySelector('.language-switcher')!;
				const menu = header.querySelector('.app-menu')!;
				const elements = [brand, languages, button, menu];
				const controls = [
					...languages.querySelectorAll('button'),
					button,
					menu.querySelector('summary')!
				];
				return {
					viewport: innerWidth,
					content: document.documentElement.scrollWidth,
					items: elements.map((element) => {
						const rect = element.getBoundingClientRect();
						return { x: rect.x, right: rect.right, center: rect.y + rect.height / 2 };
					}),
					controls: controls.map((element) => {
						const rect = element.getBoundingClientRect();
						return { width: rect.width, height: rect.height };
					})
				};
			});
			expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
			const centers = geometry.items.map((item) => item.center);
			expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
			for (const [index, item] of geometry.items.entries()) {
				expect(item.x).toBeGreaterThanOrEqual(0);
				expect(item.right).toBeLessThanOrEqual(geometry.viewport);
				const previous = geometry.items[index - 1];
				if (previous) expect(item.x).toBeGreaterThanOrEqual(previous.right);
			}
			for (const touch of geometry.controls) {
				expect(touch.width).toBeGreaterThanOrEqual(44);
				expect(touch.height).toBeGreaterThanOrEqual(44);
			}
		}
	}
	await checkHeader('id', false);
	const control = headerControl(page);
	await control.click();
	const confirmation = page.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true });
	await confirmation.getByRole('button', { name: 'Batal', exact: true }).click();
	await expect(confirmation).not.toBeVisible();
	await expect(control).toBeFocused();
	await expect(control).toHaveAttribute('aria-pressed', 'false');
	await startIncognito(page);
	await checkHeader('id', true);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await checkHeader('en', true);
	await headerControl(page, 'en').click();
	await page
		.getByRole('dialog', { name: 'Incognito Mode is on', exact: true })
		.getByRole('button', { name: 'End & erase', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'End Incognito Mode?', exact: true })
		.getByRole('button', { name: 'End & erase', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
	await checkHeader('en', false);
});

test('starting from a normal Creative wizard waits for the pending photo and preserves it', async ({
	page
}) => {
	await page.goto('/buat');
	await createPersonal(page, 'CV Foto Tersimpan', 'creative');
	await page.getByLabel(/^Nama lengkap\b/).fill('Foto Tetap Tersimpan');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	const wizardUrl = page.url();
	const image = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 2;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas unavailable');
		context.fillStyle = '#0f766e';
		context.fillRect(0, 0, 2, 2);
		return canvas.toDataURL('image/png').split(',')[1]!;
	});
	await page.evaluate(() => {
		const nativeCreate = window.createImageBitmap.bind(window);
		const hooks = window as typeof window & {
			releasePhotoDecode?: () => void;
			photoDecodeWaiting?: boolean;
		};
		let release!: () => void;
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		window.createImageBitmap = (...args: unknown[]) => {
			hooks.photoDecodeWaiting = true;
			return pending.then(() => Reflect.apply(nativeCreate, window, args) as Promise<ImageBitmap>);
		};
		hooks.releasePhotoDecode = () => {
			window.createImageBitmap = nativeCreate;
			delete hooks.releasePhotoDecode;
			delete hooks.photoDecodeWaiting;
			release();
		};
	});
	await page.getByLabel('Foto profil (opsional)', { exact: true }).setInputFiles({
		name: 'foto-tertunda.png',
		mimeType: 'image/png',
		buffer: Buffer.from(image, 'base64')
	});
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as typeof window & { photoDecodeWaiting?: boolean }).photoDecodeWaiting
			)
		)
		.toBe(true);
	await expect(page.getByText('Memproses foto…', { exact: true })).toBeVisible();
	await headerControl(page).click();
	const confirmation = page.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true });
	await confirmation.getByRole('button', { name: 'Nyalakan', exact: true }).click();
	await expect(confirmation).toBeVisible();
	await expect(confirmation.getByRole('button', { name: /Nyalakan/ })).toBeDisabled();
	await expect(page).toHaveURL(wizardUrl);
	await expect(page.locator('.app-header button[aria-label="Mode Incognito"]')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.locator('.incognito-banner')).toHaveCount(0);
	await page.evaluate(() => {
		(window as typeof window & { releasePhotoDecode?: () => void }).releasePhotoDecode?.();
	});
	await expect(confirmation).not.toBeVisible();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(headerControl(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await endIncognito(page);
	await page.goto('/cv');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page)).toContainText('CV Foto Tersimpan');
	await expect(cards(page)).toContainText('Foto Tetap Tersimpan');
	await cards(page).getByRole('link', { name: 'Lanjutkan', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	const photo = page.getByRole('img', { name: 'Foto profil CV', exact: true });
	await expect(photo).toBeVisible();
	await expect(photo).toHaveAttribute('src', /^blob:/);
	await expect
		.poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
		.toBeGreaterThan(0);
});
