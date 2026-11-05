import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { toRenderModel } from '../../src/lib/core/render/index';
import {
	backupFileName,
	exportDocx,
	exportFileName,
	exportTxt,
	toPlainText
} from '../../src/lib/core/export/index';
import { emptyCvAts, sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

describe('exportFileName', () => {
	it('builds a readable, portable name', () => {
		expect(
			exportFileName({ fullName: 'Rizky Aditya Pratama', targetRole: 'Junior Data Analyst' }, 'pdf')
		).toBe('CV_Rizky_Aditya_Pratama_Junior_Data_Analyst.pdf');
	});

	it('strips accents, symbols and path characters', () => {
		expect(exportFileName({ fullName: 'Ádé ../ Putri*', targetRole: 'UI/UX' }, 'docx')).toBe(
			'CV_Ade_Putri_UI_UX.docx'
		);
	});

	it('falls back to the CV title, then to "CV"', () => {
		expect(exportFileName({ fullName: '', title: 'CV Bank' }, 'txt')).toBe('CV_CV_Bank.txt');
		expect(exportFileName({}, 'pdf')).toBe('CV.pdf');
	});

	it('names backups by date', () => {
		expect(backupFileName(new Date('2026-11-05T10:00:00Z'))).toBe('CVMaker_Backup_2026-11-05.json');
	});
});

describe('plain text export', () => {
	const text = toPlainText(toRenderModel(sampleCvAts));

	it('contains every section in order with readable structure', () => {
		const order = [
			'RINGKASAN',
			'PENDIDIKAN',
			'PENGALAMAN KERJA',
			'PENGALAMAN ORGANISASI',
			'PROYEK'
		];
		let at = 0;
		for (const heading of order) {
			const next = text.indexOf(heading, at);
			expect(next, heading).toBeGreaterThan(at - 1);
			at = next;
		}
		expect(text.startsWith('RIZKY ADITYA PRATAMA\n')).toBe(true);
		expect(text).toContain('Email: rizky.pratama@example.com');
		expect(text).toContain('Data Analyst Intern — PT Nusantara Niaga Digital');
		expect(text).toContain('- Membuat dashboard penjualan mingguan');
		expect(text).toContain('Keahlian Teknis: SQL, Python (Pandas, NumPy)');
	});

	it('handles an empty CV', () => {
		expect(toPlainText(toRenderModel(emptyCvAts))).toBe('\n');
	});

	it('is offered as a UTF-8 text file', async () => {
		const blob = await exportTxt(toRenderModel(sampleCvCreative));
		expect(blob.type).toBe('text/plain;charset=utf-8');
		expect(await blob.text()).toContain('NADIA PUTRI MAHARANI');
	});
});

describe('docx export', () => {
	async function documentXml(model = toRenderModel(sampleCvAts)): Promise<string> {
		const blob = await exportDocx(model);
		const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
		const xml = files['word/document.xml'];
		if (!xml) throw new Error('word/document.xml missing');
		return strFromU8(xml);
	}

	it('produces a valid Word document with the CV content', async () => {
		const xml = await documentXml();
		expect(xml).toContain('Rizky Aditya Pratama');
		expect(xml).toContain('Pendidikan');
		expect(xml).toContain('PT Nusantara Niaga Digital');
		expect(xml).toContain('Membuat dashboard penjualan mingguan');
	});

	it('uses real headings and real bullet lists (ATS-readable)', async () => {
		const xml = await documentXml();
		expect(xml).toMatch(/w:pStyle w:val="Heading1"/);
		expect(xml).toMatch(/w:pStyle w:val="Heading2"/);
		expect(xml).toMatch(/<w:numPr>/);
		expect(xml).not.toMatch(/<w:tbl>/); // no layout tables
		expect(xml).not.toMatch(/<w:drawing>/); // no images
	});

	it('escapes user text', async () => {
		const cv = structuredClone(sampleCvAts);
		cv.personal.fullName = 'A & B <script>';
		const xml = await documentXml(toRenderModel(cv));
		expect(xml).toContain('A &amp; B &lt;script&gt;');
		expect(xml).not.toContain('<script>');
	});

	it('works for an empty CV', async () => {
		await expect(exportDocx(toRenderModel(emptyCvAts))).resolves.toBeInstanceOf(Blob);
	});
});
