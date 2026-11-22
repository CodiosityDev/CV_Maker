/**
 * Backups for logged-in users go ONLY to the user's own Google Drive (owner decision
 * 2026-11-17): the VPS stores shared CVs only. Guests are never affected — their CVs stay in this
 * browser — and nothing runs in incognito.
 *
 *   await backupToDrive();                     // "Simpan ke Drive"
 *   const result = await restoreFrom(await driveClient.restore());
 *   autoBackup.changed();                      // after each editor save (no-op unless logged in)
 *
 * A backup is the backupRepo.export() file of all CVs; the server cleans it again before it is
 * sent to Drive.
 */
import { driveClient, driveConnectUrl, type Result } from '../account/index';
import {
	ACCOUNT_HINT_STORAGE_KEY,
	AUTO_BACKUP_STORAGE_KEY,
	DRIVE_SYNCED_STORAGE_KEY,
	LAST_BACKUP_STORAGE_KEY
} from '../account/hint';
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

/** Default ON once Google Drive is connected. */
export function autoBackupEnabled(): boolean {
	return read(AUTO_BACKUP_STORAGE_KEY) !== '0';
}

export function setAutoBackupEnabled(enabled: boolean): void {
	write(AUTO_BACKUP_STORAGE_KEY, enabled ? null : '0');
}

/** The backup file of all CVs on this device (parsed), plus the newest change time. */
async function backupFile(): Promise<{ file: unknown; latest: string } | null> {
	const list = await cvRepo.list();
	if (!list.length) return null;
	const blob = await backupRepo.export();
	return { file: JSON.parse(await blob.text()) as unknown, latest: list[0]!.updatedAt };
}

/** Saves the backup file to the user's Google Drive (must be connected). */
export async function backupToDrive() {
	// A new device must first take in what is already on Drive, or its (few) CVs would replace the
	// backup of the other device. An unreadable Drive file does not block saving a fresh one.
	if (!driveSynced()) {
		const merged = await mergeFromDrive();
		if (!merged.ok && merged.error !== 'invalid') return merged;
	}
	const data = await backupFile();
	if (!data) return { ok: false, error: 'invalid' } as const;
	const result = await driveClient.save(data.file);
	if (result.ok)
		write(
			LAST_BACKUP_STORAGE_KEY,
			JSON.stringify({ at: new Date().toISOString(), latest: data.latest })
		);
	return result;
}

/** Restores a backup file into this browser (existing ids are added as copies). */
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

/** True once this browser took in the Drive backup after the current login. */
export function driveSynced(): boolean {
	return read(DRIVE_SYNCED_STORAGE_KEY) === '1';
}

const NOTHING: ImportResult = { imported: 0, skipped: 0, copied: 0, updated: 0, ids: [] };

/**
 * Takes the CVs from the Drive backup into this browser WITHOUT duplicates: CVs that are not here
 * yet are added, a CV that is here is replaced only by a newer version. Marks the browser as
 * synced (also when Drive has no backup yet), so it runs once per login per device.
 */
export async function mergeFromDrive(): Promise<Result<ImportResult>> {
	const file = await driveClient.restore();
	if (!file.ok) {
		if (file.error !== 'notFound') return file;
		write(DRIVE_SYNCED_STORAGE_KEY, '1');
		return { ok: true, data: NOTHING };
	}
	try {
		const result = await backupRepo.import(
			new Blob([JSON.stringify(file.data)], { type: 'application/json' }),
			{ merge: true }
		);
		write(DRIVE_SYNCED_STORAGE_KEY, '1');
		return { ok: true, data: result };
	} catch {
		return { ok: false, error: 'invalid' };
	}
}

/** Where "Hubungkan Google Drive" starts (back to `next?drive=connected` or `=failed`). */
export { driveConnectUrl };

export interface DriveStartup {
	/** CVs added or updated from the Drive backup (a new device after login). */
	restored: number;
	/** Logged in (e.g. by email), Drive offered by the server but not connected yet. */
	promptConnect: boolean;
}

/**
 * "CV Saya" on a logged-in browser: on a new device the CVs from the Drive backup appear at once
 * (connected Drive), else the user is invited to connect Drive. Then the usual automatic backup.
 * Guests and incognito: no request at all.
 */
export async function driveStartup(): Promise<DriveStartup> {
	const none: DriveStartup = { restored: 0, promptConnect: false };
	if (incognito.active || read(ACCOUNT_HINT_STORAGE_KEY) !== '1') return none;
	const status = await driveClient.status();
	if (!status.ok || !status.data.available) return none;
	if (!status.data.connected) {
		return { restored: 0, promptConnect: true };
	}
	let restored = 0;
	if (!driveSynced()) {
		const merged = await mergeFromDrive();
		if (merged.ok) restored = merged.data.imported + merged.data.updated;
	}
	void autoBackup.check().catch(() => {});
	return { restored, promptConnect: false };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;

/** Automatic Drive backups while logged in (no request at all for guests). */
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
	/**
	 * Saves to Drive when something changed since the last backup, the interval has passed and
	 * Drive is connected. Returns true when a backup was made.
	 */
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
			const lastAt = last.at ? Date.parse(last.at) : 0;
			if (last.latest === list[0]!.updatedAt || now - lastAt < AUTO_BACKUP_INTERVAL_MS)
				return false;
			const status = await driveClient.status();
			if (!status.ok || !status.data.connected) return false;
			// Never replace the Drive backup before this device took it in (see backupToDrive).
			if (!driveSynced() && !(await mergeFromDrive()).ok) return false;
			return (await backupToDrive()).ok;
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
