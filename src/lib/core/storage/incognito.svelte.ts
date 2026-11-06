/**
 * Incognito mode — for shared / internet-café computers (owner request).
 *
 * While active, THIS TAB stores CVs and photos only in memory: nothing is written to IndexedDB,
 * nothing is announced to other tabs, and everything disappears when the tab is closed or reloaded.
 * The on/off flag lives in sessionStorage (per tab) so a reload stays incognito instead of silently
 * switching to persistent storage; the flag holds no CV data.
 *
 *   import { incognito } from '#lib/core/storage/index.ts';
 *   incognito.start();            // only when no CV is open (e.g. on /buat or /cv)
 *   incognito.active              // reactive: show a banner, turn browser autofill off
 *   incognito.hasData             // reactive: warn on `beforeunload` / before leaving
 *   await incognito.end();        // erase the in-memory data and return to normal storage
 *
 * Data is also erased automatically after 3 hours without changes (user walked away and left the
 * tab open): `incognito.expiredAt` is set and open editors stop saving (see `onExpire`).
 */
import type { StorageBackend } from './backend';
import { createMemoryBackend } from './memory-backend';

/** sessionStorage key holding '1' while incognito is on (never any CV data). */
export const INCOGNITO_SESSION_KEY = 'cvmaker:incognito';

function readFlag(): boolean {
	try {
		return (
			typeof sessionStorage !== 'undefined' && sessionStorage.getItem(INCOGNITO_SESSION_KEY) === '1'
		);
	} catch {
		return false;
	}
}

function writeFlag(on: boolean): void {
	try {
		if (on) sessionStorage.setItem(INCOGNITO_SESSION_KEY, '1');
		else sessionStorage.removeItem(INCOGNITO_SESSION_KEY);
	} catch {
		// sessionStorage unavailable: the mode still works for this page's lifetime.
	}
}

/** Incognito CVs are erased after this long without changes, even if the tab stays open. */
export const INCOGNITO_IDLE_MS = 3 * 60 * 60 * 1000;
/** How often the idle check runs (wall-clock based, so it also catches a computer that slept). */
const IDLE_CHECK_MS = 60 * 1000;

let active = $state(readFlag());
let hasData = $state(false);
let lastActivity = $state(0);
let expiredAt = $state<string | undefined>();
let backend: StorageBackend | undefined;
let checker: ReturnType<typeof setInterval> | undefined;
// Plain callbacks, not UI state.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const expireListeners = new Set<() => void>();

const onVisible = () => {
	if (document.visibilityState === 'visible') void checkIdle();
};

function startChecker(): void {
	if (checker !== undefined) return;
	checker = setInterval(() => void checkIdle(), IDLE_CHECK_MS);
	if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
}

function stopChecker(): void {
	if (checker === undefined) return;
	clearInterval(checker);
	checker = undefined;
	if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
}

function markActivity(): void {
	lastActivity = Date.now();
	expiredAt = undefined;
	startChecker();
}

/** Erases the session's data once it has been idle for `INCOGNITO_IDLE_MS`. */
async function checkIdle(now = Date.now()): Promise<void> {
	if (!active || !hasData || now - lastActivity < INCOGNITO_IDLE_MS) return;
	await backend?.clear();
	stopChecker();
	expiredAt = new Date(now).toISOString();
	for (const listener of expireListeners) listener();
}

/** Memory backend that keeps `hasData` and the idle timer up to date. */
function createIncognitoBackend(): StorageBackend {
	const inner = createMemoryBackend('incognito');
	const refresh = async () => {
		hasData = (await inner.getAllCvs()).length > 0;
		if (!hasData) stopChecker();
	};
	return {
		...inner,
		mode: 'incognito',
		putCv: async (doc) => {
			await inner.putCv(doc);
			hasData = true;
			markActivity();
		},
		putAsset: async (asset) => {
			await inner.putAsset(asset);
			markActivity();
		},
		deleteCv: async (id) => {
			await inner.deleteCv(id);
			await refresh();
		},
		clear: async () => {
			await inner.clear();
			hasData = false;
			stopChecker();
		}
	};
}

function reset(): void {
	backend = undefined;
	hasData = false;
	lastActivity = 0;
	expiredAt = undefined;
	stopChecker();
}

export const incognito = {
	/** True while this tab keeps data in memory only. Reactive. */
	get active(): boolean {
		return active;
	},
	/** True when at least one CV exists in this incognito session. Reactive. */
	get hasData(): boolean {
		return hasData;
	},
	/**
	 * When the session's data will be erased for inactivity (ISO string), or `undefined` when there
	 * is nothing to erase. Moves forward on every change. Reactive.
	 */
	get expiresAt(): string | undefined {
		// A one-off value converted to a string, not mutable state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		return active && hasData ? new Date(lastActivity + INCOGNITO_IDLE_MS).toISOString() : undefined;
	},
	/** Set (ISO time) after the data was erased for inactivity; cleared by the next change. Reactive. */
	get expiredAt(): string | undefined {
		return expiredAt;
	},
	/**
	 * Switches this tab to memory-only storage (starts empty). Call it only while no CV editor is
	 * open — an open store would keep its document and autosave it into the new memory storage.
	 */
	start(): void {
		if (active) return;
		reset();
		active = true;
		writeFlag(true);
	},
	/** Erases every CV/photo of this incognito session and returns to normal (IndexedDB) storage. */
	async end(): Promise<void> {
		await backend?.clear();
		reset();
		active = false;
		writeFlag(false);
	},
	/** Counts as activity without saving (e.g. the user is reading the preview). */
	touch(): void {
		if (active && hasData) markActivity();
	},
	/** Called after the data was erased for inactivity (open editors must stop saving). */
	onExpire(listener: () => void): () => void {
		expireListeners.add(listener);
		return () => expireListeners.delete(listener);
	},
	/** @internal Runs the idle check now (tests). */
	checkIdle
};

/** @internal Storage backend used while `incognito.active` (created on first use). */
export function incognitoBackend(): StorageBackend {
	backend ??= createIncognitoBackend();
	return backend;
}
