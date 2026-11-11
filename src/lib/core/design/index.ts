/**
 * Visual (Canva-like) editor for CREATIVE CVs: which sections sit in the side column, column side
 * and width, spacing, photo shape and size. ATS CVs ignore all of it (ATS rules, PROJECT_SPEC §7.2).
 * Content stays in the normal CV fields, so DOCX/TXT export and the ATS check keep working.
 *
 * Mutators work on the store's draft, inside `store.update` (one undo step each):
 *
 *   import { resolveDesign, placeSection, setDesign, resetDesign } from '#lib/core/design/index.ts';
 *   const design = $derived(resolveDesign(store.cv));                     // always complete
 *   store.update((d) => placeSection(d, 'skills', 'main', 1));           // drag & drop / keyboard
 *   store.update((d) => setDesign(d, { sideWidth: 30 }), { coalesceKey: 'design:sideWidth' });  // slider
 *   store.update((d) => resetDesign(d));                                  // back to the template look
 *
 * Inline text editing on the page lives in `./edit.ts`.
 */
import { DESIGN_LIMITS } from '../schema/limits';
import {
	DESIGN_SPACINGS,
	PHOTO_SHAPES,
	PHOTO_SIZES,
	SIDE_POSITIONS,
	type CVDesign,
	type CVDocument,
	type DesignSpacing,
	type PhotoShape,
	type PhotoSize,
	type SectionKey,
	type SidePosition
} from '../schema/types';

export * from './edit';

export type DesignColumn = 'side' | 'main';

/** `CVDesign` with every default filled in, plus ready-to-use scale factors for templates. */
export interface ResolvedDesign {
	side: SectionKey[];
	sidePosition: SidePosition;
	/** % of the page width. */
	sideWidth: number;
	spacing: DesignSpacing;
	photoShape: PhotoShape;
	photoSize: PhotoSize;
	/** Multiply vertical gaps by this (compact 0.75 · normal 1 · airy 1.3). */
	spaceScale: number;
	/** Multiply the photo size by this (sm 0.8 · md 1 · lg 1.2). */
	photoScale: number;
}

/** Side column of a two-column template when the user has not moved anything. */
export const DEFAULT_SIDE_SECTIONS: readonly SectionKey[] = ['skills', 'languages'];

export const DEFAULT_DESIGN: Readonly<Omit<ResolvedDesign, 'side' | 'spaceScale' | 'photoScale'>> =
	{
		sidePosition: 'left',
		sideWidth: DESIGN_LIMITS.sideWidth.default,
		spacing: 'normal',
		photoShape: 'circle',
		photoSize: 'md'
	};

const SPACE_SCALE: Record<DesignSpacing, number> = { compact: 0.75, normal: 1, airy: 1.3 };
const PHOTO_SCALE: Record<PhotoSize, number> = { sm: 0.8, md: 1, lg: 1.2 };

/** The complete design of a CV (defaults for anything not set). Pure: fine inside `$derived`. */
export function resolveDesign(cv: Pick<CVDocument, 'design' | 'layout'>): ResolvedDesign {
	const d = cv.design ?? {};
	const spacing = d.spacing ?? DEFAULT_DESIGN.spacing;
	const photoSize = d.photoSize ?? DEFAULT_DESIGN.photoSize;
	return {
		side: (d.side ?? DEFAULT_SIDE_SECTIONS).filter((key) => cv.layout.order.includes(key)),
		sidePosition: d.sidePosition ?? DEFAULT_DESIGN.sidePosition,
		sideWidth: d.sideWidth ?? DEFAULT_DESIGN.sideWidth,
		spacing,
		photoShape: d.photoShape ?? DEFAULT_DESIGN.photoShape,
		photoSize,
		spaceScale: SPACE_SCALE[spacing],
		photoScale: PHOTO_SCALE[photoSize]
	};
}

/** Which column a section is in. */
export function sectionColumn(
	cv: Pick<CVDocument, 'design' | 'layout'>,
	key: SectionKey
): DesignColumn {
	return resolveDesign(cv).side.includes(key) ? 'side' : 'main';
}

/** Section keys of one column, in CV order (hidden ones included: the caller filters if needed). */
export function columnSections(
	cv: Pick<CVDocument, 'design' | 'layout'>,
	column: DesignColumn
): SectionKey[] {
	const side = resolveDesign(cv).side;
	return cv.layout.order.filter((key) => side.includes(key) === (column === 'side'));
}

/**
 * Moves a section into `column` at position `index` among that column's sections (clamped).
 * Updates both the column membership and `layout.order`, so single-column templates and the
 * section list in the full editor stay consistent with what the user sees.
 */
export function placeSection(
	draft: CVDocument,
	key: SectionKey,
	column: DesignColumn,
	index: number
): void {
	const order = draft.layout.order;
	if (!order.includes(key) || !Number.isFinite(index)) return;
	const side = resolveDesign(draft).side.filter((item) => item !== key);
	if (column === 'side') side.push(key);
	const inColumn = (item: SectionKey) => side.includes(item) === (column === 'side');
	const peers = order.filter((item) => item !== key && inColumn(item));
	const at = Math.max(0, Math.min(peers.length, Math.trunc(index)));

	const rest = order.filter((item) => item !== key);
	const anchor = peers[at];
	if (anchor !== undefined) rest.splice(rest.indexOf(anchor), 0, key);
	else if (peers.length) rest.splice(rest.indexOf(peers[peers.length - 1]!) + 1, 0, key);
	else rest.push(key);

	draft.layout.order = rest;
	draft.design = { ...draft.design, side: rest.filter((item) => side.includes(item)) };
}

export type DesignPatch = Omit<CVDesign, 'side'>;

/** Changes design settings. Invalid values are ignored; numbers are clamped. */
export function setDesign(draft: CVDocument, patch: DesignPatch): void {
	const next: CVDesign = { ...draft.design };
	const pick = <T extends string>(options: readonly T[], value: T | undefined): T | undefined =>
		value !== undefined && options.includes(value) ? value : undefined;
	const sidePosition = pick(SIDE_POSITIONS, patch.sidePosition);
	const spacing = pick(DESIGN_SPACINGS, patch.spacing);
	const photoShape = pick(PHOTO_SHAPES, patch.photoShape);
	const photoSize = pick(PHOTO_SIZES, patch.photoSize);
	if (sidePosition) next.sidePosition = sidePosition;
	if (spacing) next.spacing = spacing;
	if (photoShape) next.photoShape = photoShape;
	if (photoSize) next.photoSize = photoSize;
	if (typeof patch.sideWidth === 'number' && Number.isFinite(patch.sideWidth)) {
		const { min, max } = DESIGN_LIMITS.sideWidth;
		next.sideWidth = Math.round(Math.min(max, Math.max(min, patch.sideWidth)));
	}
	draft.design = next;
}

/** Back to the template's own look (section order and content are kept). */
export function resetDesign(draft: CVDocument): void {
	delete draft.design;
}

/** True when the CV has any design change (to enable a "Reset design" button). */
export function hasCustomDesign(cv: Pick<CVDocument, 'design'>): boolean {
	return Boolean(cv.design && Object.keys(cv.design).length);
}
