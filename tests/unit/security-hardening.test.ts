/**
 * Regression tests for the 2026-11-09 security review (data-leak and robustness findings).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeUrl } from '../../src/lib/core/security/url';
import { cleanText } from '../../src/lib/core/schema/schema';
import { matchKeywords } from '../../src/lib/core/ats/keywords';
import { toRenderModel } from '../../src/lib/core/render/index';
import { toPlainText } from '../../src/lib/core/export/index';
import { openIdbBackend } from '../../src/lib/core/storage/idb-backend';
import { createMemoryBackend } from '../../src/lib/core/storage/memory-backend';
import { createRepositories, REMOVE_ORPHAN_MIN_AGE_MS } from '../../src/lib/core/storage/repo';
import { createBackupRepository } from '../../src/lib/core/storage/backup';
import type { StorageBackend, StoredAsset } from '../../src/lib/core/storage/backend';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 1, 2, 3, 4]);

const asset = (id: string, createdAt: string): StoredAsset => ({
	id,
	type: 'image/jpeg',
	bytes: JPEG.slice().buffer,
	width: 10,
	height: 10,
	createdAt
});

describe('sanitizeUrl: malformed and smuggled mailto', () => {
	it('returns undefined instead of throwing on a broken %-escape', () => {
		expect(() => sanitizeUrl('budi%@mail.com')).not.toThrow();
		expect(sanitizeUrl('budi%@mail.com')).toBeUndefined();
		expect(sanitizeUrl('mailto:budi%zz@mail.com')).toBeUndefined();
		expect(sanitizeUrl('https://example.com/%')).toBeDefined(); // plain links unaffected
	});

	it('rejects mailto links carrying cc/bcc/subject/body', () => {
		expect(sanitizeUrl('mailto:a@b.co?bcc=x@evil.example')).toBeUndefined();
		expect(sanitizeUrl('a@b.co?body=hello')).toBeUndefined();
		expect(sanitizeUrl('mailto:a@b.co#x')).toBeUndefined();
		expect(sanitizeUrl('a@b.co')).toBe('mailto:a@b.co');
	});

	it('a CV with such an email still renders and exports', () => {
		const cv = structuredClone(sampleCvAts);
		cv.personal.email = 'budi%@mail.com';
		cv.personal.links = [{ id: 'l1', label: 'Web', url: 'x%@y.co' }];
		const model = toRenderModel(cv);
		expect(model.personal.emailHref).toBeUndefined();
		expect(toPlainText(model)).toContain('budi%@mail.com');
	});
});

describe('cleanText: characters that break DOCX/XML', () => {
	it('drops U+FFFE/U+FFFF and lone surrogates, keeps whole emoji', () => {
		expect(cleanText('a￾b￿c', 100)).toBe('abc');
		expect(cleanText('x\uD800y\uDC00z', 100)).toBe('xyz');
		expect(cleanText('ok 😀', 100)).toBe('ok 😀');
	});

	it('truncating never leaves half an emoji', () => {
		expect(cleanText('ab😀', 3)).toBe('ab'); // the cut fell inside the emoji
		expect(cleanText('ab😀', 4)).toBe('ab😀');
	});
});

describe('ATS keyword matching on hostile job posts', () => {
	it('stays fast on long runs of dots (no regex backtracking)', () => {
		const hostile = `x${'.'.repeat(19_998)}x`;
		const started = performance.now();
		matchKeywords(hostile, 'cv text', []);
		matchKeywords(`${'. '.repeat(5_000)}${'.'.repeat(9_000)}`, 'cv text', []);
		expect(performance.now() - started).toBeLessThan(250);
	});

	it('still drops sentence dots but keeps inner ones', () => {
		const report = matchKeywords(
			'Mahir Excel. Paham node.js dan .NET. Excel. node.js .NET',
			'Saya memakai Excel dan node.js',
			['Excel', 'Node.js', '.NET']
		);
		const byTerm = Object.fromEntries(report.keywords.map((k) => [k.term.toLowerCase(), k]));
		expect(byTerm['excel']?.inCv).toBe(true);
		expect(byTerm['node.js']?.inCv).toBe(true);
	});
});

describe('deleting a CV removes its photos', () => {
	let backend: StorageBackend;
	let repos: ReturnType<typeof createRepositories>;

	beforeEach(async () => {
		globalThis.indexedDB = new IDBFactory();
		backend = await openIdbBackend();
		repos = createRepositories(async () => backend);
	});

	it('also deletes earlier (replaced) photos, but keeps very recent uploads', async () => {
		const old = new Date(Date.now() - REMOVE_ORPHAN_MIN_AGE_MS - 10_000).toISOString();
		const fresh = new Date().toISOString();
		const cv = structuredClone(sampleCvCreative);
		cv.personal.photoAssetId = 'current';
		await backend.putCv(cv);
		await backend.putAsset(asset('current', old));
		await backend.putAsset(asset('replaced', old)); // kept for undo while editing
		await backend.putAsset(asset('uploading', fresh)); // another tab, not saved into a CV yet

		await repos.cvRepo.remove(cv.id);
		expect((await backend.getAllAssetIds()).sort()).toEqual(['uploading']);
	});

	it('deletes the photo of a CV that no longer validates', async () => {
		await backend.putCv({
			id: 'broken',
			schemaVersion: 1,
			personal: { photoAssetId: 'p' }
		} as never);
		await backend.putAsset(asset('p', new Date().toISOString()));
		await repos.cvRepo.remove('broken');
		expect(await backend.getAllAssetIds()).toEqual([]);
	});

	it('housekeeping never deletes photos of CVs it cannot read (e.g. newer app version)', async () => {
		await backend.putCv({
			id: 'future',
			schemaVersion: 99,
			personal: { photoAssetId: 'kept' }
		} as never);
		await backend.putAsset(asset('kept', '2000-01-01T00:00:00.000Z'));
		await backend.putAsset(asset('orphan', '2000-01-01T00:00:00.000Z'));
		expect(await repos.assetRepo.removeOrphans({ minAgeMs: 0 })).toBe(1);
		expect(await backend.getAllAssetIds()).toEqual(['kept']);
	});

	it('rename and duplicate read and write the same storage', async () => {
		const first = createMemoryBackend();
		const second = createMemoryBackend();
		let calls = 0;
		const switching = createRepositories(async () => (calls++ === 0 ? first : second));
		await first.putCv(structuredClone(sampleCvAts));
		await switching.cvRepo.rename(sampleCvAts.id, 'Baru');
		expect(await second.getAllCvs()).toEqual([]);
		const stored = (await first.getCv(sampleCvAts.id)) as { title: string };
		expect(stored.title).toBe('Baru');
	});
});

describe('backup import re-encodes photos', () => {
	const backupWithPhoto = () => {
		const cv = structuredClone(sampleCvCreative);
		cv.personal.photoAssetId = 'p1';
		let binary = '';
		for (const byte of JPEG) binary += String.fromCharCode(byte);
		return new Blob([
			JSON.stringify({
				format: 'cvmaker-backup',
				version: 1,
				cvs: [cv],
				assets: [{ id: 'p1', type: 'image/jpeg', width: 1, height: 1, data: btoa(binary) }]
			})
		]);
	};

	it('stores the re-encoded image (metadata stripped), not the original bytes', async () => {
		const backend = createMemoryBackend();
		const cleaned = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 9]);
		const reencodePhoto = vi.fn(async () => ({
			blob: new Blob([cleaned], { type: 'image/jpeg' }),
			width: 120,
			height: 120
		}));
		const backup = createBackupRepository(async () => backend, { reencodePhoto });
		await backup.import(backupWithPhoto());
		expect(reencodePhoto).toHaveBeenCalledTimes(1);
		const [id] = await backend.getAllAssetIds();
		const stored = await backend.getAsset(id!);
		expect(new Uint8Array(stored!.bytes)).toEqual(cleaned);
		expect(stored!.width).toBe(120);
	});

	it('drops the photo when it cannot be decoded', async () => {
		const backend = createMemoryBackend();
		const backup = createBackupRepository(async () => backend, {
			reencodePhoto: async () => {
				throw new Error('decode failed');
			}
		});
		await backup.import(backupWithPhoto());
		expect(await backend.getAllAssetIds()).toEqual([]);
		const [cv] = (await backend.getAllCvs()) as { personal: { photoAssetId?: string } }[];
		expect(cv!.personal.photoAssetId).toBeUndefined();
	});
});

describe('incognito: back/forward cache and storage switches', () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
		const map = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => void map.set(key, value),
			removeItem: (key: string) => void map.delete(key)
		});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('a page restored from the back/forward cache is erased and reloaded', async () => {
		const page = new EventTarget();
		const reload = vi.fn();
		vi.stubGlobal('window', page);
		vi.stubGlobal('location', { reload });
		vi.resetModules();
		const { cvRepo, incognito } = await import('../../src/lib/core/storage/index');
		incognito.start();
		await cvRepo.create({ kind: 'ats', locale: 'id' });

		page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
		await vi.waitFor(() => expect(incognito.hasData).toBe(true));
		expect(reload).not.toHaveBeenCalled();

		page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
		expect(incognito.hasData).toBe(false);
		expect(await cvRepo.list()).toEqual([]);
		await incognito.end();
	});

	it('an editor opened in incognito never writes after the tab returns to normal storage', async () => {
		vi.resetModules();
		const { cvRepo, incognito } = await import('../../src/lib/core/storage/index');
		const { createCvStore } = await import('../../src/lib/core/store/cv-store.svelte');
		incognito.start();
		const cv = await cvRepo.create({ kind: 'ats', locale: 'id' });
		const store = createCvStore(cv, { listenToPage: false });
		await incognito.end(); // e.g. ended from a place that did not notify this editor

		store.update((draft) => {
			draft.personal.fullName = 'Rahasia Warnet';
		});
		await store.flush();
		expect(await cvRepo.list()).toEqual([]); // nothing reached IndexedDB
		expect(store.externalChange).toBe('removed');
		expect(store.cv.personal.fullName).toBe('');
		await store.destroy();
	});
});
