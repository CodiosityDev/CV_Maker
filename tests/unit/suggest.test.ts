import { describe, expect, it } from 'vitest';
import {
	categoryOf,
	loadSuggestions,
	normalize,
	rank,
	recommendSkills,
	suggest,
	type JobCategory,
	type SuggestionData
} from '../../src/lib/core/suggest/index';

const ALL_CATEGORIES: JobCategory[] = [
	'it',
	'data',
	'design',
	'marketing',
	'finance',
	'admin',
	'hr',
	'sales',
	'customer',
	'engineering',
	'education',
	'health',
	'hospitality',
	'logistics',
	'legal',
	'operations',
	'agriculture',
	'media',
	'public',
	'retail',
	'construction',
	'mining',
	'transport',
	'research',
	'event',
	'social',
	'general'
];

describe('matching', () => {
	it('normalizes case, accents and punctuation', () => {
		expect(normalize('  Universitas  Gadjah-Mada ')).toBe('universitas gadjah mada');
		expect(normalize('Café')).toBe('cafe');
	});

	it('ranks exact → prefix → word start → contains, shorter first', () => {
		const items = [
			'Data Scientist',
			'Junior Data Analyst',
			'Data',
			'Big Data Engineer',
			'Metadata'
		];
		expect(rank(items, 'data')).toEqual([
			'Data',
			'Data Scientist',
			'Big Data Engineer',
			'Junior Data Analyst',
			'Metadata'
		]);
	});

	it('matches words in any order', () => {
		expect(rank(['Junior Data Analyst'], 'analyst junior')).toEqual(['Junior Data Analyst']);
	});

	it('excludes values already chosen and respects the limit', () => {
		expect(rank(['SQL', 'Python', 'Spark'], 's', { exclude: ['sql'] })).toEqual(['Spark']);
		expect(rank(['a1', 'a2', 'a3'], 'a', { limit: 2 })).toHaveLength(2);
	});

	it('returns nothing for an empty query unless popular items are requested', () => {
		expect(rank(['A', 'B'], '')).toEqual([]);
		expect(rank(['A', 'B'], '', { popularWhenEmpty: true })).toEqual(['A', 'B']);
	});
});

describe.each(['id', 'en'] as const)('suggestion data (%s)', (locale) => {
	let data: SuggestionData;

	it('loads and is cached', async () => {
		data = await loadSuggestions(locale);
		expect(await loadSuggestions(locale)).toBe(data);
	});

	it('covers every job category with titles and skills (not only IT)', async () => {
		data = await loadSuggestions(locale);
		for (const category of ALL_CATEGORIES) {
			const set = data.skillsByCategory[category];
			expect(set.hard.length, `${category} hard skills`).toBeGreaterThanOrEqual(4);
			expect(set.tools.length, `${category} tools`).toBeGreaterThanOrEqual(2);
			if (category !== 'general') {
				expect(
					data.jobTitles.filter((job) => job.category === category).length,
					`${category} titles`
				).toBeGreaterThanOrEqual(1);
			}
		}
		const itShare =
			data.jobTitles.filter((j) => j.category === 'it').length / data.jobTitles.length;
		expect(itShare).toBeLessThan(0.2);
	});

	it('has no duplicate entries and no HTML', async () => {
		data = await loadSuggestions(locale);
		const lists = [
			data.jobTitles.map((j) => j.title),
			data.majors,
			data.institutions,
			data.orgRoles,
			data.cities,
			data.provinces,
			data.languages,
			data.softSkills
		];
		for (const list of lists) {
			expect(new Set(list.map(normalize)).size).toBe(list.length);
			for (const item of list) expect(item).not.toMatch(/[<>]/);
		}
		expect(data.provinces).toHaveLength(38);
	});

	it('every known job title maps back to its own category', async () => {
		data = await loadSuggestions(locale);
		for (const job of data.jobTitles)
			expect(categoryOf(data, job.title), job.title).toBe(job.category);
	});
});

describe('suggestions in use (Indonesian)', () => {
	it('suggests job titles from a few letters', async () => {
		const data = await loadSuggestions('id');
		expect(suggest(data, 'jobTitle', 'admin').slice(0, 3)).toEqual([
			'Admin Gudang',
			'Admin Online Shop',
			'Admin Operasional'
		]);
		expect(suggest(data, 'jobTitle', 'admin')).toContain('Staf Administrasi');
		expect(suggest(data, 'jobTitle', 'perawat')).toEqual(['Perawat']);
	});

	it('suggests majors, campuses, cities and organisation roles', async () => {
		const data = await loadSuggestions('id');
		expect(suggest(data, 'major', 'akun')).toEqual(['Akuntansi']);
		expect(suggest(data, 'institution', 'gadjah')).toEqual(['Universitas Gadjah Mada']);
		expect(suggest(data, 'city', 'jakarta').length).toBe(5);
		expect(suggest(data, 'orgRole', 'bend')).toEqual(['Bendahara']);
	});

	it('guesses the job family from free text, preferring the most specific keyword', async () => {
		const data = await loadSuggestions('id');
		expect(categoryOf(data, 'staff akunting pajak')).toBe('finance');
		expect(categoryOf(data, 'Social Media Specialist')).toBe('marketing');
		expect(categoryOf(data, 'Penyuluh Pertanian Lapangan')).toBe('agriculture');
		expect(categoryOf(data, 'it support helpdesk')).toBe('it');
		expect(categoryOf(data, 'kitchen helper')).toBe('general'); // "it" inside "kitchen" must not match
		expect(categoryOf(data, '')).toBe('general');
	});

	it('recommends skills for the target role, without ones already in the CV', async () => {
		const data = await loadSuggestions('id');
		const rec = recommendSkills(data, 'Perawat', { soft: ['Komunikasi'] });
		expect(rec.category).toBe('health');
		expect(rec.hard).toContain('Asuhan Keperawatan');
		expect(rec.soft).not.toContain('Komunikasi');
		const finance = recommendSkills(data, 'Staf Akuntansi', { hard: ['Jurnal Umum'] });
		expect(finance.hard).not.toContain('Jurnal Umum');
		expect(finance.tools).toContain('Accurate');
	});
});
