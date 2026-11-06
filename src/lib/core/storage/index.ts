/**
 * Storage entry point for the app.
 *
 *   import { cvRepo, assetRepo, storage } from '#lib/core/storage/index.ts';
 *
 * Browser-only: call these from onMount / event handlers / client-only routes, never during SSR.
 */
import type { StorageBackend } from './backend';
import { openIdbBackend } from './idb-backend';
import { createMemoryBackend } from './memory-backend';
import { createRepositories } from './repo';
import { createBackupRepository } from './backup';
import { incognito, incognitoBackend } from './incognito.svelte.ts';

let backendPromise: Promise<StorageBackend> | undefined;

/** Opens IndexedDB once; falls back to in-memory storage if it is unavailable. */
function getBackend(): Promise<StorageBackend> {
	if (incognito.active) return Promise.resolve(incognitoBackend());
	backendPromise ??= (async () => {
		if (typeof indexedDB === 'undefined') return createMemoryBackend();
		try {
			return await openIdbBackend();
		} catch {
			return createMemoryBackend();
		}
	})();
	return backendPromise;
}

export const { cvRepo, assetRepo, storage } = createRepositories(getBackend);
/** Backup (export JSON) and restore (import JSON) of CVs incl. photos. */
export const backupRepo = createBackupRepository(getBackend);

export { createRepositories, LOCAL_STORAGE_KEYS, ORPHAN_MIN_AGE_MS } from './repo';
export {
	createBackupRepository,
	BackupError,
	BACKUP_FORMAT,
	BACKUP_VERSION,
	BACKUP_LIMITS,
	type BackupRepository,
	type ImportResult,
	type ImportErrorCode
} from './backup';
export type { CvRepository, AssetRepository, StorageControl } from './repo';
export type { StorageBackend, StorageMode, StoredAsset } from './backend';
export { createMemoryBackend } from './memory-backend';
export { openIdbBackend, DB_NAME } from './idb-backend';
export { onExternalChange, TAB_ID, type SyncEvent } from './sync';
export { incognito, INCOGNITO_SESSION_KEY } from './incognito.svelte.ts';
