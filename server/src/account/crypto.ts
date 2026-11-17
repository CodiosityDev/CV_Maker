/**
 * Passwords and tokens. Built on node:crypto only (no dependency).
 * - passwords: scrypt (N=2^15, r=8, p=1), random 16-byte salt, constant-time compare
 * - session / email tokens: 32 random bytes; only their SHA-256 is stored, so a database leak
 *   gives no usable session or reset link
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(
			password.normalize('NFKC'),
			salt,
			KEY_LENGTH,
			{ N: n, r, p, maxmem: MAX_MEM },
			(error, key) => (error ? reject(error) : resolve(key))
		)
	);
}

/** "scrypt$N$r$p$salt$hash" (base64url parts). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt);
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** Always takes about as long as a real check (also for a missing hash: no user enumeration). */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	const parts = (stored ?? '').split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') {
		await derive(password, randomBytes(16));
		return false;
	}
	const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
	const expected = Buffer.from(hash, 'base64url');
	try {
		const key = await derive(
			password,
			Buffer.from(salt, 'base64url'),
			Number(n),
			Number(r),
			Number(p)
		);
		return key.length === expected.length && timingSafeEqual(key, expected);
	} catch {
		return false;
	}
}

/** Random URL-safe token (sessions, email links, ids). */
export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}

/** What the database stores instead of a token. */
export function tokenHash(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Lowercase base32 slug without look-alike characters (a–z, 2–9 minus 0/1/l/o). */
export function randomSlug(length: number): string {
	const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
	const bytes = randomBytes(length);
	let slug = '';
	for (const byte of bytes) slug += alphabet[byte % alphabet.length];
	return slug;
}

/** Signs a short value (OAuth state cookie). */
export function sign(secret: string, value: string): string {
	return `${value}.${createHmac('sha256', secret).update(`oauth:${value}`).digest('base64url')}`;
}

export function unsign(secret: string, signed: string | undefined): string | undefined {
	if (!signed) return undefined;
	const index = signed.lastIndexOf('.');
	if (index < 1) return undefined;
	const value = signed.slice(0, index);
	const expected = Buffer.from(sign(secret, value));
	const actual = Buffer.from(signed);
	return expected.length === actual.length && timingSafeEqual(expected, actual) ? value : undefined;
}
