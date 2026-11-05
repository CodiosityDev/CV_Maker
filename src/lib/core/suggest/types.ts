/** Fields that offer autocomplete suggestions. */
export type SuggestField =
	| 'jobTitle'
	| 'major'
	| 'institution'
	| 'degree'
	| 'orgRole'
	| 'city'
	| 'province'
	| 'language'
	| 'skillHard'
	| 'skillSoft'
	| 'skillTool';

/** Broad job families used to recommend skills for a target role. */
export type JobCategory =
	| 'it'
	| 'data'
	| 'design'
	| 'marketing'
	| 'finance'
	| 'admin'
	| 'hr'
	| 'sales'
	| 'customer'
	| 'engineering'
	| 'education'
	| 'health'
	| 'hospitality'
	| 'logistics'
	| 'legal'
	| 'operations'
	| 'agriculture'
	| 'media'
	| 'public'
	| 'retail'
	| 'construction'
	| 'mining'
	| 'transport'
	| 'research'
	| 'event'
	| 'social'
	| 'general';

export interface JobTitle {
	title: string;
	category: JobCategory;
}

export interface SkillSet {
	hard: string[];
	tools: string[];
}

/** Suggestion data for one language. Plain text only; most common items first. */
export interface SuggestionData {
	jobTitles: JobTitle[];
	skillsByCategory: Record<JobCategory, SkillSet>;
	softSkills: string[];
	majors: string[];
	institutions: string[];
	degrees: string[];
	orgRoles: string[];
	cities: string[];
	provinces: string[];
	languages: string[];
	/** Lowercase keyword fragments → category, for roles typed freely (e.g. "staff akunting"). */
	categoryKeywords: [string, JobCategory][];
}
