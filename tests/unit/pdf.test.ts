import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	buildPdf,
	PAGE_HEIGHT_PX,
	type DrawOp,
	type FontRef
} from '../../src/lib/core/pdf/document';
import { encodeCvPayload, findCvPayload, readCvPayload } from '../../src/lib/core/pdf/payload';
import { parseTrueType, woffToSfnt } from '../../src/lib/core/pdf/truetype';
import {
	HELVETICA_BOLD_WIDTHS,
	HELVETICA_WIDTHS,
	isWinAnsiText,
	winAnsiCode
} from '../../src/lib/core/pdf/winansi';

const jakarta = () =>
	parseTrueType(
		new Uint8Array(readFileSync('static/fonts/pdf/plus-jakarta-sans-latin-700-normal.woff')),
		'PlusJakartaSans-Bold'
	);

const codes = (text: string) => [...text].map((char) => winAnsiCode(char.codePointAt(0)!)!);
/** Glyphs placed like a browser would: each at the previous one's advance width. */
function textOp(text: string, y: number, font: FontRef, widths: number[]): DrawOp {
	const list = codes(text);
	const xs: number[] = [];
	let x = 50;
	for (const code of list) {
		xs.push(x);
		x += (widths[code - 32]! * 16) / 1000;
	}
	return { kind: 'text', font, size: 16, color: [31, 29, 61], y, codes: list, xs };
}

async function pdfText(bytes: Uint8Array): Promise<string[]> {
	const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 });
	const doc = await task.promise;
	const pages: string[] = [];
	for (let n = 1; n <= doc.numPages; n++) {
		const content = await (await doc.getPage(n)).getTextContent();
		pages.push(
			content.items
				.map((item) => ('str' in item ? item.str : ''))
				.join('')
				.trim()
		);
	}
	await task.destroy();
	return pages;
}

describe('WinAnsi', () => {
	it('encodes Indonesian CV text and refuses other scripts', () => {
		expect(isWinAnsiText('Budi Santoso — S1 Teknik “Informatika” • 2024–2026 €')).toBe(true);
		expect(isWinAnsiText('Résumé, naïve, Ñ, ü')).toBe(true);
		expect(isWinAnsiText('张伟')).toBe(false);
		expect(isWinAnsiText('Halo 👋')).toBe(false);
		expect(winAnsiCode(0x2022)).toBe(0x95);
		expect(winAnsiCode(0x00ad)).toBe(-1);
	});
});

describe('TrueType', () => {
	it('turns the WOFF font into an embeddable TrueType font with widths', () => {
		const font = jakarta();
		expect(new DataView(font.bytes.buffer).getUint32(0)).toBe(0x00010000);
		expect(font.widths).toHaveLength(224);
		// Proportional font: "i" narrower than "W", space has a width.
		expect(font.widths[0x57 - 32]!).toBeGreaterThan(font.widths[0x69 - 32]!);
		expect(font.widths[0]!).toBeGreaterThan(0);
		expect(font.ascent).toBeGreaterThan(0);
		expect(font.descent).toBeLessThan(0);
	});

	it('leaves a plain TTF unchanged', () => {
		const ttf = jakarta().bytes;
		expect(woffToSfnt(ttf)).toBe(ttf);
	});
});

describe('PDF file', () => {
	it('keeps the text readable (ATS) with standard and embedded fonts, on several pages', async () => {
		const bytes = buildPdf({
			pages: [
				{
					ops: [
						{
							kind: 'fill',
							shape: { x: 0, y: 0, w: 200, h: PAGE_HEIGHT_PX },
							color: [156, 154, 255]
						},
						{
							kind: 'fill',
							shape: { x: 10, y: 10, w: 40, h: 40, corners: Array(4).fill([20, 20]) },
							color: [255, 255, 255]
						},
						textOp('Budi Santoso', 100, { embedded: 'jakarta-700-normal' }, jakarta().widths),
						textOp('Pengalaman (2024) \\ kerja', 140, { standard: 'Helvetica' }, HELVETICA_WIDTHS)
					],
					links: [{ x: 50, y: 150, w: 100, h: 20, uri: 'mailto:budi@example.com' }]
				},
				{
					ops: [textOp('Halaman dua', 100, { standard: 'Helvetica-Bold' }, HELVETICA_BOLD_WIDTHS)],
					links: []
				}
			],
			fonts: { 'jakarta-700-normal': jakarta() },
			info: { title: 'Budi Santoso – Data Analyst', author: 'Budi Santoso' },
			lang: 'id'
		});
		const text = new TextDecoder('latin1').decode(bytes);
		expect(text.startsWith('%PDF-1.7')).toBe(true);
		expect(text).toContain('/FontFile2');
		expect(text).toContain('/BaseFont /Helvetica');
		expect(text).toContain('/URI (mailto:budi@example.com)');
		expect(await pdfText(bytes)).toEqual([
			expect.stringMatching(/Budi Santoso\s*Pengalaman \(2024\) \\ kerja/),
			'Halaman dua'
		]);
	});
});

describe('CV data inside the PDF', () => {
	const backup = JSON.stringify({ format: 'cvmaker-backup', version: 1, cvs: [{ id: 'x' }] });

	it('round-trips through a PDF file', async () => {
		const data = await encodeCvPayload(backup);
		expect(data).not.toContain('cvmaker-backup'); // not readable as plain text
		const bytes = buildPdf({ pages: [{ ops: [], links: [] }], data });
		expect(await readCvPayload(bytes)).toBe(backup);
	});

	it('refuses other PDFs and altered data', async () => {
		const plain = buildPdf({ pages: [{ ops: [], links: [] }] });
		expect(findCvPayload(plain)).toBeUndefined();
		expect(await readCvPayload(plain)).toBeNull();
		expect(
			await readCvPayload(new Uint8Array(readFileSync('tests/fixtures/scan-simple.pdf')))
		).toBeNull();

		const data = await encodeCvPayload(backup);
		const tampered = data.slice(0, 40) + (data[40] === 'A' ? 'B' : 'A') + data.slice(41);
		const bytes = buildPdf({ pages: [{ ops: [], links: [] }], data: tampered });
		expect(await readCvPayload(bytes)).toBeNull();
	});
});
