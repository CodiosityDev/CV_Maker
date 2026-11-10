/**
 * On-device CV text → CvDraft + contacts. Free (no AI), deterministic, best effort: sections are
 * found by their headings (core/scan), items by date lines and bullet markers. Anything that fits
 * nowhere is returned in `unplaced`, never dropped silently.
 */
import { headingSection } from '../scan/analyze';
import type { ScanSection } from '../scan/types';
import { LIMITS } from '../schema/limits';
import type { ExperienceType, LanguageLevel, Locale } from '../schema/types';
import { normalizePhone } from '../wizard/phone';
import { findDates, type FoundDates } from './dates';
import type { ConvertNote, CvContacts, CvDraft, LocalParse } from './types';

const BULLET = /^(?:[•●▪◦‣∙·○■□➢➤►▶✓✔\-–—*\uE000-\uF8FF]|\d{1,2}[.)](?=\s))\s*/u;
const EMAIL = /[^\s@<>()[\]:;,|]{1,64}@[^\s@<>()[\]:;,|]{1,190}\.[a-z]{2,24}/i;
const PHONE =
	/(?:\+62|\b62|\b0)\s?8\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}\b|\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/;
const URL =
	/\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]{2,100}|github\.com\/[\w-]{1,39}|[\w-]{1,63}\.(?:com|id|io|dev|me|net|org|site|my\.id|web\.id)(?:\/[\w./-]{0,100})?)\/?/gi;
const LOCATION_LABEL = /^(?:alamat|domisili|address|location|lokasi|kota|city)\s*[:：]\s*(.+)$/i;
const SEPARATORS = /\s+(?:[-–—|·•@]|at|di)\s+|\s*[|·•]\s*|,\s+/i;

const DEGREE =
	/\b(S1|S2|S3|D1|D2|D3|D4|SMA|SMK|SMA\/SMK|MA|SMP|Sarjana|Magister|Diploma(?: III| IV)?|Bachelor(?:'s)?(?: of [\w ]+)?|Master(?:'s)?(?: of [\w ]+)?|B\.?Sc|M\.?Sc|S\.Kom|S\.T|S\.E|S\.Pd|S\.H|S\.Psi)\b\.?/i;
const GPA =
	/\b(?:IPK|GPA|Nilai(?: rata-rata)?|NEM)\s*[:：]?\s*(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*\/\s*(\d{1,3}(?:[.,]\d{1,2})?))?/i;
const SCHOOL =
	/\b(universitas|university|institut|institute|politeknik|polytechnic|sekolah|SMA|SMK|SMP|MA|akademi|academy|college|STIE|STIKES|STMIK|UIN|IAIN)\b/i;
const COMPANY =
	/\b(PT|CV|Tbk|Persero|Inc|Ltd|LLC|Corp|Co\.|Group|Bank|Studio|Agency|Startup|Koperasi|Yayasan|Dinas|Kementerian|Badan|Rumah Sakit|RS|Hotel|Toko|Universitas)\b/i;
const ORG_ROLE =
	/\b(ketua|wakil|sekretaris|bendahara|koordinator|kepala|anggota|staf|staff|divisi|kadiv|head|member|chair(?:man|person)?|president|vice|secretary|treasurer|coordinator|volunteer|relawan|panitia)\b/i;
const TYPE_HINTS: [RegExp, ExperienceType][] = [
	[/\b(magang|intern(?:ship)?|PKL|praktik kerja)\b/i, 'internship'],
	[/\b(part[- ]?time|paruh waktu)\b/i, 'parttime'],
	[/\b(freelance|lepas)\b/i, 'freelance'],
	[/\b(kontrak|contract)\b/i, 'contract'],
	[/\b(volunteer|relawan|sukarela)\b/i, 'volunteer']
];
const LANGUAGE_LEVELS: [RegExp, LanguageLevel][] = [
	[/\b(native|ibu|asli)\b/i, 'native'],
	[/\b(fluent|fasih|lancar|aktif)\b/i, 'fluent'],
	[/\b(professional|profesional|mahir|advanced)\b/i, 'professional'],
	[/\b(intermediate|menengah|cukup|pasif)\b/i, 'intermediate'],
	[/\b(basic|dasar|pemula|beginner)\b/i, 'basic']
];

const clip = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max).trim();
const parts = (text: string) =>
	text
		.split(SEPARATORS)
		.map((p) => p.replace(/^[()[\]]+|[()[\]]+$/g, '').trim())
		.filter(Boolean);

interface Block {
	head: string[];
	dates?: FoundDates;
	bullets: string[];
}

/** Splits section lines into items: a new item starts at a non-bullet line after bullets, or at a
 * line with dates when the current item already has dates. */
function blocks(lines: readonly string[]): Block[] {
	const out: Block[] = [];
	let current: Block | undefined;
	for (const raw of lines) {
		const isBullet = BULLET.test(raw);
		const line = raw.replace(BULLET, '').trim();
		if (!line) continue;
		const dates = isBullet ? undefined : findDates(line);
		const longSentence = line.length > 90 || /[.!]$/.test(line);
		if (isBullet || (current && longSentence && !dates)) {
			if (!current) {
				current = { head: [], bullets: [] };
				out.push(current);
			}
			current.bullets.push(line);
			continue;
		}
		const startNew =
			!current ||
			current.bullets.length > 0 ||
			(dates !== undefined && current.dates !== undefined);
		if (startNew) {
			current = { head: [], bullets: [] };
			out.push(current);
		}
		const block = current as Block;
		if (dates && !block.dates) {
			block.dates = dates;
			if (dates.rest) block.head.push(dates.rest);
		} else block.head.push(line);
	}
	return out.filter((b) => b.head.length || b.bullets.length);
}

const emptyDates = () => ({ current: false });

function education(block: Block): CvDraft['education'][number] {
	const text = block.head.join(' | ');
	const gpa = text.match(GPA);
	const withoutGpa = gpa ? text.replace(gpa[0], ' ') : text;
	const degree = withoutGpa.match(DEGREE)?.[0]?.replace(/\.$/, '') ?? '';
	const pieces = parts(withoutGpa.replace(DEGREE, ' ')).filter(
		(p) => !/^(jurusan|program studi|prodi)$/i.test(p)
	);
	const institution = pieces.find((p) => SCHOOL.test(p)) ?? pieces[0] ?? '';
	const major = pieces
		.filter((p) => p !== institution)
		.join(' ')
		.replace(/^(jurusan|program studi|prodi|major)\s*[:：]?\s*/i, '');
	return {
		institution: clip(institution, LIMITS.title),
		degree: clip(degree, LIMITS.short),
		major: clip(major, LIMITS.title),
		gpa: gpa?.[1]?.replace(',', '.') ?? '',
		gpaScale: gpa?.[2]?.replace(',', '.') ?? '',
		dates: block.dates?.range ?? emptyDates(),
		highlights: block.bullets.map((b) => clip(b, LIMITS.bullet)).slice(0, LIMITS.bulletsPerItem)
	};
}

function experience(block: Block): CvDraft['experience'][number] {
	const text = block.head.join(' | ');
	const pieces = parts(text);
	const companyIndex = pieces.findIndex((p) => COMPANY.test(p));
	const company = companyIndex >= 0 ? pieces[companyIndex] : (pieces[1] ?? '');
	const role = pieces.find((p, i) => i !== companyIndex && p !== company) ?? '';
	const location = pieces.filter((p) => p !== company && p !== role).join(', ');
	const type = TYPE_HINTS.find(([re]) => re.test(text))?.[1] ?? 'fulltime';
	return {
		type,
		role: clip(role, LIMITS.title),
		company: clip(company ?? '', LIMITS.title),
		location: clip(location, LIMITS.short),
		dates: block.dates?.range ?? emptyDates(),
		bullets: block.bullets.map((b) => clip(b, LIMITS.bullet)).slice(0, LIMITS.bulletsPerItem)
	};
}

function organization(block: Block): CvDraft['organizations'][number] {
	const pieces = parts(block.head.join(' | '));
	const role = pieces.find((p) => ORG_ROLE.test(p)) ?? pieces[1] ?? '';
	const name = pieces.find((p) => p !== role) ?? '';
	return {
		name: clip(name, LIMITS.title),
		role: clip(role, LIMITS.title),
		dates: block.dates?.range ?? emptyDates(),
		bullets: block.bullets.map((b) => clip(b, LIMITS.bullet)).slice(0, LIMITS.bulletsPerItem)
	};
}

function project(block: Block): CvDraft['projects'][number] {
	const pieces = parts(block.head.join(' | '));
	return {
		name: clip(pieces[0] ?? block.bullets[0] ?? '', LIMITS.title),
		role: clip(pieces.slice(1).join(', '), LIMITS.title),
		dates: block.dates?.range,
		bullets: (pieces.length ? block.bullets : block.bullets.slice(1))
			.map((b) => clip(b, LIMITS.bullet))
			.slice(0, LIMITS.bulletsPerItem)
	};
}

/** "SQL, Python • Excel | Power BI" → ["SQL", "Python", "Excel", "Power BI"] */
function listItems(lines: readonly string[]): string[] {
	const seen = new Set<string>();
	return lines
		.flatMap((line) =>
			line
				.replace(BULLET, '')
				.replace(/^[\w &/]{2,30}\s*[:：]\s*/u, '') // "Hard skills: SQL, Python"
				.split(/\s*[,;•|·]\s*|\s{2,}/)
		)
		.map((s) => clip(s, 40))
		.filter((s) => {
			const key = s.toLowerCase();
			if (s.length < 2 || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

function language(line: string): CvDraft['languages'][number] | undefined {
	const text = line.replace(BULLET, '').trim();
	const name = text.split(/[(:\-–—,]/)[0]?.trim() ?? '';
	if (!name || name.length > 40) return undefined;
	const level = LANGUAGE_LEVELS.find(([re]) => re.test(text))?.[1] ?? 'intermediate';
	const score = text.match(/\b(TOEFL|IELTS|TOEIC|JLPT|HSK)[^,;)]*\d[^,;)]*/i)?.[0] ?? '';
	return { name: clip(name, LIMITS.short), level, score: clip(score, LIMITS.short) };
}

function contactsFrom(header: readonly string[], all: string): CvContacts {
	const email = all.match(EMAIL)?.[0] ?? '';
	const phoneRaw = all.match(PHONE)?.[0] ?? '';
	const links: CvContacts['links'] = [];
	for (const match of all.matchAll(URL)) {
		const raw = match[0].replace(/\/$/, '');
		if (email.includes(raw)) continue;
		const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		const label = /linkedin/i.test(raw) ? 'LinkedIn' : /github/i.test(raw) ? 'GitHub' : 'Portfolio';
		if (!links.some((l) => l.url.toLowerCase() === url.toLowerCase())) links.push({ label, url });
		if (links.length >= LIMITS.links) break;
	}
	let city = '';
	for (const line of all.split('\n')) {
		const located = line.match(LOCATION_LABEL)?.[1];
		if (located) {
			city =
				located
					.split(',')
					.map((p) => p.trim())
					.filter(Boolean)
					.at(-1) ?? '';
			break;
		}
	}
	const isContactLine = (line: string) =>
		EMAIL.test(line) ||
		PHONE.test(line) ||
		/https?:|www\.|linkedin|github/i.test(line) ||
		LOCATION_LABEL.test(line);
	const fullName =
		header.find(
			(line) =>
				!isContactLine(line) &&
				/^[\p{L}][\p{L}.' -]{2,60}$/u.test(line) &&
				line.split(/\s+/).length <= 6
		) ?? '';
	return {
		fullName: clip(fullName, LIMITS.fullName),
		email: clip(email, LIMITS.email),
		phone: normalizePhone(phoneRaw) ?? clip(phoneRaw, LIMITS.short),
		city: clip(city.replace(/\d{5}$/, '').trim(), LIMITS.short),
		links
	};
}

function guessLocale(text: string): Locale {
	const words = text.toLowerCase().split(/[^a-z]+/);
	const id = words.filter((w) =>
		['dan', 'yang', 'dengan', 'untuk', 'dalam', 'sebagai', 'pendidikan', 'pengalaman'].includes(w)
	).length;
	const en = words.filter((w) =>
		['and', 'the', 'with', 'for', 'of', 'education', 'experience'].includes(w)
	).length;
	return en > id ? 'en' : 'id';
}

/** Parses the text of a CV file (from `extractCvText`). Pure: runs anywhere. */
export function parseCvText(text: string): LocalParse {
	const lines = text
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
	const sections = new Map<ScanSection, string[]>();
	const header: string[] = [];
	const unplaced: string[] = [];
	let current: ScanSection | undefined;
	for (const line of lines) {
		const heading = headingSection(line);
		if (heading) {
			current = heading;
			if (!sections.has(heading)) sections.set(heading, []);
			continue;
		}
		if (current) sections.get(current)?.push(line);
		else header.push(line);
	}

	const contacts = contactsFrom(header, text);
	const isContact = (line: string) =>
		line === contacts.fullName ||
		EMAIL.test(line) ||
		PHONE.test(line) ||
		/https?:|www\.|linkedin\.com|github\.com/i.test(line) ||
		LOCATION_LABEL.test(line);
	const headerRest = header.filter((line) => !isContact(line));
	// A short line under the name is the headline; longer header text is a summary without heading.
	const headline = headerRest.find((l) => l.length <= LIMITS.headline && !/[.!]$/.test(l)) ?? '';
	const headerSummary = headerRest.filter((l) => l !== headline).join(' ');

	const get = (key: ScanSection) => sections.get(key) ?? [];
	const notes: ConvertNote[] = [];
	const draft: CvDraft = {
		targetRole: '',
		headline: clip(headline, LIMITS.headline),
		summary: clip(get('summary').join(' ') || headerSummary, LIMITS.summary),
		education: blocks(get('education')).map(education).slice(0, LIMITS.itemsPerSection),
		experience: blocks(get('experience')).map(experience).slice(0, LIMITS.itemsPerSection),
		organizations: blocks(get('organizations')).map(organization).slice(0, LIMITS.itemsPerSection),
		projects: blocks(get('projects')).map(project).slice(0, LIMITS.itemsPerSection),
		skills: { hard: listItems(get('skills')).slice(0, LIMITS.skillsPerGroup), tools: [], soft: [] },
		languages: get('languages')
			.flatMap((line) => line.split(/\s*[,;•|]\s*(?![^()]*\))/))
			.map(language)
			.filter((l) => l !== undefined)
			.slice(0, LIMITS.itemsPerSection),
		certifications: get('certifications')
			.map((line) => {
				const dates = findDates(line.replace(BULLET, ''));
				const pieces = parts((dates ? dates.rest : line).replace(BULLET, ''));
				return {
					name: clip(pieces[0] ?? '', LIMITS.title),
					issuer: clip(pieces.slice(1).join(', '), LIMITS.title),
					date: dates?.range.start
				};
			})
			.filter((c) => c.name)
			.slice(0, LIMITS.itemsPerSection),
		awards: get('awards')
			.map((line) => {
				const dates = findDates(line.replace(BULLET, ''));
				const pieces = parts((dates ? dates.rest : line).replace(BULLET, ''));
				return {
					title: clip(pieces[0] ?? '', LIMITS.title),
					issuer: clip(pieces.slice(1).join(', '), LIMITS.title),
					date: dates?.range.start,
					description: ''
				};
			})
			.filter((a) => a.title)
			.slice(0, LIMITS.itemsPerSection)
	};

	// Months that were not written.
	const guessed = [
		...blocks(get('education')),
		...blocks(get('experience')),
		...blocks(get('organizations')),
		...blocks(get('projects'))
	].filter((b) => b.dates?.guessed).length;
	if (guessed)
		notes.push({
			id: 'monthGuessed',
			messageKey: 'ats.convert.notes.monthGuessed',
			params: { count: guessed }
		});
	if (!contacts.fullName)
		notes.push({ id: 'missingName', messageKey: 'ats.convert.notes.missingName' });
	if (!contacts.email && !contacts.phone)
		notes.push({ id: 'missingContact', messageKey: 'ats.convert.notes.missingContact' });
	if (!sections.size) unplaced.push(...headerRest);
	if (unplaced.length)
		notes.push({
			id: 'notParsed',
			messageKey: 'ats.convert.notes.notParsed',
			params: { count: unplaced.length }
		});

	return { draft, contacts, notes, unplaced, locale: guessLocale(text) };
}
