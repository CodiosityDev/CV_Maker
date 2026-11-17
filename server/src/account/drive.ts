/**
 * "Simpan ke Google Drive": the user connects their own Drive with the narrow `drive.file` scope
 * (the app can only see files it created itself — never the rest of the Drive). The server keeps
 * the refresh token ENCRYPTED (secret-box.ts) and talks to Google directly, so no Google script
 * runs on our pages and the CSP stays `connect-src 'self'`. The backup file passes through the
 * server on its way and is not stored there.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FILE_NAME = 'CV Maker – cadangan.json';

export type DriveResult<T> =
	{ ok: true; value: T } | { ok: false; reason: 'unauthorized' | 'missing' | 'failed' };

export interface DriveClient {
	connectUrl(state: string, challenge: string, loginHint?: string): string;
	/** The refresh token when the user granted Drive access, else null. */
	connect(code: string, verifier: string): Promise<string | null>;
	/** 'unauthorized' = the user revoked access (reconnect needed). */
	accessToken(refreshToken: string): Promise<DriveResult<string>>;
	/** Creates the backup file, or replaces its content when `fileId` still exists. */
	upload(accessToken: string, fileId: string | null, json: string): Promise<DriveResult<string>>;
	download(accessToken: string, fileId: string): Promise<DriveResult<string>>;
	revoke(refreshToken: string): Promise<void>;
}

export function createDriveClient(options: {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	fetch?: typeof globalThis.fetch;
	timeoutMs?: number;
}): DriveClient {
	const doFetch = options.fetch ?? globalThis.fetch;
	const timeout = () => AbortSignal.timeout(options.timeoutMs ?? 20_000);
	const failure = (status: number): DriveResult<never> => ({
		ok: false,
		reason:
			status === 401 || status === 403 ? 'unauthorized' : status === 404 ? 'missing' : 'failed'
	});

	async function tokenRequest(
		body: Record<string, string>
	): Promise<Record<string, unknown> | null> {
		try {
			const response = await doFetch(TOKEN_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: options.clientId,
					client_secret: options.clientSecret,
					...body
				}),
				signal: timeout()
			});
			const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
			return json ? { ...json, status: response.status } : { status: response.status };
		} catch {
			return null;
		}
	}

	return {
		connectUrl(state, challenge, loginHint) {
			const params = new URLSearchParams({
				client_id: options.clientId,
				redirect_uri: options.redirectUri,
				response_type: 'code',
				scope: DRIVE_SCOPE,
				access_type: 'offline',
				prompt: 'consent',
				state,
				code_challenge: challenge,
				code_challenge_method: 'S256',
				...(loginHint ? { login_hint: loginHint } : {})
			});
			return `${AUTH_URL}?${params}`;
		},
		async connect(code, verifier) {
			const json = await tokenRequest({
				code,
				redirect_uri: options.redirectUri,
				grant_type: 'authorization_code',
				code_verifier: verifier
			});
			const scopes = String(json?.scope ?? '').split(' ');
			if (typeof json?.refresh_token !== 'string' || !scopes.includes(DRIVE_SCOPE)) return null;
			return json.refresh_token;
		},
		async accessToken(refreshToken) {
			const json = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
			if (typeof json?.access_token === 'string') return { ok: true, value: json.access_token };
			// invalid_grant = revoked or expired consent.
			if (json?.error === 'invalid_grant') return { ok: false, reason: 'unauthorized' };
			return { ok: false, reason: 'failed' };
		},
		async upload(accessToken, fileId, json) {
			try {
				if (fileId) {
					const response = await doFetch(
						`${UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=media&fields=id`,
						{
							method: 'PATCH',
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json'
							},
							body: json,
							signal: timeout()
						}
					);
					if (response.ok) return { ok: true, value: fileId };
					// The user deleted the file in Drive: create a new one below.
					if (response.status !== 404) return failure(response.status);
				}
				const boundary = `cvmaker-${crypto.randomUUID()}`;
				const metadata = JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' });
				const body =
					`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
					`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n--${boundary}--`;
				const response = await doFetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': `multipart/related; boundary=${boundary}`
					},
					body,
					signal: timeout()
				});
				if (!response.ok) return failure(response.status);
				const created = (await response.json().catch(() => null)) as { id?: unknown } | null;
				return typeof created?.id === 'string' ? { ok: true, value: created.id } : failure(500);
			} catch {
				return failure(500);
			}
		},
		async download(accessToken, fileId) {
			try {
				const response = await doFetch(`${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
					headers: { Authorization: `Bearer ${accessToken}` },
					signal: timeout()
				});
				if (!response.ok) return failure(response.status);
				return { ok: true, value: await response.text() };
			} catch {
				return failure(500);
			}
		},
		async revoke(refreshToken) {
			try {
				await doFetch(REVOKE_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({ token: refreshToken }),
					signal: timeout()
				});
			} catch {
				// The token is deleted on our side anyway; the user can also revoke it in their Google account.
			}
		}
	};
}
