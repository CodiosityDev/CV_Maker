import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

const fullName = 'Nadia Visual';
const bulletText = 'Merancang 12 layar aplikasi reservasi bersama tim produk.';
const summaryText =
	'Lulusan desain yang merancang aplikasi sederhana dan mudah dipakai.\n\nBerpengalaman bekerja bersama tim produk.';
const visual = (page: Page) => page.getByTestId('visual-editor');
const paper = (page: Page) => visual(page).getByTestId('visual-paper');
const nameField = (page: Page) => paper(page).locator('[data-edit="p|fullName"]');
const bullets = (page: Page) => paper(page).locator('[data-edit^="b|experience|"]');
const saved = (page: Page) => page.getByTestId('save-status');

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

async function createEditor(page: Page, options: { photo?: boolean; ats?: boolean } = {}) {
	await page.goto('/buat');
	await page
		.getByRole('button', { name: options.ats ? 'Pilih CV ATS' : 'Pilih CV Creative', exact: true })
		.click();
	await page.getByLabel('Judul CV', { exact: true }).fill('CV Nadia Visual');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await page.getByLabel(/^Email\b/).fill('nadia.visual@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await page.getByLabel('Headline singkat', { exact: true }).fill('UI/UX Designer');
	if (options.photo) {
		const image = await page.evaluate(() => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 128;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('Canvas unavailable');
			context.fillStyle = '#D5E8E6';
			context.fillRect(0, 0, 128, 128);
			context.fillStyle = '#1F1D3D';
			context.fillRect(32, 24, 64, 80);
			return canvas.toDataURL('image/png').split(',')[1]!;
		});
		await page.getByLabel('Foto profil (opsional)', { exact: true }).setInputFiles({
			name: 'visual-fixture.png',
			mimeType: 'image/png',
			buffer: Buffer.from(image, 'base64')
		});
		await expect(page.getByRole('img', { name: 'Foto profil CV', exact: true })).toBeVisible();
	}
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ }).fill('Universitas Contoh');
	await page.keyboard.press('Escape');
	if (!options.ats) {
		await page.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
		await page.keyboard.press('Escape');
		await page
			.getByRole('combobox', { name: 'Jurusan', exact: true })
			.fill('Desain Komunikasi Visual');
		await page.keyboard.press('Escape');
	}
	await advance(page, 'Pengalaman kerja / magang');
	if (!options.ats) {
		await page
			.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true })
			.click();
		await page
			.getByRole('combobox', { name: 'Posisi / peran', exact: true })
			.fill('Designer Intern');
		await page.keyboard.press('Escape');
		await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
		await page.getByRole('button', { name: 'Tambah poin', exact: true }).click();
		await page.getByRole('textbox', { name: 'Poin 1', exact: true }).fill(bulletText);
	}
	await advance(page, 'Organisasi & kepanitiaan', Boolean(options.ats));
	await advance(page, 'Proyek', true);
	await advance(page, 'Keahlian & pencapaian', true);
	if (!options.ats) {
		const skill = page.getByRole('combobox', { name: 'Keahlian teknis', exact: true });
		await skill.fill('Figma');
		await skill.press('Enter');
	}
	await advance(page, 'Ringkasan profil', Boolean(options.ats));
	if (!options.ats) await page.getByLabel('Ringkasan profil', { exact: true }).fill(summaryText);
	await advance(page, 'Tinjau CV-mu', Boolean(options.ats));
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	await page.getByText('Ubah lagi', { exact: true }).click();
	await expect(page.getByTestId('full-editor')).toBeVisible();
	return new URL(page.url()).pathname.split('/').at(-2)!;
}

async function enterVisual(page: Page) {
	const control = page.getByRole('button', { name: 'Edit visual', exact: true });
	await control.click();
	await expect(control).toHaveAttribute('aria-pressed', 'true');
	await expect(visual(page)).toBeVisible();
	await expect(nameField(page)).toHaveText(fullName);
}

async function replaceInline(field: Locator, text: string) {
	await field.click();
	await expect(field).toHaveAttribute('contenteditable', /^(plaintext-only|true)$/);
	await field.fill(text);
	await field.press('Tab');
}

async function noOverflow(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
}

async function observeModeLayout(page: Page) {
	await page.evaluate(() => {
		const state = window as typeof window & {
			visualLayoutShifts: { value: number; hadRecentInput: boolean }[];
		};
		state.visualLayoutShifts = [];
		new PerformanceObserver((entries) => {
			for (const entry of entries.getEntries()) {
				const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
				state.visualLayoutShifts.push({ value: shift.value, hadRecentInput: shift.hadRecentInput });
			}
		}).observe({ type: 'layout-shift', buffered: false });
	});
}

async function modeLayout(page: Page) {
	const shifts = await page.evaluate(
		() =>
			(
				window as typeof window & {
					visualLayoutShifts: { value: number; hadRecentInput: boolean }[];
				}
			).visualLayoutShifts
	);
	expect(
		shifts.filter((shift) => !shift.hadRecentInput).reduce((sum, shift) => sum + shift.value, 0)
	).toBeLessThan(0.02);
	return shifts;
}

async function openSkillsMenu(page: Page) {
	const navigator = visual(page).locator('.section-navigator');
	if (!(await navigator.evaluate((element) => element.hasAttribute('open'))))
		await navigator.locator('summary').click();
	const trigger = navigator.getByRole('button', { name: 'Atur bagian Keahlian', exact: true });
	await trigger.focus();
	await page.keyboard.press('Enter');
	return page
		.getByRole('menu', { name: 'Atur bagian Keahlian', exact: true })
		.getByRole('menuitem', { name: 'Pindah ke kolom utama', exact: true });
}

for (const theme of ['light', 'dark'] as const) {
	test.describe(`Creative visual editor in ${theme} theme`, () => {
		const errors: string[] = [];
		test.beforeEach(async ({ page, baseURL }) => {
			errors.length = 0;
			if (!baseURL) throw new Error('A local production preview is required.');
			const origin = new URL(baseURL).origin;
			await page.addInitScript((theme) => localStorage.setItem('cvmaker.theme', theme), theme);
			await page.context().route('**/*', async (route) => {
				const url = new URL(route.request().url());
				if (url.origin !== origin) {
					errors.push(`External request: ${url.href}`);
					return route.abort();
				}
				if (url.pathname === '/api/hello') return route.fulfill({ json: { visitors: 1234 } });
				if (url.pathname === '/api/ai/quota')
					return route.fulfill({
						json: { limit: 3, remaining: 3, resetsAt: '2026-11-12T17:00:00.000Z' }
					});
				if (url.pathname.startsWith('/api/')) {
					errors.push(`Unexpected API request: ${url.pathname}`);
					return route.fulfill({ status: 503, json: { error: 'unavailable' } });
				}
				return route.continue();
			});
			page.on('pageerror', (error) => errors.push(error.message));
			page.on('console', (message) => {
				if (message.type() === 'error') errors.push(message.text());
			});
		});
		test.afterEach(() => expect(errors).toEqual([]));

		test('inline name and bullet coalesce undo, survive reload and keep mode changes within layout budget', async ({
			page
		}) => {
			await createEditor(page);
			await page.waitForLoadState('networkidle');
			await observeModeLayout(page);
			await enterVisual(page);
			await page.waitForLoadState('networkidle');
			const initialLayout = await modeLayout(page);
			const summary = paper(page).locator('[data-edit="summary"]');
			expect(await summary.textContent()).toBe(summaryText);
			await summary.click();
			await summary.press('Control+End');
			await summary.pressSequentially(' Lokal.');
			await summary.press('Tab');
			expect(await summary.textContent()).toBe(`${summaryText} Lokal.`);
			await nameField(page).click();
			await nameField(page).press('Control+A');
			await nameField(page).pressSequentially('Nadia ');
			// Crossing the normal history coalescing window must still leave one edit-session undo.
			await page.waitForTimeout(1_100);
			await nameField(page).pressSequentially('Kanvas');
			await nameField(page).press('Tab');
			await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
			await expect(nameField(page)).toHaveText(fullName);
			await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
			await expect(nameField(page)).toHaveText('Nadia Kanvas');
			await replaceInline(bullets(page).first(), 'Menyelesaikan 14 prototipe bersama tim desain.');
			await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
			await expect(bullets(page).first()).toHaveText(bulletText);
			await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await page.getByRole('button', { name: 'Edit visual', exact: true }).click();
			await expect(nameField(page)).toHaveText('Nadia Kanvas');
			await expect(bullets(page).first()).toHaveText(
				'Menyelesaikan 14 prototipe bersama tim desain.'
			);
			expect(await paper(page).locator('[data-edit="summary"]').textContent()).toBe(
				`${summaryText} Lokal.`
			);
			await observeModeLayout(page);
			for (const label of ['Preview', 'Ubah', 'Edit visual']) {
				await page.getByRole('button', { name: label, exact: true }).click();
				await page.evaluate(
					() =>
						new Promise<void>((done) =>
							requestAnimationFrame(() => requestAnimationFrame(() => done()))
						)
				);
				await noOverflow(page);
			}
			const cycleLayout = await modeLayout(page);
			await test.info().attach('visual-mode-layout-shifts', {
				body: JSON.stringify({ initial: initialLayout, cycles: cycleLayout }),
				contentType: 'application/json'
			});
		});

		test('bullet Enter and empty Backspace preserve focus, Escape cancels and HTML paste stays plain text', async ({
			page,
			context
		}) => {
			await context.grantPermissions(['clipboard-read', 'clipboard-write']);
			await page.addInitScript(() => {
				const descriptor = Object.getOwnPropertyDescriptor(
					HTMLElement.prototype,
					'contentEditable'
				);
				const setter = descriptor?.set;
				if (!descriptor || !setter) throw new Error('The browser must expose contentEditable.');
				Object.defineProperty(HTMLElement.prototype, 'contentEditable', {
					...descriptor,
					set(value: string) {
						if (value === 'plaintext-only')
							throw new DOMException(
								'This browser does not support plaintext-only.',
								'SyntaxError'
							);
						setter.call(this, value);
					}
				});
			});
			const dialogs: string[] = [];
			page.on('dialog', async (dialog) => {
				dialogs.push(dialog.message());
				await dialog.dismiss();
			});
			await createEditor(page);
			await enterVisual(page);
			await bullets(page).first().click();
			await expect(bullets(page).first()).toHaveAttribute('contenteditable', 'true');
			await bullets(page).first().press('End');
			await page.keyboard.press('Enter');
			await expect(bullets(page)).toHaveCount(2);
			await expect(bullets(page).nth(1)).toBeFocused();
			await expect(bullets(page).nth(1)).toHaveText('');
			await page.keyboard.press('Backspace');
			await expect(bullets(page)).toHaveCount(1);
			await expect(bullets(page).first()).toBeFocused();
			await expect(bullets(page).first()).toHaveText(bulletText);
			await replaceInline(nameField(page), 'Nadia Sesi Pertama');
			await nameField(page).click();
			await nameField(page).fill('Nama dibatalkan');
			await nameField(page).press('Escape');
			await expect(nameField(page)).toHaveText('Nadia Sesi Pertama');
			await nameField(page).click();
			await nameField(page).press('Control+A');
			await page.evaluate(async () => {
				await navigator.clipboard.write([
					new ClipboardItem({
						'text/html': new Blob(['<b>Nadia Tempel</b>'], {
							type: 'text/html'
						}),
						'text/plain': new Blob(['Nadia Tempel <img src=x onerror=alert(1)>'], {
							type: 'text/plain'
						})
					})
				]);
			});
			await page.keyboard.press('Control+V');
			await nameField(page).press('Tab');
			await expect(nameField(page)).toHaveText('Nadia Tempel <img src=x onerror=alert(1)>');
			await expect(nameField(page).locator('img,script,b')).toHaveCount(0);
			await replaceInline(bullets(page).first(), '<img src=x onerror=alert(2)>');
			await expect(bullets(page).first()).toHaveText('<img src=x onerror=alert(2)>');
			await expect(bullets(page).first().locator('img,script')).toHaveCount(0);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await page.getByRole('button', { name: 'Edit visual', exact: true }).click();
			await expect(nameField(page)).toHaveText('Nadia Tempel <img src=x onerror=alert(1)>');
			await expect(bullets(page).first()).toHaveText('<img src=x onerror=alert(2)>');
			await nameField(page).click();
			await expect(nameField(page)).toHaveAttribute('contenteditable', 'true');
			await paper(page)
				.locator('[data-form-field^="education."][data-form-field$=".degree"]')
				.click();
			await expect(page.getByRole('button', { name: 'Ubah', exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(
				page.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true })
			).toBeFocused();
			await page.getByRole('button', { name: 'Edit visual', exact: true }).click();
			await nameField(page).click();
			await expect(nameField(page)).toHaveAttribute('contenteditable', 'true');
			await paper(page).locator('[data-form-field="personal.email"]').click();
			await expect(page.locator('[id="personal.email"]')).toBeFocused();
			await expect(page).toHaveURL(/\/cv\/[^/]+\/edit$/);
			expect(dialogs).toEqual([]);
		});

		test('keyboard moves Skills into main and print and Word retain the edited field data', async ({
			page
		}) => {
			const id = await createEditor(page);
			await enterVisual(page);
			const changedBullet = 'Menyusun 14 prototipe untuk ditinjau bersama tim desain.';
			await replaceInline(bullets(page).first(), changedBullet);
			const move = await openSkillsMenu(page);
			await expect(move).toBeVisible();
			await move.focus();
			await page.keyboard.press('Enter');
			await expect(paper(page).locator('[data-section-key="skills"]')).toHaveAttribute(
				'data-column',
				'main'
			);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.getByRole('button', { name: 'Unduh', exact: true }).click();
			const downloadEvent = page.waitForEvent('download');
			await page
				.getByRole('dialog')
				.getByRole('button', { name: 'Word (.docx)', exact: true })
				.click();
			const download = await downloadEvent;
			expect(await download.failure()).toBeNull();
			const path = await download.path();
			if (!path) throw new Error('The Word download must exist.');
			const document = unzipSync(await readFile(path))['word/document.xml'];
			if (!document) throw new Error('The Word archive must contain document.xml.');
			const xml = strFromU8(document);
			for (const text of [fullName, changedBullet, 'Figma', 'Universitas Contoh'])
				expect(xml).toContain(text);
			await page.goto(`/cv/${id}/print`);
			const printed = page.locator('[data-template="creative-sidebar"]');
			await expect(printed.locator('.main-column')).toContainText('Keahlian');
			await expect(printed.locator('.main-column')).toContainText('Figma');
			await expect(printed.locator('aside')).not.toContainText('Figma');
			await expect(printed).toContainText(changedBullet);
			await expect(page.locator('[data-edit],[contenteditable]')).toHaveCount(0);
		});

		test('native pointer drag moves Skills into the main column as one undoable action', async ({
			page
		}) => {
			test.skip((page.viewportSize()?.width ?? 0) < 768, 'Phones use the accessible section menu.');
			await createEditor(page);
			await enterVisual(page);
			const handle = visual(page).locator(
				'[data-testid="visual-section-handle"][data-section-key="skills"]'
			);
			const target = paper(page).locator('[data-section-key="summary"][data-column="main"]');
			await target.scrollIntoViewIfNeeded();
			const sourceRect = await handle.boundingBox();
			const targetRect = await target.boundingBox();
			if (!sourceRect || !targetRect)
				throw new Error('The drag source and main-column target must be visible.');
			await page.mouse.move(
				sourceRect.x + sourceRect.width / 2,
				sourceRect.y + sourceRect.height / 2
			);
			await page.mouse.down();
			await page.mouse.move(
				sourceRect.x + sourceRect.width / 2 + 10,
				sourceRect.y + sourceRect.height / 2,
				{ steps: 3 }
			);
			await page.mouse.move(
				targetRect.x + targetRect.width / 2,
				targetRect.y + targetRect.height / 2,
				{ steps: 12 }
			);
			await page.mouse.up();
			await expect(paper(page).locator('[data-section-key="skills"]')).toHaveAttribute(
				'data-column',
				'main'
			);
			await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
			await expect(paper(page).locator('[data-section-key="skills"]')).toHaveAttribute(
				'data-column',
				'side'
			);
			await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
			await expect(paper(page).locator('[data-section-key="skills"]')).toHaveAttribute(
				'data-column',
				'main'
			);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await noOverflow(page);
		});

		test('design controls change width spacing photo and position and reset restores default geometry', async ({
			page
		}) => {
			await createEditor(page, { photo: true });
			await enterVisual(page);
			const panel = visual(page).getByTestId('visual-design-panel');
			if (!(await panel.evaluate((element) => element.hasAttribute('open'))))
				await panel.locator('summary').click();
			const reset = panel.getByRole('button', { name: 'Kembalikan desain awal', exact: true });
			await expect(reset).toBeDisabled();
			const geometry = () =>
				paper(page)
					.locator('[data-template]')
					.evaluate((element) => {
						const aside = element.querySelector('aside')!;
						const image = element.querySelector('img')!;
						const section = element.querySelector('.main-column section')!;
						return {
							asideWidth: getComputedStyle(aside).width,
							imageWidth: getComputedStyle(image).width,
							imageRadius: getComputedStyle(image).borderRadius,
							sectionMargin: getComputedStyle(section).marginTop,
							float: getComputedStyle(aside).cssFloat
						};
					});
			const original = await geometry();
			await panel.getByLabel('Posisi kolom samping', { exact: true }).selectOption('right');
			const range = panel.getByRole('slider', { name: /^Lebar kolom samping\b/ });
			await range.focus();
			await range.press('End');
			await expect(range).toHaveValue('40');
			await panel.getByLabel('Jarak isi', { exact: true }).selectOption('airy');
			await panel.getByLabel('Bentuk foto', { exact: true }).selectOption('square');
			await panel.getByLabel('Ukuran foto', { exact: true }).selectOption('lg');
			await expect(reset).toBeEnabled();
			await expect
				.poll(async () => {
					const current = await geometry();
					return {
						asideChanged: current.asideWidth !== original.asideWidth,
						imageChanged: current.imageWidth !== original.imageWidth,
						imageRadius: current.imageRadius,
						marginChanged: current.sectionMargin !== original.sectionMargin,
						float: current.float
					};
				})
				.toEqual({
					asideChanged: true,
					imageChanged: true,
					imageRadius: '0px',
					marginChanged: true,
					float: 'right'
				});
			const changed = await geometry();
			expect(changed.asideWidth).not.toBe(original.asideWidth);
			expect(changed.imageWidth).not.toBe(original.imageWidth);
			expect(changed.imageRadius).toBe('0px');
			expect(changed.sectionMargin).not.toBe(original.sectionMargin);
			expect(changed.float).toBe('right');
			await reset.click();
			await expect(reset).toBeDisabled();
			await expect.poll(geometry).toEqual(original);
			await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
			await expect.poll(geometry).toEqual(changed);
			await page.getByRole('button', { name: 'Ulangi', exact: true }).click();
			await expect.poll(geometry).toEqual(original);
			await noOverflow(page);
		});

		test('ATS offers no visual mode and its print page has no editing markers', async ({
			page
		}) => {
			const id = await createEditor(page, { ats: true });
			await expect(page.getByRole('button', { name: 'Edit visual', exact: true })).toHaveCount(0);
			await expect(visual(page)).toHaveCount(0);
			await page.goto(`/cv/${id}/print`);
			await expect(page.locator('[data-template="ats-klasik"]')).toContainText(fullName);
			await expect(page.locator('[data-edit],[contenteditable]')).toHaveCount(0);
			await noOverflow(page);
		});

		test('cross-tab deletion removes the active editable island and every personal copy', async ({
			page,
			context
		}) => {
			await createEditor(page);
			await enterVisual(page);
			await nameField(page).click();
			await nameField(page).fill('Rahasia Visual');
			const other = await context.newPage();
			try {
				await other.goto('/cv');
				const card = other.getByTestId('cv-card');
				await expect(card).toHaveCount(1);
				const direct = card.getByRole('button', { name: 'Hapus', exact: true });
				if (await direct.isVisible()) await direct.click();
				else {
					await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
					await other
						.getByRole('dialog')
						.getByRole('button', { name: 'Hapus', exact: true })
						.click();
				}
				await other
					.getByRole('dialog', { name: 'Hapus CV ini?', exact: true })
					.getByRole('button', { name: 'Hapus', exact: true })
					.click();
				await expect(page.getByTestId('removed-cv')).toBeVisible();
				await expect(visual(page)).toHaveCount(0);
				expect(
					await page.evaluate(() =>
						[
							document.body.textContent ?? '',
							...Array.from(
								document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'),
								(field) => field.value
							)
						].some((text) =>
							/Rahasia Visual|Nadia Visual|nadia\.visual@example\.com|081234567890/.test(text)
						)
					)
				).toBe(false);
				await page.keyboard.type('Tidak boleh tersimpan kembali');
				await other.reload();
				await expect(other.getByTestId('cv-card')).toHaveCount(0);
			} finally {
				await other.close();
			}
		});
	});
}
