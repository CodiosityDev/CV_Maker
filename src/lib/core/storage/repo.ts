import { UI_LOCALE_STORAGE_KEY } from '../../i18n/types';
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
export const LOCAL_STORAGE_KEYS = [UI_LOCALE_STORAGE_KEY] as const;

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
			const backend = await getBackend();
			const raw = await backend.getCv(id);
			if (raw === undefined) return null;
			const result = loadCvDocument(raw);
			if (!result.ok) return null;
			if (result.migrated) await backend.putCv(result.cv);
			return result.cv;
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
			const source = await cvRepo.get(id);
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
			await put(await getBackend(), copy);
			return copy;
		},

		async rename(id, title) {
			const doc = await cvRepo.get(id);
			if (!doc) return;
			const cleaned = cleanText(title, LIMITS.cvTitle).trim();
			if (!cleaned) return;
			await put(await getBackend(), {
				...doc,
				title: cleaned,
				updatedAt: new Date().toISOString()
			});
		},

		async remove(id) {
			const backend = await getBackend();
			const doc = await cvRepo.get(id);
			await backend.deleteCv(id);
			const photoId = doc?.personal.photoAssetId;
			if (photoId) {
				const others = await loadAll(backend);
				if (!others.some((other) => other.personal.photoAssetId === photoId)) {
					await backend.deleteAsset(photoId);
				}
			}
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
			const backend = await getBackend();
			const used = new Set(
				(await loadAll(backend))
					.map((doc) => doc.personal.photoAssetId)
					.filter((id): id is string => id !== undefined)
			);
			const cutoff = Date.now() - minAgeMs;
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
