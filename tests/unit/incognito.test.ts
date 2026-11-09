import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sniffImageType } from '../../src/lib/core/security/image-type';

/** Minimal per-tab sessionStorage. */
function fakeSessionStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => void map.delete(key),
		setItem: (key, value) => void map.set(key, String(value))
	};
}

/** Fresh module graph = a fresh "tab" (module state, sessionStorage flag read at load). */
async function openTab() {
	vi.resetModules();
	return import('../../src/lib/core/storage/index');
}

// Each test re-imports the storage modules from scratch (a fresh "tab"); on a busy machine that
// cold import alone can exceed the default 5 s.
describe('incognito mode', { timeout: 30_000 }, () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
		vi.stubGlobal('sessionStorage', fakeSessionStorage());
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('keeps CVs in memory only and never touches persistent storage', async () => {
		const { cvRepo, storage, incognito } = await openTab();
		const persistent = await cvRepo.create({ kind: 'ats', locale: 'id', title: 'Disimpan' });

		incognito.start();
		expect(incognito.active).toBe(true);
		expect(await storage.getMode()).toBe('incognito');
		expect(await storage.requestPersistence()).toBe(false);
		expect(await cvRepo.list()).toEqual([]); // starts empty, persistent CVs are not shown
		expect(incognito.hasData).toBe(false);

		const secret = await cvRepo.create({ kind: 'ats', locale: 'id', title: 'Rahasia' });
		expect(incognito.hasData).toBe(true);
		expect((await cvRepo.list()).map((cv) => cv.id)).toEqual([secret.id]);

		await incognito.end();
		expect(incognito.active).toBe(false);
		expect(incognito.hasData).toBe(false);
		expect((await cvRepo.list()).map((cv) => cv.id)).toEqual([persistent.id]);
		expect(await cvRepo.get(secret.id)).toBeNull();
	});

	it('end() erases the session data, and a new session starts empty', async () => {
		const { cvRepo, incognito } = await openTab();
		incognito.start();
		await cvRepo.create({ kind: 'creative', locale: 'en' });
		await incognito.end();
		incognito.start();
		expect(await cvRepo.list()).toEqual([]);
		await incognito.end();
	});

	it('hasData follows deletes and wipeAll', async () => {
		const { cvRepo, storage, incognito } = await openTab();
		incognito.start();
		const a = await cvRepo.create({ kind: 'ats', locale: 'id' });
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		await cvRepo.remove(a.id);
		expect(incognito.hasData).toBe(true);
		await storage.wipeAll();
		expect(incognito.hasData).toBe(false);
		await incognito.end();
	});

	it('survives a reload of the same tab as incognito (but the data is gone)', async () => {
		const first = await openTab();
		first.incognito.start();
		await first.cvRepo.create({ kind: 'ats', locale: 'id' });

		const reloaded = await openTab(); // same sessionStorage, new page
		expect(reloaded.incognito.active).toBe(true);
		expect(await reloaded.storage.getMode()).toBe('incognito');
		expect(await reloaded.cvRepo.list()).toEqual([]);
		await reloaded.incognito.end();
		expect(sessionStorage.getItem(reloaded.INCOGNITO_SESSION_KEY)).toBeNull();
	});

	it('does not announce incognito changes to other tabs nor react to theirs', async () => {
		const posted: unknown[] = [];
		const listeners: ((message: MessageEvent) => void)[] = [];
		class FakeChannel {
			postMessage(data: unknown) {
				posted.push(data);
			}
			addEventListener(_: string, listener: (message: MessageEvent) => void) {
				listeners.push(listener);
			}
			removeEventListener() {}
		}
		vi.stubGlobal('window', globalThis);
		vi.stubGlobal('BroadcastChannel', FakeChannel);
		const { cvRepo, incognito, onExternalChange } = await openTab();
		const received: unknown[] = [];
		onExternalChange((event) => received.push(event));

		incognito.start();
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		expect(posted).toEqual([]);
		for (const listener of listeners)
			listener({ data: { type: 'wiped', from: 'other-tab' } } as MessageEvent);
		expect(received).toEqual([]);

		await incognito.end();
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		expect(posted).toHaveLength(1);
	});
});

describe('incognito idle auto-erase', { timeout: 30_000 }, () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
		vi.stubGlobal('sessionStorage', fakeSessionStorage());
		// Only the clock and the idle interval: fake-indexeddb needs real setTimeout/setImmediate.
		vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('erases the data after 3 hours without changes, even with the tab open', async () => {
		const { cvRepo, incognito, INCOGNITO_IDLE_MS } = await openTab();
		const persistent = await cvRepo.create({ kind: 'ats', locale: 'id' });
		incognito.start();
		const expired = vi.fn();
		incognito.onExpire(expired);
		expect(incognito.expiresAt).toBeUndefined();

		const cv = await cvRepo.create({ kind: 'ats', locale: 'id' });
		expect(incognito.expiresAt).toBe(new Date(Date.now() + INCOGNITO_IDLE_MS).toISOString());

		// A change shortly before the deadline moves it forward.
		await vi.advanceTimersByTimeAsync(INCOGNITO_IDLE_MS - 5 * 60_000);
		await cvRepo.save({ ...cv, title: 'Masih dipakai' });
		await vi.advanceTimersByTimeAsync(INCOGNITO_IDLE_MS - 2 * 60_000);
		expect(await cvRepo.list()).toHaveLength(1);
		expect(expired).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(3 * 60_000);
		expect(await cvRepo.list()).toEqual([]);
		expect(incognito.hasData).toBe(false);
		expect(incognito.active).toBe(true); // still incognito, just empty
		expect(incognito.expiredAt).toBeDefined();
		expect(incognito.expiresAt).toBeUndefined();
		expect(expired).toHaveBeenCalledTimes(1);

		// A new CV starts a new session; the notice clears.
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		expect(incognito.expiredAt).toBeUndefined();

		// Persistent data was never touched.
		await incognito.end();
		expect((await cvRepo.list()).map((item) => item.id)).toEqual([persistent.id]);
	});

	it('uses the wall clock, so a computer that slept is caught on the next check', async () => {
		const { cvRepo, incognito, INCOGNITO_IDLE_MS } = await openTab();
		incognito.start();
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		await incognito.checkIdle(Date.now() + INCOGNITO_IDLE_MS - 1);
		expect(incognito.hasData).toBe(true);
		await incognito.checkIdle(Date.now() + INCOGNITO_IDLE_MS + 1);
		expect(incognito.hasData).toBe(false);
	});

	it('touch() counts as activity', async () => {
		const { cvRepo, incognito, INCOGNITO_IDLE_MS } = await openTab();
		incognito.start();
		await cvRepo.create({ kind: 'ats', locale: 'id' });
		await vi.advanceTimersByTimeAsync(INCOGNITO_IDLE_MS - 5 * 60_000);
		incognito.touch();
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(incognito.hasData).toBe(true);
	});

	it('an open editor stops saving once the data was erased', async () => {
		const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
		vi.stubGlobal('window', new EventTarget());
		vi.stubGlobal('document', page);
		const { cvRepo, incognito, INCOGNITO_IDLE_MS } = await openTab();
		const { createCvStore } = await import('../../src/lib/core/store/cv-store.svelte');
		incognito.start();
		const cv = await cvRepo.create({ kind: 'ats', locale: 'id' });
		const store = createCvStore(cv, { repo: cvRepo });

		await vi.advanceTimersByTimeAsync(INCOGNITO_IDLE_MS + 2 * 60_000);
		expect(store.externalChange).toBe('removed');

		store.update((draft) => {
			draft.personal.fullName = 'Tidak boleh tersimpan';
		});
		await store.flush();
		expect(await cvRepo.list()).toEqual([]);
		await store.destroy();
		await incognito.end();
	});
});

describe('sniffImageType', () => {
	it('recognises JPEG, PNG and WebP by their bytes', () => {
		expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(
			sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))
		).toBe('image/png');
		const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
		expect(sniffImageType(webp)).toBe('image/webp');
	});

	it('rejects anything else', () => {
		expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeUndefined();
		expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WAVE'))).toBeUndefined();
		expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeUndefined();
		expect(sniffImageType(new ArrayBuffer(0))).toBeUndefined();
	});
});
