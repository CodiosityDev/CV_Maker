/**
 * CV data model (schema version 1). PROJECT_SPEC §5.
 *
 * All content is PLAIN TEXT: never HTML or Markdown. Bullets are arrays of strings.
 * Owned by core: UI code must not change these types. Request changes via HANDOFF.md.
 */
import type { Locale } from '../../i18n/types';

export type { Locale };

export type CVKind = 'ats' | 'creative';

/** 'YYYY-MM', e.g. '2024-07'. */
export type YearMonth = string;

export const BUILTIN_SECTION_KEYS = [
	'summary',
	'education',
	'experience',
	'organizations',
	'projects',
	'skills',
	'languages',
	'certifications',
	'awards'
] as const;

export type BuiltinSectionKey = (typeof BUILTIN_SECTION_KEYS)[number];
export type CustomSectionKey = `custom:${string}`;
export type SectionKey = BuiltinSectionKey | CustomSectionKey;

export interface DateRange {
	start?: YearMonth;
	end?: YearMonth;
	/** true → rendered as "Sekarang" / "Present"; `end` is ignored. */
	current: boolean;
}

export interface LinkItem {
	id: string;
	label: string;
	url: string;
}

export interface PersonalInfo {
	fullName: string;
	/** e.g. "Fresh Graduate Teknik Informatika" */
	headline: string;
	email: string;
	phone: string;
	city: string;
	province?: string;
	links: LinkItem[];
	/** Only used by creative templates. Refers to assetRepo. */
	photoAssetId?: string;
}

export interface EducationItem {
	id: string;
	institution: string;
	/** S1, D3, SMK, ... */
	degree: string;
	major: string;
	gpa?: string;
	gpaScale?: string;
	dates: DateRange;
	thesisTitle?: string;
	/** Relevant courses, scholarships, etc. */
	highlights: string[];
}

export const EXPERIENCE_TYPES = [
	'internship',
	'fulltime',
	'parttime',
	'freelance',
	'contract',
	'volunteer'
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export interface ExperienceItem {
	id: string;
	type: ExperienceType;
	role: string;
	company: string;
	location?: string;
	dates: DateRange;
	bullets: string[];
}

export interface OrganizationItem {
	id: string;
	/** "BEM Fakultas Teknik", "Panitia Dies Natalis" */
	name: string;
	role: string;
	dates: DateRange;
	bullets: string[];
}

export interface ProjectItem {
	id: string;
	name: string;
	role?: string;
	url?: string;
	dates?: DateRange;
	bullets: string[];
}

export interface SkillGroups {
	hard: string[];
	soft: string[];
	tools: string[];
}

export const LANGUAGE_LEVELS = [
	'native',
	'fluent',
	'professional',
	'intermediate',
	'basic'
] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export interface LanguageItem {
	id: string;
	name: string;
	level: LanguageLevel;
	/** "TOEFL ITP 550" */
	score?: string;
}

export interface CertificationItem {
	id: string;
	name: string;
	issuer: string;
	date?: YearMonth;
	credentialUrl?: string;
}

export interface AwardItem {
	id: string;
	title: string;
	issuer: string;
	date?: YearMonth;
	description?: string;
}

export interface CustomSectionItem {
	id: string;
	title: string;
	subtitle?: string;
	dates?: DateRange;
	bullets: string[];
}

export interface CustomSection {
	key: CustomSectionKey;
	title: string;
	items: CustomSectionItem[];
}

export interface CVTheme {
	accentColor?: string;
	/** 'default' = the template's own font. */
	fontId: string;
	/** 0.9 – 1.1 */
	fontScale: number;
}

export interface CVStatus {
	wizardCompleted: boolean;
	/** 0-based index of the wizard step to resume. */
	wizardStep: number;
}

export interface CVLayout {
	order: SectionKey[];
	hidden: SectionKey[];
	customTitles: Partial<Record<SectionKey, string>>;
}

export interface CVDocument {
	schemaVersion: 1;
	id: string;
	/** Name shown in the "CV Saya" dashboard. */
	title: string;
	kind: CVKind;
	/** Language of the CV CONTENT (section titles, dates). Independent of UI language. */
	locale: Locale;
	targetRole?: string;
	templateId: string;
	theme: CVTheme;
	status: CVStatus;
	layout: CVLayout;
	personal: PersonalInfo;
	summary: string;
	education: EducationItem[];
	experience: ExperienceItem[];
	organizations: OrganizationItem[];
	projects: ProjectItem[];
	skills: SkillGroups;
	languages: LanguageItem[];
	certifications: CertificationItem[];
	awards: AwardItem[];
	custom: CustomSection[];
	/** ISO 8601 */
	createdAt: string;
	/** ISO 8601 */
	updatedAt: string;
}

/** Lightweight summary for the dashboard list. */
export interface CVMeta {
	id: string;
	title: string;
	kind: CVKind;
	locale: Locale;
	templateId: string;
	targetRole?: string;
	fullName: string;
	wizardCompleted: boolean;
	createdAt: string;
	updatedAt: string;
}
