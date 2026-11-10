import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Shift = { startTime: number; value: number; hadRecentInput: boolean };
interface TransitionRecord {
	started: number;
	finished?: number;
	done: Promise<void>;
}
interface Probe {
	start: number;
	last: number;
	frames: number[];
	longTasks: { startTime: number; duration: number }[];
	running: boolean;
	raf: number;
	observer: PerformanceObserver;
}
interface NavResult {
	click: number;
	paintedMs: number;
	completeMs: number;
	shifts: Shift[];
	cls: number;
	rawShiftTotal: number;
	transitionCalls: number;
}
interface SmoothWindow {
	smoothTransitions: TransitionRecord[];
	smoothNative: boolean;
	smoothProbe?: Probe;
	smoothNavigation?: NavResult;
}

const phase = process.env.SMOOTH_PHASE === 'before' ? 'before' : 'after';
const out = resolve('.svelte-kit', `smooth-${phase}`);

async function report(name: string, value: unknown) {
	await mkdir(out, { recursive: true });
	await writeFile(resolve(out, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
	console.log(
		`SMOOTH ${phase} ${name}: ${JSON.stringify(value, (key, item) => (key === 'frames' && Array.isArray(item) ? { count: item.length } : item))}`
	);
}

async function mocks(page: Page, baseURL?: string) {
	if (!baseURL) throw new Error('A local preview baseURL is required.');
	const origin = new URL(baseURL).origin;
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) throw new Error(`Unexpected external request ${url.href}`);
		if (url.pathname === '/api/hello') return route.fulfill({ json: { visitors: 1234 } });
		if (url.pathname === '/api/ai/quota')
			return route.fulfill({
				json: { limit: 3, remaining: 3, resetsAt: '2026-11-11T17:00:00.000Z' }
			});
		if (url.pathname.startsWith('/api/'))
			return route.fulfill({ status: 503, json: { error: 'unavailable' } });
		return route.continue();
	});
	await page.addInitScript(() => {
		const state = window as unknown as SmoothWindow;
		state.smoothTransitions = [];
		state.smoothNative = typeof document.startViewTransition === 'function';
		if (!state.smoothNative) return;
		const original = document.startViewTransition.bind(document);
		document.startViewTransition = (...args: Parameters<typeof original>) => {
			const transition = original(...args);
			const record: TransitionRecord = { started: performance.now(), done: Promise.resolve() };
			record.done = transition.finished.then(
				() => {
					record.finished = performance.now();
				},
				() => {
					record.finished = performance.now();
				}
			);
			state.smoothTransitions.push(record);
			return transition;
		};
	});
}

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	const saved = page.getByTestId('save-status');
	if (await saved.count()) await expect(saved).toHaveAttribute('data-save-state', 'saved');
	await page.evaluate(
		() =>
			new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
	);
}

async function advance(page: Page, title: string, skip = false) {
	await page.getByRole('button', { name: skip ? 'Lewati' : 'Lanjut', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText(title);
}

async function experience(page: Page) {
	await page.goto('/buat');
	await page.getByRole('button', { name: 'Pilih CV ATS', exact: true }).click();
	await advance(page, 'Data diri');
	await page.getByLabel(/^Nama lengkap\b/).fill('Nadia Performa');
	await page.getByLabel(/^Email\b/).fill('nadia.performa@example.com');
	await page.getByLabel(/^Nomor HP\b/).fill('081234567890');
	await advance(page, 'Pendidikan');
	await page.getByRole('button', { name: 'Tambah Pendidikan', exact: true }).click();
	const school = page.getByRole('combobox', { name: /^Nama sekolah \/ kampus/ });
	await school.fill('Universitas Nusantara');
	await school.press('Escape');
	await advance(page, 'Pengalaman kerja / magang');
	await page.getByRole('button', { name: 'Tambah Pengalaman kerja / magang', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Posisi / peran', exact: true })
		.fill('Data Analyst Intern');
	await page.keyboard.press('Escape');
	await page.getByLabel('Perusahaan / tempat kerja', { exact: true }).fill('PT Nusantara');
	for (const [index, text] of [
		'Membuat 12 dashboard penjualan untuk membantu tim keuangan memeriksa laporan mingguan.',
		'Membersihkan 500 baris data transaksi menggunakan Microsoft Excel dan SQL.',
		'Menyusun laporan penjualan bulanan untuk 3 cabang perusahaan.'
	].entries()) {
		await page.getByRole('button', { name: 'Tambah poin', exact: true }).click();
		await page.getByRole('textbox', { name: `Poin ${index + 1}`, exact: true }).fill(text);
	}
	await settled(page);
}

async function editor(page: Page) {
	await experience(page);
	await advance(page, 'Organisasi & kepanitiaan');
	for (const title of ['Proyek', 'Keahlian & pencapaian', 'Ringkasan profil', 'Tinjau CV-mu'])
		await advance(page, title, true);
	await page.getByRole('button', { name: 'Selesai', exact: true }).click();
	await expect(page.locator('.step-heading h1')).toHaveText('CV-mu tersimpan');
	await page.getByText('Ubah lagi', { exact: true }).click();
	await expect(page.getByTestId('full-editor')).toBeVisible();
	await settled(page);
}

async function scroll(page: Page, cdp: CDPSession, name: string) {
	await page.bringToFront();
	await page.evaluate(() => window.scrollTo(0, 0));
	await settled(page);
	const distance = await page.evaluate(() =>
		Math.max(0, document.documentElement.scrollHeight - innerHeight)
	);
	expect(distance, 'The fixture must have real content to scroll').toBeGreaterThan(100);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	await page.evaluate(async () => {
		const state = window as unknown as SmoothWindow;
		const probe: Probe = {
			start: performance.now(),
			last: 0,
			frames: [],
			longTasks: [],
			running: true,
			raf: 0,
			observer: new PerformanceObserver((list) => {
				for (const entry of list.getEntries())
					probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
			})
		};
		probe.observer.observe({ type: 'longtask' });
		const frame = (time: number) => {
			if (!probe.running) return;
			if (probe.last) probe.frames.push(time - probe.last);
			probe.last = time;
			probe.raf = requestAnimationFrame(frame);
		};
		state.smoothProbe = probe;
		probe.raf = requestAnimationFrame(frame);
		await new Promise<void>((done) =>
			requestAnimationFrame(() => requestAnimationFrame(() => done()))
		);
	});
	const positions: { down: number; up: number }[] = [];
	const speed = 2000;
	for (let cycle = 0; cycle < 12; cycle += 1) {
		await cdp.send('Input.synthesizeScrollGesture', {
			x: 8,
			y: 390,
			yDistance: -distance,
			speed,
			preventFling: true,
			gestureSourceType: 'mouse'
		});
		const down = await page.evaluate(() => scrollY);
		await cdp.send('Input.synthesizeScrollGesture', {
			x: 8,
			y: 390,
			yDistance: distance,
			speed,
			preventFling: true,
			gestureSourceType: 'mouse'
		});
		positions.push({ down, up: await page.evaluate(() => scrollY) });
	}
	const result = await page.evaluate(() => {
		const probe = (window as unknown as SmoothWindow).smoothProbe;
		if (!probe) throw new Error('No active scroll probe.');
		probe.running = false;
		cancelAnimationFrame(probe.raf);
		for (const entry of probe.observer.takeRecords())
			probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
		probe.observer.disconnect();
		return {
			durationMs: performance.now() - probe.start,
			frames: probe.frames,
			framesOver50: probe.frames.filter((duration) => duration > 50),
			maxFrameMs: Math.max(0, ...probe.frames),
			longTasks: probe.longTasks,
			longTasksOver100: probe.longTasks.filter(({ duration }) => duration > 100)
		};
	});
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
	await report(name, { ...result, distance, speed, positions, cycles: 12, cpuRate: 4 });
	expect(
		positions.every(({ down, up }) => down > up + 100),
		'Every native scroll pair must actually move the page'
	).toBe(true);
	expect(result.frames.length).toBeGreaterThan(24);
	expect(
		result.framesOver50,
		'No frame longer than 50 ms throughout all 24 native scroll gestures'
	).toEqual([]);
	expect(
		result.longTasksOver100,
		'No long task longer than 100 ms throughout the scroll window'
	).toEqual([]);
}

async function navigate(page: Page, link: Locator, path: string, title: string) {
	await page.evaluate(
		({ path, title }) => {
			const state = window as unknown as SmoothWindow;
			state.smoothNavigation = undefined;
			const shifts: Shift[] = [];
			let click = 0;
			let scheduled = false;
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
					shifts.push({
						startTime: shift.startTime,
						value: shift.value,
						hadRecentInput: shift.hadRecentInput
					});
				}
			});
			observer.observe({ type: 'layout-shift' });
			const mutations = new MutationObserver(() => {
				if (
					!click ||
					scheduled ||
					location.pathname !== path ||
					document.querySelector('h1')?.textContent?.trim() !== title
				)
					return;
				scheduled = true;
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						void (async () => {
							const paintedMs = performance.now() - click;
							const transitions = state.smoothTransitions.filter(({ started }) => started >= click);
							await Promise.all(transitions.map(({ done }) => done));
							for (const entry of observer.takeRecords()) {
								const shift = entry as PerformanceEntry & {
									value: number;
									hadRecentInput: boolean;
								};
								shifts.push({
									startTime: shift.startTime,
									value: shift.value,
									hadRecentInput: shift.hadRecentInput
								});
							}
							observer.disconnect();
							mutations.disconnect();
							const relevant = shifts.filter(({ startTime }) => startTime >= click);
							let cls = 0;
							let sum = 0;
							let first = 0;
							let previous = 0;
							for (const shift of relevant.filter(({ hadRecentInput }) => !hadRecentInput)) {
								if (shift.startTime - previous > 1000 || shift.startTime - first > 5000) {
									sum = 0;
									first = shift.startTime;
								}
								sum += shift.value;
								previous = shift.startTime;
								cls = Math.max(cls, sum);
							}
							state.smoothNavigation = {
								click,
								paintedMs,
								completeMs: performance.now() - click,
								shifts: relevant,
								cls,
								rawShiftTotal: relevant.reduce((sum, shift) => sum + shift.value, 0),
								transitionCalls: transitions.length
							};
						})();
					})
				);
			});
			mutations.observe(document.body, { subtree: true, childList: true, characterData: true });
			const clicked = (event: MouseEvent) => {
				const anchor = (event.target as Element).closest('a');
				if (!anchor || new URL(anchor.href).pathname !== path) return;
				click = performance.now();
				document.removeEventListener('click', clicked, true);
			};
			document.addEventListener('click', clicked, true);
		},
		{ path, title }
	);
	await link.click();
	await expect
		.poll(() => page.evaluate(() => Boolean((window as unknown as SmoothWindow).smoothNavigation)))
		.toBe(true);
	const result = await page.evaluate(() => (window as unknown as SmoothWindow).smoothNavigation);
	if (!result) throw new Error('Navigation did not produce a measurement.');
	return result;
}

test.describe.configure({ mode: 'default' });
// Recording DOM snapshots/screencast while benchmarking introduces work absent in the product.
// Keep all timing samples in JSON instead; visual recording runs separately from measurement.
test.use({ trace: 'off' });
test.beforeEach(async ({ page, browserName, baseURL }, info) => {
	test.skip(
		browserName !== 'chromium' || info.project.name !== 'mobile-360',
		'Performance measurements target Chromium mobile-360 only.'
	);
	await mocks(page, baseURL);
});

test('landing scroll has zero frames over 50ms and zero tasks over 100ms at CPU4x', async ({
	page,
	context
}) => {
	// Full-height 12 down/up pairs at 2000px/s need a distance-based run budget.
	test.setTimeout(60_000);
	await page.goto('/');
	await expect(page.getByTestId('visitor-count').locator('strong')).toHaveText('1.234');
	const cdp = await context.newCDPSession(page);
	try {
		await scroll(page, cdp, 'landing-scroll');
	} finally {
		await cdp.detach();
	}
});

test('wizard scroll has zero frames over 50ms and zero tasks over 100ms at CPU4x', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	await experience(page);
	const cdp = await context.newCDPSession(page);
	try {
		await scroll(page, cdp, 'wizard-scroll');
	} finally {
		await cdp.detach();
	}
});

test('editor scroll has zero frames over 50ms and zero tasks over 100ms at CPU4x', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	await editor(page);
	const cdp = await context.newCDPSession(page);
	try {
		await scroll(page, cdp, 'editor-scroll');
	} finally {
		await cdp.detach();
	}
});

test('real links navigate landing to FAQ to create in under600ms with CLS under0.02', async ({
	page,
	context
}) => {
	await page.goto('/');
	await expect(page.getByTestId('visitor-count').locator('strong')).toHaveText('1.234');
	await settled(page);
	const cdp = await context.newCDPSession(page);
	try {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await page.getByRole('button', { name: 'Menu', exact: true }).click();
		const faq = await navigate(
			page,
			page.locator('.site-header nav').getByRole('link', { name: 'FAQ', exact: true }),
			'/faq',
			'FAQ'
		);
		const create = await navigate(
			page,
			page
				.locator('.site-header .create-action')
				.getByRole('link', { name: 'Buat CV', exact: true }),
			'/buat',
			'Pilih jenis CV-mu'
		);
		await report('navigation', { cpuRate: 4, faq, create });
		for (const result of [faq, create]) {
			expect(result.paintedMs).toBeLessThan(600);
			expect(result.completeMs).toBeLessThan(600);
			expect(result.cls).toBeLessThan(0.02);
			if (
				phase === 'after' &&
				(await page.evaluate(() => (window as unknown as SmoothWindow).smoothNative))
			)
				expect(result.transitionCalls).toBeGreaterThan(0);
		}
	} finally {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		await cdp.detach();
	}
});

test('reduced motion keeps real navigation working without view transition animations', async ({
	page,
	context
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await settled(page);
	const cdp = await context.newCDPSession(page);
	try {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await page.getByRole('button', { name: 'Menu', exact: true }).click();
		const result = await navigate(
			page,
			page.locator('.site-header nav').getByRole('link', { name: 'FAQ', exact: true }),
			'/faq',
			'FAQ'
		);
		const animations = await page.evaluate(() => ({
			calls: (window as unknown as SmoothWindow).smoothTransitions.length,
			active: document
				.getAnimations()
				.filter((animation) =>
					String((animation.effect as KeyframeEffect | null)?.pseudoElement ?? '').includes(
						'view-transition'
					)
				).length
		}));
		await report('reduced-motion', { result, animations, cpuRate: 4 });
		expect(animations.calls).toBe(0);
		expect(animations.active).toBe(0);
	} finally {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		await cdp.detach();
	}
});
