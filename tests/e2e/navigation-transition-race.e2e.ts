import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface HeldNavigation {
	armed: boolean;
	held: boolean;
	released: boolean;
	resumed: boolean;
	callbackSettled: boolean;
	finished: boolean;
	release: () => void;
}
interface NavigationWindow {
	heldNavigation: HeldNavigation;
}

const normalTitle = 'CV Normal Transisi';
const normalName = 'Nadia Tetap Tersimpan';
const secretName = 'Rahasia Transisi';
const banner = (page: Page) => page.getByRole('region', { name: 'Mode Incognito', exact: true });
const control = (page: Page) =>
	page.locator('.app-header').getByRole('button', { name: 'Mode Incognito', exact: true });

async function personal(page: Page, title: string, name: string) {
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Bahasa & posisi tujuan');
	await page.getByLabel('Judul CV', { exact: true }).fill(title);
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(name);
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-save-state', 'saved');
}

test('opening an Incognito dialog releases pending navigation without restoring a stale secret URL', async ({
	page,
	baseURL
}, testInfo) => {
	test.skip(
		testInfo.project.name !== 'mobile-360',
		'The native transition race uses mobile Chromium.'
	);
	if (!baseURL) throw new Error('A local production preview is required.');
	const origin = new URL(baseURL).origin;
	const unexpected: string[] = [];
	const navigations: string[] = [];
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname);
	});
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			unexpected.push(url.href);
			return route.abort();
		}
		if (url.pathname === '/api/hello') return route.fulfill({ json: { visitors: 1234 } });
		if (url.pathname === '/api/ai/quota')
			return route.fulfill({
				json: { limit: 3, remaining: 3, resetsAt: '2026-11-11T17:00:00.000Z' }
			});
		if (url.pathname.startsWith('/api/')) {
			unexpected.push(url.pathname);
			return route.fulfill({ status: 503, json: { error: 'unavailable' } });
		}
		return route.continue();
	});
	await page.addInitScript(() => {
		if (typeof document.startViewTransition !== 'function') return;
		const state = window as unknown as NavigationWindow;
		let resume = () => {};
		const paused = new Promise<void>((done) => (resume = done));
		const gate: HeldNavigation = {
			armed: false,
			held: false,
			released: false,
			resumed: false,
			callbackSettled: false,
			finished: false,
			release: () => {
				gate.released = true;
				resume();
			}
		};
		state.heldNavigation = gate;
		const native = document.startViewTransition.bind(document);
		document.startViewTransition = (...args: Parameters<typeof native>) => {
			const update = args[0];
			if (!gate.armed || typeof update !== 'function') return native(...args);
			gate.armed = false;
			const transition = native(async () => {
				gate.held = true;
				await paused;
				gate.resumed = true;
				try {
					await update();
				} finally {
					gate.callbackSettled = true;
				}
			});
			void transition.finished.then(
				() => (gate.finished = true),
				() => (gate.finished = true)
			);
			return transition;
		};
	});

	let secretPath = '';
	let afterLateCallback: unknown;
	try {
		await page.goto('/buat');
		await personal(page, normalTitle, normalName);
		await page.goto('/buat');
		await expect(page.locator('.resume-card')).toHaveCount(1);
		await control(page).click();
		await page
			.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
			.getByRole('button', { name: 'Nyalakan', exact: true })
			.click();
		await expect(banner(page)).toBeVisible();
		await expect(page.locator('.resume-card')).toHaveCount(0);
		await personal(page, 'CV Rahasia Transisi', secretName);
		secretPath = new URL(page.url()).pathname;
		page.on('dialog', (dialog) => dialog.accept());
		await page.reload();
		await expect(
			page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
		).toBeVisible();
		await expect(banner(page)).toBeVisible();
		expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function');
		await page.evaluate(() => {
			(window as unknown as NavigationWindow).heldNavigation.armed = true;
		});
		const create = page.getByRole('link', { name: 'Buat CV baru', exact: true });
		await create.focus();
		await page.keyboard.press('Enter');
		await expect
			.poll(() => page.evaluate(() => (window as unknown as NavigationWindow).heldNavigation.held))
			.toBe(true);

		// A native transition overlay can intercept a pointer; the focused header remains keyboard usable.
		await control(page).focus();
		await page.keyboard.press('Enter');
		const info = page.getByRole('dialog', { name: 'Mode Incognito aktif', exact: true });
		await expect(info).toBeVisible();
		// Opening the dialog must release navigation even while its native update callback is held.
		await expect(page).toHaveURL(/\/buat$/);
		await expect(
			page.getByRole('heading', { name: 'Pilih jenis CV-mu', exact: true })
		).toBeVisible();
		expect(
			await page.evaluate(() => (window as unknown as NavigationWindow).heldNavigation.released)
		).toBe(false);
		await info.getByRole('button', { name: 'Akhiri & hapus', exact: true }).focus();
		await page.keyboard.press('Enter');
		const end = page.getByRole('dialog', { name: 'Akhiri Mode Incognito?', exact: true });
		await expect(end).toBeVisible();
		await end.getByRole('button', { name: 'Akhiri & hapus', exact: true }).focus();
		await page.keyboard.press('Enter');
		await expect(banner(page)).toHaveCount(0);
		await expect(page).toHaveURL(/\/buat$/);
		await page.evaluate(() => (window as unknown as NavigationWindow).heldNavigation.release());
		await expect
			.poll(() =>
				page.evaluate(() => (window as unknown as NavigationWindow).heldNavigation.callbackSettled)
			)
			.toBe(true);
		await expect
			.poll(() =>
				page.evaluate(() => (window as unknown as NavigationWindow).heldNavigation.finished)
			)
			.toBe(true);
		await page.evaluate(
			() =>
				new Promise<void>((done) =>
					requestAnimationFrame(() => requestAnimationFrame(() => done()))
				)
		);
		await expect(page).toHaveURL(/\/buat$/);
		expect(new URL(page.url()).pathname).not.toBe(secretPath);
		await expect(
			page.getByRole('heading', { name: 'CV tidak ditemukan', exact: true })
		).toHaveCount(0);
		await expect(control(page)).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.resume-card')).toHaveCount(1);
		await expect(page.locator('.resume-card')).toContainText(normalTitle);
		afterLateCallback = await page.evaluate(() => {
			const held = (window as unknown as NavigationWindow).heldNavigation;
			return { url: location.href, ...held, release: undefined };
		});
		await page.goto('/cv');
		const cards = page.getByTestId('cv-card');
		await expect(cards).toHaveCount(1);
		await expect(cards).toContainText(normalTitle);
		await expect(cards).toContainText(normalName);
		await expect(page.getByText(secretName)).toHaveCount(0);
		expect(unexpected).toEqual([]);
	} finally {
		const gate = await page
			.evaluate(() => {
				const held = (window as unknown as NavigationWindow).heldNavigation;
				if (!held) return null;
				const result = { ...held, release: undefined };
				held.release();
				return result;
			})
			.catch(() => null);
		const phase = process.env.NAV_RACE_PHASE === 'before' ? 'before' : 'after';
		const result = {
			phase,
			url: page.url(),
			secretPath,
			afterLateCallback,
			gate,
			navigations,
			unexpected
		};
		const dir = resolve('.svelte-kit', `smooth-navigation-race-${phase}`);
		await mkdir(dir, { recursive: true });
		await writeFile(resolve(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
		console.log(`NAVIGATION_RACE ${JSON.stringify(result)}`);
	}
});
