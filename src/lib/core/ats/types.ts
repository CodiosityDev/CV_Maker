import type { SectionKey } from '../schema/types';
import type { WizardStepId } from '../wizard/steps';

export type CheckLevel = 'error' | 'warn' | 'tip';

export type CheckId =
	// errors — must fix
	| 'missingName'
	| 'missingEmail'
	| 'invalidEmail'
	| 'missingPhone'
	| 'invalidPhone'
	| 'missingEducation'
	// warnings — strongly recommended
	| 'noExperience'
	| 'noSkills'
	| 'missingSummary'
	| 'longSummary'
	| 'missingDates'
	| 'invalidLink'
	| 'unprofessionalEmail'
	| 'creativeForAts'
	| 'itemWithoutBullets'
	| 'tooLong'
	// tips — nice to improve
	| 'shortSummary'
	| 'missingHeadline'
	| 'bulletNoVerb'
	| 'fewNumbers'
	| 'bulletTooLong'
	| 'bulletTooShort'
	| 'firstPerson'
	| 'duplicateBullet'
	| 'fewSkills';

/** Where the UI should take the user to fix a check. */
export interface CheckTarget {
	step: WizardStepId;
	section?: SectionKey;
	itemId?: string;
	/** e.g. 'email', 'phone', 'summary', 'dates', 'bullets' */
	field?: string;
}

export interface AtsCheck {
	id: CheckId;
	level: CheckLevel;
	/** i18n key in the `ats` namespace: `ats.checks.<id>` */
	messageKey: `ats.checks.${CheckId}`;
	/** Values for {placeholders} in the message, e.g. { count: 2, item: 'Data Analyst Intern' }. */
	params?: Record<string, string | number>;
	target: CheckTarget;
}

export type AtsGrade = 'good' | 'ok' | 'needsWork';

export interface AtsReport {
	/** 0–100 */
	score: number;
	grade: AtsGrade;
	/** Sorted: errors, then warnings, then tips. */
	checks: AtsCheck[];
	counts: Record<CheckLevel, number>;
	stats: {
		bullets: number;
		bulletsWithNumbers: number;
		/** Rough estimate for an A4 page at 10.5 pt. */
		estimatedPages: number;
	};
}

export interface KeywordMatch {
	/** Display form of the keyword. */
	term: string;
	/** Times it appears in the job description. */
	count: number;
	/** Found in the CV text. */
	inCv: boolean;
	/** Known skill/tool from the curated dictionary (stronger signal than plain frequency). */
	known: boolean;
}

export interface KeywordReport {
	keywords: KeywordMatch[];
	/** Share of keywords found in the CV, 0–1. 0 when there are no keywords. */
	coverage: number;
}
