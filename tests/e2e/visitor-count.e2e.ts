import { expect, test, type Page } from '@playwright/test';

async function mockVisitors(page: Page, visitors: number) {
	await page.route('**/api/hello', (route) => route.fulfill({ status: 200, json: { visitors } }));
}

test('the all-time count uses ID and EN formatting without moving the landing content', async ({
	page
}) => {
	let deliver!: () => void;
	const ready = new Promise<void>((resolve) => (deliver = resolve));
	const methods: string[] = [];
	await page.route('**/api/hello', async (route) => {
		methods.push(route.request().method());
		await ready;
		await route.fulfill({ status: 200, json: { visitors: 1234 } });
	});
	await page.goto('/');
	await expect.poll(() => methods.length).toBe(1);
	await page.evaluate(() => document.fonts.ready);
	const before = await page.locator('.how-section').boundingBox();
	await expect(page.getByTestId('visitor-count-slot')).toBeEmpty();
	await page.evaluate(() => {
		const shifts: number[] = [];
		(window as unknown as { visitorShifts: number[] }).visitorShifts = shifts;
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
				if (!shift.hadRecentInput) shifts.push(shift.value);
			}
		}).observe({ type: 'layout-shift' });
	});
	deliver();
	const counter = page.getByTestId('visitor-count');
	await expect(counter).toHaveAttribute('aria-label', '1.234 pengunjung');
	await expect(page.getByRole('status', { name: '1.234 pengunjung', exact: true })).toBeVisible();
	await expect(counter.locator('strong')).toHaveText('1.234');
	await expect(counter.locator('.visitor-value')).toHaveAttribute('aria-hidden', 'true');
	await expect(counter).toHaveAttribute('aria-live', 'off');
	const after = await page.locator('.how-section').boundingBox();
	expect(before).not.toBeNull();
	expect(after).not.toBeNull();
	expect(after!.y).toBeCloseTo(before!.y, 1);
	const shifts = await page.evaluate(
		() => (window as unknown as { visitorShifts: number[] }).visitorShifts
	);
	expect(shifts.reduce((sum, shift) => sum + shift, 0)).toBe(0);
	expect(methods).toEqual(['GET']);
	expect(await page.evaluate(() => localStorage.getItem('cvmaker.visitor'))).toBeNull();

	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(counter).toHaveAttribute('aria-label', '1,234 visitors');
	await expect(counter.locator('strong')).toHaveText('1,234');
	for (const width of [320, 360, 768, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBeLessThanOrEqual(0);
	}
	await page.locator('footer a[href="/faq"]').click();
	await expect(page).toHaveURL(/\/faq$/);
	await page.locator('.site-header a.brand').click();
	await expect(counter.locator('strong')).toHaveText('1,234');
	expect(methods).toEqual(['GET']);
});

test('an unavailable API removes the counter and its reserved space', async ({ page }) => {
	await page.route('**/api/hello', (route) =>
		route.fulfill({ status: 404, json: { error: 'unavailable' } })
	);
	await page.goto('/');
	await expect(page.getByTestId('visitor-count-slot')).toHaveCount(0);
	await expect(page.getByTestId('visitor-count')).toHaveCount(0);
	await expect(page.locator('.hero-copy > :last-child')).toHaveAttribute('href', '/cek-ats');
	await expect(page.getByText('pengunjung', { exact: true })).toHaveCount(0);
});

test('reduced motion shows only the final number from the first rendered counter', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	let deliver!: () => void;
	const ready = new Promise<void>((resolve) => (deliver = resolve));
	await page.route('**/api/hello', async (route) => {
		await ready;
		await route.fulfill({ status: 200, json: { visitors: 1234 } });
	});
	await page.goto('/');
	await expect(page.getByTestId('visitor-count-slot')).toHaveCount(1);
	await page.evaluate(() => {
		const values: string[] = [];
		(window as unknown as { visitorFrames: string[] }).visitorFrames = values;
		const slot = document.querySelector('[data-testid="visitor-count-slot"]');
		if (!slot) throw new Error('The reserved counter slot is missing.');
		new MutationObserver(() => {
			const number = slot.querySelector('strong')?.textContent;
			if (number) values.push(number);
		}).observe(slot, { childList: true, subtree: true, characterData: true });
	});
	deliver();
	await expect(page.getByTestId('visitor-count').locator('strong')).toHaveText('1.234');
	const values = await page.evaluate(
		() => (window as unknown as { visitorFrames: string[] }).visitorFrames
	);
	expect(values.length).toBeGreaterThan(0);
	expect(values.every((value) => value === '1.234')).toBe(true);
});

test('a genuine zero is shown and English uses the singular only for one visitor', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	let visitors = 1;
	await page.route('**/api/hello', (route) => route.fulfill({ status: 200, json: { visitors } }));
	await page.goto('/');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.getByTestId('visitor-count')).toHaveAttribute('aria-label', '1 visitor');
	await expect(page.getByTestId('visitor-count').locator('strong')).toHaveText('1');
	visitors = 0;
	await page.reload();
	await expect(page.getByTestId('visitor-count')).toHaveAttribute('aria-label', '0 visitors');
	await expect(page.getByTestId('visitor-count').locator('strong')).toHaveText('0');
});

test('the root layout counts other pages once and Incognito keeps the new ID only in memory', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, 'webdriver', {
			configurable: true,
			get: () => false
		});
	});
	const requests: { method: string; body: Record<string, unknown> }[] = [];
	await page.route('**/api/hello', (route) => {
		const request = route.request();
		requests.push({ method: request.method(), body: request.postDataJSON() });
		return route.fulfill({ status: 200, json: { visitors: 42 } });
	});
	await page.goto('/buat');
	await expect.poll(() => requests.length).toBe(1);
	expect(requests[0]!.method).toBe('POST');
	expect(Object.keys(requests[0]!.body)).toEqual(['visitor']);
	expect(requests[0]!.body.visitor).toMatch(/^[\w-]{22}$/);
	const normalId = await page.evaluate(() => localStorage.getItem('cvmaker.visitor'));
	expect(normalId).toBe(requests[0]!.body.visitor);
	await page.getByRole('button', { name: 'Mode Incognito', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
		.getByRole('button', { name: 'Nyalakan', exact: true })
		.click();
	await expect(page.getByRole('button', { name: 'Mode Incognito', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.reload();
	await expect.poll(() => requests.length).toBe(2);
	expect(requests[1]!.method).toBe('POST');
	expect(requests[1]!.body.visitor).toMatch(/^[\w-]{22}$/);
	expect(requests[1]!.body.visitor).not.toBe(normalId);
	expect(await page.evaluate(() => localStorage.getItem('cvmaker.visitor'))).toBe(normalId);
	await page.locator('.app-header a').first().click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByTestId('visitor-count')).toHaveAttribute('aria-label', '42 pengunjung');
	expect(requests).toHaveLength(2);
});

test('privacy explains the counter ID and hashes in both interface languages', async ({ page }) => {
	await mockVisitors(page, 1234);
	await page.goto('/privasi');
	const paragraph = page.getByText(/^Untuk menghitung pengunjung, browser menyimpan ID acak/);
	await expect(paragraph).toBeVisible();
	await expect(paragraph).toContainText('tanpa cookie');
	await expect(paragraph).toContainText('hash dari ID dan alamat IP');
	await expect(paragraph).toContainText('Hapus semua data');
	await expect(paragraph).toContainText('hanya ada di memori tab');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	const english = page.getByText(/^To count visitors, your browser stores a random ID/);
	await expect(english).toBeVisible();
	await expect(english).toContainText('without cookies');
	await expect(english).toContainText('hashes of the ID and IP address');
	await expect(english).toContainText('Delete all data');
	await expect(english).toContainText('only in tab memory');
	await expect(page.getByTestId('visitor-count')).toHaveCount(0);
});

test('online now is shown next to the visitor count in both languages, without moving content', async ({
	page
}) => {
	await page.route('**/api/hello', (route) =>
		route.fulfill({ status: 200, json: { visitors: 1234, online: 3 } })
	);
	await page.goto('/');
	const counter = page.getByTestId('visitor-count');
	await expect(counter).toHaveAttribute('aria-label', '3 sedang online, 1.234 pengunjung');
	await expect(page.getByTestId('online-count')).toHaveText(/3\s*sedang online/);
	await expect(page.getByTestId('online-count')).toHaveAttribute('aria-hidden', 'true');
	const slot = await page.getByTestId('visitor-count-slot').boundingBox();
	const pill = await counter.boundingBox();
	expect(Math.round(pill?.height ?? 0)).toBeLessThanOrEqual(Math.round(slot?.height ?? 0));
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(counter).toHaveAttribute('aria-label', '3 online now, 1,234 visitors');
});
