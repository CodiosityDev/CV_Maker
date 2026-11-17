/**
 * Accounts + shared links in MySQL/MariaDB (the Hestia database `el_cvmaker`).
 * Tables are created on start (CREATE TABLE IF NOT EXISTS), like the quota tables.
 *
 * Stored: email, optional name, scrypt password hash, Google account id, session/token HASHES,
 * and — only for CVs the user chose to share — the stripped CV snapshot and photo.
 */
import mysql from 'mysql2/promise';
import type { ServerConfig } from '../config';
import {
	parseShareSettings,
	SHARE_ACCESS,
	type ShareAccess
} from '../../../src/lib/core/share/index';
import type { AccountStore, ReportSummary, ShareRecord, UserRecord } from './store';

const USERS = 'cvmaker_users';
const SESSIONS = 'cvmaker_sessions';
const TOKENS = 'cvmaker_tokens';
const SHARES = 'cvmaker_shares';
const REPORTS = 'cvmaker_share_reports';
const DRIVE = 'cvmaker_drive';

export const ACCOUNT_TABLES = [
	`CREATE TABLE IF NOT EXISTS ${USERS} (
		id CHAR(22) NOT NULL PRIMARY KEY,
		email VARCHAR(254) NOT NULL,
		email_verified TINYINT(1) NOT NULL DEFAULT 0,
		name VARCHAR(80) NOT NULL DEFAULT '',
		password_hash VARCHAR(200) NULL,
		google_sub VARCHAR(64) NULL,
		created_at BIGINT NOT NULL,
		UNIQUE KEY email_uq (email),
		UNIQUE KEY google_uq (google_sub)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	`CREATE TABLE IF NOT EXISTS ${SESSIONS} (
		token_hash CHAR(64) NOT NULL PRIMARY KEY,
		user_id CHAR(22) NOT NULL,
		expires_at BIGINT NOT NULL,
		KEY user_idx (user_id),
		KEY expires_idx (expires_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	`CREATE TABLE IF NOT EXISTS ${TOKENS} (
		token_hash CHAR(64) NOT NULL PRIMARY KEY,
		user_id CHAR(22) NOT NULL,
		purpose VARCHAR(8) NOT NULL,
		expires_at BIGINT NOT NULL,
		KEY user_idx (user_id),
		KEY expires_idx (expires_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	`CREATE TABLE IF NOT EXISTS ${SHARES} (
		id CHAR(22) NOT NULL PRIMARY KEY,
		user_id CHAR(22) NOT NULL,
		cv_id VARCHAR(64) NOT NULL,
		slug VARCHAR(40) NOT NULL,
		access VARCHAR(8) NOT NULL,
		discoverable TINYINT(1) NOT NULL DEFAULT 0,
		settings TEXT NOT NULL,
		snapshot MEDIUMTEXT NOT NULL,
		photo MEDIUMTEXT NULL,
		password_hash VARCHAR(200) NULL,
		expires_at BIGINT NULL,
		view_count INT UNSIGNED NOT NULL DEFAULT 0,
		blocked TINYINT(1) NOT NULL DEFAULT 0,
		created_at BIGINT NOT NULL,
		updated_at BIGINT NOT NULL,
		UNIQUE KEY slug_uq (slug),
		UNIQUE KEY user_cv_uq (user_id, cv_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	`CREATE TABLE IF NOT EXISTS ${REPORTS} (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
		share_id CHAR(22) NOT NULL,
		reason VARCHAR(16) NOT NULL,
		created_at BIGINT NOT NULL,
		KEY share_idx (share_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	`CREATE TABLE IF NOT EXISTS ${DRIVE} (
		user_id CHAR(22) NOT NULL PRIMARY KEY,
		token TEXT NOT NULL,
		file_id VARCHAR(128) NULL,
		last_backup_at BIGINT NULL,
		connected_at BIGINT NOT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

type Row = mysql.RowDataPacket;

function toUser(row: Row | undefined): UserRecord | null {
	if (!row) return null;
	return {
		id: String(row.id),
		email: String(row.email),
		emailVerified: Number(row.email_verified) === 1,
		name: String(row.name ?? ''),
		passwordHash: row.password_hash ? String(row.password_hash) : null,
		googleSub: row.google_sub ? String(row.google_sub) : null,
		createdAt: Number(row.created_at)
	};
}

function toShare(row: Row | undefined): ShareRecord | null {
	if (!row) return null;
	let settings: ReturnType<typeof parseShareSettings>;
	try {
		settings = parseShareSettings(JSON.parse(String(row.settings)));
	} catch {
		settings = null;
	}
	const access = String(row.access);
	if (!settings || !(SHARE_ACCESS as readonly string[]).includes(access)) return null;
	return {
		id: String(row.id),
		userId: String(row.user_id),
		cvId: String(row.cv_id),
		slug: String(row.slug),
		access: access as ShareAccess,
		discoverable: Number(row.discoverable) === 1,
		settings,
		snapshot: String(row.snapshot),
		photo: row.photo ? String(row.photo) : null,
		passwordHash: row.password_hash ? String(row.password_hash) : null,
		expiresAt: row.expires_at === null ? null : Number(row.expires_at),
		viewCount: Number(row.view_count),
		blocked: Number(row.blocked) === 1,
		createdAt: Number(row.created_at),
		updatedAt: Number(row.updated_at)
	};
}

const isDuplicate = (error: unknown) =>
	typeof error === 'object' &&
	error !== null &&
	(error as { code?: unknown }).code === 'ER_DUP_ENTRY';

export async function mysqlAccountStore(
	db: NonNullable<ServerConfig['db']>
): Promise<AccountStore> {
	const pool = mysql.createPool({
		host: db.host,
		port: db.port,
		user: db.user,
		password: db.password,
		database: db.database,
		connectionLimit: 4,
		charset: 'utf8mb4',
		supportBigNumbers: true,
		bigNumberStrings: false
	});
	for (const sql of ACCOUNT_TABLES) await pool.query(sql);

	const one = async (sql: string, params: (string | number | null)[]) => {
		const [rows] = await pool.execute<Row[]>(sql, params);
		return rows[0];
	};

	return {
		async userById(id) {
			return toUser(await one(`SELECT * FROM ${USERS} WHERE id = ?`, [id]));
		},
		async userByEmail(email) {
			return toUser(await one(`SELECT * FROM ${USERS} WHERE email = ?`, [email]));
		},
		async userByGoogle(sub) {
			return toUser(await one(`SELECT * FROM ${USERS} WHERE google_sub = ?`, [sub]));
		},
		async createUser(user) {
			try {
				await pool.execute(
					`INSERT INTO ${USERS} (id, email, email_verified, name, password_hash, google_sub, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[
						user.id,
						user.email,
						user.emailVerified ? 1 : 0,
						user.name,
						user.passwordHash,
						user.googleSub,
						user.createdAt
					]
				);
				return true;
			} catch (error) {
				if (isDuplicate(error)) return false;
				throw error;
			}
		},
		async updateUser(id, patch) {
			const sets: string[] = [];
			const values: (string | number | null)[] = [];
			if (patch.emailVerified !== undefined) {
				sets.push('email_verified = ?');
				values.push(patch.emailVerified ? 1 : 0);
			}
			if (patch.name !== undefined) {
				sets.push('name = ?');
				values.push(patch.name);
			}
			if (patch.passwordHash !== undefined) {
				sets.push('password_hash = ?');
				values.push(patch.passwordHash);
			}
			if (patch.googleSub !== undefined) {
				sets.push('google_sub = ?');
				values.push(patch.googleSub);
			}
			if (!sets.length) return;
			await pool.execute(`UPDATE ${USERS} SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
		},
		async deleteUser(id) {
			const shareIds = (
				await pool.execute<Row[]>(`SELECT id FROM ${SHARES} WHERE user_id = ?`, [id])
			)[0].map((row) => String(row.id));
			for (const shareId of shareIds) {
				await pool.execute(`DELETE FROM ${REPORTS} WHERE share_id = ?`, [shareId]);
			}
			await pool.execute(`DELETE FROM ${SHARES} WHERE user_id = ?`, [id]);
			await pool.execute(`DELETE FROM ${SESSIONS} WHERE user_id = ?`, [id]);
			await pool.execute(`DELETE FROM ${TOKENS} WHERE user_id = ?`, [id]);
			await pool.execute(`DELETE FROM ${DRIVE} WHERE user_id = ?`, [id]);
			await pool.execute(`DELETE FROM ${USERS} WHERE id = ?`, [id]);
		},
		async createSession(hash, userId, expiresAt) {
			await pool.execute(
				`INSERT INTO ${SESSIONS} (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
				[hash, userId, expiresAt]
			);
		},
		async sessionUser(hash, now) {
			return toUser(
				await one(
					`SELECT u.* FROM ${SESSIONS} s JOIN ${USERS} u ON u.id = s.user_id
					 WHERE s.token_hash = ? AND s.expires_at > ?`,
					[hash, now]
				)
			);
		},
		async deleteSession(hash) {
			await pool.execute(`DELETE FROM ${SESSIONS} WHERE token_hash = ?`, [hash]);
		},
		async deleteUserSessions(userId) {
			await pool.execute(`DELETE FROM ${SESSIONS} WHERE user_id = ?`, [userId]);
		},
		async createToken(hash, userId, purpose, expiresAt) {
			await pool.execute(
				`INSERT INTO ${TOKENS} (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)`,
				[hash, userId, purpose, expiresAt]
			);
		},
		async takeToken(hash, purpose, now) {
			const row = await one(`SELECT * FROM ${TOKENS} WHERE token_hash = ?`, [hash]);
			if (!row) return null;
			// Deleting first makes the token single-use even with two requests at once.
			const [result] = await pool.execute<mysql.ResultSetHeader>(
				`DELETE FROM ${TOKENS} WHERE token_hash = ?`,
				[hash]
			);
			if (result.affectedRows !== 1) return null;
			return String(row.purpose) === purpose && Number(row.expires_at) > now
				? String(row.user_id)
				: null;
		},
		async deleteUserTokens(userId, purpose) {
			await pool.execute(`DELETE FROM ${TOKENS} WHERE user_id = ? AND purpose = ?`, [
				userId,
				purpose
			]);
		},
		async sharesOf(userId) {
			const [rows] = await pool.execute<Row[]>(
				`SELECT * FROM ${SHARES} WHERE user_id = ? ORDER BY updated_at DESC`,
				[userId]
			);
			return rows.map(toShare).filter((s): s is ShareRecord => s !== null);
		},
		async share(userId, cvId) {
			return toShare(
				await one(`SELECT * FROM ${SHARES} WHERE user_id = ? AND cv_id = ?`, [userId, cvId])
			);
		},
		async shareBySlug(slug) {
			return toShare(await one(`SELECT * FROM ${SHARES} WHERE slug = ?`, [slug]));
		},
		async saveShare(s) {
			// No "ON DUPLICATE KEY UPDATE": with two unique keys it could update ANOTHER user's row
			// whose slug collides. Update our own row by id, or insert; a duplicate = slug taken.
			try {
				const [updated] = await pool.execute<mysql.ResultSetHeader>(
					`UPDATE ${SHARES} SET slug = ?, access = ?, discoverable = ?, settings = ?, snapshot = ?,
						photo = ?, password_hash = ?, expires_at = ?, updated_at = ?
					 WHERE id = ? AND user_id = ?`,
					[
						s.slug,
						s.access,
						s.discoverable ? 1 : 0,
						JSON.stringify(s.settings),
						s.snapshot,
						s.photo,
						s.passwordHash,
						s.expiresAt,
						s.updatedAt,
						s.id,
						s.userId
					]
				);
				if (updated.affectedRows === 1) return 'ok';
				await pool.execute(
					`INSERT INTO ${SHARES} (id, user_id, cv_id, slug, access, discoverable, settings, snapshot,
						photo, password_hash, expires_at, view_count, blocked, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						s.id,
						s.userId,
						s.cvId,
						s.slug,
						s.access,
						s.discoverable ? 1 : 0,
						JSON.stringify(s.settings),
						s.snapshot,
						s.photo,
						s.passwordHash,
						s.expiresAt,
						s.viewCount,
						s.blocked ? 1 : 0,
						s.createdAt,
						s.updatedAt
					]
				);
				return 'ok';
			} catch (error) {
				if (isDuplicate(error)) return 'taken';
				throw error;
			}
		},
		async deleteShare(userId, cvId) {
			const row = await one(`SELECT id FROM ${SHARES} WHERE user_id = ? AND cv_id = ?`, [
				userId,
				cvId
			]);
			if (!row) return;
			await pool.execute(`DELETE FROM ${REPORTS} WHERE share_id = ?`, [String(row.id)]);
			await pool.execute(`DELETE FROM ${SHARES} WHERE id = ?`, [String(row.id)]);
		},
		async countView(shareId) {
			await pool.execute(`UPDATE ${SHARES} SET view_count = view_count + 1 WHERE id = ?`, [
				shareId
			]);
		},
		async addReport(shareId, reason, at) {
			await pool.execute(`INSERT INTO ${REPORTS} (share_id, reason, created_at) VALUES (?, ?, ?)`, [
				shareId,
				reason,
				at
			]);
		},
		async reportCount(shareId) {
			const row = await one(`SELECT COUNT(*) AS n FROM ${REPORTS} WHERE share_id = ?`, [shareId]);
			return Number(row?.n ?? 0);
		},
		async reportSummaries() {
			const [rows] = await pool.execute<Row[]>(
				`SELECT share_id, reason, COUNT(*) AS n, MAX(created_at) AS last_at FROM ${REPORTS}
				 GROUP BY share_id, reason`
			);
			const byShare = new Map<string, ReportSummary>();
			for (const row of rows) {
				const shareId = String(row.share_id);
				const summary = byShare.get(shareId) ?? { shareId, total: 0, reasons: {}, lastAt: 0 };
				const n = Number(row.n);
				summary.total += n;
				summary.reasons[String(row.reason)] = n;
				summary.lastAt = Math.max(summary.lastAt, Number(row.last_at));
				byShare.set(shareId, summary);
			}
			return [...byShare.values()].sort((a, b) => b.lastAt - a.lastAt);
		},
		async deleteReports(shareId) {
			await pool.execute(`DELETE FROM ${REPORTS} WHERE share_id = ?`, [shareId]);
		},
		async shareById(id) {
			return toShare(await one(`SELECT * FROM ${SHARES} WHERE id = ?`, [id]));
		},
		async setShareBlocked(id, blocked) {
			await pool.execute(`UPDATE ${SHARES} SET blocked = ? WHERE id = ?`, [blocked ? 1 : 0, id]);
		},
		async deleteShareById(id) {
			await pool.execute(`DELETE FROM ${REPORTS} WHERE share_id = ?`, [id]);
			await pool.execute(`DELETE FROM ${SHARES} WHERE id = ?`, [id]);
		},
		async driveLink(userId) {
			const row = await one(`SELECT * FROM ${DRIVE} WHERE user_id = ?`, [userId]);
			if (!row) return null;
			return {
				token: String(row.token),
				fileId: row.file_id ? String(row.file_id) : null,
				lastBackupAt: row.last_backup_at === null ? null : Number(row.last_backup_at),
				connectedAt: Number(row.connected_at)
			};
		},
		async saveDriveLink(userId, link) {
			await pool.execute(
				`INSERT INTO ${DRIVE} (user_id, token, file_id, last_backup_at, connected_at) VALUES (?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE token = VALUES(token), file_id = VALUES(file_id),
					last_backup_at = VALUES(last_backup_at), connected_at = VALUES(connected_at)`,
				[userId, link.token, link.fileId, link.lastBackupAt, link.connectedAt]
			);
		},
		async deleteDriveLink(userId) {
			await pool.execute(`DELETE FROM ${DRIVE} WHERE user_id = ?`, [userId]);
		},
		async prune(now) {
			await pool.execute(`DELETE FROM ${SESSIONS} WHERE expires_at <= ?`, [now]);
			await pool.execute(`DELETE FROM ${TOKENS} WHERE expires_at <= ?`, [now]);
		},
		async close() {
			await pool.end();
		}
	};
}
