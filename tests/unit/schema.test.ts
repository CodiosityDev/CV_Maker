import { describe, expect, it } from 'vitest';
import {
	createEmptyCv,
	LIMITS,
	loadCvDocument,
	type CVDocument
} from '../../src/lib/core/schema/index';
import { emptyCvAts, sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

function load(raw: unknown): CVDocument {
	const result = loadCvDocument(raw);
	if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
	return result.cv;
}

const clone = <T>(value: T): T => structuredClone(value);

describe('fixtures & defaults', () => {
	it('fixtures are already valid and survive a load round-trip unchanged', () => {
		for (const fixture of [sampleCvAts, sampleCvCreative, emptyCvAts]) {
			expect(load(clone(fixture))).toEqual(fixture);
		}
	});

	it('createEmptyCv produces a valid document per kind', () => {
		const ats = createEmptyCv({ kind: 'ats', locale: 'en' });
		expect(load(ats)).toEqual(ats);
		expect(ats.templateId).toBe('ats-klasik');
		expect(ats.title).toBe('ATS CV');
		expect(createEmptyCv({ kind: 'creative', locale: 'id' }).templateId).toBe('creative-sidebar');
	});
});

describe('loadCvDocument — structure', () => {
	it('rejects non-objects and missing/invalid versions', () => {
		expect(loadCvDocument(null)).toEqual({ ok: false, error: 'not-an-object' });
		expect(loadCvDocument([])).toEqual({ ok: false, error: 'not-an-object' });
		expect(loadCvDocument({})).toEqual({ ok: false, error: 'unknown-version' });
		expect(loadCvDocument({ ...clone(sampleCvAts), schemaVersion: '1' })).toEqual({
			ok: false,
			error: 'unknown-version'
		});
	});

	it('rejects documents from a newer app version instead of corrupting them', () => {
		expect(loadCvDocument({ ...clone(sampleCvAts), schemaVersion: 99 })).toEqual({
			ok: false,
			error: 'newer-version'
		});
	});

	it('rejects a document without a valid id', () => {
		expect(loadCvDocument({ ...clone(sampleCvAts), id: '../../etc' }).ok).toBe(false);
		const { id: _id, ...noId } = clone(sampleCvAts);
		expect(loadCvDocument(noId).ok).toBe(false);
	});
});

describe('loadCvDocument — security', () => {
	it('drops unknown keys, including prototype-pollution keys from JSON', () => {
		const raw = JSON.parse(
			JSON.stringify(sampleCvAts).replace(
				'"summary":',
				'"__proto__":{"polluted":true},"constructor":{"x":1},"evil":"<script>","summary":'
			)
		);
		const cv = load(raw) as unknown as Record<string, unknown>;
		expect(Object.hasOwn(cv, '__proto__')).toBe(false);
		expect(Object.hasOwn(cv, 'evil')).toBe(false);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('only accepts a strict hex accent color (it reaches CSS)', () => {
		const raw = clone(sampleCvCreative);
		raw.theme.accentColor = 'red; background:url(https://evil.example)';
		expect(load(raw).theme.accentColor).toBeUndefined();
	});

	it('only accepts slug-like template and font ids', () => {
		const raw = clone(sampleCvAts) as unknown as Record<string, unknown>;
		raw.templateId = '../../evil';
		(raw.theme as Record<string, unknown>).fontId = 'x" onload="';
		const cv = load(raw);
		expect(cv.templateId).toBe('ats-klasik');
		expect(cv.theme.fontId).toBe('default');
	});

	it('removes control characters but keeps newlines', () => {
		const raw = clone(sampleCvAts);
		raw.summary = 'Baris satu\u0000\u0007\nBaris dua';
		expect(load(raw).summary).toBe('Baris satu\nBaris dua');
	});
});

describe('loadCvDocument — lenient content', () => {
	it('truncates over-long text instead of rejecting the CV', () => {
		const raw = clone(sampleCvAts);
		raw.personal.fullName = 'A'.repeat(500);
		raw.experience[0]!.bullets = ['x'.repeat(1000), ...Array(20).fill('ok')];
		const cv = load(raw);
		expect(cv.personal.fullName).toHaveLength(LIMITS.fullName);
		expect(cv.experience[0]!.bullets[0]).toHaveLength(LIMITS.bullet);
		expect(cv.experience[0]!.bullets).toHaveLength(LIMITS.bulletsPerItem);
	});

	it('skips broken items without losing the rest of the section', () => {
		const raw = clone(sampleCvAts) as unknown as { organizations: unknown[] };
		raw.organizations.push('not an item', 42, null);
		expect(load(raw).organizations).toHaveLength(sampleCvAts.organizations.length);
	});

	it('falls back for wrong-typed fields', () => {
		const raw = clone(sampleCvAts) as unknown as Record<string, unknown>;
		raw.summary = 123;
		raw.kind = 'poster';
		raw.skills = 'SQL';
		raw.status = { wizardCompleted: 'yes', wizardStep: -5 };
		const cv = load(raw);
		expect(cv.summary).toBe('');
		expect(cv.kind).toBe('ats');
		expect(cv.skills).toEqual({ hard: [], soft: [], tools: [] });
		expect(cv.status).toEqual({ wizardCompleted: false, wizardStep: 0 });
	});

	it('drops invalid dates and gives items without ids a new id', () => {
		const raw = clone(sampleCvAts) as unknown as {
			education: { id?: string; dates: Record<string, unknown> }[];
		};
		raw.education[0]!.dates = { start: '2024-13', end: 'kemarin', current: false };
		delete raw.education[0]!.id;
		const cv = load(raw);
		expect(cv.education[0]!.dates).toEqual({ current: false });
		expect(cv.education[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('clamps the font scale', () => {
		const raw = clone(sampleCvAts);
		raw.theme.fontScale = 5;
		expect(load(raw).theme.fontScale).toBe(1.1);
	});
});

describe('layout normalization', () => {
	it('dedupes, removes unknown keys and appends missing sections', () => {
		const raw = clone(sampleCvAts) as unknown as { layout: Record<string, unknown> };
		raw.layout = {
			order: ['skills', 'skills', 'nonsense', 'custom:ghost', 'summary'],
			hidden: ['education', 'nonsense'],
			customTitles: { skills: '  Kemampuan  ', nonsense: 'x', constructor: 'y' }
		};
		const cv = load(raw);
		expect(cv.layout.order.slice(0, 2)).toEqual(['skills', 'summary']);
		expect(cv.layout.order).toHaveLength(9);
		expect(new Set(cv.layout.order).size).toBe(9);
		expect(cv.layout.order).not.toContain('custom:ghost');
		expect(cv.layout.hidden).toEqual(['education']);
		expect(cv.layout.customTitles).toEqual({ skills: 'Kemampuan' });
	});

	it('adds existing custom sections to the order', () => {
		const raw = clone(sampleCvCreative);
		raw.layout.order = raw.layout.order.filter((key) => key !== 'custom:portfolio');
		expect(load(raw).layout.order).toContain('custom:portfolio');
	});
});
