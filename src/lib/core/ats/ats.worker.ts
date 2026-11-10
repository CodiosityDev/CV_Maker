/// <reference lib="webworker" />
/**
 * Web Worker: runs the ATS analysis off the main thread so typing stays smooth on low-end phones.
 * Messages: { id, cv, jobPost? } (a CV made in the app) or { id, scan, jobPost? } (a CV file, see
 * core/scan) → { id, ok: true, result } | { id, ok: false }
 */
import { analyzeFull, analyzeScanFull } from './analyze';
import type { CVDocument } from '../schema/types';
import type { ExtractedCv } from '../scan/types';

interface Request {
	id: number;
	cv?: CVDocument;
	scan?: ExtractedCv;
	jobPost?: string;
}

self.addEventListener('message', async (event: MessageEvent<Request>) => {
	const { id, cv, scan, jobPost } = event.data ?? ({} as Request);
	if (typeof id !== 'number') return;
	const post = typeof jobPost === 'string' ? jobPost : undefined;
	try {
		let result;
		if (scan && typeof scan === 'object') result = await analyzeScanFull(scan, post);
		else if (cv && typeof cv === 'object') result = await analyzeFull(cv, post);
		else return;
		self.postMessage({ id, ok: true, result });
	} catch {
		self.postMessage({ id, ok: false });
	}
});
