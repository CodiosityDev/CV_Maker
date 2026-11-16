/**
 * Foreign terms in italics for Indonesian CVs and cover letters (PUEBI: istilah asing ditulis miring;
 * nama diri — companies, schools, products, technologies — tidak).
 *
 * The CV stays PLAIN TEXT: italics are worked out when the CV is shown, printed or exported.
 *
 *   const model = toRenderModel(cv);                    // model.foreign: matcher | undefined
 *   {#each foreignParts(text, model.foreign) as part}   // in a template (ForeignText component)
 *     {#if part.italic}<em>{part.text}</em>{:else}{part.text}{/if}
 *   {/each}
 *
 *   detectForeignTerms(cv);                              // [{ term: 'teamwork', count: 2, source: 'auto' }]
 *   store.update((d) => ignoreForeignTerm(d, 'teamwork')); // keep it upright
 *   store.update((d) => addForeignTerm(d, 'onboarding'));  // always italic
 *   store.update((d) => setForeignEnabled(d, false));      // switch off for this CV
 *
 * How a word is judged: a curated list of CV vocabulary (words.ts), not a full dictionary. Absorbed
 * words with Indonesian spelling (data, media, senior) count only inside an English phrase;
 * acronyms (HRD, UI/UX) are never italic; names written in the CV (company, school, organisation,
 * project, certificate, issuer, language) and brand phrases ("Google …") stay upright. Users fix
 * the rest with `ignoreForeignTerm` / `addForeignTerm`.
 */
import { CV_LABELS } from '../render/labels';
import { FOREIGN_LIMITS } from '../schema/limits';
import type { CVDocument, CVForeign } from '../schema/types';
import { BRAND_WORDS, FOREIGN_WORDS, FUNCTION_WORDS, HOMOGRAPHS, ID_PREFIX } from './words';

export interface ForeignPart {
	text: string;
	italic: boolean;
}

/** Built once per CV/letter (`foreignMatcherForCv`); pass it to `foreignParts`. */
export interface ForeignMatcher {
	/** Phrases (lowercase tokens) that stay upright: names in the CV + the user's ignore list. */
	readonly upright: readonly (readonly string[])[];
	/** Phrases the user wants in italics. */
	readonly extra: readonly (readonly string[])[];
}

interface Token {
	start: number;
	end: number;
	lower: string;
	capital: boolean;
	/** Italic part when only a piece of the token is foreign ("di-follow" → "follow"). */
	sub?: { start: number; end: number };
}

type Kind = 'foreign' | 'homograph' | 'function' | 'none';

const TOKEN = /&|[\p{L}][\p{L}\p{M}\p{N}'’]*(?:-[\p{L}\p{M}\p{N}'’]+)*/gu;
/** Text between two tokens of one phrase: spaces, or a slash ("UI/UX", "Sales / Marketing"). */
const JOINABLE = /^(?:[ \t]+|[ \t]*\/[ \t]*)$/;
const ACRONYM = /^[\p{Lu}\p{N}]{2,6}$/u;

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	for (const match of text.matchAll(TOKEN)) {
		const raw = match[0];
		tokens.push({
			start: match.index,
			end: match.index + raw.length,
			lower: raw.toLowerCase().replace(/’/g, "'"),
			capital: /^\p{Lu}/u.test(raw)
		});
	}
	return tokens;
}

/** Lowercase tokens of a phrase, for matching. */
function phraseTokens(phrase: string): string[] {
	return tokenize(phrase).map((token) => token.lower);
}

function inList(word: string, set: ReadonlySet<string>): boolean {
	if (set.has(word)) return true;
	const bare = word.replace(/'s$/, '');
	if (bare !== word && set.has(bare)) return true;
	// Plurals: "skills", "activities" are not all listed.
	if (word.length > 3 && word.endsWith('s') && set.has(word.slice(0, -1))) return true;
	return word.length > 4 && word.endsWith('ies') && set.has(`${word.slice(0, -3)}y`);
}

function baseKind(token: Token, raw: string): Kind {
	if (token.lower === '&') return 'function';
	if (ACRONYM.test(raw)) return 'none';
	if (FUNCTION_WORDS.has(token.lower)) return 'function';
	if (inList(token.lower, FOREIGN_WORDS)) return 'foreign';
	if (token.lower.includes('-')) {
		const prefixed = ID_PREFIX.exec(token.lower);
		if (prefixed) {
			const rest = prefixed[2] as string;
			if (inList(rest, FOREIGN_WORDS) || inList(rest, HOMOGRAPHS)) {
				token.sub = { start: token.end - rest.length, end: token.end };
				return 'none';
			}
		}
		const parts = token.lower.split('-');
		if (
			parts.every((part) => inList(part, FOREIGN_WORDS) || inList(part, HOMOGRAPHS)) &&
			parts.some((part) => inList(part, FOREIGN_WORDS))
		)
			return 'foreign';
	}
	if (inList(token.lower, HOMOGRAPHS)) return 'homograph';
	return 'none';
}

/** Marks every occurrence of the phrases in `tokens` (lowercase token sequences). */
function markPhrases(
	tokens: Token[],
	phrases: readonly (readonly string[])[],
	mark: (index: number) => void
): void {
	for (const phrase of phrases) {
		if (!phrase.length || phrase.length > tokens.length) continue;
		for (let i = 0; i + phrase.length <= tokens.length; i++) {
			let same = true;
			for (let j = 0; j < phrase.length && same; j++) same = tokens[i + j]?.lower === phrase[j];
			if (same) for (let j = 0; j < phrase.length; j++) mark(i + j);
		}
	}
}

/**
 * Splits `text` into upright and italic parts. Joining the parts gives back `text` exactly (no
 * characters added or removed — extracted PDF text stays the same). Without a matcher: one part.
 */
export function foreignParts(text: string, matcher?: ForeignMatcher): ForeignPart[] {
	if (!matcher || !text) return text ? [{ text, italic: false }] : [];
	const tokens = tokenize(text);
	if (!tokens.length) return [{ text, italic: false }];

	const kinds: Kind[] = tokens.map((token) => baseKind(token, text.slice(token.start, token.end)));
	const forced: (boolean | undefined)[] = tokens.map(() => undefined);
	const joined = (a: number, b: number): boolean => {
		const left = tokens[a];
		const right = tokens[b];
		return Boolean(left && right && JOINABLE.test(text.slice(left.end, right.start)));
	};

	// Brand phrases: the whole run of Capitalised Words around a brand word is a name.
	tokens.forEach((token, i) => {
		if (!token.capital || !BRAND_WORDS.has(token.lower)) return;
		forced[i] = false;
		for (let j = i - 1; j >= 0 && joined(j, j + 1); j--) {
			const t = tokens[j] as Token;
			if (!t.capital && !FUNCTION_WORDS.has(t.lower)) break;
			forced[j] = false;
		}
		for (let j = i + 1; j < tokens.length && joined(j - 1, j); j++) {
			const t = tokens[j] as Token;
			if (!t.capital && !FUNCTION_WORDS.has(t.lower)) break;
			forced[j] = false;
		}
	});
	markPhrases(tokens, matcher.extra, (i) => (forced[i] = true));
	markPhrases(tokens, matcher.upright, (i) => (forced[i] = false));

	// Absorbed words join a neighbouring foreign word, in a chain ("Junior Data Analyst");
	// little words need a foreign word on each side.
	const withHomographs = kinds.map((kind, i) => (forced[i] ?? kind === 'foreign') === true);
	for (let changed = true; changed;) {
		changed = false;
		kinds.forEach((kind, i) => {
			if (withHomographs[i] || kind !== 'homograph' || forced[i] !== undefined) return;
			if (
				(i > 0 && withHomographs[i - 1] && joined(i - 1, i)) ||
				(i + 1 < tokens.length && withHomographs[i + 1] && joined(i, i + 1))
			) {
				withHomographs[i] = true;
				changed = true;
			}
		});
	}
	const italic = kinds.map(
		(kind, i) =>
			withHomographs[i] ||
			(kind === 'function' &&
				forced[i] === undefined &&
				i > 0 &&
				i + 1 < tokens.length &&
				withHomographs[i - 1] &&
				withHomographs[i + 1] &&
				joined(i - 1, i) &&
				joined(i, i + 1))
	);

	// Italic ranges: neighbouring italic tokens form one range (the space between included).
	const ranges: { start: number; end: number }[] = [];
	tokens.forEach((token, i) => {
		const range = italic[i]
			? { start: token.start, end: token.end }
			: token.sub && forced[i] !== false
				? token.sub
				: undefined;
		if (!range) return;
		const last = ranges[ranges.length - 1];
		if (last && italic[i] && i > 0 && italic[i - 1] && joined(i - 1, i)) last.end = range.end;
		else ranges.push({ ...range });
	});

	const parts: ForeignPart[] = [];
	let at = 0;
	for (const range of ranges) {
		if (range.start > at) parts.push({ text: text.slice(at, range.start), italic: false });
		parts.push({ text: text.slice(range.start, range.end), italic: true });
		at = range.end;
	}
	if (at < text.length) parts.push({ text: text.slice(at), italic: false });
	return parts;
}

/** True when some part of `text` would be italic. */
export function hasForeign(text: string, matcher?: ForeignMatcher): boolean {
	return foreignParts(text, matcher).some((part) => part.italic);
}

/** A matcher from names that stay upright and the user's own lists. */
export function createForeignMatcher(
	options: { names?: readonly string[]; extra?: readonly string[]; ignore?: readonly string[] } = {}
): ForeignMatcher {
	const phrases = (items: readonly string[] = []) => {
		const seen = new Set<string>();
		const out: string[][] = [];
		for (const item of items) {
			const tokens = phraseTokens(item);
			const key = tokens.join(' ');
			if (tokens.length && !seen.has(key)) {
				seen.add(key);
				out.push(tokens);
			}
		}
		return out;
	};
	return {
		upright: phrases([...(options.names ?? []), ...(options.ignore ?? [])]),
		extra: phrases(options.extra)
	};
}

/** Names written in the CV: they are proper names, never italic. */
export function cvProperNames(cv: CVDocument): string[] {
	return [
		cv.personal.fullName,
		...cv.education.map((e) => e.institution),
		...cv.experience.map((e) => e.company),
		...cv.organizations.map((o) => o.name),
		...cv.projects.map((p) => p.name),
		...cv.certifications.flatMap((c) => [c.name, c.issuer]),
		...cv.awards.map((a) => a.issuer),
		...cv.languages.map((l) => l.name)
	].filter((name) => name.trim().length > 0);
}

/** The CV's settings with defaults (on, no custom terms). */
export function foreignSettings(cv: Pick<CVDocument, 'foreign'>): CVForeign {
	return cv.foreign ?? { enabled: true, extra: [], ignore: [] };
}

/**
 * The matcher for a CV, or `undefined` when nothing should be italic (English CV, or switched off).
 * `extraNames`: more proper names (a cover letter's company and recipient).
 */
export function foreignMatcherForCv(
	cv: CVDocument,
	options: { locale?: CVDocument['locale']; extraNames?: readonly string[] } = {}
): ForeignMatcher | undefined {
	const settings = foreignSettings(cv);
	if ((options.locale ?? cv.locale) !== 'id' || !settings.enabled) return undefined;
	return createForeignMatcher({
		names: [...cvProperNames(cv), ...(options.extraNames ?? [])],
		extra: settings.extra,
		ignore: settings.ignore
	});
}

/**
 * CV texts that are shown with italics — the same fields the templates wrap with `foreignParts`,
 * including the labels the renderer adds (experience type "Freelance", skill group "Soft Skills",
 * thesis line, language level). Names stay upright through the matcher anyway.
 */
function cvTexts(cv: CVDocument): string[] {
	const labels = CV_LABELS[cv.locale];
	const out: string[] = [cv.personal.headline, cv.summary];
	for (const e of cv.education) out.push(e.major, e.thesisTitle ?? '', ...e.highlights);
	for (const e of cv.experience)
		out.push(e.role, e.type === 'fulltime' ? '' : labels.experienceType[e.type], ...e.bullets);
	for (const o of cv.organizations) out.push(o.role, ...o.bullets);
	for (const p of cv.projects) out.push(p.role ?? '', ...p.bullets);
	for (const a of cv.awards) out.push(a.title, a.description ?? '');
	for (const l of cv.languages) out.push(labels.languageLevel[l.level], l.score ?? '');
	for (const group of ['hard', 'soft', 'tools'] as const)
		if (cv.skills[group].some((item) => item.trim()))
			out.push(labels.skillGroups[group], ...cv.skills[group]);
	for (const s of cv.custom)
		for (const i of s.items) out.push(i.title, i.subtitle ?? '', ...i.bullets);
	return out.filter((text) => text.trim().length > 0);
}

export interface DetectedTerm {
	/** Lowercase, as matched ("web developer"). */
	term: string;
	/** Times it appears in the CV (0 for an added term that is not used yet). */
	count: number;
	source: 'auto' | 'extra';
}

/** Italic terms in the CV right now (most frequent first), for the "Istilah asing" panel. */
export function detectForeignTerms(cv: CVDocument): DetectedTerm[] {
	const matcher = foreignMatcherForCv(cv, { locale: 'id' });
	const settings = foreignSettings(cv);
	if (!matcher) return [];
	const extra = new Set(settings.extra);
	const counts = new Map<string, number>();
	for (const text of cvTexts(cv))
		for (const part of foreignParts(text, matcher))
			if (part.italic) {
				const term = normalizeTerm(part.text);
				if (term) counts.set(term, (counts.get(term) ?? 0) + 1);
			}
	for (const term of extra) if (!counts.has(term)) counts.set(term, 0);
	return [...counts]
		.map(([term, count]) => ({
			term,
			count,
			source: extra.has(term) ? ('extra' as const) : ('auto' as const)
		}))
		.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

/** Lowercase, single spaces, trimmed, capped. '' = not a term. */
export function normalizeTerm(term: string): string {
	return term.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, FOREIGN_LIMITS.term).trim();
}

function edit(draft: CVDocument, change: (settings: CVForeign) => void): void {
	const settings = foreignSettings(draft);
	const next: CVForeign = {
		enabled: settings.enabled,
		extra: [...settings.extra],
		ignore: [...settings.ignore]
	};
	change(next);
	next.extra = next.extra.slice(0, FOREIGN_LIMITS.terms);
	next.ignore = next.ignore.slice(0, FOREIGN_LIMITS.terms);
	draft.foreign = next;
}

/** Switch automatic italics on/off for this CV (inside `store.update`). */
export function setForeignEnabled(draft: CVDocument, enabled: boolean): void {
	edit(draft, (s) => (s.enabled = enabled));
}

/** Always italicise `term` in this CV. */
export function addForeignTerm(draft: CVDocument, term: string): void {
	const key = normalizeTerm(term);
	if (!key) return;
	edit(draft, (s) => {
		s.ignore = s.ignore.filter((t) => t !== key);
		if (!s.extra.includes(key)) s.extra.push(key);
	});
}

/** Keep `term` upright in this CV. */
export function ignoreForeignTerm(draft: CVDocument, term: string): void {
	const key = normalizeTerm(term);
	if (!key) return;
	edit(draft, (s) => {
		s.extra = s.extra.filter((t) => t !== key);
		if (!s.ignore.includes(key)) s.ignore.push(key);
	});
}

/** Back to automatic for `term` (removes it from both lists). */
export function restoreForeignTerm(draft: CVDocument, term: string): void {
	const key = normalizeTerm(term);
	edit(draft, (s) => {
		s.extra = s.extra.filter((t) => t !== key);
		s.ignore = s.ignore.filter((t) => t !== key);
	});
}
