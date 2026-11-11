/**
 * CV scan — ATS scanner for a CV FILE made anywhere (PDF, DOCX, TXT). Everything runs on the
 * user's device: the file is never uploaded (only the optional AI review sends redacted text,
 * see `aiClient.review`).
 *
 *   import { extractCvText, ScanError, SCAN_ACCEPT, scanErrorMessageKey } from '#lib/core/scan/index.ts';
 *   import { createAtsAnalyzer } from '#lib/core/ats/index.ts';
 *
 *   <input type="file" accept={SCAN_ACCEPT}>
 *   try {
 *     const cv = await extractCvText(file);                    // PDF reader is lazy-loaded
 *     const { report, keywords } = await analyzer.analyzeScan(cv, jobPost);
 *     report.score, report.grade, report.checks[] → t(check.messageKey, check.params)
 *     report.sections (found, in order), report.contact, report.stats
 *   } catch (error) {
 *     if (error instanceof ScanError) show(t(scanErrorMessageKey(error.code)));
 *   }
 *
 * For a CV made in the app, use `analyzer.analyze(cv)` (AtsReport, with fix targets) instead.
 * Keep `cv.text` only in memory (do not store it): it is the user's CV.
 */
import type { ScanErrorCode } from './types';

export * from './types';
export { extractCvText, extractPastedText, sniffKind } from './extract';
export { analyzeScan, headingSection } from './analyze';

/** i18n key for a file-reading error (namespace `ats`). */
export function scanErrorMessageKey(code: ScanErrorCode): `ats.scan.errors.${ScanErrorCode}` {
	return `ats.scan.errors.${code}`;
}
