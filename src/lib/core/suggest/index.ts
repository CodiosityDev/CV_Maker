/**
 * Autocomplete & recommendations (no AI, no network): curated lists that help fresh graduates
 * fill fields quickly. Users can always type their own value — suggestions never restrict input.
 *
 *   import { loadSuggestions, suggest, recommendSkills } from '#lib/core/suggest/index.ts';
 *   const data = await loadSuggestions(cv.locale);                   // lazy, cached per language
 *   suggest(data, 'jobTitle', 'data');                                // ['Junior Data Analyst', 'Data Entry', ...]
 *   recommendSkills(data, cv.targetRole, cv.skills);                  // { category, hard, tools, soft }
 *
 * Use the CV language (`cv.locale`) — suggestions end up in the CV.
 */
import type { Locale, SkillGroups } from '../schema/types';
import { normalize, rank, type RankOptions } from './match';
import type { JobCategory, SuggestField, SuggestionData } from './types';

export type { JobCategory, JobTitle, SuggestField, SuggestionData } from './types';
export { normalize, rank, type RankOptions } from './match';

const cache = new Map<Locale, Promise<SuggestionData>>();

const loaders: Record<Locale, () => Promise<SuggestionData>> = {
	id: () => import('./data/id').then((m) => m.suggestionsId),
	en: () => import('./data/en').then((m) => m.suggestionsEn)
};

/** Loaded once per language, as a separate small chunk. */
export function loadSuggestions(locale: Locale): Promise<SuggestionData> {
	let promise = cache.get(locale);
	if (!promise) {
		promise = loaders[locale]();
		promise.catch(() => cache.delete(locale)); // allow retry after a network error
		cache.set(locale, promise);
	}
	return promise;
}

function listFor(data: SuggestionData, field: SuggestField): string[] {
	switch (field) {
		case 'jobTitle':
			return data.jobTitles.map((job) => job.title);
		case 'major':
			return data.majors;
		case 'institution':
			return data.institutions;
		case 'degree':
			return data.degrees;
		case 'orgRole':
			return data.orgRoles;
		case 'city':
			return data.cities;
		case 'province':
			return data.provinces;
		case 'language':
			return data.languages;
		case 'skillSoft':
			return data.softSkills;
		case 'skillHard':
			return unique(Object.values(data.skillsByCategory).flatMap((set) => set.hard));
		case 'skillTool':
			return unique(Object.values(data.skillsByCategory).flatMap((set) => set.tools));
	}
}

function unique(items: string[]): string[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = normalize(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Ranked suggestions for what the user has typed so far. */
export function suggest(
	data: SuggestionData,
	field: SuggestField,
	query: string,
	options?: RankOptions
): string[] {
	return rank(listFor(data, field), query, options);
}

/**
 * Job family of a role: exact known title first, otherwise the LONGEST matching keyword
 * (so "social media specialist" → marketing, not social). Unknown → 'general'.
 */
export function categoryOf(data: SuggestionData, role: string | undefined): JobCategory {
	const value = normalize(role ?? '');
	if (!value) return 'general';
	const exact = data.jobTitles.find((job) => normalize(job.title) === value);
	if (exact) return exact.category;
	const padded = ` ${value} `;
	let best: { length: number; category: JobCategory } | undefined;
	for (const [keyword, category] of data.categoryKeywords) {
		// Keywords written with surrounding spaces (' it ') must match a whole word.
		const core = normalize(keyword);
		if (!core) continue;
		const needle = keyword.startsWith(' ') ? ` ${core} ` : core;
		if (padded.includes(needle) && (!best || needle.length > best.length)) {
			best = { length: needle.length, category };
		}
	}
	return best?.category ?? 'general';
}

export interface SkillRecommendation {
	category: JobCategory;
	hard: string[];
	tools: string[];
	soft: string[];
}

/**
 * Skills that fit the target role, minus the ones already in the CV.
 * Show as one-tap chips; never add them automatically.
 */
export function recommendSkills(
	data: SuggestionData,
	targetRole: string | undefined,
	current: Partial<SkillGroups> = {},
	limit = 8
): SkillRecommendation {
	const category = categoryOf(data, targetRole);
	const set = data.skillsByCategory[category];
	const has = new Set(
		[...(current.hard ?? []), ...(current.tools ?? []), ...(current.soft ?? [])].map(normalize)
	);
	const pick = (items: string[]) =>
		items.filter((item) => !has.has(normalize(item))).slice(0, limit);
	return {
		category,
		hard: pick(set.hard),
		tools: pick(set.tools),
		soft: pick(data.softSkills)
	};
}
