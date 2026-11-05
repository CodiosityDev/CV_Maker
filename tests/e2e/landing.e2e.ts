import { expect, test } from '@playwright/test';

test('landing offers the planned CV actions and honest template guidance', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Langkah pertama menuju kariermu.'
	);

	const createLinks = page.getByRole('link', { name: 'Buat CV Gratis', exact: true });
	expect(await createLinks.count()).toBeGreaterThanOrEqual(2);
	for (const link of await createLinks.all()) {
		await expect(link).toHaveAttribute('href', '/buat');
	}
	for (const link of await page.getByRole('link', { name: 'CV Saya', exact: true }).all()) {
		await expect(link).toHaveAttribute('href', '/cv');
	}
	await expect(page.getByText(/kurang cocok untuk portal ATS/i)).toBeVisible();
	await expect(page.locator('footer a[href="/privasi"]')).toBeVisible();
	await expect(page.locator('footer a[href="/tentang"]')).toBeVisible();
	await expect(
		page.locator('footer a[href="https://github.com/CodiosityDev/CV_Maker"]')
	).toHaveAttribute('rel', /noopener/);
});

test('language changes content and metadata, and survives reload and navigation', async ({
	page
}) => {
	await page.goto('/');
	const originalTitle = await page.title();
	const originalDescription = await page
		.locator('meta[name="description"]')
		.getAttribute('content');

	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Your first step towards a career.'
	);
	await expect(page).not.toHaveTitle(originalTitle);
	await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
		'content',
		originalDescription ?? ''
	);
	await expect(
		page.getByRole('link', { name: 'Create a free CV', exact: true }).first()
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Your first step towards a career.'
	);
	await page.locator('footer a[href="/privasi"]').click();
	await expect(page).toHaveURL(/\/privasi$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	const englishPrivacyHeading = await page.getByRole('heading', { level: 1 }).innerText();

	await page.getByRole('button', { name: 'Bahasa Indonesia', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(englishPrivacyHeading);
});

test('FAQ panels open independently with the keyboard', async ({ page }) => {
	await page.goto('/');
	const atsQuestion = page.getByRole('button', { name: 'Apa itu ATS?', exact: true });
	const freeQuestion = page.getByRole('button', {
		name: 'Apakah gratis?',
		exact: true
	});
	await expect(atsQuestion).toHaveAttribute('aria-expanded', 'false');
	await atsQuestion.focus();
	await atsQuestion.press('Space');
	await expect(atsQuestion).toHaveAttribute('aria-expanded', 'true');
	const answerId = await atsQuestion.getAttribute('aria-controls');
	expect(answerId).toBeTruthy();
	await expect(page.locator(`[id="${answerId}"]`)).toBeVisible();

	await freeQuestion.focus();
	await freeQuestion.press('Enter');
	await expect(freeQuestion).toHaveAttribute('aria-expanded', 'true');
	await expect(atsQuestion).toHaveAttribute('aria-expanded', 'true');
	await atsQuestion.focus();
	await atsQuestion.press('Enter');
	await expect(atsQuestion).toHaveAttribute('aria-expanded', 'false');
	await expect(freeQuestion).toHaveAttribute('aria-expanded', 'true');
});

test('the first keyboard action exposes the skip link and focuses main content', async ({
	page
}) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	const skipLink = page.getByRole('link', { name: 'Lewati ke konten utama', exact: true });
	await expect(skipLink).toBeFocused();
	await expect(skipLink).toBeVisible();
	const focus = await skipLink.evaluate((element) => {
		const style = getComputedStyle(element);
		return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
	});
	expect(focus.style).not.toBe('none');
	expect(focus.width).toBeGreaterThanOrEqual(2);
	await page.keyboard.press('Enter');
	await expect(page.locator('main#main')).toBeFocused();
});

test('content pages fit a 320px phone and keep actions easy to tap', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 780 });
	for (const path of ['/', '/privasi', '/tentang']) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `${path} must fit a 320px viewport`).toBeLessThanOrEqual(0);
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

		for (const action of await page.locator('button:visible, a:visible').all()) {
			// A skip link becomes a touch target only when focused and revealed.
			if ((await action.getAttribute('href')) === '#main') continue;
			const label = await action.evaluate((element) => {
				const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`;
				return `${selector} href=${element.getAttribute('href') ?? ''} aria-label=${element.getAttribute('aria-label') ?? ''} text=${element.textContent?.trim() ?? ''}`;
			});
			const context = `${path}: ${label}`;
			const bounds = await action.boundingBox();
			expect(bounds, context).not.toBeNull();
			expect(bounds?.width ?? 0, context).toBeGreaterThanOrEqual(44);
			expect(bounds?.height ?? 0, context).toBeGreaterThanOrEqual(44);
		}
	}
});

test('the component showcase is unavailable in production', async ({ page }) => {
	await page.goto('/dev/komponen');
	await expect(page.getByText('404', { exact: true })).toBeVisible();
});
