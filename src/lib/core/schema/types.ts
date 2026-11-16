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

export const DESIGN_SPACINGS = ['compact', 'normal', 'airy'] as const;
export type DesignSpacing = (typeof DESIGN_SPACINGS)[number];
export const PHOTO_SHAPES = ['circle', 'rounded', 'square'] as const;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export const PHOTO_SIZES = ['sm', 'md', 'lg'] as const;
export type PhotoSize = (typeof PHOTO_SIZES)[number];
export const SIDE_POSITIONS = ['left', 'right'] as const;
export type SidePosition = (typeof SIDE_POSITIONS)[number];

/**
 * Visual layout of a CREATIVE CV, set in the visual (Canva-like) editor. ATS CVs ignore it.
 * Every field is optional: missing = the template's default. Read it through `resolveDesign()`.
 */
export interface CVDesign {
	/** Sections shown in the side column (two-column templates). The rest go in the main column. */
	side?: SectionKey[];
	sidePosition?: SidePosition;
	/** Side column width in % of the page: `DESIGN_LIMITS.sideWidth`. */
	sideWidth?: number;
	spacing?: DesignSpacing;
	photoShape?: PhotoShape;
	photoSize?: PhotoSize;
}

/**
 * Italics for foreign terms in an Indonesian CV (PUEBI). Absent = on, no custom terms.
 * Read it through `foreignMatcherForCv()` (core/foreign); English CVs ignore it.
 */
export interface CVForeign {
	enabled: boolean;
	/** Extra terms the user wants in italics (lowercase, may be several words). */
	extra: string[];
	/** Detected terms the user wants upright (lowercase, may be several words). */
	ignore: string[];
}

// ---------------------------------------------------------------------------
// Cover letter (surat lamaran) — optional, several per CV. Built into text by core/letter.
// ---------------------------------------------------------------------------

export const LETTER_SOURCES = [
	'jobPortal',
	'companySite',
	'socialMedia',
	'campus',
	'referral',
	'jobFair',
	'other'
] as const;
export type LetterSource = (typeof LETTER_SOURCES)[number];

export const LETTER_ATTACHMENTS = [
	'cv',
	'diploma',
	'transcript',
	'idCard',
	'photo',
	'certificates',
	'portfolio',
	'skck',
	'health',
	'reference'
] as const;
export type LetterAttachment = (typeof LETTER_ATTACHMENTS)[number];

/** Paragraphs the letter writes from the CV, which the user (or the AI) may rewrite. */
export const LETTER_TEXT_KEYS = ['opening', 'qualifications', 'motivation', 'closing'] as const;
export type LetterTextKey = (typeof LETTER_TEXT_KEYS)[number];

export const LETTER_HIGHLIGHT_SECTIONS = [
	'experience',
	'organizations',
	'projects',
	'certifications',
	'awards',
	'skills'
] as const;
export type LetterHighlightSection = (typeof LETTER_HIGHLIGHT_SECTIONS)[number];

/** A CV item to mention in the letter. Skills: `id` = 'hard' | 'tools' | 'soft'. */
export interface LetterHighlightRef {
	section: LetterHighlightSection;
	id: string;
}

/**
 * A piece of formatted text. `italic`: undefined = automatic (foreign terms in Indonesian letters),
 * true/false = set by the user. Never HTML: templates render runs as elements.
 */
export interface RichRun {
	text: string;
	bold?: true;
	italic?: boolean;
	underline?: true;
}

export const LETTER_FONTS = ['times', 'arial', 'calibri', 'georgia'] as const;
export type LetterFont = (typeof LETTER_FONTS)[number];
export const LETTER_SIZES = [11, 12] as const;
export type LetterSize = (typeof LETTER_SIZES)[number];
export const LETTER_LINE_HEIGHTS = [1, 1.15, 1.5] as const;
export type LetterLineHeight = (typeof LETTER_LINE_HEIGHTS)[number];
export const LETTER_ALIGNS = ['left', 'justify'] as const;
export type LetterAlign = (typeof LETTER_ALIGNS)[number];

/** Formal choices only: no colours, no free sizes. */
export interface LetterStyle {
	font: LetterFont;
	size: LetterSize;
	lineHeight: LetterLineHeight;
	align: LetterAlign;
}

export interface CoverLetter {
	id: string;
	/** Language of the LETTER (default: the CV's). */
	locale: Locale;
	/** Required. */
	position: string;
	/** Required. */
	company: string;
	/** '' → "Bapak/Ibu Pimpinan HRD" / "Hiring Manager". */
	recipient: string;
	/** Up to 3 lines; '' → "di Tempat". */
	companyAddress: string;
	/** Where the user found the vacancy; undefined = not said. */
	source?: LetterSource;
	/** Portal name, event, or the person who recommended (never sent to the AI). */
	sourceDetail: string;
	/** City the letter is written in. */
	place: string;
	/** 'YYYY-MM-DD'. */
	date: string;
	/** CV items to mention (max `LETTER_LIMITS.highlights`). */
	highlights: LetterHighlightRef[];
	/** Why this company (plain text, the user's words). */
	motivation: string;
	availability: { immediate: boolean; relocate: boolean };
	/** Indonesian letters: "data diri" table (birth place/date, address). Never sent to the AI. */
	includeIdentity: boolean;
	identity: { birthPlace: string; birthDate?: string; address: string };
	attachments: LetterAttachment[];
	/** Free-text extra attachments (max `LETTER_LIMITS.otherAttachments`). */
	otherAttachments: string[];
	/** Paragraphs rewritten by the user or the AI; absent = written from the CV. */
	overrides: Partial<Record<LetterTextKey, RichRun[]>>;
	style: LetterStyle;
	/** ISO 8601 */
	createdAt: string;
	/** ISO 8601 */
	updatedAt: string;
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
	/** Creative CVs only; absent = template defaults. */
	design?: CVDesign;
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
	/** Italics for foreign terms (Indonesian CVs); absent = on. */
	foreign?: CVForeign;
	/** Optional cover letters for this CV (absent = none). Change them with core/letter helpers. */
	letters?: CoverLetter[];
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
	/** Number of cover letters. */
	letterCount: number;
	createdAt: string;
	updatedAt: string;
}
