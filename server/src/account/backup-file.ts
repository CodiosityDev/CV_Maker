/**
 * Cleans an uploaded backup file with the SAME code the browser uses to restore one
 * (core/storage/backup.ts): size limit, format/version, every CV through the schema, photos
 * sniffed and size-limited, unknown and prototype keys dropped. The cleaned file is what gets
 * stored (VPS) or sent to Google Drive, so a modified client cannot store arbitrary data.
 */
import { createBackupRepository, BackupError } from '../../../src/lib/core/storage/backup';
import { createMemoryBackend } from '../../../src/lib/core/storage/memory-backend';

export interface CleanBackup {
	json: string;
	cvCount: number;
	bytes: number;
}

/** null = not a usable backup (or no readable CV in it). */
export async function cleanBackupFile(text: string): Promise<CleanBackup | null> {
	const backend = createMemoryBackend();
	// Photos were already re-encoded in the browser; here they are validated, not decoded.
	const repo = createBackupRepository(async () => backend, { reencodePhoto: null });
	try {
		const result = await repo.import(new Blob([text], { type: 'application/json' }));
		if (result.imported === 0) return null;
		const json = await (await repo.export()).text();
		return { json, cvCount: result.imported, bytes: Buffer.byteLength(json) };
	} catch (error) {
		if (error instanceof BackupError) return null;
		throw error;
	}
}
