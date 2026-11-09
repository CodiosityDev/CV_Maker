/**
 * Quota counters in MySQL/MariaDB (the database created in the Hestia panel). The table is created
 * on start. One row per (scope, subject, day); old days are pruned. All-time counters (visitors)
 * live in a second table that is never pruned. No CV content is ever stored.
 */
import mysql from 'mysql2/promise';
import type { QuotaStore } from './quota';
import type { ServerConfig } from './config';

const TABLE = 'cvmaker_ai_usage';
const TOTALS = 'cvmaker_totals';

export async function mysqlQuotaStore(db: NonNullable<ServerConfig['db']>): Promise<QuotaStore> {
	const pool = mysql.createPool({
		host: db.host,
		port: db.port,
		user: db.user,
		password: db.password,
		database: db.database,
		connectionLimit: 4,
		charset: 'utf8mb4',
		timezone: 'Z',
		dateStrings: true
	});
	await pool.query(
		`CREATE TABLE IF NOT EXISTS ${TABLE} (
			scope VARCHAR(8) NOT NULL,
			subject VARCHAR(64) NOT NULL,
			day DATE NOT NULL,
			used INT UNSIGNED NOT NULL DEFAULT 0,
			PRIMARY KEY (scope, subject, day),
			KEY day_idx (day)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
	);
	await pool.query(
		`CREATE TABLE IF NOT EXISTS ${TOTALS} (
			name VARCHAR(32) NOT NULL PRIMARY KEY,
			value BIGINT UNSIGNED NOT NULL DEFAULT 0
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
	);
	const total = async (name: string): Promise<number> => {
		const [rows] = await pool.execute<mysql.RowDataPacket[]>(
			`SELECT value FROM ${TOTALS} WHERE name = ?`,
			[name]
		);
		return Number(rows[0]?.value ?? 0);
	};

	return {
		async increment(scope, subject, day, limit) {
			await pool.execute(
				`INSERT IGNORE INTO ${TABLE} (scope, subject, day, used) VALUES (?, ?, ?, 0)`,
				[scope, subject, day]
			);
			// The WHERE makes "matched" equal "changed", so affectedRows is 1 only when there was room.
			const [result] = await pool.execute<mysql.ResultSetHeader>(
				`UPDATE ${TABLE} SET used = used + 1 WHERE scope = ? AND subject = ? AND day = ? AND used < ?`,
				[scope, subject, day, limit]
			);
			return result.affectedRows === 1;
		},
		async decrement(scope, subject, day) {
			await pool.execute(
				`UPDATE ${TABLE} SET used = used - 1 WHERE scope = ? AND subject = ? AND day = ? AND used > 0`,
				[scope, subject, day]
			);
		},
		async used(scope, subject, day) {
			const [rows] = await pool.execute<mysql.RowDataPacket[]>(
				`SELECT used FROM ${TABLE} WHERE scope = ? AND subject = ? AND day = ?`,
				[scope, subject, day]
			);
			return Number(rows[0]?.used ?? 0);
		},
		async prune(beforeDay) {
			await pool.execute(`DELETE FROM ${TABLE} WHERE day < ?`, [beforeDay]);
		},
		async addTotal(name) {
			await pool.execute(
				`INSERT INTO ${TOTALS} (name, value) VALUES (?, 1) ON DUPLICATE KEY UPDATE value = value + 1`,
				[name]
			);
			return total(name);
		},
		total,
		async close() {
			await pool.end();
		}
	};
}
