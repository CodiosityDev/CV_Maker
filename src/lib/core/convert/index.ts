/**
 * "Ubah jadi CV ATS" — any CV file → a new ATS CV in CV Maker.
 *
 *   import { convertLocally, convertWithAi } from '#lib/core/convert/index.ts';
 *   const extracted = await extractCvText(file);                     // core/scan
 *
 *   // Free, on the device (no AI): best-effort structure of the original text.
 *   const { cv, notes } = convertLocally(extracted, { targetRole });
 *
 *   // With AI (1 of today's uses; needs the same consent as other AI help): restructured,
 *   // bullets rewritten for ATS, summary/headline written, plus suggestions and notes.
 *   const { cv, notes, aiNotes, suggestedSkills, quota } = await convertWithAi(extracted, {
 *     targetRole, jobPost, onStarted: (quota) => showQuota(quota)
 *   });
 *
 *   await cvRepo.save(cv); goto(`/cv/${cv.id}/edit`);   // the user checks everything there
 *
 * Contact details (name, email, phone, city, links) are read ON THE DEVICE and never sent to the
 * AI; they are put back into the CV after the AI answered. The AI answer is checked on the server:
 * schools, companies, organisations, certificates, years and grades must appear in the original
 * text, skills must be written in it, numbers in rewritten bullets must come from it.
 * Notes: `t(note.messageKey, note.params)`; aiNotes / suggestedSkills are plain text from the AI.
 */
import { aiClient, aiReviewInputFromScan } from '../ai/index';
import type { AiQuota } from '../ai/types';
import type { ExtractedCv } from '../scan/types';
import type { CVDocument, Locale } from '../schema/types';
import { cvFromDraft } from './build';
import { parseCvText } from './parse';
import type { ConvertNote } from './types';

export * from './types';
export { parseCvText } from './parse';
export { cvFromDraft } from './build';
export { findDates, parsePoint } from './dates';

export interface ConvertOptions {
	targetRole?: string;
	/** CV language; default: guessed from the text. */
	locale?: Locale;
	now?: Date;
}

export interface Converted {
	cv: CVDocument;
	notes: ConvertNote[];
	/** Original lines the parser could not place (show them so nothing is lost). */
	unplaced: string[];
}

/** Free conversion on the device (no AI). */
export function convertLocally(
	extracted: Pick<ExtractedCv, 'text'>,
	options: ConvertOptions = {}
): Converted {
	const parsed = parseCvText(extracted.text);
	const locale = options.locale ?? parsed.locale;
	return {
		cv: cvFromDraft(parsed.draft, parsed.contacts, {
			locale,
			targetRole: options.targetRole,
			now: options.now
		}),
		notes: parsed.notes,
		unplaced: parsed.unplaced
	};
}

export interface AiConverted extends Converted {
	/** What the AI says to add or check. */
	aiNotes: { title: string; detail: string }[];
	/** Optional skills for the target role (not in the CV; never added automatically). */
	suggestedSkills: string[];
	quota: AiQuota;
}

/** Conversion with AI (1 of today's uses). Throws AiError (`t(aiErrorMessageKey(code))`). */
export async function convertWithAi(
	extracted: Pick<ExtractedCv, 'text'>,
	options: ConvertOptions & { jobPost?: string; onStarted?: (quota: AiQuota) => void } = {}
): Promise<AiConverted> {
	const local = parseCvText(extracted.text);
	const locale = options.locale ?? local.locale;
	const input = aiReviewInputFromScan(
		extracted,
		options.jobPost ?? '',
		options.targetRole ?? '',
		locale
	);
	const { result, quota } = await aiClient.convert(input, { onStarted: options.onStarted });
	const cv = cvFromDraft(result.draft, local.contacts, {
		locale,
		targetRole: options.targetRole,
		now: options.now
	});
	// The AI does not see the header: keep a headline/summary found there when it wrote none.
	if (!cv.personal.headline && local.draft.headline) cv.personal.headline = local.draft.headline;
	const notes = local.notes.filter((n) => n.id !== 'monthGuessed' && n.id !== 'notParsed');
	if (result.monthGuessed)
		notes.unshift({
			id: 'monthGuessed',
			messageKey: 'ats.convert.notes.monthGuessed',
			params: { count: result.monthGuessed }
		});
	return {
		cv,
		notes,
		unplaced: [],
		aiNotes: result.notes,
		suggestedSkills: result.suggestedSkills,
		quota
	};
}
