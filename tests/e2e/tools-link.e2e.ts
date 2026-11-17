import { expect, test, type Locator, type Page } from '@playwright/test';

const toolsUrl = 'https://respawnsociety.web.id';
const copy = {
	id: {
		label: 'Alat Gambar & PDF',
		language: 'Bahasa Indonesia',
		newTab: '(membuka tab baru)',
		footer: 'Butuh alat gambar & PDF? → Respawn Society'
	},
	en: {
		label: 'Image & PDF tools',
		language: 'English',
		newTab: '(opens in a new tab)',
		footer: 'Need image & PDF tools? → Respawn Society'
	}
} as const;
type Locale = keyof typeof copy;
interface NetworkState {
	outside: string[];
	unexpected: string[];
	errors: string[];
}
const network = new WeakMap<Page, NetworkState>();

async function localOnly(page: Page, baseURL: string | undefined) {
	if (!baseURL) throw new Error('A local production preview URL is required.');
	const origin = new URL(baseURL).origin;
	const state: NetworkState = { outside: [], unexpected: [], errors: [] };
	network.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') state.errors.push(message.text());
	});
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			state.outside.push(url.href);
			return route.abort('blockedbyclient');
		}
		if (url.pathname === '/api/hello') return route.fulfill({ json: { visitors: 1234 } });
		if (url.pathname === '/api/ai/quota')
			return route.fulfill({
				json: {
					limit: 3,
					remaining: 3,
					resetsAt: '2099-11-17T17:00:00.000Z',
					lite: { limit: 20, remaining: 20 }
				}
			});
		if (url.pathname.startsWith('/api/')) {
			state.unexpected.push(`${route.request().method()} ${url.pathname}`);
			return route.fulfill({ status: 503, json: { error: 'unavailable' } });
		}
		return route.continue();
	});
}

async function externalContract(link: Locator, locale: Locale) {
	await expect(link).toHaveCount(1);
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('href', toolsUrl);
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
	await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
	await expect(link).toHaveAccessibleName(new RegExp(copy[locale].label));
	await expect(link).toHaveAccessibleName(new RegExp(copy[locale].newTab.replace(/[()]/g, '\\$&')));
	await expect(link.locator('.sr-only').filter({ hasText: copy[locale].newTab })).toHaveCount(1);
	await expect(link.locator('[aria-hidden="true"]')).toContainText('↗');
}

async function fitsAndReceivesPointer(scope: Locator, boundedByHeader = false) {
	const problems = await scope.evaluate((element, withinHeader) => {
		const header = element.closest('header') ?? element;
		const headerBox = header.getBoundingClientRect();
		const issues: string[] = [];
		for (const control of element.querySelectorAll<HTMLElement>('a,button,summary')) {
			const box = control.getBoundingClientRect();
			const style = getComputedStyle(control);
			if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none')
				continue;
			const label = control.textContent?.replace(/\s+/g, ' ').trim() ?? control.tagName;
			if (
				box.left < -1 ||
				box.right > innerWidth + 1 ||
				box.top < -1 ||
				box.bottom > innerHeight + 1
			)
				issues.push(`${label}: outside viewport`);
			if (withinHeader && (box.top < headerBox.top - 1 || box.bottom > headerBox.bottom + 1))
				issues.push(`${label}: outside header`);
			const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
			if (!hit || !control.contains(hit)) issues.push(`${label}: covered`);
			const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only')) continue;
				const range = document.createRange();
				range.selectNodeContents(node);
				for (const rect of range.getClientRects()) {
					if (rect.left < -1 || rect.right > innerWidth + 1)
						issues.push(`${label}: visible text clipped`);
				}
			}
		}
		return issues;
	}, boundedByHeader);
	expect(problems).toEqual([]);
	expect(
		await scope.page().evaluate(() => document.documentElement.scrollWidth - innerWidth)
	).toBeLessThanOrEqual(0);
}

async function siteMenu(page: Page) {
	const menu = page.locator('.site-header').getByRole('button', { name: 'Menu', exact: true });
	if ((await menu.isVisible()) && (await menu.getAttribute('aria-expanded')) !== 'true')
		await menu.click();
	return menu;
}

for (const theme of ['light', 'dark'] as const) {
	test.describe(`External image and PDF tools in ${theme} theme`, () => {
		test.beforeEach(async ({ page, baseURL }) => {
			await page.addInitScript((value) => {
				localStorage.setItem('cvmaker.theme', value);
				localStorage.setItem('cvmaker.uiLocale', 'id');
			}, theme);
			await localOnly(page, baseURL);
		});
		test.afterEach(async ({ page }) => {
			const state = network.get(page)!;
			expect(state.outside, 'Loading the page must not request any third-party resource.').toEqual(
				[]
			);
			expect(state.unexpected).toEqual([]);
			expect(state.errors).toEqual([]);
		});

		test('site header and footer expose a localized, safe external link without clipping', async ({
			page
		}) => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			const initial = page.viewportSize()!;
			const header = page.locator('.site-header');
			const nav = header.locator('nav');
			for (const locale of ['id', 'en'] as const) {
				await page.setViewportSize(initial);
				await header.getByRole('button', { name: copy[locale].language, exact: true }).click();
				for (const width of [...new Set([initial.width, 768, 1024, 1280])]) {
					await page.setViewportSize({
						width,
						height: width === initial.width ? initial.height : 900
					});
					await page.evaluate(async () => {
						await document.fonts.ready;
						await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					});
					const menu = await siteMenu(page);
					await header.scrollIntoViewIfNeeded();
					const tools = nav.locator(`a[href="${toolsUrl}"]`);
					await externalContract(tools, locale);
					const hrefs = await nav
						.getByRole('link')
						.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
					expect(hrefs.indexOf(toolsUrl)).toBe(hrefs.indexOf('https://codiosity.com') - 1);
					// The open dropdown overlays the page below the header: check viewport + pointer only.
					await fitsAndReceivesPointer(header);
					if (locale === 'id' && width === initial.width)
						await header.screenshot({
							path: test.info().outputPath(`tools-header-${width}-${theme}.png`),
							animations: 'disabled'
						});
					if (await menu.isVisible()) {
						await page.keyboard.press('Escape');
						await expect(menu).toHaveAttribute('aria-expanded', 'false');
					}
				}
				const footer = page.locator('footer');
				const footerLink = footer.locator(`a[href="${toolsUrl}"]`);
				await footerLink.scrollIntoViewIfNeeded();
				await externalContract(footerLink, locale);
				const footerLine = footer
					.locator('p')
					.filter({ has: page.locator(`a[href="${toolsUrl}"]`) });
				expect(
					await footerLine.evaluate((element) => {
						const visible = element.cloneNode(true) as HTMLElement;
						visible
							.querySelectorAll('.sr-only,a [aria-hidden="true"]')
							.forEach((node) => node.remove());
						return visible.textContent?.replace(/\s+/g, ' ').trim();
					})
				).toBe(copy[locale].footer);
				await page.evaluate(() => scrollTo(0, 0));
			}
			await expect(
				page.locator(
					'script[src*="respawnsociety"],img[src*="respawnsociety"],iframe[src*="respawnsociety"],link[href*="respawnsociety"]'
				)
			).toHaveCount(0);
		});

		test('the application dropdown keeps the same localized external link as its last item', async ({
			page
		}) => {
			await page.goto('/buat');
			await page.waitForLoadState('networkidle');
			const header = page.locator('.app-header');
			const menu = header.locator('.app-menu');
			for (const locale of ['id', 'en'] as const) {
				await header.getByRole('button', { name: copy[locale].language, exact: true }).click();
				await menu.locator('summary').click();
				await expect(menu).toHaveAttribute('open', '');
				const tools = menu.locator(`a[href="${toolsUrl}"]`);
				await externalContract(tools, locale);
				await expect(menu.getByRole('link').last()).toHaveAttribute('href', toolsUrl);
				await fitsAndReceivesPointer(header);
				await menu.locator('summary').click();
				await expect(menu).not.toHaveAttribute('open', '');
			}
		});
	});
}
