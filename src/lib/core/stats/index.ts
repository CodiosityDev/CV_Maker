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
 *
 * Online now ("sedang online"):
 *   startPresence();                                  // once, in the root layout (every page)
 *   const stop = watchOnline((online) => (shown = online)); onDestroy(stop);
 *   A visible tab sends a tiny heartbeat every minute (same random id, no CV data); hidden tabs
 *   send nothing. `online` includes this visitor. Not called back when the API is unreachable.
 */
import { incognito } from '../storage/index';
import type { Locale } from '../schema/types';
import { VISITOR_STORAGE_KEY } from './types';

export * from './types';

const HELLO_URL = '/api/hello';
const TIMEOUT_MS = 8_000;
/** Heartbeat while the tab is visible; the server forgets a visitor 150 s after the last one. */
export const PRESENCE_INTERVAL_MS = 60_000;
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
	/** Starts the heartbeat (idempotent). No-op for automated browsers and without `document`. */
	startPresence(): void;
	/** Calls `listener` with the online count now (if known) and after every heartbeat. */
	watchOnline(listener: (online: number) => void): () => void;
}

const validCount = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

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
	let online: number | undefined;
	const listeners = new Set<(online: number) => void>();
	let presenceStarted = false;

	function setOnline(value: number | undefined): void {
		if (value === undefined) return;
		online = value;
		for (const listener of listeners) listener(value);
	}

	async function beat(): Promise<void> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		try {
			const response = await (options.fetch ?? globalThis.fetch)(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visitor: visitorId(), beat: true }),
				credentials: 'same-origin',
				cache: 'no-store',
				signal: controller.signal
			});
			if (!response.ok) return;
			const body = (await response.json()) as { online?: unknown };
			setOnline(validCount(body?.online));
		} catch {
			// Offline or blocked: keep the last known number.
		} finally {
			clearTimeout(timer);
		}
	}

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
			const body = (await response.json()) as { visitors?: unknown; online?: unknown };
			setOnline(validCount(body?.online));
			return validCount(body?.visitors);
		} catch {
			return undefined;
		} finally {
			clearTimeout(timer);
		}
	}

	const count = () => (pending ??= load());

	return {
		count,
		startPresence() {
			if (presenceStarted || typeof document === 'undefined' || automated()) return;
			presenceStarted = true;
			let timer: ReturnType<typeof setInterval> | undefined;
			const run = () => {
				if (document.visibilityState !== 'visible') return;
				// The page-load hello already marked this visitor online; beats keep it so.
				void count().then(() => beat());
			};
			const schedule = () => {
				if (timer !== undefined) clearInterval(timer);
				timer = undefined;
				if (document.visibilityState !== 'visible') return;
				timer = setInterval(run, PRESENCE_INTERVAL_MS);
			};
			document.addEventListener('visibilitychange', () => {
				schedule();
				if (document.visibilityState === 'visible') run();
			});
			schedule();
		},
		watchOnline(listener) {
			listeners.add(listener);
			if (online !== undefined) listener(online);
			return () => listeners.delete(listener);
		}
	};
}

const defaultCounter = createVisitorCounter();

/** All-time visitor count, or `undefined` when unknown (then hide the counter). */
export function visitorCount(): Promise<number | undefined> {
	return defaultCounter.count();
}

/** Starts the online heartbeat for this tab (call once, in the root layout). */
export function startPresence(): void {
	defaultCounter.startPresence();
}

/** Online-now updates; returns an unsubscribe function. */
export function watchOnline(listener: (online: number) => void): () => void {
	return defaultCounter.watchOnline(listener);
}

/** Thousands separators per CV/UI language: id "12.345", en "12,345". */
export function formatVisitors(value: number, locale: Locale): string {
	return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID').format(value);
}
