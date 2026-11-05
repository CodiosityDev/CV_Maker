import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CVDocument } from '../schema/types';
import type { StorageBackend, StoredAsset } from './backend';

export const DB_NAME = 'cvmaker';
const DB_VERSION = 1;

interface CvMakerDB extends DBSchema {
	cvs: { key: string; value: CVDocument };
	assets: { key: string; value: StoredAsset };
	/** Reserved for small app preferences (created now so adding them later needs no DB upgrade). */
	meta: { key: string; value: unknown };
}

export async function openIdbBackend(): Promise<StorageBackend> {
	// `blocking` only fires later (another tab upgrading), never during this await, so `db` is set by then.
	const db: IDBPDatabase<CvMakerDB> = await openDB<CvMakerDB>(DB_NAME, DB_VERSION, {
		upgrade(database) {
			if (!database.objectStoreNames.contains('cvs')) {
				database.createObjectStore('cvs', { keyPath: 'id' });
			}
			if (!database.objectStoreNames.contains('assets')) {
				database.createObjectStore('assets', { keyPath: 'id' });
			}
			if (!database.objectStoreNames.contains('meta')) {
				database.createObjectStore('meta');
			}
		},
		blocking() {
			// A newer version was opened in another tab: release it so that tab can upgrade.
			db.close();
		}
	});

	return {
		mode: 'indexeddb',
		getCv: (id) => db.get('cvs', id),
		getAllCvs: () => db.getAll('cvs'),
		putCv: async (doc) => {
			await db.put('cvs', doc);
		},
		deleteCv: (id) => db.delete('cvs', id),
		getAsset: (id) => db.get('assets', id),
		putAsset: async (asset) => {
			await db.put('assets', asset);
		},
		deleteAsset: (id) => db.delete('assets', id),
		getAllAssetIds: () => db.getAllKeys('assets'),
		clear: async () => {
			const tx = db.transaction(['cvs', 'assets', 'meta'], 'readwrite');
			await Promise.all([
				tx.objectStore('cvs').clear(),
				tx.objectStore('assets').clear(),
				tx.objectStore('meta').clear(),
				tx.done
			]);
		}
	};
}
