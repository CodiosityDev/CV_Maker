import { UI_LOCALE_STORAGE_KEY } from '../../i18n/types';
import { AI_DEVICE_STORAGE_KEY } from '../ai/types';
import { createEmptyCv } from '../schema/defaults';
import { newId } from '../schema/ids';
import { LIMITS } from '../schema/limits';
import { loadCvDocument } from '../schema/migrations';
import { toCvMeta } from '../schema/meta';
import { cleanText } from '../schema/schema';
import type { CVDocument, CVKind, CVMeta, Locale } from '../schema/types';
import { processPhoto, type ProcessedPhoto } from '../security/photo';
import type { StorageBackend, StorageMode } from './backend';
import { broadcast } from './sync';

/**
 * The ONLY way UI code reads/writes CVs (PROJECT_SPEC §6).
 * Phase 2 (cloud sync) will provide another implementation of this interface.
 */
export interface CvRepository {
	/** All CVs on this device, most recently updated first. */
	list(): Promise<CVMeta[]>;
	/** `null` if not found or unreadable. Old schema versions are migrated (and re-saved) transparently. */
	get(id: string): Promise<CVDocument | null>;
	create(init: { kind: CVKind; locale: Locale; title?: string }): Promise<CVDocument>;
	/** Pass a PLAIN object (`$state.snapshot(cv)`), not a reactive proxy. Does not touch `updatedAt`. */
	save(doc: CVDocument): Promise<void>;
	duplicate(id: string): Promise<CVDocument | null>;
	rename(id: string, title: string): Promise<void>;
	/** Deletes the CV and its photo (unless another CV still uses that photo). */
	remove(id: string): Promise<void>;
}

export interface AssetRepository {
	/** Processes (resize + strip EXIF) and stores a photo. Returns the asset id. Throws `PhotoError`. */
	putPhoto(file: Blob): Promise<string>;
	/** Stores an already processed image (used by putPhoto and backup import). */
	putImage(image: ProcessedPhoto): Promise<string>;
	getPhotoBlob(id: string): Promise<Blob | null>;
	/** Object URL for <img src>. The caller MUST call `URL.revokeObjectURL()` when done. */
	getPhotoUrl(id: string): Promise<string | null>;
	/**
	 * Deletes a photo immediately. Do NOT call this when the user replaces/removes a photo in the
	 * editor: undo may bring the old photo back. Old photos are cleaned up by `removeOrphans()`.
	 */
	remove(id: string): Promise<void>;
	/**
	 * Deletes photos that no CV refers to AND that are older than `minAgeMs` (default 24 h).
	 * The age guard keeps photos that an open editor's undo history may still restore.
	 * Call once when the app area opens. Returns how many were removed.
	 */
	removeOrphans(options?: { minAgeMs?: number }): Promise<number>;
}

/** Orphaned photos younger than this are kept (undo safety). */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * When a CV is deleted, unused photos older than this go too (earlier photos of that CV, kept for
 * undo). Younger ones may belong to an upload in another tab that is about to be saved.
 */
export const REMOVE_ORPHAN_MIN_AGE_MS = 60 * 1000;

export interface StorageControl {
	/** 'memory' means data will be lost when the tab closes → show a warning. */
	getMode(): Promise<StorageMode>;
	/** Deletes ALL CVs, photos and preferences on this device. */
	wipeAll(): Promise<void>;
	/** Asks the browser not to evict our data under storage pressure. */
	requestPersistence(): Promise<boolean>;
	isPersisted(): Promise<boolean>;
}

const COPY_SUFFIX: Record<Locale, string> = { id: '(salinan)', en: '(copy)' };

/** Keys in localStorage owned by this app (removed by wipeAll). */
export const LOCAL_STORAGE_KEYS = [UI_LOCALE_STORAGE_KEY, AI_DEVICE_STORAGE_KEY] as const;

/** `personal.photoAssetId` of an untrusted stored record, if it is a string. */
function rawPhotoId(raw: unknown): string | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const personal = (raw as { personal?: unknown }).personal;
	if (typeof personal !== 'object' || personal === null) return undefined;
	const id = (personal as { photoAssetId?: unknown }).photoAssetId;
	return typeof id === 'string' && id ? id : undefined;
}

export function createRepositories(getBackend: () => Promise<StorageBackend>): {
	cvRepo: CvRepository;
	assetRepo: AssetRepository;
	storage: StorageControl;
} {
	async function loadAll(backend: StorageBackend): Promise<CVDocument[]> {
		const docs: CVDocument[] = [];
		for (const raw of await backend.getAllCvs()) {
			const result = loadCvDocument(raw);
			if (result.ok) docs.push(result.cv);
		}
		return docs;
	}

	/** Photo ids referenced by any stored CV — read from the RAW records, so photos of CVs that
	 * fail validation (e.g. written by a newer app version in another tab) are never deleted. */
	async function referencedPhotoIds(backend: StorageBackend): Promise<Set<string>> {
		const ids = new Set<string>();
		for (const raw of await backend.getAllCvs()) {
			const id = rawPhotoId(raw);
			if (id) ids.add(id);
		}
		return ids;
	}

	async function getFrom(backend: StorageBackend, id: string): Promise<CVDocument | null> {
		const raw = await backend.getCv(id);
		if (raw === undefined) return null;
		const result = loadCvDocument(raw);
		if (!result.ok) return null;
		if (result.migrated) await backend.putCv(result.cv);
		return result.cv;
	}

	/** Deletes unused photos created before `cutoff` (ms since epoch). */
	async function deleteOrphans(backend: StorageBackend, cutoff: number): Promise<number> {
		const used = await referencedPhotoIds(backend);
		let removed = 0;
		for (const id of await backend.getAllAssetIds()) {
			if (used.has(id)) continue;
			const asset = await backend.getAsset(id);
			const createdAt = asset ? Date.parse(asset.createdAt) : Number.NaN;
			// Unknown/invalid dates count as old: such records can't be from this session.
			if (Number.isFinite(createdAt) && createdAt > cutoff) continue;
			await backend.deleteAsset(id);
			removed += 1;
		}
		return removed;
	}

	async function put(backend: StorageBackend, doc: CVDocument): Promise<void> {
		await backend.putCv(doc);
		broadcast({ type: 'cv-saved', id: doc.id, updatedAt: doc.updatedAt });
	}

	const cvRepo: CvRepository = {
		async list() {
			const docs = await loadAll(await getBackend());
			return docs.map(toCvMeta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		},

		async get(id) {
			return getFrom(await getBackend(), id);
		},

		async create(init) {
			const backend = await getBackend();
			const title = init.title === undefined ? undefined : cleanText(init.title, LIMITS.cvTitle);
			const doc = createEmptyCv({ kind: init.kind, locale: init.locale, title });
			await put(backend, doc);
			return doc;
		},

		async save(doc) {
			await put(await getBackend(), doc);
		},

		async duplicate(id) {
			// One backend per operation: never read from one storage and write to another.
			const backend = await getBackend();
			const source = await getFrom(backend, id);
			if (!source) return null;
			const now = new Date().toISOString();
			const suffix = COPY_SUFFIX[source.locale];
			const copy: CVDocument = {
				...structuredClone(source),
				id: newId(),
				title: cleanText(`${source.title} ${suffix}`, LIMITS.cvTitle),
				createdAt: now,
				updatedAt: now
			};
			await put(backend, copy);
			return copy;
		},

		async rename(id, title) {
			const backend = await getBackend();
			const doc = await getFrom(backend, id);
			if (!doc) return;
			const cleaned = cleanText(title, LIMITS.cvTitle).trim();
			if (!cleaned) return;
			await put(backend, {
				...doc,
				title: cleaned,
				updatedAt: new Date().toISOString()
			});
		},

		async remove(id) {
			const backend = await getBackend();
			// Raw record: the photo goes even if the CV itself no longer validates.
			const photoId = rawPhotoId(await backend.getCv(id));
			await backend.deleteCv(id);
			if (photoId && !(await referencedPhotoIds(backend)).has(photoId)) {
				await backend.deleteAsset(photoId);
			}
			// Earlier photos of this CV (kept for undo) are no longer needed either.
			await deleteOrphans(backend, Date.now() - REMOVE_ORPHAN_MIN_AGE_MS);
			broadcast({ type: 'cv-removed', id });
		}
	};

	const assetRepo: AssetRepository = {
		async putPhoto(file) {
			return assetRepo.putImage(await processPhoto(file));
		},

		async putImage(image) {
			const id = newId();
			await (
				await getBackend()
			).putAsset({
				id,
				type: image.type,
				bytes: await image.blob.arrayBuffer(),
				width: image.width,
				height: image.height,
				createdAt: new Date().toISOString()
			});
			return id;
		},

		async getPhotoBlob(id) {
			const asset = await (await getBackend()).getAsset(id);
			return asset ? new Blob([asset.bytes], { type: asset.type }) : null;
		},

		async getPhotoUrl(id) {
			const blob = await assetRepo.getPhotoBlob(id);
			return blob ? URL.createObjectURL(blob) : null;
		},

		async remove(id) {
			await (await getBackend()).deleteAsset(id);
		},

		async removeOrphans(options = {}) {
			const minAgeMs = options.minAgeMs ?? ORPHAN_MIN_AGE_MS;
			return deleteOrphans(await getBackend(), Date.now() - minAgeMs);
		}
	};

	const storage: StorageControl = {
		async getMode() {
			return (await getBackend()).mode;
		},

		async wipeAll() {
			await (await getBackend()).clear();
			try {
				for (const key of LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
			} catch {
				// localStorage may be unavailable; nothing else to clear.
			}
			broadcast({ type: 'wiped' });
		},

		async requestPersistence() {
			if ((await getBackend()).mode !== 'indexeddb') return false;
			try {
				return (await navigator.storage?.persist?.()) ?? false;
			} catch {
				return false;
			}
		},

		async isPersisted() {
			try {
				return (await navigator.storage?.persisted?.()) ?? false;
			} catch {
				return false;
			}
		}
	};

	return { cvRepo, assetRepo, storage };
}
