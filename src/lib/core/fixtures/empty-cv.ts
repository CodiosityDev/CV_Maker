import { createEmptyCv } from '../schema/defaults';
import type { CVDocument } from '../schema/types';

/** Blank CVs with fixed ids/timestamps (deterministic), as the wizard starts them. */
export const emptyCvAts: CVDocument = createEmptyCv({
	kind: 'ats',
	locale: 'id',
	id: 'empty-ats-0001',
	now: new Date('2026-01-01T00:00:00.000Z')
});

export const emptyCvCreative: CVDocument = createEmptyCv({
	kind: 'creative',
	locale: 'id',
	id: 'empty-creative-0001',
	now: new Date('2026-01-01T00:00:00.000Z')
});
