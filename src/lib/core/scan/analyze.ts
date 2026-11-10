/**
 * ATS checks on the TEXT of a CV file (made anywhere). Pure and fast. Same score scale and
 * weights as the in-app checker (`analyzeCv`), but the rules work on lines of text: sections are
 * found by their headings, contact details by pattern.
 */
import { FIRST_PERSON, isCasualEmail, startsWithActionVerb } from '../ats/checks';
import type { AtsGrade, CheckLevel } from '../ats/types';
import type { Locale } from '../schema/types';
import type { ExtractedCv, ScanCheck, ScanCheckId, ScanReport, ScanSection } from './types';

const WEIGHT: Record<CheckLevel, number> = { error: 12, warn: 6, tip: 2 };
const MAX_TIP_PENALTY = 16;
const BULLET_LONG = 220;

/** Heading words per section (normalized: lowercase, letters and spaces only). */
const HEADINGS: Record<ScanSection, readonly string[]> = {
	summary: [
		'ringkasan',
		'profil',
		'profile',
		'tentang saya',
		'deskripsi diri',
		'summary',
		'professional summary',
		'about me',
		'objective',
		'career objective',
		'tujuan karir'
	],
	education: [
		'pendidikan',
		'riwayat pendidikan',
		'latar belakang pendidikan',
		'education',
		'educational background',
		'academic background'
	],
	experience: [
		'pengalaman',
		'pengalaman kerja',
		'pengalaman magang',
		'pengalaman profesional',
		'riwayat pekerjaan',
		'magang',
		'experience',
		'work experience',
		'professional experience',
		'internship',
		'internships',
		'internship experience',
		'employment history'
	],
	organizations: [
		'organisasi',
		'pengalaman organisasi',
		'kepanitiaan',
		'kegiatan',
		'aktivitas',
		'organization',
		'organizations',
		'organizational experience',
		'leadership',
		'leadership experience',
		'volunteer',
		'volunteering',
		'activities',
		'extracurricular activities'
	],
	projects: ['proyek', 'projek', 'portofolio', 'project', 'projects', 'portfolio'],
	skills: [
		'keahlian',
		'keterampilan',
		'kemampuan',
		'kompetensi',
		'skill',
		'skills',
		'hard skills',
		'soft skills',
		'technical skills',
		'competencies'
	],
	certifications: [
		'sertifikat',
		'sertifikasi',
		'pelatihan',
		'kursus',
		'certification',
		'certifications',
		'certificates',
		'licenses',
		'training',
		'courses'
	],
	awards: ['penghargaan', 'prestasi', 'awards', 'achievements', 'honors', 'honours'],
	languages: ['bahasa', 'kemampuan bahasa', 'languages', 'language skills']
};

const HEADING_INDEX: [string, ScanSection][] = (
	Object.entries(HEADINGS) as [ScanSection, readonly string[]][]
)
	.flatMap(([section, words]) => words.map((word): [string, ScanSection] => [word, section]))
	.sort((a, b) => b[0].length - a[0].length); // longest phrase first

const EMAIL = /[^\s@<>()[\]:;,]+@[^\s@<>()[\]:;,]+\.[a-z]{2,}/gi;
const PHONE =
	/(?:\+62|\b62|\b0)\s?8\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}\b|\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/;
const LINKEDIN = /linkedin/i;
const YEAR = /\b(?:19[89]\d|20\d{2})\b/;
const BULLET = /^(?:[•●▪◦‣∙·○■□➢➤►▶✓✔\-–—*\uE000-\uF8FF]|\d{1,2}[.)](?=\s))\s*/u;
const GARBLED = /[\uFFFD\uE000-\uF8FF]|\(cid:\d+\)/g;
const ID_WORDS = new Set([
	'dan',
	'yang',
	'di',
	'dengan',
	'untuk',
	'dalam',
	'pada',
	'sebagai',
	'dari',
	'ke',
	'serta',
	'ini'
]);
const EN_WORDS = new Set([
	'and',
	'the',
	'with',
	'for',
	'in',
	'of',
	'to',
	'as',
	'on',
	'at',
	'from',
	'this'
]);

const simplify = (line: string): string =>
	line
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z& ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/** The section a heading line starts, or undefined for a normal line. */
export function headingSection(line: string): ScanSection | undefined {
	const raw = line.trim();
	if (!raw || raw.length > 50 || /[.!?]$/.test(raw) || BULLET.test(raw)) return undefined;
	const words = simplify(raw).split(' ').filter(Boolean);
	if (!words.length || words.length > 5) return undefined;
	const text = words.join(' ');
	const exact = (value: string) => HEADING_INDEX.find(([phrase]) => phrase === value)?.[1];
	// "Pengalaman Kerja & Magang", "Organisasi dan Kepanitiaan": every part is a heading.
	const parts = text.split(/ (?:&|dan|and) /);
	const first = exact(parts[0] ?? '');
	if (first && parts.every((part) => exact(part))) return first;
	// "PENGALAMAN KERJA LAPANGAN", "Keahlian Teknis:" — styled as a heading, starts like one.
	const styled = raw.endsWith(':') || (raw === raw.toUpperCase() && /\p{Lu}/u.test(raw));
	if (styled)
		for (const [phrase, section] of HEADING_INDEX)
			if (text.startsWith(`${phrase} `)) return section;
	return undefined;
}

function guessLocale(text: string): Locale {
	let id = 0;
	let en = 0;
	for (const word of text.toLowerCase().split(/[^a-z]+/)) {
		if (ID_WORDS.has(word)) id += 1;
		else if (EN_WORDS.has(word)) en += 1;
	}
	return en > id ? 'en' : 'id';
}

/** Letter-spaced text ("D a t a  A n a l y s t") that ATS read as separate letters. */
function spacedLetters(lines: readonly string[]): number {
	return lines.filter((line) => {
		const tokens = line.split(' ');
		return tokens.length >= 6 && tokens.filter((t) => t.length === 1).length / tokens.length > 0.6;
	}).length;
}

/** Runs every check on an extracted CV. */
export function analyzeScan(cv: ExtractedCv): ScanReport {
	const checks: ScanCheck[] = [];
	const add = (id: ScanCheckId, level: CheckLevel, params?: ScanCheck['params']) =>
		checks.push({ id, level, messageKey: `ats.scan.checks.${id}`, params });

	const text = cv.text;
	const lines = text.split('\n').filter(Boolean);
	const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
	const locale = guessLocale(text);

	// --- sections ---
	const sections: ScanSection[] = [];
	let current: ScanSection | undefined;
	const statements: string[] = []; // lines inside experience / organizations / projects
	for (const line of lines) {
		const heading = headingSection(line);
		if (heading) {
			current = heading;
			if (!sections.includes(heading)) sections.push(heading);
			continue;
		}
		if (current === 'experience' || current === 'organizations' || current === 'projects')
			statements.push(line);
	}
	const has = (section: ScanSection) => sections.includes(section);

	// --- contact ---
	const emails = text.match(EMAIL) ?? [];
	const contact = {
		email: emails.length > 0,
		phone: PHONE.test(text),
		linkedin: LINKEDIN.test(text)
	};

	// --- bullets ---
	const bullets = statements
		.filter((line) => BULLET.test(line))
		.map((line) => line.replace(BULLET, '').trim())
		.filter(Boolean);
	const bulletsWithNumbers = bullets.filter((b) => /\d/.test(b)).length;

	if (cv.layout.imageOnly || !text) {
		add('imageOnly', 'error');
	} else {
		// --- readability ---
		const garbled = (text.match(GARBLED) ?? []).length;
		if ((garbled >= 5 && garbled / text.length > 0.005) || spacedLetters(lines) >= 2)
			add('garbledText', 'warn');
		if (cv.layout.columns) add('multiColumn', 'warn');
		if (cv.layout.tables) add('tables', 'warn');
		if (cv.layout.textBoxes) add('textBoxes', 'warn');
		if (cv.layout.contactInHeaderFooter) add('contactInHeaderFooter', 'warn');
		if (cv.layout.images > 0) add('graphics', 'tip', { count: cv.layout.images });

		// --- contact ---
		if (!contact.email) add('missingEmail', 'error');
		else if (emails[0] && isCasualEmail(emails[0])) add('unprofessionalEmail', 'warn');
		if (!contact.phone) add('missingPhone', 'error');
		if (!contact.linkedin) add('missingLinkedIn', 'tip');

		// --- structure ---
		if (sections.length < 2 && words >= 80) add('unclearHeadings', 'warn');
		else {
			if (!has('education')) add('missingEducation', 'error');
			if (!has('experience') && !has('organizations') && !has('projects'))
				add('noExperience', 'warn');
			if (!has('skills')) add('noSkills', 'warn');
			if (!has('summary')) add('missingSummary', 'warn');
		}
		if ((has('education') || has('experience') || has('organizations')) && !YEAR.test(text))
			add('missingDates', 'warn');
		if (statements.length >= 3 && bullets.length === 0) add('noBullets', 'warn');

		// --- length ---
		if (cv.pages > 2) add('tooLong', 'warn', { pages: cv.pages });
		else if (words < 150) add('tooShort', 'warn', { words });

		// --- bullets ---
		const noVerb = bullets.filter((b) => !startsWithActionVerb(b)).length;
		if (bullets.length >= 3 && noVerb / bullets.length > 0.3)
			add('bulletNoVerb', 'tip', { count: noVerb });
		if (bullets.length >= 3 && bulletsWithNumbers / bullets.length < 0.3) add('fewNumbers', 'tip');
		const long = bullets.filter((b) => b.length > BULLET_LONG).length;
		if (long) add('bulletTooLong', 'tip', { count: long });
		const firstPerson = bullets.filter((b) => FIRST_PERSON.test(b)).length;
		if (firstPerson) add('firstPerson', 'tip', { count: firstPerson });
	}

	// --- score (same formula as analyzeCv) ---
	const order: Record<CheckLevel, number> = { error: 0, warn: 1, tip: 2 };
	checks.sort((a, b) => order[a.level] - order[b.level]);
	const counts: Record<CheckLevel, number> = { error: 0, warn: 0, tip: 0 };
	for (const check of checks) counts[check.level] += 1;
	const penalty =
		counts.error * WEIGHT.error +
		counts.warn * WEIGHT.warn +
		Math.min(MAX_TIP_PENALTY, counts.tip * WEIGHT.tip);
	const unreadable = checks.some((c) => c.id === 'imageOnly');
	const score = unreadable ? 0 : Math.max(0, Math.min(100, 100 - penalty));
	const grade: AtsGrade =
		counts.error > 0 ? 'needsWork' : score >= 85 ? 'good' : score >= 65 ? 'ok' : 'needsWork';

	return {
		score,
		grade,
		checks,
		counts,
		sections,
		contact,
		stats: { words, bullets: bullets.length, bulletsWithNumbers, pages: cv.pages },
		locale
	};
}
