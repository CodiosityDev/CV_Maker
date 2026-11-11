/**
 * Job-post keyword matching (PROJECT_SPEC §9.1). Runs on the device only — the job post is never sent.
 *
 * Keywords = (1) known skills/tools from the curated dictionary that appear in the post (any of
 * their spellings: "RESTful API" = "REST API"), (2) product-like names mentioned even once
 * ("Node.js", "C#", "PostgreSQL"), then (3) words/phrases repeated in the post (stopwords removed).
 * Each keyword is checked against the CV text, again with every spelling.
 */
import { normalize as baseNormalize } from '../suggest/match';
import { STOPWORDS } from './stopwords';
import type { KeywordMatch, KeywordReport } from './types';
import type { KeywordTerm } from './lexicon';

/** Short terms that are meaningful despite being < 3 characters. */
const SHORT_TERMS = new Set(['ui', 'ux', 'hr', 'qa', 'qc', 'k3', 'it', 'ai', 'pr', 'c', 'r', 'go']);
const MAX_KEYWORDS = 25;
/** Product-like names found by their shape (mentioned once is enough). */
const MAX_DETECTED = 10;

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

interface Group {
	display: string;
	key: string;
	/** Normalized spellings, longest first. */
	variants: string[];
}

function groups(knownTerms: readonly (string | KeywordTerm)[]): Group[] {
	const byKey = new Map<string, Group>();
	for (const entry of knownTerms) {
		const { term, aliases = [] } = typeof entry === 'string' ? { term: entry } : entry;
		const key = normalize(term);
		if (key.length < 2 || byKey.has(key)) continue;
		const variants = [...new Set([key, ...aliases.map(normalize)])]
			.filter((v) => v.length >= 2)
			.sort((a, b) => b.length - a.length);
		byKey.set(key, { display: term, key, variants });
	}
	// Longest spelling first so "microsoft excel" beats "excel".
	return [...byKey.values()].sort((a, b) => b.variants[0]!.length - a.variants[0]!.length);
}

// Bounded repeats only: the job post is untrusted text (no slow regex on a 20 000-char "word").
const URL_OR_EMAIL = /\b(?:https?:\/\/|www\.)\S{1,500}|[^\s@]{1,64}@\S{1,255}/g;
const DOTTED = /\b[A-Za-z][A-Za-z0-9]{0,20}(?:\.[A-Za-z][A-Za-z0-9]{0,10}){1,2}\b/g;
const SHARP_PLUS = /\b[A-Za-z]{1,3}(?:#|\+\+)/g;
const CAMEL = /\b(?:[A-Za-z][a-z]{1,30}[A-Z][A-Za-z]{0,30}|i[A-Z][A-Za-z]{1,30})\b/g;
const DOMAIN_ENDINGS = new Set(['com', 'id', 'co', 'net', 'org', 'io', 'ai', 'app', 'dev', 'me']);
/** Product names that are where to apply, not skills. */
const NOT_SKILLS = new Set(['linkedin', 'whatsapp', 'jobstreet', 'kitalulus', 'glints', 'kalibrr']);

/** Names shaped like technology/products: "Node.js", "C#", "C++", "PostgreSQL", "iOS". */
function detectNames(rawPost: string): { display: string; key: string }[] {
	const text = rawPost.replace(URL_OR_EMAIL, ' ');
	const found = new Map<string, string>();
	for (const pattern of [DOTTED, SHARP_PLUS, CAMEL]) {
		for (const match of text.matchAll(pattern)) {
			const display = match[0];
			if (pattern === DOTTED && DOMAIN_ENDINGS.has(display.split('.').pop()!.toLowerCase()))
				continue;
			const key = normalize(display);
			if (key.length < 2 || NOT_SKILLS.has(key) || STOPWORDS.has(key) || found.has(key)) continue;
			found.set(key, display);
		}
	}
	return [...found].map(([key, display]) => ({ key, display }));
}

/**
 * @param jobPost   text pasted by the user (truncated to MAX_JOB_POST_CHARS)
 * @param cvText    plain text of the CV (e.g. `toPlainText(toRenderModel(cv))`)
 * @param knownTerms curated skills/tools: plain names or `{ term, aliases }` (see `knownTerms()`)
 */
export function matchKeywords(
	jobPost: string,
	cvText: string,
	knownTerms: readonly (string | KeywordTerm)[] = []
): KeywordReport {
	const raw = jobPost.slice(0, MAX_JOB_POST_CHARS);
	const post = normalize(raw);
	const cv = normalize(cvText);
	if (!post) return { keywords: [], coverage: 0 };

	const picked = new Map<string, KeywordMatch>();
	/** Spellings already used by a picked keyword (to skip "excel" inside "microsoft excel"). */
	const used: string[] = [];
	const inside = (term: string) => used.some((u) => u !== term && containsTerm(u, term));

	// 1) Known skills/tools mentioned in the post, by any spelling.
	for (const group of groups(knownTerms)) {
		if (picked.has(group.key)) continue;
		const inPost = group.variants.filter((v) => containsTerm(post, v));
		if (!inPost.length || inPost.every(inside)) continue;
		used.push(...inPost);
		picked.set(group.key, {
			term: group.display,
			count: inPost.reduce((sum, v) => sum + countOccurrences(post, v), 0),
			inCv: group.variants.some((v) => containsTerm(cv, v)),
			known: true
		});
	}

	// 2) Technology-like names, even when mentioned once.
	let detected = 0;
	for (const { key, display } of detectNames(raw)) {
		if (detected >= MAX_DETECTED || picked.size >= MAX_KEYWORDS) break;
		if (picked.has(key) || inside(key) || used.includes(key)) continue;
		used.push(key);
		detected += 1;
		picked.set(key, {
			term: display,
			count: countOccurrences(post, key),
			inCv: containsTerm(cv, key),
			known: false
		});
	}

	// 3) Repeated words and two-word phrases.
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
		if (used.some((k) => containsTerm(k, term) || containsTerm(term, k))) continue;
		used.push(term);
		picked.set(term, { term, count, inCv: containsTerm(cv, term), known: false });
	}

	const keywords = [...picked.values()]
		.sort((a, b) => Number(b.known) - Number(a.known) || b.count - a.count)
		.slice(0, MAX_KEYWORDS);
	const found = keywords.filter((k) => k.inCv).length;
	return { keywords, coverage: keywords.length ? found / keywords.length : 0 };
}
