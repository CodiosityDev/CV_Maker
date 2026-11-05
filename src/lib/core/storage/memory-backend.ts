import type { CVDocument } from '../schema/types';
import type { StorageBackend, StoredAsset } from './backend';

/**
 * Fallback when IndexedDB is unavailable (some private-browsing modes).
 * Data lives only until the tab is closed — the UI must warn the user (storage.getMode() === 'memory').
 */
export function createMemoryBackend(): StorageBackend {
	const cvs = new Map<string, CVDocument>();
	const assets = new Map<string, StoredAsset>();

	return {
		mode: 'memory',
		getCv: async (id) => structuredClone(cvs.get(id)),
		getAllCvs: async () => [...cvs.values()].map((doc) => structuredClone(doc)),
		putCv: async (doc) => {
			cvs.set(doc.id, structuredClone(doc));
		},
		deleteCv: async (id) => {
			cvs.delete(id);
		},
		getAsset: async (id) => {
			const asset = assets.get(id);
			return asset ? { ...asset, bytes: asset.bytes.slice(0) } : undefined;
		},
		putAsset: async (asset) => {
			assets.set(asset.id, { ...asset, bytes: asset.bytes.slice(0) });
		},
		deleteAsset: async (id) => {
			assets.delete(id);
		},
		getAllAssetIds: async () => [...assets.keys()],
		clear: async () => {
			cvs.clear();
			assets.clear();
		}
	};
}
