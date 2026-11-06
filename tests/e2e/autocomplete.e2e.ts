import { expect, test, type Page } from '@playwright/test';

const heading = (page: Page) => page.locator('.step-heading h1');
const next = (page: Page) => page.getByRole('button', { name: 'Lanjut', exact: true });

async function start(page: Page, targetRole = '') {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	if (targetRole) {
		await page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true }).fill(targetRole);
		await page.locator('#targetRole').press('Escape');
	}
}

async function education(page: Page, targetRole = '') {
	await start(page, targetRole);
	await next(page).click();
	await page.getByLabel('Nama lengkap').fill('Nadia Putri');
	await page.getByLabel('Email', { exact: false }).fill('nadia@example.com');
	await page.getByLabel('Nomor HP').fill('081234567890');
	await next(page).click();
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false })
		.fill('Universitas Nusantara');
	await page.getByRole('combobox', { name: 'Nama sekolah / kampus', exact: false }).press('Escape');
}

async function skills(page: Page, targetRole = '') {
	await education(page, targetRole);
	await next(page).click();
	for (let step = 4; step <= 6; step++)
		await page.getByRole('button', { name: 'Lewati', exact: true }).click();
	await expect(heading(page)).toHaveText('Keahlian & pencapaian');
}

test('major keyboard selection and arbitrary text survive reload, and touch can choose an option', async ({
	page
}, testInfo) => {
	await education(page);
	const major = page.getByRole('combobox', { name: 'Jurusan', exact: true });
	await expect(major).toHaveAttribute('autocomplete', 'off');
	await expect(major).toHaveAttribute('aria-autocomplete', 'list');
	await major.fill('akun');
	const accounting = page.getByRole('option', { name: 'Akuntansi', exact: true });
	await expect(accounting).toBeVisible();
	await expect(accounting.locator('strong')).toHaveText(/akun/i);
	const listId = await major.getAttribute('aria-controls');
	expect(listId).toBeTruthy();
	await expect(page.locator(`[id="${listId}"]`)).toHaveAttribute('role', 'listbox');
	await major.press('ArrowDown');
	await expect(accounting).toHaveAttribute('aria-selected', 'true');
	await expect(major).toHaveAttribute(
		'aria-activedescendant',
		(await accounting.getAttribute('id'))!
	);
	await major.press('Enter');
	await expect(major).toHaveValue('Akuntansi');
	await expect(heading(page)).toHaveText('Pendidikan');
	await expect(major).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByTestId('save-status')).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(major).toHaveValue('Akuntansi');
	const custom = 'Studi Budaya Maritim Nusantara';
	await major.fill(custom);
	await major.press('Escape');
	await expect(page.getByTestId('save-status')).toHaveText('Tersimpan ✓');
	await page.reload();
	await expect(major).toHaveValue(custom);
	await major.fill('farm');
	const pharmacy = page.getByRole('option', { name: 'Farmasi', exact: true });
	await expect(pharmacy).toBeVisible();
	if (testInfo.project.name === 'desktop-1280') await pharmacy.click();
	else await pharmacy.tap();
	await expect(major).toHaveValue('Farmasi');
	await expect(major).toBeFocused();
	await expect(heading(page)).toHaveText('Pendidikan');
});

test('Escape and Tab dismiss suggestions without choosing, and a free Enter retains normal form behavior at 320 and 360px', async ({
	page
}) => {
	await education(page);
	const major = page.getByRole('combobox', { name: 'Jurusan', exact: true });
	for (const width of [320, 360]) {
		await page.setViewportSize({ width, height: 780 });
		await major.fill('akun');
		await expect(page.getByRole('option', { name: 'Akuntansi', exact: true })).toBeVisible();
		await major.press('ArrowDown');
		await major.press('Escape');
		await expect(major).toHaveValue('akun');
		await expect(major).toBeFocused();
		await expect(major).toHaveAttribute('aria-expanded', 'false');
		await expect(major).not.toHaveAttribute('aria-activedescendant');
		await major.fill('akunt');
		await expect(page.getByRole('option', { name: 'Akuntansi', exact: true })).toBeVisible();
		const box = await page.getByRole('listbox').boundingBox();
		const bar = await page.locator('.bottom-actions').boundingBox();
		expect(box).not.toBeNull();
		expect(bar).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(width);
		expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y + 1);
		const optionHeight = (await page.getByRole('option').first().boundingBox())!.height;
		expect(optionHeight).toBeGreaterThanOrEqual(44);
		await major.press('ArrowDown');
		await major.press('Tab');
		await expect(major).toHaveValue('akunt');
		await expect(page.getByLabel('IPK', { exact: true })).toBeFocused();
		await expect(major).toHaveAttribute('aria-expanded', 'false');
		expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
	}
	await major.fill('Jurusan Pilihan Pribadi');
	await major.press('Enter');
	await expect(heading(page)).toHaveText('Pengalaman kerja / magang');
});

test('a nursing skill chip adds once, disappears, supports Undo, and the matching summary example comes first', async ({
	page
}) => {
	await skills(page, 'Perawat');
	const recommendations = page.getByRole('region', {
		name: 'Disarankan untuk Perawat',
		exact: true
	});
	const nursing = recommendations.getByRole('button', { name: 'Asuhan Keperawatan', exact: true });
	await expect(nursing).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Hapus Asuhan Keperawatan', exact: true })
	).toHaveCount(0);
	await nursing.click();
	const selected = page.getByRole('region', { name: 'Keahlian teknis', exact: true });
	await expect(
		selected.getByRole('button', { name: 'Hapus Asuhan Keperawatan', exact: true })
	).toHaveCount(1);
	await expect(nursing).toHaveCount(0);
	await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
	await expect(nursing).toBeVisible();
	await expect(
		selected.getByRole('button', { name: 'Hapus Asuhan Keperawatan', exact: true })
	).toHaveCount(0);
	const skill = selected.getByRole('combobox', { name: 'Keahlian teknis', exact: true });
	await skill.fill('Asuhan');
	await expect(page.getByRole('option', { name: 'Asuhan Keperawatan', exact: true })).toBeVisible();
	await skill.press('ArrowDown');
	await skill.press('Enter');
	await expect(
		selected.getByRole('button', { name: 'Hapus Asuhan Keperawatan', exact: true })
	).toHaveCount(1);
	await expect(skill).toHaveValue('');
	await skill.fill('Asuhan');
	await expect(page.getByRole('option', { name: 'Asuhan Keperawatan', exact: true })).toHaveCount(
		0
	);
	await skill.press('Escape');
	await next(page).click();
	await expect(heading(page)).toHaveText('Ringkasan profil');
	await page.locator('.summary-examples > summary').click();
	await expect(page.locator('.summary-examples article').first().getByRole('heading')).toHaveText(
		'Kesehatan'
	);
	await expect(page.locator('.summary-examples article')).toHaveCount(14);
	await page.locator('.summary-examples .other-examples > summary').click();
	await expect(page.locator('.summary-examples article').last()).toBeVisible();
});

test('an empty target keeps popular soft skills and a target link, while suggestion content follows CV language', async ({
	page
}) => {
	await skills(page);
	const recommendations = page.getByRole('region', { name: 'Soft skill populer', exact: true });
	await expect(
		recommendations.getByRole('button', { name: 'Komunikasi', exact: true })
	).toBeVisible();
	await expect(recommendations.locator('[data-group="hard"], [data-group="tools"]')).toHaveCount(0);
	await recommendations.getByRole('button', { name: 'Isi posisi tujuan', exact: true }).click();
	await expect(heading(page)).toHaveText('Bahasa & posisi tujuan');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	const target = page.locator('#targetRole');
	await target.fill('pera');
	await expect(page.getByRole('option', { name: 'Perawat', exact: true })).toBeVisible();
	await target.press('Escape');
	await page.locator('#locale').selectOption('en');
	await target.fill('nurs');
	await expect(page.getByRole('option', { name: 'Nurse', exact: true })).toBeVisible();
	await target.press('ArrowDown');
	await target.press('Enter');
	await expect(target).toHaveValue('Nurse');
	await expect(heading(page)).toHaveText('CV language & target role');
});

test('a failed suggestion-data download leaves editable fields and autosave working', async ({
	page
}) => {
	// Every chunk is proxied through route.fetch() below, which makes page loads much slower
	// (especially with mobile emulation) — allow more time than the default 5 s per assertion.
	const slow = expect.configure({ timeout: 20_000 });
	let blocked = false;
	await page.route('**/_app/immutable/chunks/*.js', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		if (
			body.includes('skillsByCategory') &&
			body.includes('jobTitles') &&
			body.includes('Akuntansi')
		) {
			blocked = true;
			await route.abort();
		} else await route.fulfill({ response });
	});
	try {
		await start(page);
		await slow.poll(() => blocked).toBe(true);
		const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
		const custom = 'Koordinator Program Pilihan Saya';
		await target.fill(custom);
		await slow(target).toHaveValue(custom);
		await slow(target).toHaveAttribute('aria-expanded', 'false');
		await slow(page.getByTestId('save-status')).toHaveText('Tersimpan ✓');
		// Persistence check only: reload without the slow interception.
		await page.unrouteAll({ behavior: 'wait' });
		await page.reload();
		await slow(target).toHaveValue(custom);
	} finally {
		// Drain fetch handlers before Playwright disposes the page and starts the next test.
		await page.unrouteAll({ behavior: 'wait' });
	}
});
