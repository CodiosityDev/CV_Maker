/**
 * Labels printed ON the CV, in the CV's own language (cv.locale) — independent of the UI language.
 * Kept separate from the UI dictionaries so templates don't pull in all UI text.
 * Section titles follow standard ATS-recognised headings.
 */
import type {
	BuiltinSectionKey,
	ExperienceType,
	LanguageLevel,
	Locale,
	SkillGroups
} from '../schema/types';

export interface CvLabels {
	sections: Record<BuiltinSectionKey, string>;
	experienceType: Record<ExperienceType, string>;
	languageLevel: Record<LanguageLevel, string>;
	skillGroups: Record<keyof SkillGroups, string>;
	present: string;
	gpa: string;
	thesis: string;
	/** Thesis-like work at school level (SMA/SMK): "Karya tulis", "Final project". */
	finalProject: string;
	email: string;
	phone: string;
	location: string;
	links: string;
}

export const CV_LABELS: Record<Locale, CvLabels> = {
	id: {
		sections: {
			summary: 'Ringkasan',
			education: 'Pendidikan',
			experience: 'Pengalaman Kerja',
			organizations: 'Pengalaman Organisasi',
			projects: 'Proyek',
			skills: 'Keahlian',
			languages: 'Bahasa',
			certifications: 'Sertifikasi & Pelatihan',
			awards: 'Prestasi & Penghargaan'
		},
		experienceType: {
			internship: 'Magang',
			fulltime: 'Penuh Waktu',
			parttime: 'Paruh Waktu',
			freelance: 'Freelance',
			contract: 'Kontrak',
			volunteer: 'Relawan'
		},
		languageLevel: {
			native: 'Bahasa Ibu',
			fluent: 'Fasih',
			professional: 'Profesional',
			intermediate: 'Menengah',
			basic: 'Dasar'
		},
		skillGroups: {
			hard: 'Keahlian Teknis',
			soft: 'Soft Skills',
			tools: 'Tools & Software'
		},
		present: 'Sekarang',
		gpa: 'IPK',
		thesis: 'Skripsi',
		finalProject: 'Karya tulis',
		email: 'Email',
		phone: 'Telepon',
		location: 'Domisili',
		links: 'Tautan'
	},
	en: {
		sections: {
			summary: 'Summary',
			education: 'Education',
			experience: 'Work Experience',
			organizations: 'Organizational Experience',
			projects: 'Projects',
			skills: 'Skills',
			languages: 'Languages',
			certifications: 'Certifications & Training',
			awards: 'Awards & Achievements'
		},
		experienceType: {
			internship: 'Internship',
			fulltime: 'Full-time',
			parttime: 'Part-time',
			freelance: 'Freelance',
			contract: 'Contract',
			volunteer: 'Volunteer'
		},
		languageLevel: {
			native: 'Native',
			fluent: 'Fluent',
			professional: 'Professional',
			intermediate: 'Intermediate',
			basic: 'Basic'
		},
		skillGroups: {
			hard: 'Technical Skills',
			soft: 'Soft Skills',
			tools: 'Tools & Software'
		},
		present: 'Present',
		gpa: 'GPA',
		thesis: 'Thesis',
		finalProject: 'Final project',
		email: 'Email',
		phone: 'Phone',
		location: 'Location',
		links: 'Links'
	}
};
