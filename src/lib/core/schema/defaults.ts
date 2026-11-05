import type { CVDocument, CVKind, Locale, SectionKey } from './types';
import { newId } from './ids';
import { FONT_SCALE } from './limits';

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** Fresh graduates: education comes right after the summary. */
export const DEFAULT_SECTION_ORDER: readonly SectionKey[] = [
	'summary',
	'education',
	'experience',
	'organizations',
	'projects',
	'skills',
	'certifications',
	'awards',
	'languages'
];

export const DEFAULT_TEMPLATE_ID: Record<CVKind, string> = {
	ats: 'ats-klasik',
	creative: 'creative-sidebar'
};

const DEFAULT_TITLE: Record<CVKind, Record<Locale, string>> = {
	ats: { id: 'CV ATS', en: 'ATS CV' },
	creative: { id: 'CV Kreatif', en: 'Creative CV' }
};

export interface CreateCvOptions {
	kind: CVKind;
	locale: Locale;
	title?: string;
	id?: string;
	now?: Date;
}

/** A blank CV, ready for the wizard (step 0, not completed). */
export function createEmptyCv(options: CreateCvOptions): CVDocument {
	const now = (options.now ?? new Date()).toISOString();
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		id: options.id ?? newId(),
		title: options.title ?? DEFAULT_TITLE[options.kind][options.locale],
		kind: options.kind,
		locale: options.locale,
		templateId: DEFAULT_TEMPLATE_ID[options.kind],
		theme: { fontId: 'default', fontScale: FONT_SCALE.default },
		status: { wizardCompleted: false, wizardStep: 0 },
		layout: { order: [...DEFAULT_SECTION_ORDER], hidden: [], customTitles: {} },
		personal: { fullName: '', headline: '', email: '', phone: '', city: '', links: [] },
		summary: '',
		education: [],
		experience: [],
		organizations: [],
		projects: [],
		skills: { hard: [], soft: [], tools: [] },
		languages: [],
		certifications: [],
		awards: [],
		custom: [],
		createdAt: now,
		updatedAt: now
	};
}
