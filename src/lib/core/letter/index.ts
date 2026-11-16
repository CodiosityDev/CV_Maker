/**
 * Cover letters (surat lamaran) written from a CV — optional, several per CV (one per company).
 * Letters live in `cv.letters`, so the CV store gives them autosave, undo/redo, multi-tab sync,
 * incognito mode and "Hapus semua data" for free. Change them only inside `store.update`.
 *
 *   store.update((d) => addLetter(d, createLetter(d)));
 *   store.update((d) => updateLetter(d, id, { company }), { coalesceKey: letterCoalesceKey(id, 'company') });
 *   const model = $derived(toLetterModel(store.cv, letter));      // what the template shows
 *   const checks = $derived(checkLetter(store.cv, letter));       // errors / warnings
 *   const wordy = $derived(conciseFromLetter(model));             // "Bertele-tele?"
 *
 * Editing a paragraph (C4): `letterBlockSource(cv, letter, key)` = the runs to edit (formatting kept,
 * automatic italics NOT resolved); write back with `updateLetter(d, id, { overrides: { [key]: runs } })`
 * and undo to automatic with `{ overrides: { [key]: undefined } }`. Helpers in ./rich.
 *
 * AI ("Tulis dengan AI", 1 of today's uses):
 *   const input = aiLetterInput(store.cv, letter, jobPost);       // show it in the consent dialog
 *   const { result } = await aiClient.letter(input);
 *   store.update((d) => updateLetter(d, id, applyAiLetter(result, ['opening', 'closing'])));
 *
 * Export: `exportLetterDocx(model)`, `exportLetterTxt(model)`, `letterEmail(model)`,
 * `letterFileName(cv, letter, 'pdf')`. PDF = the print page (UI) + `window.print()`.
 */
import { aiProfileFromCv, conciseSendText, redactContacts } from '../ai/index';
import { AI_LETTER_LIMITS, type AiLetterInput, type LetterResult } from '../ai/types';
import { rateConcise, type ConcisePoint, type ConciseReport } from '../ats/concise';
import type { ConciseIssue } from '../ai/types';
import { displayDegree, isSchoolLevel, scoreLabel } from '../education/index';
import { foreignMatcherForCv, type ForeignMatcher } from '../foreign/index';
import { formatDateRange, formatYearMonth } from '../render/format';
import { newId } from '../schema/ids';
import { LETTER_LIMITS, LIMITS } from '../schema/limits';
import { cleanText, normalizeRuns } from '../schema/schema';
import {
	LETTER_TEXT_KEYS,
	type CVDocument,
	type CoverLetter,
	type LetterAttachment,
	type LetterFont,
	type LetterHighlightRef,
	type LetterHighlightSection,
	type LetterStyle,
	type LetterTextKey,
	type Locale,
	type RichRun
} from '../schema/types';
import { LETTER_PHRASES, joinList } from './phrases';
import { resolveRuns, richFromPlain, richToPlain } from './rich';

export {
	LETTER_ALIGNS,
	LETTER_ATTACHMENTS,
	LETTER_FONTS,
	LETTER_HIGHLIGHT_SECTIONS,
	LETTER_LINE_HEIGHTS,
	LETTER_SIZES,
	LETTER_SOURCES,
	LETTER_TEXT_KEYS,
	type CoverLetter,
	type LetterAttachment,
	type LetterFont,
	type LetterHighlightRef,
	type LetterSource,
	type LetterStyle,
	type LetterTextKey,
	type RichRun
} from '../schema/types';
export { LETTER_LIMITS } from '../schema/limits';
export * from './rich';
export { exportLetterDocx, exportLetterTxt, letterEmail, letterToPlainText } from './export';
export { letterFileName } from '../export/filename';

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

export const DEFAULT_LETTER_STYLE: LetterStyle = {
	font: 'times',
	size: 12,
	lineHeight: 1.15,
	align: 'left'
};

/** Choices for the "Tampilan surat" panel (labels: `letter.fonts.*`, `letter.aligns.*`). */
export const LETTER_STYLE_OPTIONS = {
	font: ['times', 'arial', 'calibri', 'georgia'],
	size: [11, 12],
	lineHeight: [1, 1.15, 1.5],
	align: ['left', 'justify']
} as const;

/**
 * Stylesheet with the self-hosted letter fonts (OFL). Add it ONLY on cover-letter pages:
 * `<link rel="stylesheet" href="{base}{LETTER_FONT_CSS_PATH}">`.
 */
export const LETTER_FONT_CSS_PATH = '/fonts/letter/fonts.css';

/** CSS `font-family` for a letter font: the installed font first, then its metric twin. */
export function letterFontFamily(font: LetterFont): string {
	switch (font) {
		case 'arial':
			return "Arial, 'CVM Arimo', Arimo, 'Liberation Sans', sans-serif";
		case 'calibri':
			return "Calibri, 'CVM Carlito', Carlito, sans-serif";
		case 'georgia':
			return "Georgia, 'CVM Gelasio', Gelasio, serif";
		default:
			return "'Times New Roman', 'CVM Tinos', Tinos, 'Liberation Serif', serif";
	}
}

// ---------------------------------------------------------------------------
// Create & change (call inside store.update)
// ---------------------------------------------------------------------------

const trim = (value: string | undefined): string => (value ?? '').trim();
/** Whitespace collapsed to single spaces, trimmed. */
const oneLine = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** Local date as 'YYYY-MM-DD'. */
function localDate(now: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A new letter filled from the CV: position, city, today, CV attached, 2–3 suggested highlights. */
export function createLetter(
	cv: CVDocument,
	options: { now?: Date; id?: string; locale?: Locale } = {}
): CoverLetter {
	const now = options.now ?? new Date();
	const stamp = now.toISOString();
	return {
		id: options.id ?? newId(),
		locale: options.locale ?? cv.locale,
		position: cleanText(trim(cv.targetRole), LETTER_LIMITS.position),
		company: '',
		recipient: '',
		companyAddress: '',
		sourceDetail: '',
		place: cleanText(trim(cv.personal.city), LETTER_LIMITS.place),
		date: localDate(now),
		highlights: suggestHighlights(cv),
		motivation: '',
		availability: { immediate: false, relocate: false },
		includeIdentity: false,
		identity: { birthPlace: '', address: '' },
		attachments: ['cv'],
		otherAttachments: [],
		overrides: {},
		style: { ...DEFAULT_LETTER_STYLE },
		createdAt: stamp,
		updatedAt: stamp
	};
}

/** Undo grouping key: typing in one field of one letter = one undo step. */
export function letterCoalesceKey(id: string, field: string): string {
	return `letter:${id}:${field}`;
}

export function findLetter(cv: CVDocument, id: string): CoverLetter | undefined {
	return cv.letters?.find((letter) => letter.id === id);
}

/** "PT Maju — Web Developer" (dashboard / list title). */
export function letterTitle(letter: CoverLetter): string {
	return [trim(letter.company), trim(letter.position)].filter(Boolean).join(' — ');
}

/** Adds a letter. false when the CV already has `LETTER_LIMITS.perCv` letters. */
export function addLetter(draft: CVDocument, letter: CoverLetter): boolean {
	const letters = draft.letters ?? [];
	if (letters.length >= LETTER_LIMITS.perCv) return false;
	draft.letters = [...letters, letter];
	return true;
}

export function removeLetter(draft: CVDocument, id: string): void {
	const letters = (draft.letters ?? []).filter((letter) => letter.id !== id);
	if (letters.length) draft.letters = letters;
	else delete draft.letters;
}

/** What `updateLetter` accepts. `overrides`: a key set to undefined goes back to automatic. */
export type LetterPatch = Partial<
	Omit<
		CoverLetter,
		'id' | 'createdAt' | 'updatedAt' | 'overrides' | 'availability' | 'identity' | 'style'
	>
> & {
	overrides?: Partial<Record<LetterTextKey, RichRun[] | undefined>>;
	availability?: Partial<CoverLetter['availability']>;
	identity?: Partial<CoverLetter['identity']>;
	style?: Partial<LetterStyle>;
};

const TEXT_FIELDS = {
	position: LETTER_LIMITS.position,
	company: LETTER_LIMITS.company,
	recipient: LETTER_LIMITS.recipient,
	sourceDetail: LETTER_LIMITS.sourceDetail,
	place: LETTER_LIMITS.place,
	motivation: LETTER_LIMITS.motivation
} as const;

/** Changes one letter (inside `store.update`). Text is cleaned and capped like the schema does. */
export function updateLetter(
	draft: CVDocument,
	id: string,
	patch: LetterPatch,
	now: Date = new Date()
): void {
	const letter = draft.letters?.find((item) => item.id === id);
	if (!letter) return;
	for (const [field, max] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, number][])
		if (patch[field] !== undefined) letter[field] = cleanText(patch[field], max);
	if (patch.companyAddress !== undefined)
		letter.companyAddress = cleanText(patch.companyAddress, LETTER_LIMITS.companyAddress)
			.split('\n')
			.slice(0, LETTER_LIMITS.addressLines)
			.join('\n');
	if ('source' in patch) letter.source = patch.source;
	if (patch.locale) letter.locale = patch.locale;
	if (patch.date && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)) letter.date = patch.date;
	if (patch.highlights) letter.highlights = uniqueRefs(patch.highlights);
	if (patch.availability) letter.availability = { ...letter.availability, ...patch.availability };
	if (patch.includeIdentity !== undefined) letter.includeIdentity = patch.includeIdentity;
	if (patch.identity) {
		const next = { ...letter.identity, ...patch.identity };
		letter.identity = {
			birthPlace: cleanText(next.birthPlace, LETTER_LIMITS.birthPlace),
			address: cleanText(next.address, LETTER_LIMITS.address),
			...(next.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(next.birthDate)
				? { birthDate: next.birthDate }
				: {})
		};
	}
	if (patch.attachments) {
		const wanted = new Set(patch.attachments);
		letter.attachments = (
			[
				'cv',
				'diploma',
				'transcript',
				'idCard',
				'photo',
				'certificates',
				'portfolio',
				'skck',
				'health',
				'reference'
			] as LetterAttachment[]
		).filter((a) => wanted.has(a));
	}
	if (patch.otherAttachments)
		letter.otherAttachments = patch.otherAttachments
			.map((item) => cleanText(item, LETTER_LIMITS.otherAttachment))
			.slice(0, LETTER_LIMITS.otherAttachments);
	if (patch.overrides) {
		const overrides = { ...letter.overrides };
		for (const key of LETTER_TEXT_KEYS) {
			if (!(key in patch.overrides)) continue;
			const runs = patch.overrides[key];
			const clean = runs ? normalizeRuns(runs) : [];
			if (clean.length) overrides[key] = clean;
			else delete overrides[key];
		}
		letter.overrides = overrides;
	}
	if (patch.style) letter.style = { ...letter.style, ...patch.style };
	letter.updatedAt = now.toISOString();
}

/**
 * A copy for another company: everything company-specific is cleared (company, recipient, address,
 * motivation, rewritten paragraphs). Returns the new id, or undefined at the limit.
 */
export function duplicateLetter(
	draft: CVDocument,
	id: string,
	now: Date = new Date()
): string | undefined {
	const source = findLetter(draft, id);
	if (!source) return undefined;
	const copy: CoverLetter = {
		...structuredClone(source),
		id: newId(),
		company: '',
		recipient: '',
		companyAddress: '',
		motivation: '',
		overrides: {},
		date: localDate(now),
		createdAt: now.toISOString(),
		updatedAt: now.toISOString()
	};
	return addLetter(draft, copy) ? copy.id : undefined;
}

function uniqueRefs(refs: readonly LetterHighlightRef[]): LetterHighlightRef[] {
	const out: LetterHighlightRef[] = [];
	for (const ref of refs)
		if (!out.some((r) => r.section === ref.section && r.id === ref.id)) out.push({ ...ref });
	return out.slice(0, LETTER_LIMITS.highlights);
}

// ---------------------------------------------------------------------------
// Highlights: CV items the letter mentions
// ---------------------------------------------------------------------------

export interface LetterHighlightOption {
	ref: LetterHighlightRef;
	section: LetterHighlightSection;
	/** Main text from the CV (role, project name, …; skills: the first few skills). */
	label: string;
	/** "PT Maju · Jul 2024 – Sekarang" ('' when nothing to add). */
	sublabel: string;
}

const SKILL_GROUPS = ['hard', 'tools', 'soft'] as const;

/** Everything the user can choose to mention, in CV order (skills last). */
export function letterHighlightOptions(cv: CVDocument): LetterHighlightOption[] {
	const out: LetterHighlightOption[] = [];
	const sub = (...parts: (string | undefined)[]) => parts.map(trim).filter(Boolean).join(' · ');
	for (const e of cv.experience)
		if (trim(e.role) || trim(e.company))
			out.push({
				ref: { section: 'experience', id: e.id },
				section: 'experience',
				label: trim(e.role) || trim(e.company),
				sublabel: sub(trim(e.role) ? e.company : '', formatDateRange(e.dates, cv.locale))
			});
	for (const o of cv.organizations)
		if (trim(o.role) || trim(o.name))
			out.push({
				ref: { section: 'organizations', id: o.id },
				section: 'organizations',
				label: trim(o.role) || trim(o.name),
				sublabel: sub(trim(o.role) ? o.name : '', formatDateRange(o.dates, cv.locale))
			});
	for (const p of cv.projects)
		if (trim(p.name))
			out.push({
				ref: { section: 'projects', id: p.id },
				section: 'projects',
				label: trim(p.name),
				sublabel: sub(p.role, formatDateRange(p.dates, cv.locale))
			});
	for (const c of cv.certifications)
		if (trim(c.name))
			out.push({
				ref: { section: 'certifications', id: c.id },
				section: 'certifications',
				label: trim(c.name),
				sublabel: sub(c.issuer, formatYearMonth(c.date, cv.locale))
			});
	for (const a of cv.awards)
		if (trim(a.title))
			out.push({
				ref: { section: 'awards', id: a.id },
				section: 'awards',
				label: trim(a.title),
				sublabel: sub(a.issuer, formatYearMonth(a.date, cv.locale))
			});
	for (const group of SKILL_GROUPS) {
		const items = cv.skills[group].map(trim).filter(Boolean);
		if (items.length)
			out.push({
				ref: { section: 'skills', id: group },
				section: 'skills',
				label: items.slice(0, 4).join(', ') + (items.length > 4 ? ', …' : ''),
				sublabel: ''
			});
	}
	return out;
}

/** 2–3 good defaults: newest experience, an organisation or project, then hard skills or tools. */
export function suggestHighlights(cv: CVDocument): LetterHighlightRef[] {
	const options = letterHighlightOptions(cv);
	const first = (section: LetterHighlightSection, id?: string) =>
		options.find((o) => o.section === section && (id === undefined || o.ref.id === id))?.ref;
	const picks = [
		first('experience'),
		first('organizations') ?? first('projects'),
		first('skills', 'hard') ?? first('skills', 'tools') ?? first('certifications')
	].filter((ref): ref is LetterHighlightRef => ref !== undefined);
	return uniqueRefs(picks);
}

/** Three example motivation sentences (C2 "Pakai contoh"), in the letter's language. */
export function letterMotivationExamples(cv: CVDocument, letter: CoverLetter): string[] {
	const phrases = LETTER_PHRASES[letter.locale];
	const company =
		trim(letter.company) || (letter.locale === 'id' ? 'perusahaan ini' : 'your company');
	const position =
		trim(letter.position) ||
		trim(cv.targetRole) ||
		(letter.locale === 'id' ? 'karyawan' : 'a team member');
	const skill =
		cv.skills.hard.map(trim).find(Boolean) ?? cv.skills.tools.map(trim).find(Boolean) ?? '';
	return phrases.motivationExamples(company, position, skill);
}

// ---------------------------------------------------------------------------
// Writing the letter from the CV
// ---------------------------------------------------------------------------

const ID_VERB = /^(?:me|ber|ter|di)\p{L}{3,}/iu;
const EN_IRREGULAR = new Set(
	'built led ran made wrote won taught drew gave held kept met sold set spoke took grew began brought found got oversaw undertook'.split(
		' '
	)
);

/** A bullet usable after "saya …" / "I …": starts with a verb, not too long. */
function verbPhrase(bullets: readonly string[], locale: Locale): string {
	for (const raw of bullets) {
		const bullet = trim(raw).replace(/[.;,\s]+$/, '');
		if (!bullet || bullet.length > 170) continue;
		const firstWord = bullet.split(/\s+/)[0] ?? '';
		const verb =
			locale === 'id'
				? ID_VERB.test(firstWord)
				: /^\p{L}+ed$/iu.test(firstWord) || EN_IRREGULAR.has(firstWord.toLowerCase());
		if (!verb) continue;
		// Lowercase the first letter unless the word is an acronym ("API…").
		return /^\p{Lu}\p{Ll}/u.test(bullet) ? bullet[0]!.toLowerCase() + bullet.slice(1) : bullet;
	}
	return '';
}

function sentence(text: string): string {
	const t = trim(text);
	if (!t) return '';
	return /[.!?]$/.test(t) ? t : `${t}.`;
}

function latestEducation(cv: CVDocument) {
	const items = cv.education.filter((e) => trim(e.institution) || trim(e.major) || trim(e.degree));
	const key = (e: (typeof items)[number]) =>
		e.dates.current ? '9999-12' : (e.dates.end ?? e.dates.start ?? '0000-00');
	return items.reduce<(typeof items)[number] | undefined>(
		(best, e) => (!best || key(e) > key(best) ? e : best),
		undefined
	);
}

function educationText(cv: CVDocument, locale: Locale): string {
	const e = latestEducation(cv);
	if (!e) return '';
	const degree = trim(e.degree) ? displayDegree(trim(e.degree), locale) : '';
	const major = trim(e.major);
	const title =
		locale === 'en' && degree && major
			? `${degree} in ${major}`
			: [degree, major].filter(Boolean).join(' ');
	return title || trim(e.institution);
}

function educationSentence(cv: CVDocument, locale: Locale): string {
	const e = latestEducation(cv);
	if (!e) return '';
	const p = LETTER_PHRASES[locale].education;
	const degree = trim(e.degree) ? displayDegree(trim(e.degree), locale) : '';
	const major = trim(e.major);
	const title =
		locale === 'en' && degree && major
			? `${degree} in ${major}`
			: [degree, major].filter(Boolean).join(' ');
	if (!title) return '';
	const institution = trim(e.institution);
	const student = e.dates.current && !isSchoolLevel(e.degree);
	const base = student ? p.student(title, institution) : p.graduate(title, institution);
	const gpa = trim(e.gpa)
		? p.gpa(
				scoreLabel(e.degree, locale),
				`${trim(e.gpa)}${trim(e.gpaScale) ? `/${trim(e.gpaScale)}` : ''}`
			)
		: '';
	return sentence(base + gpa);
}

function highlightSentences(cv: CVDocument, ref: LetterHighlightRef, locale: Locale): string[] {
	const p = LETTER_PHRASES[locale];
	switch (ref.section) {
		case 'experience': {
			const e = cv.experience.find((x) => x.id === ref.id);
			if (!e || !(trim(e.role) || trim(e.company))) return [];
			const verb = verbPhrase(e.bullets, locale);
			return [
				sentence(
					p.experience(
						trim(e.role) || trim(e.company),
						trim(e.role) ? trim(e.company) : '',
						e.type === 'internship'
					)
				),
				verb ? p.detail(verb) : ''
			];
		}
		case 'organizations': {
			const o = cv.organizations.find((x) => x.id === ref.id);
			if (!o || !(trim(o.role) || trim(o.name))) return [];
			const verb = verbPhrase(o.bullets, locale);
			return [
				sentence(p.organization(trim(o.role) || trim(o.name), trim(o.role) ? trim(o.name) : '')),
				verb ? p.detail(verb) : ''
			];
		}
		case 'projects': {
			const x = cv.projects.find((item) => item.id === ref.id);
			return x && trim(x.name) ? [p.project(trim(x.name), verbPhrase(x.bullets, locale))] : [];
		}
		case 'certifications': {
			const c = cv.certifications.find((x) => x.id === ref.id);
			return c && trim(c.name) ? [p.certification(trim(c.name), trim(c.issuer))] : [];
		}
		case 'awards': {
			const a = cv.awards.find((x) => x.id === ref.id);
			return a && trim(a.title) ? [p.award(trim(a.title), trim(a.issuer))] : [];
		}
		case 'skills': {
			const group = SKILL_GROUPS.find((g) => g === ref.id);
			if (!group) return [];
			const items = cv.skills[group].map(trim).filter(Boolean).slice(0, 5);
			return items.length ? [p.skills[group](joinList(items, locale))] : [];
		}
	}
}

const MISSING = {
	id: { position: '[posisi]', company: '[nama perusahaan]' },
	en: { position: '[position]', company: '[company name]' }
} as const;

/** Paragraph text written from the CV (before the user's or the AI's rewrite). */
export function autoParagraph(cv: CVDocument, letter: CoverLetter, key: LetterTextKey): string {
	const locale = letter.locale;
	const p = LETTER_PHRASES[locale];
	const position = trim(letter.position) || MISSING[locale].position;
	const company = trim(letter.company) || MISSING[locale].company;
	switch (key) {
		case 'opening':
			return p.opening(letter.source, trim(letter.sourceDetail), position, company);
		case 'qualifications':
			return [
				educationSentence(cv, locale),
				...letter.highlights.flatMap((ref) => highlightSentences(cv, ref, locale))
			]
				.filter(Boolean)
				.join(' ');
		case 'motivation':
			return [
				sentence(cleanText(trim(letter.motivation), LETTER_LIMITS.motivation)),
				letter.availability.immediate ? p.immediate : '',
				letter.availability.relocate ? p.relocate(company) : ''
			]
				.filter(Boolean)
				.join(' ');
		case 'closing':
			return p.closingParagraph(company);
	}
}

/** The runs to EDIT for a paragraph: the user's/AI's version, or the text written from the CV. */
export function letterBlockSource(
	cv: CVDocument,
	letter: CoverLetter,
	key: LetterTextKey
): RichRun[] {
	return letter.overrides[key] ?? richFromPlain(autoParagraph(cv, letter, key));
}

/** Foreign terms in italics for Indonesian letters (CV settings; the company stays upright). */
export function letterForeignMatcher(
	cv: CVDocument,
	letter: CoverLetter
): ForeignMatcher | undefined {
	return foreignMatcherForCv(cv, {
		locale: letter.locale,
		extraNames: [letter.company, letter.recipient, letter.sourceDetail].filter((n) => trim(n))
	});
}

// ---------------------------------------------------------------------------
// The letter model (what the template renders)
// ---------------------------------------------------------------------------

export type LetterBlock =
	| { key: LetterTextKey; kind: 'text'; runs: RichRun[]; auto: boolean }
	| {
			key: 'identity';
			kind: 'identity';
			intro: RichRun[];
			rows: { label: string; value: RichRun[] }[];
	  }
	| { key: 'attachments'; kind: 'list'; intro: RichRun[]; items: RichRun[][] }
	/** Contact sentence (Indonesian letters without the identity table). Not editable. */
	| { key: 'contact'; kind: 'note'; runs: RichRun[] };

export interface LetterModel {
	id: string;
	locale: Locale;
	/** As typed ('' when missing). */
	position: string;
	company: string;
	style: LetterStyle;
	/** English letters: name, city, phone, email at the top. [] in Indonesian. */
	sender: string[];
	/** "Malang, 16 November 2026" / "November 16, 2026". Right-aligned in Indonesian letters. */
	dateLine: string;
	/** Lampiran / Perihal (Indonesian only). */
	meta: { label: string; value: RichRun[] }[];
	recipient: string[];
	salutation: string;
	blocks: LetterBlock[];
	closing: string;
	signatureName: string;
	/** Contact lines under the name in an email (not printed on the letter). */
	contact: string[];
	wordCount: number;
	/** Estimated pages (1 = exactly one A4 page). Above 1 → warn. */
	pageEstimate: number;
}

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
/** '2026-11-16' → '16 November 2026' / 'November 16, 2026'. */
export function formatLetterDate(value: string | undefined, locale: Locale): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
	if (!match) return '';
	let formatter = dateFormatters.get(locale);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
		dateFormatters.set(locale, formatter);
	}
	return formatter.format(
		new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
	);
}

/** Average character width (incl. spaces) in em, per font. */
const CHAR_WIDTH: Record<LetterFont, number> = {
	times: 0.42,
	arial: 0.48,
	calibri: 0.44,
	georgia: 0.47
};
/** Space between blocks, in lines (the template's paragraph gap). */
const GAP = 0.8;

function estimatePages(model: Omit<LetterModel, 'pageEstimate' | 'wordCount'>): number {
	const { size, lineHeight, font } = model.style;
	const widthPt = (210 - 50) * 2.835;
	const heightPt = (297 - 50) * 2.835;
	const perLine = Math.max(20, Math.floor(widthPt / (size * CHAR_WIDTH[font])));
	// CSS line-height (the print page) is a plain multiple of the font size; Word adds a little.
	const linePt = size * lineHeight * 1.08;
	const lines = (text: string) => Math.max(1, Math.ceil(text.length / perLine));
	let total = 0;
	if (model.sender.length) total += model.sender.length + GAP;
	total += 1 + GAP; // date
	if (model.meta.length) total += model.meta.length + GAP;
	total += model.recipient.length + GAP;
	total += 1 + GAP; // salutation
	for (const block of model.blocks) {
		if (block.kind === 'text' || block.kind === 'note')
			total += lines(richToPlain(block.runs)) + GAP;
		else if (block.kind === 'identity')
			total += lines(richToPlain(block.intro)) + block.rows.length + GAP;
		else
			total +=
				lines(richToPlain(block.intro)) +
				block.items.reduce((n, item) => n + lines(richToPlain(item)), 0) +
				GAP;
	}
	total += 1 + 3 + 1; // closing, signature space, name
	return Math.round(((total * linePt) / heightPt) * 100) / 100;
}

/** Pure and fast: safe inside `$derived`. Every text is plain; formatting is in the runs. */
export function toLetterModel(cv: CVDocument, letter: CoverLetter): LetterModel {
	const locale = letter.locale;
	const p = LETTER_PHRASES[locale];
	const matcher = letterForeignMatcher(cv, letter);
	const runs = (text: string) => resolveRuns(richFromPlain(text), matcher);
	const name = trim(cv.personal.fullName);
	const phone = trim(cv.personal.phone);
	const email = trim(cv.personal.email);
	const city = [trim(cv.personal.city), trim(cv.personal.province)].filter(Boolean).join(', ');
	const company = trim(letter.company);
	const recipient = trim(letter.recipient) || p.defaultRecipient;
	const address = letter.companyAddress.split('\n').map(trim).filter(Boolean);
	const date = formatLetterDate(letter.date, locale);

	const blocks: LetterBlock[] = [];
	const text = (key: LetterTextKey) => {
		const override = letter.overrides[key];
		if (override)
			blocks.push({ key, kind: 'text', runs: resolveRuns(override, matcher), auto: false });
		else {
			const auto = autoParagraph(cv, letter, key);
			if (auto) blocks.push({ key, kind: 'text', runs: runs(auto), auto: true });
		}
	};

	text('opening');
	const identity = locale === 'id' && letter.includeIdentity;
	if (identity) {
		const birth = [
			trim(letter.identity.birthPlace),
			formatLetterDate(letter.identity.birthDate, locale)
		]
			.filter(Boolean)
			.join(', ');
		const education = (() => {
			const e = latestEducation(cv);
			return e ? [educationText(cv, locale), trim(e.institution)].filter(Boolean).join(', ') : '';
		})();
		const rows = (
			[
				[p.identity.name, name],
				[p.identity.birth, birth],
				[p.identity.education, education],
				[p.identity.address, trim(letter.identity.address) || city],
				[p.identity.phone, phone],
				[p.identity.email, email]
			] as const
		)
			.filter(([, value]) => value)
			.map(([label, value]) => ({ label, value: runs(value) }));
		if (rows.length)
			blocks.push({ key: 'identity', kind: 'identity', intro: runs(p.identityIntro), rows });
	}
	text('qualifications');
	text('motivation');
	const attachments = [
		...letter.attachments.map((a) => p.attachments[a]),
		...letter.otherAttachments.map(trim).filter(Boolean)
	];
	if (attachments.length)
		blocks.push({
			key: 'attachments',
			kind: 'list',
			intro: runs(p.attachmentsIntro),
			items: attachments.map((item) => runs(item))
		});
	if (locale === 'id' && !identity && (phone || email))
		blocks.push({ key: 'contact', kind: 'note', runs: runs(p.contact(phone, email)) });
	text('closing');

	const position = trim(letter.position) || MISSING[locale].position;
	const base = {
		id: letter.id,
		locale,
		position: trim(letter.position),
		company,
		style: { ...letter.style },
		sender: locale === 'en' ? [name, city, phone, email].filter(Boolean) : [],
		dateLine: locale === 'id' ? [trim(letter.place), date].filter(Boolean).join(', ') : date,
		meta:
			locale === 'id'
				? [
						{ label: p.attachmentLabel, value: runs(p.attachmentCount(attachments.length)) },
						{ label: p.subjectLabel, value: runs(p.subject(position)) }
					]
				: [],
		recipient: (locale === 'id'
			? [p.to, recipient, company, ...address, ...(address.length ? [] : [p.noAddress])]
			: [recipient, company, ...address]
		).filter(Boolean),
		salutation: p.salutation(recipient),
		blocks,
		closing: p.closing,
		signatureName: name,
		contact: [phone, email].filter(Boolean)
	};
	const words = blocks
		.flatMap((b) =>
			b.kind === 'identity'
				? [b.intro, ...b.rows.map((r) => r.value)]
				: b.kind === 'list'
					? [b.intro, ...b.items]
					: [b.runs]
		)
		.map(richToPlain)
		.join(' ')
		.split(/\s+/)
		.filter(Boolean).length;
	return { ...base, wordCount: words, pageEstimate: estimatePages(base) };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export const LETTER_CHECK_IDS = [
	'positionMissing',
	'companyMissing',
	'nameMissing',
	'contactMissing',
	'cvIncomplete',
	'noHighlights',
	'motivationMissing',
	'motivationGeneric',
	'identityIncomplete',
	'placeholder',
	'tooLong',
	'dateOld'
] as const;
export type LetterCheckId = (typeof LETTER_CHECK_IDS)[number];

/** Where to send the user to fix it: a letter field, a paragraph, or the CV. */
export type LetterField =
	| 'position'
	| 'company'
	| 'highlights'
	| 'motivation'
	| 'identity'
	| 'date'
	| 'style'
	| LetterTextKey
	| 'cv.personal'
	| 'cv';

export interface LetterCheck {
	id: LetterCheckId;
	/** 'error' blocks the download; 'warn' does not. */
	level: 'error' | 'warn';
	messageKey: `letter.checks.${LetterCheckId}`;
	field: LetterField;
}

const DAY_MS = 86_400_000;

function companyWords(company: string): string[] {
	return company
		.toLowerCase()
		.replace(/\b(?:pt|cv|tbk|persero|ltd|inc|corp|co)\b\.?/g, ' ')
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length >= 3);
}

/** Errors first, then warnings. Pure. */
export function checkLetter(
	cv: CVDocument,
	letter: CoverLetter,
	now: Date = new Date()
): LetterCheck[] {
	const out: LetterCheck[] = [];
	const add = (id: LetterCheckId, level: LetterCheck['level'], field: LetterField) =>
		out.push({ id, level, messageKey: `letter.checks.${id}`, field });

	if (!trim(letter.position)) add('positionMissing', 'error', 'position');
	if (!trim(letter.company)) add('companyMissing', 'error', 'company');
	if (!trim(cv.personal.fullName)) add('nameMissing', 'error', 'cv.personal');

	if (!trim(cv.personal.phone) && !trim(cv.personal.email))
		add('contactMissing', 'warn', 'cv.personal');
	const background =
		cv.education.length + cv.experience.length + cv.organizations.length + cv.projects.length;
	if (!background) add('cvIncomplete', 'warn', 'cv');
	if (!letter.highlights.length && !letter.overrides.qualifications)
		add('noHighlights', 'warn', 'highlights');
	const motivation = trim(letter.motivation);
	if (!motivation && !letter.overrides.motivation) add('motivationMissing', 'warn', 'motivation');
	else if (motivation && !letter.overrides.motivation && trim(letter.company)) {
		const words = companyWords(letter.company);
		const lower = motivation.toLowerCase();
		if (words.length && !words.some((w) => lower.includes(w)))
			add('motivationGeneric', 'warn', 'motivation');
	}
	if (
		letter.locale === 'id' &&
		letter.includeIdentity &&
		(!trim(letter.identity.birthPlace) ||
			!letter.identity.birthDate ||
			!trim(letter.identity.address))
	)
		add('identityIncomplete', 'warn', 'identity');
	const placeholder = LETTER_TEXT_KEYS.find((key) => {
		const runs = letter.overrides[key];
		return runs && /\[[^\]]{1,60}\]/.test(richToPlain(runs));
	});
	if (placeholder) add('placeholder', 'warn', placeholder);
	if (toLetterModel(cv, letter).pageEstimate > 1) add('tooLong', 'warn', 'style');
	const written = Date.parse(`${letter.date}T00:00:00`);
	if (Number.isFinite(written) && now.getTime() - written > 30 * DAY_MS)
		add('dateOld', 'warn', 'date');

	return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

// ---------------------------------------------------------------------------
// "Bertele-tele?" for the letter
// ---------------------------------------------------------------------------

/** i18n key of a wordiness reason, worded for letter paragraphs. */
export function letterConciseMessageKey(
	issue: ConciseIssue
): `letter.concise.issues.${ConciseIssue}` {
	return `letter.concise.issues.${issue}`;
}

/**
 * How wordy each paragraph is (on the device, instant). Points: one per text paragraph, `key` = the
 * paragraph key (opening, qualifications, motivation, closing), `kind` 'summary' (paragraph limits).
 * Free AI check: `aiConciseInput(report, locale)` → `aiClient.concise` → `mergeConciseAi` (core/ats).
 */
export function conciseFromLetter(model: LetterModel): ConciseReport {
	const points: ConcisePoint[] = [];
	for (const block of model.blocks) {
		if (block.kind !== 'text') continue;
		const text = richToPlain(block.runs).trim();
		if (!text) continue;
		points.push({
			key: block.key,
			kind: 'summary',
			text,
			item: block.key,
			...rateConcise(text, 'summary')
		});
	}
	const score = points.length
		? Math.round(points.reduce((sum, point) => sum + point.score, 0) / points.length)
		: undefined;
	return { score, points, wordy: points.filter((p) => p.level !== 'ok').length, ai: false };
}

/** Patch that puts the AI's shorter version of a paragraph in place (one `updateLetter`). */
export function applyShorter(point: Pick<ConcisePoint, 'key' | 'shorter'>): LetterPatch {
	const key = LETTER_TEXT_KEYS.find((k) => k === point.key);
	if (!key || !point.shorter) return {};
	return { overrides: { [key]: richFromPlain(cleanText(point.shorter, LETTER_LIMITS.paragraph)) } };
}

// ---------------------------------------------------------------------------
// AI: "Tulis dengan AI"
// ---------------------------------------------------------------------------

function highlightText(cv: CVDocument, ref: LetterHighlightRef): string {
	const clip = (value: string) => trim(value).slice(0, AI_LETTER_LIMITS.highlight);
	const bullets = (items: readonly string[]) =>
		items.map(trim).filter(Boolean).slice(0, 3).join('; ');
	const item = (title: string, details: string) =>
		clip([title, details].filter(Boolean).join(': '));
	switch (ref.section) {
		case 'experience': {
			const e = cv.experience.find((x) => x.id === ref.id);
			return e
				? item([e.role, e.company].map(trim).filter(Boolean).join(' — '), bullets(e.bullets))
				: '';
		}
		case 'organizations': {
			const o = cv.organizations.find((x) => x.id === ref.id);
			return o
				? item([o.role, o.name].map(trim).filter(Boolean).join(' — '), bullets(o.bullets))
				: '';
		}
		case 'projects': {
			const x = cv.projects.find((p) => p.id === ref.id);
			return x
				? item([x.name, x.role ?? ''].map(trim).filter(Boolean).join(' — '), bullets(x.bullets))
				: '';
		}
		case 'certifications': {
			const c = cv.certifications.find((x) => x.id === ref.id);
			return c ? clip([c.name, c.issuer].map(trim).filter(Boolean).join(' — ')) : '';
		}
		case 'awards': {
			const a = cv.awards.find((x) => x.id === ref.id);
			return a ? clip([a.title, a.issuer].map(trim).filter(Boolean).join(' — ')) : '';
		}
		case 'skills': {
			const group = SKILL_GROUPS.find((g) => g === ref.id);
			return group ? clip(cv.skills[group].map(trim).filter(Boolean).slice(0, 10).join(', ')) : '';
		}
	}
}

/** True when the AI has enough to write (position and company filled). */
export function aiCanWriteLetter(letter: CoverLetter): boolean {
	return Boolean(trim(letter.position) && trim(letter.company));
}

/**
 * What "Tulis dengan AI" sends — show exactly this in the consent dialog. Never: the name, contact
 * details, address, birth date, the person who recommended, or the company address.
 */
export function aiLetterInput(cv: CVDocument, letter: CoverLetter, jobPost = ''): AiLetterInput {
	const clean = (value: string, max: number) => redactContacts(trim(value)).slice(0, max).trim();
	return {
		locale: letter.locale,
		// Same normalisation as the client (`aiClient.letter`): the consent preview = what is sent.
		position: oneLine(letter.position).slice(0, LIMITS.title).trim(),
		company: oneLine(letter.company).slice(0, LIMITS.title).trim(),
		source: letter.source ?? '',
		highlights: letter.highlights
			.map((ref) =>
				conciseSendText('summary', highlightText(cv, ref)).slice(0, AI_LETTER_LIMITS.highlight)
			)
			.filter(Boolean)
			.slice(0, AI_LETTER_LIMITS.highlights),
		motivation: clean(letter.motivation, AI_LETTER_LIMITS.motivation),
		availability: { ...letter.availability },
		profile: { ...aiProfileFromCv(cv), locale: letter.locale },
		jobPost: clean(jobPost, AI_LETTER_LIMITS.jobPost)
	};
}

/** Patch that applies the AI's paragraphs (all, or only `keys`); empty answers are skipped. */
export function applyAiLetter(
	result: LetterResult,
	keys: readonly LetterTextKey[] = LETTER_TEXT_KEYS
): LetterPatch {
	const overrides: Partial<Record<LetterTextKey, RichRun[]>> = {};
	for (const key of keys) {
		const text = cleanText(trim(result[key]), LETTER_LIMITS.paragraph);
		if (text) overrides[key] = richFromPlain(text);
	}
	return { overrides };
}
