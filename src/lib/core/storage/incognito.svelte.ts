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

let active = $state(readFlag());
let hasData = $state(false);
let backend: StorageBackend | undefined;

/** Memory backend that keeps `hasData` up to date. */
function createIncognitoBackend(): StorageBackend {
	const inner = createMemoryBackend('incognito');
	const refresh = async () => {
		hasData = (await inner.getAllCvs()).length > 0;
	};
	return {
		...inner,
		mode: 'incognito',
		putCv: async (doc) => {
			await inner.putCv(doc);
			hasData = true;
		},
		deleteCv: async (id) => {
			await inner.deleteCv(id);
			await refresh();
		},
		clear: async () => {
			await inner.clear();
			hasData = false;
		}
	};
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
	 * Switches this tab to memory-only storage (starts empty). Call it only while no CV editor is
	 * open — an open store would keep its document and autosave it into the new memory storage.
	 */
	start(): void {
		if (active) return;
		backend = undefined;
		hasData = false;
		active = true;
		writeFlag(true);
	},
	/** Erases every CV/photo of this incognito session and returns to normal (IndexedDB) storage. */
	async end(): Promise<void> {
		await backend?.clear();
		backend = undefined;
		hasData = false;
		active = false;
		writeFlag(false);
	}
};

/** @internal Storage backend used while `incognito.active` (created on first use). */
export function incognitoBackend(): StorageBackend {
	backend ??= createIncognitoBackend();
	return backend;
}
