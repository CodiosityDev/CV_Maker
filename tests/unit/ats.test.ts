import { describe, expect, it } from 'vitest';
import {
	analyzeCv,
	createAtsAnalyzer,
	matchKeywords,
	type AtsCheck,
	type CheckId
} from '../../src/lib/core/ats/index';
import { emptyCvAts, sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import type { CVDocument } from '../../src/lib/core/schema/index';
import { atsId } from '../../src/lib/i18n/messages/ats.id';
import { atsEn } from '../../src/lib/i18n/messages/ats.en';
import type { MessageKey } from '../../src/lib/i18n/translate';

const clone = (cv: CVDocument): CVDocument => structuredClone(cv);
const ids = (checks: AtsCheck[]) => checks.map((c) => c.id);

// Compile-time: every check message key is a real i18n key.
const _typed: MessageKey = 'ats.checks.missingEmail' as AtsCheck['messageKey'];
void _typed;

describe('analyzeCv', () => {
	it('a complete sample CV has no errors and a good score', () => {
		const report = analyzeCv(sampleCvAts);
		expect(report.counts.error).toBe(0);
		expect(report.score).toBeGreaterThanOrEqual(80);
		expect(report.stats.bullets).toBeGreaterThan(0);
	});

	it('an empty CV needs work, with the essential errors first', () => {
		const report = analyzeCv(emptyCvAts);
		expect(report.grade).toBe('needsWork');
		expect(report.score).toBeLessThan(50);
		expect(ids(report.checks).slice(0, 4)).toEqual([
			'missingName',
			'missingEmail',
			'missingPhone',
			'missingEducation'
		]);
		const levels = report.checks.map((c) => c.level);
		expect(levels).toEqual(
			[...levels].sort(
				(a, b) => ['error', 'warn', 'tip'].indexOf(a) - ['error', 'warn', 'tip'].indexOf(b)
			)
		);
	});

	it('points each check to the step and field to fix', () => {
		const check = analyzeCv(emptyCvAts).checks.find((c) => c.id === 'missingEmail');
		expect(check).toMatchObject({
			level: 'error',
			messageKey: 'ats.checks.missingEmail',
			target: { step: 'personal', field: 'email' }
		});
	});

	it('validates email and phone, and flags casual emails', () => {
		const cv = clone(sampleCvAts);
		cv.personal.email = 'rizky@';
		cv.personal.phone = '123';
		expect(ids(analyzeCv(cv).checks)).toEqual(
			expect.arrayContaining(['invalidEmail', 'invalidPhone'])
		);
		cv.personal.email = 'rizky.cute1234@example.com';
		expect(ids(analyzeCv(cv).checks)).toContain('unprofessionalEmail');
	});

	it('warns that a creative CV is less suited to ATS portals', () => {
		expect(ids(analyzeCv(sampleCvCreative).checks)).toContain('creativeForAts');
		expect(ids(analyzeCv(sampleCvAts).checks)).not.toContain('creativeForAts');
	});

	it('reviews bullets: verbs, first person, length, duplicates', () => {
		const cv = clone(sampleCvAts);
		cv.experience[0]!.bullets = [
			'saya membantu tim keuangan setiap hari dengan rekap faktur',
			'Bantu',
			'Mengelola ' + 'data '.repeat(60),
			'Membuat laporan mingguan untuk atasan',
			'Membuat laporan mingguan untuk atasan'
		];
		const checks = analyzeCv(cv).checks;
		const byId = (id: CheckId) => checks.find((c) => c.id === id);
		expect(byId('firstPerson')?.params).toMatchObject({
			count: 1,
			item: 'Data Analyst Intern — PT Nusantara Niaga Digital'
		});
		expect(byId('bulletNoVerb')?.params?.count).toBe(2); // "saya ..." and "Bantu"
		expect(byId('bulletTooShort')?.params?.count).toBe(1);
		expect(byId('bulletTooLong')?.params?.count).toBe(1);
		expect(byId('duplicateBullet')?.params?.count).toBe(1);
		expect(byId('firstPerson')?.target).toMatchObject({
			step: 'experience',
			itemId: 'exp-1',
			field: 'bullets'
		});
	});

	it('recognises Indonesian and English action verbs', () => {
		const cv = clone(sampleCvAts);
		cv.experience[0]!.bullets = [
			'Mengelola 3 akun media sosial perusahaan',
			'Berhasil menaikkan penjualan 20% dalam 3 bulan',
			'Managed weekly reports for 3 division heads',
			'Led a team of 5 volunteers for 2 months'
		];
		expect(ids(analyzeCv(cv).checks)).not.toContain('bulletNoVerb');
	});

	it('flags missing dates, items without bullets and invalid links', () => {
		const cv = clone(sampleCvAts);
		cv.experience[0]!.dates = { current: false };
		cv.organizations[0]!.bullets = [];
		cv.personal.links.push({ id: 'bad', label: 'Portofolio', url: 'javascript:alert(1)' });
		const found = ids(analyzeCv(cv).checks);
		expect(found).toEqual(
			expect.arrayContaining(['missingDates', 'itemWithoutBullets', 'invalidLink'])
		);
	});

	it('asks for numbers when few bullets are measurable', () => {
		const cv = clone(sampleCvAts);
		for (const e of cv.experience)
			e.bullets = e.bullets.map(() => 'Membantu tim menyusun laporan rutin');
		for (const o of cv.organizations)
			o.bullets = o.bullets.map(() => 'Mengelola kegiatan organisasi kampus');
		for (const p of cv.projects)
			p.bullets = p.bullets.map(() => 'Membangun dashboard untuk pemilik usaha');
		expect(ids(analyzeCv(cv).checks)).toContain('fewNumbers');
	});

	it('every check id has a message in both languages', () => {
		const all: CheckId[] = [
			'missingName',
			'missingEmail',
			'invalidEmail',
			'missingPhone',
			'invalidPhone',
			'missingEducation',
			'noExperience',
			'noSkills',
			'missingSummary',
			'longSummary',
			'missingDates',
			'invalidLink',
			'unprofessionalEmail',
			'creativeForAts',
			'itemWithoutBullets',
			'tooLong',
			'shortSummary',
			'missingHeadline',
			'bulletNoVerb',
			'fewNumbers',
			'bulletTooLong',
			'bulletTooShort',
			'firstPerson',
			'duplicateBullet',
			'fewSkills'
		];
		for (const id of all) {
			expect(atsId.ats.checks[id], id).toBeTruthy();
			expect(atsEn.ats.checks[id], id).toBeTruthy();
		}
		expect(Object.keys(atsId.ats.checks).sort()).toEqual([...all].sort());
	});
});

describe('matchKeywords', () => {
	const post = `Kami mencari Staf Akuntansi. Kualifikasi: menguasai Microsoft Excel dan Accurate,
		memahami perpajakan. Pengalaman Rekonsiliasi Bank menjadi nilai plus.
		Tugas: menyusun laporan keuangan bulanan dan laporan keuangan tahunan.`;
	const known = ['Microsoft Excel', 'Excel', 'Accurate', 'Rekonsiliasi Bank', 'SQL', 'Go'];

	it('finds known skills and repeated phrases, and checks them against the CV', () => {
		const cv = 'Menguasai Microsoft Excel. Menyusun laporan keuangan untuk UMKM.';
		const report = matchKeywords(post, cv, known);
		const terms = report.keywords.map((k) => k.term);
		expect(terms.slice(0, 3)).toEqual(['Rekonsiliasi Bank', 'Microsoft Excel', 'Accurate']);
		expect(terms).not.toContain('Excel'); // part of "Microsoft Excel"
		expect(terms).toContain('laporan keuangan');
		expect(report.keywords.find((k) => k.term === 'Microsoft Excel')?.inCv).toBe(true);
		expect(report.keywords.find((k) => k.term === 'Accurate')?.inCv).toBe(false);
		expect(report.keywords.find((k) => k.term === 'laporan keuangan')).toMatchObject({
			count: 2,
			inCv: true,
			known: false
		});
		expect(report.coverage).toBeGreaterThan(0);
		expect(report.coverage).toBeLessThan(1);
	});

	it('ignores job-ad filler and matches whole words only', () => {
		const report = matchKeywords('Kualifikasi kami: google google sheets sheets', 'google', ['Go']);
		const terms = report.keywords.map((k) => k.term);
		expect(terms).not.toContain('Go'); // "go" must not match inside "google"
		expect(terms).not.toContain('kualifikasi');
		expect(terms).not.toContain('kami');
	});

	it('returns nothing for an empty job post', () => {
		expect(matchKeywords('   ', 'cv', known)).toEqual({ keywords: [], coverage: 0 });
	});
});

describe('createAtsAnalyzer', () => {
	it('falls back to the main thread when Worker is unavailable and returns both reports', async () => {
		const analyzer = createAtsAnalyzer();
		const result = await analyzer.analyze(
			clone(sampleCvAts),
			'Dicari Junior Data Analyst yang menguasai SQL, Python dan Tableau. SQL wajib.'
		);
		expect(result.report.counts.error).toBe(0);
		const terms = result.keywords?.keywords.map((k) => k.term) ?? [];
		expect(terms).toEqual(expect.arrayContaining(['SQL', 'Python', 'Tableau']));
		expect(result.keywords?.keywords.find((k) => k.term === 'Tableau')?.inCv).toBe(true);
		analyzer.dispose();
	});

	it('skips keyword analysis without a job post', async () => {
		const result = await createAtsAnalyzer().analyze(clone(emptyCvAts));
		expect(result.keywords).toBeUndefined();
	});
});
