import { describe, expect, it } from 'vitest';
import {
	JOB_QUERY_MAX,
	JOB_SITES,
	jobSearchLinks,
	jobSearchQueryFromCv,
	relatedJobTitles,
	type JobSearchLink,
	type JobSiteId
} from '../../src/lib/core/jobs/index';
import { loadSuggestions } from '../../src/lib/core/suggest/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';

/** The link for one site (fails the test when it is missing). */
function linkFor(links: JobSearchLink[], site: JobSiteId): JobSearchLink {
	const link = links.find((item) => item.site === site);
	if (!link) throw new Error(`no ${site} link`);
	return link;
}

const ALLOWED_HOSTS = new Set([
	'www.linkedin.com',
	'id.jobstreet.com',
	'glints.com',
	'www.kalibrr.com',
	'id.indeed.com'
]);

describe('job search links', () => {
	it('builds one https link per site with the keyword and city', () => {
		const links = jobSearchLinks({ keyword: 'Web Developer', city: 'Bandung' });
		expect(links.map((link) => link.site)).toEqual(JOB_SITES.map((site) => site.id));

		expect(linkFor(links, 'linkedin').url).toBe(
			'https://www.linkedin.com/jobs/search/?keywords=Web+Developer&location=Bandung%2C+Indonesia'
		);
		expect(linkFor(links, 'jobstreet').url).toBe(
			'https://id.jobstreet.com/id/jobs?keywords=Web+Developer&where=Bandung'
		);
		expect(linkFor(links, 'glints').url).toBe(
			'https://glints.com/id/opportunities/jobs/explore?keyword=Web+Developer&country=ID&locationName=Bandung'
		);
		expect(linkFor(links, 'kalibrr').url).toBe(
			'https://www.kalibrr.com/id-ID/home/te/web-developer'
		);
		expect(linkFor(links, 'indeed').url).toBe(
			'https://id.indeed.com/jobs?q=Web+Developer&l=Bandung'
		);

		expect(linkFor(links, 'kalibrr').usesCity).toBe(false);
		expect(linkFor(links, 'linkedin').usesCity).toBe(true);
	});

	it('searches all of Indonesia without a city', () => {
		const links = jobSearchLinks({ keyword: 'Perawat' });
		const linkedin = linkFor(links, 'linkedin');
		expect(new URL(linkedin.url).searchParams.get('location')).toBe('Indonesia');
		const jobstreet = linkFor(links, 'jobstreet');
		expect(new URL(jobstreet.url).searchParams.has('where')).toBe(false);
		expect(links.every((link) => !link.usesCity)).toBe(true);
	});

	it('cannot be turned into another host, scheme or path by user text', () => {
		const hostile = [
			'javascript:alert(1)',
			'https://evil.example/x',
			'../../admin?x=1#frag',
			'a&b=c d/e\\f',
			'<script>alert(1)</script>',
			'%2F%2Fevil.example'
		];
		for (const keyword of hostile) {
			for (const link of jobSearchLinks({ keyword, city: keyword })) {
				const url = new URL(link.url);
				expect(url.protocol).toBe('https:');
				expect(ALLOWED_HOSTS.has(url.host)).toBe(true);
				expect(url.hash).toBe('');
				if (link.site === 'kalibrr')
					expect(url.pathname).toMatch(/^\/id-ID\/home\/te\/[a-z0-9-]+$/);
			}
		}
	});

	it('limits length, trims whitespace and skips empty keywords', () => {
		expect(jobSearchLinks({ keyword: '   ' })).toEqual([]);
		const long = 'x'.repeat(500);
		const linkedin = linkFor(jobSearchLinks({ keyword: long }, ['linkedin']), 'linkedin');
		expect(new URL(linkedin.url).searchParams.get('keywords')).toHaveLength(JOB_QUERY_MAX);
		const trimmed = linkFor(jobSearchLinks({ keyword: '  Data   Analyst ' }, ['indeed']), 'indeed');
		expect(new URL(trimmed.url).searchParams.get('q')).toBe('Data Analyst');
	});

	it('drops Kalibrr when the keyword has no letters or digits for its address', () => {
		const sites = jobSearchLinks({ keyword: '!!!' }).map((link) => link.site);
		expect(sites).not.toContain('kalibrr');
		expect(sites).toContain('linkedin');
	});

	it('can be limited to some sites, keeping display order', () => {
		const links = jobSearchLinks({ keyword: 'Guru' }, ['indeed', 'linkedin']);
		expect(links.map((link) => link.site)).toEqual(['linkedin', 'indeed']);
	});
});

describe('jobSearchQueryFromCv', () => {
	it('uses the target role and city', () => {
		const cv = structuredClone(sampleCvAts);
		cv.targetRole = ' Web Developer ';
		cv.personal.city = 'Bandung';
		expect(jobSearchQueryFromCv(cv)).toEqual({ keyword: 'Web Developer', city: 'Bandung' });
	});

	it('falls back to the first experience role, and to no city', () => {
		const cv = structuredClone(sampleCvAts);
		cv.targetRole = '';
		cv.personal.city = '';
		const firstRole = cv.experience.find((item) => item.role.trim())?.role.trim();
		expect(firstRole).toBeTruthy();
		expect(jobSearchQueryFromCv(cv)).toEqual({ keyword: firstRole });
	});

	it('returns undefined when there is nothing to search for', () => {
		const cv = structuredClone(sampleCvAts);
		cv.targetRole = '';
		cv.experience = [];
		expect(jobSearchQueryFromCv(cv)).toBeUndefined();
	});
});

describe('relatedJobTitles', () => {
	it('suggests other titles from the same field, closest first', async () => {
		const data = await loadSuggestions('id');
		const related = relatedJobTitles(data, 'Web Developer');
		expect(related.length).toBeGreaterThan(0);
		expect(related.length).toBeLessThanOrEqual(3);
		expect(related).not.toContain('Web Developer');
		expect(related[0]).toMatch(/developer/i);
	});

	it('works for fields outside IT and for freely typed roles', async () => {
		const data = await loadSuggestions('id');
		expect(relatedJobTitles(data, 'Perawat').length).toBeGreaterThan(0);
		expect(relatedJobTitles(data, 'staff akunting').length).toBeGreaterThan(0);
	});

	it('suggests nothing for an unknown field or empty role', async () => {
		const data = await loadSuggestions('id');
		expect(relatedJobTitles(data, 'Penjinak Naga')).toEqual([]);
		expect(relatedJobTitles(data, '')).toEqual([]);
	});
});
