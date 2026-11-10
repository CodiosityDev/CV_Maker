import type { CheckTarget } from '#lib/core/ats/types.ts';
import { WIZARD_STEP_IDS, type WizardStepId } from '#lib/core/wizard/steps.ts';
import type { SectionKey } from '#lib/core/schema/types.ts';

/** Editor-only URL state; it contains a field location, never CV text. */
export function atsEditQuery(target: CheckTarget): string {
	const query = new URLSearchParams({ atsStep: target.step });
	if (target.section) query.set('atsSection', target.section);
	if (target.itemId) query.set('atsItem', target.itemId);
	if (target.field) query.set('atsField', target.field);
	return query.toString();
}

export function atsEditTarget(query: Pick<URLSearchParams, 'get'>): CheckTarget | undefined {
	const step = query.get('atsStep') as WizardStepId;
	if (!WIZARD_STEP_IDS.includes(step)) return undefined;
	const section = query.get('atsSection');
	const sections: readonly string[] = [
		'summary',
		'education',
		'experience',
		'organizations',
		'projects',
		'skills',
		'languages',
		'certifications',
		'awards'
	];
	const safe = (value: string | null) =>
		value && /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : undefined;
	return {
		step,
		section: section && sections.includes(section) ? (section as SectionKey) : undefined,
		itemId: safe(query.get('atsItem')),
		field: safe(query.get('atsField'))
	};
}
