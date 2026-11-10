/**
 * "Ubah jadi CV ATS": a CV file made anywhere → a CV in CV Maker. Shared by the on-device parser,
 * the AI task 'convert' (server validates the same shape) and the CV builder.
 */
import type { DateRange, ExperienceType, LanguageLevel, Locale, YearMonth } from '../schema/types';

/** CV content WITHOUT contact details (that part never goes to the AI). */
export interface CvDraft {
	targetRole: string;
	headline: string;
	summary: string;
	education: {
		institution: string;
		degree: string;
		major: string;
		gpa: string;
		gpaScale: string;
		dates: DateRange;
		highlights: string[];
	}[];
	experience: {
		type: ExperienceType;
		role: string;
		company: string;
		location: string;
		dates: DateRange;
		bullets: string[];
	}[];
	organizations: { name: string; role: string; dates: DateRange; bullets: string[] }[];
	projects: { name: string; role: string; dates?: DateRange; bullets: string[] }[];
	skills: { hard: string[]; tools: string[]; soft: string[] };
	languages: { name: string; level: LanguageLevel; score: string }[];
	certifications: { name: string; issuer: string; date?: YearMonth }[];
	awards: { title: string; issuer: string; date?: YearMonth; description: string }[];
}

/** Read on the device only. */
export interface CvContacts {
	fullName: string;
	email: string;
	phone: string;
	city: string;
	links: { label: string; url: string }[];
}

/**
 * Things the user must check after converting; the UI shows `t(note.messageKey, note.params)`.
 * monthGuessed: only a year was written → month set to January · missingContact: no email/phone
 * found · missingName · notParsed: lines that fit no section (shown so nothing is silently lost).
 */
export type ConvertNoteId = 'monthGuessed' | 'missingName' | 'missingContact' | 'notParsed';
export interface ConvertNote {
	id: ConvertNoteId;
	messageKey: `ats.convert.notes.${ConvertNoteId}`;
	params?: Record<string, string | number>;
}

export interface LocalParse {
	draft: CvDraft;
	contacts: CvContacts;
	notes: ConvertNote[];
	/** Lines the parser could not place (kept for the user, never dropped silently). */
	unplaced: string[];
	locale: Locale;
}
