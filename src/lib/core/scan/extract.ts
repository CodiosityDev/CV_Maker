/** Detects the file type from its bytes (not its name) and extracts the text. */
import { extractDocx } from './docx';
import { estimatePages, normalizeLines } from './text';
import {
	ScanError,
	SCAN_MAX_BYTES,
	SCAN_MAX_PASTE_CHARS,
	type ExtractedCv,
	type ScanFileKind
} from './types';

/** File type from the first bytes; `undefined` when not PDF/DOCX/plain text. */
export function sniffKind(bytes: Uint8Array, name = ''): ScanFileKind | undefined {
	const head = String.fromCharCode(...bytes.subarray(0, 8));
	if (head.startsWith('%PDF-')) return 'pdf';
	if (head.startsWith('PK\x03\x04')) return 'docx';
	// Old .doc / password-protected Office files (OLE container) and images are not supported.
	if (head.startsWith('\xD0\xCF\x11\xE0')) return undefined;
	if (/\.txt$/i.test(name)) return 'txt';
	return undefined;
}

function decodeText(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new ScanError('unsupported');
	}
}

/**
 * Reads a CV file chosen by the user. Throws ScanError (`ats.scan.errors.<code>`).
 *
 *   const cv = await extractCvText(input.files[0]);
 *   const { report, keywords } = await analyzer.analyzeScan(cv, jobPost);
 */
export async function extractCvText(file: Blob & { name?: string }): Promise<ExtractedCv> {
	if (file.size > SCAN_MAX_BYTES) throw new ScanError('tooLarge');
	if (file.size === 0) throw new ScanError('empty');
	let bytes: Uint8Array;
	try {
		bytes = new Uint8Array(await file.arrayBuffer());
	} catch {
		throw new ScanError('failed');
	}
	const kind = sniffKind(bytes, file.name);
	if (kind === 'pdf') return (await import('./pdf')).extractPdf(bytes);
	if (kind === 'docx') return extractDocx(bytes);
	if (kind === 'txt') return fromPlainText(decodeText(bytes));
	throw new ScanError('unsupported');
}

function fromPlainText(raw: string): ExtractedCv {
	const text = normalizeLines(raw);
	if (!text) throw new ScanError('empty');
	return {
		kind: 'txt',
		text,
		pages: estimatePages(text),
		layout: {
			imageOnly: false,
			columns: false,
			tables: false,
			textBoxes: false,
			images: 0,
			contactInHeaderFooter: false
		}
	};
}

/**
 * CV text pasted by the user ("Tempel teks CV"): treated like a .txt file, so the same checks,
 * keyword matching and "Ubah jadi CV ATS" work. Throws ScanError ('empty' · 'tooLarge').
 *
 *   const cv = extractPastedText(textarea.value);
 */
export function extractPastedText(text: string): ExtractedCv {
	if (text.length > SCAN_MAX_PASTE_CHARS) throw new ScanError('tooLarge');
	return fromPlainText(text);
}
