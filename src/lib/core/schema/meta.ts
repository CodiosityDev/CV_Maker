import type { CVDocument, CVMeta } from './types';

/** Lightweight summary of a CV for the dashboard list. */
export function toCvMeta(cv: CVDocument): CVMeta {
	return {
		id: cv.id,
		title: cv.title,
		kind: cv.kind,
		locale: cv.locale,
		templateId: cv.templateId,
		targetRole: cv.targetRole,
		fullName: cv.personal.fullName,
		wizardCompleted: cv.status.wizardCompleted,
		createdAt: cv.createdAt,
		updatedAt: cv.updatedAt
	};
}
