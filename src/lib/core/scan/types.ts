/**
 * CV scan (ATS scanner for a CV file made anywhere): types shared by extraction, analysis and UI.
 * Everything runs on the user's device — the file is never uploaded.
 */
import type { AtsGrade, CheckLevel, KeywordReport } from '../ats/types';
import type { Locale, SectionKey } from '../schema/types';

/** Largest file accepted (same limit as a JSON backup). */
export const SCAN_MAX_BYTES = 5 * 1024 * 1024;
/** Only the first pages of a PDF are read (a fresh-graduate CV has 1–2). */
export const SCAN_MAX_PAGES = 10;
/** Text beyond this is ignored (keeps analysis fast on any phone). */
export const SCAN_MAX_CHARS = 40_000;
/** `accept` attribute for the file input. */
export const SCAN_ACCEPT =
	'.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export type ScanFileKind = 'pdf' | 'docx' | 'txt';

/**
 * Why a file could not be read; the UI shows `t(\`ats.scan.errors.${code}\`)`.
 * unsupported: not PDF/DOCX/TXT (e.g. old .doc, images) · tooLarge: over SCAN_MAX_BYTES ·
 * encrypted: password protected · damaged: broken file · empty: no text at all (DOCX/TXT) ·
 * failed: anything else.
 */
export const SCAN_ERROR_CODES = [
	'unsupported',
	'tooLarge',
	'encrypted',
	'damaged',
	'empty',
	'failed'
] as const;
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

export class ScanError extends Error {
	constructor(readonly code: ScanErrorCode) {
		super(`CV scan failed: ${code}`);
		this.name = 'ScanError';
	}
}

/** What the file's layout tells about ATS readability (filled by the extractor). */
export interface ScanLayout {
	/** PDF pages without any text: a scan or a picture of a CV. ATS reads nothing. */
	imageOnly: boolean;
	/** Text sits in two or more columns (PDF heuristic). Many ATS mix the columns up. */
	columns: boolean;
	/** DOCX uses tables. */
	tables: boolean;
	/** DOCX uses text boxes (often skipped by ATS). */
	textBoxes: boolean;
	/** Number of pictures/graphics (photo, icons, charts). */
	images: number;
	/** DOCX: email/phone only in the page header/footer (some ATS skip those). */
	contactInHeaderFooter: boolean;
}

/** Result of `extractCvText(file)`. Pass it as-is to `analyzeScan`. */
export interface ExtractedCv {
	kind: ScanFileKind;
	/** Plain text in reading order, one line per line/paragraph. */
	text: string;
	/** Real page count for PDF; estimate for DOCX/TXT. */
	pages: number;
	layout: ScanLayout;
}

export type ScanCheckId =
	// errors
	| 'imageOnly'
	| 'missingEmail'
	| 'missingPhone'
	| 'missingEducation'
	// warnings
	| 'garbledText'
	| 'multiColumn'
	| 'tables'
	| 'textBoxes'
	| 'contactInHeaderFooter'
	| 'unclearHeadings'
	| 'noExperience'
	| 'noSkills'
	| 'missingSummary'
	| 'missingDates'
	| 'noBullets'
	| 'unprofessionalEmail'
	| 'tooLong'
	| 'tooShort'
	// tips
	| 'graphics'
	| 'missingLinkedIn'
	| 'bulletNoVerb'
	| 'fewNumbers'
	| 'bulletTooLong'
	| 'firstPerson';

export interface ScanCheck {
	id: ScanCheckId;
	level: CheckLevel;
	/** i18n key in the `ats` namespace. */
	messageKey: `ats.scan.checks.${ScanCheckId}`;
	params?: Record<string, string | number>;
}

/** Sections the scanner recognises by their heading (Indonesian and English). */
export type ScanSection = Extract<
	SectionKey,
	| 'summary'
	| 'education'
	| 'experience'
	| 'organizations'
	| 'projects'
	| 'skills'
	| 'certifications'
	| 'awards'
	| 'languages'
>;

export interface ScanReport {
	/** 0–100 (same scale as the in-app checker). */
	score: number;
	grade: AtsGrade;
	/** Sorted: errors, warnings, tips. */
	checks: ScanCheck[];
	counts: Record<CheckLevel, number>;
	/** Sections found, in the order they appear in the CV. */
	sections: ScanSection[];
	contact: { email: boolean; phone: boolean; linkedin: boolean };
	stats: { words: number; bullets: number; bulletsWithNumbers: number; pages: number };
	/** Language the CV seems to be written in. */
	locale: Locale;
}

export interface ScanAnalysis {
	report: ScanReport;
	/** Present when a job post was given. */
	keywords?: KeywordReport;
}
