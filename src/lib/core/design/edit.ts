/**
 * Inline editing on the CV page (visual editor): click a text on the paper and type.
 *
 * The page is built with `toRenderModel(cv, { photoUrl, editing: true })`, which keeps blank
 * bullets so a new bullet can be typed into. Templates mark each editable text with
 * `data-edit={editKey(target)}` (only when `model.editing`); the editor reads that attribute back with
 * `parseEditKey()` and writes through the store:
 *
 *   const target = parseEditKey(element.dataset.edit);           // undefined = not editable
 *   if (target && canEditInline(store.cv, target))
 *     store.update((d) => applyInline(d, target, element.textContent ?? ''),
 *                  { coalesceKey: inlineCoalesceKey(target) });
 *   Limit typing to `inlineLimit(target)`; allow Enter only where `inlineMultiline(target)`.
 *   Enter in a bullet:      store.update((d) => { next = insertBulletAfter(d, section, id, index); });
 *   Backspace on empty one: store.update((d) => removeBullet(d, section, id, index));
 *
 * Everything stays PLAIN TEXT (never HTML): values are cleaned and clipped to the field's limit.
 * Texts that are composed from several fields (e.g. "S1 Ilmu Komputer", "Inggris · Fasih") and
 * dates are not inline-editable: `canEditInline` returns false and the UI opens the form instead.
 */
import { renameSection } from '../layout/index';
import { CUSTOM_SECTION_KEY_PATTERN, ID_PATTERN } from '../schema/ids';
import { LIMITS } from '../schema/limits';
import { cleanText } from '../schema/schema';
import {
	BUILTIN_SECTION_KEYS,
	type BuiltinSectionKey,
	type CVDocument,
	type SectionKey
} from '../schema/types';

export type InlineEntryField = 'title' | 'subtitle' | 'location' | 'description';

export type EditTarget =
	| { kind: 'personal'; field: 'fullName' | 'headline' }
	| { kind: 'summary' }
	| { kind: 'sectionTitle'; section: SectionKey }
	| { kind: 'entry'; section: SectionKey; id: string; field: InlineEntryField }
	/** `index` = position in the item's bullet list (the editing model keeps blank bullets). */
	| { kind: 'bullet'; section: SectionKey; id: string; index: number };

type EntrySection = Exclude<BuiltinSectionKey, 'summary' | 'skills'> | 'custom';

/** Data field behind each rendered text (see `render/index.ts`). Missing = composed / not editable. */
const ENTRY_FIELDS: Record<
	EntrySection,
	Partial<Record<InlineEntryField, { field: string; max: number; optional?: true }>>
> = {
	education: { title: { field: 'institution', max: LIMITS.title } },
	experience: {
		title: { field: 'role', max: LIMITS.title },
		subtitle: { field: 'company', max: LIMITS.title },
		location: { field: 'location', max: LIMITS.short, optional: true }
	},
	organizations: {
		title: { field: 'role', max: LIMITS.title },
		subtitle: { field: 'name', max: LIMITS.title }
	},
	projects: {
		title: { field: 'name', max: LIMITS.title },
		subtitle: { field: 'role', max: LIMITS.title, optional: true }
	},
	languages: { title: { field: 'name', max: LIMITS.short } },
	certifications: {
		title: { field: 'name', max: LIMITS.title },
		subtitle: { field: 'issuer', max: LIMITS.title }
	},
	awards: {
		title: { field: 'title', max: LIMITS.title },
		subtitle: { field: 'issuer', max: LIMITS.title },
		description: { field: 'description', max: LIMITS.description, optional: true }
	},
	custom: {
		title: { field: 'title', max: LIMITS.title },
		subtitle: { field: 'subtitle', max: LIMITS.title, optional: true }
	}
};

/** Bullet list field per section; sections without bullets are absent. */
const BULLET_FIELD: Partial<Record<EntrySection, string>> = {
	education: 'highlights',
	experience: 'bullets',
	organizations: 'bullets',
	projects: 'bullets',
	custom: 'bullets'
};

const ENTRY_FIELD_NAMES: readonly InlineEntryField[] = [
	'title',
	'subtitle',
	'location',
	'description'
];

const isCustomKey = (key: string): boolean => CUSTOM_SECTION_KEY_PATTERN.test(key);
const isSectionKey = (key: string): key is SectionKey =>
	(BUILTIN_SECTION_KEYS as readonly string[]).includes(key) || isCustomKey(key);

function entrySection(section: SectionKey): EntrySection | undefined {
	if (isCustomKey(section)) return 'custom';
	return section === 'summary' || section === 'skills' ? undefined : (section as EntrySection);
}

type Item = Record<string, unknown>;

function findItem(cv: CVDocument, section: SectionKey, id: string): Item | undefined {
	const kind = entrySection(section);
	if (!kind) return undefined;
	const list: readonly object[] =
		kind === 'custom'
			? (cv.custom.find((s) => s.key === section)?.items ?? [])
			: (cv[kind] as readonly object[]);
	return list.find((item) => (item as { id?: unknown }).id === id) as Item | undefined;
}

function bulletList(cv: CVDocument, section: SectionKey, id: string): string[] | undefined {
	const kind = entrySection(section);
	const field = kind && BULLET_FIELD[kind];
	const list = field ? findItem(cv, section, id)?.[field] : undefined;
	return Array.isArray(list) ? (list as string[]) : undefined;
}

/** Single-line text: newlines become spaces. */
const oneLine = (value: string, max: number) =>
	cleanText(value.replace(/\s*[\r\n]+\s*/g, ' '), max);

/** Stable string for `data-edit`. Sections keys and ids never contain '|'. */
export function editKey(target: EditTarget): string {
	switch (target.kind) {
		case 'personal':
			return `p|${target.field}`;
		case 'summary':
			return 'summary';
		case 'sectionTitle':
			return `t|${target.section}`;
		case 'entry':
			return `e|${target.section}|${target.id}|${target.field}`;
		case 'bullet':
			return `b|${target.section}|${target.id}|${target.index}`;
	}
}

/** Reverse of `editKey`; anything malformed → undefined. */
export function parseEditKey(key: string | null | undefined): EditTarget | undefined {
	if (typeof key !== 'string' || key.length > 200) return undefined;
	const [kind, a, b, c, ...extra] = key.split('|');
	if (extra.length) return undefined;
	if (kind === 'summary' && a === undefined) return { kind: 'summary' };
	if (kind === 'p' && (a === 'fullName' || a === 'headline') && b === undefined)
		return { kind: 'personal', field: a };
	if (!a || !isSectionKey(a)) return undefined;
	if (kind === 't' && b === undefined) return { kind: 'sectionTitle', section: a };
	if (!b || !ID_PATTERN.test(b) || c === undefined) return undefined;
	if (kind === 'e' && (ENTRY_FIELD_NAMES as readonly string[]).includes(c))
		return { kind: 'entry', section: a, id: b, field: c as InlineEntryField };
	if (kind === 'b' && /^\d{1,2}$/.test(c))
		return { kind: 'bullet', section: a, id: b, index: Number(c) };
	return undefined;
}

/** Maximum length for the target (use as the editor's limit). */
export function inlineLimit(target: EditTarget): number {
	switch (target.kind) {
		case 'personal':
			return target.field === 'fullName' ? LIMITS.fullName : LIMITS.headline;
		case 'summary':
			return LIMITS.summary;
		case 'sectionTitle':
			return LIMITS.title;
		case 'bullet':
			return LIMITS.bullet;
		case 'entry': {
			const kind = entrySection(target.section);
			return (kind && ENTRY_FIELDS[kind][target.field]?.max) ?? LIMITS.title;
		}
	}
}

/** True when the text exists in the CV and can be edited in place. */
export function canEditInline(cv: CVDocument, target: EditTarget): boolean {
	return readInline(cv, target) !== undefined;
}

/** True when Enter is allowed for this target (summary only; everything else is one line). */
export function inlineMultiline(target: EditTarget): boolean {
	return target.kind === 'summary';
}

/** Current stored value, or undefined when the target is not inline-editable. */
export function readInline(cv: CVDocument, target: EditTarget): string | undefined {
	switch (target.kind) {
		case 'personal':
			return cv.personal[target.field];
		case 'summary':
			return cv.summary;
		case 'sectionTitle': {
			if (!cv.layout.order.includes(target.section)) return undefined;
			if (isCustomKey(target.section))
				return cv.custom.find((s) => s.key === target.section)?.title;
			return cv.layout.customTitles[target.section] ?? '';
		}
		case 'entry': {
			const kind = entrySection(target.section);
			const spec = kind && ENTRY_FIELDS[kind][target.field];
			const item = spec ? findItem(cv, target.section, target.id) : undefined;
			if (!spec || !item) return undefined;
			const value = item[spec.field];
			return typeof value === 'string' ? value : '';
		}
		case 'bullet': {
			const list = bulletList(cv, target.section, target.id);
			return list && Number.isInteger(target.index) ? list[target.index] : undefined;
		}
	}
}

/**
 * Writes `value` (plain text) into the CV. Unknown targets are ignored. Built-in section titles:
 * an empty title resets to the default title. Optional fields become `undefined` when emptied.
 */
export function applyInline(draft: CVDocument, target: EditTarget, value: string): void {
	if (!canEditInline(draft, target)) return;
	const max = inlineLimit(target);
	switch (target.kind) {
		case 'personal':
			draft.personal[target.field] = oneLine(value, max);
			return;
		case 'summary':
			draft.summary = cleanText(value.replace(/\r\n?/g, '\n'), max);
			return;
		case 'sectionTitle':
			renameSection(draft, target.section, value);
			return;
		case 'entry': {
			const kind = entrySection(target.section)!;
			const spec = ENTRY_FIELDS[kind][target.field]!;
			const item = findItem(draft, target.section, target.id)!;
			const cleaned = oneLine(value, max);
			if (spec.optional && !cleaned.trim()) delete item[spec.field];
			else item[spec.field] = cleaned;
			return;
		}
		case 'bullet': {
			bulletList(draft, target.section, target.id)![target.index] = oneLine(value, max);
			return;
		}
	}
}

/** Coalesce key for `store.update`: one undo step per field while typing. */
export function inlineCoalesceKey(target: EditTarget): string {
	return `inline:${editKey(target)}`;
}

/**
 * Inserts an empty bullet after `index` (Enter at the end of a bullet). Returns the new bullet's
 * index, or undefined when the item has no bullets or is full (`LIMITS.bulletsPerItem`).
 */
export function insertBulletAfter(
	draft: CVDocument,
	section: SectionKey,
	id: string,
	index: number
): number | undefined {
	const list = bulletList(draft, section, id);
	if (!list || list.length >= LIMITS.bulletsPerItem || !Number.isInteger(index)) return undefined;
	const at = Math.max(0, Math.min(list.length, index + 1));
	list.splice(at, 0, '');
	return at;
}

/** Removes a bullet (Backspace on an empty bullet). Returns the index to focus next, if any. */
export function removeBullet(
	draft: CVDocument,
	section: SectionKey,
	id: string,
	index: number
): number | undefined {
	const list = bulletList(draft, section, id);
	if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) return undefined;
	list.splice(index, 1);
	return list.length ? Math.max(0, index - 1) : undefined;
}
