import type { EditTarget, InlineEntryField } from '#lib/core/design/index.ts';
import type { CVDocument, SectionKey } from '#lib/core/schema/types.ts';
import { sanitizeUrl } from '#lib/core/security/url.ts';

export type VisualFormTarget = {
	field: string;
	section: SectionKey | 'personal' | 'target';
};

const entryFields: Record<string, Partial<Record<InlineEntryField, string>>> = {
	education: { title: 'institution', subtitle: 'degree' },
	experience: { title: 'role', subtitle: 'company', location: 'location' },
	organizations: { title: 'role', subtitle: 'name' },
	projects: { title: 'name', subtitle: 'role' },
	languages: { title: 'name', subtitle: 'level' },
	certifications: { title: 'name', subtitle: 'issuer' },
	awards: { title: 'title', subtitle: 'issuer', description: 'description' },
	custom: { title: 'title', subtitle: 'subtitle' }
};

/** The form uses original CV field names rather than render model display names. */
export function formTargetForEdit(target: EditTarget): VisualFormTarget | undefined {
	if (target.kind === 'personal') return { field: `personal.${target.field}`, section: 'personal' };
	if (target.kind === 'summary') return { field: 'summary', section: 'summary' };
	if (target.kind === 'sectionTitle') return { field: '', section: target.section };
	const kind = target.section.startsWith('custom:') ? 'custom' : target.section;
	if (target.kind === 'bullet') {
		if (!['education', 'experience', 'organizations', 'projects', 'custom'].includes(kind)) return;
		const field = kind === 'education' ? 'highlights' : 'bullets';
		return {
			field: `${target.section}.${target.id}.${field}.${target.index}`,
			section: target.section
		};
	}
	const field = entryFields[kind]?.[target.field];
	return field
		? { field: `${target.section}.${target.id}.${field}`, section: target.section }
		: undefined;
}

/** Readonly template text points at a composed field, date, or contact control. */
export function formTargetFromElement(
	element: Element,
	cv: CVDocument
): VisualFormTarget | undefined {
	const node = element.closest<HTMLElement>('[data-form-field]');
	const field = node?.dataset.formField;
	if (!node || !field) return;
	const section = node.dataset.formSection ?? field.split('.')[0];
	if (
		section !== 'personal' &&
		section !== 'target' &&
		!cv.layout.order.includes(section as SectionKey)
	)
		return;
	if (field === 'personal.links') {
		const href = sanitizeUrl(node.dataset.formLink ?? '');
		if (!href) return;
		const link = cv.personal.links.find((candidate) => sanitizeUrl(candidate.url) === href);
		return link ? { field: `personal.links.${link.id}.url`, section: 'personal' } : undefined;
	}
	return { field, section: section as VisualFormTarget['section'] };
}
