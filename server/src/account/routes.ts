/**
 * Accounts and shared CV links.
 *
 *   GET    /api/auth/me                 → { user | null, providers: { google, password } }
 *   GET    /api/auth/google?next=/cv    → 302 to Google (PKCE + signed state cookie)
 *   GET    /api/auth/google/callback    → 302 to `next` (session cookie set) or /masuk?error=google
 *   POST   /api/auth/register           { email, password, name, locale } → { user } (+ verification email)
 *   POST   /api/auth/login              { email, password } → { user }
 *   POST   /api/auth/logout             → { ok }
 *   POST   /api/auth/verify             { token } → { ok }
 *   POST   /api/auth/verify/resend      { locale } → { ok }
 *   POST   /api/auth/reset              { email, locale } → { ok } (same answer whether or not the email exists)
 *   POST   /api/auth/reset/confirm      { token, password } → { user } (all other sessions end)
 *   POST   /api/auth/delete             { confirm: true } → { ok } (account + every link, permanently)
 *   GET    /api/shares                  → { shares: ShareInfo[] }
 *   PUT    /api/shares/:cvId            ShareSaveRequest → ShareInfo
 *   POST   /api/shares/:cvId/rotate     → ShareInfo (new address; the old one stops working)
 *   DELETE /api/shares/:cvId            → { ok }
 *   GET    /api/s/:slug                 → PublicShare | 401 { error: 'password' } | 404
 *   POST   /api/s/:slug                 { password } → PublicShare
 *   POST   /api/s/:slug/report          { reason } → { ok }
 *
 * Security: session = random token in an HttpOnly, Secure, SameSite=Lax `__Host-` cookie; only its
 * SHA-256 is stored. State-changing requests must be same-origin JSON (CSRF). Passwords: scrypt.
 * Login failures are limited per email and per IP. Logs never contain emails, names or CV content.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ipSubject, wibDay } from '../identity';
import {
	assertSameOrigin,
	cookie,
	HttpError,
	readCookies,
	readJson,
	redirect,
	send
} from '../http';
import type { QuotaScope, QuotaStore } from '../quota';
import { ACCOUNT_LIMITS, isEmailShaped, safeNext } from '../../../src/lib/core/account/index';
import {
	isSlugShaped,
	MAX_SHARED_CVS,
	parseShareSaveRequest,
	REPORT_REASONS,
	SHARE_LIMITS,
	type ShareInfo
} from '../../../src/lib/core/share/index';
import { sniffImageType } from '../../../src/lib/core/security/image-type';
import {
	hashPassword,
	randomSlug,
	randomToken,
	sign,
	tokenHash,
	unsign,
	verifyPassword
} from './crypto';
import { pkceChallenge, type GoogleClient } from './google';
import { accountEmail, reportEmail, type Mailer } from './mail';
import type { AccountStore, ShareRecord, UserRecord } from './store';
import { cleanBackupFile } from './backup-file';
import type { DriveClient } from './drive';
import { open as openSecret, seal } from './secret-box';
import { BACKUP_LIMITS } from '../../../src/lib/core/storage/backup';

export const SESSION_COOKIE = '__Host-cvm_session';
export const OAUTH_COOKIE = '__Host-cvm_oauth';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_MS = 10 * 60 * 1000;
const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const SMALL_BODY = 8 * 1024;
/** Owner: at most 3 shared CVs per account (checked here, so it cannot be bypassed). */
const MAX_SHARES_PER_USER = MAX_SHARED_CVS;
const CV_ID_PATTERN = /^[\w-]{1,64}$/;
const PHOTO_MAX_BYTES = 320 * 1024;
/** Per day. */
const LIMITS = {
	loginPerIp: 60,
	badLoginsPerEmail: 10,
	registerPerIp: 10,
	mailsPerUser: 5,
	mailsPerIp: 20,
	sharePasswordPerIp: 20,
	reportsPerIp: 10,
	/** Drive backups per user per day. */
	backupsPerUser: 50
} as const;
/** Per minute, in memory. */
const BURST_PER_MINUTE = 20;
const WEAK_PASSWORDS = new Set([
	'12345678',
	'123456789',
	'1234567890',
	'password',
	'password1',
	'qwertyuiop',
	'11111111',
	'00000000',
	'iloveyou',
	'katasandi',
	'indonesia'
]);

export interface AccountDeps {
	config: { appOrigin: string; appSecret: string };
	accounts: AccountStore;
	quota: QuotaStore;
	/** Absent = "Masuk dengan Google" is off. */
	google?: GoogleClient;
	/** Absent = email + password sign-up/login is off (no way to verify or reset). */
	mailer?: Mailer;
	/** Absent = "Simpan ke Google Drive" is off (needs the Google client). */
	drive?: DriveClient;
	/** Where report notices go (owner: support@codiosity.com). Absent = no email. */
	reportEmail?: string;
	now?: () => number;
	log?: (entry: Record<string, unknown>) => void;
}

type Locale = 'id' | 'en';

function publicUser(user: UserRecord) {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		verified: user.emailVerified,
		hasPassword: user.passwordHash !== null,
		google: user.googleSub !== null
	};
}

function shareInfo(share: ShareRecord): ShareInfo {
	return {
		cvId: share.cvId,
		slug: share.slug,
		access: share.access,
		discoverable: share.discoverable,
		settings: share.settings,
		hasPassword: share.passwordHash !== null,
		expiresAt: share.expiresAt === null ? null : new Date(share.expiresAt).toISOString(),
		viewCount: share.viewCount,
		updatedAt: new Date(share.updatedAt).toISOString()
	};
}

const asObject = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asLocale = (value: unknown): Locale => (value === 'en' ? 'en' : 'id');
/** The signed OAuth state cookie's content ({} when missing or malformed). */
function readOauthState(signed: string | undefined): {
	s?: unknown;
	v?: unknown;
	n?: unknown;
	e?: unknown;
	/** 'drive' = connecting Google Drive (not a login). */
	p?: unknown;
	/** User who started connecting Drive. */
	u?: unknown;
} {
	if (!signed) return {};
	try {
		return asObject(JSON.parse(Buffer.from(signed, 'base64url').toString('utf8')));
	} catch {
		return {};
	}
}

/** Malformed %-escapes are junk input, not a server error. */
function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return '';
	}
}
const normalizeEmail = (value: unknown): string => asString(value).trim().toLowerCase();

function validPassword(password: string): boolean {
	return (
		password.length >= ACCOUNT_LIMITS.passwordMin && password.length <= ACCOUNT_LIMITS.passwordMax
	);
}

/** The decoded photo must really be the image type it claims, and small. */
function validPhoto(photo: string | null): boolean {
	if (photo === null) return true;
	const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo);
	if (!match) return false;
	const bytes = Buffer.from(match[2] ?? '', 'base64');
	return bytes.length > 0 && bytes.length <= PHOTO_MAX_BYTES && sniffImageType(bytes) === match[1];
}

export function createAccountRoutes(deps: AccountDeps) {
	const { config, accounts, quota, google, mailer, drive } = deps;
	const now = deps.now ?? Date.now;
	const log = deps.log ?? (() => {});
	const bursts = new Map<string, { minute: number; count: number }>();

	function burst(ip: string): void {
		const minute = Math.floor(now() / 60_000);
		const entry = bursts.get(ip);
		if (!entry || entry.minute !== minute) {
			if (bursts.size > 10_000) bursts.clear();
			bursts.set(ip, { minute, count: 1 });
			return;
		}
		entry.count += 1;
		if (entry.count > BURST_PER_MINUTE) throw new HttpError(429, 'busy');
	}

	/** Uses one of today's `limit` for `subject`; false when none is left. */
	const take = (scope: QuotaScope, subject: string, limit: number) =>
		quota.increment(scope, subject, wibDay(now()), limit);
	const subject = (kind: string, value: string) => ipSubject(config.appSecret, `${kind}:${value}`);

	async function sessionUser(req: IncomingMessage): Promise<UserRecord | null> {
		const token = readCookies(req).get(SESSION_COOKIE);
		if (!token || token.length > 100) return null;
		return accounts.sessionUser(tokenHash(token), now());
	}

	async function requireUser(req: IncomingMessage): Promise<UserRecord> {
		const user = await sessionUser(req);
		if (!user) throw new HttpError(401, 'unauthenticated');
		return user;
	}

	async function startSession(userId: string): Promise<string> {
		const token = randomToken();
		await accounts.createSession(tokenHash(token), userId, now() + SESSION_MS);
		return cookie(SESSION_COOKIE, token, SESSION_MS / 1000);
	}

	const clearSession = () => cookie(SESSION_COOKIE, '', 0);

	async function sendLink(user: UserRecord, kind: 'verify' | 'reset', locale: Locale, ip: string) {
		if (!mailer) throw new HttpError(503, 'unavailable');
		if (!(await take('mailip', subject('ip', ip), LIMITS.mailsPerIp)))
			throw new HttpError(429, 'busy');
		if (!(await take('mail', user.id, LIMITS.mailsPerUser))) throw new HttpError(429, 'busy');
		const token = randomToken();
		await accounts.deleteUserTokens(user.id, kind);
		await accounts.createToken(
			tokenHash(token),
			user.id,
			kind,
			now() + (kind === 'verify' ? VERIFY_MS : RESET_MS)
		);
		const path = kind === 'verify' ? '/masuk/verifikasi' : '/masuk/reset';
		const email = accountEmail(kind, locale, `${config.appOrigin}${path}#token=${token}`);
		try {
			await mailer.send({ to: user.email, ...email });
			log({ event: 'account.mail', kind });
		} catch (error) {
			log({
				event: 'account.mail_failed',
				kind,
				message: error instanceof Error ? error.message : 'unknown'
			});
			throw new HttpError(503, 'unavailable');
		}
	}

	// --- auth -------------------------------------------------------------------------------

	async function me(req: IncomingMessage) {
		const user = await sessionUser(req);
		return {
			user: user ? publicUser(user) : null,
			providers: { google: Boolean(google), password: Boolean(mailer) }
		};
	}

	async function register(req: IncomingMessage, res: ServerResponse, ip: string) {
		if (!mailer) throw new HttpError(503, 'unavailable');
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const email = normalizeEmail(body.email);
		const password = asString(body.password);
		const name = asString(body.name).trim().slice(0, ACCOUNT_LIMITS.nameMax);
		if (!isEmailShaped(email) || !validPassword(password)) throw new HttpError(400, 'invalid');
		if (WEAK_PASSWORDS.has(password.toLowerCase()) || password.toLowerCase() === email)
			throw new HttpError(400, 'weak');
		if (!(await take('register', subject('ip', ip), LIMITS.registerPerIp)))
			throw new HttpError(429, 'busy');
		if (await accounts.userByEmail(email)) throw new HttpError(409, 'exists');
		const user: UserRecord = {
			id: randomToken(16),
			email,
			emailVerified: false,
			name,
			passwordHash: await hashPassword(password),
			googleSub: null,
			createdAt: now()
		};
		if (!(await accounts.createUser(user))) throw new HttpError(409, 'exists');
		log({ event: 'account.register', method: 'password' });
		const session = await startSession(user.id);
		// The account exists even if the email cannot be sent now; "Kirim ulang" retries.
		await sendLink(user, 'verify', asLocale(body.locale), ip).catch(() => {});
		send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': session });
	}

	async function login(req: IncomingMessage, res: ServerResponse, ip: string) {
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const email = normalizeEmail(body.email);
		const password = asString(body.password);
		if (!isEmailShaped(email) || !password || password.length > ACCOUNT_LIMITS.passwordMax)
			throw new HttpError(400, 'invalid');
		if (!(await take('login', subject('ip', ip), LIMITS.loginPerIp)))
			throw new HttpError(429, 'busy');
		const emailKey = subject('email', email);
		if ((await quota.used('loginbad', emailKey, wibDay(now()))) >= LIMITS.badLoginsPerEmail)
			throw new HttpError(429, 'busy');
		const user = await accounts.userByEmail(email);
		if (!(await verifyPassword(password, user?.passwordHash ?? null)) || !user) {
			await take('loginbad', emailKey, Number.MAX_SAFE_INTEGER);
			throw new HttpError(401, 'credentials');
		}
		log({ event: 'account.login', method: 'password' });
		send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': await startSession(user.id) });
	}

	async function logout(req: IncomingMessage, res: ServerResponse) {
		const token = readCookies(req).get(SESSION_COOKIE);
		if (token && token.length <= 100) await accounts.deleteSession(tokenHash(token));
		send(res, 200, { ok: true }, { 'Set-Cookie': clearSession() });
	}

	async function verify(req: IncomingMessage) {
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const token = asString(body.token);
		if (!token || token.length > 100) throw new HttpError(400, 'invalid');
		const userId = await accounts.takeToken(tokenHash(token), 'verify', now());
		if (!userId) throw new HttpError(400, 'expired');
		await accounts.updateUser(userId, { emailVerified: true });
		log({ event: 'account.verified' });
		return { ok: true };
	}

	async function resendVerification(req: IncomingMessage, ip: string) {
		const user = await requireUser(req);
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		if (!user.emailVerified) await sendLink(user, 'verify', asLocale(body.locale), ip);
		return { ok: true };
	}

	async function requestReset(req: IncomingMessage, ip: string) {
		if (!mailer) throw new HttpError(503, 'unavailable');
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const email = normalizeEmail(body.email);
		if (!isEmailShaped(email)) throw new HttpError(400, 'invalid');
		const user = await accounts.userByEmail(email);
		// Same answer for unknown emails; a limit hit for a real account is not revealed either.
		if (user) await sendLink(user, 'reset', asLocale(body.locale), ip).catch(() => {});
		return { ok: true };
	}

	async function confirmReset(req: IncomingMessage, res: ServerResponse) {
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const token = asString(body.token);
		const password = asString(body.password);
		if (!token || token.length > 100 || !validPassword(password))
			throw new HttpError(400, 'invalid');
		if (WEAK_PASSWORDS.has(password.toLowerCase())) throw new HttpError(400, 'weak');
		const userId = await accounts.takeToken(tokenHash(token), 'reset', now());
		if (!userId) throw new HttpError(400, 'expired');
		// Opening the emailed link proves the address too.
		await accounts.updateUser(userId, {
			passwordHash: await hashPassword(password),
			emailVerified: true
		});
		await accounts.deleteUserSessions(userId);
		await accounts.deleteUserTokens(userId, 'reset');
		const user = await accounts.userById(userId);
		if (!user) throw new HttpError(400, 'expired');
		log({ event: 'account.reset' });
		send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': await startSession(user.id) });
	}

	/** Changes the display name (also used to prefill "Nama lengkap" in new CVs). */
	async function updateProfile(req: IncomingMessage) {
		const user = await requireUser(req);
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		if (typeof body.name !== 'string') throw new HttpError(400, 'invalid');
		// Same cleaning as CV text: no control characters, trimmed, length-limited.
		const name = [...body.name]
			.filter((char) => char.charCodeAt(0) >= 32)
			.join('')
			.trim()
			.slice(0, ACCOUNT_LIMITS.nameMax);
		await accounts.updateUser(user.id, { name });
		return { user: publicUser({ ...user, name }) };
	}

	async function deleteAccount(req: IncomingMessage, res: ServerResponse) {
		const user = await requireUser(req);
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		if (body.confirm !== true) throw new HttpError(400, 'invalid');
		await accounts.deleteUser(user.id);
		log({ event: 'account.deleted' });
		send(res, 200, { ok: true }, { 'Set-Cookie': clearSession() });
	}

	// --- Google -----------------------------------------------------------------------------

	function googleStart(req: IncomingMessage, res: ServerResponse) {
		if (!google) throw new HttpError(404, 'notFound');
		const next = safeNext(new URL(req.url ?? '/', 'http://local').searchParams.get('next'));
		const state = randomToken(16);
		const verifier = randomToken(32);
		const value = Buffer.from(
			JSON.stringify({ s: state, v: verifier, n: next, e: now() + OAUTH_MS })
		).toString('base64url');
		redirect(res, google.authUrl(state, verifier), {
			'Set-Cookie': cookie(OAUTH_COOKIE, sign(config.appSecret, value), OAUTH_MS / 1000)
		});
	}

	async function googleUser(sub: string, email: string, name: string): Promise<UserRecord> {
		const linked = await accounts.userByGoogle(sub);
		if (linked) return linked;
		const existing = await accounts.userByEmail(email);
		if (existing) {
			if (!existing.emailVerified) {
				// Someone may have registered this email without owning it ("pre-hijacking"): Google
				// proves ownership, so the unverified password and its sessions are thrown away.
				await accounts.updateUser(existing.id, {
					googleSub: sub,
					emailVerified: true,
					passwordHash: null
				});
				await accounts.deleteUserSessions(existing.id);
				return { ...existing, googleSub: sub, emailVerified: true, passwordHash: null };
			}
			await accounts.updateUser(existing.id, { googleSub: sub });
			return { ...existing, googleSub: sub };
		}
		const user: UserRecord = {
			id: randomToken(16),
			email,
			emailVerified: true,
			name: name.slice(0, ACCOUNT_LIMITS.nameMax),
			passwordHash: null,
			googleSub: sub,
			createdAt: now()
		};
		if (!(await accounts.createUser(user))) throw new HttpError(409, 'exists');
		log({ event: 'account.register', method: 'google' });
		return user;
	}

	async function googleCallback(req: IncomingMessage, res: ServerResponse) {
		const clear = cookie(OAUTH_COOKIE, '', 0);
		const fail = () => redirect(res, '/masuk?error=google', { 'Set-Cookie': clear });
		if (!google) return fail();
		const params = new URL(req.url ?? '/', 'http://local').searchParams;
		const signed = unsign(config.appSecret, readCookies(req).get(OAUTH_COOKIE));
		const saved = readOauthState(signed);
		const code = params.get('code');
		if (
			!code ||
			typeof saved.s !== 'string' ||
			typeof saved.v !== 'string' ||
			typeof saved.e !== 'number' ||
			saved.e < now() ||
			params.get('state') !== saved.s
		)
			return fail();
		if (saved.p === 'drive') return driveCallback(req, res, code, saved.v, saved, clear);
		const profile = await google.exchange(code, saved.v, now());
		const email = normalizeEmail(profile?.email);
		if (!profile || !isEmailShaped(email)) return fail();
		const user = await googleUser(profile.sub, email, profile.name);
		log({ event: 'account.login', method: 'google' });
		const next = safeNext(typeof saved.n === 'string' ? saved.n : null);
		const session = await startSession(user.id);
		// Logged in with Google: connect their Google Drive straight away (automatic backups, CVs on
		// other devices). Only while not connected yet, so Google asks for it once, not every login.
		if (drive && !(await accounts.driveLink(user.id))) {
			const consent = driveConsent(user, next);
			redirect(res, consent.url, { 'Set-Cookie': [session, consent.cookie] });
			return;
		}
		redirect(res, next, { 'Set-Cookie': [clear, session] });
	}

	// --- shares (owner) ---------------------------------------------------------------------

	async function requireVerified(req: IncomingMessage): Promise<UserRecord> {
		const user = await requireUser(req);
		if (!user.emailVerified) throw new HttpError(403, 'unverified');
		return user;
	}

	async function saveShare(req: IncomingMessage, cvId: string) {
		const user = await requireVerified(req);
		const request = parseShareSaveRequest(
			await readJson(req, { maxBytes: SHARE_LIMITS.requestBytes }),
			now()
		);
		if (!request || !validPhoto(request.photo)) throw new HttpError(400, 'invalid');
		const existing = await accounts.share(user.id, cvId);
		if (!existing && (await accounts.sharesOf(user.id)).length >= MAX_SHARES_PER_USER)
			throw new HttpError(403, 'limit');
		const passwordHash =
			request.password === undefined
				? (existing?.passwordHash ?? null)
				: request.password === null
					? null
					: await hashPassword(request.password);
		const expiresAt =
			request.expiresAt === undefined
				? (existing?.expiresAt ?? null)
				: request.expiresAt === null
					? null
					: Date.parse(request.expiresAt);
		const base: ShareRecord = {
			id: existing?.id ?? randomToken(16),
			userId: user.id,
			cvId,
			slug: request.slug ?? existing?.slug ?? randomSlug(SHARE_LIMITS.randomSlugLength),
			access: request.access,
			discoverable: request.discoverable,
			settings: request.settings,
			snapshot: JSON.stringify({ ...request.snapshot, id: cvId }),
			photo: request.photo,
			passwordHash,
			expiresAt,
			viewCount: existing?.viewCount ?? 0,
			blocked: existing?.blocked ?? false,
			createdAt: existing?.createdAt ?? now(),
			updatedAt: now()
		};
		for (let attempt = 0; attempt < 4; attempt++) {
			const record =
				attempt === 0 ? base : { ...base, slug: randomSlug(SHARE_LIMITS.randomSlugLength) };
			if ((await accounts.saveShare(record)) === 'ok') {
				log({ event: 'share.saved', access: record.access });
				return shareInfo(record);
			}
			// A chosen slug that is taken is the user's to change; a random one is retried.
			if (request.slug !== undefined) throw new HttpError(409, 'taken');
		}
		throw new HttpError(503, 'unavailable');
	}

	async function rotateShare(req: IncomingMessage, cvId: string) {
		const user = await requireVerified(req);
		const existing = await accounts.share(user.id, cvId);
		if (!existing) throw new HttpError(404, 'notFound');
		for (let attempt = 0; attempt < 4; attempt++) {
			const record = {
				...existing,
				slug: randomSlug(SHARE_LIMITS.randomSlugLength),
				updatedAt: now()
			};
			if ((await accounts.saveShare(record)) === 'ok') return shareInfo(record);
		}
		throw new HttpError(503, 'unavailable');
	}

	// --- shares (visitors) ------------------------------------------------------------------

	async function openShare(req: IncomingMessage, res: ServerResponse, slug: string, ip: string) {
		const share = isSlugShaped(slug) ? await accounts.shareBySlug(slug) : null;
		// One answer for missing, private, expired and blocked: the reason is not revealed.
		if (
			!share ||
			share.blocked ||
			share.access === 'private' ||
			(share.expiresAt !== null && share.expiresAt <= now())
		)
			throw new HttpError(404, 'notFound');
		if (share.passwordHash !== null) {
			if (req.method !== 'POST') throw new HttpError(401, 'password');
			const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
			const password = asString(body.password);
			if (!(await take('sharepw', subject('share', `${ip}|${slug}`), LIMITS.sharePasswordPerIp)))
				throw new HttpError(429, 'busy');
			if (
				!password ||
				password.length > SHARE_LIMITS.passwordMax ||
				!(await verifyPassword(password, share.passwordHash))
			)
				throw new HttpError(401, 'password');
		}
		await accounts.countView(share.id);
		const indexable = share.access === 'public' && share.discoverable;
		send(
			res,
			200,
			{
				snapshot: JSON.parse(share.snapshot) as unknown,
				photo: share.photo,
				allowDownload: share.settings.allowDownload,
				discoverable: indexable
			},
			{
				'X-Robots-Tag': indexable ? 'all' : 'noindex, nofollow',
				'Referrer-Policy': 'no-referrer'
			}
		);
	}

	/** At most one email per link per day and 50 per day in total, so the inbox cannot be flooded. */
	async function notifyReport(shareId: string, slug: string, reason: string) {
		if (!mailer || !deps.reportEmail) return;
		if (!(await take('rptmail', shareId, 1))) return;
		if (!(await take('rptall', 'all', 50))) return;
		const total = await accounts.reportCount(shareId);
		await mailer.send({
			to: deps.reportEmail,
			...reportEmail({ slug, reason, total, appOrigin: config.appOrigin })
		});
		log({ event: 'share.report_mailed' });
	}

	async function report(req: IncomingMessage, slug: string, ip: string) {
		const body = asObject(await readJson(req, { maxBytes: SMALL_BODY }));
		const reason = asString(body.reason);
		if (!(REPORT_REASONS as readonly string[]).includes(reason))
			throw new HttpError(400, 'invalid');
		const share = isSlugShaped(slug) ? await accounts.shareBySlug(slug) : null;
		if (!share) throw new HttpError(404, 'notFound');
		if (!(await take('report', subject('ip', ip), LIMITS.reportsPerIp)))
			throw new HttpError(429, 'busy');
		await accounts.addReport(share.id, reason, now());
		log({ event: 'share.reported', reason });
		// Tell the team (never blocks or fails the visitor's report).
		void notifyReport(share.id, share.slug, reason).catch((error: unknown) =>
			log({
				event: 'share.report_mail_failed',
				message: error instanceof Error ? error.message : 'unknown'
			})
		);
		return { ok: true };
	}

	// --- Google Drive -----------------------------------------------------------------------
	// Backups go ONLY to the user's own Drive (owner); this server stores shared CVs only.

	const BACKUP_BODY = BACKUP_LIMITS.maxFileBytes + 64 * 1024;

	async function readBackupBody(req: IncomingMessage) {
		const clean = await cleanBackupFile(
			JSON.stringify(await readJson(req, { maxBytes: BACKUP_BODY }))
		);
		if (!clean) throw new HttpError(400, 'invalid');
		return clean;
	}

	/** Answers with JSON text as is (it was cleaned first). */
	function sendJsonText(res: ServerResponse, json: string) {
		res.writeHead(200, {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Length': Buffer.byteLength(json),
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff'
		});
		res.end(json);
	}

	const accessTokens = new Map<string, { token: string; until: number }>();

	function driveStart(req: IncomingMessage, res: ServerResponse, user: UserRecord) {
		const next = safeNext(
			new URL(req.url ?? '/', 'http://local').searchParams.get('next') ?? '/akun'
		);
		const start = driveConsent(user, next);
		redirect(res, start.url, { 'Set-Cookie': start.cookie });
	}

	/** Google's Drive consent page for `user` (+ the signed state cookie); back to `next?drive=…`. */
	function driveConsent(user: UserRecord, next: string): { url: string; cookie: string } {
		if (!drive) throw new HttpError(404, 'notFound');
		const state = randomToken(16);
		const verifier = randomToken(32);
		const value = Buffer.from(
			JSON.stringify({
				s: state,
				v: verifier,
				n: next,
				e: now() + OAUTH_MS,
				p: 'drive',
				u: user.id
			})
		).toString('base64url');
		return {
			url: drive.connectUrl(state, pkceChallenge(verifier), user.email),
			cookie: cookie(OAUTH_COOKIE, sign(config.appSecret, value), OAUTH_MS / 1000)
		};
	}

	async function driveCallback(
		req: IncomingMessage,
		res: ServerResponse,
		code: string,
		verifier: string,
		saved: { n?: unknown; u?: unknown },
		clear: string
	) {
		const next = safeNext(typeof saved.n === 'string' ? saved.n : '/akun');
		const back = (result: 'connected' | 'failed') =>
			redirect(res, `${next}${next.includes('?') ? '&' : '?'}drive=${result}`, {
				'Set-Cookie': clear
			});
		const user = await sessionUser(req);
		// The Drive must be connected by the same logged-in user who started.
		if (!drive || !user || user.id !== saved.u) return back('failed');
		const refreshToken = await drive.connect(code, verifier);
		if (!refreshToken) return back('failed');
		const existing = await accounts.driveLink(user.id);
		await accounts.saveDriveLink(user.id, {
			token: seal(config.appSecret, refreshToken),
			fileId: existing?.fileId ?? null,
			lastBackupAt: existing?.lastBackupAt ?? null,
			connectedAt: now()
		});
		accessTokens.delete(user.id);
		log({ event: 'drive.connected' });
		return back('connected');
	}

	/** A working access token, or throws 'reconnect' (access revoked) / 'unavailable'. */
	async function driveAccess(userId: string) {
		const link = await accounts.driveLink(userId);
		if (!drive || !link) throw new HttpError(409, 'reconnect');
		const cached = accessTokens.get(userId);
		if (cached && cached.until > now()) return { link, token: cached.token };
		const refreshToken = openSecret(config.appSecret, link.token);
		const result = refreshToken
			? await drive.accessToken(refreshToken)
			: ({ ok: false, reason: 'unauthorized' } as const);
		if (!result.ok) {
			if (result.reason === 'unauthorized') {
				await accounts.deleteDriveLink(userId);
				throw new HttpError(409, 'reconnect');
			}
			throw new HttpError(503, 'unavailable');
		}
		// Google access tokens live 1 h; keep a margin.
		accessTokens.set(userId, { token: result.value, until: now() + 50 * 60 * 1000 });
		return { link, token: result.value };
	}

	async function driveBackup(req: IncomingMessage) {
		const user = await requireUser(req);
		if (!(await take('drive', user.id, LIMITS.backupsPerUser))) throw new HttpError(429, 'busy');
		const clean = await readBackupBody(req);
		const { link, token } = await driveAccess(user.id);
		const result = await drive!.upload(token, link.fileId, clean.json);
		if (!result.ok) {
			if (result.reason === 'unauthorized') {
				accessTokens.delete(user.id);
				await accounts.deleteDriveLink(user.id);
				throw new HttpError(409, 'reconnect');
			}
			throw new HttpError(503, 'unavailable');
		}
		const lastBackupAt = now();
		await accounts.saveDriveLink(user.id, { ...link, fileId: result.value, lastBackupAt });
		log({ event: 'drive.backup', cvs: clean.cvCount });
		return { lastBackupAt: new Date(lastBackupAt).toISOString() };
	}

	async function driveRestore(req: IncomingMessage, res: ServerResponse) {
		const user = await requireUser(req);
		const { link, token } = await driveAccess(user.id);
		if (!link.fileId) throw new HttpError(404, 'notFound');
		const result = await drive!.download(token, link.fileId);
		if (!result.ok) {
			if (result.reason === 'missing') throw new HttpError(404, 'notFound');
			if (result.reason === 'unauthorized') throw new HttpError(409, 'reconnect');
			throw new HttpError(503, 'unavailable');
		}
		// The file may have been edited in Drive: clean it like any upload.
		const clean = await cleanBackupFile(result.value);
		if (!clean) throw new HttpError(422, 'invalid');
		sendJsonText(res, clean.json);
	}

	async function driveDisconnect(req: IncomingMessage) {
		const user = await requireUser(req);
		const link = await accounts.driveLink(user.id);
		if (link) {
			const refreshToken = openSecret(config.appSecret, link.token);
			if (refreshToken && drive) await drive.revoke(refreshToken);
			await accounts.deleteDriveLink(user.id);
		}
		accessTokens.delete(user.id);
		log({ event: 'drive.disconnected' });
		return { ok: true };
	}

	async function driveStatus(req: IncomingMessage) {
		const user = await sessionUser(req);
		const link = user ? await accounts.driveLink(user.id) : null;
		return {
			available: Boolean(drive),
			connected: Boolean(link),
			lastBackupAt: link?.lastBackupAt ? new Date(link.lastBackupAt).toISOString() : null,
			/** Opens the backup file in the user's own Drive (only they can open it). */
			fileUrl: link?.fileId
				? `https://drive.google.com/file/d/${encodeURIComponent(link.fileId)}/view`
				: null
		};
	}

	// --- router -----------------------------------------------------------------------------

	return {
		/** Answers the request and returns true when `path` is one of these routes. */
		async handle(
			req: IncomingMessage,
			res: ServerResponse,
			path: string,
			ip: string
		): Promise<boolean> {
			const method = req.method ?? 'GET';
			const isAuth = path.startsWith('/api/auth/');
			const shareMatch = /^\/api\/shares(?:\/([^/]+)(\/rotate)?)?$/.exec(path);
			const publicMatch = /^\/api\/s\/([^/]+)(\/report)?$/.exec(path);
			const isDrive = path === '/api/drive' || path.startsWith('/api/drive/');
			if (!isAuth && !shareMatch && !publicMatch && !isDrive) return false;

			burst(ip);
			// GETs change nothing (Google's callback is a top-level navigation from accounts.google.com).
			if (method !== 'GET') assertSameOrigin(req, config.appOrigin);

			if (isDrive) {
				switch (`${method} ${path}`) {
					case 'GET /api/drive':
						send(res, 200, await driveStatus(req));
						return true;
					case 'GET /api/drive/connect': {
						const user = await sessionUser(req);
						if (!user) {
							redirect(res, '/masuk?next=%2Fakun');
							return true;
						}
						driveStart(req, res, user);
						return true;
					}
					case 'POST /api/drive/backup':
						send(res, 200, await driveBackup(req));
						return true;
					case 'GET /api/drive/backup':
						await driveRestore(req, res);
						return true;
					case 'POST /api/drive/disconnect':
						send(res, 200, await driveDisconnect(req));
						return true;
				}
				throw new HttpError(404, 'notFound');
			}

			if (isAuth) {
				const route = `${method} ${path}`;
				switch (route) {
					case 'GET /api/auth/me':
						send(res, 200, await me(req));
						return true;
					case 'GET /api/auth/google':
						googleStart(req, res);
						return true;
					case 'GET /api/auth/google/callback':
						await googleCallback(req, res);
						return true;
					case 'POST /api/auth/register':
						await register(req, res, ip);
						return true;
					case 'POST /api/auth/login':
						await login(req, res, ip);
						return true;
					case 'POST /api/auth/logout':
						await logout(req, res);
						return true;
					case 'POST /api/auth/verify':
						send(res, 200, await verify(req));
						return true;
					case 'POST /api/auth/verify/resend':
						send(res, 200, await resendVerification(req, ip));
						return true;
					case 'POST /api/auth/reset':
						send(res, 200, await requestReset(req, ip));
						return true;
					case 'POST /api/auth/reset/confirm':
						await confirmReset(req, res);
						return true;
					case 'POST /api/auth/delete':
						await deleteAccount(req, res);
						return true;
					case 'POST /api/auth/profile':
						send(res, 200, await updateProfile(req));
						return true;
				}
				throw new HttpError(404, 'notFound');
			}

			if (shareMatch) {
				const cvId = shareMatch[1] ? safeDecode(shareMatch[1]) : undefined;
				if (!cvId) {
					if (method !== 'GET') throw new HttpError(404, 'notFound');
					const user = await requireUser(req);
					send(res, 200, { shares: (await accounts.sharesOf(user.id)).map(shareInfo) });
					return true;
				}
				if (!CV_ID_PATTERN.test(cvId)) throw new HttpError(400, 'invalid');
				if (shareMatch[2]) {
					if (method !== 'POST') throw new HttpError(404, 'notFound');
					send(res, 200, await rotateShare(req, cvId));
					return true;
				}
				if (method === 'PUT') {
					send(res, 200, await saveShare(req, cvId));
					return true;
				}
				if (method === 'DELETE') {
					const user = await requireUser(req);
					await accounts.deleteShare(user.id, cvId);
					log({ event: 'share.deleted' });
					send(res, 200, { ok: true });
					return true;
				}
				throw new HttpError(404, 'notFound');
			}

			const slug = safeDecode(publicMatch?.[1] ?? '');
			if (publicMatch?.[2]) {
				if (method !== 'POST') throw new HttpError(404, 'notFound');
				send(res, 200, await report(req, slug, ip));
				return true;
			}
			if (method !== 'GET' && method !== 'POST') throw new HttpError(404, 'notFound');
			await openShare(req, res, slug, ip);
			return true;
		}
	};
}
