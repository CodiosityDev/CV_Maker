/** localStorage '1' after a login on this browser (no account data). See session.svelte.ts. */
export const ACCOUNT_HINT_STORAGE_KEY = 'cvmaker.account';
/** localStorage '0' = the user turned automatic cloud backup off (default: on when logged in). */
export const AUTO_BACKUP_STORAGE_KEY = 'cvmaker.autoBackup';
/** localStorage JSON { at, latest } of the last automatic backup (time + newest CV change). */
export const LAST_BACKUP_STORAGE_KEY = 'cvmaker.lastBackup';
/** localStorage '1' once this browser merged the Drive backup in after a login (new device). */
export const DRIVE_SYNCED_STORAGE_KEY = 'cvmaker.driveSynced';
