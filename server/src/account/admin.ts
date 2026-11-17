/**
 * Site admin for user reports on shared CVs (owner request). Reached by URL only (/admin).
 *
 *   GET    /api/admin/me                     → { admin: boolean }
 *   POST   /api/admin/login                  { username, password } → { ok } (+ admin cookie)
 *   POST   /api/admin/logout                 → { ok }
 *   GET    /api/admin/reports                → { reports: AdminReport[] }
 *   GET    /api/admin/shares/:id             → { snapshot, photo } (view a reported CV, even blocked)
 *   POST   /api/admin/shares/:id/block       { blocked } → { ok }
 *   POST   /api/admin/shares/:id/dismiss     → { ok }   (delete its reports: they were wrong)
 *   DELETE /api/admin/shares/:id             → { ok }   (delete the shared copy + reports)
 *
 * Credentials come ONLY from the server env (ADMIN_USERNAME + ADMIN_PASSWORD_HASH, a scrypt hash
 * made with scripts/hash-password.mjs) — never from the repo. Without them every route is 404.
 * Sessions: random token in an HttpOnly, Secure, SameSite=Strict __Host- cookie, kept in memory
 * (single PM2 instance; a restart logs the admin out), 8 hours. Login attempts are limited per IP
 * and in total per day, so the password cannot be guessed from many addresses.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ipSubject, wibDay } from '../identity';
import { assertSameOrigin, HttpError, readCookies, readJson, send } from '../http';
import type { QuotaStore } from '../quota';
import { randomToken, verifyPassword } from './crypto';
import type { AccountStore } from './store';

export const ADMIN_COOKIE = '__Host-cvm_admin';
const SESSION_MS = 8 * 60 * 60 * 1000;
const ID_PATTERN = /^[\w-]{22}$/;
/** Per day. */
const LIMITS = { loginsPerIp: 10, failedLoginsTotal: 50 } as const;

export interface AdminDeps {
	config: {
		appOrigin: string;
		appSecret: string;
		admin?: { username: string; passwordHash: string };
	};
	accounts: AccountStore;
	quota: QuotaStore;
	now?: () => number;
	log?: (entry: Record<string, unknown>) => void;
}

export interface AdminReport {
	shareId: string;
	slug: string;
	access: string;
	blocked: boolean;
	ownerEmail: string;
	total: number;
	reasons: Record<string, number>;
	lastAt: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest();
const asObject = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

function adminCookie(value: string, maxAgeSeconds: number): string {
	return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function createAdminRoutes(deps: AdminDeps) {
	const { config, accounts, quota } = deps;
	const now = deps.now ?? Date.now;
	const log = deps.log ?? (() => {});
	const sessions = new Map<string, number>();

	function isAdmin(req: IncomingMessage): boolean {
		const token = readCookies(req).get(ADMIN_COOKIE);
		if (!token || token.length > 100) return false;
		const key = digest(token).toString('hex');
		const until = sessions.get(key);
		if (!until) return false;
		if (until <= now()) {
			sessions.delete(key);
			return false;
		}
		return true;
	}

	function requireAdmin(req: IncomingMessage): void {
		if (!isAdmin(req)) throw new HttpError(401, 'unauthenticated');
	}

	async function login(req: IncomingMessage, res: ServerResponse, ip: string) {
		const admin = config.admin!;
		const day = wibDay(now());
		if (
			!(await quota.increment(
				'adminip',
				ipSubject(config.appSecret, `admin:${ip}`),
				day,
				LIMITS.loginsPerIp
			))
		)
			throw new HttpError(429, 'busy');
		if ((await quota.used('adminbad', 'all', day)) >= LIMITS.failedLoginsTotal)
			throw new HttpError(429, 'busy');
		const body = asObject(await readJson(req, { maxBytes: 4096 }));
		const username = typeof body.username === 'string' ? body.username : '';
		const password = typeof body.password === 'string' ? body.password : '';
		// Both checks always run (no timing hint about which one was wrong).
		const userOk = timingSafeEqual(digest(username), digest(admin.username));
		const passwordOk = await verifyPassword(password.slice(0, 256), admin.passwordHash);
		if (!userOk || !passwordOk) {
			await quota.increment('adminbad', 'all', day, Number.MAX_SAFE_INTEGER);
			log({ event: 'admin.login_failed' });
			throw new HttpError(401, 'credentials');
		}
		const token = randomToken();
		if (sessions.size > 1000) sessions.clear();
		sessions.set(digest(token).toString('hex'), now() + SESSION_MS);
		log({ event: 'admin.login' });
		send(res, 200, { ok: true }, { 'Set-Cookie': adminCookie(token, SESSION_MS / 1000) });
	}

	async function reports(): Promise<{ reports: AdminReport[] }> {
		const list: AdminReport[] = [];
		for (const summary of await accounts.reportSummaries()) {
			const share = await accounts.shareById(summary.shareId);
			if (!share) continue;
			const owner = await accounts.userById(share.userId);
			list.push({
				shareId: share.id,
				slug: share.slug,
				access: share.access,
				blocked: share.blocked,
				ownerEmail: owner?.email ?? '',
				total: summary.total,
				reasons: summary.reasons,
				lastAt: new Date(summary.lastAt).toISOString()
			});
		}
		return { reports: list };
	}

	return {
		async handle(
			req: IncomingMessage,
			res: ServerResponse,
			path: string,
			ip: string
		): Promise<boolean> {
			if (!path.startsWith('/api/admin/')) return false;
			// Feature off until the owner sets the credentials in the server env.
			if (!config.admin) throw new HttpError(404, 'notFound');
			const method = req.method ?? 'GET';
			if (method !== 'GET') assertSameOrigin(req, config.appOrigin);
			const extra = { 'X-Robots-Tag': 'noindex, nofollow' };

			if (method === 'GET' && path === '/api/admin/me') {
				send(res, 200, { admin: isAdmin(req) }, extra);
				return true;
			}
			if (method === 'POST' && path === '/api/admin/login') {
				await login(req, res, ip);
				return true;
			}
			if (method === 'POST' && path === '/api/admin/logout') {
				const token = readCookies(req).get(ADMIN_COOKIE);
				if (token) sessions.delete(digest(token).toString('hex'));
				send(res, 200, { ok: true }, { 'Set-Cookie': adminCookie('', 0) });
				return true;
			}

			requireAdmin(req);
			if (method === 'GET' && path === '/api/admin/reports') {
				send(res, 200, await reports(), extra);
				return true;
			}
			const match = /^\/api\/admin\/shares\/([^/]+)(?:\/(block|dismiss))?$/.exec(path);
			const id = match?.[1] ?? '';
			if (!match || !ID_PATTERN.test(id)) throw new HttpError(404, 'notFound');
			const share = await accounts.shareById(id);
			if (!share) throw new HttpError(404, 'notFound');

			if (method === 'GET' && !match[2]) {
				send(
					res,
					200,
					{ snapshot: JSON.parse(share.snapshot) as unknown, photo: share.photo },
					extra
				);
				return true;
			}
			if (method === 'POST' && match[2] === 'block') {
				const body = asObject(await readJson(req, { maxBytes: 1024 }));
				if (typeof body.blocked !== 'boolean') throw new HttpError(400, 'invalid');
				await accounts.setShareBlocked(id, body.blocked);
				log({ event: body.blocked ? 'admin.blocked' : 'admin.unblocked' });
				send(res, 200, { ok: true });
				return true;
			}
			if (method === 'POST' && match[2] === 'dismiss') {
				await accounts.deleteReports(id);
				log({ event: 'admin.dismissed' });
				send(res, 200, { ok: true });
				return true;
			}
			if (method === 'DELETE' && !match[2]) {
				await accounts.deleteShareById(id);
				log({ event: 'admin.deleted' });
				send(res, 200, { ok: true });
				return true;
			}
			throw new HttpError(404, 'notFound');
		}
	};
}
