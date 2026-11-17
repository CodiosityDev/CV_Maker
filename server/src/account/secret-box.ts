/**
 * Encrypts small secrets at rest (Google Drive refresh tokens) with AES-256-GCM. The key is
 * derived from APP_SECRET with HKDF, so a database dump alone does not reveal the tokens.
 * Changing APP_SECRET makes stored tokens unreadable (users reconnect Google Drive).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

function key(secret: string): Buffer {
	return Buffer.from(hkdfSync('sha256', secret, 'cvmaker', 'drive-token-v1', 32));
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function seal(secret: string, plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
	const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return ['v1', iv, cipher.getAuthTag(), data]
		.map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
		.join('.');
}

/** undefined when tampered with, malformed or sealed with another secret. */
export function open(secret: string, sealed: string): string | undefined {
	const [version, iv, tag, data] = sealed.split('.');
	if (version !== 'v1' || !iv || !tag || data === undefined) return undefined;
	try {
		const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
		decipher.setAuthTag(Buffer.from(tag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(data, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		return undefined;
	}
}
