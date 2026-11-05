/**
 * Ranking for autocomplete: forgiving about case, accents, punctuation and extra spaces.
 * Score (lower = better): exact → starts with → a word starts with → contains.
 * Ties: shorter first, then the list's own order (lists are sorted by popularity).
 */

/** 'Universitas  Gadjah-Mada' → 'universitas gadjah mada' */
export function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9+#.]+/g, ' ')
		.trim();
}

function score(candidate: string, query: string): number | undefined {
	if (candidate === query) return 0;
	if (candidate.startsWith(query)) return 1;
	if (candidate.includes(` ${query}`)) return 2;
	if (candidate.includes(query)) return 3;
	// Every query word appears somewhere, in any order: "analyst junior" → "Junior Data Analyst".
	const words = query.split(' ').filter(Boolean);
	if (words.length > 1 && words.every((word) => candidate.includes(word))) return 4;
	return undefined;
}

export interface RankOptions {
	/** Max results. Default 8. */
	limit?: number;
	/** Values to leave out (e.g. skills already added), compared case/accent-insensitively. */
	exclude?: readonly string[];
	/** Return the first items when the query is empty. Default false. */
	popularWhenEmpty?: boolean;
}

export function rank(items: readonly string[], query: string, options: RankOptions = {}): string[] {
	const limit = options.limit ?? 8;
	const excluded = new Set((options.exclude ?? []).map(normalize));
	const q = normalize(query);
	const available = items.filter((item) => !excluded.has(normalize(item)));

	if (!q) return options.popularWhenEmpty ? available.slice(0, limit) : [];

	const scored: { item: string; score: number; index: number }[] = [];
	available.forEach((item, index) => {
		const s = score(normalize(item), q);
		if (s !== undefined) scored.push({ item, score: s, index });
	});
	scored.sort((a, b) => a.score - b.score || a.item.length - b.item.length || a.index - b.index);

	// Drop duplicates that only differ in case/accents.
	const seen = new Set<string>();
	const out: string[] = [];
	for (const { item } of scored) {
		const key = normalize(item);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
		if (out.length >= limit) break;
	}
	return out;
}
