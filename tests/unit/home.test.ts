import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import {
	countStoredCvs,
	formatEdited,
	hasRecentCvs,
	HOME_RECENT_STORAGE_KEY,
	homeRecentEnabled,
	setHomeRecentEnabled
} from '../../src/lib/core/home/index';
import { loadRecentCvs } from '../../src/lib/core/home/recent';
import { DB_NAME } from '../../src/lib/core/storage/db-name';
import { incognito } from '../../src/lib/core/storage/incognito.svelte.ts';
import { openIdbBackend } from '../../src/lib/core/storage/idb-backend';
import { createMemoryBackend } from '../../src/lib/core/storage/memory-backend';
import { createRepositories, LOCAL_STORAGE_KEYS } from '../../src/lib/core/storage/repo';

function fakeStorage(): Storage {
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

async function databaseNames(): Promise<string[]> {
	return (await indexedDB.databases()).map((db) => db.name ?? '');
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory();
	vi.stubGlobal('localStorage', fakeStorage());
	vi.stubGlobal('sessionStorage', fakeStorage());
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('countStoredCvs / hasRecentCvs', () => {
	it('is 0 on a first visit and does NOT create the database', async () => {
		expect(await countStoredCvs()).toBe(0);
		expect(await hasRecentCvs()).toBe(false);
		expect(await databaseNames()).not.toContain(DB_NAME);
		// The app can still create and upgrade its database normally afterwards.
		const backend = await openIdbBackend();
		await backend.putCv(structuredClone(sampleCvAts));
		expect(await countStoredCvs()).toBe(1);
	});

	it('counts stored CVs without needing them to be valid', async () => {
		const { cvRepo } = createRepositories(openIdbBackend);
		await cvRepo.save(structuredClone(sampleCvAts));
		await cvRepo.save(structuredClone(sampleCvCreative));
		expect(await countStoredCvs()).toBe(2);
		expect(await hasRecentCvs()).toBe(true);
	});

	it('is 0 for an existing database without the cvs store', async () => {
		await new Promise<void>((resolve) => {
			const request = indexedDB.open(DB_NAME, 1);
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
		});
		expect(await countStoredCvs()).toBe(0);
	});

	it('resolves 0 when IndexedDB is unavailable or throws', async () => {
		vi.stubGlobal('indexedDB', undefined);
		expect(await countStoredCvs()).toBe(0);
		vi.stubGlobal('indexedDB', {
			open: () => {
				throw new Error('SecurityError');
			}
		});
		expect(await countStoredCvs()).toBe(0);
	});

	it('hides the CVs in incognito tabs and when the user turned the view off', async () => {
		await createRepositories(openIdbBackend).cvRepo.save(structuredClone(sampleCvAts));
		expect(await hasRecentCvs()).toBe(true);

		incognito.start();
		expect(await hasRecentCvs()).toBe(false);
		await incognito.end();

		setHomeRecentEnabled(false);
		expect(homeRecentEnabled()).toBe(false);
		expect(localStorage.getItem(HOME_RECENT_STORAGE_KEY)).toBe('0');
		expect(await hasRecentCvs()).toBe(false);

		setHomeRecentEnabled(true);
		expect(localStorage.getItem(HOME_RECENT_STORAGE_KEY)).toBeNull();
		expect(await hasRecentCvs()).toBe(true);
	});

	it('defaults to enabled when localStorage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		});
		expect(homeRecentEnabled()).toBe(true);
		expect(() => setHomeRecentEnabled(false)).not.toThrow();
	});

	it('the setting is removed by wipeAll', () => {
		expect(LOCAL_STORAGE_KEYS).toContain(HOME_RECENT_STORAGE_KEY);
	});
});

describe('loadRecentCvs', () => {
	const photo = () => ({
		blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
		width: 10,
		height: 10,
		type: 'image/jpeg'
	});

	async function setup() {
		const backend = createMemoryBackend();
		const repos = createRepositories(async () => backend);
		return { backend, repos };
	}

	it('returns the newest CVs first, limited, with render models', async () => {
		const { repos } = await setup();
		for (let i = 0; i < 6; i++) {
			await repos.cvRepo.save({
				...structuredClone(sampleCvAts),
				id: `cv-${i}`,
				title: `CV ${i}`,
				updatedAt: `2026-11-0${i + 1}T00:00:00.000Z`
			});
		}
		const list = await loadRecentCvs({ repos });
		expect(list.items.map((item) => item.meta.id)).toEqual(['cv-5', 'cv-4', 'cv-3', 'cv-2']);
		expect(list.items[0]?.meta.title).toBe('CV 5');
		expect(list.items[0]?.model.personal.fullName).toBe(sampleCvAts.personal.fullName);
		expect((await loadRecentCvs({ repos, limit: Infinity })).items).toHaveLength(6);
		expect((await loadRecentCvs({ repos, limit: -1 })).items).toHaveLength(0);
	});

	it('is empty when no CV can be read', async () => {
		const { backend, repos } = await setup();
		await backend.putCv({ id: 'broken' } as never);
		expect((await loadRecentCvs({ repos })).items).toEqual([]);
	});

	it('loads photos for Creative CVs only and revokes them on release', async () => {
		const { repos } = await setup();
		const photoId = await repos.assetRepo.putImage(photo());
		await repos.cvRepo.save({
			...structuredClone(sampleCvCreative),
			personal: { ...sampleCvCreative.personal, photoAssetId: photoId }
		});
		await repos.cvRepo.save({
			...structuredClone(sampleCvAts),
			personal: { ...sampleCvAts.personal, photoAssetId: photoId }
		});
		const created: string[] = [];
		const revoked: string[] = [];
		vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
			created.push(`blob:${created.length}`);
			return created.at(-1) as string;
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));

		const list = await loadRecentCvs({ repos });
		const creative = list.items.find((item) => item.meta.kind === 'creative');
		const ats = list.items.find((item) => item.meta.kind === 'ats');
		expect(creative?.model.personal.photoUrl).toBe('blob:0');
		expect(ats?.model.personal.photoUrl).toBeUndefined();
		expect(created).toHaveLength(1);

		list.release();
		list.release();
		expect(revoked).toEqual(['blob:0']);
		vi.restoreAllMocks();
	});

	it('a missing photo is not an error', async () => {
		const { repos } = await setup();
		await repos.cvRepo.save({
			...structuredClone(sampleCvCreative),
			personal: { ...sampleCvCreative.personal, photoAssetId: 'gone' }
		});
		const list = await loadRecentCvs({ repos });
		expect(list.items).toHaveLength(1);
		expect(list.items[0]?.model.personal.photoUrl).toBeUndefined();
	});
});

describe('formatEdited', () => {
	const now = Date.parse('2026-11-17T12:00:00.000Z');
	const ago = (ms: number) => new Date(now - ms).toISOString();
	const MIN = 60_000;

	it('reads like "2 jam yang lalu" in Indonesian and English', () => {
		expect(formatEdited(ago(10_000), 'id', now)).toBe('sekarang');
		expect(formatEdited(ago(5 * MIN), 'id', now)).toBe('5 menit yang lalu');
		expect(formatEdited(ago(2 * 60 * MIN), 'id', now)).toBe('2 jam yang lalu');
		expect(formatEdited(ago(25 * 60 * MIN), 'id', now)).toBe('kemarin');
		expect(formatEdited(ago(3 * 24 * 60 * MIN), 'en', now)).toBe('3 days ago');
		expect(formatEdited(ago(14 * 24 * 60 * MIN), 'en', now)).toBe('2 weeks ago');
	});

	it('shows a date from 5 weeks on, "now" for future times, "" for invalid input', () => {
		expect(formatEdited('2026-09-01T12:00:00.000Z', 'en', now)).toBe('1 Sept 2026');
		expect(formatEdited(new Date(now + 60 * MIN).toISOString(), 'en', now)).toBe('now');
		expect(formatEdited('not a date', 'id', now)).toBe('');
	});
});
