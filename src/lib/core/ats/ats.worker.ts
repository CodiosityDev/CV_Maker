/// <reference lib="webworker" />
/**
 * Web Worker: runs the ATS analysis off the main thread so typing stays smooth on low-end phones.
 * Messages: { id, cv, jobPost? } → { id, ok: true, result } | { id, ok: false }
 */
import { analyzeFull } from './analyze';
import type { CVDocument } from '../schema/types';

interface Request {
	id: number;
	cv: CVDocument;
	jobPost?: string;
}

self.addEventListener('message', async (event: MessageEvent<Request>) => {
	const { id, cv, jobPost } = event.data ?? ({} as Request);
	if (typeof id !== 'number' || !cv || typeof cv !== 'object') return;
	try {
		const result = await analyzeFull(cv, typeof jobPost === 'string' ? jobPost : undefined);
		self.postMessage({ id, ok: true, result });
	} catch {
		self.postMessage({ id, ok: false });
	}
});
