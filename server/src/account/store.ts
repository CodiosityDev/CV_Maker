/**
 * Account storage interface + an in-memory version (tests, local development).
 * Production: MySQL (store-mysql.ts). Times are epoch milliseconds.
 */
import type { ShareAccess, ShareSettings } from '../../../src/lib/core/share/index';

export interface UserRecord {
	id: string;
	/** Lowercased. */
	email: string;
	emailVerified: boolean;
	name: string;
	passwordHash: string | null;
	googleSub: string | null;
	createdAt: number;
}

export type UserPatch = Partial<
	Pick<UserRecord, 'emailVerified' | 'name' | 'passwordHash' | 'googleSub'>
>;

export interface ShareRecord {
	id: string;
	userId: string;
	cvId: string;
	slug: string;
	access: ShareAccess;
	discoverable: boolean;
	settings: ShareSettings;
	/** CVDocument JSON, already stripped of hidden fields. */
	snapshot: string;
	photo: string | null;
	passwordHash: string | null;
	expiresAt: number | null;
	viewCount: number;
	/** Set by the site owner (e.g. after a report): the link stops working. */
	blocked: boolean;
	createdAt: number;
	updatedAt: number;
}

export type TokenPurpose = 'verify' | 'reset';

export interface ReportSummary {
	shareId: string;
	total: number;
	/** Count per reason (REPORT_REASONS). */
	reasons: Record<string, number>;
	lastAt: number;
}

export interface DriveLink {
	/** Refresh token, sealed with secret-box.ts. */
	token: string;
	fileId: string | null;
	lastBackupAt: number | null;
	connectedAt: number;
}

export interface AccountStore {
	userById(id: string): Promise<UserRecord | null>;
	userByEmail(email: string): Promise<UserRecord | null>;
	userByGoogle(sub: string): Promise<UserRecord | null>;
	/** false when the email or Google account is already used. */
	createUser(user: UserRecord): Promise<boolean>;
	updateUser(id: string, patch: UserPatch): Promise<void>;
	/** Also deletes the user's sessions, email tokens, shared links and Drive link. */
	deleteUser(id: string): Promise<void>;

	createSession(hash: string, userId: string, expiresAt: number): Promise<void>;
	/** The session's user, or null when unknown/expired. */
	sessionUser(hash: string, now: number): Promise<UserRecord | null>;
	deleteSession(hash: string): Promise<void>;
	deleteUserSessions(userId: string): Promise<void>;

	createToken(
		hash: string,
		userId: string,
		purpose: TokenPurpose,
		expiresAt: number
	): Promise<void>;
	/** Single use: returns the user id and deletes the token. */
	takeToken(hash: string, purpose: TokenPurpose, now: number): Promise<string | null>;
	deleteUserTokens(userId: string, purpose: TokenPurpose): Promise<void>;

	sharesOf(userId: string): Promise<ShareRecord[]>;
	share(userId: string, cvId: string): Promise<ShareRecord | null>;
	shareBySlug(slug: string): Promise<ShareRecord | null>;
	/** Insert or replace (by user + CV). 'taken' when the slug belongs to another link. */
	saveShare(record: ShareRecord): Promise<'ok' | 'taken'>;
	deleteShare(userId: string, cvId: string): Promise<void>;
	countView(shareId: string): Promise<void>;
	addReport(shareId: string, reason: string, at: number): Promise<void>;
	/** Reports so far for one shared CV. */
	reportCount(shareId: string): Promise<number>;
	/** Admin: every reported shared CV with its report counts, most recent first. */
	reportSummaries(): Promise<ReportSummary[]>;
	/** Admin: dismiss (delete) the reports of a shared CV. */
	deleteReports(shareId: string): Promise<void>;
	shareById(id: string): Promise<ShareRecord | null>;
	/** Admin: a blocked link answers 404 to everyone; the owner cannot re-enable it. */
	setShareBlocked(id: string, blocked: boolean): Promise<void>;
	/** Admin: delete a shared CV and its reports. */
	deleteShareById(id: string): Promise<void>;

	driveLink(userId: string): Promise<DriveLink | null>;
	saveDriveLink(userId: string, link: DriveLink): Promise<void>;
	deleteDriveLink(userId: string): Promise<void>;

	/** Removes expired sessions and tokens. */
	prune(now: number): Promise<void>;
	close(): Promise<void>;
}

export function memoryAccountStore(): AccountStore {
	const users = new Map<string, UserRecord>();
	const sessions = new Map<string, { userId: string; expiresAt: number }>();
	const tokens = new Map<string, { userId: string; purpose: TokenPurpose; expiresAt: number }>();
	const shares = new Map<string, ShareRecord>();
	const reports: { shareId: string; reason: string; at: number }[] = [];
	const drives = new Map<string, DriveLink>();
	const copy = <T>(value: T | undefined): T | null => (value ? structuredClone(value) : null);
	const find = <T>(map: Map<string, T>, test: (value: T) => boolean) =>
		[...map.values()].find(test);

	return {
		async userById(id) {
			return copy(users.get(id));
		},
		async userByEmail(email) {
			return copy(find(users, (u) => u.email === email));
		},
		async userByGoogle(sub) {
			return copy(find(users, (u) => u.googleSub === sub));
		},
		async createUser(user) {
			if (
				find(
					users,
					(u) => u.email === user.email || (!!user.googleSub && u.googleSub === user.googleSub)
				)
			)
				return false;
			users.set(user.id, structuredClone(user));
			return true;
		},
		async updateUser(id, patch) {
			const user = users.get(id);
			if (user) users.set(id, { ...user, ...patch });
		},
		async deleteUser(id) {
			users.delete(id);
			for (const [key, s] of sessions) if (s.userId === id) sessions.delete(key);
			for (const [key, t] of tokens) if (t.userId === id) tokens.delete(key);
			for (const [key, s] of shares) if (s.userId === id) shares.delete(key);
			drives.delete(id);
		},
		async createSession(hash, userId, expiresAt) {
			sessions.set(hash, { userId, expiresAt });
		},
		async sessionUser(hash, now) {
			const session = sessions.get(hash);
			if (!session || session.expiresAt <= now) return null;
			return copy(users.get(session.userId));
		},
		async deleteSession(hash) {
			sessions.delete(hash);
		},
		async deleteUserSessions(userId) {
			for (const [key, s] of sessions) if (s.userId === userId) sessions.delete(key);
		},
		async createToken(hash, userId, purpose, expiresAt) {
			tokens.set(hash, { userId, purpose, expiresAt });
		},
		async takeToken(hash, purpose, now) {
			const token = tokens.get(hash);
			tokens.delete(hash);
			return token && token.purpose === purpose && token.expiresAt > now ? token.userId : null;
		},
		async deleteUserTokens(userId, purpose) {
			for (const [key, t] of tokens)
				if (t.userId === userId && t.purpose === purpose) tokens.delete(key);
		},
		async sharesOf(userId) {
			return [...shares.values()].filter((s) => s.userId === userId).map((s) => structuredClone(s));
		},
		async share(userId, cvId) {
			return copy(find(shares, (s) => s.userId === userId && s.cvId === cvId));
		},
		async shareBySlug(slug) {
			return copy(find(shares, (s) => s.slug === slug));
		},
		async saveShare(record) {
			const owner = find(shares, (s) => s.slug === record.slug);
			if (owner && owner.id !== record.id) return 'taken';
			const existing = find(shares, (s) => s.userId === record.userId && s.cvId === record.cvId);
			if (existing && existing.id !== record.id) shares.delete(existing.id);
			shares.set(record.id, structuredClone(record));
			return 'ok';
		},
		async deleteShare(userId, cvId) {
			const existing = find(shares, (s) => s.userId === userId && s.cvId === cvId);
			if (existing) shares.delete(existing.id);
		},
		async countView(shareId) {
			const share = shares.get(shareId);
			if (share) share.viewCount += 1;
		},
		async addReport(shareId, reason, at) {
			reports.push({ shareId, reason, at });
		},
		async reportCount(shareId) {
			return reports.filter((r) => r.shareId === shareId).length;
		},
		async reportSummaries() {
			const byShare = new Map<string, ReportSummary>();
			for (const r of reports) {
				const summary = byShare.get(r.shareId) ?? {
					shareId: r.shareId,
					total: 0,
					reasons: {},
					lastAt: 0
				};
				summary.total += 1;
				summary.reasons[r.reason] = (summary.reasons[r.reason] ?? 0) + 1;
				summary.lastAt = Math.max(summary.lastAt, r.at);
				byShare.set(r.shareId, summary);
			}
			return [...byShare.values()].sort((a, b) => b.lastAt - a.lastAt);
		},
		async deleteReports(shareId) {
			for (let i = reports.length - 1; i >= 0; i--)
				if (reports[i]!.shareId === shareId) reports.splice(i, 1);
		},
		async shareById(id) {
			return copy(shares.get(id));
		},
		async setShareBlocked(id, blocked) {
			const share = shares.get(id);
			if (share) share.blocked = blocked;
		},
		async deleteShareById(id) {
			shares.delete(id);
			for (let i = reports.length - 1; i >= 0; i--)
				if (reports[i]!.shareId === id) reports.splice(i, 1);
		},
		async driveLink(userId) {
			return copy(drives.get(userId));
		},
		async saveDriveLink(userId, link) {
			drives.set(userId, { ...link });
		},
		async deleteDriveLink(userId) {
			drives.delete(userId);
		},
		async prune(now) {
			for (const [key, s] of sessions) if (s.expiresAt <= now) sessions.delete(key);
			for (const [key, t] of tokens) if (t.expiresAt <= now) tokens.delete(key);
		},
		async close() {}
	};
}
