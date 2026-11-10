/** CvDraft + contacts (read on the device) → a valid ATS CVDocument, ready to save with cvRepo. */
import { createEmptyCv } from '../schema/defaults';
import { newId } from '../schema/ids';
import { cvDocumentSchema } from '../schema/schema';
import type { CVDocument, Locale } from '../schema/types';
import { sanitizeUrl } from '../security/url';
import * as v from 'valibot';
import type { CvContacts, CvDraft } from './types';

export interface BuildOptions {
	locale: Locale;
	/** Position the user chose on the page (wins over a guess). */
	targetRole?: string;
	now?: Date;
}

const TITLE: Record<Locale, (role: string) => string> = {
	id: (role) => (role ? `CV ATS ${role}` : 'CV ATS (hasil konversi)'),
	en: (role) => (role ? `ATS CV ${role}` : 'ATS CV (converted)')
};

/**
 * Builds the CV. Runs it through the same schema as a loaded/imported CV (lengths, URLs, dates),
 * so whatever the parser or the AI produced, the result is a valid document. The wizard is marked
 * completed: the user lands in the full editor to check everything.
 */
export function cvFromDraft(
	draft: CvDraft,
	contacts: CvContacts,
	options: BuildOptions
): CVDocument {
	const targetRole = (options.targetRole?.trim() || draft.targetRole).slice(0, 150);
	const base = createEmptyCv({ kind: 'ats', locale: options.locale, now: options.now });
	const cv: CVDocument = {
		...base,
		title: TITLE[options.locale](targetRole).slice(0, 80),
		targetRole: targetRole || undefined,
		status: { wizardCompleted: true, wizardStep: 0 },
		personal: {
			fullName: contacts.fullName,
			headline: draft.headline,
			email: contacts.email,
			phone: contacts.phone,
			city: contacts.city,
			links: contacts.links
				.map((link) => ({ id: newId(), label: link.label, url: sanitizeUrl(link.url) ?? '' }))
				.filter((link) => link.url)
		},
		summary: draft.summary,
		education: draft.education.map((e) => ({
			id: newId(),
			institution: e.institution,
			degree: e.degree,
			major: e.major,
			gpa: e.gpa || undefined,
			gpaScale: e.gpaScale || undefined,
			dates: e.dates,
			highlights: e.highlights
		})),
		experience: draft.experience.map((e) => ({
			id: newId(),
			type: e.type,
			role: e.role,
			company: e.company,
			location: e.location || undefined,
			dates: e.dates,
			bullets: e.bullets
		})),
		organizations: draft.organizations.map((o) => ({ id: newId(), ...o })),
		projects: draft.projects.map((p) => ({
			id: newId(),
			name: p.name,
			role: p.role || undefined,
			dates: p.dates,
			bullets: p.bullets
		})),
		skills: draft.skills,
		languages: draft.languages.map((l) => ({
			id: newId(),
			name: l.name,
			level: l.level,
			score: l.score || undefined
		})),
		certifications: draft.certifications.map((c) => ({
			id: newId(),
			name: c.name,
			issuer: c.issuer,
			date: c.date
		})),
		awards: draft.awards.map((a) => ({
			id: newId(),
			title: a.title,
			issuer: a.issuer,
			date: a.date,
			description: a.description || undefined
		}))
	};
	return v.parse(cvDocumentSchema, cv) as CVDocument;
}
