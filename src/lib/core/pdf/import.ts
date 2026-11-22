/**
 * "Unggah PDF untuk diedit": a PDF downloaded from CV Maker carries its CV data (payload.ts);
 * uploading it adds that CV to this browser again. Any other PDF is refused.
 *
 *   const result = await importCvPdf(file);
 *   if (result.ok) goto(`/cv/${result.id}/edit`);
 */
import { backupRepo } from '../storage/index';
import { PDF_IMPORT_LIMIT_BYTES, readCvPayload } from './payload';

export type PdfImportResult =
	{ ok: true; id: string } | { ok: false; reason: 'not-cvmaker' | 'too-large' | 'failed' };

export async function importCvPdf(file: Blob): Promise<PdfImportResult> {
	if (file.size > PDF_IMPORT_LIMIT_BYTES) return { ok: false, reason: 'too-large' };
	let json: string | null;
	try {
		json = await readCvPayload(new Uint8Array(await file.arrayBuffer()));
	} catch {
		return { ok: false, reason: 'failed' };
	}
	if (!json) return { ok: false, reason: 'not-cvmaker' };
	try {
		// Same checks as a backup file (untrusted input); an existing CV is added as a copy.
		const result = await backupRepo.import(new Blob([json], { type: 'application/json' }));
		const id = result.ids[0];
		return id ? { ok: true, id } : { ok: false, reason: 'failed' };
	} catch {
		return { ok: false, reason: 'failed' };
	}
}
