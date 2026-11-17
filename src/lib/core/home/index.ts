/**
 * "Your CVs" on the home page (like the Google Docs/Forms home): when this browser already has
 * CVs, the landing page shows the newest ones as small paper previews.
 *
 * Used by the PRERENDERED landing page, whose initial JS is at its budget (§10), so this module
 * stays dependency-free (raw IndexedDB, no `idb`, no schema; ~0.8 KB gzip) and the landing loads
 * it with a dynamic `import()` after hydration — never a static import. The heavy part (reading
 * the CVs, building render models) is `./recent.ts`, loaded only when `hasRecentCvs()` is true:
 *
 *   onMount(async () => {
 *     const { hasRecentCvs } = await import('#lib/core/home/index.ts');
 *     if (!(await hasRecentCvs())) return;               // first visit: landing stays as is
 *     const { loadRecentCvs } = await import('#lib/core/home/recent.ts');
 *     const list = await loadRecentCvs();                // newest HOME_RECENT_LIMIT CVs
 *     ...                                                // list.release() on unmount
 *   });
 *
 * Browser-only: call from onMount / event handlers, never during prerender.
 */
import { DB_NAME } from '../storage/db-name';
// Already part of the landing bundle (root layout), so this adds no download.
import { incognito } from '../storage/incognito.svelte.ts';
import type { Locale } from '../schema/types';

/** localStorage key: '0' = the user chose not to show their CVs on the home page. */
export const HOME_RECENT_STORAGE_KEY = 'cvmaker.homeRecent';

/** How many CVs the home page shows (the rest are on /cv). */
export const HOME_RECENT_LIMIT = 4;

/**
 * Whether the user allows their CVs on the home page (default: yes). Turned off from a setting
 * such as "Jangan tampilkan CV di beranda" — useful on shared computers.
 */
export function homeRecentEnabled(): boolean {
	try {
		return localStorage.getItem(HOME_RECENT_STORAGE_KEY) !== '0';
	} catch {
		return true;
	}
}

/** Saves the "show my CVs on the home page" choice for this browser (cleared by `wipeAll`). */
export function setHomeRecentEnabled(enabled: boolean): void {
	try {
		if (enabled) localStorage.removeItem(HOME_RECENT_STORAGE_KEY);
		else localStorage.setItem(HOME_RECENT_STORAGE_KEY, '0');
	} catch {
		// localStorage unavailable: the choice lasts for this page only (nothing to persist).
	}
}

/**
 * Number of CV records stored in this browser's IndexedDB, without loading or validating them.
 * Never creates the database (a first visit must leave no trace) and resolves 0 on any error.
 * Records that later fail validation are counted too, so `loadRecentCvs()` may still return fewer.
 */
export function countStoredCvs(): Promise<number> {
	return new Promise((resolve) => {
		if (typeof indexedDB === 'undefined') return resolve(0);
		let request: IDBOpenDBRequest;
		try {
			request = indexedDB.open(DB_NAME);
		} catch {
			return resolve(0);
		}
		// Fires only when the database does not exist yet: abort so it is not created (empty, at
		// version 1 without stores — the app's own upgrade would then never run).
		request.onupgradeneeded = () => request.transaction?.abort();
		request.onerror = (event) => {
			event.preventDefault();
			resolve(0);
		};
		request.onsuccess = () => {
			const db = request.result;
			db.onversionchange = () => db.close();
			const done = (count: number) => {
				db.close();
				resolve(count);
			};
			try {
				if (!db.objectStoreNames.contains('cvs')) return done(0);
				const count = db.transaction('cvs', 'readonly').objectStore('cvs').count();
				count.onsuccess = () => done(count.result);
				count.onerror = (event) => {
					event.preventDefault();
					done(0);
				};
			} catch {
				done(0);
			}
		};
	});
}

/**
 * True when the home page should switch to the "your CVs" view: CVs exist in this browser, the
 * user has not turned the view off, and this tab is not in incognito mode (incognito CVs live in
 * memory only and must never appear on a page someone else may open next).
 */
export async function hasRecentCvs(): Promise<boolean> {
	if (incognito.active || !homeRecentEnabled()) return false;
	return (await countStoredCvs()) > 0;
}

/**
 * "Diedit 2 jam lalu"-style relative time for a CV's `updatedAt` (the UI adds its own label):
 * `formatEdited(meta.updatedAt, 'id')` → "2 jam yang lalu" / "kemarin" / "baru saja".
 * From 5 weeks on → a short date ("12 Okt 2026"). Future dates (clock skew) read as "now".
 */
export function formatEdited(iso: string, locale: Locale, now: number = Date.now()): string {
	const tag = locale === 'id' ? 'id-ID' : 'en-GB';
	const time = Date.parse(iso);
	if (!Number.isFinite(time)) return '';
	const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
	const ago = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
		rtf.format(-Math.floor(value), unit);
	const minutes = Math.max(0, now - time) / 60_000;
	if (minutes < 1) return rtf.format(0, 'second');
	if (minutes < 60) return ago(minutes, 'minute');
	const hours = minutes / 60;
	if (hours < 24) return ago(hours, 'hour');
	const days = hours / 24;
	if (days < 7) return ago(days, 'day');
	if (days < 35) return ago(days / 7, 'week');
	return new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(time);
}
