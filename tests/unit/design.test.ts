import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DESIGN,
	applyInline,
	canEditInline,
	columnSections,
	editKey,
	hasCustomDesign,
	inlineLimit,
	insertBulletAfter,
	parseEditKey,
	placeSection,
	readInline,
	removeBullet,
	resetDesign,
	resolveDesign,
	sectionColumn,
	setDesign,
	type EditTarget
} from '../../src/lib/core/design/index';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import { splitColumns, toRenderModel } from '../../src/lib/core/render/index';
import { DESIGN_LIMITS, LIMITS } from '../../src/lib/core/schema/limits';
import { loadCvDocument } from '../../src/lib/core/schema/migrations';
import { createCvStore } from '../../src/lib/core/store/cv-store.svelte';
import type { CVDocument } from '../../src/lib/core/schema/types';

const fresh = (): CVDocument => structuredClone(sampleCvCreative);

function load(raw: unknown): CVDocument {
	const result = loadCvDocument(raw);
	if (!result.ok) throw new Error(result.error);
	return result.cv;
}

/** The document must stay valid: a load round-trip does not change layout or design. */
function expectValid(cv: CVDocument) {
	const loaded = load(structuredClone(cv));
	expect(loaded.layout).toEqual(cv.layout);
	expect(loaded.design).toEqual(cv.design);
}

describe('design schema', () => {
	it('a CV without design loads without one (old CVs keep their look)', () => {
		expect(load(fresh()).design).toBeUndefined();
		expect(resolveDesign(fresh())).toMatchObject({
			...DEFAULT_DESIGN,
			side: ['skills', 'languages']
		});
	});

	it('drops bad values, clamps the width and keeps only real, unique section keys', () => {
		const cv = load({
			...fresh(),
			design: {
				side: ['skills', 'skills', 'nope', '__proto__', 42, 'custom:missing', 'custom:portfolio'],
				sidePosition: 'top',
				sideWidth: 99,
				spacing: 'airy',
				photoShape: 'star',
				photoSize: 'lg',
				extra: '<script>'
			}
		});
		expect(cv.design).toEqual({
			side: ['skills', 'custom:portfolio'],
			sideWidth: DESIGN_LIMITS.sideWidth.max,
			spacing: 'airy',
			photoSize: 'lg'
		});
	});

	it('a design with nothing valid disappears; a wrong type never fails the load', () => {
		expect(load({ ...fresh(), design: { sidePosition: 1, sideWidth: Number.NaN } }).design).toBe(
			undefined
		);
		expect(load({ ...fresh(), design: 'big' }).design).toBeUndefined();
		expect(load({ ...fresh(), design: { side: 'skills' } }).design).toBeUndefined();
	});
});

describe('placeSection', () => {
	it('moves a section into the side column at a position, keeping order and columns consistent', () => {
		const cv = fresh();
		placeSection(cv, 'awards', 'side', 0);
		expect(columnSections(cv, 'side')).toEqual(['awards', 'skills', 'languages']);
		expect(sectionColumn(cv, 'awards')).toBe('side');
		expect(cv.layout.order.indexOf('awards')).toBeLessThan(cv.layout.order.indexOf('skills'));
		expectValid(cv);
	});

	it('moves a section to the main column; index is clamped', () => {
		const cv = fresh();
		placeSection(cv, 'skills', 'main', 1);
		expect(columnSections(cv, 'main').slice(0, 3)).toEqual(['summary', 'skills', 'experience']);
		expect(resolveDesign(cv).side).toEqual(['languages']);
		placeSection(cv, 'summary', 'main', 999);
		expect(columnSections(cv, 'main').at(-1)).toBe('summary');
		placeSection(cv, 'summary', 'main', -5);
		expect(columnSections(cv, 'main')[0]).toBe('summary');
		expectValid(cv);
	});

	it('reorders inside a column and ignores unknown keys', () => {
		const cv = fresh();
		placeSection(cv, 'languages', 'side', 0);
		expect(columnSections(cv, 'side')).toEqual(['languages', 'skills']);
		const before = structuredClone(cv);
		placeSection(cv, 'custom:nope', 'side', 0);
		placeSection(cv, 'skills', 'side', Number.NaN);
		expect(cv).toEqual(before);
	});

	it('an empty side column stays empty (not back to the defaults)', () => {
		const cv = fresh();
		placeSection(cv, 'skills', 'main', 0);
		placeSection(cv, 'languages', 'main', 0);
		expect(resolveDesign(cv).side).toEqual([]);
		expect(load(structuredClone(cv)).design?.side).toEqual([]);
	});
});

describe('setDesign / resetDesign', () => {
	it('applies valid values, ignores invalid ones and clamps the width', () => {
		const cv = fresh();
		setDesign(cv, {
			spacing: 'compact',
			photoShape: 'rounded',
			sideWidth: 10,
			sidePosition: 'right'
		});
		setDesign(cv, { spacing: 'huge' as never, photoSize: 'xl' as never, sideWidth: Number.NaN });
		expect(cv.design).toEqual({
			spacing: 'compact',
			photoShape: 'rounded',
			sideWidth: DESIGN_LIMITS.sideWidth.min,
			sidePosition: 'right'
		});
		expect(resolveDesign(cv).spaceScale).toBeLessThan(1);
		expect(hasCustomDesign(cv)).toBe(true);
		expectValid(cv);
		resetDesign(cv);
		expect(cv.design).toBeUndefined();
		expect(hasCustomDesign(cv)).toBe(false);
	});
});

describe('render model', () => {
	it('creative models carry the design; ATS models never do', () => {
		expect(toRenderModel(fresh()).design?.side).toEqual(['skills', 'languages']);
		const ats = structuredClone(sampleCvAts);
		ats.design = { side: ['skills'], spacing: 'airy' };
		expect(toRenderModel(ats).design).toBeUndefined();
		expect(splitColumns(toRenderModel(ats)).side).toEqual([]);
	});

	it('splitColumns follows the placement and the CV order', () => {
		const cv = fresh();
		placeSection(cv, 'awards', 'side', 1);
		const { side, main } = splitColumns(toRenderModel(cv));
		expect(side.map((s) => s.key)).toEqual(['skills', 'awards', 'languages']);
		expect(main.map((s) => s.key)).not.toContain('awards');
	});

	it('editing mode keeps blank bullets so indexes match the data; print mode drops them', () => {
		const cv = fresh();
		cv.experience[0]!.bullets.splice(1, 0, '  ');
		const entry = (editing: boolean) => {
			const section = toRenderModel(cv, { editing }).sections.find((s) => s.key === 'experience');
			return section?.type === 'entries' ? section.entries[0] : undefined;
		};
		expect(entry(true)?.bullets).toHaveLength(3);
		expect(entry(false)?.bullets).toHaveLength(2);
		expect(toRenderModel(cv, { editing: true }).editing).toBe(true);
		expect(toRenderModel(cv).editing).toBeUndefined();
	});
});

describe('inline edit keys', () => {
	const targets: EditTarget[] = [
		{ kind: 'personal', field: 'fullName' },
		{ kind: 'summary' },
		{ kind: 'sectionTitle', section: 'custom:portfolio' },
		{ kind: 'entry', section: 'experience', id: 'exp-1', field: 'subtitle' },
		{ kind: 'bullet', section: 'custom:portfolio', id: 'custom-1', index: 0 }
	];

	it('round-trips every target', () => {
		for (const target of targets) expect(parseEditKey(editKey(target))).toEqual(target);
	});

	it('rejects malformed or hostile keys', () => {
		for (const key of [
			undefined,
			null,
			'',
			'p|email',
			'e|experience|exp-1|company',
			'e|__proto__|x|title',
			'e|experience|bad id|title',
			'b|experience|exp-1|-1',
			'b|experience|exp-1|1|x',
			't|custom:BAD',
			'summary|x',
			'x'.repeat(300)
		])
			expect(parseEditKey(key)).toBeUndefined();
	});
});

describe('inline editing', () => {
	it('edits personal fields as one line, clipped to the limit', () => {
		const cv = fresh();
		const name: EditTarget = { kind: 'personal', field: 'fullName' };
		applyInline(cv, name, 'Nadia\nPutri' + 'x'.repeat(200));
		expect(cv.personal.fullName.startsWith('Nadia Putri')).toBe(true);
		expect(cv.personal.fullName).toHaveLength(LIMITS.fullName);
		expect(inlineLimit(name)).toBe(LIMITS.fullName);
	});

	it('keeps line breaks in the summary and strips control characters', () => {
		const cv = fresh();
		applyInline(cv, { kind: 'summary' }, 'Baris satu\r\nBaris dua\u0007');
		expect(cv.summary).toBe('Baris satu\nBaris dua');
	});

	it('edits entry fields through the right data field; optional fields are removed when emptied', () => {
		const cv = fresh();
		applyInline(
			cv,
			{ kind: 'entry', section: 'experience', id: 'exp-1', field: 'subtitle' },
			'Studio X'
		);
		expect(cv.experience[0]!.company).toBe('Studio X');
		applyInline(cv, { kind: 'entry', section: 'experience', id: 'exp-1', field: 'location' }, ' ');
		expect('location' in cv.experience[0]!).toBe(false);
		applyInline(
			cv,
			{ kind: 'entry', section: 'custom:portfolio', id: 'custom-1', field: 'title' },
			'Pameran Baru'
		);
		expect(cv.custom[0]!.items[0]!.title).toBe('Pameran Baru');
		expectValid(cv);
	});

	it('composed texts and unknown items are not inline-editable and are never written', () => {
		const cv = fresh();
		const before = structuredClone(cv);
		const composed: EditTarget = {
			kind: 'entry',
			section: 'education',
			id: cv.education[0]!.id,
			field: 'subtitle'
		};
		const missing: EditTarget = {
			kind: 'entry',
			section: 'experience',
			id: 'nope',
			field: 'title'
		};
		expect(canEditInline(cv, composed)).toBe(false);
		expect(canEditInline(cv, missing)).toBe(false);
		expect(canEditInline(cv, { kind: 'bullet', section: 'awards', id: 'x', index: 0 })).toBe(false);
		applyInline(cv, composed, 'S2');
		applyInline(cv, missing, 'X');
		expect(cv).toEqual(before);
	});

	it('renames section titles; an empty built-in title resets to the default', () => {
		const cv = fresh();
		const projects: EditTarget = { kind: 'sectionTitle', section: 'projects' };
		expect(readInline(cv, projects)).toBe('Proyek Desain');
		applyInline(cv, projects, '');
		expect(cv.layout.customTitles.projects).toBeUndefined();
		applyInline(cv, { kind: 'sectionTitle', section: 'custom:portfolio' }, 'Karya');
		expect(cv.custom[0]!.title).toBe('Karya');
	});

	it('edits, inserts and removes bullets within the limits', () => {
		const cv = fresh();
		const at = (index: number): EditTarget => ({
			kind: 'bullet',
			section: 'experience',
			id: 'exp-1',
			index
		});
		applyInline(cv, at(0), 'Poin baru');
		expect(cv.experience[0]!.bullets[0]).toBe('Poin baru');
		expect(insertBulletAfter(cv, 'experience', 'exp-1', 0)).toBe(1);
		expect(cv.experience[0]!.bullets).toEqual(['Poin baru', '', expect.any(String)]);
		expect(removeBullet(cv, 'experience', 'exp-1', 1)).toBe(0);
		expect(cv.experience[0]!.bullets).toHaveLength(2);
		while (cv.experience[0]!.bullets.length < LIMITS.bulletsPerItem)
			insertBulletAfter(cv, 'experience', 'exp-1', 0);
		expect(insertBulletAfter(cv, 'experience', 'exp-1', 0)).toBeUndefined();
		expect(removeBullet(cv, 'experience', 'exp-1', 99)).toBeUndefined();
		expect(insertBulletAfter(cv, 'awards', cv.awards[0]!.id, 0)).toBeUndefined();
		// Education bullets live in `highlights`.
		const edu = cv.education[0]!.id;
		expect(insertBulletAfter(cv, 'education', edu, 5)).toBe(cv.education[0]!.highlights.length - 1);
	});

	it('typing in one field is one undo step in the store', () => {
		const store = createCvStore(fresh());
		const target: EditTarget = { kind: 'personal', field: 'headline' };
		for (const value of ['D', 'De', 'Des'])
			store.update((d) => applyInline(d, target, value), { coalesceKey: 'inline:p|headline' });
		expect(store.cv.personal.headline).toBe('Des');
		store.undo();
		expect(store.cv.personal.headline).toBe(sampleCvCreative.personal.headline);
		void store.destroy();
	});
});
