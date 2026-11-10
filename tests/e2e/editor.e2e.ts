import { expect, test, type Page } from '@playwright/test';

const name = 'Nadia Editor';
const cvTitle = 'CV Nadia — Editor';
const linkedIn = 'https://www.linkedin.com/in/nadia-editor';
const editor = (page: Page) => page.getByTestId('full-editor');
const saved = (page: Page) => page.getByTestId('save-status');
const section = (page: Page, key: string) =>
	page.locator(`[data-testid="editor-section"][data-section-key="${key}"]`);
const sections = (page: Page) => page.getByTestId('editor-section');

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

async function createDone(page: Page, incognito = false, minimal = false) {
	await page.goto('/buat');
	if (incognito) {
		await page.locator('.app-header').getByRole('button', { name: 'Mode Incognito' }).click();
		await page
			.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
			.getByRole('button', { name: 'Nyalakan', exact: true })
			.click();
	}
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill('Web Developer');
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(name);
	await page.getByLabel(/^Email\b/).fill('nadia.editor@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await page.getByRole('button', { name: 'Tambah Tautan', exact: true }).click();
	await page.getByLabel('Nama tautan', { exact: true }).fill('LinkedIn');
	await page.getByLabel('URL', { exact: true }).fill(linkedIn);
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const education = page.locator('.collection-steps .item-card').last();
	await education.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ }).fill('Kampus Contoh');
	if (!minimal) {
		await education.getByRole('combobox', { name: 'Jenjang pendidikan', exact: true }).fill('S1');
		await education
			.getByRole('combobox', { name: 'Jurusan', exact: true })
			.fill('Sistem Informasi');
		for (const [label, month, year] of [
			['Mulai', '09', '2020'],
			['Selesai', '07', '2024']
		] as const) {
			const date = education.getByRole('group', { name: label, exact: true });
			await date.getByLabel('Bulan', { exact: true }).selectOption(month);
			await date.getByLabel('Tahun', { exact: true }).selectOption(year);
		}
	}
	await advance(page, 'Pengalaman kerja / magang');
	if (minimal) {
		// Core requires one institution; degree, major, dates and later sections are optional.
		for (const title of [
			'Organisasi & kepanitiaan',
			'Proyek',
			'Keahlian & pencapaian',
			'Ringkasan profil',
			'Tinjau CV-mu'
		]) {
			await advance(page, title, true);
		}
	} else {
		await page
			.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true })
			.click();
		const experience = page.locator('.collection-steps .item-card').last();
		const role = experience.getByRole('combobox', { name: 'Posisi / peran', exact: true });
		await role.fill('Web Developer');
		await role.press('Escape');
		await experience.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
		await advance(page, 'Organisasi & kepanitiaan');
		await advance(page, 'Proyek', true);
		await page.getByRole('button', { name: 'Tambah Proyek', exact: true }).click();
		await page.getByLabel('Nama', { exact: true }).fill('Portal Alumni');
		await advance(page, 'Keahlian & pencapaian');
		const skill = page.getByRole('combobox', { name: 'Keahlian teknis', exact: true });
		await skill.fill('TypeScript');
		await skill.press('Enter');
		await page.getByRole('button', { name: 'Tambah Prestasi & penghargaan', exact: true }).click();
		await page.getByLabel('Judul prestasi', { exact: true }).fill('Juara Hackathon');
		await page.getByLabel('Penerbit / penyelenggara', { exact: true }).fill('Kampus Contoh');
		await advance(page, 'Ringkasan profil');
		await page
			.getByLabel('Ringkasan profil', { exact: true })
			.fill(
				'Lulusan Sistem Informasi dengan pengalaman mengembangkan portal alumni memakai TypeScript.'
			);
		await advance(page, 'Tinjau CV-mu');
	}
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function enterEditor(page: Page, minimal = false) {
	const id = await createDone(page, false, minimal);
	await page.getByText('Ubah lagi', { exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
	await expect(editor(page)).toBeVisible();
	return id;
}

async function editTab(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		await editor(page).getByRole('button', { name: 'Ubah', exact: true }).click();
	}
}

async function preview(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		await editor(page).getByRole('button', { name: 'Preview', exact: true }).click();
	}
	const result = editor(page).getByTestId('cv-preview');
	await expect(result).toBeVisible();
	return result;
}

async function openSection(page: Page, key: string) {
	await editTab(page);
	const current = section(page, key);
	const heading = current.locator('button[aria-expanded]').first();
	if ((await heading.getAttribute('aria-expanded')) !== 'true') await heading.click();
	return current;
}

async function menu(page: Page, key: string) {
	await editTab(page);
	const current = section(page, key);
	const trigger = current.locator('summary[aria-label^="Aksi bagian:"]');
	if (!(await trigger.evaluate((element) => element.parentElement?.hasAttribute('open')))) {
		await trigger.click();
	}
	return current;
}

async function order(page: Page) {
	return sections(page).evaluateAll((items) =>
		items.map((item) => item.getAttribute('data-section-key'))
	);
}

async function assertNoPersonalCopies(page: Page) {
	await expect(page.getByText(name)).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			[
				document.body.textContent ?? '',
				...Array.from(
					document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
					(field) => field.value
				)
			].some((value) =>
				/Nadia Editor|nadia\.editor@example\.com|linkedin\.com\/in\/nadia-editor/.test(value)
			)
		)
	).toBe(false);
}

async function dashboardAction(page: Page, action: string) {
	const card = page.getByTestId('cv-card').first();
	await expect(card).toBeVisible();
	const direct = card.getByRole('button', { name: action, exact: true });
	if (await direct.isVisible()) await direct.click();
	else {
		await card.getByRole('button', { name: /^Aksi lain untuk / }).click();
		await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click();
	}
}

test('completed dashboard CV opens full editor, saves edits and fits phone tablet and desktop', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const id = await createDone(page);
	await page.goto('/cv');
	await page.getByTestId('cv-card').getByRole('link', { name: 'Ubah', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
	await expect(editor(page)).toBeVisible();
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Sudah Diubah');
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	await expect(saved(page)).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(page.getByLabel(/^Nama lengkap\b/)).toHaveValue('Nadia Sudah Diubah');
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await editTab(page);
		await expect(page.getByLabel(/^Nama lengkap\b/)).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			),
			`edit ${width}`
		).toBeLessThanOrEqual(0);
		const paper = await preview(page);
		await expect(paper).toContainText('Nadia Sudah Diubah');
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			),
			`preview ${width}`
		).toBeLessThanOrEqual(0);
	}
	expect(errors).toEqual([]);
});

test('section movement updates preview order, keeps focus, announces position and supports undo redo and reload', async ({
	page
}) => {
	await enterEditor(page);
	const initial = await order(page);
	const up = section(page, 'skills').getByRole('button', {
		name: 'Pindah ke atas: Keahlian',
		exact: true
	});
	await up.click();
	await expect(up).toBeFocused();
	await up.click();
	await expect(up).toBeFocused();
	await expect(page.getByTestId('section-order-status')).toHaveText(
		'Keahlian kini di posisi 4 dari 9'
	);
	const moved = await order(page);
	expect(moved.indexOf('skills')).toBe(initial.indexOf('skills') - 2);
	const paper = await preview(page);
	await expect
		.poll(async () => {
			const titles = await paper.getByRole('heading', { level: 2 }).allTextContents();
			return titles.includes('Keahlian') && titles.indexOf('Keahlian') < titles.indexOf('Proyek');
		})
		.toBe(true);
	await editTab(page);
	await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
	expect((await order(page)).indexOf('skills')).toBe(initial.indexOf('skills') - 1);
	await editor(page).getByRole('button', { name: 'Ulangi', exact: true }).click();
	expect(await order(page)).toEqual(moved);
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	await page.reload();
	await expect(editor(page)).toBeVisible();
	expect(await order(page)).toEqual(moved);
});

test('hidden awards retain content and section title can be renamed then reset to its default', async ({
	page
}) => {
	await enterEditor(page);
	await (
		await menu(page, 'awards')
	)
		.getByRole('switch', { name: 'Tampilkan di CV', exact: true })
		.uncheck();
	await expect(section(page, 'awards')).toContainText('Disembunyikan');
	await expect(await preview(page)).not.toContainText('Juara Hackathon');
	await (
		await menu(page, 'awards')
	)
		.getByRole('switch', { name: 'Tampilkan di CV', exact: true })
		.check();
	await expect(await preview(page)).toContainText('Juara Hackathon');
	await (
		await menu(page, 'experience')
	)
		.getByRole('button', { name: 'Ganti judul', exact: true })
		.click();
	const rename = page.getByRole('dialog', { name: 'Ganti judul bagian', exact: true });
	const title = rename.getByLabel('Judul bagian', { exact: true });
	await expect(title).toHaveAttribute('maxlength', '150');
	await title.fill('Pengalaman Magang');
	await rename.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(
		(await preview(page)).getByRole('heading', { name: 'Pengalaman Magang', exact: true })
	).toBeVisible();
	await (
		await menu(page, 'experience')
	)
		.getByRole('button', { name: 'Ganti judul', exact: true })
		.click();
	await title.fill('');
	await rename.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(
		(await preview(page)).getByRole('heading', { name: 'Pengalaman Kerja', exact: true })
	).toBeVisible();
	await expect(page.getByTestId('cv-preview')).not.toContainText('Pengalaman Magang');
});

test('custom section supports item and bullet, enforces five sections and can be deleted then restored', async ({
	page
}) => {
	await enterEditor(page, true);
	async function add(title: string) {
		await editor(page).getByRole('button', { name: 'Tambah section', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Tambah section kustom', exact: true });
		await dialog.getByLabel(/^Judul bagian\b/).fill(title);
		await dialog.getByRole('button', { name: 'Tambah', exact: true }).click();
	}
	await add('Pelatihan');
	const custom = sections(page)
		.filter({ has: page.getByRole('button', { name: /^Pelatihan/ }) })
		.first();
	const key = await custom.getAttribute('data-section-key');
	if (!key) throw new Error('New custom section must have a stable key.');
	await openSection(page, key);
	await custom.getByRole('button', { name: 'Tambah Pelatihan', exact: true }).click();
	await custom.getByLabel('Judul', { exact: true }).fill('Pelatihan Aksesibilitas');
	await custom.getByLabel('Subjudul (opsional)', { exact: true }).fill('Komunitas Web');
	await custom.getByRole('button', { name: 'Tambah poin', exact: true }).click();
	await custom
		.getByLabel('Poin 1', { exact: true })
		.fill('Mengaudit navigasi keyboard pada tiga halaman.');
	await expect(await preview(page)).toContainText('Pelatihan Aksesibilitas');
	await expect(page.getByTestId('cv-preview')).toContainText(
		'Mengaudit navigasi keyboard pada tiga halaman.'
	);
	await editTab(page);
	for (const title of ['Publikasi', 'Kegiatan Sukarela', 'Kursus', 'Komunitas']) await add(title);
	await expect(
		editor(page).getByRole('button', { name: 'Tambah section', exact: true })
	).toBeDisabled();
	await expect(
		page.locator('[data-testid="editor-section"][data-section-key^="custom:"]')
	).toHaveCount(5);
	await (await menu(page, key)).getByRole('button', { name: 'Hapus section', exact: true }).click();
	const confirmation = page.getByRole('dialog', { name: /Hapus section/ });
	await expect(confirmation).toContainText('Pelatihan');
	await expect(confirmation).toContainText('1');
	await confirmation.getByRole('button', { name: 'Hapus', exact: true }).click();
	await expect(section(page, key)).toHaveCount(0);
	await page
		.getByRole('status', { name: 'Notifikasi', exact: true })
		.getByRole('button', { name: 'Urungkan', exact: true })
		.click();
	await expect(section(page, key)).toBeVisible();
	await expect(await preview(page)).toContainText('Pelatihan Aksesibilitas');
});

test('text field shortcuts keep browser undo and cross-tab removal purges every editor copy', async ({
	page,
	context
}) => {
	await enterEditor(page, true);
	const summary = (await openSection(page, 'summary')).getByLabel('Ringkasan profil', {
		exact: true
	});
	const fullName = page.getByLabel(/^Nama lengkap\b/);
	await fullName.fill('Nadia Editor Tetap');
	await summary.click();
	await summary.press('End');
	await summary.pressSequentially(' Tambahan lewat editor.');
	await page.evaluate(() => {
		const state = window as typeof window & {
			editorShortcutEvents?: {
				key: string;
				defaultPrevented: boolean;
				target: string;
				id: string;
			}[];
		};
		state.editorShortcutEvents = [];
		// Registered after the editor's window handler, so this observes its final decision.
		window.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase()))
				return;
			state.editorShortcutEvents?.push({
				key: event.key.toLowerCase(),
				defaultPrevented: event.defaultPrevented,
				target: event.target instanceof Element ? event.target.tagName : '',
				id: event.target instanceof Element ? event.target.id : ''
			});
		});
	});
	for (const shortcut of ['Control+z', 'Control+Shift+z', 'Control+y']) {
		await page.keyboard.press(shortcut);
		await expect(fullName).toHaveValue('Nadia Editor Tetap');
	}
	const shortcutEvents = await page.evaluate(
		() =>
			(
				window as typeof window & {
					editorShortcutEvents?: {
						key: string;
						defaultPrevented: boolean;
						target: string;
						id: string;
					}[];
				}
			).editorShortcutEvents
	);
	expect(shortcutEvents).toEqual([
		{ key: 'z', defaultPrevented: false, target: 'TEXTAREA', id: 'summary' },
		{ key: 'z', defaultPrevented: false, target: 'TEXTAREA', id: 'summary' },
		{ key: 'y', defaultPrevented: false, target: 'TEXTAREA', id: 'summary' }
	]);
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	const other = await context.newPage();
	try {
		await other.goto('/cv');
		await dashboardAction(other, 'Hapus');
		await other
			.getByRole('dialog', { name: 'Hapus CV ini?', exact: true })
			.getByRole('button', { name: 'Hapus', exact: true })
			.click();
		await expect(page.getByTestId('removed-cv')).toBeVisible();
		await expect(page.locator('.editor-form, .editor-toolbar')).toHaveCount(0);
		await expect(page.getByTestId('cv-preview')).toHaveCount(0);
		await expect(
			page.getByTestId('removed-cv').getByRole('link', { name: 'Buat CV baru', exact: true })
		).toBeVisible();
		await assertNoPersonalCopies(page);
		await page.keyboard.press('Control+z');
		await assertNoPersonalCopies(page);
	} finally {
		await other.close();
	}
});

test('editor tools open without leaving, preview links stay in app and PDF returns to editor', async ({
	page
}) => {
	const id = await enterEditor(page);
	const paper = await preview(page);
	const destination = page.url();
	await paper.locator(`a[href="${linkedIn}"]`).click();
	await expect(page).toHaveURL(destination);
	await editTab(page);
	await editor(page).getByRole('button', { name: 'Cari lowongan', exact: true }).click();
	await expect(
		page.getByRole('dialog', { name: 'Cari lowongan', exact: true }).getByTestId('job-links')
	).toBeVisible();
	await page.keyboard.press('Escape');
	await editor(page).getByRole('button', { name: 'Cek ATS', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Cek ATS', exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await editor(page).getByRole('button', { name: 'Unduh', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Unduh', exact: true })
		.getByRole('link', { name: 'PDF untuk melamar', exact: true })
		.click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/print(?:\\?.*)?$`));
	await expect(page.getByTestId('print-paper')).toContainText(name);
	await page.getByRole('link', { name: /Kembali/ }).click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
	await expect(editor(page)).toBeVisible();
});

test('incomplete CV redirects to wizard and missing editor CV offers dashboard navigation', async ({
	page
}) => {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	const id = new URL(page.url()).pathname.split('/').at(-1)!;
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	await page.goto(`/cv/${id}/edit`);
	await expect(page).toHaveURL(new RegExp(`/buat/${id}$`));
	await expect(page.locator('.step-heading h1')).toBeVisible();
	await page.goto('/cv/00000000-0000-4000-8000-000000000000/edit');
	await expect(editor(page)).toHaveCount(0);
	await page.getByRole('link', { name: 'CV Saya', exact: true }).last().click();
	await expect(page).toHaveURL(/\/cv$/);
});

test('starting incognito from editor flushes immediate normal edits before switching repository', async ({
	page
}) => {
	await enterEditor(page, true);
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Tersimpan Normal');
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Nyalakan', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
	await expect(
		page.locator('.app-header').getByRole('button', { name: 'Mode Incognito', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.resume-card')).toHaveCount(0);
	await page
		.locator('.app-header')
		.getByRole('button', { name: 'Mode Incognito', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Mode Incognito aktif', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Akhiri & hapus', exact: true })
		.click();
	await expect(page).toHaveURL(/\/buat$/);
	await page.goto('/cv');
	await expect(page.getByTestId('cv-card')).toHaveCount(1);
	await expect(page.getByTestId('cv-card')).toContainText('Nadia Tersimpan Normal');
});

test('idle incognito expiry clears full editor preview and private field values', async ({
	page
}) => {
	await page.clock.install();
	const id = await createDone(page, true, true);
	await page.getByText('Ubah lagi', { exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/cv/${id}/edit$`));
	await expect(editor(page)).toBeVisible();
	for (const label of [/^Nama lengkap\b/, /^Email\b/, /^Nomor HP\b/]) {
		await expect(page.getByLabel(label)).toHaveAttribute('autocomplete', 'off');
	}
	await expect(saved(page)).toHaveText('Tersimpan di tab ini');
	await page.clock.fastForward('03:02:00');
	await expect(page.getByTestId('removed-cv')).toBeVisible();
	await expect(page.getByTestId('removed-cv')).toContainText('3 jam tidak ada perubahan');
	await expect(page.locator('.editor-form, .editor-toolbar')).toHaveCount(0);
	await expect(page.getByTestId('cv-preview')).toHaveCount(0);
	await assertNoPersonalCopies(page);
});

test('desktop pointer drag reorders a section and keyboard buttons remain available', async ({
	page
}) => {
	await enterEditor(page);
	await page.setViewportSize({ width: 1280, height: 1100 });
	const initial = await order(page);
	const handle = section(page, 'skills').getByRole('button', {
		name: 'Seret untuk memindah: Keahlian',
		exact: true
	});
	const target = section(page, 'projects').locator('[data-section-toggle]');
	await handle.scrollIntoViewIfNeeded();
	await target.scrollIntoViewIfNeeded();
	const from = await handle.boundingBox();
	const to = await target.boundingBox();
	if (!from || !to) throw new Error('Drag handle and destination must be on screen.');
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect
		.poll(async () => (await order(page)).indexOf('skills'))
		.toBe(initial.indexOf('projects'));
	await expect(handle).toBeFocused();
	await expect(page.getByTestId('section-order-status')).toHaveText(
		'Keahlian kini di posisi 5 dari 9'
	);
	const up = section(page, 'skills').getByRole('button', {
		name: 'Pindah ke atas: Keahlian',
		exact: true
	});
	await up.click();
	await expect(up).toBeFocused();
	expect((await order(page)).indexOf('skills')).toBe(initial.indexOf('projects') - 1);
});

test('editor controls translate to English independently from Indonesian CV section titles', async ({
	page
}) => {
	await enterEditor(page);
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(editor(page).getByRole('heading', { name: 'Edit CV', exact: true })).toBeVisible();
	await expect(page.getByLabel(/^Full name\b/)).toHaveValue(name);
	for (const label of ['Download', 'Check ATS', 'Find jobs']) {
		await expect(editor(page).getByRole('button', { name: label, exact: true })).toBeVisible();
	}
	await expect(
		section(page, 'skills').getByRole('button', { name: 'Move up: Keahlian', exact: true })
	).toBeVisible();
	await section(page, 'experience')
		.locator('summary[aria-label="Section actions: Pengalaman Kerja"]')
		.click();
	await section(page, 'experience')
		.getByRole('button', { name: 'Rename section', exact: true })
		.click();
	const rename = page.getByRole('dialog', { name: 'Rename section', exact: true });
	await expect(rename.getByLabel('Section title', { exact: true })).toBeVisible();
	await expect(rename).toContainText('Default title: Pengalaman Kerja. Leave blank to use it.');
	await page.keyboard.press('Escape');
	await editor(page).getByRole('button', { name: 'Add section', exact: true }).click();
	const add = page.getByRole('dialog', { name: 'Add custom section', exact: true });
	await add.getByLabel(/^Section title\b/).fill('English training');
	await add.getByRole('button', { name: 'Add', exact: true }).click();
	const custom = sections(page).filter({
		has: page.getByRole('button', { name: 'English training', exact: true })
	});
	await custom.getByRole('button', { name: 'Add English training', exact: true }).click();
	await custom.getByLabel('Title', { exact: true }).fill('Accessibility workshop');
	await expect(custom.getByLabel('Subtitle (optional)', { exact: true })).toBeVisible();
	if ((page.viewportSize()?.width ?? 0) < 1024) {
		await editor(page).getByRole('button', { name: 'Preview', exact: true }).click();
	}
	await expect(editor(page).getByTestId('cv-preview')).toContainText('Accessibility workshop');
	await expect(
		editor(page).getByTestId('cv-preview').getByRole('heading', { name: 'Pendidikan', exact: true })
	).toBeVisible();
});
