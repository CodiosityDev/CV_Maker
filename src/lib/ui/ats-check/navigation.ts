import type { CheckTarget } from '#lib/core/ats/types.ts';
import { WIZARD_STEP_IDS, type WizardStepId } from '#lib/core/wizard/steps.ts';
import type { SectionKey } from '#lib/core/schema/types.ts';
import { CUSTOM_SECTION_KEY_PATTERN } from '#lib/core/schema/ids.ts';
import { LIMITS } from '#lib/core/schema/limits.ts';

export type AtsEditTarget = CheckTarget & { bulletIndex?: number };

/** Form-control ID, including the particular bullet identified by the check. */
export function atsField(target: AtsEditTarget): string | undefined {
	if (target.step === 'personal' && target.field)
		return target.field === 'links' && target.itemId
			? `personal.links.${target.itemId}.url`
			: `personal.${target.field}`;
	if (target.section && target.itemId && target.field) {
		const field =
			target.section === 'education' && target.field === 'bullets' ? 'highlights' : target.field;
		const prefix = `${target.section}.${target.itemId}.${field}`;
		return Number.isInteger(target.bulletIndex) &&
			target.bulletIndex! >= 0 &&
			target.bulletIndex! < LIMITS.bulletsPerItem &&
			(field === 'bullets' || field === 'highlights')
			? `${prefix}.${target.bulletIndex}`
			: prefix;
	}
	if (target.section === 'summary') return 'summary';
	if (target.section === 'skills') return 'skills.hard';
	return target.field;
}

/** Editor/wizard URL state; it contains a field location, never CV text. */
export function atsEditQuery(target: AtsEditTarget): string {
	const query = new URLSearchParams({ atsStep: target.step });
	if (target.section) query.set('atsSection', target.section);
	if (target.itemId) query.set('atsItem', target.itemId);
	if (target.field) query.set('atsField', target.field);
	if (
		Number.isInteger(target.bulletIndex) &&
		target.bulletIndex! >= 0 &&
		target.bulletIndex! < LIMITS.bulletsPerItem
	)
		query.set('atsBullet', String(target.bulletIndex));
	return query.toString();
}

export function atsEditTarget(query: Pick<URLSearchParams, 'get'>): AtsEditTarget | undefined {
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
	const bullet = query.get('atsBullet');
	const bulletIndex = bullet !== null && /^\d+$/.test(bullet) ? Number(bullet) : undefined;
	return {
		step,
		section:
			section && (sections.includes(section) || CUSTOM_SECTION_KEY_PATTERN.test(section))
				? (section as SectionKey)
				: undefined,
		itemId: safe(query.get('atsItem')),
		field: safe(query.get('atsField')),
		bulletIndex:
			bulletIndex !== undefined && bulletIndex < LIMITS.bulletsPerItem ? bulletIndex : undefined
	};
}
