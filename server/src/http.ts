/** Small HTTP helpers shared by the API routes (no framework). */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AiQuota } from '../../src/lib/core/ai/types';

export const DEFAULT_MAX_BODY_BYTES = 32 * 1024;

/** An expected failure: answered as `{ error: code }` with `status`. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly quota?: AiQuota
	) {
		super(code);
	}
}

export function send(
	res: ServerResponse,
	status: number,
	body: unknown,
	headers: Record<string, string | string[]> = {}
): void {
	const json = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(json),
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
		...headers
	});
	res.end(json);
}

/** Client IP: nginx sets X-Real-IP (Cloudflare's CF-Connecting-IP after real_ip). */
export function clientIp(req: IncomingMessage): string {
	const header = req.headers['x-real-ip'];
	const value = Array.isArray(header) ? header[0] : header;
	return value?.trim() || req.socket.remoteAddress || 'unknown';
}

/**
 * `allowText`: the ad page posts `text/plain` (a CORS "simple" request: no preflight, no cookies).
 * Everything else must be `application/json`, which other websites cannot send without a CORS
 * preflight — part of the CSRF protection for cookie-authenticated routes.
 */
export async function readJson(
	req: IncomingMessage,
	options: { allowText?: boolean; maxBytes?: number } = {}
): Promise<unknown> {
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
	const type = (req.headers['content-type'] ?? '').toLowerCase();
	const accepted =
		type.startsWith('application/json') || (options.allowText && type.startsWith('text/plain'));
	if (!accepted) throw new HttpError(400, 'invalid');
	const length = Number(req.headers['content-length'] ?? 0);
	if (length > maxBytes) throw new HttpError(413, 'invalid');
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		size += (chunk as Buffer).length;
		if (size > maxBytes) throw new HttpError(413, 'invalid');
		chunks.push(chunk as Buffer);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		throw new HttpError(400, 'invalid');
	}
}

/** Browsers send Origin/Sec-Fetch-Site on POST: block other websites. */
export function assertSameOrigin(req: IncomingMessage, appOrigin: string): void {
	const origin = req.headers.origin;
	const site = req.headers['sec-fetch-site'];
	if (origin && origin !== appOrigin) throw new HttpError(403, 'invalid');
	if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'invalid');
}

/** Cookie header → map (first value wins). */
export function readCookies(req: IncomingMessage): Map<string, string> {
	const cookies = new Map<string, string>();
	for (const part of (req.headers.cookie ?? '').split(';')) {
		const index = part.indexOf('=');
		if (index < 1) continue;
		const name = part.slice(0, index).trim();
		if (!cookies.has(name)) cookies.set(name, part.slice(index + 1).trim());
	}
	return cookies;
}

/** Set-Cookie value for an HttpOnly, Secure, SameSite=Lax cookie on the whole site. */
export function cookie(name: string, value: string, maxAgeSeconds: number): string {
	return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function redirect(
	res: ServerResponse,
	location: string,
	headers: Record<string, string | string[]> = {}
): void {
	res.writeHead(302, {
		Location: location,
		'Cache-Control': 'no-store',
		'Referrer-Policy': 'no-referrer',
		...headers
	});
	res.end();
}
