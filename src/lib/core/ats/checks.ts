/**
 * ATS & quality checks (PROJECT_SPEC §9.1). Pure, synchronous and fast — safe on every edit.
 * Rules are advice for fresh graduates, not a promise of passing any specific ATS.
 */
import type { CVDocument, DateRange, SectionKey } from '../schema/types';
import { sanitizeUrl } from '../security/url';
import { isValidPhone } from '../wizard/phone';
import type { WizardStepId } from '../wizard/steps';
import type { AtsCheck, AtsGrade, AtsReport, CheckId, CheckLevel, CheckTarget } from './types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEIGHT: Record<CheckLevel, number> = { error: 12, warn: 6, tip: 2 };
const MAX_TIP_PENALTY = 16;

const SUMMARY_SHORT = 150;
const SUMMARY_LONG = 650;
const BULLET_SHORT = 25;
const BULLET_LONG = 220;
const CHARS_PER_PAGE = 3600;

/** Words that make an email look unprofessional (lowercase, matched as substrings). */
const CASUAL_EMAIL_WORDS = [
	'cute',
	'imut',
	'lucu',
	'manis',
	'cantik',
	'ganteng',
	'gans',
	'sayang',
	'baby',
	'babe',
	'love',
	'lope',
	'kece',
	'keren',
	'cool',
	'sexy',
	'princess',
	'prince',
	'gamer',
	'galau',
	'alay'
];

/** Common action verbs (lowercase) — first word of a good bullet. Prefix rules cover the rest. */
const ACTION_VERBS = new Set([
	'led',
	'built',
	'ran',
	'won',
	'wrote',
	'taught',
	'made',
	'sold',
	'drove',
	'grew',
	'cut',
	'set',
	'managed',
	'created',
	'developed',
	'designed',
	'analysed',
	'analyzed',
	'coordinated',
	'organized',
	'organised',
	'prepared',
	'handled',
	'supported',
	'assisted',
	'implemented',
	'improved',
	'increased',
	'reduced',
	'delivered',
	'presented',
	'trained',
	'served',
	'conducted',
	'collected',
	'maintained',
	'achieved',
	'launched',
	'planned',
	'produced',
	'tested',
	'resolved',
	'helped',
	'documented'
]);
/** Indonesian verb prefixes: me-, mem-, men-, meng-, meny-, ber-, ter-, di- (e.g. Mengelola, Berhasil). */
const ID_VERB = /^(me(m|n|ng|ny)?|ber|ter|di)[a-z]{3,}$/;
export const FIRST_PERSON = /(^|\s)(saya|aku|gue|gw|i|my|me)(\s|$)/i;
const HAS_NUMBER = /\d/;

/** Email that looks unprofessional to a recruiter (many digits or casual words before the @). */
export function isCasualEmail(email: string): boolean {
	const local = email.split('@')[0]?.toLowerCase() ?? '';
	const digits = (local.match(/\d/g) ?? []).length;
	return digits >= 4 || CASUAL_EMAIL_WORDS.some((word) => local.includes(word));
}

const blank = (value: string | undefined): boolean => !value || value.trim() === '';

/** True when the first word is an action verb (English list, Indonesian prefixes, "-ed"). */
export function startsWithActionVerb(bullet: string): boolean {
	const first =
		bullet
			.trim()
			.split(/\s+/)[0]
			?.toLowerCase()
			.replace(/[^a-z]/g, '') ?? '';
	if (!first) return false;
	return ACTION_VERBS.has(first) || ID_VERB.test(first) || /^[a-z]{3,}ed$/.test(first);
}

function hasDates(range: DateRange | undefined): boolean {
	return Boolean(range && range.start && (range.current || range.end));
}

/** Wizard step where each section is edited (fix-it navigation). */
export const SECTION_STEP: Partial<Record<SectionKey, WizardStepId>> = {
	summary: 'summary',
	education: 'education',
	experience: 'experience',
	organizations: 'organizations',
	projects: 'projects',
	skills: 'skills',
	languages: 'skills',
	certifications: 'skills',
	awards: 'skills'
};

interface BulletOwner {
	section: 'experience' | 'organizations' | 'projects' | 'education';
	id: string;
	label: string;
	bullets: string[];
	dates?: DateRange;
	requireBullets: boolean;
	requireDates: boolean;
}

function bulletOwners(cv: CVDocument): BulletOwner[] {
	return [
		...cv.experience.map((e) => ({
			section: 'experience' as const,
			id: e.id,
			label: [e.role, e.company].filter((v) => !blank(v)).join(' — '),
			bullets: e.bullets,
			dates: e.dates,
			requireBullets: true,
			requireDates: true
		})),
		...cv.organizations.map((o) => ({
			section: 'organizations' as const,
			id: o.id,
			label: [o.role, o.name].filter((v) => !blank(v)).join(' — '),
			bullets: o.bullets,
			dates: o.dates,
			requireBullets: true,
			requireDates: true
		})),
		...cv.projects.map((p) => ({
			section: 'projects' as const,
			id: p.id,
			label: p.name,
			bullets: p.bullets,
			dates: p.dates,
			requireBullets: false,
			requireDates: false
		})),
		...cv.education.map((e) => ({
			section: 'education' as const,
			id: e.id,
			label: e.institution,
			bullets: e.highlights,
			dates: e.dates,
			requireBullets: false,
			requireDates: true
		}))
	].filter((owner) => !blank(owner.label) || owner.bullets.some((b) => !blank(b)));
}

function plainLength(cv: CVDocument): number {
	const parts: string[] = [
		cv.personal.fullName,
		cv.personal.headline,
		cv.summary,
		...cv.education.flatMap((e) => [e.institution, e.major, e.thesisTitle ?? '', ...e.highlights]),
		...cv.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
		...cv.organizations.flatMap((o) => [o.role, o.name, ...o.bullets]),
		...cv.projects.flatMap((p) => [p.name, ...p.bullets]),
		...cv.skills.hard,
		...cv.skills.soft,
		...cv.skills.tools,
		...cv.certifications.map((c) => `${c.name} ${c.issuer}`),
		...cv.awards.map((a) => `${a.title} ${a.issuer} ${a.description ?? ''}`),
		...cv.languages.map((l) => l.name)
	];
	// Each entry/heading adds visual lines beyond its characters.
	const entries =
		cv.education.length + cv.experience.length + cv.organizations.length + cv.projects.length;
	return parts.join(' ').length + entries * 120 + 400;
}

/** Runs every check. `kind` matters: a creative CV gets an "ATS fit" warning. */
export function analyzeCv(cv: CVDocument): AtsReport {
	const checks: AtsCheck[] = [];
	const add = (id: CheckId, level: CheckLevel, target: CheckTarget, params?: AtsCheck['params']) =>
		checks.push({ id, level, messageKey: `ats.checks.${id}`, target, params });

	const p = cv.personal;
	// --- contact ---
	if (blank(p.fullName)) add('missingName', 'error', { step: 'personal', field: 'fullName' });
	if (blank(p.email)) add('missingEmail', 'error', { step: 'personal', field: 'email' });
	else if (!EMAIL.test(p.email.trim()))
		add('invalidEmail', 'error', { step: 'personal', field: 'email' });
	else {
		if (isCasualEmail(p.email))
			add('unprofessionalEmail', 'warn', { step: 'personal', field: 'email' });
	}
	if (blank(p.phone)) add('missingPhone', 'error', { step: 'personal', field: 'phone' });
	else if (!isValidPhone(p.phone))
		add('invalidPhone', 'error', { step: 'personal', field: 'phone' });
	if (blank(p.headline)) add('missingHeadline', 'tip', { step: 'personal', field: 'headline' });
	for (const link of p.links) {
		if (!blank(link.url) && !sanitizeUrl(link.url))
			add(
				'invalidLink',
				'warn',
				{ step: 'personal', field: 'links', itemId: link.id },
				{
					item: link.label || link.url
				}
			);
	}

	// --- structure ---
	const owners = bulletOwners(cv);
	const hasEducation = cv.education.some((e) => !blank(e.institution));
	if (!hasEducation) add('missingEducation', 'error', { step: 'education', section: 'education' });
	const hasExperience = owners.some(
		(o) => o.section !== 'education' && (!blank(o.label) || o.bullets.some((b) => !blank(b)))
	);
	if (!hasExperience) add('noExperience', 'warn', { step: 'experience', section: 'experience' });

	const skillCount = cv.skills.hard.length + cv.skills.soft.length + cv.skills.tools.length;
	if (skillCount === 0) add('noSkills', 'warn', { step: 'skills', section: 'skills' });
	else if (skillCount < 5)
		add('fewSkills', 'tip', { step: 'skills', section: 'skills' }, { count: skillCount });

	const summary = cv.summary.trim();
	if (!summary) add('missingSummary', 'warn', { step: 'summary', section: 'summary' });
	else if (summary.length < SUMMARY_SHORT)
		add('shortSummary', 'tip', { step: 'summary', section: 'summary' });
	else if (summary.length > SUMMARY_LONG)
		add('longSummary', 'warn', { step: 'summary', section: 'summary' });

	if (cv.kind === 'creative') add('creativeForAts', 'warn', { step: 'review' });

	// --- items & bullets ---
	const seen = new Map<string, number>();
	let bulletTotal = 0;
	let bulletsWithNumbers = 0;
	for (const owner of owners) {
		const step = SECTION_STEP[owner.section] ?? 'review';
		const target: CheckTarget = { step, section: owner.section, itemId: owner.id };
		const item = owner.label || '—';
		const bullets = owner.bullets.map((b) => b.trim()).filter(Boolean);

		if (owner.requireDates && !hasDates(owner.dates))
			add('missingDates', 'warn', { ...target, field: 'dates' }, { item });
		if (owner.requireBullets && bullets.length === 0)
			add('itemWithoutBullets', 'warn', { ...target, field: 'bullets' }, { item });

		if (owner.section === 'education') continue; // highlights are free-form facts, not achievements

		let noVerb = 0;
		let tooLong = 0;
		let tooShort = 0;
		let firstPerson = 0;
		for (const bullet of bullets) {
			bulletTotal += 1;
			if (HAS_NUMBER.test(bullet)) bulletsWithNumbers += 1;
			if (!startsWithActionVerb(bullet)) noVerb += 1;
			if (bullet.length > BULLET_LONG) tooLong += 1;
			if (bullet.length < BULLET_SHORT) tooShort += 1;
			if (FIRST_PERSON.test(bullet)) firstPerson += 1;
			const key = bullet.toLowerCase().replace(/\s+/g, ' ');
			seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		const t = { ...target, field: 'bullets' };
		if (noVerb) add('bulletNoVerb', 'tip', t, { count: noVerb, item });
		if (tooLong) add('bulletTooLong', 'tip', t, { count: tooLong, item });
		if (tooShort) add('bulletTooShort', 'tip', t, { count: tooShort, item });
		if (firstPerson) add('firstPerson', 'tip', t, { count: firstPerson, item });
	}
	const duplicates = [...seen.values()].filter((n) => n > 1).length;
	if (duplicates) add('duplicateBullet', 'tip', { step: 'experience' }, { count: duplicates });
	if (bulletTotal >= 3 && bulletsWithNumbers / bulletTotal < 0.3)
		add('fewNumbers', 'tip', { step: 'experience', field: 'bullets' });

	const estimatedPages = Math.round((plainLength(cv) / CHARS_PER_PAGE) * 10) / 10;
	if (estimatedPages > 1.4) add('tooLong', 'warn', { step: 'review' }, { pages: estimatedPages });

	// --- score ---
	const order: Record<CheckLevel, number> = { error: 0, warn: 1, tip: 2 };
	checks.sort((a, b) => order[a.level] - order[b.level]);
	const counts: Record<CheckLevel, number> = { error: 0, warn: 0, tip: 0 };
	for (const check of checks) counts[check.level] += 1;
	const penalty =
		counts.error * WEIGHT.error +
		counts.warn * WEIGHT.warn +
		Math.min(MAX_TIP_PENALTY, counts.tip * WEIGHT.tip);
	const score = Math.max(0, Math.min(100, 100 - penalty));
	const grade: AtsGrade =
		counts.error > 0 ? 'needsWork' : score >= 85 ? 'good' : score >= 65 ? 'ok' : 'needsWork';

	return {
		score,
		grade,
		checks,
		counts,
		stats: { bullets: bulletTotal, bulletsWithNumbers, estimatedPages }
	};
}
