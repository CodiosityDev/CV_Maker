/**
 * Backup & restore (PROJECT_SPEC §8, §11.6). A backup is a JSON file the user keeps; importing treats
 * it as UNTRUSTED input:
 * - size limit, JSON parse guarded, format/version checked
 * - every CV goes through `loadCvDocument` (validation, truncation, unknown/prototype keys dropped)
 * - photos: only JPEG/PNG/WebP, size-limited, base64 decoded defensively, always stored under NEW ids
 * - CV id already on this device → imported as a copy with a new id (never overwrites)
 */
import { newId } from '../schema/ids';
import { loadCvDocument } from '../schema/migrations';
import type { CVDocument } from '../schema/types';
import type { StorageBackend, StoredAsset } from './backend';
import { broadcast } from './sync';

export const BACKUP_FORMAT = 'cvmaker-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_LIMITS = {
	maxFileBytes: 5 * 1024 * 1024,
	maxCvs: 100,
	maxPhotoBytes: 512 * 1024
} as const;

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface BackupAsset {
	id: string;
	type: string;
	width: number;
	height: number;
	createdAt: string;
	data: string; // base64
}

export interface BackupFile {
	format: typeof BACKUP_FORMAT;
	version: typeof BACKUP_VERSION;
	exportedAt: string;
	cvs: CVDocument[];
	assets: BackupAsset[];
}

export type ImportErrorCode = 'too-large' | 'invalid-json' | 'not-a-backup' | 'newer-version';

export class BackupError extends Error {
	readonly code: ImportErrorCode;
	constructor(code: ImportErrorCode) {
		super(`backup: ${code}`);
		this.name = 'BackupError';
		this.code = code;
	}
}

export interface ImportResult {
	/** CVs added to this device. */
	imported: number;
	/** CVs in the file that were unreadable and skipped. */
	skipped: number;
	/** CVs whose id already existed here and were added as copies with a new id. */
	copied: number;
	/** Ids of the CVs as stored on this device (for "open" links). */
	ids: string[];
}

export interface BackupRepository {
	/** JSON backup of the given CVs (or all) including their photos. */
	export(ids?: string[]): Promise<Blob>;
	/** Restore from a backup file. Throws `BackupError` for unusable files. */
	import(file: Blob): Promise<ImportResult>;
}

// --- base64 helpers (work in browsers and Node) ---------------------------------------------

function toBase64(bytes: ArrayBuffer): string {
	const view = new Uint8Array(bytes);
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < view.length; i += chunk) {
		binary += String.fromCharCode(...view.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function fromBase64(data: string): ArrayBuffer | undefined {
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) return undefined;
	try {
		const binary = atob(data);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes.buffer;
	} catch {
		return undefined;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function readAsset(raw: unknown): StoredAsset | undefined {
	if (!isRecord(raw)) return undefined;
	const { type, width, height, data } = raw;
	if (typeof type !== 'string' || !PHOTO_TYPES.has(type)) return undefined;
	if (typeof data !== 'string' || data.length > (BACKUP_LIMITS.maxPhotoBytes * 4) / 3 + 4)
		return undefined;
	const bytes = fromBase64(data);
	if (!bytes || bytes.byteLength === 0 || bytes.byteLength > BACKUP_LIMITS.maxPhotoBytes)
		return undefined;
	const dim = (n: unknown) =>
		typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 4000 ? n : 1;
	return {
		id: newId(),
		type,
		bytes,
		width: dim(width),
		height: dim(height),
		createdAt: new Date().toISOString()
	};
}

// --- repository --------------------------------------------------------------------------------

export function createBackupRepository(
	getBackend: () => Promise<StorageBackend>
): BackupRepository {
	return {
		async export(ids) {
			const backend = await getBackend();
			const wanted = ids ? new Set(ids) : undefined;
			const cvs: CVDocument[] = [];
			for (const raw of await backend.getAllCvs()) {
				const result = loadCvDocument(raw);
				if (result.ok && (!wanted || wanted.has(result.cv.id))) cvs.push(result.cv);
			}
			const assets: BackupAsset[] = [];
			const assetIds = new Set(
				cvs.map((cv) => cv.personal.photoAssetId).filter((id): id is string => Boolean(id))
			);
			for (const id of assetIds) {
				const asset = await backend.getAsset(id);
				if (!asset) continue;
				assets.push({
					id: asset.id,
					type: asset.type,
					width: asset.width,
					height: asset.height,
					createdAt: asset.createdAt,
					data: toBase64(asset.bytes)
				});
			}
			const file: BackupFile = {
				format: BACKUP_FORMAT,
				version: BACKUP_VERSION,
				exportedAt: new Date().toISOString(),
				cvs,
				assets
			};
			return new Blob([JSON.stringify(file)], { type: 'application/json' });
		},

		async import(file) {
			if (file.size > BACKUP_LIMITS.maxFileBytes) throw new BackupError('too-large');
			let parsed: unknown;
			try {
				parsed = JSON.parse(await file.text());
			} catch {
				throw new BackupError('invalid-json');
			}
			if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || !Array.isArray(parsed.cvs)) {
				throw new BackupError('not-a-backup');
			}
			if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
				throw new BackupError('newer-version');
			}

			const backend = await getBackend();
			const existing = new Set<string>();
			for (const raw of await backend.getAllCvs()) {
				if (isRecord(raw) && typeof raw.id === 'string') existing.add(raw.id);
			}

			// Photos by their id in the file → validated asset with a fresh id.
			const assetsInFile = new Map<string, unknown>();
			if (Array.isArray(parsed.assets)) {
				for (const raw of parsed.assets) {
					if (isRecord(raw) && typeof raw.id === 'string') assetsInFile.set(raw.id, raw);
				}
			}
			const storedAssets = new Map<string, string>();

			const result: ImportResult = { imported: 0, skipped: 0, copied: 0, ids: [] };
			for (const raw of parsed.cvs.slice(0, BACKUP_LIMITS.maxCvs)) {
				const loaded = loadCvDocument(raw);
				if (!loaded.ok) {
					result.skipped += 1;
					continue;
				}
				const cv = loaded.cv;
				if (existing.has(cv.id)) {
					cv.id = newId();
					result.copied += 1;
				}

				const photoId = cv.personal.photoAssetId;
				if (photoId) {
					let newPhotoId = storedAssets.get(photoId);
					if (!newPhotoId) {
						const asset = readAsset(assetsInFile.get(photoId));
						if (asset) {
							await backend.putAsset(asset);
							storedAssets.set(photoId, asset.id);
							newPhotoId = asset.id;
						}
					}
					cv.personal.photoAssetId = newPhotoId;
				}

				await backend.putCv(cv);
				existing.add(cv.id);
				broadcast({ type: 'cv-saved', id: cv.id, updatedAt: cv.updatedAt });
				result.imported += 1;
				result.ids.push(cv.id);
			}
			result.skipped += Math.max(0, parsed.cvs.length - BACKUP_LIMITS.maxCvs);
			return result;
		}
	};
}
