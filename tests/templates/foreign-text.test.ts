import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ForeignText from '../../src/lib/templates/shared/ForeignText.svelte';
import { createForeignMatcher } from '../../src/lib/core/foreign/index';
import { toRenderModel, type RenderModel } from '../../src/lib/core/render/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { TEMPLATES, type TemplateMeta } from '../../src/lib/templates/registry';

const decode = (html: string): string =>
	html
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

/** Join the actual text nodes; inline tags and Svelte anchors add no characters. */
const exactText = (html: string): string =>
	decode(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ''));

const emphasized = (html: string): string[] =>
	[...html.matchAll(/<em\b[^>]*>([\s\S]*?)<\/em>/g)].map((match) => exactText(match[1] ?? ''));

const matcher = createForeignMatcher({
	names: ['PT Tokopedia', 'Universitas Brawijaya', 'Google Developer Student Clubs']
});

describe('ForeignText', () => {
	it('preserves punctuation, line breaks, repeated spaces and a partly italic word exactly', () => {
		const text = 'teamwork,di-update — problem solving;\n  JavaScript & 😊';
		const html = render(ForeignText, { props: { text, matcher } }).body;
		expect(exactText(html)).toBe(text);
		expect(emphasized(html)).toEqual(['teamwork', 'update', 'problem solving']);
		expect(html).not.toMatch(/<(span|div|p)\b/);
	});

	it('does not add markup or characters without a matcher', () => {
		const text = '  Web Developer Intern,teamwork\n\n<>&"\'  ';
		const html = render(ForeignText, { props: { text } }).body;
		expect(exactText(html)).toBe(text);
		expect(emphasized(html)).toEqual([]);
		expect(html.replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/<[^>]+>/);
	});

	it('keeps proper names and technology names upright', () => {
		const text = 'PT Tokopedia, Universitas Brawijaya, Google Developer Student Clubs, JavaScript';
		const html = render(ForeignText, { props: { text, matcher } }).body;
		expect(exactText(html)).toBe(text);
		expect(emphasized(html)).toEqual([]);
	});

	it('escapes markup-like text while italicising only its ordinary text', () => {
		const text = '<img src=x onerror=alert(1)> teamwork & <script>alert(1)</script>';
		const html = render(ForeignText, { props: { text, matcher } }).body;
		expect(exactText(html)).toBe(text);
		expect(html).not.toMatch(/<(img|script)\b/i);
		expect(emphasized(html)).toContain('teamwork');
	});

	it('renders empty text without an element', () => {
		expect(exactText(render(ForeignText, { props: { text: '', matcher } }).body)).toBe('');
	});
});

const summary = ['Belajar teamwork,di-update.', 'problem solving & <img src=x onerror=alert(1)>'];

/** One model exercises every eligible field and puts a foreign word in each excluded field. */
function fieldModel(meta: TemplateMeta, editing = false): RenderModel {
	const cv = { ...structuredClone(sampleCvAts), kind: meta.kind, locale: 'id' as const };
	return {
		...toRenderModel(cv),
		templateId: meta.id,
		...(editing ? { editing: true as const } : {}),
		foreign: matcher,
		personal: {
			fullName: 'teamwork',
			headline: 'Web Developer Intern',
			email: 'teamwork@example.com',
			emailHref: 'mailto:teamwork@example.com',
			phone: 'teamwork',
			phoneHref: 'tel:123',
			location: 'teamwork',
			links: [{ label: 'teamwork', display: 'teamwork', href: 'https://example.com/teamwork' }]
		},
		sections: [
			{ type: 'text', key: 'summary', title: 'teamwork', paragraphs: summary },
			{
				type: 'entries',
				key: 'experience',
				title: 'teamwork',
				entries: [
					{
						id: 'foreign-entry',
						title: 'Web Developer Intern',
						subtitle: 'PT Tokopedia',
						meta: ['Freelance', 'Skripsi: teamwork'],
						dateText: 'teamwork',
						location: 'teamwork',
						link: { label: 'teamwork', display: 'teamwork', href: 'https://example.com/teamwork' },
						description: 'problem solving',
						bullets: [
							'Menerapkan teamwork,problem solving; JavaScript & <img src=x onerror=alert(1)>'
						]
					},
					{
						id: 'proper-names',
						title: 'Universitas Brawijaya',
						subtitle: 'Google Developer Student Clubs',
						meta: [],
						bullets: []
					}
				]
			},
			{
				type: 'skills',
				key: 'skills',
				title: 'teamwork',
				groups: [
					{
						key: 'soft',
						label: 'Soft Skills',
						items: ['teamwork', 'problem solving', 'JavaScript']
					}
				]
			},
			{
				type: 'entries',
				key: 'custom:foreign',
				title: 'teamwork',
				entries: [
					{
						id: 'custom-entry',
						title: 'Web Developer Intern',
						subtitle: 'problem solving',
						meta: [],
						bullets: ['teamwork']
					}
				]
			}
		]
	};
}

async function renderTemplate(meta: TemplateMeta, model: RenderModel): Promise<string> {
	const component = (await meta.load()).default;
	return render(component, { props: { model } }).body;
}

function editableTexts(html: string): [string, string][] {
	return [
		...html.matchAll(/<(h[123]|p|li)\b[^>]*\bdata-edit="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)
	].map((match): [string, string] => [decode(match[2] ?? ''), exactText(match[3] ?? '')]);
}

for (const meta of TEMPLATES) {
	describe(`foreign text — ${meta.id}`, () => {
		it('keeps the complete extracted text identical with automatic italics on and off', async () => {
			const model = fieldModel(meta);
			const on = await renderTemplate(meta, model);
			const off = await renderTemplate(meta, { ...model, foreign: undefined });
			expect(exactText(on)).toBe(exactText(off));
			expect(on).not.toMatch(/<img src=x/);
			expect(exactText(on)).toContain('<img src=x onerror=alert(1)>');
			expect(emphasized(off)).toEqual([]);
		});

		it('italicises every eligible field including metadata, skill labels and custom items', async () => {
			const html = await renderTemplate(meta, fieldModel(meta));
			const expected = [
				...Array<string>(3).fill('Web Developer Intern'),
				...Array<string>(5).fill('teamwork'),
				...Array<string>(5).fill('problem solving'),
				'update',
				'Freelance',
				'Soft Skills'
			];
			expect(emphasized(html).sort()).toEqual(expected.sort());
			for (const tag of ['h1', 'h2', 'a']) {
				for (const match of html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g')))
					expect(match[1]).not.toMatch(/<em\b/);
			}
		});

		it('does not add automatic emphasis to an English CV', async () => {
			const cv = {
				...structuredClone(sampleCvAts),
				kind: meta.kind,
				locale: 'en' as const,
				templateId: meta.id
			};
			const model = toRenderModel(cv);
			expect(model.foreign).toBeUndefined();
			expect(emphasized(await renderTemplate(meta, model))).toEqual([]);
		});

		if (meta.kind === 'creative') {
			it('preserves editable parent hooks and the exact joined summary while editing', async () => {
				const model = fieldModel(meta, true);
				const on = await renderTemplate(meta, model);
				const off = await renderTemplate(meta, { ...model, foreign: undefined });
				const fields = editableTexts(on);
				expect(fields).toEqual(editableTexts(off));
				expect(fields).toContainEqual(['summary', summary.join('\n')]);
				expect(fields.length).toBeGreaterThan(10);
				expect(exactText(on)).toBe(exactText(off));
			});
		}
	});
}
