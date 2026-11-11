/**
 * "Bertele-tele?" — how concise each CV point is (bullets and the summary). PROJECT_SPEC §9.1.
 *
 * On device, instant and free: word count, filler phrases, several ideas in one bullet, repeated
 * words, roundabout phrasing. The free AI check (`aiClient.concise`, small model) can refine the
 * scores and suggest shorter versions: merge it with `mergeConciseAi`.
 *
 *   const report = conciseFromCv(cv);              // or conciseFromText(extracted.text)
 *   report.score;                                  // 0–100 (undefined: no points to rate)
 *   report.points.filter((p) => p.level !== 'ok'); // the wordy ones, each with `issues` + `target`
 *   const input = aiConciseInput(report, locale);  // only the points worth checking
 *   const merged = mergeConciseAi(report, input, await aiClient.concise(input));
 *
 * Every message is an i18n key: `ats.concise.issues.<issue>`.
 */
import type { AiConciseInput, ConciseIssue, ConciseResult } from '../ai/types';
import { AI_CONCISE_LIMITS } from '../ai/types';
import { conciseSendText } from '../ai/redact';
import { headingSection } from '../scan/analyze';
import type { CVDocument, Locale, SectionKey } from '../schema/types';
import type { CheckTarget } from './types';
import { SECTION_STEP } from './checks';

export type ConciseLevel = 'ok' | 'wordy' | 'veryWordy';

export interface ConcisePoint {
	/** Stable key: 'summary' · `<section>|<itemId>|<bulletIndex>` · `line|<n>` (scanned file). */
	key: string;
	kind: 'bullet' | 'summary';
	text: string;
	/** Where to fix it (CV made in the app only). `bulletIndex` = position in the item's list. */
	target?: CheckTarget & { bulletIndex?: number };
	/** Owner item for the list, e.g. 'UI/UX Designer Intern — Studio Kreasi'. */
	item?: string;
	words: number;
	/** 0–100: 100 = tight and clear. */
	score: number;
	level: ConciseLevel;
	issues: ConciseIssue[];
	/** Filler phrases found, as written in the CV (to highlight them). */
	fillers: string[];
	/** AI only: a shorter version with the same facts. */
	shorter?: string;
	/** True when the AI rated this point. */
	ai?: true;
}

export interface ConciseReport {
	/** Average of the points, 0–100. undefined = nothing to rate. */
	score: number | undefined;
	/** In CV order. */
	points: ConcisePoint[];
	/** Points that are not 'ok'. */
	wordy: number;
	/** True after `mergeConciseAi`. */
	ai: boolean;
}

/** Phrases that add words but no information (lowercase, as whole words). */
const FILLERS = [
	// Indonesian
	'bertanggung jawab untuk',
	'bertanggung jawab atas',
	'bertanggung jawab dalam',
	'bertugas untuk',
	'bertugas dalam',
	'dalam rangka',
	'adapun',
	'yang mana',
	'di mana',
	'dimana',
	'berbagai macam',
	'berbagai hal',
	'hal-hal',
	'hal hal',
	'dan lain-lain',
	'dan lain lain',
	'dan sebagainya',
	'dll',
	'dsb',
	'sangat',
	'secara keseluruhan',
	'pada dasarnya',
	'merupakan',
	'melakukan kegiatan',
	'melakukan proses',
	'dengan baik',
	'dengan sangat baik',
	'agar supaya',
	'demi untuk',
	'untuk dapat',
	'mampu untuk',
	'tugas saya',
	'saya bertugas',
	// English
	'responsible for',
	'in charge of',
	'tasked with',
	'duties included',
	'in order to',
	'a lot of',
	'lots of',
	'etc',
	'very',
	'really',
	'was able to',
	'were able to',
	'helped to',
	'in terms of',
	'basically'
];

const VAGUE = /(^| )(berbagai|beberapa|banyak|various|several|many|numerous)( |$)/;
const INDIRECT = [
	/(^| )(was|were|been|being) \w+(ed|en)( |$)/,
	/(^| )(diberi|diberikan|mendapat|mendapatkan) (tugas|kesempatan|tanggung jawab)( |$)/,
	/(^| )ditugaskan untuk( |$)/
];
/** Common words that do not count as repetition. */
const COMMON = new Set([
	'dengan',
	'untuk',
	'dalam',
	'serta',
	'kepada',
	'tersebut',
	'secara',
	'sebagai',
	'which',
	'their',
	'about',
	'with',
	'from'
]);

const LIMITS = {
	bullet: { ideal: 20, long: 25, perWord: 3, cap: 55 },
	summary: { ideal: 80, long: 90, perWord: 1.2, cap: 50 }
} as const;
const PENALTY = {
	filler: 12,
	fillerCap: 36,
	multipleIdeas: 12,
	repetition: 10,
	indirect: 10,
	vague: 6
} as const;

/** Lowercase words separated by single spaces (keeps hyphens inside words). */
function words(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.replace(/(^|\s)-+|-+(\s|$)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function levelOf(score: number): ConciseLevel {
	return score >= 75 ? 'ok' : score >= 50 ? 'wordy' : 'veryWordy';
}

/** Rates one point on the device. Pure and fast. */
export function rateConcise(
	text: string,
	kind: 'bullet' | 'summary'
): Pick<ConcisePoint, 'words' | 'score' | 'level' | 'issues' | 'fillers'> {
	const plain = words(text);
	const padded = ` ${plain} `;
	const count = plain ? plain.split(' ').length : 0;
	const issues: ConciseIssue[] = [];
	let score = 100;

	const limit = LIMITS[kind];
	if (count > limit.ideal) score -= Math.min(limit.cap, (count - limit.ideal) * limit.perWord);
	if (count > limit.long) issues.push('tooLong');

	const fillers = FILLERS.filter((phrase) => padded.includes(` ${phrase} `));
	if (fillers.length) {
		issues.push('filler');
		score -= Math.min(PENALTY.fillerCap, fillers.length * PENALTY.filler);
	}

	if (kind === 'bullet') {
		const sentences = text
			.split(/[.!?;]+(?:\s+|$)/)
			.filter((s) => s.trim().split(/\s+/).length >= 3);
		if (sentences.length > 1) {
			issues.push('multipleIdeas');
			score -= PENALTY.multipleIdeas;
		}
	}

	const seen = new Map<string, number>();
	for (const word of plain.split(' '))
		if (word.length >= 5 && !COMMON.has(word)) seen.set(word, (seen.get(word) ?? 0) + 1);
	const repeatAt = kind === 'bullet' ? 2 : 3;
	if ([...seen.values()].some((n) => n >= repeatAt)) {
		issues.push('repetition');
		score -= PENALTY.repetition;
	}

	if (INDIRECT.some((pattern) => pattern.test(padded))) {
		issues.push('indirect');
		score -= PENALTY.indirect;
	}
	if (VAGUE.test(padded) && !/\d/.test(text)) {
		issues.push('vague');
		score -= PENALTY.vague;
	}

	const rounded = Math.max(0, Math.min(100, Math.round(score)));
	return { words: count, score: rounded, level: levelOf(rounded), issues, fillers };
}

function point(
	key: string,
	kind: 'bullet' | 'summary',
	text: string,
	extra: Pick<ConcisePoint, 'target' | 'item'> = {}
): ConcisePoint {
	return { key, kind, text, ...extra, ...rateConcise(text, kind) };
}

function report(points: ConcisePoint[], ai = false): ConciseReport {
	const score = points.length
		? Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length)
		: undefined;
	return { score, points, wordy: points.filter((p) => p.level !== 'ok').length, ai };
}

const blank = (value: string | undefined) => !value?.trim();

/** Points of a CV made in the app: the summary and every non-empty bullet. */
export function conciseFromCv(cv: CVDocument): ConciseReport {
	const points: ConcisePoint[] = [];
	if (!blank(cv.summary))
		points.push(
			point('summary', 'summary', cv.summary.trim(), {
				target: { step: 'summary', section: 'summary', field: 'summary' }
			})
		);
	const owners: { section: SectionKey; id: string; item: string; bullets: string[] }[] = [
		...cv.experience.map((e) => ({
			section: 'experience' as const,
			id: e.id,
			item: [e.role, e.company].filter((v) => !blank(v)).join(' — '),
			bullets: e.bullets
		})),
		...cv.organizations.map((o) => ({
			section: 'organizations' as const,
			id: o.id,
			item: [o.role, o.name].filter((v) => !blank(v)).join(' — '),
			bullets: o.bullets
		})),
		...cv.projects.map((p) => ({
			section: 'projects' as const,
			id: p.id,
			item: p.name,
			bullets: p.bullets
		})),
		...cv.education.map((e) => ({
			section: 'education' as const,
			id: e.id,
			item: e.institution,
			bullets: e.highlights
		})),
		...cv.custom.flatMap((section) =>
			section.items.map((i) => ({
				section: section.key,
				id: i.id,
				item: i.title,
				bullets: i.bullets
			}))
		)
	];
	for (const owner of owners)
		owner.bullets.forEach((bullet, index) => {
			if (blank(bullet)) return;
			points.push(
				point(`${owner.section}|${owner.id}|${index}`, 'bullet', bullet.trim(), {
					item: owner.item.trim() || undefined,
					target: {
						step: SECTION_STEP[owner.section] ?? 'review',
						section: owner.section,
						itemId: owner.id,
						field: 'bullets',
						bulletIndex: index
					}
				})
			);
		});
	return report(points);
}

const BULLET = /^(?:[•●▪◦‣∙·○■□➢➤►▶✓✔\-–—*-]|\d{1,2}[.)](?=\s))\s*/u;

/**
 * Points of a CV FILE (text from core/scan): bullet lines, long sentences under experience-like
 * headings, and the summary paragraph.
 */
export function conciseFromText(text: string): ConciseReport {
	const points: ConcisePoint[] = [];
	const summary: string[] = [];
	let section: ReturnType<typeof headingSection>;
	text.split('\n').forEach((raw, n) => {
		const line = raw.trim();
		if (!line) return;
		const heading = headingSection(line);
		if (heading) {
			section = heading;
			return;
		}
		if (section === 'summary') {
			summary.push(line);
			return;
		}
		const bullet = BULLET.test(line);
		const statement =
			section === 'experience' || section === 'organizations' || section === 'projects';
		const clean = line.replace(BULLET, '').trim();
		// Unmarked lines count only when they read like a sentence (not a title or a date line).
		if (clean && (bullet || (statement && clean.split(/\s+/).length >= 8)))
			points.push(point(`line|${n}`, 'bullet', clean));
	});
	if (summary.length) points.unshift(point('summary', 'summary', summary.join(' ')));
	return report(points);
}

/**
 * What to send to the free AI check: the wordiest points first (ties: CV order), very short ones
 * skipped, contact details removed (`conciseSendText`, the exact text sent). Points with nothing
 * left after that are dropped TOGETHER with their key, so `keys[i]` always belongs to `points[i]`.
 */
export function aiConciseInput(
	conciseReport: ConciseReport,
	locale: Locale
): AiConciseInput & { keys: string[] } {
	const chosen = conciseReport.points
		.filter((p) => p.words >= AI_CONCISE_LIMITS.minWords)
		.map((p, order) => ({ p, order }))
		.sort((a, b) => a.p.score - b.p.score || a.order - b.order)
		.slice(0, AI_CONCISE_LIMITS.points)
		.sort((a, b) => a.order - b.order)
		.map(({ p }) => p);
	const sent = chosen
		.map((p) => ({ key: p.key, kind: p.kind, text: conciseSendText(p.kind, p.text) }))
		.filter((p) => p.text);
	return {
		locale,
		points: sent.map(({ kind, text }) => ({ kind, text })),
		keys: sent.map((p) => p.key)
	};
}

/**
 * Combines the AI answer with the on-device result. A small model can be noisy, so the score is a
 * blend (60 % AI, 40 % on-device) and the issues are the union. Points the AI skipped stay as they were.
 */
export function mergeConciseAi(
	conciseReport: ConciseReport,
	input: { keys: readonly string[] },
	result: ConciseResult
): ConciseReport {
	const byKey = new Map<string, NonNullable<ConciseResult['points'][number]>>();
	input.keys.forEach((key, index) => {
		const answer = result.points[index];
		if (answer) byKey.set(key, answer);
	});
	const points = conciseReport.points.map((p): ConcisePoint => {
		const answer = byKey.get(p.key);
		if (!answer) return p;
		const score = Math.round(answer.score * 0.6 + p.score * 0.4);
		const issues = [...new Set([...p.issues, ...answer.issues])];
		const level = levelOf(score);
		return {
			...p,
			score,
			level,
			issues: level === 'ok' ? p.issues : issues,
			...(answer.shorter && level !== 'ok' ? { shorter: answer.shorter } : {}),
			ai: true
		};
	});
	return report(points, true);
}
