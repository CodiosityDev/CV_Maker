import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
	addLetter,
	aiCanWriteLetter,
	aiLetterInput,
	applyAiLetter,
	applyShorter,
	applyTextEdit,
	checkLetter,
	conciseFromLetter,
	createLetter,
	duplicateLetter,
	exportLetterDocx,
	findLetter,
	letterBlockSource,
	letterEmail,
	letterFileName,
	letterFontFamily,
	letterHighlightOptions,
	letterMotivationExamples,
	letterToPlainText,
	LETTER_LIMITS,
	marksAt,
	removeLetter,
	richFromPlain,
	richToPlain,
	sliceRuns,
	suggestHighlights,
	toggleMark,
	toLetterModel,
	updateLetter,
	type CoverLetter,
	type LetterBlock
} from '../../src/lib/core/letter/index';
import { createForeignMatcher } from '../../src/lib/core/foreign/index';
import { sampleCvAts } from '../../src/lib/core/fixtures/index';
import { loadCvDocument, toCvMeta } from '../../src/lib/core/schema/index';
import type { CVDocument, RichRun } from '../../src/lib/core/schema/types';
import { parseAiRequest } from '../../src/lib/core/ai/schema';

const NOW = new Date('2026-11-16T09:00:00+07:00');

function setup(edit: (letter: CoverLetter) => void = () => {}): {
	cv: CVDocument;
	letter: CoverLetter;
} {
	const cv = structuredClone(sampleCvAts);
	const letter = createLetter(cv, { now: NOW });
	letter.position = 'Junior Data Analyst';
	letter.company = 'PT Maju Bersama';
	edit(letter);
	addLetter(cv, letter);
	return { cv, letter: findLetter(cv, letter.id) as CoverLetter };
}

const plainOf = (block: LetterBlock | undefined): string =>
	!block
		? ''
		: block.kind === 'text' || block.kind === 'note'
			? richToPlain(block.runs)
			: block.kind === 'list'
				? block.items.map(richToPlain).join(' | ')
				: block.rows.map((r) => `${r.label}: ${richToPlain(r.value)}`).join(' | ');
const block = (model: ReturnType<typeof toLetterModel>, key: string) =>
	model.blocks.find((b) => b.key === key);

describe('create & change', () => {
	it('createLetter fills what the CV knows', () => {
		const cv = structuredClone(sampleCvAts);
		const letter = createLetter(cv, { now: NOW });
		expect(letter).toMatchObject({
			locale: 'id',
			position: 'Junior Data Analyst',
			company: '',
			place: 'Malang',
			date: '2026-11-16',
			attachments: ['cv'],
			overrides: {},
			style: { font: 'times', size: 12, lineHeight: 1.15, align: 'left' }
		});
		expect(letter.highlights.length).toBeGreaterThanOrEqual(2);
		expect(letter.highlights[0]).toEqual({ section: 'experience', id: cv.experience[0]!.id });
	});

	it('add / update / duplicate / remove', () => {
		const { cv, letter } = setup();
		updateLetter(cv, letter.id, {
			company: '  PT Satu\u0007 ',
			companyAddress: 'Jl. A\nJl. B\nKota C\nBaris 4',
			overrides: { closing: richFromPlain('Terima kasih.') },
			style: { font: 'arial' }
		});
		const updated = findLetter(cv, letter.id)!;
		expect(updated.company).toBe('  PT Satu ');
		expect(updated.companyAddress.split('\n')).toHaveLength(3);
		expect(updated.overrides.closing).toEqual([{ text: 'Terima kasih.' }]);
		expect(updated.style).toEqual({ font: 'arial', size: 12, lineHeight: 1.15, align: 'left' });
		updateLetter(cv, letter.id, { overrides: { closing: undefined } });
		expect(findLetter(cv, letter.id)!.overrides).toEqual({});

		const copyId = duplicateLetter(cv, letter.id, NOW)!;
		const copy = findLetter(cv, copyId)!;
		expect(copy.company).toBe('');
		expect(copy.position).toBe('Junior Data Analyst');
		expect(copy.style.font).toBe('arial');
		expect(toCvMeta(cv).letterCount).toBe(2);

		removeLetter(cv, letter.id);
		removeLetter(cv, copyId);
		expect(cv.letters).toBeUndefined();
	});

	it('stops at the per-CV limit', () => {
		const cv = structuredClone(sampleCvAts);
		for (let i = 0; i < LETTER_LIMITS.perCv; i++)
			expect(addLetter(cv, createLetter(cv))).toBe(true);
		expect(addLetter(cv, createLetter(cv))).toBe(false);
	});

	it('the schema keeps letters and cleans junk (incl. prototype keys)', () => {
		const { cv, letter } = setup();
		const raw = JSON.parse(JSON.stringify(cv)) as Record<string, unknown>;
		const letters = raw.letters as Record<string, unknown>[];
		Object.assign(letters[0]!, {
			source: 'nope',
			attachments: ['cv', 'evil', 'skck'],
			highlights: [
				{ section: 'skills', id: 'hard' },
				{ section: 'skills', id: 'hard' },
				{ section: 'x', id: 'y' }
			],
			overrides: JSON.parse(
				'{"__proto__":{"polluted":1},"opening":[{"text":"Halo","bold":"yes","italic":false},{"text":" dunia"}],"evil":[{"text":"x"}]}'
			),
			style: { font: 'comic-sans', size: 40 }
		});
		letters.push({ ...letters[0], company: 'Duplikat' });
		const result = loadCvDocument(raw);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const loaded = result.cv.letters!;
		expect(loaded).toHaveLength(1);
		expect(loaded[0]!.id).toBe(letter.id);
		expect(loaded[0]!.source).toBeUndefined();
		expect(loaded[0]!.attachments).toEqual(['cv', 'skck']);
		expect(loaded[0]!.highlights).toEqual([{ section: 'skills', id: 'hard' }]);
		expect(loaded[0]!.overrides).toEqual({
			opening: [{ text: 'Halo', italic: false }, { text: ' dunia' }]
		});
		expect(loaded[0]!.style).toEqual({ font: 'times', size: 12, lineHeight: 1.15, align: 'left' });
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});

describe('highlights & examples', () => {
	it('lists CV items and suggests 2–3', () => {
		const cv = structuredClone(sampleCvAts);
		const options = letterHighlightOptions(cv);
		expect(options[0]).toMatchObject({
			section: 'experience',
			label: 'Data Analyst Intern',
			sublabel: expect.stringContaining('PT Nusantara Niaga Digital')
		});
		expect(options.some((o) => o.section === 'skills' && o.ref.id === 'tools')).toBe(true);
		expect(suggestHighlights(cv)).toHaveLength(3);
	});

	it('motivation examples mention the company', () => {
		const { cv, letter } = setup();
		const examples = letterMotivationExamples(cv, letter);
		expect(examples).toHaveLength(3);
		for (const example of examples) expect(example).toContain('PT Maju Bersama');
	});
});

describe('toLetterModel', () => {
	it('writes a formal Indonesian letter from the CV', () => {
		const { cv, letter } = setup((l) => {
			l.source = 'jobPortal';
			l.sourceDetail = 'JobStreet';
			l.motivation = 'Saya tertarik dengan produk analitik PT Maju Bersama';
			l.availability.immediate = true;
			l.attachments = ['cv', 'diploma', 'transcript'];
		});
		const model = toLetterModel(cv, letter);
		expect(model.dateLine).toBe('Malang, 16 November 2026');
		expect(model.meta.map((m) => `${m.label}: ${richToPlain(m.value)}`)).toEqual([
			'Lampiran: 3 berkas',
			'Perihal: Lamaran Pekerjaan sebagai Junior Data Analyst'
		]);
		expect(model.recipient).toEqual([
			'Kepada Yth.',
			'Bapak/Ibu Pimpinan HRD',
			'PT Maju Bersama',
			'di Tempat'
		]);
		expect(model.salutation).toBe('Dengan hormat,');
		expect(plainOf(block(model, 'opening'))).toBe(
			'Berdasarkan informasi lowongan pekerjaan yang saya peroleh melalui JobStreet, saya bermaksud melamar posisi Junior Data Analyst di PT Maju Bersama.'
		);
		const qualifications = plainOf(block(model, 'qualifications'));
		expect(qualifications).toContain(
			'Saya adalah lulusan S1 Sistem Informasi dari Universitas Harapan Bangsa dengan IPK 3.62/4.00.'
		);
		expect(qualifications).toContain(
			'Saya pernah magang sebagai Data Analyst Intern di PT Nusantara Niaga Digital.'
		);
		expect(qualifications).toContain('Di sana, saya membuat dashboard penjualan mingguan');
		expect(plainOf(block(model, 'motivation'))).toBe(
			'Saya tertarik dengan produk analitik PT Maju Bersama. Saya siap mulai bekerja secepatnya.'
		);
		expect(plainOf(block(model, 'attachments'))).toBe(
			'Curriculum Vitae (CV) | Salinan ijazah terakhir | Salinan transkrip nilai'
		);
		expect(plainOf(block(model, 'contact'))).toContain('+62 812-3456-7890');
		expect(model.blocks.map((b) => b.key)).toEqual([
			'opening',
			'qualifications',
			'motivation',
			'attachments',
			'contact',
			'closing'
		]);
		expect(model.closing).toBe('Hormat saya,');
		expect(model.signatureName).toBe('Rizky Aditya Pratama');
		expect(model.pageEstimate).toBeGreaterThan(0.4);
		expect(model.pageEstimate).toBeLessThanOrEqual(1);
	});

	it('the identity table replaces the contact sentence', () => {
		const { cv, letter } = setup((l) => {
			l.includeIdentity = true;
			l.identity = {
				birthPlace: 'Malang',
				birthDate: '2002-05-17',
				address: 'Jl. Ijen 10, Malang'
			};
		});
		const model = toLetterModel(cv, letter);
		expect(plainOf(block(model, 'identity'))).toBe(
			'Nama: Rizky Aditya Pratama | Tempat, tanggal lahir: Malang, 17 Mei 2002 | Pendidikan terakhir: S1 Sistem Informasi, Universitas Harapan Bangsa | Alamat: Jl. Ijen 10, Malang | Telepon: +62 812-3456-7890 | Email: rizky.pratama@example.com'
		);
		expect(block(model, 'contact')).toBeUndefined();
	});

	it('English letters use the business-letter layout', () => {
		const { cv, letter } = setup((l) => {
			l.locale = 'en';
			l.recipient = 'Ms. Rina';
		});
		const model = toLetterModel(cv, letter);
		expect(model.sender[0]).toBe('Rizky Aditya Pratama');
		expect(model.dateLine).toBe('November 16, 2026');
		expect(model.meta).toEqual([]);
		expect(model.salutation).toBe('Dear Ms. Rina,');
		expect(model.closing).toBe('Sincerely,');
		expect(plainOf(block(model, 'qualifications'))).toContain(
			"I hold a Bachelor's Degree in Sistem Informasi"
		);
		// No automatic italics in English.
		const italic = model.blocks
			.flatMap((b) => (b.kind === 'text' ? b.runs : []))
			.some((r) => r.italic);
		expect(italic).toBe(false);
	});

	it('Indonesian letters italicise foreign terms but not the company', () => {
		const { cv, letter } = setup((l) => {
			l.company = 'Global Tech Solution';
			l.motivation = 'Saya ingin mengasah teamwork di Global Tech Solution';
		});
		const model = toLetterModel(cv, letter);
		const runs = (block(model, 'motivation') as { runs: RichRun[] }).runs;
		expect(runs.filter((r) => r.italic).map((r) => r.text)).toEqual(['teamwork']);
		const subject = model.meta[1]!.value;
		expect(subject.filter((r) => r.italic).map((r) => r.text)).toEqual(['Junior Data Analyst']);
	});

	it('overrides replace a paragraph; the user can keep a term upright', () => {
		const { cv, letter } = setup();
		const runs: RichRun[] = [
			{ text: 'Saya ' },
			{ text: 'sangat', bold: true },
			{ text: ' suka teamwork', italic: false }
		];
		updateLetter(cv, letter.id, { overrides: { closing: runs } });
		const model = toLetterModel(cv, findLetter(cv, letter.id)!);
		const closing = block(model, 'closing') as { runs: RichRun[]; auto: boolean };
		expect(closing.auto).toBe(false);
		expect(closing.runs).toEqual([
			{ text: 'Saya ', italic: false },
			{ text: 'sangat', bold: true, italic: false },
			{ text: ' suka teamwork', italic: false }
		]);
		expect(letterBlockSource(cv, findLetter(cv, letter.id)!, 'closing')).toEqual(runs);
	});

	it('user text stays text', () => {
		const { cv, letter } = setup((l) => (l.company = '<img src=x onerror=alert(1)>'));
		const text = letterToPlainText(toLetterModel(cv, letter));
		expect(text).toContain('<img src=x onerror=alert(1)>');
	});
});

describe('rich text', () => {
	const runs: RichRun[] = [{ text: 'Halo ' }, { text: 'dunia', bold: true }, { text: '!' }];

	it('applyTextEdit keeps formatting of untouched text', () => {
		expect(applyTextEdit(runs, 'Halo duniaku!')).toEqual([
			{ text: 'Halo ' },
			{ text: 'duniaku', bold: true },
			{ text: '!' }
		]);
		expect(applyTextEdit(runs, 'Hai dunia!')).toEqual([
			{ text: 'Hai ' },
			{ text: 'dunia', bold: true },
			{ text: '!' }
		]);
		expect(applyTextEdit(runs, '')).toEqual([]);
		expect(applyTextEdit([], 'Baru')).toEqual([{ text: 'Baru' }]);
	});

	it('sliceRuns and toggleMark', () => {
		expect(sliceRuns(runs, 3, 7)).toEqual([{ text: 'o ' }, { text: 'du', bold: true }]);
		expect(toggleMark(runs, 0, 4, 'underline')).toEqual([
			{ text: 'Halo', underline: true },
			{ text: ' ' },
			{ text: 'dunia', bold: true },
			{ text: '!' }
		]);
		// Whole selection already bold → off.
		expect(toggleMark(runs, 5, 10, 'bold')).toEqual([{ text: 'Halo dunia!' }]);
	});

	it('automatic italics count for the toolbar and can be turned off', () => {
		const matcher = createForeignMatcher();
		const text: RichRun[] = [{ text: 'Saya suka teamwork' }];
		expect(marksAt(text, 10, 18, matcher).italic).toBe(true);
		expect(marksAt(text, 10, 18).italic).toBe(false);
		const upright = toggleMark(text, 10, 18, 'italic', matcher);
		expect(upright).toEqual([{ text: 'Saya suka ' }, { text: 'teamwork', italic: false }]);
		expect(marksAt(upright, 10, 18, matcher).italic).toBe(false);
	});
});

describe('checks', () => {
	it('errors for the two required fields', () => {
		const { cv, letter } = setup((l) => {
			l.position = '';
			l.company = '';
		});
		const ids = checkLetter(cv, letter, NOW).map((c) => `${c.level}:${c.id}`);
		expect(ids.slice(0, 2)).toEqual(['error:positionMissing', 'error:companyMissing']);
	});

	it('warnings for a generic, old, overlong letter', () => {
		const { cv, letter } = setup((l) => {
			l.motivation = 'Saya ingin berkembang di perusahaan yang hebat';
			l.date = '2026-09-01';
			const long = richFromPlain(
				'Saya berhasil menaikkan penjualan [isi angka] persen. '.repeat(15)
			);
			l.overrides = { opening: long, qualifications: long, closing: long };
		});
		const ids = checkLetter(cv, letter, NOW).map((c) => c.id);
		expect(ids).toEqual(
			expect.arrayContaining(['motivationGeneric', 'placeholder', 'tooLong', 'dateOld'])
		);
		expect(
			checkLetter(cv, letter, NOW).every((c) => c.messageKey === `letter.checks.${c.id}`)
		).toBe(true);
	});

	it('a complete letter has no errors', () => {
		const { cv, letter } = setup(
			(l) => (l.motivation = 'Saya mengikuti produk PT Maju Bersama sejak kuliah')
		);
		expect(checkLetter(cv, letter, NOW)).toEqual([]);
	});
});

describe('wordiness', () => {
	it('text written from the CV rates as concise', () => {
		const { cv, letter } = setup(
			(l) => (l.motivation = 'Saya tertarik dengan produk PT Maju Bersama')
		);
		const report = conciseFromLetter(toLetterModel(cv, letter));
		expect(report.points.map((p) => p.key)).toEqual([
			'opening',
			'qualifications',
			'motivation',
			'closing'
		]);
		for (const point of report.points) expect(point.issues).not.toContain('filler');
	});

	it('flags a wordy paragraph and applies a shorter version', () => {
		const { cv, letter } = setup((l) => {
			l.motivation =
				'Adapun alasan saya yang mana sangat ingin bergabung adalah dalam rangka untuk dapat mengembangkan berbagai macam hal dan lain-lain dengan sangat baik';
		});
		const report = conciseFromLetter(toLetterModel(cv, letter));
		const motivation = report.points.find((p) => p.key === 'motivation')!;
		expect(motivation.level).not.toBe('ok');
		expect(motivation.fillers.length).toBeGreaterThan(2);
		expect(
			applyShorter({ key: 'motivation', shorter: 'Saya ingin berkembang di PT Maju Bersama.' })
		).toEqual({
			overrides: { motivation: [{ text: 'Saya ingin berkembang di PT Maju Bersama.' }] }
		});
		expect(applyShorter({ key: 'identity', shorter: 'x' })).toEqual({});
	});
});

describe('AI', () => {
	it('sends no personal details and passes the server schema', () => {
		const { cv, letter } = setup((l) => {
			l.source = 'referral';
			l.sourceDetail = 'Bapak Andi Wijaya';
			l.motivation = 'Hubungi saya di rizky@example.com, saya suka produknya';
			l.includeIdentity = true;
			l.identity = { birthPlace: 'Malang', birthDate: '2002-05-17', address: 'Jl. Ijen 10' };
		});
		const input = aiLetterInput(cv, letter, 'Lowongan: kirim ke hr@maju.co.id atau 0812-1111-2222');
		const json = JSON.stringify(input);
		for (const secret of [
			'Rizky',
			'rizky',
			'3456',
			'Andi',
			'Ijen',
			'2002-05-17',
			'hr@maju',
			'1111'
		])
			expect(json).not.toContain(secret);
		expect(input.source).toBe('referral');
		const spaced = aiLetterInput(cv, {
			...letter,
			position: '  Junior   Data\tAnalyst ',
			company: ' PT  Maju '
		});
		expect([spaced.position, spaced.company]).toEqual(['Junior Data Analyst', 'PT Maju']);
		expect(input.highlights.length).toBeGreaterThan(0);
		expect(parseAiRequest({ task: 'letter', letter: input })).toBeDefined();
		expect(aiCanWriteLetter(letter)).toBe(true);
	});

	it('applies the paragraphs that came back', () => {
		const patch = applyAiLetter(
			{
				task: 'letter',
				opening: 'Pembuka baru yang cukup panjang.',
				qualifications: '',
				motivation: 'M',
				closing: 'Penutup.'
			},
			['opening', 'qualifications', 'closing']
		);
		expect(patch).toEqual({
			overrides: {
				opening: [{ text: 'Pembuka baru yang cukup panjang.' }],
				closing: [{ text: 'Penutup.' }]
			}
		});
	});
});

describe('export', () => {
	it('plain text, email, file names and fonts', () => {
		const { cv, letter } = setup();
		const model = toLetterModel(cv, letter);
		const text = letterToPlainText(model);
		expect(text.startsWith('Malang, 16 November 2026\n\nLampiran : 1 berkas')).toBe(true);
		expect(text).toContain('Hormat saya,\n\n\nRizky Aditya Pratama');
		const email = letterEmail(model);
		expect(email.subject).toBe('Lamaran Pekerjaan – Junior Data Analyst – Rizky Aditya Pratama');
		expect(email.body).not.toContain('Kepada Yth.');
		expect(email.body).toContain('CV dan berkas pendukung saya lampirkan');
		expect(email.body.trim().endsWith('rizky.pratama@example.com')).toBe(true);
		expect(letterFileName(cv, letter, 'pdf')).toBe(
			'Surat_Lamaran_Rizky_Aditya_Pratama_PT_Maju_Bersama.pdf'
		);
		expect(letterFileName(cv, { ...letter, locale: 'en' }, 'docx')).toBe(
			'Cover_Letter_Rizky_Aditya_Pratama_PT_Maju_Bersama.docx'
		);
		expect(letterFontFamily('times')).toContain("'CVM Tinos'");
	});

	it('Word document keeps font, formatting and text', async () => {
		const { cv, letter } = setup((l) => {
			l.style = { font: 'arial', size: 11, lineHeight: 1.5, align: 'justify' };
			l.overrides = {
				closing: [{ text: 'Terima kasih ' }, { text: 'banyak', bold: true, underline: true }]
			};
		});
		const blob = await exportLetterDocx(toLetterModel(cv, letter));
		const xml = strFromU8(
			unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']!
		);
		expect(xml).toContain('w:ascii="Arial"');
		expect(xml).toContain('<w:sz w:val="22"/>');
		expect(xml).toContain('<w:jc w:val="both"/>');
		expect(xml).toMatch(/<w:b\/>[\s\S]*?<w:u w:val="single"\/>[\s\S]*?>banyak</);
		expect(xml).toContain('Lamaran Pekerjaan sebagai ');
		expect(xml).not.toMatch(/<w:drawing>/);
	});
});
