import type { WizardStepId } from '../wizard/steps';

export type ExampleBulletKind =
	'internship' | 'organization' | 'committee' | 'project' | 'parttime' | 'volunteer';

export interface SummaryExample {
	/** Field of study / work, e.g. 'it', 'accounting'. */
	field: string;
	label: string;
	/** Text with [placeholders] the user replaces, e.g. '[jurusan]'. */
	text: string;
}

/**
 * Guidance content shown next to wizard fields. Plain text only.
 * Loaded lazily per CV/UI language via `loadGuidance(locale)`.
 */
export interface Guidance {
	/** 1–3 short tips per step. Steps without tips have an empty array. */
	stepTips: Record<WizardStepId, string[]>;
	/** Tips for specific fields (shown in a hint/popover). */
	fieldTips: {
		headline: string;
		email: string;
		phone: string;
		links: string;
		gpa: string;
		bullets: string;
		summary: string;
		skills: string;
		photo: string;
	};
	/** Ready-to-adapt example bullets per experience kind. */
	exampleBullets: Record<ExampleBulletKind, string[]>;
	/** Strong verbs to start a bullet with. */
	actionVerbs: string[];
	summaryExamples: SummaryExample[];
	/** Short explanation of ATS vs Creative for the type step / quiz. */
	cvTypes: {
		ats: { title: string; points: string[] };
		creative: { title: string; points: string[] };
		changeLater: string;
	};
}
