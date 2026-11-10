/**
 * Job-post keyword matching (PROJECT_SPEC §9.1). Runs on the device only — the job post is never sent.
 *
 * Keywords = (1) known skills/tools from the curated dictionary that appear in the post, then
 * (2) words/phrases repeated in the post (stopwords removed). Each keyword is checked against the CV text.
 */
import { normalize as baseNormalize } from '../suggest/match';
import { STOPWORDS } from './stopwords';
import type { KeywordMatch, KeywordReport } from './types';

/** Short terms that are meaningful despite being < 3 characters. */
const SHORT_TERMS = new Set(['ui', 'ux', 'hr', 'qa', 'qc', 'k3', 'it', 'ai', 'pr', 'c', 'r', 'go']);
const MAX_KEYWORDS = 25;

/** Strips leading/trailing dots of one word in linear time (no regex backtracking on "x.....x"). */
function trimDots(word: string): string {
	let start = 0;
	let end = word.length;
	while (start < end && word[start] === '.') start += 1;
	while (end > start && word[end - 1] === '.') end -= 1;
	return word.slice(start, end);
}

/** Like the suggestion normalizer, but drops sentence dots ("Excel." → "excel", ".NET" → "net")
 * while keeping inner dots ("node.js"). Linear time: pasted job posts are untrusted input. */
export function normalize(text: string): string {
	return baseNormalize(text).split(' ').map(trimDots).filter(Boolean).join(' ');
}
export const MAX_JOB_POST_CHARS = 20_000;

function tokens(text: string): string[] {
	return normalize(text)
		.split(' ')
		.filter((word) => word && !STOPWORDS.has(word) && !/^\d+$/.test(word))
		.filter((word) => word.length >= 3 || SHORT_TERMS.has(word));
}

/** Whole-word / whole-phrase containment on normalized text. */
function containsTerm(haystack: string, term: string): boolean {
	return ` ${haystack} `.includes(` ${term} `);
}

function countOccurrences(haystack: string, term: string): number {
	const padded = ` ${haystack} `;
	const needle = ` ${term} `;
	let count = 0;
	let index = padded.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = padded.indexOf(needle, index + needle.length - 1);
	}
	return count;
}

/**
 * @param jobPost   text pasted by the user (truncated to MAX_JOB_POST_CHARS)
 * @param cvText    plain text of the CV (e.g. `toPlainText(toRenderModel(cv))`)
 * @param knownTerms curated skills/tools (e.g. from the suggestion data, both languages)
 */
export function matchKeywords(
	jobPost: string,
	cvText: string,
	knownTerms: readonly string[] = []
): KeywordReport {
	const post = normalize(jobPost.slice(0, MAX_JOB_POST_CHARS));
	const cv = normalize(cvText);
	if (!post) return { keywords: [], coverage: 0 };

	const picked = new Map<string, KeywordMatch>();

	// 1) Known skills/tools mentioned in the post (longest first so "microsoft excel" beats "excel").
	const known = [...new Set(knownTerms)]
		.map((term) => ({ display: term, key: normalize(term) }))
		.filter((t) => t.key.length >= 2)
		.sort((a, b) => b.key.length - a.key.length);
	for (const { display, key } of known) {
		if (picked.has(key) || !containsTerm(post, key)) continue;
		// Skip if it is part of an already picked longer phrase.
		if ([...picked.keys()].some((k) => containsTerm(k, key))) continue;
		picked.set(key, {
			term: display,
			count: countOccurrences(post, key),
			inCv: containsTerm(cv, key),
			known: true
		});
	}

	// 2) Repeated words and two-word phrases.
	const words = tokens(post);
	const freq = new Map<string, number>();
	for (let i = 0; i < words.length; i++) {
		const word = words[i]!;
		freq.set(word, (freq.get(word) ?? 0) + 1);
		const next = words[i + 1];
		if (next) {
			const phrase = `${word} ${next}`;
			if (containsTerm(post, phrase)) freq.set(phrase, (freq.get(phrase) ?? 0) + 1);
		}
	}
	const frequent = [...freq.entries()]
		.filter(([, count]) => count >= 2)
		.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
	for (const [term, count] of frequent) {
		if (picked.size >= MAX_KEYWORDS) break;
		if (picked.has(term)) continue;
		if ([...picked.keys()].some((k) => containsTerm(k, term) || containsTerm(term, k))) continue;
		picked.set(term, { term, count, inCv: containsTerm(cv, term), known: false });
	}

	const keywords = [...picked.values()]
		.sort((a, b) => Number(b.known) - Number(a.known) || b.count - a.count)
		.slice(0, MAX_KEYWORDS);
	const found = keywords.filter((k) => k.inCv).length;
	return { keywords, coverage: keywords.length ? found / keywords.length : 0 };
}
