import { describe, expect, it } from 'vitest';
import { knownTerms } from '../../src/lib/core/ats/analyze';
import { matchKeywords, normalize } from '../../src/lib/core/ats/keywords';
import { KEYWORD_LEXICON } from '../../src/lib/core/ats/lexicon';
import { STOPWORDS } from '../../src/lib/core/ats/stopwords';
import { extractPastedText } from '../../src/lib/core/scan/extract';
import { ScanError, SCAN_MAX_PASTE_CHARS } from '../../src/lib/core/scan/types';

const POST = `Kami mencari Backend Developer.
Kualifikasi: menguasai PHP dan Laravel, pengalaman membangun RESTful API, memahami MySQL dan Git.
Nilai plus: Docker, Redis, unit testing, Node.js atau C#. Mampu bekerja dalam tim.
Kirim CV ke hr@contoh.co.id, info di www.contoh.co.id/karir atau lamar via LinkedIn. Gaji net 8 juta.`;
const CV = `Mengembangkan aplikasi web dengan PHP dan MySQL. Membuat REST API untuk aplikasi mobile.
Menggunakan Git untuk kolaborasi tim. Kerja tim yang baik.`;

async function match(post = POST, cv = CV) {
	const report = matchKeywords(post, cv, await knownTerms());
	return {
		report,
		missing: report.keywords.filter((k) => !k.inCv).map((k) => k.term),
		found: report.keywords.filter((k) => k.inCv).map((k) => k.term),
		all: report.keywords.map((k) => k.term)
	};
}

describe('keyword matcher with the lexicon', () => {
	it('names what the CV lacks, e.g. Laravel and REST API', async () => {
		const { missing } = await match(POST, 'Mengembangkan aplikasi web dengan PHP.');
		expect(missing).toEqual(expect.arrayContaining(['Laravel', 'REST API', 'MySQL', 'Redis']));
	});

	it('matches other spellings on both sides', async () => {
		const { found, missing } = await match();
		// "RESTful API" in the post = "REST API" in the CV; "bekerja dalam tim" = "kerja tim".
		expect(found).toEqual(
			expect.arrayContaining(['REST API', 'MySQL', 'PHP', 'Git', 'Kerja Sama Tim'])
		);
		expect(missing).toEqual(
			expect.arrayContaining(['Laravel', 'Redis', 'Docker', 'Unit Testing', 'Node.js', 'C#'])
		);
		const nodeCv = await match(
			'Pengalaman dengan Node.js',
			'Membuat API dengan NodeJS dan Express'
		);
		expect(nodeCv.found).toContain('Node.js');
	});

	it('finds technology names mentioned once even outside the dictionary', async () => {
		const { all } = await match(
			'Menguasai Deno.js, F# dan WebAssembly. Pengalaman SvelteKit menjadi nilai plus.',
			''
		);
		expect(all).toEqual(expect.arrayContaining(['Deno.js', 'F#', 'WebAssembly', 'Svelte']));
	});

	it('ignores emails, links, where-to-apply sites and "gaji net"', async () => {
		const { all } = await match();
		const keys = all.map(normalize);
		for (const noise of ['linkedin', 'contoh.co.id', 'hr', 'net', 'www.contoh.co.id', 'asp.net'])
			expect(keys).not.toContain(noise);
	});

	it('stays fast on hostile input', async () => {
		const terms = await knownTerms();
		const started = performance.now();
		matchKeywords('a'.repeat(20_000), CV, terms);
		matchKeywords(`${'x.'.repeat(5000)} ${'@'.repeat(5000)} ${'Ab'.repeat(5000)}`, CV, terms);
		expect(performance.now() - started).toBeLessThan(1000);
	});
});

describe('lexicon sanity', () => {
	it('has unique terms and no alias that is a common word or too short to be safe', () => {
		const keys = KEYWORD_LEXICON.map((entry) => normalize(entry.term));
		expect(new Set(keys).size).toBe(keys.length);
		const allowedShort = new Set(['js', 'qa', 'qc', 'k3', 'c#']);
		for (const entry of KEYWORD_LEXICON) {
			for (const alias of entry.aliases ?? []) {
				const key = normalize(alias);
				expect(key.length >= 3 || allowedShort.has(key), `${entry.term}: ${alias}`).toBe(true);
				expect(STOPWORDS.has(key), `${entry.term}: ${alias}`).toBe(false);
			}
		}
	});
});

describe('extractPastedText ("Tempel teks CV")', () => {
	it('works like a .txt file', () => {
		const cv = extractPastedText('  Rizky Pratama\n\nPENGALAMAN\n• Membuat REST API\n');
		expect(cv).toMatchObject({ kind: 'txt', layout: { imageOnly: false } });
		expect(cv.text).toContain('PENGALAMAN');
		expect(cv.pages).toBeGreaterThanOrEqual(1);
	});

	it('rejects empty and oversized text', () => {
		const code = (fn: () => unknown) => {
			try {
				fn();
			} catch (error) {
				return error instanceof ScanError ? error.code : 'other';
			}
			return 'none';
		};
		expect(code(() => extractPastedText('   \n  '))).toBe('empty');
		expect(code(() => extractPastedText('a'.repeat(SCAN_MAX_PASTE_CHARS + 1)))).toBe('tooLarge');
	});
});
