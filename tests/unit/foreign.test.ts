import { describe, expect, it } from 'vitest';
import {
	addForeignTerm,
	createForeignMatcher,
	detectForeignTerms,
	foreignMatcherForCv,
	foreignParts,
	ignoreForeignTerm,
	restoreForeignTerm,
	setForeignEnabled
} from '../../src/lib/core/foreign/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { loadCvDocument } from '../../src/lib/core/schema/index';
import type { CVDocument } from '../../src/lib/core/schema/types';

const m = createForeignMatcher();
/** The italic pieces of a text. */
const italics = (text: string, matcher = m) =>
	foreignParts(text, matcher)
		.filter((p) => p.italic)
		.map((p) => p.text);

const clone = (cv: CVDocument): CVDocument => structuredClone(cv);

describe('foreignParts', () => {
	it('joins back to the exact same text', () => {
		const text = 'Web Developer Intern di PT Maju — membangun dashboard & REST API (2024).';
		expect(
			foreignParts(text, m)
				.map((p) => p.text)
				.join('')
		).toBe(text);
	});

	it('italicises foreign phrases as one piece', () => {
		expect(italics('Fresh Graduate Teknik Informatika')).toEqual(['Fresh Graduate']);
		expect(italics('Bekerja sebagai Web Developer Intern di PT Maju')).toEqual([
			'Web Developer Intern'
		]);
		expect(italics('Memiliki kemampuan teamwork dan problem solving')).toEqual([
			'teamwork',
			'problem solving'
		]);
	});

	it('absorbed words count only inside an English phrase', () => {
		expect(italics('Data Analyst')).toEqual(['Data Analyst']);
		expect(italics('Senior Software Engineer')).toEqual(['Senior Software Engineer']);
		expect(italics('Junior Data Analyst')).toEqual(['Junior Data Analyst']);
		expect(italics('Mengolah data penjualan dengan media sosial')).toEqual([]);
		expect(italics('Admin Media Sosial')).toEqual([]);
	});

	it('little words only between foreign words', () => {
		expect(italics('Head of Marketing')).toEqual(['Head of Marketing']);
		expect(italics('Research and Development')).toEqual(['Research and Development']);
		expect(italics('Front-end dan Back-end')).toEqual(['Front-end', 'Back-end']);
	});

	it('never italicises acronyms, technologies or brand phrases', () => {
		expect(italics('Menguasai JavaScript, Laravel, Figma, dan Microsoft Excel')).toEqual([]);
		expect(italics('Anggota Google Developer Student Clubs')).toEqual([]);
		expect(italics('Divisi HRD dan UI/UX')).toEqual([]);
	});

	it('italicises only the foreign part after an Indonesian prefix', () => {
		expect(italics('Laporan di-update setiap minggu')).toEqual(['update']);
	});

	it('names and ignore list stay upright, extra terms become italic', () => {
		const matcher = createForeignMatcher({
			names: ['Global Tech Solution'],
			ignore: ['teamwork'],
			extra: ['onboarding', 'daily standup']
		});
		expect(italics('Magang di Global Tech Solution', matcher)).toEqual([]);
		expect(italics('Teamwork', matcher)).toEqual([]);
		expect(italics('Mengatur onboarding dan daily standup', matcher)).toEqual([
			'onboarding',
			'daily standup'
		]);
	});

	it('without a matcher: one upright part', () => {
		expect(foreignParts('Web Developer', undefined)).toEqual([
			{ text: 'Web Developer', italic: false }
		]);
		expect(foreignParts('', m)).toEqual([]);
	});

	it('keeps markup-like text as text', () => {
		const text = '<img src=x onerror=alert(1)> teamwork';
		expect(
			foreignParts(text, m)
				.map((p) => p.text)
				.join('')
		).toBe(text);
	});
});

describe('CV settings', () => {
	it('only for Indonesian CVs that did not switch it off', () => {
		const cv = clone(sampleCvAts);
		cv.locale = 'id';
		expect(foreignMatcherForCv(cv)).toBeDefined();
		expect(foreignMatcherForCv({ ...cv, locale: 'en' })).toBeUndefined();
		setForeignEnabled(cv, false);
		expect(foreignMatcherForCv(cv)).toBeUndefined();
	});

	it('names written in the CV stay upright', () => {
		const cv = clone(sampleCvAts);
		cv.locale = 'id';
		const company = cv.experience[0]?.company ?? '';
		cv.experience[0]!.company = 'Creative Digital Agency';
		const matcher = foreignMatcherForCv(cv);
		expect(italics('Magang di Creative Digital Agency', matcher)).toEqual([]);
		expect(company).not.toBe('');
	});

	it('add / ignore / restore move a term between the lists', () => {
		const cv = clone(sampleCvAts);
		addForeignTerm(cv, '  Onboarding ');
		expect(cv.foreign).toEqual({ enabled: true, extra: ['onboarding'], ignore: [] });
		ignoreForeignTerm(cv, 'onboarding');
		expect(cv.foreign).toEqual({ enabled: true, extra: [], ignore: ['onboarding'] });
		restoreForeignTerm(cv, 'ONBOARDING');
		expect(cv.foreign).toEqual({ enabled: true, extra: [], ignore: [] });
	});

	it('detects the terms used in the CV', () => {
		const cv = clone(sampleCvAts);
		cv.locale = 'id';
		cv.skills.soft = ['Teamwork', 'Public Speaking'];
		addForeignTerm(cv, 'kanban board');
		const terms = detectForeignTerms(cv);
		expect(terms).toContainEqual({ term: 'teamwork', count: 1, source: 'auto' });
		expect(terms).toContainEqual({ term: 'public speaking', count: 1, source: 'auto' });
		expect(terms).toContainEqual({ term: 'kanban board', count: 0, source: 'extra' });
	});

	it('the schema keeps valid settings and drops junk', () => {
		const result = loadCvDocument({
			...clone(sampleCvAts),
			foreign: { enabled: 'yes', extra: ['  Daily  Standup ', 42, 'daily standup'], ignore: 'x' }
		});
		expect(result.ok && result.cv.foreign).toEqual({
			enabled: true,
			extra: ['daily standup'],
			ignore: []
		});
	});
});
