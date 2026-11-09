/**
 * Section layout for the full editor (PROJECT_SPEC §4.2): order, show/hide, rename, custom sections.
 *
 * Mutators work on the store's draft, inside `store.update` (one undo step each):
 *
 *   import { editorSections, moveSection, setSectionHidden, renameSection,
 *            addCustomSection, removeCustomSection } from '#lib/core/layout/index.ts';
 *   const sections = $derived(editorSections(store.cv));        // rows for the editor list
 *   store.update((d) => moveSection(d, 'projects', -1));          // ↑ button
 *   store.update((d) => moveSectionTo(d, 'projects', 0));         // drag & drop
 *   store.update((d) => setSectionHidden(d, 'awards', true));
 *   store.update((d) => renameSection(d, 'experience', 'Pengalaman Magang'), { coalesceKey: 'title:experience' });
 *   let key; store.update((d) => { key = addCustomSection(d, 'Pelatihan'); });   // undefined at the limit
 *
 * Every mutator keeps the layout valid (same rules as `normalizeLayout`) and ignores unknown keys.
 */
import { CV_LABELS } from '../render/labels';
import { newCustomSectionKey } from '../schema/ids';
import { LIMITS } from '../schema/limits';
import { cleanText } from '../schema/schema';
import type { BuiltinSectionKey, CVDocument, CustomSectionKey, SectionKey } from '../schema/types';

export interface EditorSection {
	key: SectionKey;
	/** What the CV shows: the custom title, else the default title in the CV's language. */
	title: string;
	/** The default title (to show as a placeholder / for "reset"). Custom sections: their own title. */
	defaultTitle: string;
	/** True when `title` differs from the default (built-in sections only). */
	renamed: boolean;
	hidden: boolean;
	custom: boolean;
	/** Number of filled items (summary: 0/1; skills: all skill tags). 0 = not shown on the CV anyway. */
	count: number;
	/** Position in `layout.order`. */
	index: number;
	canMoveUp: boolean;
	canMoveDown: boolean;
}

const isCustomKey = (key: SectionKey): key is CustomSectionKey => key.startsWith('custom:');

function hasSection(cv: CVDocument, key: SectionKey): boolean {
	return isCustomKey(key) ? cv.custom.some((section) => section.key === key) : true;
}

function count(cv: CVDocument, key: SectionKey): number {
	if (isCustomKey(key)) return cv.custom.find((section) => section.key === key)?.items.length ?? 0;
	switch (key) {
		case 'summary':
			return cv.summary.trim() ? 1 : 0;
		case 'skills':
			return cv.skills.hard.length + cv.skills.soft.length + cv.skills.tools.length;
		default:
			return cv[key].length;
	}
}

/** Sections in CV order, with everything the editor list needs. */
export function editorSections(cv: CVDocument): EditorSection[] {
	const labels = CV_LABELS[cv.locale];
	const hidden = new Set(cv.layout.hidden);
	const keys = cv.layout.order.filter((key) => hasSection(cv, key));
	return keys.map((key, index) => {
		const custom = isCustomKey(key);
		const defaultTitle = custom
			? (cv.custom.find((section) => section.key === key)?.title ?? '')
			: labels.sections[key as BuiltinSectionKey];
		const customTitle = custom ? undefined : cv.layout.customTitles[key]?.trim();
		return {
			key,
			title: customTitle || defaultTitle,
			defaultTitle,
			renamed: Boolean(customTitle),
			hidden: hidden.has(key),
			custom,
			count: count(cv, key),
			index,
			canMoveUp: index > 0,
			canMoveDown: index < keys.length - 1
		};
	});
}

/** Moves a section to position `target` (clamped) in the visible order. */
export function moveSectionTo(draft: CVDocument, key: SectionKey, target: number): void {
	const order = draft.layout.order;
	const from = order.indexOf(key);
	if (from === -1 || !hasSection(draft, key)) return;
	const to = Math.max(0, Math.min(order.length - 1, Math.trunc(target)));
	if (to === from) return;
	order.splice(from, 1);
	order.splice(to, 0, key);
}

/** Moves a section one place up (-1) or down (+1), skipping nothing (for ↑/↓ buttons). */
export function moveSection(draft: CVDocument, key: SectionKey, delta: -1 | 1): void {
	const from = draft.layout.order.indexOf(key);
	if (from === -1) return;
	moveSectionTo(draft, key, from + delta);
}

/** Shows or hides a section on the CV (its content is kept). */
export function setSectionHidden(draft: CVDocument, key: SectionKey, hidden: boolean): void {
	if (!draft.layout.order.includes(key)) return;
	const list = draft.layout.hidden;
	const at = list.indexOf(key);
	if (hidden && at === -1) list.push(key);
	if (!hidden && at !== -1) list.splice(at, 1);
}

/**
 * Renames a section. Built-in: an empty title (or the default title) resets to the default.
 * Custom: sets its own title (an empty title is ignored — custom sections always need one).
 */
export function renameSection(draft: CVDocument, key: SectionKey, title: string): void {
	const cleaned = cleanText(title, LIMITS.title).replace(/\s+/g, ' ').trim();
	if (isCustomKey(key)) {
		const section = draft.custom.find((item) => item.key === key);
		if (section && cleaned) section.title = cleaned;
		return;
	}
	if (!draft.layout.order.includes(key)) return;
	const defaultTitle = CV_LABELS[draft.locale].sections[key as BuiltinSectionKey];
	if (!cleaned || cleaned === defaultTitle) delete draft.layout.customTitles[key];
	else draft.layout.customTitles[key] = cleaned;
}

/** True while another custom section can be added. */
export function canAddCustomSection(cv: CVDocument): boolean {
	return cv.custom.length < LIMITS.customSections;
}

/**
 * Adds an empty custom section at the end of the order. Returns its key, or `undefined` when the
 * limit (`LIMITS.customSections`) is reached or the title is empty.
 */
export function addCustomSection(draft: CVDocument, title: string): CustomSectionKey | undefined {
	const cleaned = cleanText(title, LIMITS.title).replace(/\s+/g, ' ').trim();
	if (!cleaned || !canAddCustomSection(draft)) return undefined;
	let key = newCustomSectionKey();
	while (draft.layout.order.includes(key)) key = newCustomSectionKey();
	draft.custom.push({ key, title: cleaned, items: [] });
	draft.layout.order.push(key);
	return key;
}

/** Deletes a custom section and its items (built-in sections can only be hidden). */
export function removeCustomSection(draft: CVDocument, key: SectionKey): void {
	if (!isCustomKey(key)) return;
	draft.custom = draft.custom.filter((section) => section.key !== key);
	draft.layout.order = draft.layout.order.filter((item) => item !== key);
	draft.layout.hidden = draft.layout.hidden.filter((item) => item !== key);
	delete draft.layout.customTitles[key];
}
