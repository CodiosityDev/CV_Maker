/**
 * Visitor counter: all-time visitors since launch (starts at 0, never resets). A visitor counts
 * once per day (WIB). Each browser keeps a random id (no personal data, no cookie); in incognito
 * mode the id lives in memory only.
 *
 *   import { visitorCount, formatVisitors } from '#lib/core/stats/index.ts';
 *   const visitors = await visitorCount();          // number | undefined
 *   if (visitors !== undefined) label = formatVisitors(visitors, locale); // "1.234" / "1,234"
 *
 * `undefined` = API not reachable (offline, `pnpm dev`, ad blocker): HIDE the counter, never show 0.
 * Call it on any page as often as you like: one request per page load at most.
 */
import { incognito } from '../storage/index';
import type { Locale } from '../schema/types';
import { VISITOR_STORAGE_KEY } from './types';

export * from './types';

const HELLO_URL = '/api/hello';
const TIMEOUT_MS = 8_000;
const ID_PATTERN = /^[\w-]{22}$/;

export interface VisitorCounterOptions {
	fetch?: typeof fetch;
	url?: string;
	/** Browsers driven by automation (tests, crawlers that run JS) read the count without adding to it. */
	automated?: () => boolean;
}

export interface VisitorCounter {
	/** Counts this visitor (once a day) and returns the all-time total; cached for the page load. */
	count(): Promise<number | undefined>;
}

function randomId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

let memoryId: string | undefined;

function visitorId(): string {
	if (!incognito.active) {
		try {
			const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
			if (stored && ID_PATTERN.test(stored)) return stored;
			const id = memoryId ?? randomId();
			localStorage.setItem(VISITOR_STORAGE_KEY, id);
			memoryId = id;
			return id;
		} catch {
			// Storage blocked: fall back to memory.
		}
	}
	memoryId ??= randomId();
	return memoryId;
}

export function createVisitorCounter(options: VisitorCounterOptions = {}): VisitorCounter {
	const url = options.url ?? HELLO_URL;
	const automated =
		options.automated ?? (() => typeof navigator !== 'undefined' && navigator.webdriver === true);
	let pending: Promise<number | undefined> | undefined;

	async function load(): Promise<number | undefined> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		try {
			const doFetch = options.fetch ?? globalThis.fetch;
			const init: RequestInit = automated()
				? { method: 'GET' }
				: {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ visitor: visitorId() })
					};
			const response = await doFetch(url, {
				...init,
				credentials: 'same-origin',
				cache: 'no-store',
				signal: controller.signal
			});
			if (!response.ok) return undefined;
			const body = (await response.json()) as { visitors?: unknown };
			const visitors = body?.visitors;
			return typeof visitors === 'number' && Number.isSafeInteger(visitors) && visitors >= 0
				? visitors
				: undefined;
		} catch {
			return undefined;
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		count() {
			pending ??= load();
			return pending;
		}
	};
}

const defaultCounter = createVisitorCounter();

/** All-time visitor count, or `undefined` when unknown (then hide the counter). */
export function visitorCount(): Promise<number | undefined> {
	return defaultCounter.count();
}

/** Thousands separators per CV/UI language: id "12.345", en "12,345". */
export function formatVisitors(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID').format(value);
}
