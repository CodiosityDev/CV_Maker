import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { sampleCvAts } from '../../src/lib/core/fixtures/sample-cv-ats.ts';
import type { CVDocument } from '../../src/lib/core/schema/types.ts';

const role = 'Web Developer Intern';
const payload = '<img src=x onerror=alert(1)>';
const summary =
	'Saya mengembangkan teamwork dan problem solving saat onboarding menggunakan JavaScript.';
const cvId = 'foreign-e2e-cv';
const ats = ['ats-klasik', 'ats-modern', 'ats-ringkas'];
const creative = ['creative-sidebar', 'creative-header', 'creative-timeline'];
const editor = (page: Page) => page.getByTestId('full-editor');
const saved = (page: Page) => page.getByTestId('save-status');

function documentFixture(): CVDocument {
	const cv = structuredClone(sampleCvAts);
	Object.assign(cv, {
		id: cvId,
		title: 'CV sintetis — istilah asing',
		targetRole: role,
		locale: 'id',
		kind: 'ats',
		templateId: ats[0]
	});
	cv.personal = {
		fullName: 'Nadia Bahasa',
		headline: role,
		email: 'nadia.bahasa@example.com',
		phone: '+62 812-3456-7890',
		city: 'Bandung',
		links: []
	};
	cv.summary = summary;
	cv.education = [
		{
			id: 'education-foreign',
			institution: 'Universitas Brawijaya',
			degree: 'S1',
			major: 'Sistem Informasi',
			dates: { start: '2020-08', end: '2024-07', current: false },
			highlights: ['Belajar problem solving menggunakan JavaScript.']
		}
	];
	cv.experience = [
		{
			id: 'experience-foreign',
			type: 'freelance',
			role,
			company: 'PT Tokopedia',
			dates: { start: '2023-01', end: '2024-01', current: false },
			bullets: [`Meningkatkan teamwork dan problem solving menggunakan JavaScript. ${payload}`]
		}
	];
	cv.organizations = [
		{
			id: 'organization-foreign',
			name: 'Google Developer Student Clubs',
			role: 'Koordinator',
			dates: { current: false },
			bullets: ['Melatih teamwork bersama anggota.']
		}
	];
	cv.projects = [];
	cv.skills = { hard: ['JavaScript'], soft: ['teamwork', 'problem solving'], tools: [] };
	cv.languages = [];
	cv.certifications = [];
	cv.awards = [];
	cv.custom = [
		{
			key: 'custom:training',
			title: 'Pelatihan',
			items: [
				{
					id: 'training-foreign',
					title: 'Leadership',
					subtitle: 'Problem Solving',
					bullets: ['Melatih teamwork.']
				}
			]
		}
	];
	cv.layout.order = [
		'summary',
		'education',
		'experience',
		'organizations',
		'skills',
		'custom:training'
	];
	cv.layout.hidden = [];
	cv.layout.customTitles = {};
	return cv;
}

// Browser storage state is a test fixture, not an application IndexedDB shortcut.
// Its schema matches the real UI-created snapshots used by the before/after print controls.
const test = base.extend({
	storageState: async ({ baseURL }, use) => {
		if (!baseURL) throw new Error('A local preview URL is required.');
		const state = {
			cookies: [],
			origins: [
				{
					origin: new URL(baseURL).origin,
					localStorage: [{ name: 'cvmaker.uiLocale', value: 'id' }],
					indexedDB: [
						{
							name: 'cvmaker',
							version: 1,
							stores: [
								{
									name: 'cvs',
									keyPath: 'id',
									autoIncrement: false,
									indexes: [],
									records: [{ value: documentFixture() }]
								},
								{ name: 'assets', keyPath: 'id', autoIncrement: false, indexes: [], records: [] },
								{ name: 'meta', autoIncrement: false, indexes: [], records: [] }
							]
						}
					]
				}
			]
		};
		await use(state);
	}
});
interface NetworkState {
	errors: string[];
	outside: string[];
	unexpected: string[];
	dialogs: string[];
	runs: { task: string; profile: Record<string, unknown> }[];
}
const network = new WeakMap<Page, NetworkState>();

async function mockLocal(page: Page, baseURL: string | undefined) {
	if (!baseURL) throw new Error('A local production preview is required.');
	const origin = new URL(baseURL).origin;
	const state: NetworkState = { errors: [], outside: [], unexpected: [], dialogs: [], runs: [] };
	network.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') state.errors.push(message.text());
	});
	page.on('dialog', async (dialog) => {
		state.dialogs.push(dialog.message());
		await dialog.dismiss();
	});
	await page.context().route('**/*', (route) => {
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
		if (url.pathname === '/api/ai/device' && route.request().method() === 'POST')
			return route.fulfill({ json: { token: 'v1.e2e-foreign-anonymous' } });
		if (url.pathname === '/api/ai/run' && route.request().method() === 'POST') {
			const body = route.request().postDataJSON() as NetworkState['runs'][number];
			state.runs.push(body);
			if (body.task !== 'headline') state.unexpected.push(`AI task ${body.task}`);
			return route.fulfill({
				json: {
					result: {
						task: 'headline',
						headlines: [
							'Pengembang web yang teliti',
							'Lulusan Sistem Informasi',
							'Pengembang dengan pengalaman proyek'
						]
					},
					quota: { limit: 3, remaining: 2, resetsAt: '2099-11-17T17:00:00.000Z' }
				}
			});
		}
		if (url.pathname.startsWith('/api/')) {
			state.unexpected.push(url.pathname);
			return route.fulfill({ status: 503, json: { error: 'unavailable' } });
		}
		return route.continue();
	});
}

async function editTab(page: Page) {
	const button = editor(page).getByRole('button', { name: 'Ubah', exact: true });
	if (await button.isVisible()) await button.click();
}
async function enter(page: Page) {
	await page.goto(`/cv/${cvId}/edit`);
	await expect(editor(page)).toBeVisible();
}
async function preview(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 1024)
		await editor(page).getByRole('button', { name: 'Preview', exact: true }).click();
	const paper = editor(page).getByTestId('cv-preview').locator('.paper > [data-template]');
	await expect(paper).toBeVisible();
	return paper;
}
async function appearance(page: Page) {
	await editTab(page);
	const toggle = editor(page)
		.locator('details.fixed-section > summary')
		.filter({ hasText: /^Tampilan$/ });
	if (!(await toggle.evaluate((element) => element.parentElement?.hasAttribute('open'))))
		await toggle.click();
	return page.locator('[data-testid="foreign-terms-controls"]:visible');
}
async function choose(page: Page, template: string) {
	await appearance(page);
	const picker = page.getByTestId('template-picker');
	await picker
		.getByRole('button', {
			name: template.startsWith('creative-') ? 'CV Creative' : 'CV ATS',
			exact: true
		})
		.click();
	const choice = picker.locator(`[data-template-id="${template}"]`);
	await choice.click();
	await expect(choice).toHaveAttribute('aria-pressed', 'true');
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
}
async function overflow(page: Page) {
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
	).toBeLessThanOrEqual(0);
}

async function capture(page: Page, name: string, scope?: Locator, caret = false) {
	if (test.info().project.name === 'tablet-768' && name !== 'settings') return;
	const theme = test.info().titlePath.some((title) => title.includes('dark theme'))
		? 'dark'
		: 'light';
	const path = test.info().outputPath(`foreign-${name}-${test.info().project.name}-${theme}.png`);
	if (scope) await scope.screenshot({ path, animations: 'disabled' });
	else
		await page.screenshot({
			path,
			fullPage: false,
			animations: 'disabled',
			caret: caret ? 'initial' : 'hide'
		});
}

async function renderedForeign(scope: Locator) {
	await expect(scope.locator('em').filter({ hasText: role })).not.toHaveCount(0);
	const emphasis = await scope.locator('em').allTextContents();
	for (const term of ['teamwork', 'problem solving', 'Freelance', 'Soft Skills'])
		expect(emphasis.join('|').toLowerCase()).toContain(term.toLowerCase());
	expect(
		await scope
			.locator('em')
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fontStyle))
	).toEqual(emphasis.map(() => 'italic'));
	const names = await scope.evaluate((element) => {
		const terms = [
			'PT Tokopedia',
			'Universitas Brawijaya',
			'JavaScript',
			'Google Developer Student Clubs'
		];
		const results: { term: string; style: string }[] = [];
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode())
			for (const term of terms)
				if (node.textContent?.includes(term) && node.parentElement)
					results.push({ term, style: getComputedStyle(node.parentElement).fontStyle });
		return results;
	});
	for (const term of [
		'PT Tokopedia',
		'Universitas Brawijaya',
		'JavaScript',
		'Google Developer Student Clubs'
	]) {
		expect(names.some((result) => result.term === term)).toBe(true);
		expect(
			names.filter((result) => result.term === term).every((result) => result.style === 'normal')
		).toBe(true);
	}
	await expect(scope.locator('h1 em,h2 em,a em,img[src="x"],script')).toHaveCount(0);
	await expect(scope).toContainText(payload);
}
async function printTemplate(page: Page, template: string) {
	await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	await page.goto(`/cv/${cvId}/print`);
	const paper = page.getByTestId('print-paper').locator(`[data-template="${template}"]`);
	await expect(paper).toBeVisible();
	await renderedForeign(paper);
	await page.emulateMedia({ media: 'print' });
	await renderedForeign(paper);
	await capture(page, template, paper);
	if (
		test.info().project.name === 'desktop-1280' &&
		!test.info().titlePath.some((title) => title.includes('dark theme'))
	) {
		const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
		const pdfPath = test.info().outputPath(`${template}.pdf`);
		await writeFile(pdfPath, bytes);
		await test.info().attach(`${template}.pdf`, { path: pdfPath, contentType: 'application/pdf' });
		const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
		const loading = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
		const document = await loading.promise;
		try {
			let text = '';
			const fonts: {
				text: string;
				name?: string;
				italic?: boolean;
				transform: number[];
				skew: number;
			}[] = [];
			for (let number = 1; number <= document.numPages; number++) {
				const current = await document.getPage(number);
				const content = await current.getTextContent();
				await current.getOperatorList();
				const cache = (current as unknown as { commonObjs?: { get: (id: string) => unknown } })
					.commonObjs;
				for (const item of content.items) {
					if (!('str' in item)) continue;
					text += item.str + ' ';
					let font: { name?: string; italic?: boolean } = {};
					try {
						font = (cache?.get(item.fontName) ?? {}) as typeof font;
					} catch {
						/* Metadata may not be exposed by this PDF.js build. */
					}
					const [a, b, c, d] = item.transform as number[];
					const divisor = Math.hypot(a!, b!) * Math.hypot(c!, d!);
					const skew = divisor ? Math.abs(a! * c! + b! * d!) / divisor : 0;
					fonts.push({
						text: item.str,
						name: font.name,
						italic: font.italic,
						transform: item.transform,
						skew
					});
				}
			}
			text = text.replace(/\s+/g, ' ').trim();
			for (const expected of [
				'Nadia Bahasa',
				role,
				'teamwork',
				'problem solving',
				'PT Tokopedia',
				'Universitas Brawijaya',
				'Google Developer Student Clubs',
				'JavaScript'
			])
				expect(text).toContain(expected);
			for (const chrome of ['Istilah asing dimiringkan', 'Edit visual', 'Kembali ke editor'])
				expect(text).not.toContain(chrome);
			const relevant = fonts.filter((font) => font.text.includes('teamwork'));
			const italicEvidence = relevant.map((font) => ({
				text: font.text,
				explicitFont: font.italic === true || /italic|oblique/i.test(font.name ?? ''),
				matrixSkew: font.skew
			}));
			// Synthetic italics can use matrix skew or outlines; false flags cannot prove upright text.
			// Computed print CSS above is mandatory, and the PDF font evidence is preserved for review.
			const metadataPath = test.info().outputPath(`${template}-pdf-text-and-fonts.json`);
			await writeFile(
				metadataPath,
				JSON.stringify(
					{
						pages: document.numPages,
						text,
						italicEvidence,
						fontMetadataLimitation:
							'Synthetic italics may use skew or outlines rather than an italic font flag.',
						fonts
					},
					null,
					2
				)
			);
			await test.info().attach(`${template}-pdf-text-and-fonts`, {
				path: metadataPath,
				contentType: 'application/json'
			});
		} finally {
			await loading.destroy();
		}
	}
	await expect(page.locator('[data-edit],[contenteditable]')).toHaveCount(0);
	await page.emulateMedia({ media: 'screen' });
	await page.goto(`/cv/${cvId}/edit`);
	await expect(editor(page)).toBeVisible();
}
async function manage(page: Page) {
	const row = await appearance(page);
	await row.getByRole('button', { name: 'Atur', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Istilah asing', exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
}
async function closeDialog(page: Page) {
	const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('foreign-terms-dialog') });
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
}
async function marked(page: Page, term: string, expected: boolean) {
	const paper = await preview(page);
	const matches = paper.locator('em').filter({ hasText: new RegExp(`\\b${term}\\b`, 'i') });
	if (expected) await expect(matches).not.toHaveCount(0);
	else await expect(matches).toHaveCount(0);
}
async function undo(page: Page, redo = false) {
	await editor(page)
		.getByRole('button', { name: redo ? 'Ulangi' : 'Urungkan', exact: true })
		.click();
}
async function download(page: Page, format: 'txt' | 'docx') {
	await editor(page).getByRole('button', { name: 'Unduh', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Unduh', exact: true });
	const event = page.waitForEvent('download');
	await dialog
		.getByRole('button', { name: format === 'txt' ? 'Teks (.txt)' : 'Word (.docx)', exact: true })
		.click();
	const file = await event;
	expect(await file.failure()).toBeNull();
	const path = await file.path();
	if (!path) throw new Error('A real local download is required.');
	const bytes = await readFile(path);
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	return format === 'txt'
		? bytes.toString('utf8')
		: strFromU8(unzipSync(bytes)['word/document.xml']!);
}

for (const theme of ['light', 'dark'] as const)
	test.describe(`Foreign terms in ${theme} theme`, () => {
		test.beforeEach(async ({ page, baseURL }) => {
			await page.addInitScript((value) => {
				localStorage.setItem('cvmaker.theme', value);
				window.print = () => {};
			}, theme);
			await mockLocal(page, baseURL);
		});
		test.afterEach(async ({ page }) => {
			const state = network.get(page)!;
			expect(state.errors).toEqual([]);
			expect(state.outside).toEqual([]);
			expect(state.unexpected).toEqual([]);
			expect(state.dialogs).toEqual([]);
		});

		test('all three ATS previews and real print templates italicise terms and preserve proper names and literal text', async ({
			page
		}) => {
			await enter(page);
			for (const template of ats) {
				await choose(page, template);
				await renderedForeign(await preview(page));
				await overflow(page);
				await printTemplate(page, template);
			}
		});

		test('all Creative templates print italics, inline typing and paste retain their caret, and English hides automatic italics', async ({
			page
		}) => {
			await enter(page);
			for (const template of creative) {
				await choose(page, template);
				await renderedForeign(await preview(page));
				await printTemplate(page, template);
			}
			await editor(page).getByRole('button', { name: 'Edit visual', exact: true }).click();
			const field = page.getByTestId('visual-paper').locator('[data-edit="summary"]');
			await expect(field).toContainText(summary);
			await field.click();
			await expect(field).toHaveAttribute('contenteditable', /^(plaintext-only|true)$/);
			await field.press('Control+End');
			await field.pressSequentially(' Tambahan.');
			await expect(field).toHaveText(summary + ' Tambahan.');
			await capture(page, 'creative-caret', undefined, true);
			await field.evaluate((element, text) => {
				const clipboard = new DataTransfer();
				clipboard.setData('text/plain', text);
				clipboard.setData('text/html', '<strong>DIABAIKAN</strong><img src=x onerror=alert(2)>');
				element.dispatchEvent(
					new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true })
				);
			}, ` ${payload}`);
			await field.press('Tab');
			await expect(field).toHaveText(`${summary} Tambahan. ${payload}`);
			await expect(field.locator('img,script,strong')).toHaveCount(0);
			// Tab may continue editing the next CV field; leave the inline island before checking display markup.
			await editor(page).getByRole('button', { name: 'Edit visual', exact: true }).focus();
			await expect(field.locator('em').filter({ hasText: 'teamwork' })).not.toHaveCount(0);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await editTab(page);
			await editor(page).locator('details[data-section-key="target"] > summary').click();
			await page.locator('#locale').selectOption('en');
			const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
			await target.fill('nurs');
			const nurse = page.getByRole('option', { name: 'Nurse', exact: true });
			await expect(nurse).toBeVisible();
			await target.press('ArrowDown');
			await expect(nurse).toHaveAttribute('aria-selected', 'true');
			await target.press('Enter');
			await expect(target).toHaveValue('Nurse');
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await editTab(page);
			await editor(page).locator('details[data-section-key="target"] > summary').click();
			await expect(target).toHaveValue('Nurse');
			await appearance(page);
			await expect(page.getByTestId('foreign-terms-controls')).toHaveCount(0);
			await expect((await preview(page)).locator('em')).toHaveCount(0);
			await overflow(page);
		});

		test('ignore, restore, add and toggle each undo cleanly, persist, and change DOCX italics without changing TXT', async ({
			page
		}) => {
			await enter(page);
			const plainBefore = await download(page, 'txt');
			const xml = await download(page, 'docx');
			const runs = await page.evaluate((xml) => {
				const document = new DOMParser().parseFromString(xml, 'application/xml');
				return Array.from(document.getElementsByTagNameNS('*', 'r')).map((run) => ({
					text: Array.from(run.getElementsByTagNameNS('*', 't'))
						.map((node) => node.textContent)
						.join(''),
					italic: Array.from(run.getElementsByTagNameNS('*', 'i')).some(
						(node) => !['0', 'false', 'off'].includes(node.getAttribute('w:val') ?? 'true')
					)
				}));
			}, xml);
			for (const term of ['teamwork', 'problem solving', role])
				expect(
					runs
						.filter((run) => run.italic)
						.map((run) => run.text)
						.join('|')
				).toContain(term);
			for (const name of [
				'PT Tokopedia',
				'Universitas Brawijaya',
				'JavaScript',
				'Google Developer Student Clubs'
			])
				expect(
					runs
						.filter((run) => run.italic)
						.map((run) => run.text)
						.join('|')
				).not.toContain(name);
			expect(xml).toContain('&lt;img');
			expect(plainBefore).toContain(payload);
			let dialog = await manage(page);
			await capture(page, 'settings', dialog);
			await dialog.locator('[data-testid="foreign-term-ignore"][data-term="teamwork"]').click();
			await closeDialog(page);
			await marked(page, 'teamwork', false);
			await undo(page);
			await marked(page, 'teamwork', true);
			dialog = await manage(page);
			await dialog.locator('[data-testid="foreign-term-ignore"][data-term="teamwork"]').click();
			await closeDialog(page);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await marked(page, 'teamwork', false);
			dialog = await manage(page);
			await dialog.locator('[data-testid="foreign-term-restore"][data-term="teamwork"]').click();
			await closeDialog(page);
			await marked(page, 'teamwork', true);
			await undo(page);
			await marked(page, 'teamwork', false);
			await undo(page, true);
			await marked(page, 'teamwork', true);
			dialog = await manage(page);
			await dialog.locator('[data-testid="foreign-term-ignore"][data-term="onboarding"]').click();
			await closeDialog(page);
			await marked(page, 'onboarding', false);
			dialog = await manage(page);
			await dialog.getByTestId('foreign-term-input').fill('onboarding');
			await dialog.getByTestId('foreign-term-add').click();
			await expect(
				dialog.locator('[data-testid="foreign-term-restore"][data-term="onboarding"]')
			).toHaveCount(0);
			await closeDialog(page);
			await marked(page, 'onboarding', true);
			await undo(page);
			await marked(page, 'onboarding', false);
			dialog = await manage(page);
			await dialog.locator('[data-testid="foreign-term-restore"][data-term="onboarding"]').click();
			await closeDialog(page);
			let row = await appearance(page);
			await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
			await row.getByRole('switch').click();
			await expect((await preview(page)).locator('em')).toHaveCount(0);
			await undo(page);
			await marked(page, 'teamwork', true);
			row = await appearance(page);
			await row.getByRole('switch').click();
			const plainAfter = await download(page, 'txt');
			expect(plainAfter).toBe(plainBefore);
			await page.goto(`/cv/${cvId}/print`);
			await expect(page.getByTestId('print-paper').locator('em')).toHaveCount(0);
			await expect(page.getByTestId('print-paper')).toContainText(payload);
			await overflow(page);
		});

		test('the editor AI loads on its first click, requests consent once and sends no writing request before approval', async ({
			page
		}) => {
			await enter(page);
			const state = network.get(page)!;
			const field = page.getByLabel('Headline singkat', { exact: true });
			const request = editor(page).getByRole('button', {
				name: 'Saran headline dengan AI',
				exact: true
			});
			await expect(field).toHaveValue(role);
			expect(state.runs).toHaveLength(0);
			await request.click();
			const consent = page.getByRole('dialog', { name: 'Bantuan AI', exact: true });
			await expect(consent).toHaveCount(1);
			await expect(consent).toBeVisible();
			expect(state.runs).toHaveLength(0);
			await consent.getByRole('button', { name: 'Batal', exact: true }).click();
			await expect(consent).not.toBeVisible();
			expect(state.runs).toHaveLength(0);
			await request.click();
			await expect(consent).toHaveCount(1);
			await consent.getByRole('button', { name: 'Setuju & lanjutkan', exact: true }).click();
			const panel = page.locator('[data-testid="ai-assist"][data-ai-task="headline"]');
			const suggestion = panel.getByRole('button', {
				name: 'Pengembang web yang teliti',
				exact: true
			});
			await expect(suggestion).toBeVisible();
			expect(state.runs).toHaveLength(1);
			expect(state.runs[0]!.task).toBe('headline');
			for (const privateValue of [
				'Nadia Bahasa',
				'nadia.bahasa@example.com',
				'+62 812-3456-7890',
				'Bandung',
				'personal'
			])
				expect(JSON.stringify(state.runs[0])).not.toContain(privateValue);
			await expect(field).toHaveValue(role);
			await suggestion.click();
			await expect(field).toHaveValue('Pengembang web yang teliti');
			await undo(page);
			await expect(field).toHaveValue(role);
			await overflow(page);
		});
	});
