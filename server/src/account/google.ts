/**
 * "Masuk dengan Google" — OAuth 2.0 authorization-code flow with PKCE, run entirely by the server:
 * the browser only follows redirects, so no Google script ever runs on our pages (CSP unchanged).
 *
 * The ID token comes straight from Google's token endpoint over TLS, so its signature need not be
 * re-checked (OpenID Connect Core §3.1.3.7); issuer, audience, expiry and email_verified are.
 */
import { createHash } from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface GoogleProfile {
	sub: string;
	email: string;
	name: string;
}

export interface GoogleClient {
	authUrl(state: string, verifier: string): string;
	/** null when Google refuses the code or the token is not acceptable. */
	exchange(code: string, verifier: string, now: number): Promise<GoogleProfile | null>;
}

export function pkceChallenge(verifier: string): string {
	return createHash('sha256').update(verifier).digest('base64url');
}

function decodeIdToken(token: unknown): Record<string, unknown> | null {
	if (typeof token !== 'string') return null;
	const payload = token.split('.')[1];
	if (!payload) return null;
	try {
		const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export function createGoogleClient(options: {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	fetch?: typeof globalThis.fetch;
	timeoutMs?: number;
}): GoogleClient {
	const doFetch = options.fetch ?? globalThis.fetch;
	return {
		authUrl(state, verifier) {
			const params = new URLSearchParams({
				client_id: options.clientId,
				redirect_uri: options.redirectUri,
				response_type: 'code',
				scope: 'openid email profile',
				state,
				code_challenge: pkceChallenge(verifier),
				code_challenge_method: 'S256',
				prompt: 'select_account'
			});
			return `${AUTH_URL}?${params}`;
		},
		async exchange(code, verifier, now) {
			let response: Response;
			try {
				response = await doFetch(TOKEN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: options.clientId,
						client_secret: options.clientSecret,
						redirect_uri: options.redirectUri,
						grant_type: 'authorization_code',
						code_verifier: verifier
					}),
					signal: AbortSignal.timeout(options.timeoutMs ?? 10_000)
				});
			} catch {
				return null;
			}
			if (!response.ok) return null;
			const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
			const claims = decodeIdToken(body?.id_token);
			if (!claims) return null;
			const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
			if (
				!ISSUERS.has(String(claims.iss)) ||
				!audience.includes(options.clientId) ||
				typeof claims.exp !== 'number' ||
				claims.exp * 1000 <= now ||
				claims.email_verified !== true ||
				typeof claims.sub !== 'string' ||
				typeof claims.email !== 'string'
			)
				return null;
			return {
				sub: claims.sub,
				email: claims.email.toLowerCase(),
				name: typeof claims.name === 'string' ? claims.name : ''
			};
		}
	};
}
