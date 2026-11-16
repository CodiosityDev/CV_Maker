import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import type { AiConciseInput, AiLetterInput, AiQuota } from '../../src/lib/core/ai/types.ts';

type ApiMode = 'ok' | 'quota' | 'unavailable';
interface LetterRequest {
	task: 'letter';
	letter: AiLetterInput;
}
interface LiteRequest {
	task: 'concise';
	concise: AiConciseInput;
}
interface MockApi {
	quota: AiQuota;
	runs: LetterRequest[];
	lite: LiteRequest[];
	mode: ApiMode;
	liteMode: ApiMode;
	held?: Promise<void>;
	outside: string[];
	unexpected: string[];
	errors: string[];
	expectedHttpErrors: number[];
}

interface HeldLetterSaveWindow {
	letterSaveGate?: {
		held: boolean;
		released: boolean;
		writes: number;
		key: string;
		navigationAttempts: number;
		release: () => void;
		restore: () => void;
	};
}

const fullName = 'Nadia Surat Rahasia';
const email = 'nadia.surat.rahasia@example.com';
const phone = '081234567890';
const cvTitle = 'CV Nadia untuk surat';
const company = 'PT Maju Bersama';
const position = 'Web Developer';
const birthPlace = 'Tempat Lahir Rahasia';
const birthDate = '2003-04-07';
const address = 'Jalan Rahasia No. 17, Bandung';
const referrer = 'Perekomendasi Rahasia';
const motivation = 'Saya tertarik mengembangkan layanan web PT Maju Bersama untuk pelanggannya.';
const longMotivation =
	'Bertanggung jawab untuk melakukan berbagai macam kegiatan yang pada dasarnya sangat berkaitan dengan pengembangan layanan pelanggan dan juga membantu dalam proses administrasi yang dilakukan setiap harinya di PT Maju Bersama dengan baik dan penuh tanggung jawab. '.repeat(
		3
	);
const shorter = 'Saya ingin mengembangkan layanan pelanggan PT Maju Bersama.';
const generated = {
	task: 'letter' as const,
	opening: 'Saya mengajukan lamaran sebagai Web Developer di PT Maju Bersama.',
	qualifications: 'Pendidikan Informatika dan pengalaman magang saya mendukung pekerjaan ini.',
	motivation: 'Saya ingin membantu tim PT Maju Bersama mengembangkan layanan web.',
	closing: ''
};
const editor = (page: Page) => page.getByTestId('letter-editor');
const paper = (page: Page) => page.locator('[data-testid="letter-paper"]:visible');
const block = (page: Page, key: string) => paper(page).locator(`[data-letter-block="${key}"]`);
const saved = (page: Page) =>
	page.locator('[data-testid="save-status"], [data-testid="letter-save-state"]');
const mocks = new WeakMap<Page, MockApi>();

async function capture(page: Page, name: string) {
	if (test.info().project.name === 'tablet-768') return;
	const theme = test.info().titlePath.some((title) => title.includes('dark theme'))
		? 'dark'
		: 'light';
	await page.screenshot({
		path: test.info().outputPath(`${theme}-${test.info().project.name}-${name}.png`),
		fullPage: true
	});
}

async function mockApi(page: Page, baseURL: string | undefined) {
	if (!baseURL) throw new Error('Cover-letter tests require the local production preview.');
	const origin = new URL(baseURL).origin;
	const state: MockApi = {
		quota: {
			limit: 3,
			remaining: 3,
			resetsAt: '2099-11-17T17:00:00.000Z',
			lite: { limit: 20, remaining: 20 }
		},
		runs: [],
		lite: [],
		mode: 'ok',
		liteMode: 'ok',
		outside: [],
		unexpected: [],
		errors: [],
		expectedHttpErrors: []
	};
	mocks.set(page, state);
	page.on('pageerror', (error) => state.errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const status = message.text().match(/^Failed to load resource:.*status of (429|503)\b/);
		const expected = status ? state.expectedHttpErrors.indexOf(Number(status[1])) : -1;
		if (expected >= 0) state.expectedHttpErrors.splice(expected, 1);
		else state.errors.push(message.text());
	});
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			state.outside.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	await page.route('**/api/hello', (route) => route.fulfill({ json: { visitors: 1234 } }));
	await page.route('**/api/ai/**', async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path === '/api/ai/quota' && request.method() === 'GET')
			return route.fulfill({ json: state.quota });
		if (path === '/api/ai/device' && request.method() === 'POST')
			return route.fulfill({ json: { token: 'v1.e2e-letter-anonymous' } });
		if (path === '/api/ai/run' && request.method() === 'POST') {
			const body = request.postDataJSON() as LetterRequest;
			state.runs.push(body);
			if (state.held) await state.held;
			if (state.mode === 'quota') {
				state.quota = { ...state.quota, remaining: 0 };
				state.expectedHttpErrors.push(429);
				return route.fulfill({ status: 429, json: { error: 'quota', quota: state.quota } });
			}
			if (state.mode === 'unavailable') {
				state.expectedHttpErrors.push(503);
				return route.fulfill({ status: 503, json: { error: 'unavailable' } });
			}
			state.quota = { ...state.quota, remaining: Math.max(0, state.quota.remaining - 1) };
			return route.fulfill({ json: { result: generated, quota: state.quota } });
		}
		if (path === '/api/ai/lite' && request.method() === 'POST') {
			const body = request.postDataJSON() as LiteRequest;
			state.lite.push(body);
			if (state.liteMode !== 'ok') {
				const status = state.liteMode === 'quota' ? 429 : 503;
				state.expectedHttpErrors.push(status);
				return route.fulfill({
					status,
					json: { error: state.liteMode === 'quota' ? 'quota' : 'unavailable' }
				});
			}
			state.quota = {
				...state.quota,
				lite: { limit: 20, remaining: Math.max(0, (state.quota.lite?.remaining ?? 20) - 1) }
			};
			return route.fulfill({
				json: {
					result: {
						task: 'concise',
						points: body.concise.points.map((point) =>
							point.text.includes('Bertanggung jawab')
								? { score: 25, issues: ['filler', 'tooLong'], shorter }
								: null
						)
					},
					lite: state.quota.lite
				}
			});
		}
		state.unexpected.push(`${request.method()} ${path}`);
		return route.fulfill({ status: 500, json: { error: 'failed' } });
	});
	return state;
}

async function advance(page: Page, heading: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(heading);
}

// A fictional applicant uses the real wizard; there is no direct DB seed or production-only hook.
async function createCv(page: Page, incognito = false, rich = false, complete = true) {
	await page.goto('/buat');
	if (incognito) {
		await page
			.locator('.app-header')
			.getByRole('button', { name: 'Mode Incognito', exact: true })
			.click();
		await page
			.getByRole('dialog', { name: 'Nyalakan Mode Incognito?', exact: true })
			.getByRole('button', { name: 'Nyalakan', exact: true })
			.click();
	}
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await page.getByLabel('Judul CV', { exact: true }).fill(cvTitle);
	const target = page.getByRole('combobox', { name: 'Posisi yang dituju', exact: true });
	await target.fill(position);
	await target.press('Escape');
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill(fullName);
	await page.getByLabel(/^Email\b/).fill(email);
	await page.getByLabel(/^Nomor HP\b/).fill(phone);
	const city = page.getByRole('combobox', { name: 'Kota / kabupaten', exact: true });
	await city.fill('Bandung');
	await city.press('Escape');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	for (const [label, value] of [
		[/^Nama sekolah \/ kampus/, 'Kampus Contoh'],
		['Jenjang pendidikan', 'S1'],
		['Jurusan', 'Informatika']
	] as const) {
		const input = page.getByRole('combobox', { name: label });
		await input.fill(value);
		await input.press('Escape');
	}
	await advance(page, 'Pengalaman kerja / magang');
	if (!complete) {
		if (!incognito) await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
		return new URL(page.url()).pathname.split('/').at(-1)!;
	}
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	const role = page.getByRole('combobox', { name: 'Posisi / peran', exact: true });
	await role.fill('Web Developer Intern');
	await role.press('Escape');
	await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('Studio Contoh');
	await page.getByRole('button', { name: 'Tambah poin', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'Poin 1', exact: true })
		.fill('Membangun 3 halaman layanan pelanggan bersama tim pengembang.');
	await advance(page, 'Organisasi & kepanitiaan');
	if (rich) {
		await page
			.getByRole('button', { name: 'Tambah Organisasi & kepanitiaan', exact: true })
			.click();
		await page.locator('input[id^="organizations."][id$=".name"]').fill('Komunitas Kampus');
		const orgRole = page.getByRole('combobox', { name: 'Posisi / peran', exact: true });
		await orgRole.fill('Koordinator');
		await orgRole.press('Escape');
	}
	await advance(page, 'Proyek', !rich);
	await advance(page, 'Keahlian & pencapaian', true);
	const skills: [string, string][] = rich
		? [
				['Keahlian teknis', 'HTML'],
				['Tools & software', 'Git'],
				['Soft skill', 'teamwork']
			]
		: [['Keahlian teknis', 'HTML']];
	for (const [label, value] of skills) {
		const input = page.getByRole('combobox', { name: label, exact: true });
		await input.fill(value);
		await input.press('Enter');
	}
	await advance(page, 'Ringkasan profil');
	await advance(page, 'Tinjau CV-mu', true);
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	if (!incognito) await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function appMenu(page: Page) {
	await page.locator('.app-header .app-menu > summary').click();
}

async function newLetter(
	page: Page,
	options: { incognito?: boolean; company?: string; rich?: boolean; complete?: boolean } = {}
) {
	const cvId = await createCv(page, options.incognito, options.rich, options.complete ?? false);
	await appMenu(page);
	await page.getByRole('link', { name: 'Surat Lamaran', exact: true }).click();
	await expect(page.getByTestId('letter-cv-card')).toHaveCount(1);
	await page.getByTestId('letter-cv-card').click();
	await page.getByRole('button', { name: 'Buat surat baru', exact: true }).click();
	await expect(editor(page)).toBeVisible();
	await expect(page.locator('#letter-position')).toHaveValue(position);
	await page.locator('#letter-company').fill(options.company ?? company);
	return { cvId, letterId: new URL(page.url()).pathname.split('/').at(-1)! };
}

async function step(page: Page, number: number) {
	await closePaper(page);
	await page.getByTestId(`letter-step-${number}`).click();
}

async function showPaper(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 1024 && !(await paper(page).count()))
		await page.getByRole('button', { name: 'Lihat surat', exact: true }).click();
	await expect(paper(page)).toBeVisible();
}

async function closePaper(page: Page) {
	const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('letter-paper') });
	if (await sheet.isVisible()) {
		await page.keyboard.press('Escape');
		await expect(sheet).not.toBeVisible();
	}
}

async function overflow(page: Page) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		)
	).toBeLessThanOrEqual(0);
}

async function downloadText(page: Page, format: 'docx' | 'txt') {
	const event = page.waitForEvent('download');
	await page
		.getByTestId('letter-finish-form')
		.getByRole('button', { name: format === 'docx' ? 'Word (.docx)' : 'Teks (.txt)', exact: true })
		.click();
	const download = await event;
	expect(await download.failure()).toBeNull();
	const path = await download.path();
	if (!path) throw new Error('The exported letter must be available locally.');
	const bytes = await readFile(path);
	const xml = format === 'docx' ? unzipSync(bytes)['word/document.xml'] : undefined;
	if (format === 'docx' && !xml) throw new Error('Word must contain word/document.xml.');
	return {
		name: download.suggestedFilename(),
		text: xml ? strFromU8(xml) : bytes.toString('utf8')
	};
}

async function chooseText(field: Locator, text: string) {
	await field.focus();
	await field.evaluate((element, selected) => {
		const plain = element.textContent ?? '';
		const start = plain.indexOf(selected);
		if (start < 0) throw new Error(`The paragraph does not contain ${selected}.`);
		const nodes: Text[] = [];
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
		function at(offset: number): { node: Text; offset: number } {
			for (const node of nodes) {
				if (offset <= node.data.length) return { node, offset };
				offset -= node.data.length;
			}
			throw new Error('The requested selection is outside the paragraph.');
		}
		const from = at(start);
		const to = at(start + selected.length);
		const range = document.createRange();
		range.setStart(from.node, from.offset);
		range.setEnd(to.node, to.offset);
		const selection = getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		document.dispatchEvent(new Event('selectionchange'));
	}, text);
}

async function askAi(page: Page) {
	await closePaper(page);
	await step(page, 1);
	await page.locator('#letter-ai-request').click();
	const dialog = page.getByRole('dialog', { name: 'Izinkan AI menulis surat?', exact: true });
	if (await dialog.isVisible()) {
		await dialog.getByRole('button', { name: /Setuju/ }).click();
	}
}

// Hold the repository's completion notification, not its data or the applicant's input.
// This creates a real queued save while the next company edit and route click occur.
async function holdLetterSave(page: Page) {
	await page.evaluate(() => {
		const prototype = IDBRequest.prototype;
		const descriptor = Object.getOwnPropertyDescriptor(prototype, 'addEventListener');
		const original = prototype.addEventListener;
		const gate = {
			held: false,
			released: false,
			writes: 0,
			key: '',
			navigationAttempts: 0,
			release: () => {},
			restore: () => {}
		};
		let captured = false;
		let resume: (() => void) | undefined;
		const restorePrototype = () =>
			descriptor
				? Object.defineProperty(prototype, 'addEventListener', descriptor)
				: Reflect.deleteProperty(prototype, 'addEventListener');
		const navigation = (event: MouseEvent) => {
			const link = event.target instanceof Element ? event.target.closest('a') : null;
			if (
				link &&
				new URL(link.href).origin === location.origin &&
				new URL(link.href).pathname.endsWith('/surat')
			)
				gate.navigationAttempts++;
		};
		document.addEventListener('click', navigation, true);
		gate.release = () => {
			gate.released = true;
			const callback = resume;
			resume = undefined;
			callback?.();
		};
		gate.restore = () => {
			restorePrototype();
			document.removeEventListener('click', navigation, true);
			gate.release();
		};
		(window as unknown as HeldLetterSaveWindow).letterSaveGate = gate;
		Object.defineProperty(prototype, 'addEventListener', {
			configurable: true,
			writable: true,
			value: function (
				this: IDBRequest,
				type: string,
				listener: EventListenerOrEventListenerObject | null,
				options?: boolean | AddEventListenerOptions
			) {
				const source = this.source;
				if (
					type === 'success' &&
					listener &&
					source instanceof IDBObjectStore &&
					source.name === 'cvs' &&
					this.transaction?.mode === 'readwrite'
				) {
					const first = !captured;
					captured = true;
					const wrapped = (event: Event) => {
						this.removeEventListener('success', wrapped);
						gate.writes++;
						gate.key = typeof this.result === 'string' ? this.result : '';
						const invoke = () =>
							typeof listener === 'function'
								? listener.call(this, event)
								: listener.handleEvent(event);
						if (first) {
							gate.held = true;
							if (gate.released) invoke();
							else resume = invoke;
						} else {
							restorePrototype();
							invoke();
						}
					};
					Reflect.apply(original, this, [type, wrapped, options]);
					return;
				}
				Reflect.apply(original, this, [type, listener, options]);
			}
		});
	});
}

for (const theme of ['light', 'dark'] as const) {
	test.describe(`Optional cover letters in ${theme} theme`, () => {
		test.beforeEach(async ({ page, baseURL }) => {
			await page.addInitScript((value) => {
				localStorage.setItem('cvmaker.theme', value);
				const state = window as typeof window & { letterPrintCalls?: number };
				state.letterPrintCalls = 0;
				window.print = () => {
					state.letterPrintCalls = (state.letterPrintCalls ?? 0) + 1;
				};
			}, theme);
			await mockApi(page, baseURL);
		});
		test.afterEach(async ({ page }) => {
			const state = mocks.get(page)!;
			expect(state.outside, 'No request may leave the local test origin.').toEqual([]);
			expect(state.unexpected, 'Only explicitly mocked APIs may be called.').toEqual([]);
			expect(state.errors, 'Browser errors must not be hidden.').toEqual([]);
		});

		test('site and app menus lead to the optional empty page and never force a redirect', async ({
			page
		}) => {
			await page.goto('/');
			const direct = page
				.locator('.site-header')
				.getByRole('link', { name: 'Surat Lamaran', exact: true });
			if (!(await direct.isVisible()))
				await page
					.locator('.site-header')
					.getByRole('button', { name: 'Menu', exact: true })
					.click();
			await page
				.getByRole('link', { name: 'Surat Lamaran', exact: true })
				.filter({ visible: true })
				.click();
			await expect(page).toHaveURL(/\/surat$/);
			await expect(page.getByRole('link', { name: 'Buat CV', exact: true }).last()).toBeVisible();
			await expect(page.getByTestId('letter-cv-card')).toHaveCount(0);
			await appMenu(page);
			await expect(page.getByRole('link', { name: 'Surat Lamaran', exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
			await page.getByRole('link', { name: 'Surat Lamaran', exact: true }).click();
			await expect(page.getByRole('dialog')).not.toBeVisible();
			await overflow(page);
		});

		test('two required fields create a real formal letter, export Word and text, and print without editor markup', async ({
			page
		}) => {
			const { cvId, letterId } = await newLetter(page, { complete: true });
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page
				.context()
				.storageState({ path: test.info().outputPath('letter-storage.json'), indexedDB: true });
			await writeFile(
				test.info().outputPath('letter-identifiers.json'),
				JSON.stringify(
					{
						cvId,
						letterId,
						theme,
						viewport: page.viewportSize(),
						route: `/cv/${cvId}/surat/${letterId}`
					},
					null,
					2
				)
			);
			await capture(page, 'letter-editor');
			await showPaper(page);
			for (const value of [fullName, company, 'Kampus Contoh', 'Informatika', 'Studio Contoh'])
				await expect(paper(page)).toContainText(value);
			expect(
				await paper(page)
					.locator('.formal-letter')
					.evaluate((el) => getComputedStyle(el).backgroundColor)
			).toBe('rgb(255, 255, 255)');
			await closePaper(page);
			await step(page, 2);
			const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
				const counts = new Map<string, number>();
				for (const element of elements) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
				return [...counts].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
			});
			expect(
				duplicateIds,
				'Labels and focus targets must identify a single element, including closed sheet contents.'
			).toEqual([]);
			for (const format of ['docx', 'txt'] as const) {
				const file = await downloadText(page, format);
				expect(file.name).toBe(`Surat_Lamaran_Nadia_Surat_Rahasia_PT_Maju_Bersama.${format}`);
				for (const value of [fullName, company, 'Kampus Contoh'])
					expect(file.text).toContain(value);
			}
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.goto(`/cv/${cvId}/surat/${letterId}/print`);
			await expect(page.locator('.formal-letter')).toContainText(fullName);
			await expect(
				page.locator('.app-header,[contenteditable],.formal-letter [data-letter-block]')
			).toHaveCount(0);
			expect(
				await page
					.locator('.formal-letter')
					.evaluate((el) =>
						[el, ...el.querySelectorAll('*')].some((node) =>
							[...node.attributes].some((attr) => attr.name.startsWith('data-'))
						)
					)
			).toBe(false);
			await expect
				.poll(() =>
					page.evaluate(
						() => (window as typeof window & { letterPrintCalls?: number }).letterPrintCalls
					)
				)
				.toBe(1);
			await expect(page).toHaveTitle('Surat_Lamaran_Nadia_Surat_Rahasia_PT_Maju_Bersama.pdf');
			const pdf = await page.pdf({ preferCSSPageSize: true });
			expect(Array.from(pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g))).toHaveLength(1);
			await capture(page, 'letter-print');
			await overflow(page);
		});

		test('three highlight limit, identity privacy and letter language update the preview', async ({
			page
		}) => {
			await newLetter(page, { company: 'Google Developer Groups', rich: true, complete: true });
			await step(page, 1);
			const options = page.getByTestId('letter-highlight');
			await expect(page.locator('[data-testid="letter-highlight"]:checked')).toHaveCount(3);
			expect(await options.count()).toBeGreaterThan(3);
			const fourth = page.locator('[data-testid="letter-highlight"]:not(:checked)').first();
			await expect(fourth).toBeDisabled();
			await page
				.locator('#letter-motivation')
				.fill('Saya tertarik pada web developer dan teamwork di Google Developer Groups.');
			await expect(page.locator('#letter-include-identity')).not.toBeChecked();
			await page.locator('#letter-include-identity').check();
			await page.locator('#letter-birth-place').fill(birthPlace);
			await page.locator('#letter-birth-date').fill(birthDate);
			await page.locator('#letter-address').fill(address);
			await showPaper(page);
			await expect(paper(page)).toContainText(birthPlace);
			await expect(block(page, 'motivation').locator('em')).toContainText([
				'web developer',
				'teamwork'
			]);
			await expect(
				paper(page).locator('em').filter({ hasText: 'Google Developer Groups' })
			).toHaveCount(0);
			await closePaper(page);
			await page.locator('#letter-include-identity').uncheck();
			await showPaper(page);
			await expect(paper(page)).not.toContainText(birthPlace);
			await step(page, 2);
			await page.locator('#letter-locale').selectOption('en');
			await showPaper(page);
			await expect(paper(page)).toContainText('Dear Hiring Manager,');
			await expect(paper(page)).not.toContainText('Perihal');
			await expect(block(page, 'motivation').locator('em')).toHaveCount(0);
			await overflow(page);
		});

		test('position autocomplete loads on demand, survives typing and preserves both selected and free text', async ({
			page
		}) => {
			await newLetter(page);
			const positionField = page.locator('#letter-position');
			await positionField.fill('Akun');
			const list = page.getByRole('listbox');
			await expect(list).toBeVisible();
			const first = list.getByRole('option').first();
			await expect(first).toBeVisible();
			const chosen = await first.innerText();
			await positionField.press('ArrowDown');
			await positionField.press('Enter');
			await expect(positionField).toHaveValue(chosen);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await expect(positionField).toHaveValue(chosen);
			const custom = 'Pengembang layanan khusus kampus';
			await positionField.fill(custom);
			await positionField.press('Escape');
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await expect(positionField).toHaveValue(custom);
			await showPaper(page);
			await expect(paper(page)).toContainText(custom);
		});

		test('letters duplicate for a new company and confirmed removal can be undone without losing the CV', async ({
			page
		}) => {
			await newLetter(page);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.getByRole('link', { name: 'Daftar surat', exact: true }).click();
			await expect(page.getByTestId('letter-card')).toHaveCount(1);
			await page
				.getByTestId('letter-card')
				.getByRole('button', { name: 'Gandakan untuk perusahaan lain', exact: true })
				.click();
			await expect(editor(page)).toBeVisible();
			await expect(page.locator('#letter-position')).toHaveValue(position);
			await expect(page.locator('#letter-company')).toHaveValue('');
			await page.locator('#letter-company').fill('PT Perusahaan Kedua');
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.getByRole('link', { name: 'Daftar surat', exact: true }).click();
			await expect(page.getByTestId('letter-card')).toHaveCount(2);
			const second = page.getByTestId('letter-card').filter({ hasText: 'PT Perusahaan Kedua' });
			await second.getByRole('button', { name: 'Hapus surat', exact: true }).click();
			await expect(page.getByTestId('letter-card')).toHaveCount(2);
			await page
				.getByRole('dialog', { name: 'Hapus surat ini?', exact: true })
				.getByRole('button', { name: 'Hapus surat', exact: true })
				.click();
			await expect(page.getByTestId('letter-card')).toHaveCount(1);
			await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
			await expect(page.getByTestId('letter-card')).toHaveCount(2);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await expect(page.getByTestId('letter-card')).toHaveCount(2);
			await appMenu(page);
			await page.getByRole('link', { name: 'CV Saya', exact: true }).click();
			await expect(page.getByTestId('cv-card')).toHaveCount(1);
			await expect(page.getByTestId('cv-card')).toContainText('2 surat');
		});

		test('queued company edits reach the letter list before it displays saved data and survive reload', async ({
			page
		}) => {
			const { cvId } = await newLetter(page);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await holdLetterSave(page);
			try {
				await page.locator('#letter-company').fill('PT Simpan Pertama');
				await page.waitForFunction(
					() => (window as unknown as HeldLetterSaveWindow).letterSaveGate?.held
				);
				expect(
					await page.evaluate(() => (window as unknown as HeldLetterSaveWindow).letterSaveGate?.key)
				).toBe(cvId);
				const latest = 'PT Simpan Terakhir';
				await page.locator('#letter-company').fill(latest);
				const editorUrl = page.url();
				await page.getByRole('link', { name: 'Daftar surat', exact: true }).click();
				await page.waitForFunction(
					() => (window as unknown as HeldLetterSaveWindow).letterSaveGate?.navigationAttempts
				);
				await expect(page).toHaveURL(editorUrl);
				await expect(editor(page)).toBeVisible();
				const beforeRelease = {
					url: page.url(),
					cards: await page.getByTestId('letter-card').allTextContents()
				};
				await page.evaluate(() =>
					(window as unknown as HeldLetterSaveWindow).letterSaveGate?.release()
				);
				await expect(page).toHaveURL(new RegExp(`/cv/${cvId}/surat$`));
				await expect(page.getByTestId('letter-card')).toContainText(latest);
				await expect(page.getByTestId('letter-card')).not.toContainText('PT Simpan Pertama');
				await page.waitForFunction(
					() => ((window as unknown as HeldLetterSaveWindow).letterSaveGate?.writes ?? 0) >= 2
				);
				await page.evaluate(() =>
					(window as unknown as HeldLetterSaveWindow).letterSaveGate?.restore()
				);
				await page.reload();
				await expect(page.getByTestId('letter-card')).toContainText(latest);
				await test.info().attach('queued-letter-navigation', {
					body: JSON.stringify({
						beforeRelease,
						afterReload: await page.getByTestId('letter-card').allTextContents()
					}),
					contentType: 'application/json'
				});
			} finally {
				if (!page.isClosed())
					await page.evaluate(() =>
						(window as unknown as HeldLetterSaveWindow).letterSaveGate?.restore()
					);
			}
		});

		test('another tab makes inline paragraphs read only until the local version is chosen, then typing persists', async ({
			page,
			baseURL
		}) => {
			await newLetter(page);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await showPaper(page);
			const paragraph = block(page, 'opening');
			const original = await paragraph.innerText();
			const other = await page.context().newPage();
			const otherMocks = await mockApi(other, baseURL);
			try {
				await other.goto(page.url());
				await expect(editor(other)).toBeVisible();
				await other.locator('#letter-company').fill('PT Tab Lain');
				await expect(saved(other)).toHaveAttribute('data-save-state', 'saved');
				await expect(page.getByRole('alert')).toContainText('CV ini diubah di tab lain.');
				await expect(paragraph).toHaveAttribute('contenteditable', 'false');
				await expect(paragraph).toHaveAttribute('aria-readonly', 'true');
				await paragraph.click();
				await page.keyboard.press('End');
				await page.keyboard.insertText(' Teks konflik yang tidak boleh muncul.');
				await expect(paragraph).toHaveText(original);
				await closePaper(page);
				await page.getByRole('button', { name: 'Pakai versi ini', exact: true }).click();
				await expect(page.getByRole('alert')).toHaveCount(0);
				await showPaper(page);
				await expect(paragraph).toHaveAttribute('contenteditable', 'plaintext-only');
				await chooseText(paragraph, original);
				await page.keyboard.press('ArrowRight');
				const addition = ' Tambahan setelah konflik.';
				await page.keyboard.insertText(addition);
				await paragraph.press('Tab');
				await expect(paragraph).toHaveText(original + addition);
				await closePaper(page);
				await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
				await page.reload();
				await showPaper(page);
				await expect(block(page, 'opening')).toHaveText(original + addition);
				expect(otherMocks.outside).toEqual([]);
				expect(otherMocks.unexpected).toEqual([]);
				expect(otherMocks.errors).toEqual([]);
			} finally {
				await other.close();
			}
		});

		test('selection toolbar and shortcuts preserve marks, explicit upright terms and undo through reload and print', async ({
			page
		}) => {
			const { cvId, letterId } = await newLetter(page);
			await step(page, 1);
			await page
				.locator('#letter-motivation')
				.fill('Saya mengembangkan web developer dan teamwork untuk PT Maju Bersama.');
			await showPaper(page);
			const text = block(page, 'motivation');
			await chooseText(text, 'teamwork');
			const toolbar = page.getByRole('toolbar');
			await toolbar.getByRole('button', { name: /^Tebal/ }).click();
			await expect(text.locator('strong')).toContainText('teamwork');
			await expect(toolbar.getByRole('button', { name: /^Tebal/ })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await capture(page, 'letter-toolbar');
			const beforePaste = await text.innerText();
			await chooseText(text, 'teamwork');
			await text.evaluate((element) => {
				const clipboard = new DataTransfer();
				clipboard.setData('text/plain', 'teamwork');
				element.dispatchEvent(
					new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true })
				);
			});
			await expect(text).toHaveText(beforePaste);
			await expect(text.locator('strong')).toHaveText('teamwork');
			await chooseText(text, 'teamwork');
			await text.press('Control+U');
			await expect(text.locator('u')).toContainText('teamwork');
			await chooseText(text, 'web developer');
			await text.press('Control+I');
			await expect(text.locator('em').filter({ hasText: 'web developer' })).toHaveCount(0);
			await text.press('Tab');
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
			await showPaper(page);
			await expect(
				block(page, 'motivation').locator('em').filter({ hasText: 'web developer' })
			).toHaveCount(1);
			await expect(block(page, 'motivation').locator('strong')).toHaveText('teamwork');
			await expect(block(page, 'motivation').locator('u')).toHaveText('teamwork');
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Ulangi', exact: true }).click();
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.reload();
			await showPaper(page);
			await expect(block(page, 'motivation').locator('strong')).toContainText('teamwork');
			await expect(block(page, 'motivation').locator('u')).toContainText('teamwork');
			await expect(
				block(page, 'motivation').locator('em').filter({ hasText: 'web developer' })
			).toHaveCount(0);
			await page.goto(`/cv/${cvId}/surat/${letterId}/print`);
			const printed = page
				.locator('.formal-letter .body-block p')
				.filter({ hasText: 'Saya mengembangkan web developer dan teamwork' });
			await expect(printed.locator('strong')).toContainText('teamwork');
			await expect(printed.locator('u')).toContainText('teamwork');
			await expect(printed.locator('em').filter({ hasText: 'web developer' })).toHaveCount(0);
		});

		test('formal style changes are undoable and reset restores the print defaults', async ({
			page
		}) => {
			const { cvId, letterId } = await newLetter(page);
			await showPaper(page);
			const styles = page.locator('[data-testid="letter-style-panel"]:visible');
			await styles.locator('summary').click();
			await styles.getByRole('radio', { name: 'Arial', exact: true }).check();
			await styles.getByRole('combobox', { name: /^Ukuran huruf\b/ }).selectOption('11');
			await expect(paper(page).locator('.formal-letter')).toHaveCSS('font-size', '14.6667px');
			await expect(paper(page).locator('.formal-letter')).toHaveCSS('font-family', /Arial/);
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
			await showPaper(page);
			await expect(paper(page).locator('.formal-letter')).toHaveCSS('font-size', '16px');
			await page.getByRole('button', { name: 'Kembalikan gaya formal', exact: true }).click();
			await expect(paper(page).locator('.formal-letter')).toHaveCSS('font-family', /Times/);
			await closePaper(page);
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.goto(`/cv/${cvId}/surat/${letterId}/print`);
			await expect(page.locator('.formal-letter')).toHaveCSS('font-family', /Times/);
			await expect(page.locator('.formal-letter')).toHaveCSS('font-size', '16px');
		});

		test('format toolbar arrow keys and activation retain the text selection and separate undo actions', async ({
			page
		}) => {
			await newLetter(page);
			await step(page, 1);
			await page
				.locator('#letter-motivation')
				.fill('Saya mengutamakan teamwork di PT Maju Bersama.');
			await showPaper(page);
			const text = block(page, 'motivation');
			await chooseText(text, 'teamwork');
			await text.press('Control+B');
			await expect(text.locator('strong')).toContainText('teamwork');
			await chooseText(text, 'teamwork');
			const bold = page.getByTestId('letter-format-bold');
			const italic = page.getByTestId('letter-format-italic');
			const underline = page.getByTestId('letter-format-underline');
			await bold.focus();
			await bold.press('ArrowRight');
			await expect(italic).toBeFocused();
			await italic.press('Enter');
			await expect(text.locator('em').filter({ hasText: 'teamwork' })).toHaveCount(0);
			await italic.press('ArrowRight');
			await expect(underline).toBeFocused();
			await underline.press('Enter');
			await expect(text.locator('u')).toContainText('teamwork');
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
			await showPaper(page);
			await expect(block(page, 'motivation').locator('u')).toHaveCount(0);
			await expect(block(page, 'motivation').locator('strong')).toContainText('teamwork');
		});

		test('AI consent shows the transmitted profile without identity and applies only selected paragraphs with one undo', async ({
			page
		}) => {
			await newLetter(page);
			await step(page, 1);
			await page.locator('#letter-motivation').fill(motivation);
			await page.locator('#letter-include-identity').check();
			await page.locator('#letter-birth-place').fill(birthPlace);
			await page.locator('#letter-birth-date').fill(birthDate);
			await page.locator('#letter-address').fill(address);
			await step(page, 0);
			await page.getByRole('radio', { name: 'Rekomendasi seseorang', exact: true }).check();
			await page.locator('#letter-source-detail').fill(referrer);
			await step(page, 1);
			await page.locator('#letter-ai-request').click();
			const consent = page.getByRole('dialog', { name: 'Izinkan AI menulis surat?', exact: true });
			await expect(consent).toBeVisible();
			const preview = await page.getByTestId('letter-ai-input').inputValue();
			for (const value of [fullName, email, phone, birthPlace, birthDate, address, referrer])
				expect(preview).not.toContain(value);
			await consent.getByRole('button', { name: /Setuju/ }).click();
			const result = page.getByTestId('letter-ai-result-opening');
			await expect(result).toContainText(generated.opening);
			await capture(page, 'letter-ai-result');
			await expect(page.getByTestId('letter-ai-result-closing')).toHaveCount(0);
			const state = mocks.get(page)!;
			expect(state.runs).toHaveLength(1);
			expect(state.runs[0]?.task).toBe('letter');
			expect(JSON.parse(preview)).toEqual(state.runs[0]?.letter);
			const body = JSON.stringify(state.runs[0]);
			for (const value of [fullName, email, phone, birthPlace, birthDate, address, referrer])
				expect(body).not.toContain(value);
			expect(state.quota.remaining).toBe(2);
			expect(state.quota.lite?.remaining).toBe(20);
			await result.getByRole('button', { name: 'Pakai', exact: true }).click();
			await showPaper(page);
			await expect(block(page, 'opening')).toHaveText(generated.opening);
			await expect(block(page, 'motivation')).toContainText(motivation);
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
			await showPaper(page);
			await expect(block(page, 'opening')).not.toHaveText(generated.opening);
		});

		test('failed and stale AI responses preserve the letter while a quota error disables further writes', async ({
			page
		}) => {
			await newLetter(page);
			await showPaper(page);
			const original = await block(page, 'opening').textContent();
			await closePaper(page);
			const state = mocks.get(page)!;
			state.mode = 'unavailable';
			await askAi(page);
			await expect(
				page.getByRole('alert').filter({ hasText: /AI|layanan|tersedia/i })
			).toBeVisible();
			await showPaper(page);
			await expect(block(page, 'opening')).toHaveText(original!);
			await closePaper(page);
			let release!: () => void;
			state.mode = 'ok';
			state.held = new Promise<void>((resolve) => {
				release = resolve;
			});
			await askAi(page);
			await expect.poll(() => state.runs.length).toBe(2);
			await step(page, 0);
			await page.locator('#letter-company').fill('PT Perusahaan Berubah');
			release();
			state.held = undefined;
			await expect(page.getByTestId('letter-ai-result-opening')).toHaveCount(0);
			await showPaper(page);
			await expect(block(page, 'opening')).toContainText('PT Perusahaan Berubah');
			await expect(block(page, 'opening')).not.toHaveText(generated.opening);
			await closePaper(page);
			state.mode = 'quota';
			await askAi(page);
			await expect(page.locator('#letter-ai-request')).toBeDisabled();
			await expect(page.getByRole('alert').filter({ hasText: /jatah|kuota|habis/i })).toBeVisible();
			expect(state.quota.remaining).toBe(0);
		});

		test('local wordiness highlights fillers and a free AI shorter version changes no daily AI quota', async ({
			page
		}) => {
			await newLetter(page);
			await step(page, 1);
			await page.locator('#letter-motivation').fill(longMotivation);
			await showPaper(page);
			await expect(block(page, 'motivation')).toHaveAttribute('data-level', /wordy|veryWordy/);
			await expect(block(page, 'motivation').locator('.letter-filler')).not.toHaveCount(0);
			await capture(page, 'letter-wordiness');
			await closePaper(page);
			await step(page, 2);
			await page.locator('#letter-concise > summary').click();
			const concise = page.getByTestId('letter-concise');
			await expect(concise.getByTestId('concise-score')).toContainText('/100');
			await concise.getByTestId('concise-ai-request').click();
			const consent = page.getByRole('dialog', { name: 'Cek keringkasan dengan AI?', exact: true });
			if (await consent.isVisible()) await consent.getByRole('button', { name: /Setuju/ }).click();
			await expect(concise.getByTestId('concise-shorter')).toContainText(shorter);
			const state = mocks.get(page)!;
			expect(state.lite).toHaveLength(1);
			expect(state.quota.remaining).toBe(3);
			expect(state.quota.lite?.remaining).toBe(19);
			await concise
				.getByTestId('concise-shorter')
				.getByRole('button', { name: 'Pakai versi ringkas', exact: true })
				.click();
			await showPaper(page);
			await expect(block(page, 'motivation')).toHaveText(shorter);
			await closePaper(page);
			await editor(page).getByRole('button', { name: 'Urungkan', exact: true }).click();
			await showPaper(page);
			await expect(block(page, 'motivation')).toContainText('Bertanggung jawab');
		});

		test('HTML-looking text and formatted paste remain literal in preview, Word, text and print', async ({
			page
		}) => {
			const dialogs: string[] = [];
			page.on('dialog', async (dialog) => {
				dialogs.push(dialog.message());
				await dialog.dismiss();
			});
			const payload = '<img src=x onerror=alert(1)>';
			const { cvId, letterId } = await newLetter(page, { company: payload });
			await showPaper(page);
			const paragraph = block(page, 'opening');
			await paragraph.focus();
			await paragraph.evaluate((element, text) => {
				const selection = getSelection();
				const range = document.createRange();
				range.selectNodeContents(element);
				selection?.removeAllRanges();
				selection?.addRange(range);
				const clipboard = new DataTransfer();
				clipboard.setData('text/plain', `Teks tempelan ${text}`);
				clipboard.setData(
					'text/html',
					'<strong>Teks tempelan</strong><img src=x onerror=alert(2)>'
				);
				element.dispatchEvent(
					new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true })
				);
			}, payload);
			await paragraph.press('Tab');
			await expect(paragraph).toHaveText(`Teks tempelan ${payload}`);
			await expect(paragraph.locator('img,script,strong')).toHaveCount(0);
			await closePaper(page);
			await step(page, 2);
			const text = await downloadText(page, 'txt');
			expect(text.text).toContain(payload);
			const word = await downloadText(page, 'docx');
			expect(word.text).toContain('&lt;img src=x onerror=alert(1)&gt;');
			await expect(saved(page)).toHaveAttribute('data-save-state', 'saved');
			await page.goto(`/cv/${cvId}/surat/${letterId}/print`);
			await expect(page.locator('.formal-letter')).toContainText(payload);
			await expect(page.locator('.formal-letter img,.formal-letter script')).toHaveCount(0);
			expect(dialogs).toEqual([]);
		});

		test('CV download offer stays optional and remembers Skip after reload', async ({ page }) => {
			await createCv(page);
			await expect(page.getByTestId('letter-offer')).toHaveCount(0);
			const event = page.waitForEvent('download');
			await page
				.getByTestId('export-panel')
				.getByRole('button', { name: 'Teks (.txt)', exact: true })
				.click();
			expect(await (await event).failure()).toBeNull();
			await expect(page.getByTestId('letter-offer')).toBeVisible();
			await page
				.getByTestId('letter-offer')
				.getByRole('button', { name: 'Lewati', exact: true })
				.click();
			await expect(page.getByTestId('letter-offer')).toHaveCount(0);
			await page.reload();
			const second = page.waitForEvent('download');
			await page
				.getByTestId('export-panel')
				.getByRole('button', { name: 'Teks (.txt)', exact: true })
				.click();
			expect(await (await second).failure()).toBeNull();
			await expect(page.getByTestId('letter-offer')).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Ubah lagi', exact: true })).toBeVisible();
		});

		test('incognito letters expire together with their CV and leave no personal copy in the UI', async ({
			page
		}) => {
			await page.clock.install();
			await newLetter(page, { incognito: true });
			await showPaper(page);
			await expect(paper(page)).toContainText(fullName);
			await page.clock.fastForward('03:02:00');
			await expect(editor(page)).toHaveCount(0);
			await expect(page.locator('.formal-letter')).toHaveCount(0);
			expect(
				await page.evaluate(() =>
					[
						document.body.textContent ?? '',
						...Array.from(
							document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'),
							(field) => field.value
						)
					].some((text) => text.includes('Nadia Surat Rahasia'))
				)
			).toBe(false);
			await appMenu(page);
			await page.getByRole('link', { name: 'Surat Lamaran', exact: true }).click();
			await expect(page.getByTestId('letter-cv-card')).toHaveCount(0);
			await overflow(page);
		});
	});
}
