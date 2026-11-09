/**
 * Prompts and answer checking for each AI task.
 *
 * Rules (owner, PROJECT_SPEC §12): the AI only rewrites what the user gave. It must not invent
 * companies, numbers, dates or achievements. We do not just trust the prompt:
 * - every number in an answer must already appear in the profile, otherwise it becomes a
 *   placeholder the user has to fill ("[isi angka]");
 * - plain text only (markdown, emoji, links, emails are removed), lengths capped like user input;
 * - skills already in the CV are removed from suggestions.
 */
import type { ChatMessage } from './ai';
import { LIMITS } from '../../src/lib/core/schema/limits';
import { normalize } from '../../src/lib/core/suggest/match';
import {
	AI_SKILL_SUGGESTIONS,
	type AiProfile,
	type AiRequest,
	type AiResult
} from '../../src/lib/core/ai/types';

const LANGUAGE = { id: 'Bahasa Indonesia', en: 'English' } as const;
const NUMBER_PLACEHOLDER = { id: '[isi angka]', en: '[add number]' } as const;
const SKILL_MAX_LENGTH = 40;

const BASE_RULES = (profile: AiProfile) =>
	[
		'You help Indonesian fresh graduates write their CV.',
		`Write in ${LANGUAGE[profile.locale]}.`,
		'Use ONLY facts from the PROFILE JSON. Never invent companies, schools, numbers, percentages, dates, achievements, certificates or tools that are not in it.',
		'If something would need a number that is not in the profile, write it without a number.',
		'Plain text only: no markdown, no emoji, no quotes around sentences, no first-person pronouns at the start.',
		'Answer with ONE JSON object and nothing else.'
	].join('\n');

const TASK_RULES: Record<AiRequest['task'], (profile: AiProfile) => string> = {
	headline: () =>
		[
			'TASK: write 3 different short CV headlines (one line under the name).',
			'Each at most 12 words and 100 characters. Combine the target role with the education and/or 1–2 strongest skills.',
			'Example styles: "Fresh Graduate Sistem Informasi | Data Analyst", "Junior Web Developer · React, Laravel".',
			'JSON shape: {"headlines": ["…", "…", "…"]}'
		].join('\n'),
	summary: (profile) =>
		[
			'TASK: write a CV profile summary.',
			'2 to 4 sentences, 250 to 600 characters. Mention the target role, the education, one or two concrete experiences or projects from the profile, and 2–3 relevant skills.',
			profile.summary
				? 'The profile has a current summary: improve it, keep its facts, do not add new ones.'
				: 'There is no summary yet: write a new one.',
			'JSON shape: {"summary": "…"}'
		].join('\n'),
	skills: () =>
		[
			'TASK: suggest skills that fit the target role and background but are NOT already in profile.skills.',
			`At most ${AI_SKILL_SUGGESTIONS.hard} hard skills, ${AI_SKILL_SUGGESTIONS.tools} tools/software and ${AI_SKILL_SUGGESTIONS.soft} soft skills.`,
			'Use common, real names that recruiters search for, each at most 4 words.',
			'JSON shape: {"hard": ["…"], "tools": ["…"], "soft": ["…"]}'
		].join('\n')
};

export function buildMessages(request: AiRequest): ChatMessage[] {
	return [
		{
			role: 'system',
			content: `${BASE_RULES(request.profile)}\n\n${TASK_RULES[request.task](request.profile)}`
		},
		{ role: 'user', content: `PROFILE JSON:\n${JSON.stringify(request.profile)}` }
	];
}

/** First JSON object in the text (models sometimes wrap it in ```json fences or add words). */
export function extractJson(text: string): unknown {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end <= start) return undefined;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return undefined;
	}
}

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const URL_OR_EMAIL = /\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+/gi;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/g;

/** One line of plain text, at most `max` characters (cut at a word boundary). */
export function cleanText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	let text = value
		.replace(CONTROL, ' ')
		.replace(URL_OR_EMAIL, '')
		.replace(EMOJI, '')
		.replace(/[*_#`>]+/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(?:[-•·]\s*|\d+[.)]\s+)/, '')
		.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
		.trim();
	if (text.length > max) {
		const cut = text.slice(0, max);
		const space = cut.lastIndexOf(' ');
		text = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '');
	}
	return text;
}

/** Numbers (with . , % separators) the answer may use: the ones the user wrote. */
function knownNumbers(profile: AiProfile): Set<string> {
	const found = JSON.stringify(profile).match(/\d+(?:[.,]\d+)*/g) ?? [];
	return new Set(found.map((n) => n.replace(/[.,]/g, '')));
}

/** Replaces numbers that are not in the profile with a placeholder the user must fill. */
export function guardNumbers(text: string, profile: AiProfile): string {
	const allowed = knownNumbers(profile);
	// Standalone numbers only: "S1", "D3", "Web3" are names, not claims.
	return text
		.replace(/(?<![\p{L}\d])\d+(?:[.,]\d+)*(?:\s*%)?(?![\p{L}\d])/gu, (match) => {
			const digits = match.replace(/[^\d]/g, '');
			return allowed.has(digits) ? match : NUMBER_PLACEHOLDER[profile.locale];
		})
		.replace(/\s+/g, ' ')
		.trim();
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const k = key(item);
		if (!k || seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

function stringList(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/** Checks and cleans a model answer; `undefined` when nothing usable came back. */
export function parseAnswer(request: AiRequest, text: string): AiResult | undefined {
	const json = extractJson(text);
	if (!json || typeof json !== 'object') return undefined;
	const data = json as Record<string, unknown>;
	const { profile } = request;

	switch (request.task) {
		case 'headline': {
			const headlines = uniqueBy(
				stringList(data.headlines)
					.map((h) => guardNumbers(cleanText(h, LIMITS.headline), profile))
					.filter((h) => h.length >= 3),
				(h) => normalize(h)
			).slice(0, 3);
			return headlines.length ? { task: 'headline', headlines } : undefined;
		}
		case 'summary': {
			const summary = guardNumbers(cleanText(data.summary, LIMITS.summary), profile);
			return summary.length >= 40 ? { task: 'summary', summary } : undefined;
		}
		case 'skills': {
			const existing = new Set(
				[...profile.skills.hard, ...profile.skills.tools, ...profile.skills.soft].map(normalize)
			);
			const taken = new Set<string>();
			const pick = (value: unknown, max: number) =>
				stringList(value)
					.map((s) => cleanText(s, SKILL_MAX_LENGTH))
					.filter((s) => {
						const key = normalize(s);
						if (s.length < 2 || !key || existing.has(key) || taken.has(key)) return false;
						taken.add(key);
						return true;
					})
					.slice(0, max);
			const result = {
				task: 'skills' as const,
				hard: pick(data.hard, AI_SKILL_SUGGESTIONS.hard),
				tools: pick(data.tools, AI_SKILL_SUGGESTIONS.tools),
				soft: pick(data.soft, AI_SKILL_SUGGESTIONS.soft)
			};
			return result.hard.length + result.tools.length + result.soft.length ? result : undefined;
		}
	}
}
