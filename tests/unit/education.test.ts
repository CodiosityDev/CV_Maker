import { describe, expect, it } from 'vitest';
import {
	defaultScoreScale,
	degreeOptions,
	displayDegree,
	educationLevel,
	isSchoolLevel,
	scoreLabel
} from '../../src/lib/core/education/index';
import { toRenderModel } from '../../src/lib/core/render/index';
import { loadSuggestions } from '../../src/lib/core/suggest/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import type { CVDocument, EducationItem } from '../../src/lib/core/schema/types';

describe('education levels', () => {
	it.each([
		['SMA', 'school'],
		['smk', 'school'],
		['SMP', 'school'],
		['MA', 'school'],
		['MTs', 'school'],
		['SMA Negeri 3', 'school'],
		['Senior High School', 'school'],
		['High School', 'school'],
		['Vocational High School (SMK)', 'school'],
		['Paket C', 'school'],
		['D3', 'diploma'],
		['Diploma (D3)', 'diploma'],
		['Diploma III', 'diploma'],
		['Ahli Madya', 'diploma'],
		['S1', 'bachelor'],
		['Sarjana Teknik', 'bachelor'],
		["Bachelor's Degree", 'bachelor'],
		['Bachelor of Science', 'bachelor'],
		['S2', 'master'],
		['M.A.', 'master'],
		['MBA', 'master'],
		['S3', 'doctor'],
		['Ph.D.', 'doctor'],
		['', 'other'],
		['Kursus Online', 'other']
	] as const)('%s → %s', (degree, level) => {
		expect(educationLevel(degree)).toBe(level);
	});

	it('only school levels drop IPK', () => {
		expect(isSchoolLevel('SMA')).toBe(true);
		expect(isSchoolLevel('S1')).toBe(false);
		expect(isSchoolLevel(undefined)).toBe(false);
		expect(scoreLabel('SMA', 'id')).toBe('Nilai rata-rata');
		expect(scoreLabel('Senior High School', 'en')).toBe('Average grade');
		expect(scoreLabel('S1', 'id')).toBe('IPK');
		expect(scoreLabel('D3', 'en')).toBe('GPA');
		expect(scoreLabel('', 'id')).toBe('IPK');
		expect(defaultScoreScale('SMK')).toBe('100');
		expect(defaultScoreScale('S1')).toBe('4.00');
	});

	it('suggests degrees in the CV language, including SMP', async () => {
		expect(degreeOptions('id')).toEqual(
			expect.arrayContaining(['S1', 'D3', 'SMA', 'SMK', 'SMP', 'MA', 'MTs'])
		);
		const en = degreeOptions('en');
		expect(en).toContain("Bachelor's Degree");
		expect(en).toContain('Senior High School');
		expect(en).toContain('Junior High School');
		// Full English: no bare Indonesian codes in the English list.
		for (const code of ['S1', 'S2', 'S3', 'SMA', 'SMP']) expect(en).not.toContain(code);
		expect((await loadSuggestions('en')).degrees).toEqual(en);
		expect((await loadSuggestions('id')).degrees).toEqual(degreeOptions('id'));
	});

	it('writes known degrees in the CV language and keeps anything else as typed', () => {
		expect(displayDegree('S1', 'en')).toBe("Bachelor's Degree");
		expect(displayDegree('sma', 'en')).toBe('Senior High School');
		expect(displayDegree("Bachelor's Degree", 'id')).toBe('S1');
		expect(displayDegree('Junior High School', 'id')).toBe('SMP');
		expect(displayDegree('S1', 'id')).toBe('S1');
		expect(displayDegree('Sarjana Teknik', 'en')).toBe('Sarjana Teknik');
	});
});

function cvWith(locale: CVDocument['locale'], education: Partial<EducationItem>): CVDocument {
	const base = structuredClone(sampleCvAts);
	const first = base.education[0];
	if (!first) throw new Error('fixture needs education');
	return { ...base, locale, education: [{ ...first, ...education }] };
}

function educationEntry(cv: CVDocument) {
	const section = toRenderModel(cv).sections.find((s) => s.key === 'education');
	const entry = section && 'entries' in section ? section.entries[0] : undefined;
	if (!entry) throw new Error('no education entry');
	return entry;
}

describe('education in the render model', () => {
	it('uses a report-card average instead of IPK for SMA, and a final project label', () => {
		const entry = educationEntry(
			cvWith('id', {
				degree: 'SMA',
				major: 'IPA',
				gpa: '85',
				gpaScale: '100',
				thesisTitle: 'Kualitas air sungai'
			})
		);
		expect(entry.subtitle).toBe('SMA IPA');
		expect(entry.meta).toContain('Nilai rata-rata 85/100');
		expect(entry.meta).toContain('Karya tulis: Kualitas air sungai');
		expect(entry.meta.join(' ')).not.toContain('IPK');
	});

	it('writes the whole education line in English on an English CV', () => {
		const entry = educationEntry(
			cvWith('en', { degree: 'S1', major: 'Computer Science', gpa: '3.85', gpaScale: '4.00' })
		);
		expect(entry.subtitle).toBe("Bachelor's Degree, Computer Science");
		expect(entry.meta).toContain('GPA 3.85/4.00');

		const school = educationEntry(
			cvWith('en', { degree: 'SMA', major: '', gpa: '88', gpaScale: '' })
		);
		expect(school.subtitle).toBe('Senior High School');
		expect(school.meta).toContain('Average grade 88');
	});

	it('keeps IPK for higher education on an Indonesian CV', () => {
		const entry = educationEntry(
			cvWith('id', { degree: 'S1', major: 'Sistem Informasi', gpa: '3.65', gpaScale: '4.00' })
		);
		expect(entry.subtitle).toBe('S1 Sistem Informasi');
		expect(entry.meta).toContain('IPK 3.65/4.00');
	});
});
