/**
 * The CV data hidden in PDFs downloaded from CV Maker, so the user can upload the PDF again and
 * keep editing it here. Other PDFs have no such data and are refused.
 *
 *   const data = await encodeCvPayload(backupJson);   // → buildPdf({ …, data })
 *   const json = await readCvPayload(pdfBytes);       // null = not a CV Maker PDF
 *
 * Format: `CVMKR1:` + base64(iv ‖ AES-GCM(deflate(backup JSON))) + `:END`, in an uncompressed
 * stream. The key ships with the app, so this is a private format (other tools cannot read or
 * forge it — GCM rejects any edit), not a secret from someone who studies the app's code. The
 * backup JSON is UNTRUSTED on the way back in: the caller imports it with `backupRepo.import`.
 */
import { deflateSync, inflateSync } from 'fflate';

const PREFIX = 'CVMKR1:';
const SUFFIX = ':END';
const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Same as the backup file limit. */
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const APP_KEY = 'cvmaker.codiosity.com/pdf-edit/v1/7f3c9a1e5b2d4086';
const AAD = new TextEncoder().encode('CVMKR1');

let key: Promise<CryptoKey> | undefined;
function appKey(): Promise<CryptoKey> {
	key ??= crypto.subtle
		.digest('SHA-256', new TextEncoder().encode(APP_KEY))
		.then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
	return key;
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | undefined {
	try {
		const binary = atob(text);
		const out = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
		return out;
	} catch {
		return undefined;
	}
}

/** The ASCII block to embed for a backup JSON text. */
export async function encodeCvPayload(json: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv, additionalData: AAD },
			await appKey(),
			deflateSync(new TextEncoder().encode(json), { level: 9 }) as Uint8Array<ArrayBuffer>
		)
	);
	const all = new Uint8Array(iv.length + sealed.length);
	all.set(iv);
	all.set(sealed, iv.length);
	return `${PREFIX}${toBase64(all)}${SUFFIX}`;
}

/** Finds the embedded block in a PDF file (bytes as Latin-1 text). */
export function findCvPayload(pdf: Uint8Array): string | undefined {
	if (pdf.length > MAX_PDF_BYTES) return undefined;
	// Latin-1: one char per byte, so the marker search works on the raw file.
	const text = new TextDecoder('latin1').decode(pdf);
	const start = text.lastIndexOf(PREFIX);
	if (start < 0) return undefined;
	const end = text.indexOf(SUFFIX, start);
	if (end < 0) return undefined;
	const body = text.slice(start + PREFIX.length, end);
	return /^[A-Za-z0-9+/]+={0,2}$/.test(body) ? body : undefined;
}

/** The backup JSON hidden in a CV Maker PDF, or null for any other (or altered) PDF. */
export async function readCvPayload(pdf: Uint8Array): Promise<string | null> {
	const body = findCvPayload(pdf);
	const bytes = body && fromBase64(body);
	if (!bytes || bytes.length < 13 + 16) return null;
	try {
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: AAD },
			await appKey(),
			bytes.subarray(12)
		);
		const json = inflateSync(new Uint8Array(plain));
		if (json.length > MAX_JSON_BYTES) return null;
		return new TextDecoder().decode(json);
	} catch {
		return null;
	}
}

export const PDF_IMPORT_LIMIT_BYTES = MAX_PDF_BYTES;
