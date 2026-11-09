import { describe, expect, it } from 'vitest';
import {
	addCustomSection,
	canAddCustomSection,
	editorSections,
	moveSection,
	moveSectionTo,
	removeCustomSection,
	renameSection,
	setSectionHidden
} from '../../src/lib/core/layout/index';
import { loadCvDocument } from '../../src/lib/core/schema/migrations';
import { LIMITS } from '../../src/lib/core/schema/limits';
import { toRenderModel } from '../../src/lib/core/render/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import type { CVDocument } from '../../src/lib/core/schema/types';

const fresh = (): CVDocument => structuredClone(sampleCvAts);

/** The layout must stay valid: a load round-trip does not change it. */
function expectValid(cv: CVDocument) {
	const result = loadCvDocument(structuredClone(cv));
	expect(result.ok).toBe(true);
	if (result.ok) expect(result.cv.layout).toEqual(cv.layout);
}

describe('editorSections', () => {
	it('lists sections in CV order with titles in the CV language and counts', () => {
		const cv = fresh();
		const rows = editorSections(cv);
		expect(rows.map((row) => row.key)).toEqual(cv.layout.order);
		const experience = rows.find((row) => row.key === 'experience')!;
		expect(experience.title).toBe(experience.defaultTitle);
		expect(experience.renamed).toBe(false);
		expect(experience.count).toBe(cv.experience.length);
		expect(rows[0]!.canMoveUp).toBe(false);
		expect(rows.at(-1)!.canMoveDown).toBe(false);

		cv.locale = 'en';
		expect(editorSections(cv).find((row) => row.key === 'experience')!.defaultTitle).not.toBe(
			experience.defaultTitle
		);
	});
});

describe('order', () => {
	it('moves a section up/down and to an index (clamped), keeping the layout valid', () => {
		const cv = fresh();
		const [first, second] = cv.layout.order;
		moveSection(cv, second!, -1);
		expect(cv.layout.order.slice(0, 2)).toEqual([second, first]);
		moveSection(cv, second!, -1); // already first
		expect(cv.layout.order[0]).toBe(second);

		moveSectionTo(cv, second!, 999);
		expect(cv.layout.order.at(-1)).toBe(second);
		moveSectionTo(cv, second!, -5);
		expect(cv.layout.order[0]).toBe(second);
		expectValid(cv);
	});

	it('ignores unknown keys', () => {
		const cv = fresh();
		const before = [...cv.layout.order];
		moveSection(cv, 'custom:nope', 1);
		moveSectionTo(cv, 'custom:nope', 0);
		expect(cv.layout.order).toEqual(before);
	});

	it('the rendered CV follows the new order', () => {
		const cv = fresh();
		moveSectionTo(cv, 'skills', 0);
		expect(toRenderModel(cv).sections[0]?.key).toBe('skills');
	});
});

describe('hide / show', () => {
	it('hides a section from the CV without deleting its content, and shows it again', () => {
		const cv = fresh();
		setSectionHidden(cv, 'experience', true);
		setSectionHidden(cv, 'experience', true); // no duplicates
		expect(cv.layout.hidden.filter((key) => key === 'experience')).toHaveLength(1);
		expect(toRenderModel(cv).sections.some((s) => s.key === 'experience')).toBe(false);
		expect(cv.experience.length).toBeGreaterThan(0);
		expect(editorSections(cv).find((row) => row.key === 'experience')!.hidden).toBe(true);
		expectValid(cv);

		setSectionHidden(cv, 'experience', false);
		expect(toRenderModel(cv).sections.some((s) => s.key === 'experience')).toBe(true);
	});
});

describe('rename', () => {
	it('renames a built-in section; empty or default title resets it', () => {
		const cv = fresh();
		renameSection(cv, 'experience', '  Pengalaman   Magang ');
		expect(cv.layout.customTitles.experience).toBe('Pengalaman Magang');
		expect(toRenderModel(cv).sections.find((s) => s.key === 'experience')?.title).toBe(
			'Pengalaman Magang'
		);
		const row = editorSections(cv).find((r) => r.key === 'experience')!;
		expect(row.renamed).toBe(true);
		expectValid(cv);

		renameSection(cv, 'experience', '');
		expect(cv.layout.customTitles.experience).toBeUndefined();
		renameSection(cv, 'experience', row.defaultTitle);
		expect(cv.layout.customTitles.experience).toBeUndefined();
	});

	it('cleans and limits the title', () => {
		const cv = fresh();
		renameSection(cv, 'awards', `Prestasi\u0000${'x'.repeat(500)}`);
		const title = cv.layout.customTitles.awards!;
		expect(title.length).toBeLessThanOrEqual(LIMITS.title);
		expect(title).not.toContain('\u0000');
	});
});

describe('custom sections', () => {
	it('adds, renames and removes a custom section', () => {
		const cv = fresh();
		const key = addCustomSection(cv, 'Pelatihan')!;
		expect(key).toMatch(/^custom:[a-z0-9-]+$/);
		expect(cv.layout.order.at(-1)).toBe(key);
		expect(cv.custom.find((s) => s.key === key)?.title).toBe('Pelatihan');
		const row = editorSections(cv).find((r) => r.key === key)!;
		expect(row).toMatchObject({ custom: true, title: 'Pelatihan', count: 0 });
		expectValid(cv);

		renameSection(cv, key, 'Pelatihan & Sertifikasi');
		expect(cv.custom.find((s) => s.key === key)?.title).toBe('Pelatihan & Sertifikasi');
		renameSection(cv, key, '   '); // custom sections always keep a title
		expect(cv.custom.find((s) => s.key === key)?.title).toBe('Pelatihan & Sertifikasi');

		setSectionHidden(cv, key, true);
		removeCustomSection(cv, key);
		expect(cv.custom.some((s) => s.key === key)).toBe(false);
		expect(cv.layout.order).not.toContain(key);
		expect(cv.layout.hidden).not.toContain(key);
		expectValid(cv);
	});

	it('respects the limit and rejects empty titles', () => {
		const cv = fresh();
		expect(addCustomSection(cv, '   ')).toBeUndefined();
		for (let i = cv.custom.length; i < LIMITS.customSections; i++) {
			expect(addCustomSection(cv, `Bagian ${i}`)).toBeDefined();
		}
		expect(canAddCustomSection(cv)).toBe(false);
		expect(addCustomSection(cv, 'Satu lagi')).toBeUndefined();
		expect(cv.custom).toHaveLength(LIMITS.customSections);
		expectValid(cv);
	});

	it('built-in sections cannot be removed', () => {
		const cv = fresh();
		removeCustomSection(cv, 'experience');
		expect(cv.layout.order).toContain('experience');
		expect(cv.experience.length).toBeGreaterThan(0);
	});
});
