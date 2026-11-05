/**
 * Template contract tests (PROJECT_SPEC §7.1 / §7.2). Every template in the registry is rendered with
 * real fixtures and checked automatically — a new template is covered as soon as it is registered.
 *
 * - All templates: pure render, escapes user text, safe link protocols, no raw HTML, no external
 *   resources, photo only through model.personal.photoUrl.
 * - ATS templates: one <h1>, one <h2> per section in model order, reading order = DOM order,
 *   every piece of content present, text labels for contact, no images/svg/tables, no CSS that
 *   reorders or positions text, no meaningful ::before/::after content.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { TEMPLATES, templatesFor, type TemplateMeta } from '../../src/lib/templates/registry';
import { toRenderModel, type RenderModel } from '../../src/lib/core/render/index';
import { emptyCvAts, sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import type { CVDocument } from '../../src/lib/core/schema/index';

// Raw sources of every template file, keyed by path (for static checks).
const SOURCES = import.meta.glob('../../src/lib/templates/**/*.svelte', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const clone = <T>(value: T): T => structuredClone(value);

function asKind(cv: CVDocument, kind: CVDocument['kind']): CVDocument {
	return { ...clone(cv), kind };
}

function inEnglish(cv: CVDocument): CVDocument {
	return { ...clone(cv), locale: 'en' };
}

/** Fixtures every template must handle. */
function fixturesFor(kind: CVDocument['kind']): [string, CVDocument][] {
	return [
		['sample ATS', asKind(sampleCvAts, kind)],
		['sample creative', asKind(sampleCvCreative, kind)],
		['sample in English', asKind(inEnglish(sampleCvAts), kind)],
		['empty CV', asKind(emptyCvAts, kind)]
	];
}

async function renderTemplate(meta: TemplateMeta, model: RenderModel): Promise<string> {
	const component = (await meta.load()).default;
	return render(component, { props: { model } }).body;
}

const decode = (html: string): string =>
	html
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

/** Visible text in DOM order (tags removed, whitespace collapsed). */
function textOf(html: string): string {
	return decode(
		html
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<style[\s\S]*?<\/style>/gi, '')
			.replace(/<[^>]+>/g, ' ')
	)
		.replace(/\s+/g, ' ')
		.trim();
}

function tagTexts(html: string, tag: string): string[] {
	return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) =>
		textOf(m[1] ?? '')
	);
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

function styleOf(source: string): string {
	return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}

function markupOf(source: string): string {
	return source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

describe('template registry', () => {
	it('has unique slug ids and at least one ATS template', () => {
		const ids = TEMPLATES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
		expect(templatesFor('ats').length).toBeGreaterThan(0);
	});

	it('ATS templates never support photos', () => {
		for (const t of templatesFor('ats')) expect(t.supportsPhoto, t.id).toBe(false);
	});

	it('every template file is registered (no orphan templates)', async () => {
		const loaded = await Promise.all(TEMPLATES.map((t) => t.load()));
		expect(loaded.length).toBe(Object.keys(SOURCES).length);
	});
});

describe('all template sources', () => {
	for (const [path, source] of Object.entries(SOURCES)) {
		const name = path.split('/templates/')[1];

		it(`${name}: no raw HTML, no external resources, no side effects`, () => {
			expect(source).not.toMatch(/\{@html/);
			const css = styleOf(source);
			expect(css, 'no @import in CSS').not.toMatch(/@import/);
			expect(css, 'no url() in CSS (fonts/images must not be fetched)').not.toMatch(/url\(/);
			const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '';
			expect(script, 'templates must not fetch').not.toMatch(/\bfetch\(|XMLHttpRequest/);
			expect(script, 'templates must not use storage').not.toMatch(/localStorage|indexedDB/);
			expect(script, 'templates must not import stores/storage').not.toMatch(
				/core\/(storage|store)\//
			);
		});
	}

	for (const [path, source] of Object.entries(SOURCES).filter(([p]) => p.includes('/ats/'))) {
		const name = path.split('/templates/')[1];

		it(`${name}: ATS markup has no images, icons or tables`, () => {
			const markup = markupOf(source);
			expect(markup).not.toMatch(/<(img|svg|table|canvas|picture|video|iframe)\b/i);
		});

		it(`${name}: ATS CSS keeps reading order (no reordering/positioning)`, () => {
			const css = styleOf(source);
			expect(css).not.toMatch(/position\s*:\s*(absolute|fixed)/);
			expect(css).not.toMatch(/(^|[;\s{])order\s*:/);
			expect(css).not.toMatch(/row-reverse|column-reverse|grid-template-areas/);
			expect(css).not.toMatch(/(^|[;\s{])float\s*:\s*(left|right)/);
			expect(css).not.toMatch(/column-count|(^|[;\s{])columns\s*:/);
		});

		it(`${name}: ATS CSS has no text in ::before/::after`, () => {
			const css = styleOf(source);
			const meaningful = [...css.matchAll(/::?(before|after)[^{]*\{([^}]*)\}/g)]
				.map((block) => block[2]?.match(/content\s*:\s*([^;]+)/)?.[1]?.trim())
				.filter((content) => content && !/^(none|''|"")$/.test(content));
			expect(meaningful, 'pseudo-element content must be empty').toEqual([]);
		});
	}
});

for (const meta of TEMPLATES) {
	describe(`template ${meta.id} (${meta.kind}) — rendering`, () => {
		for (const [label, cv] of fixturesFor(meta.kind)) {
			it(`renders ${label} with exactly one <h1> and safe links`, async () => {
				const model = toRenderModel(cv, { photoUrl: 'blob:http://localhost/photo' });
				const html = await renderTemplate(meta, model);
				expect(tagTexts(html, 'h1')).toHaveLength(1);
				for (const href of html.matchAll(/\shref="([^"]*)"/g)) {
					expect(decode(href[1] ?? '')).toMatch(/^(https?:|mailto:|tel:)/);
				}
				expect(html).not.toMatch(/<script\b/i);
			});
		}

		it('escapes user text (no HTML injection)', async () => {
			const cv = asKind(sampleCvAts, meta.kind);
			cv.personal.fullName = '<script>alert(1)</script>';
			cv.summary = '<img src=x onerror=alert(1)>';
			cv.experience[0]!.bullets = ['<b>bold</b> & "quoted"'];
			const html = await renderTemplate(meta, toRenderModel(cv));
			expect(html).not.toMatch(/<script>alert/);
			expect(html).not.toMatch(/<img src=x/);
			expect(html).not.toMatch(/<b>bold<\/b>/);
			expect(textOf(html)).toContain('<script>alert(1)</script>');
		});

		it('shows the photo only through model.personal.photoUrl, with alt text', async () => {
			const photoUrl = 'blob:http://localhost/photo-123';
			const model = toRenderModel(asKind(sampleCvCreative, meta.kind), { photoUrl });
			const html = await renderTemplate(meta, model);
			for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
				expect(img[0]).toContain(`src="${photoUrl}"`);
				expect(img[0]).toMatch(/\salt="[^"]+"/);
			}
			if (!meta.supportsPhoto) expect(html).not.toMatch(/<img\b/i);
		});
	});
}

for (const meta of templatesFor('ats')) {
	describe(`ATS contract — ${meta.id}`, () => {
		for (const [label, cv] of fixturesFor('ats')) {
			it(`${label}: one <h2> per section, in model order`, async () => {
				const model = toRenderModel(cv);
				const html = await renderTemplate(meta, model);
				expect(tagTexts(html, 'h2')).toEqual(model.sections.map((s) => squash(s.title)));
			});

			it(`${label}: reading order follows the model (DOM order = visual order)`, async () => {
				const model = toRenderModel(cv);
				const text = textOf(await renderTemplate(meta, model));
				let cursor = model.personal.fullName ? text.indexOf(model.personal.fullName) : 0;
				expect(cursor).toBeGreaterThanOrEqual(0);
				for (const section of model.sections) {
					const at = text.indexOf(squash(section.title), cursor);
					expect(at, `section "${section.title}" after previous content`).toBeGreaterThan(
						cursor - 1
					);
					cursor = at;
					if (section.type !== 'entries') continue;
					for (const entry of section.entries) {
						const titleAt = text.indexOf(squash(entry.title), cursor);
						expect(titleAt, `entry "${entry.title}" in order`).toBeGreaterThanOrEqual(cursor);
						cursor = titleAt;
						for (const bullet of entry.bullets) {
							const bulletAt = text.indexOf(squash(bullet), cursor);
							expect(bulletAt, `bullet after its entry title`).toBeGreaterThanOrEqual(cursor);
							cursor = bulletAt;
						}
					}
				}
			});

			it(`${label}: every piece of content is present as text`, async () => {
				const model = toRenderModel(cv);
				const text = textOf(await renderTemplate(meta, model));
				const p = model.personal;
				const expected = [p.fullName, p.headline, p.email, p.phone, p.location];
				for (const link of p.links) expected.push(link.display);
				for (const section of model.sections) {
					if (section.type === 'text') expected.push(...section.paragraphs);
					if (section.type === 'skills')
						for (const group of section.groups) expected.push(group.label, ...group.items);
					if (section.type === 'entries')
						for (const e of section.entries)
							expected.push(
								e.title,
								e.subtitle,
								e.dateText,
								e.location,
								e.description,
								e.link?.display,
								...e.meta,
								...e.bullets
							);
				}
				const missing = expected.filter(
					(value): value is string => Boolean(value) && !text.includes(squash(value as string))
				);
				expect(missing, 'content missing from the rendered CV').toEqual([]);
			});

			it(`${label}: contact info uses text labels, not icons`, async () => {
				const model = toRenderModel(cv);
				const text = textOf(await renderTemplate(meta, model));
				const missing = [
					model.personal.email ? `${model.labels.email}:` : undefined,
					model.personal.phone ? `${model.labels.phone}:` : undefined
				].filter((label): label is string => label !== undefined && !text.includes(label));
				expect(missing).toEqual([]);
			});
		}
	});
}
