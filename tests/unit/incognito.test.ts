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

describe('incognito mode', () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
		vi.stubGlobal('sessionStorage', fakeSessionStorage());
	});
	afterEach(() => {
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
