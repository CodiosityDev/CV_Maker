/**
 * Education levels: what a degree means (school vs. higher education), how it is written in the
 * CV's language, and which score label fits (IPK/GPA for higher education, report-card average
 * for SMA/SMK/SMP).
 *
 *   import { educationLevel, isSchoolLevel, degreeOptions, scoreLabel } from '#lib/core/education/index.ts';
 *   educationLevel('SMA')                 // 'school'
 *   degreeOptions('en')                   // ["Bachelor's Degree", 'Diploma (D3)', …, 'Senior High School', …]
 *   displayDegree('S1', 'en')             // "Bachelor's Degree" (known degrees follow the CV language)
 *   scoreLabel('SMA', 'id')               // 'Nilai rata-rata'
 */
import type { Locale } from '../schema/types';
import { normalize } from '../suggest/match';

export type EducationLevel = 'school' | 'diploma' | 'bachelor' | 'master' | 'doctor' | 'other';

interface DegreeDefinition {
	level: EducationLevel;
	/** How the degree is written on a CV in each language. */
	names: Record<Locale, string>;
	/** Other spellings that mean exactly this degree (compared after `normalize`). */
	aliases: string[];
}

/** Order = suggestion order (most common for fresh graduates first). */
const DEGREES: readonly DegreeDefinition[] = [
	{
		level: 'bachelor',
		names: { id: 'S1', en: "Bachelor's Degree" },
		aliases: ['sarjana', 'strata 1', 'bachelor', 'bachelor degree', 'undergraduate']
	},
	{
		level: 'diploma',
		names: { id: 'D3', en: 'Diploma (D3)' },
		aliases: ['diploma 3', 'diploma iii', 'd iii', 'associate degree', 'ahli madya']
	},
	{
		level: 'diploma',
		names: { id: 'D4', en: 'Applied Bachelor (D4)' },
		aliases: ['diploma 4', 'diploma iv', 'd iv', 'sarjana terapan', 'applied bachelor']
	},
	{
		level: 'school',
		names: { id: 'SMK', en: 'Vocational High School (SMK)' },
		aliases: ['sekolah menengah kejuruan', 'vocational high school', 'stm', 'smea']
	},
	{
		level: 'school',
		names: { id: 'SMA', en: 'Senior High School' },
		aliases: ['sekolah menengah atas', 'slta', 'senior high school', 'high school']
	},
	{
		level: 'school',
		names: { id: 'MA', en: 'Islamic Senior High School (MA)' },
		aliases: ['madrasah aliyah', 'islamic senior high school']
	},
	{
		level: 'school',
		names: { id: 'SMP', en: 'Junior High School' },
		aliases: ['sekolah menengah pertama', 'sltp', 'junior high school', 'middle school']
	},
	{
		level: 'school',
		names: { id: 'MTs', en: 'Islamic Junior High School (MTs)' },
		aliases: ['madrasah tsanawiyah', 'islamic junior high school']
	},
	{
		level: 'master',
		names: { id: 'S2', en: "Master's Degree" },
		aliases: ['magister', 'strata 2', 'master', 'master degree', 'postgraduate']
	},
	{
		level: 'diploma',
		names: { id: 'D1', en: 'Diploma (D1)' },
		aliases: ['diploma 1', 'diploma i']
	},
	{
		level: 'diploma',
		names: { id: 'D2', en: 'Diploma (D2)' },
		aliases: ['diploma 2', 'diploma ii']
	},
	{
		level: 'doctor',
		names: { id: 'S3', en: 'Doctorate (PhD)' },
		aliases: ['doktor', 'strata 3', 'doctorate', 'doctoral', 'phd', 'ph.d.', 'ph.d']
	}
];

const BY_NAME = new Map<string, DegreeDefinition>();
for (const degree of DEGREES) {
	for (const name of [degree.names.id, degree.names.en, ...degree.aliases]) {
		BY_NAME.set(normalize(name), degree);
	}
}

/**
 * Words that reveal the level of a degree typed freely ("SMA Negeri", "Sarjana Teknik",
 * "Bachelor of Science"). Whole words only; checked in this order.
 */
const LEVEL_WORDS: readonly [EducationLevel, readonly string[]][] = [
	['doctor', ['s3', 'doktor', 'doctor', 'doctorate', 'doctoral', 'phd', 'ph.d', 'ph.d.']],
	[
		'master',
		['s2', 'magister', 'master', 'masters', 'mba', 'm.sc', 'm.sc.', 'msc', 'm.a.', 'm.kom']
	],
	['bachelor', ['s1', 'sarjana', 'bachelor', 'bachelors', 'b.sc', 'b.sc.', 'bsc', 'b.a.', 's.kom']],
	['diploma', ['d1', 'd2', 'd3', 'd4', 'diploma', 'associate', 'ahli']],
	[
		'school',
		[
			'sd',
			'smp',
			'mts',
			'sma',
			'smk',
			'ma',
			'slta',
			'sltp',
			'stm',
			'smea',
			'paket',
			'school',
			'sekolah',
			'madrasah'
		]
	]
];

function known(degree: string | undefined): DegreeDefinition | undefined {
	return BY_NAME.get(normalize(degree ?? ''));
}

/** Level of a degree, in either language. Unknown or empty → 'other'. */
export function educationLevel(degree: string | undefined): EducationLevel {
	const exact = known(degree);
	if (exact) return exact.level;
	const words = new Set(normalize(degree ?? '').split(' '));
	for (const [level, hints] of LEVEL_WORDS) {
		if (hints.some((hint) => words.has(hint))) return level;
	}
	return 'other';
}

/** True for SD/SMP/SMA/SMK/MA/MTs and their English names: no IPK, no thesis. */
export function isSchoolLevel(degree: string | undefined): boolean {
	return educationLevel(degree) === 'school';
}

/** Degree suggestions written in the CV's language. */
export function degreeOptions(locale: Locale): string[] {
	return DEGREES.map((degree) => degree.names[locale]);
}

/**
 * A known degree written in the CV's language ("S1" on an English CV → "Bachelor's Degree");
 * anything else is returned as the user typed it.
 */
export function displayDegree(degree: string, locale: Locale): string {
	return known(degree)?.names[locale] ?? degree;
}

const SCORE_LABELS: Record<Locale, { school: string; higher: string }> = {
	id: { school: 'Nilai rata-rata', higher: 'IPK' },
	en: { school: 'Average grade', higher: 'GPA' }
};

/** Label printed before the score on the CV: IPK/GPA, or the report-card average for schools. */
export function scoreLabel(degree: string | undefined, locale: Locale): string {
	return SCORE_LABELS[locale][isSchoolLevel(degree) ? 'school' : 'higher'];
}

/** Usual maximum of the score, for placeholders: '100' for schools, '4.00' otherwise. */
export function defaultScoreScale(degree: string | undefined): string {
	return isSchoolLevel(degree) ? '100' : '4.00';
}
