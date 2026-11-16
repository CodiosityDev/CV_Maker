import { incognito } from '#lib/core/storage/index.ts';

// Download reminders carry no CV content and stay in memory during an Incognito session.
const state = $state({
	downloaded: {} as Record<string, boolean>,
	skipped: {} as Record<string, boolean>
});
const prefix = 'cvmaker.letterOffer.skip.';
const key = (id: string) => `${prefix}${id}`;
let sessionMode = incognito.active;
let sessionExpiry = incognito.expiredAt;

/** Forget in-memory reminders whenever the storage session changes or expires. */
export function syncLetterOfferSession(): void {
	const mode = incognito.active;
	const expiry = incognito.expiredAt;
	if (mode !== sessionMode || (expiry && expiry !== sessionExpiry)) {
		state.downloaded = {};
		state.skipped = {};
	}
	sessionMode = mode;
	sessionExpiry = expiry;
}

/** UI preferences belong to the deleted CV, even when deletion finishes after navigation. */
export function removeLetterOffer(id: string, persistent = !incognito.active): void {
	delete state.downloaded[id];
	delete state.skipped[id];
	if (!persistent) return;
	try {
		localStorage.removeItem(key(id));
	} catch {
		/* Storage can be unavailable on a shared or restricted browser. */
	}
}

/** Clear this UI-owned preference without changing the core storage key registry. */
export function clearLetterOffers(persistent = !incognito.active): void {
	state.downloaded = {};
	state.skipped = {};
	if (!persistent) return;
	try {
		for (let index = localStorage.length - 1; index >= 0; index -= 1) {
			const storageKey = localStorage.key(index);
			if (storageKey?.startsWith(prefix)) localStorage.removeItem(storageKey);
		}
	} catch {
		/* The memory reminder is still cleared when localStorage is unavailable. */
	}
}

export function markCvDownloaded(id: string): void {
	syncLetterOfferSession();
	state.downloaded[id] = true;
}
export function didDownloadCv(id: string): boolean {
	return Boolean(state.downloaded[id]);
}
export function didSkipLetter(id: string): boolean {
	return Boolean(state.skipped[id]);
}
export function readLetterOffer(id: string): void {
	syncLetterOfferSession();
	if (incognito.active) return;
	try {
		state.skipped[id] = localStorage.getItem(key(id)) === '1';
	} catch {
		/* Unavailable storage leaves the optional reminder dismissible for this page. */
	}
}
export function skipLetterOffer(id: string): void {
	syncLetterOfferSession();
	state.skipped[id] = true;
	if (incognito.active) return;
	try {
		localStorage.setItem(key(id), '1');
	} catch {
		/* Remember in memory when localStorage is unavailable. */
	}
}
