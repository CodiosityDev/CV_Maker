/**
 * Wizard definition & per-step validation (PROJECT_SPEC §4.1).
 *
 * The UI owns the labels/texts (i18n `wizard.steps.<id>.*`); core owns the order, which
 * steps can be skipped, and what makes a step valid. Validation only blocks on what is
 * REQUIRED (name, email, phone, ≥ 1 education) and on clear mistakes (end before start).
 * Writing-quality advice belongs to the ATS checker (M7), not here.
 */
import type { CVDocument, DateRange } from '../schema/types';
import { isValidPhone } from './phone';

export const WIZARD_STEPS = [
	{ id: 'type', optional: false },
	{ id: 'target', optional: false },
	{ id: 'personal', optional: false },
	{ id: 'education', optional: false },
	{ id: 'experience', optional: true },
	{ id: 'organizations', optional: true },
	{ id: 'projects', optional: true },
	{ id: 'skills', optional: true },
	{ id: 'summary', optional: true },
	{ id: 'review', optional: false },
	{ id: 'done', optional: false }
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];
export const WIZARD_STEP_IDS: readonly WizardStepId[] = WIZARD_STEPS.map((step) => step.id);

/** i18n keys (namespace `validation.*` in the UI dictionaries). */
export type ValidationMessageKey =
	| 'validation.required'
	| 'validation.nameTooShort'
	| 'validation.emailInvalid'
	| 'validation.phoneInvalid'
	| 'validation.educationRequired'
	| 'validation.dateOrder'
	| 'validation.itemTitleRequired';

export interface StepIssue {
	/**
	 * Dotted path of the field, for focusing/highlighting it, e.g. 'personal.email',
	 * 'education.<itemId>.institution', 'experience.<itemId>.dates'.
	 */
	field: string;
	messageKey: ValidationMessageKey;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const blank = (value: string | undefined): boolean => !value || value.trim() === '';

/** true if both dates are set and end is before start. */
export function isDateOrderInvalid(range: DateRange | undefined): boolean {
	if (!range || range.current || !range.start || !range.end) return false;
	return range.end < range.start;
}

function hasContent(values: (string | undefined)[], bullets: string[] = []): boolean {
	return values.some((value) => !blank(value)) || bullets.some((bullet) => !blank(bullet));
}

function validatePersonal(cv: CVDocument): StepIssue[] {
	const issues: StepIssue[] = [];
	const p = cv.personal;
	if (blank(p.fullName))
		issues.push({ field: 'personal.fullName', messageKey: 'validation.required' });
	else if (p.fullName.trim().length < 2)
		issues.push({ field: 'personal.fullName', messageKey: 'validation.nameTooShort' });

	if (blank(p.email)) issues.push({ field: 'personal.email', messageKey: 'validation.required' });
	else if (!EMAIL.test(p.email.trim()))
		issues.push({ field: 'personal.email', messageKey: 'validation.emailInvalid' });

	if (blank(p.phone)) issues.push({ field: 'personal.phone', messageKey: 'validation.required' });
	else if (!isValidPhone(p.phone))
		issues.push({ field: 'personal.phone', messageKey: 'validation.phoneInvalid' });
	return issues;
}

function validateEducation(cv: CVDocument): StepIssue[] {
	const issues: StepIssue[] = [];
	const filled = cv.education.filter((e) =>
		hasContent([e.institution, e.degree, e.major, e.gpa], e.highlights)
	);
	if (filled.length === 0) {
		issues.push({ field: 'education', messageKey: 'validation.educationRequired' });
	}
	for (const e of filled) {
		if (blank(e.institution))
			issues.push({ field: `education.${e.id}.institution`, messageKey: 'validation.required' });
		if (isDateOrderInvalid(e.dates))
			issues.push({ field: `education.${e.id}.dates`, messageKey: 'validation.dateOrder' });
	}
	return issues;
}

/** Shared rule for optional item sections: an item that has ANY content needs a heading. */
function validateItems<T extends { id: string; dates?: DateRange; bullets: string[] }>(
	section: string,
	items: T[],
	headingField: keyof T & string,
	otherFields: (keyof T & string)[]
): StepIssue[] {
	const issues: StepIssue[] = [];
	for (const item of items) {
		const values = [headingField, ...otherFields].map((key) => item[key] as string | undefined);
		if (!hasContent(values, item.bullets)) continue;
		if (blank(item[headingField] as string | undefined))
			issues.push({
				field: `${section}.${item.id}.${headingField}`,
				messageKey: 'validation.itemTitleRequired'
			});
		if (isDateOrderInvalid(item.dates))
			issues.push({ field: `${section}.${item.id}.dates`, messageKey: 'validation.dateOrder' });
	}
	return issues;
}

/** Issues that block "Lanjut" on this step. Empty array = OK. Pure & cheap: use in `$derived`. */
export function validateStep(step: WizardStepId, cv: CVDocument): StepIssue[] {
	switch (step) {
		case 'personal':
			return validatePersonal(cv);
		case 'education':
			return validateEducation(cv);
		case 'experience':
			return validateItems('experience', cv.experience, 'role', ['company', 'location']);
		case 'organizations':
			return validateItems('organizations', cv.organizations, 'name', ['role']);
		case 'projects':
			return validateItems('projects', cv.projects, 'name', ['role', 'url']);
		default:
			return [];
	}
}

/** All issues across the whole CV (for the review step). */
export function validateAll(cv: CVDocument): StepIssue[] {
	return WIZARD_STEP_IDS.flatMap((step) => validateStep(step, cv));
}

/** Index helpers for Back / Next / Skip. */
export function nextStepIndex(current: number): number {
	return Math.min(current + 1, WIZARD_STEPS.length - 1);
}
export function previousStepIndex(current: number): number {
	return Math.max(current - 1, 0);
}
export function isStepOptional(index: number): boolean {
	return WIZARD_STEPS[index]?.optional ?? false;
}
