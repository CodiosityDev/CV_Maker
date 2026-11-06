/**
 * "Find jobs" links: search-results pages on job sites, prefilled with the CV's target role and city.
 *
 * Nothing is fetched or scraped (PROJECT_SPEC: no LinkedIn scraping). These are plain links; only the
 * keyword and city leave the device, and only when the user clicks one. Open them with
 * `target="_blank" rel="noopener noreferrer"`.
 *
 *   import { jobSearchQueryFromCv, jobSearchLinks, relatedJobTitles } from '#lib/core/jobs/index.ts';
 *   const query = jobSearchQueryFromCv(store.cv);           // { keyword: 'Web Developer', city: 'Bandung' }
 *   const links = query ? jobSearchLinks(query) : [];         // [{ site: 'linkedin', name: 'LinkedIn', url }, …]
 *   const more = relatedJobTitles(data, query.keyword);       // ['Frontend Developer', …] (suggestion data)
 */
import type { CVDocument } from '../schema/types';
import { categoryOf } from '../suggest/index';
import { normalize } from '../suggest/match';
import type { SuggestionData } from '../suggest/types';

export type JobSiteId = 'linkedin' | 'jobstreet' | 'glints' | 'kalibrr' | 'indeed';

export interface JobSearchQuery {
	/** Job title to search for, e.g. "Web Developer". */
	keyword: string;
	/** City, e.g. "Bandung". Omitted → whole of Indonesia. */
	city?: string;
}

export interface JobSearchLink {
	site: JobSiteId;
	/** Brand name to show ("LinkedIn"). */
	name: string;
	url: string;
	/** False when the site's link cannot filter by city (results cover all of Indonesia). */
	usesCity: boolean;
}

/** Longest keyword/city sent to a job site. */
export const JOB_QUERY_MAX = 80;

const clean = (value: string | undefined): string =>
	(value ?? '').replace(/\s+/g, ' ').trim().slice(0, JOB_QUERY_MAX).trim();

/** "Web Developer" → "web-developer" (ASCII only). */
function slug(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

interface SiteDefinition {
	id: JobSiteId;
	name: string;
	usesCity: boolean;
	build(keyword: string, city: string): string | undefined;
}

function withParams(base: string, params: Record<string, string>): string {
	const url = new URL(base);
	for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
	return url.href;
}

/**
 * Order = display order. Formats checked 2026-11-06: LinkedIn (redirects to its results page for the
 * keyword and city) and Kalibrr (keyword page) verified by fetching. JobStreet, Glints and Indeed block
 * automated requests (403): their formats follow each site's own search form and must be confirmed by
 * opening a generated link in a browser after any change.
 */
const SITES: readonly SiteDefinition[] = [
	{
		id: 'linkedin',
		name: 'LinkedIn',
		usesCity: true,
		build: (keyword, city) =>
			withParams('https://www.linkedin.com/jobs/search/', {
				keywords: keyword,
				location: city ? `${city}, Indonesia` : 'Indonesia'
			})
	},
	{
		id: 'jobstreet',
		name: 'JobStreet',
		usesCity: true,
		build: (keyword, city) =>
			withParams('https://id.jobstreet.com/id/jobs', { keywords: keyword, where: city })
	},
	{
		id: 'glints',
		name: 'Glints',
		usesCity: true,
		build: (keyword, city) =>
			withParams('https://glints.com/id/opportunities/jobs/explore', {
				keyword,
				country: 'ID',
				locationName: city
			})
	},
	{
		id: 'kalibrr',
		name: 'Kalibrr',
		usesCity: false,
		build: (keyword) => {
			const path = slug(keyword);
			return path ? `https://www.kalibrr.com/id-ID/home/te/${path}` : undefined;
		}
	},
	{
		id: 'indeed',
		name: 'Indeed',
		usesCity: true,
		build: (keyword, city) => withParams('https://id.indeed.com/jobs', { q: keyword, l: city })
	}
];

/** Every site this app links to (for a list of logos/names). */
export const JOB_SITES: readonly { id: JobSiteId; name: string }[] = SITES.map(({ id, name }) => ({
	id,
	name
}));

/**
 * What to search for, from the CV: the target role (else the most recent experience role) and the city.
 * `undefined` when the CV gives nothing to search for.
 */
export function jobSearchQueryFromCv(cv: CVDocument): JobSearchQuery | undefined {
	const keyword =
		clean(cv.targetRole) || clean(cv.experience.find((item) => clean(item.role))?.role);
	if (!keyword) return undefined;
	const city = clean(cv.personal.city);
	return city ? { keyword, city } : { keyword };
}

/** Search-results links for every site (empty when the keyword is empty). */
export function jobSearchLinks(
	query: JobSearchQuery,
	sites?: readonly JobSiteId[]
): JobSearchLink[] {
	const keyword = clean(query.keyword);
	if (!keyword) return [];
	const city = clean(query.city);
	const links: JobSearchLink[] = [];
	for (const site of SITES) {
		if (sites && !sites.includes(site.id)) continue;
		const url = site.build(keyword, city);
		if (url) links.push({ site: site.id, name: site.name, url, usesCity: site.usesCity && !!city });
	}
	return links;
}

/**
 * Other job titles in the same field as `role` (from the suggestion data), best matches first:
 * "Web Developer" → "Frontend Developer", "Fullstack Developer", … Empty for unknown fields.
 */
export function relatedJobTitles(data: SuggestionData, role: string, limit = 3): string[] {
	const target = normalize(role);
	if (!target) return [];
	const category = categoryOf(data, role);
	// 'general' also means "field unknown": don't suggest unrelated titles.
	if (category === 'general') return [];
	const words = new Set(target.split(' '));
	const shared = (title: string) =>
		normalize(title)
			.split(' ')
			.filter((word) => words.has(word)).length;
	return data.jobTitles
		.filter((job) => job.category === category && normalize(job.title) !== target)
		.map((job, index) => ({ title: job.title, score: shared(job.title), index }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, limit)
		.map((job) => job.title);
}
