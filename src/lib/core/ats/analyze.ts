/** Full analysis (checks + optional job-post keywords). Used by the worker and as main-thread fallback. */
import { toPlainText } from '../export/text';
import { toRenderModel } from '../render/index';
import type { CVDocument } from '../schema/types';
import { loadSuggestions } from '../suggest/index';
import { analyzeCv } from './checks';
import { matchKeywords } from './keywords';
import { analyzeScan } from '../scan/analyze';
import type { ExtractedCv, ScanAnalysis } from '../scan/types';
import type { AtsReport, KeywordReport } from './types';

export interface FullAnalysis {
	report: AtsReport;
	keywords?: KeywordReport;
}

let knownTermsPromise: Promise<string[]> | undefined;

/** Curated skills/tools in both languages (job posts often mix Indonesian and English). */
export function knownTerms(): Promise<string[]> {
	knownTermsPromise ??= Promise.all([loadSuggestions('id'), loadSuggestions('en')]).then((sets) =>
		sets.flatMap((data) => [
			...Object.values(data.skillsByCategory).flatMap((set) => [...set.hard, ...set.tools]),
			...data.softSkills
		])
	);
	return knownTermsPromise;
}

export async function analyzeFull(cv: CVDocument, jobPost?: string): Promise<FullAnalysis> {
	const report = analyzeCv(cv);
	if (!jobPost?.trim()) return { report };
	const cvText = toPlainText(toRenderModel(cv));
	return { report, keywords: matchKeywords(jobPost, cvText, await knownTerms()) };
}

/** Checks + optional job-post keywords for a CV FILE (see core/scan). */
export async function analyzeScanFull(cv: ExtractedCv, jobPost?: string): Promise<ScanAnalysis> {
	const report = analyzeScan(cv);
	if (!jobPost?.trim() || !cv.text) return { report };
	return { report, keywords: matchKeywords(jobPost, cv.text, await knownTerms()) };
}
