/**
 * Accounts (Phase 2) — browser client for /api/auth/* and /api/shares, /api/s/*.
 *
 * Login is OPTIONAL: every feature works without an account; an account only adds sharing
 * (and, later, cloud backup). Two ways in: Google, or email + password (needs the server's mail
 * settings for verification/reset links). The session is an HttpOnly cookie set by the server;
 * this code never sees a token.
 *
 *   const state = await accountClient.me();            // { user | null, providers }
 *   const result = await accountClient.login(email, password);
 *   if (!result.ok) toast.error(t(accountErrorKey(result.error)));
 *
 * Every function resolves `{ ok: true, data }` or `{ ok: false, error }` — never throws.
 */
import type { MessageKey } from '../../i18n/translate';
import {
	parsePublicShare,
	parseShareSettings,
	SHARE_ACCESS,
	type ReportReason,
	type ShareAccess,
	type ShareInfo,
	type ShareSaveRequest
} from '../share/index';

export const ACCOUNT_ERROR_CODES = [
	'invalid',
	'credentials',
	'exists',
	'weak',
	'unverified',
	'unauthenticated',
	'password',
	'taken',
	'limit',
	'reconnect',
	'notFound',
	'expired',
	'busy',
	'unavailable',
	'offline',
	'failed'
] as const;
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

export type Result<T> = { ok: true; data: T } | { ok: false; error: AccountErrorCode };

export const ACCOUNT_LIMITS = {
	emailMax: 254,
	nameMax: 80,
	passwordMin: 8,
	passwordMax: 128
} as const;

export interface AccountUser {
	id: string;
	email: string;
	name: string;
	/** Email confirmed (always true for Google accounts). Sharing needs it. */
	verified: boolean;
	hasPassword: boolean;
	google: boolean;
}

export interface AuthProviders {
	google: boolean;
	/** Email + password sign-up / login (off while the server has no mail settings). */
	password: boolean;
}

export interface AuthState {
	user: AccountUser | null;
	providers: AuthProviders;
}

const API = '/api';
const TIMEOUT_MS = 20_000;

/** i18n key for an error code (`account.errors.<code>`). */
export function accountErrorKey(code: AccountErrorCode): MessageKey {
	return `account.errors.${code}` as MessageKey;
}

/** Simple, permissive email shape check (the real check is the verification email). */
export function isEmailShaped(email: string): boolean {
	return email.length <= ACCOUNT_LIMITS.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Where Google login starts. `next` = an app path to return to after login. */
export function googleLoginUrl(next = '/cv'): string {
	return `${API}/auth/google?next=${encodeURIComponent(safeNext(next))}`;
}

/** Only same-site paths may be used as a return target (no `//evil.example`). */
export function safeNext(next: string | null | undefined): string {
	if (!next || next.length > 200 || !next.startsWith('/') || next.startsWith('//')) return '/cv';
	if (next.includes('\\') || [...next].some((char) => char.charCodeAt(0) < 32)) return '/cv';
	return next;
}

function isErrorCode(value: unknown): value is AccountErrorCode {
	return typeof value === 'string' && (ACCOUNT_ERROR_CODES as readonly string[]).includes(value);
}

type Fetch = typeof globalThis.fetch;

async function call<T>(
	fetcher: Fetch,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown,
	parse: (raw: unknown) => T | null = (raw) => raw as T
): Promise<Result<T>> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetcher(`${API}${path}`, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				...(body === undefined ? {} : { 'Content-Type': 'application/json' })
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});
	} catch {
		return {
			ok: false,
			error:
				typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable'
		};
	} finally {
		clearTimeout(timer);
	}
	let json: unknown;
	try {
		json = await response.json();
	} catch {
		json = undefined;
	}
	if (response.ok) {
		const data = parse(json);
		return data === null ? { ok: false, error: 'failed' } : { ok: true, data };
	}
	const code = (json as { error?: unknown } | undefined)?.error;
	if (isErrorCode(code)) return { ok: false, error: code };
	if (response.status === 401) return { ok: false, error: 'unauthenticated' };
	if (response.status === 404) return { ok: false, error: 'notFound' };
	if (response.status === 429) return { ok: false, error: 'busy' };
	// No JSON from our API: the proxy answered because the server is down or restarting.
	return { ok: false, error: response.status >= 500 ? 'unavailable' : 'failed' };
}

function parseUser(raw: unknown): AccountUser | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const u = raw as Record<string, unknown>;
	if (typeof u.id !== 'string' || typeof u.email !== 'string') return null;
	return {
		id: u.id,
		email: u.email,
		name: typeof u.name === 'string' ? u.name : '',
		verified: u.verified === true,
		hasPassword: u.hasPassword === true,
		google: u.google === true
	};
}

function parseState(raw: unknown): AuthState | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const data = raw as { user?: unknown; providers?: { google?: unknown; password?: unknown } };
	return {
		user: data.user ? parseUser(data.user) : null,
		providers: {
			google: data.providers?.google === true,
			password: data.providers?.password === true
		}
	};
}

function parseShareInfo(raw: unknown): ShareInfo | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const s = raw as Record<string, unknown>;
	const settings = parseShareSettings(s.settings);
	if (
		typeof s.cvId !== 'string' ||
		typeof s.slug !== 'string' ||
		!(SHARE_ACCESS as readonly unknown[]).includes(s.access) ||
		!settings
	)
		return null;
	return {
		cvId: s.cvId,
		slug: s.slug,
		access: s.access as ShareAccess,
		discoverable: s.discoverable === true,
		settings,
		hasPassword: s.hasPassword === true,
		expiresAt: typeof s.expiresAt === 'string' ? s.expiresAt : null,
		viewCount: typeof s.viewCount === 'number' ? s.viewCount : 0,
		updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : ''
	};
}

function parseShareList(raw: unknown): ShareInfo[] | null {
	const list = (raw as { shares?: unknown } | null)?.shares;
	if (!Array.isArray(list)) return null;
	return list.map(parseShareInfo).filter((item): item is ShareInfo => item !== null);
}

const ok = (raw: unknown) => (raw && typeof raw === 'object' ? true : null);

/** Creates the clients (tests pass their own `fetch`). */
export function createAccountClients(fetcher: Fetch = (...args) => globalThis.fetch(...args)) {
	const accountClient = {
		me: () => call(fetcher, 'GET', '/auth/me', undefined, parseState),
		register: (input: { email: string; password: string; name: string; locale: 'id' | 'en' }) =>
			call(fetcher, 'POST', '/auth/register', input, (raw) =>
				parseUser((raw as { user?: unknown } | null)?.user)
			),
		login: (email: string, password: string) =>
			call(fetcher, 'POST', '/auth/login', { email, password }, (raw) =>
				parseUser((raw as { user?: unknown } | null)?.user)
			),
		logout: () => call(fetcher, 'POST', '/auth/logout', {}, ok),
		/** Token from the link in the verification email (URL fragment). */
		verify: (token: string) => call(fetcher, 'POST', '/auth/verify', { token }, ok),
		resendVerification: (locale: 'id' | 'en') =>
			call(fetcher, 'POST', '/auth/verify/resend', { locale }, ok),
		/** Always succeeds for a well-formed email (does not reveal whether an account exists). */
		requestReset: (email: string, locale: 'id' | 'en') =>
			call(fetcher, 'POST', '/auth/reset', { email, locale }, ok),
		confirmReset: (token: string, password: string) =>
			call(fetcher, 'POST', '/auth/reset/confirm', { token, password }, (raw) =>
				parseUser((raw as { user?: unknown } | null)?.user)
			),
		/** Changes the display name (prefills "Nama lengkap" in new CVs). */
		updateProfile: (name: string) =>
			call(fetcher, 'POST', '/auth/profile', { name }, (raw) =>
				parseUser((raw as { user?: unknown } | null)?.user)
			),
		/** Permanently deletes the account and every shared link (UU PDP right to erasure). */
		deleteAccount: () => call(fetcher, 'POST', '/auth/delete', { confirm: true }, ok)
	};

	const shareClient = {
		list: () => call(fetcher, 'GET', '/shares', undefined, parseShareList),
		save: (cvId: string, request: ShareSaveRequest) =>
			call(fetcher, 'PUT', `/shares/${encodeURIComponent(cvId)}`, request, parseShareInfo),
		/** New address; the old one stops working. */
		rotate: (cvId: string) =>
			call(fetcher, 'POST', `/shares/${encodeURIComponent(cvId)}/rotate`, {}, parseShareInfo),
		remove: (cvId: string) =>
			call(fetcher, 'DELETE', `/shares/${encodeURIComponent(cvId)}`, undefined, ok),
		/** A visitor opens a link; `password` for protected links (error 'password' asks for it). */
		open: (slug: string, password?: string) =>
			password === undefined
				? call(fetcher, 'GET', `/s/${encodeURIComponent(slug)}`, undefined, parsePublicShare)
				: call(fetcher, 'POST', `/s/${encodeURIComponent(slug)}`, { password }, parsePublicShare),
		report: (slug: string, reason: ReportReason) =>
			call(fetcher, 'POST', `/s/${encodeURIComponent(slug)}/report`, { reason }, ok)
	};

	const driveClient = {
		status: () =>
			call(fetcher, 'GET', '/drive', undefined, (raw) => {
				const data = raw as {
					available?: unknown;
					connected?: unknown;
					lastBackupAt?: unknown;
					fileUrl?: unknown;
				} | null;
				if (!data) return null;
				return {
					available: data.available === true,
					connected: data.connected === true,
					lastBackupAt: typeof data.lastBackupAt === 'string' ? data.lastBackupAt : null,
					// Only Google Drive links are shown as "Lihat di Google Drive".
					fileUrl:
						typeof data.fileUrl === 'string' && data.fileUrl.startsWith('https://drive.google.com/')
							? data.fileUrl
							: null
				};
			}),
		save: (file: unknown) =>
			call(fetcher, 'POST', '/drive/backup', file, (raw) => {
				const at = (raw as { lastBackupAt?: unknown } | null)?.lastBackupAt;
				return typeof at === 'string' ? { lastBackupAt: at } : null;
			}),
		/** The backup file from the user's Drive (parsed JSON). */
		restore: () => call(fetcher, 'GET', '/drive/backup', undefined, (raw) => raw ?? null),
		disconnect: () => call(fetcher, 'POST', '/drive/disconnect', {}, ok)
	};

	return { accountClient, shareClient, driveClient };
}

export const { accountClient, shareClient, driveClient } = createAccountClients();

/** Where connecting Google Drive starts (a full-page navigation). */
export function driveConnectUrl(next = '/akun'): string {
	return `${API}/drive/connect?next=${encodeURIComponent(safeNext(next))}`;
}
