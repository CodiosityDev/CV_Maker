/**
 * Cloud backup for logged-in users (owner: on by default when logged in; Google Drive is a free
 * extra). Guests are never affected: their CVs stay only in this browser. Never runs in incognito.
 *
 *   await backupNow();                         // "Cadangkan sekarang"
 *   const result = await restoreFrom(file);    // file from backupClient.get / driveClient.restore
 *   autoBackup.changed();                      // after each editor save (cheap when not logged in)
 *
 * A backup is the same file format as backupRepo.export() and holds at most MAX_CVS CVs (the
 * newest ones); the server cleans it again before storing it.
 */
import { backupClient, driveClient, type Result } from '../account/index';
import {
	ACCOUNT_HINT_STORAGE_KEY,
	AUTO_BACKUP_STORAGE_KEY,
	LAST_BACKUP_STORAGE_KEY
} from '../account/hint';
import { MAX_CVS } from '../schema/limits';
import { backupRepo, cvRepo, incognito, type ImportResult } from '../storage/index';

/** Automatic backups: at most this often (and only after a change). */
export const AUTO_BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const AUTO_DELAY_MS = 2 * 60 * 1000;

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// localStorage unavailable: automatic backup simply stays off.
	}
}

/** Default ON for logged-in users. */
export function autoBackupEnabled(): boolean {
	return read(AUTO_BACKUP_STORAGE_KEY) !== '0';
}

export function setAutoBackupEnabled(enabled: boolean): void {
	write(AUTO_BACKUP_STORAGE_KEY, enabled ? null : '0');
}

/** When the last automatic/manual backup from this browser ran (ISO), if any. */
export function lastBackupAt(): string | null {
	try {
		const data = JSON.parse(read(LAST_BACKUP_STORAGE_KEY) ?? 'null') as { at?: unknown } | null;
		return typeof data?.at === 'string' ? data.at : null;
	} catch {
		return null;
	}
}

/** The backup file of the newest MAX_CVS CVs (parsed), plus the newest change time. */
async function backupFile(): Promise<{ file: unknown; latest: string } | null> {
	const list = await cvRepo.list();
	if (!list.length) return null;
	const newest = list.slice(0, MAX_CVS);
	const blob = await backupRepo.export(newest.map((cv) => cv.id));
	return { file: JSON.parse(await blob.text()) as unknown, latest: newest[0]!.updatedAt };
}

/** Uploads a backup to the user's account on this server. */
export async function backupNow() {
	const data = await backupFile();
	if (!data) return { ok: false, error: 'invalid' } as const;
	const result = await backupClient.create(data.file);
	if (result.ok)
		write(
			LAST_BACKUP_STORAGE_KEY,
			JSON.stringify({ at: new Date().toISOString(), latest: data.latest })
		);
	return result;
}

/** Saves the backup file to the user's Google Drive (must be connected). */
export async function backupToDrive() {
	const data = await backupFile();
	if (!data) return { ok: false, error: 'invalid' } as const;
	return driveClient.save(data.file);
}

/** Restores a backup file into this browser (respects MAX_CVS; existing ids become copies). */
export async function restoreFrom(file: Result<unknown>): Promise<Result<ImportResult>> {
	if (!file.ok) return file;
	try {
		const result = await backupRepo.import(
			new Blob([JSON.stringify(file.data)], { type: 'application/json' })
		);
		return { ok: true, data: result };
	} catch {
		return { ok: false, error: 'invalid' };
	}
}

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;

/** Automatic backups while logged in (decided without contacting the server for guests). */
export const autoBackup = {
	/** Call after an editor save: backs up a couple of minutes later if due. */
	changed(): void {
		if (!this.possible()) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			void this.check();
		}, AUTO_DELAY_MS);
	},
	/** Only browsers that logged in, with auto backup on, outside incognito. */
	possible(): boolean {
		return !incognito.active && read(ACCOUNT_HINT_STORAGE_KEY) === '1' && autoBackupEnabled();
	},
	/** Backs up now when something changed since the last backup and the interval has passed. */
	async check(now: number = Date.now()): Promise<boolean> {
		if (running || !this.possible()) return false;
		running = true;
		try {
			const list = await cvRepo.list();
			if (!list.length) return false;
			let last: { at?: string; latest?: string } = {};
			try {
				last = JSON.parse(read(LAST_BACKUP_STORAGE_KEY) ?? '{}') as typeof last;
			} catch {
				last = {};
			}
			const latest = list[0]!.updatedAt;
			const lastAt = last.at ? Date.parse(last.at) : 0;
			if (last.latest === latest || now - lastAt < AUTO_BACKUP_INTERVAL_MS) return false;
			const result = await backupNow();
			return result.ok;
		} finally {
			running = false;
		}
	},
	/** Stops a pending automatic backup (logout, account deleted). */
	cancel(): void {
		if (timer) clearTimeout(timer);
		timer = undefined;
	}
};
