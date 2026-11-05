/**
 * CV export (PROJECT_SPEC §8). All exports happen on the user's device.
 *
 *   import { exportDocx, toPlainText, exportFileName, downloadBlob } from '#lib/core/export/index.ts';
 *   const model = toRenderModel(cv);
 *   downloadBlob(await exportDocx(model), exportFileName({ ...cv.personal, targetRole: cv.targetRole }, 'docx'));
 *
 * PDF: rendered by the browser's print engine from the print page (UI) — use `exportFileName(..., 'pdf')`
 * as `document.title` so "Save as PDF" suggests a good file name.
 */
import type { RenderModel } from '../render/index';

export { toPlainText } from './text';
export { exportFileName, backupFileName, type ExportExtension } from './filename';

/** Word document. Loads the `docx` library on demand (~100 KB, only when the user exports). */
export async function exportDocx(model: RenderModel): Promise<Blob> {
	const { toDocx } = await import('./docx');
	return toDocx(model);
}

/** Plain text as a downloadable file. */
export async function exportTxt(model: RenderModel): Promise<Blob> {
	const { toPlainText } = await import('./text');
	return new Blob([toPlainText(model)], { type: 'text/plain;charset=utf-8' });
}

/** Browser-only: save a Blob as a file. */
export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = 'noopener';
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	// Give the browser time to start the download before releasing the URL.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
