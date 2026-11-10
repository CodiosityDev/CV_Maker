import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	analyzeScan,
	extractCvText,
	headingSection,
	ScanError,
	sniffKind
} from '../../src/lib/core/scan/index';
import { extractDocx, wordXmlToText } from '../../src/lib/core/scan/docx';
import { normalizeLines, pdfPagesToText, type PdfTextItem } from '../../src/lib/core/scan/text';
import type { ExtractedCv } from '../../src/lib/core/scan/types';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string, list = false) =>
	`<w:p>${list ? '<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>' : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

function docx(body: string, extra: Record<string, string> = {}): Uint8Array {
	return zipSync({
		'[Content_Types].xml': strToU8('<Types/>'),
		'word/document.xml': strToU8(
			`<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`
		),
		...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)]))
	});
}

const GOOD_CV = `Rina Putri Lestari
Fresh Graduate Sistem Informasi
rina.lestari@gmail.com | 0812-3456-7890 | linkedin.com/in/rinalestari
RINGKASAN
Lulusan S1 Sistem Informasi dengan pengalaman magang analisis data dan kemampuan SQL, Python, dan Excel untuk membantu tim mengambil keputusan.
PENDIDIKAN
Universitas Brawijaya — S1 Sistem Informasi, 2021 – 2025, IPK 3.65
PENGALAMAN
Data Analyst Intern — PT Maju Jaya, Jan 2024 – Jun 2024
• Membuat 12 dashboard penjualan mingguan dengan Power BI untuk 5 cabang
• Membersihkan 40.000 baris data transaksi dengan Python sehingga laporan 30% lebih cepat
• Menyusun laporan bulanan untuk manajer penjualan dan tim keuangan perusahaan
ORGANISASI
Himpunan Mahasiswa Sistem Informasi — Ketua Divisi Riset, 2022 – 2023
• Memimpin 8 anggota dalam 3 survei kepuasan mahasiswa
KEAHLIAN
SQL, Python, Excel, Power BI, Komunikasi, Kerja sama tim
SERTIFIKASI
Google Data Analytics Certificate, 2024`;

const extracted = (
	text: string,
	layout: Partial<ExtractedCv['layout']> = {},
	pages = 1
): ExtractedCv => ({
	kind: 'pdf',
	text,
	pages,
	layout: {
		imageOnly: false,
		columns: false,
		tables: false,
		textBoxes: false,
		images: 0,
		contactInHeaderFooter: false,
		...layout
	}
});

describe('file type and limits', () => {
	it('sniffs by bytes, not by name', () => {
		expect(sniffKind(strToU8('%PDF-1.7\n'), 'cv.docx')).toBe('pdf');
		expect(sniffKind(docx(para('x')), 'cv.pdf')).toBe('docx');
		expect(
			sniffKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'cv.doc')
		).toBeUndefined();
		expect(sniffKind(strToU8('hello'), 'cv.txt')).toBe('txt');
		expect(sniffKind(strToU8('\x89PNG'), 'photo.png')).toBeUndefined();
	});

	it('rejects big, empty, unknown and non-UTF-8 files with a code', async () => {
		const code = async (blob: Blob & { name?: string }) =>
			extractCvText(blob).then(
				() => 'ok',
				(error: unknown) => (error instanceof ScanError ? error.code : 'other')
			);
		const named = (parts: BlobPart[], name: string) => Object.assign(new Blob(parts), { name });
		expect(await code(named([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf'))).toBe('tooLarge');
		expect(await code(named([], 'cv.pdf'))).toBe('empty');
		expect(await code(named(['\x89PNG....'], 'cv.png'))).toBe('unsupported');
		expect(await code(named([new Uint8Array([0xff, 0xfe, 0xfd])], 'cv.txt'))).toBe('unsupported');
		expect(await code(named(['  \n \n'], 'cv.txt'))).toBe('empty');
		expect(await code(named(['PK\x03\x04broken'], 'cv.docx'))).toBe('damaged');
	});

	it('reads a TXT file', async () => {
		const cv = await extractCvText(Object.assign(new Blob([GOOD_CV]), { name: 'cv.txt' }));
		expect(cv.kind).toBe('txt');
		expect(cv.text.split('\n')[0]).toBe('Rina Putri Lestari');
	});
});

describe('DOCX', () => {
	it('keeps paragraphs, list items, tabs and entities; skips duplicated fallback text', () => {
		const xml = `<w:document ${W}><w:body>${para('Data &amp; Analitik')}${para('Membuat dashboard', true)}<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p><mc:AlternateContent><mc:Choice><w:p><w:r><w:t>Kotak</w:t></w:r></w:p></mc:Choice><mc:Fallback><w:p><w:r><w:t>Kotak</w:t></w:r></w:p></mc:Fallback></mc:AlternateContent></w:body></w:document>`;
		const { text } = wordXmlToText(xml);
		expect(normalizeLines(text)).toBe('Data & Analitik\n• Membuat dashboard\nA B\nC\nKotak');
	});

	it('flags tables, text boxes, pictures and contact details only in the header', () => {
		const bytes = docx(
			`<w:tbl><w:tr><w:tc>${para('PENDIDIKAN')}</w:tc></w:tr></w:tbl><w:p><w:r><w:pict><w:txbxContent>${para('Keahlian')}</w:txbxContent></w:pict></w:r></w:p>`,
			{
				'word/header1.xml': `<w:hdr ${W}>${para('rina@gmail.com 081234567890')}</w:hdr>`,
				'word/media/image1.png': 'png'
			}
		);
		const cv = extractDocx(bytes);
		expect(cv.layout).toMatchObject({
			tables: true,
			textBoxes: true,
			images: 1,
			contactInHeaderFooter: true
		});
		// Header text still counts: the email is found, but its position is warned about.
		const report = analyzeScan(cv);
		expect(report.contact.email).toBe(true);
		expect(report.checks.map((c) => c.id)).toEqual(
			expect.arrayContaining(['tables', 'textBoxes', 'contactInHeaderFooter', 'graphics'])
		);
	});

	it('refuses a zip bomb before inflating it', () => {
		const bomb = zipSync({ 'word/document.xml': new Uint8Array(9 * 1024 * 1024) });
		expect(() => extractDocx(bomb)).toThrow(ScanError);
		expect(() => extractDocx(zipSync({ 'other.xml': strToU8('<x/>') }))).toThrow(/unsupported/);
	});
});

describe('PDF layout', () => {
	const item = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({
		str,
		x,
		y,
		width,
		height: 10
	});

	it('joins runs on one baseline and keeps a right-aligned date on the same line', () => {
		const { text, columns } = pdfPagesToText([
			{
				width: 595,
				items: [
					item('Data Analyst', 50, 700),
					item(' Intern', 110, 700.5),
					item('Jan 2024 – Jun 2024', 450, 700),
					item('• Membuat 12 dashboard', 60, 685)
				]
			}
		]);
		expect(columns).toBe(false);
		expect(text).toBe('Data Analyst Intern Jan 2024 – Jun 2024\n• Membuat 12 dashboard');
	});

	it('detects two columns and reads them one after the other', () => {
		const left = ['KEAHLIAN', 'SQL', 'Python', 'Excel', 'BAHASA', 'Inggris'];
		const right = [
			'PENGALAMAN',
			'Membuat dashboard penjualan mingguan',
			'Membersihkan data transaksi pelanggan',
			'Menyusun laporan bulanan untuk manajer',
			'Mengelola arsip dokumen tim keuangan',
			'Memimpin rapat koordinasi divisi riset'
		];
		const items = [
			...left.map((s, i) => item(s, 40, 700 - i * 15, 60)),
			...right.map((s, i) => item(s, 230, 700 - i * 15, 300))
		];
		const { text, columns } = pdfPagesToText([{ width: 595, items }]);
		expect(columns).toBe(true);
		expect(text.split('\n')).toEqual([...left, ...right]);
	});
});

describe('headings', () => {
	it('recognises Indonesian and English section titles, not sentences or bullets', () => {
		expect(headingSection('PENGALAMAN KERJA')).toBe('experience');
		expect(headingSection('Pengalaman Organisasi')).toBe('organizations');
		expect(headingSection('Organisasi dan Kepanitiaan')).toBe('organizations');
		expect(headingSection('Work Experience')).toBe('experience');
		expect(headingSection('Keahlian Teknis:')).toBe('skills');
		expect(headingSection('Education')).toBe('education');
		expect(headingSection('Pendidikan anak usia dini di desa binaan.')).toBeUndefined();
		expect(headingSection('• Keahlian')).toBeUndefined();
		expect(headingSection('Magang di bagian keuangan perusahaan')).toBeUndefined();
	});
});

describe('analyzeScan', () => {
	it('scores a clear one-column CV high and finds its sections and contact details', () => {
		const report = analyzeScan(extracted(GOOD_CV));
		expect(report.sections).toEqual([
			'summary',
			'education',
			'experience',
			'organizations',
			'skills',
			'certifications'
		]);
		expect(report.contact).toEqual({ email: true, phone: true, linkedin: true });
		expect(report.stats.bullets).toBe(4);
		expect(report.counts.error).toBe(0);
		expect(report.score).toBeGreaterThanOrEqual(85);
		expect(report.grade).toBe('good');
		expect(report.locale).toBe('id');
		expect(report.checks.every((c) => c.messageKey === `ats.scan.checks.${c.id}`)).toBe(true);
	});

	it('reports an image-only PDF as unreadable with score 0', () => {
		const report = analyzeScan(extracted('', { imageOnly: true }));
		expect(report.score).toBe(0);
		expect(report.checks.map((c) => c.id)).toEqual(['imageOnly']);
	});

	it('flags missing contact, unclear headings, columns, paragraphs and length', () => {
		const paragraphs = Array.from(
			{ length: 30 },
			(_, i) =>
				`Saya bertanggung jawab atas banyak hal di kantor nomor ${i} dan bekerja keras setiap hari.`
		).join('\n');
		const report = analyzeScan(extracted(`Budi\n${paragraphs}`, { columns: true }, 3));
		const ids = report.checks.map((c) => c.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				'missingEmail',
				'missingPhone',
				'unclearHeadings',
				'multiColumn',
				'tooLong'
			])
		);
		expect(report.grade).toBe('needsWork');
		expect(report.checks[0]?.level).toBe('error');
	});

	it('flags weak bullets, casual email and garbled icon-font text', () => {
		const text = `ganteng123456@yahoo.com 081234567890
PENDIDIKAN
SMA Negeri 1 Malang 2019 – 2022
PENGALAMAN
• saya bantu bantu di toko
• jaga kasir
• Tanggung jawab atas stok barang di gudang
KEAHLIAN
\uE001 Excel \uE002 Word \uE003 Canva \uE004 Photoshop \uE005 Komunikasi
RINGKASAN
D a t a A n a l y s t M u d a
B e r p e n g a l a m a n d i t o k o`;
		const ids = analyzeScan(extracted(text)).checks.map((c) => c.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				'unprofessionalEmail',
				'garbledText',
				'bulletNoVerb',
				'fewNumbers',
				'firstPerson'
			])
		);
	});
});

describe('hostile files', () => {
	it('stays fast on a long line without spaces (no regex backtracking blow-up)', () => {
		const junk = `${'a.b-c'.repeat(8000)}\n${'1-'.repeat(10000)}`;
		const started = performance.now();
		analyzeScan(extracted(junk));
		expect(performance.now() - started).toBeLessThan(1000);
	});
});
