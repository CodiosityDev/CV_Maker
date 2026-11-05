import type { CVDocument } from '../schema/types';

/** Photo bytes are stored as ArrayBuffer (more portable than Blob in older iOS IndexedDB). */
export interface StoredAsset {
	id: string;
	type: string;
	bytes: ArrayBuffer;
	width: number;
	height: number;
	createdAt: string;
}

export type StorageMode = 'indexeddb' | 'memory';

/** Low-level persistence. Values read back are UNTRUSTED and must go through `loadCvDocument`. */
export interface StorageBackend {
	readonly mode: StorageMode;
	getCv(id: string): Promise<unknown>;
	getAllCvs(): Promise<unknown[]>;
	putCv(doc: CVDocument): Promise<void>;
	deleteCv(id: string): Promise<void>;
	getAsset(id: string): Promise<StoredAsset | undefined>;
	putAsset(asset: StoredAsset): Promise<void>;
	deleteAsset(id: string): Promise<void>;
	getAllAssetIds(): Promise<string[]>;
	clear(): Promise<void>;
}
