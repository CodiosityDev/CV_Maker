/**
 * URL safety for user-entered links (LinkedIn, portfolio, project, credential URLs).
 * PROJECT_SPEC §11.5: only http:, https: and mailto: are allowed.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL_LIKE = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/;

/**
 * Returns a safe, absolute URL string, or `undefined` if the input is unsafe/invalid.
 * - `linkedin.com/in/rizky` → `https://linkedin.com/in/rizky`
 * - `nama@contoh.com` → `mailto:nama@contoh.com`
 * - `javascript:...`, `data:...`, URLs with credentials → `undefined`
 */
export function sanitizeUrl(input: string | undefined | null): string | undefined {
	if (typeof input !== 'string') return undefined;
	// Remove whitespace & control chars anywhere (browsers ignore them, attackers use them: "java\tscript:")
	// eslint-disable-next-line no-control-regex
	const compact = input.replace(/[\u0000- \u007F]/g, '');
	if (compact === '') return undefined;

	let candidate = compact;
	if (!HAS_SCHEME.test(candidate)) {
		if (candidate.startsWith('//')) return undefined;
		candidate = EMAIL_LIKE.test(candidate) ? `mailto:${candidate}` : `https://${candidate}`;
	}

	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return undefined;
	}
	if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
	if (url.protocol === 'mailto:') {
		return EMAIL_LIKE.test(decodeURIComponent(url.pathname)) ? url.href : undefined;
	}
	if (url.username || url.password) return undefined;
	if (!url.hostname.includes('.') && url.hostname !== 'localhost') return undefined;
	return url.href;
}

/**
 * Short, human-readable form for printing on a CV:
 * `https://www.linkedin.com/in/rizky/` → `linkedin.com/in/rizky`, `mailto:a@b.co` → `a@b.co`.
 * Expects a value returned by `sanitizeUrl`.
 */
export function displayUrl(safeUrl: string): string {
	if (safeUrl.startsWith('mailto:')) return decodeURIComponent(safeUrl.slice('mailto:'.length));
	return safeUrl
		.replace(/^https?:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/\/$/, '');
}
