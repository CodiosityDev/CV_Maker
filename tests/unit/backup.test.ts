import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { openIdbBackend } from '../../src/lib/core/storage/idb-backend';
import { createRepositories } from '../../src/lib/core/storage/repo';
import {
	BACKUP_LIMITS,
	BackupError,
	createBackupRepository,
	type BackupRepository
} from '../../src/lib/core/storage/backup';
import type { StorageBackend } from '../../src/lib/core/storage/backend';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

const jpeg = () => ({
	blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: 'image/jpeg' }),
	width: 10,
	height: 10,
	type: 'image/jpeg'
});

const jsonFile = (value: unknown) =>
	new Blob([JSON.stringify(value)], { type: 'application/json' });

describe('backup & restore', () => {
	let backend: StorageBackend;
	let repos: ReturnType<typeof createRepositories>;
	let backup: BackupRepository;

	beforeEach(async () => {
		globalThis.indexedDB = new IDBFactory();
		backend = await openIdbBackend();
		repos = createRepositories(async () => backend);
		backup = createBackupRepository(async () => backend);
	});

	async function freshDevice() {
		globalThis.indexedDB = new IDBFactory();
		backend = await openIdbBackend();
		repos = createRepositories(async () => backend);
		backup = createBackupRepository(async () => backend);
	}

	it('round-trips CVs and photos to another device', async () => {
		const photoId = await repos.assetRepo.putImage(jpeg());
		const creative = structuredClone(sampleCvCreative);
		creative.personal.photoAssetId = photoId;
		await repos.cvRepo.save(structuredClone(sampleCvAts));
		await repos.cvRepo.save(creative);

		const file = await backup.export();
		await freshDevice();
		const result = await backup.import(file);

		expect(result).toMatchObject({ imported: 2, skipped: 0, copied: 0 });
		const restored = await repos.cvRepo.get(sampleCvCreative.id);
		expect(restored?.experience).toEqual(sampleCvCreative.experience);
		const restoredPhoto = restored?.personal.photoAssetId;
		expect(restoredPhoto).toBeDefined();
		expect(restoredPhoto).not.toBe(photoId); // stored under a fresh id
		const blob = await repos.assetRepo.getPhotoBlob(restoredPhoto!);
		expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(
			new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])
		);
	});

	it('exports only the requested CVs', async () => {
		await repos.cvRepo.save(structuredClone(sampleCvAts));
		await repos.cvRepo.save(structuredClone(sampleCvCreative));
		const parsed = JSON.parse(await (await backup.export([sampleCvAts.id])).text());
		expect(parsed.cvs.map((cv: { id: string }) => cv.id)).toEqual([sampleCvAts.id]);
		expect(parsed).toMatchObject({ format: 'cvmaker-backup', version: 1 });
	});

	it('never overwrites: an existing id is imported as a copy', async () => {
		await repos.cvRepo.save(structuredClone(sampleCvAts));
		const file = await backup.export();
		const result = await backup.import(file);
		expect(result).toMatchObject({ imported: 1, copied: 1 });
		expect(result.ids[0]).not.toBe(sampleCvAts.id);
		expect(await repos.cvRepo.list()).toHaveLength(2);
	});

	it('rejects files that are too large, not JSON, not a backup, or from a newer app', async () => {
		const big = new Blob([new Uint8Array(BACKUP_LIMITS.maxFileBytes + 1)]);
		await expect(backup.import(big)).rejects.toMatchObject({ code: 'too-large' });
		await expect(backup.import(new Blob(['{nope']))).rejects.toMatchObject({
			code: 'invalid-json'
		});
		await expect(backup.import(jsonFile({ hello: 'world' }))).rejects.toMatchObject({
			code: 'not-a-backup'
		});
		await expect(
			backup.import(jsonFile({ format: 'cvmaker-backup', version: 99, cvs: [] }))
		).rejects.toBeInstanceOf(BackupError);
	});

	it('skips broken CVs and strips dangerous keys', async () => {
		const tampered = JSON.parse(JSON.stringify(sampleCvAts));
		const raw = JSON.parse(
			JSON.stringify({
				format: 'cvmaker-backup',
				version: 1,
				cvs: [tampered, { id: 'x' }, 42]
			}).replace('"summary":', '"__proto__":{"polluted":true},"evil":"<script>","summary":')
		);
		const result = await backup.import(jsonFile(raw));
		expect(result).toMatchObject({ imported: 1, skipped: 2 });
		const stored = (await repos.cvRepo.get(sampleCvAts.id)) as unknown as Record<string, unknown>;
		expect(Object.hasOwn(stored, 'evil')).toBe(false);
		expect(Object.hasOwn(stored, '__proto__')).toBe(false);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('drops photos that are not safe images', async () => {
		const cv = structuredClone(sampleCvCreative);
		cv.personal.photoAssetId = 'p1';
		const html = btoa('<svg onload=alert(1)>');
		const file = jsonFile({
			format: 'cvmaker-backup',
			version: 1,
			cvs: [cv],
			assets: [{ id: 'p1', type: 'image/svg+xml', width: 1, height: 1, data: html }]
		});
		await backup.import(file);
		const stored = await repos.cvRepo.get(sampleCvCreative.id);
		expect(stored?.personal.photoAssetId).toBeUndefined();
		expect(await backend.getAllAssetIds()).toEqual([]);
	});

	it('drops photos with invalid base64', async () => {
		const cv = structuredClone(sampleCvCreative);
		cv.personal.photoAssetId = 'p1';
		const file = jsonFile({
			format: 'cvmaker-backup',
			version: 1,
			cvs: [cv],
			assets: [{ id: 'p1', type: 'image/jpeg', width: 1, height: 1, data: '###not-base64###' }]
		});
		await backup.import(file);
		expect((await repos.cvRepo.get(sampleCvCreative.id))?.personal.photoAssetId).toBeUndefined();
	});

	it('limits the number of CVs per import', async () => {
		const cvs = Array.from({ length: BACKUP_LIMITS.maxCvs + 3 }, (_, i) => ({
			...structuredClone(sampleCvAts),
			id: `cv-${i}`
		}));
		const result = await backup.import(jsonFile({ format: 'cvmaker-backup', version: 1, cvs }));
		expect(result.imported).toBe(BACKUP_LIMITS.maxCvs);
		expect(result.skipped).toBe(3);
	});
});
