import 'fake-indexeddb/auto'; // installs IDBRequest, IDBKeyRange, ... globals that `idb` needs
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageBackend } from '../../src/lib/core/storage/backend';
import { openIdbBackend } from '../../src/lib/core/storage/idb-backend';
import { createMemoryBackend } from '../../src/lib/core/storage/memory-backend';
import { createRepositories } from '../../src/lib/core/storage/repo';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

const backends: Record<string, () => Promise<StorageBackend>> = {
	indexeddb: () => openIdbBackend(),
	memory: async () => createMemoryBackend()
};

const image = () => ({
	blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
	width: 10,
	height: 10,
	type: 'image/jpeg'
});

for (const [name, open] of Object.entries(backends)) {
	describe(`repositories on ${name}`, () => {
		let backend: StorageBackend;
		let repos: ReturnType<typeof createRepositories>;

		beforeEach(async () => {
			// Fresh, isolated IndexedDB for every test.
			globalThis.indexedDB = new IDBFactory();
			backend = await open();
			repos = createRepositories(async () => backend);
		});

		it('reports its mode', async () => {
			expect(await repos.storage.getMode()).toBe(name);
		});

		it('creates, lists (newest first) and gets CVs', async () => {
			const { cvRepo } = repos;
			const a = await cvRepo.create({ kind: 'ats', locale: 'id' });
			await cvRepo.save({ ...structuredClone(sampleCvAts), updatedAt: '2030-01-01T00:00:00.000Z' });
			const list = await cvRepo.list();
			expect(list.map((m) => m.id)).toEqual([sampleCvAts.id, a.id]);
			expect(list[0]).toMatchObject({ fullName: 'Rizky Aditya Pratama', kind: 'ats' });
			expect(await cvRepo.get(a.id)).toEqual(a);
			expect(await cvRepo.get('missing')).toBeNull();
		});

		it('skips unreadable records instead of failing the whole list', async () => {
			await repos.cvRepo.save(structuredClone(sampleCvAts));
			await backend.putCv({ id: 'broken' } as never);
			expect((await repos.cvRepo.list()).map((m) => m.id)).toEqual([sampleCvAts.id]);
			expect(await repos.cvRepo.get('broken')).toBeNull();
		});

		it('normalizes data read back from storage', async () => {
			const tampered = structuredClone(sampleCvAts) as unknown as Record<string, unknown>;
			tampered.extra = 'should disappear';
			await backend.putCv(tampered as never);
			const cv = (await repos.cvRepo.get(sampleCvAts.id)) as unknown as Record<string, unknown>;
			expect(cv.extra).toBeUndefined();
		});

		it('duplicates with a new id and a "(salinan)" title', async () => {
			await repos.cvRepo.save(structuredClone(sampleCvAts));
			const copy = await repos.cvRepo.duplicate(sampleCvAts.id);
			expect(copy?.id).not.toBe(sampleCvAts.id);
			expect(copy?.title).toBe(`${sampleCvAts.title} (salinan)`);
			expect(copy?.education).toEqual(sampleCvAts.education);
			expect(await repos.cvRepo.list()).toHaveLength(2);
		});

		it('renames (trimmed, ignores blank) and bumps updatedAt', async () => {
			await repos.cvRepo.save(structuredClone(sampleCvAts));
			await repos.cvRepo.rename(sampleCvAts.id, '  CV Bank  ');
			const renamed = await repos.cvRepo.get(sampleCvAts.id);
			expect(renamed?.title).toBe('CV Bank');
			expect(renamed!.updatedAt > sampleCvAts.updatedAt).toBe(true);
			await repos.cvRepo.rename(sampleCvAts.id, '   ');
			expect((await repos.cvRepo.get(sampleCvAts.id))?.title).toBe('CV Bank');
		});

		it('stores photos and deletes them only when no CV uses them', async () => {
			const { cvRepo, assetRepo } = repos;
			const photoId = await assetRepo.putImage(image());
			const blob = await assetRepo.getPhotoBlob(photoId);
			expect(blob?.type).toBe('image/jpeg');
			expect(blob?.size).toBe(4);

			const cv = structuredClone(sampleCvCreative);
			cv.personal.photoAssetId = photoId;
			await cvRepo.save(cv);
			const copy = await cvRepo.duplicate(cv.id);

			await cvRepo.remove(cv.id);
			expect(await assetRepo.getPhotoBlob(photoId)).not.toBeNull(); // still used by the copy
			await cvRepo.remove(copy!.id);
			expect(await assetRepo.getPhotoBlob(photoId)).toBeNull();
		});

		it('removes orphaned photos, but keeps recent ones (undo may restore them)', async () => {
			const used = await repos.assetRepo.putImage(image());
			const recentOrphan = await repos.assetRepo.putImage(image());
			const cv = structuredClone(sampleCvCreative);
			cv.personal.photoAssetId = used;
			await repos.cvRepo.save(cv);

			expect(await repos.assetRepo.removeOrphans()).toBe(0);
			expect(await repos.assetRepo.getPhotoBlob(recentOrphan)).not.toBeNull();

			expect(await repos.assetRepo.removeOrphans({ minAgeMs: 0 })).toBe(1);
			expect(await repos.assetRepo.getPhotoBlob(recentOrphan)).toBeNull();
			expect(await repos.assetRepo.getPhotoBlob(used)).not.toBeNull();
		});

		it('treats orphaned photos with an invalid date as old', async () => {
			await backend.putAsset({
				id: 'legacy',
				type: 'image/jpeg',
				bytes: new ArrayBuffer(1),
				width: 1,
				height: 1,
				createdAt: 'not-a-date'
			});
			expect(await repos.assetRepo.removeOrphans()).toBe(1);
		});

		it('wipes everything', async () => {
			await repos.cvRepo.save(structuredClone(sampleCvAts));
			await repos.assetRepo.putImage(image());
			await repos.storage.wipeAll();
			expect(await repos.cvRepo.list()).toEqual([]);
			expect(await backend.getAllAssetIds()).toEqual([]);
		});
	});
}
