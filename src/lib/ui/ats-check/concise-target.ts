import type { ConcisePoint } from '#lib/core/ats/concise.ts';
import type { CVDocument } from '#lib/core/schema/types.ts';
import { cleanText } from '#lib/core/schema/schema.ts';
import { LIMITS } from '#lib/core/schema/limits.ts';
import { newId } from '#lib/core/schema/ids.ts';
import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';

function bulletsFor(cv: CVDocument, target: NonNullable<ConcisePoint['target']>) {
	const section = target.section;
	if (section === 'education')
		return cv.education.find((item) => item.id === target.itemId)?.highlights;
	if (section === 'experience' || section === 'organizations' || section === 'projects')
		return cv[section].find((item) => item.id === target.itemId)?.bullets;
	return cv.custom
		.find((item) => item.key === section)
		?.items.find((item) => item.id === target.itemId)?.bullets;
}

/** A suggestion is a single undo step and cannot replace a point edited since its analysis. */
export function applyConcisePoint(store: CvStore, point: ConcisePoint, text: string): boolean {
	const target = point.target;
	if (!target || store.externalChange !== 'none') return false;
	const summary = point.kind === 'summary' && target.section === 'summary';
	const index = target.bulletIndex;
	if (
		!summary &&
		(point.kind !== 'bullet' ||
			!Number.isInteger(index) ||
			index! < 0 ||
			index! >= LIMITS.bulletsPerItem)
	)
		return false;
	const source = summary ? store.cv.summary : bulletsFor(store.cv, target)?.[index!];
	if (source === undefined || source.trim() !== point.text) return false;
	const normalized = cleanText(
		summary ? text.replace(/\r\n?/g, '\n') : text.replace(/\s*[\r\n]+\s*/g, ' '),
		summary ? LIMITS.summary : LIMITS.bullet
	).trim();
	if (!normalized || normalized === source) return false;
	store.update(
		(draft) => {
			if (summary) draft.summary = normalized;
			else bulletsFor(draft, target)![index!] = normalized;
		},
		{ coalesceKey: `ats.concise.${newId()}` }
	);
	return true;
}
