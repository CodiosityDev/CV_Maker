/**
 * CVDocument → RenderModel: everything a template needs, already prepared (PROJECT_SPEC §7.1).
 *
 * Templates only DISPLAY the model: no business logic, no formatting, no URL handling.
 * - hidden & empty sections removed, order applied
 * - titles translated to the CV's language (custom titles respected)
 * - dates formatted ("Jul 2024 – Sekarang")
 * - links sanitized (unsafe URLs dropped) with short display text
 * - blank bullets/items removed, text trimmed
 *
 *   import { toRenderModel } from '#lib/core/render/index.ts';
 *   const model = $derived(toRenderModel(store.cv, { photoUrl }));
 */
import type {
	BuiltinSectionKey,
	CVDocument,
	CVKind,
	CVTheme,
	CustomSectionKey,
	Locale,
	SectionKey,
	SkillGroups
} from '../schema/types';
import { displayDegree, isSchoolLevel, scoreLabel } from '../education/index';
import { displayUrl, sanitizeUrl } from '../security/url';
import { formatDateRange, formatYearMonth, phoneHref } from './format';
import { CV_LABELS, type CvLabels } from './labels';
import { resolveDesign, type ResolvedDesign } from '../design/index';

export { CV_LABELS, type CvLabels } from './labels';
export { formatDateRange, formatYearMonth } from './format';

export interface RenderLink {
	label: string;
	href: string;
	/** Short text for print, e.g. 'linkedin.com/in/rizky'. */
	display: string;
}

export interface RenderEntry {
	id: string;
	/** Main line: role, institution, project name, ... */
	title: string;
	/** Secondary line: company, degree + major, issuer, ... */
	subtitle?: string;
	/** Small facts, e.g. ['IPK 3.65/4.00', 'Magang']. */
	meta: string[];
	dateText?: string;
	location?: string;
	link?: RenderLink;
	description?: string;
	bullets: string[];
}

export type RenderSection =
	| { type: 'text'; key: 'summary'; title: string; paragraphs: string[] }
	| {
			type: 'entries';
			key: Exclude<BuiltinSectionKey, 'summary' | 'skills'> | CustomSectionKey;
			title: string;
			entries: RenderEntry[];
	  }
	| {
			type: 'skills';
			key: 'skills';
			title: string;
			groups: { key: keyof SkillGroups; label: string; items: string[] }[];
	  };

export interface RenderModel {
	id: string;
	kind: CVKind;
	locale: Locale;
	templateId: string;
	theme: CVTheme;
	labels: CvLabels;
	personal: {
		fullName: string;
		headline?: string;
		email?: string;
		emailHref?: string;
		phone?: string;
		phoneHref?: string;
		/** 'Malang, Jawa Timur' */
		location?: string;
		links: RenderLink[];
		/** Only set for creative CVs. */
		photoUrl?: string;
	};
	/** Visible, non-empty sections in display order. */
	sections: RenderSection[];
	/** Creative CVs only: the visual design, every default filled in. Split columns with `splitColumns`. */
	design?: ResolvedDesign;
	/** Set for the visual editor's page: templates add `data-edit={editKey(...)}` to editable texts. */
	editing?: true;
}

export interface RenderOptions {
	/** Object URL from assetRepo.getPhotoUrl(); ignored for ATS CVs. */
	photoUrl?: string;
	/** Visual editor page only (never print/export): keeps blank bullets and marks `model.editing`. */
	editing?: boolean;
}

/**
 * Two-column templates: sections for the side and main columns (design placement, CV order).
 * Without a design (ATS) everything is in `main`.
 */
export function splitColumns(model: Pick<RenderModel, 'sections' | 'design'>): {
	side: RenderSection[];
	main: RenderSection[];
} {
	const side = new Set(model.design?.side ?? []);
	return {
		side: model.sections.filter((section) => side.has(section.key)),
		main: model.sections.filter((section) => !side.has(section.key))
	};
}

const trim = (value: string | undefined): string => (value ?? '').trim();
const opt = (value: string | undefined): string | undefined => trim(value) || undefined;
const cleanList = (items: readonly string[]): string[] => items.map(trim).filter(Boolean);
function makeLink(url: string | undefined, label?: string): RenderLink | undefined {
	const href = sanitizeUrl(url);
	if (!href) return undefined;
	const display = displayUrl(href);
	return { href, display, label: opt(label) ?? display };
}

/** Keeps an entry only if it has something to show as a heading. */
function keep(entry: RenderEntry): boolean {
	return Boolean(entry.title || entry.subtitle);
}

type BulletList = (items: readonly string[]) => string[];

function buildEntries(
	cv: CVDocument,
	key: Exclude<BuiltinSectionKey, 'summary' | 'skills'>,
	labels: CvLabels,
	list: BulletList
): RenderEntry[] {
	const locale = cv.locale;
	switch (key) {
		case 'education':
			return cv.education
				.map((e) => {
					const gpa = opt(e.gpa);
					const school = isSchoolLevel(e.degree);
					const degree = opt(e.degree) ? displayDegree(trim(e.degree), locale) : undefined;
					const meta: string[] = [];
					if (gpa)
						meta.push(
							`${scoreLabel(e.degree, locale)} ${gpa}${opt(e.gpaScale) ? `/${trim(e.gpaScale)}` : ''}`
						);
					if (opt(e.thesisTitle))
						meta.push(`${school ? labels.finalProject : labels.thesis}: ${trim(e.thesisTitle)}`);
					return {
						id: e.id,
						title: trim(e.institution),
						// "S1 Ilmu Komputer" · "Bachelor's Degree, Computer Science"
						subtitle:
							[degree, opt(e.major)].filter(Boolean).join(locale === 'en' ? ', ' : ' ') ||
							undefined,
						meta,
						dateText: formatDateRange(e.dates, locale),
						bullets: list(e.highlights)
					};
				})
				.filter(keep);
		case 'experience':
			return cv.experience
				.map((e) => ({
					id: e.id,
					title: trim(e.role),
					subtitle: opt(e.company),
					meta: e.type === 'fulltime' ? [] : [labels.experienceType[e.type]],
					dateText: formatDateRange(e.dates, locale),
					location: opt(e.location),
					bullets: list(e.bullets)
				}))
				.filter(keep);
		case 'organizations':
			return cv.organizations
				.map((o) => ({
					id: o.id,
					title: trim(o.role),
					subtitle: opt(o.name),
					meta: [],
					dateText: formatDateRange(o.dates, locale),
					bullets: list(o.bullets)
				}))
				.filter(keep);
		case 'projects':
			return cv.projects
				.map((p) => ({
					id: p.id,
					title: trim(p.name),
					subtitle: opt(p.role),
					meta: [],
					dateText: formatDateRange(p.dates, locale),
					link: makeLink(p.url),
					bullets: list(p.bullets)
				}))
				.filter(keep);
		case 'languages':
			return cv.languages
				.map((l) => ({
					id: l.id,
					title: trim(l.name),
					subtitle: [labels.languageLevel[l.level], opt(l.score)].filter(Boolean).join(' · '),
					meta: [],
					bullets: []
				}))
				.filter((entry) => Boolean(entry.title));
		case 'certifications':
			return cv.certifications
				.map((c) => ({
					id: c.id,
					title: trim(c.name),
					subtitle: opt(c.issuer),
					meta: [],
					dateText: formatYearMonth(c.date, locale),
					link: makeLink(c.credentialUrl),
					bullets: []
				}))
				.filter(keep);
		case 'awards':
			return cv.awards
				.map((a) => ({
					id: a.id,
					title: trim(a.title),
					subtitle: opt(a.issuer),
					meta: [],
					dateText: formatYearMonth(a.date, locale),
					description: opt(a.description),
					bullets: []
				}))
				.filter(keep);
	}
}

function buildSection(
	cv: CVDocument,
	key: SectionKey,
	labels: CvLabels,
	list: BulletList
): RenderSection | null {
	const title = opt(cv.layout.customTitles[key]);

	if (key === 'summary') {
		const paragraphs = cv.summary
			.split(/\n\s*\n|\n/)
			.map((p) => p.trim())
			.filter(Boolean);
		return paragraphs.length
			? { type: 'text', key, title: title ?? labels.sections.summary, paragraphs }
			: null;
	}

	if (key === 'skills') {
		const groups = (['hard', 'soft', 'tools'] as const)
			.map((group) => ({
				key: group,
				label: labels.skillGroups[group],
				items: cleanList(cv.skills[group])
			}))
			.filter((group) => group.items.length > 0);
		return groups.length
			? { type: 'skills', key, title: title ?? labels.sections.skills, groups }
			: null;
	}

	if (key.startsWith('custom:')) {
		const section = cv.custom.find((s) => s.key === key);
		if (!section) return null;
		const entries = section.items
			.map((item) => ({
				id: item.id,
				title: trim(item.title),
				subtitle: opt(item.subtitle),
				meta: [],
				dateText: formatDateRange(item.dates, cv.locale),
				bullets: list(item.bullets)
			}))
			.filter(keep);
		const sectionTitle = title ?? opt(section.title);
		return entries.length && sectionTitle
			? { type: 'entries', key: section.key, title: sectionTitle, entries }
			: null;
	}

	const builtin = key as Exclude<BuiltinSectionKey, 'summary' | 'skills'>;
	const entries = buildEntries(cv, builtin, labels, list);
	return entries.length
		? { type: 'entries', key: builtin, title: title ?? labels.sections[builtin], entries }
		: null;
}

/** Pure and fast: safe to call inside `$derived` on every edit. */
export function toRenderModel(cv: CVDocument, options: RenderOptions = {}): RenderModel {
	const labels = CV_LABELS[cv.locale];
	const p = cv.personal;
	const email = opt(p.email);
	const phone = opt(p.phone);
	const hidden = new Set(cv.layout.hidden);
	const editing = options.editing === true;
	// Editing keeps blank bullets (and their exact text) so `data-edit` bullet indexes match the data.
	const list: BulletList = editing ? (items) => [...items] : cleanList;

	const sections: RenderSection[] = [];
	for (const key of cv.layout.order) {
		if (hidden.has(key)) continue;
		const section = buildSection(cv, key, labels, list);
		if (section) sections.push(section);
	}

	return {
		id: cv.id,
		kind: cv.kind,
		locale: cv.locale,
		templateId: cv.templateId,
		theme: { ...cv.theme },
		labels,
		personal: {
			fullName: trim(p.fullName),
			headline: opt(p.headline),
			email,
			emailHref: email ? sanitizeUrl(`mailto:${email}`) : undefined,
			phone,
			phoneHref: phone ? phoneHref(phone) : undefined,
			location: [opt(p.city), opt(p.province)].filter(Boolean).join(', ') || undefined,
			links: p.links
				.map((link) => makeLink(link.url, link.label))
				.filter((link): link is RenderLink => link !== undefined),
			photoUrl: cv.kind === 'creative' ? options.photoUrl : undefined
		},
		sections,
		...(cv.kind === 'creative' ? { design: resolveDesign(cv) } : {}),
		...(editing ? { editing: true as const } : {})
	};
}
