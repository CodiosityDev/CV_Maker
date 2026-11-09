/** Namespace 'ats' — English (lazy-loaded). Must mirror ats.id.ts exactly. */
import type { AtsMessages } from '../translate';

export const atsEn: AtsMessages = {
	ats: {
		levels: {
			error: 'Must fix',
			warn: 'Should fix',
			tip: 'Tip'
		},
		grades: {
			good: 'Ready to send',
			ok: 'Fairly good',
			needsWork: 'Needs work'
		},
		checks: {
			missingName: 'Full name is missing.',
			missingEmail: 'Email is missing. Recruiters need a way to reach you.',
			invalidEmail: 'Email format is not valid.',
			missingPhone: 'Phone number is missing.',
			invalidPhone: 'Phone number is not valid.',
			missingEducation: 'Add at least one education entry.',
			noExperience:
				'No experience, organisations or projects yet. Add one so your CV does not look empty.',
			noSkills: 'No skills yet. ATS often search for skill keywords.',
			missingSummary: 'Profile summary is missing.',
			longSummary: 'Summary is too long. 2–4 sentences are enough.',
			missingDates: 'Dates for "{item}" are incomplete.',
			invalidLink: 'Link "{item}" is not valid and will not appear on your CV.',
			unprofessionalEmail: 'Your email looks unprofessional. Use one with your name.',
			creativeForAts:
				'Creative CVs are less suited to job portals. Use an ATS CV for online applications.',
			itemWithoutBullets: '"{item}" has no points yet. Write what you did or achieved.',
			tooLong: 'Your CV is about {pages} pages. As a fresh graduate, aim for one page.',
			shortSummary: 'Summary is too short. Add your key skills and the role you want.',
			missingHeadline: 'Add a short headline, e.g. "Accounting Fresh Graduate".',
			bulletNoVerb:
				'{count} point(s) in "{item}" do not start with an action verb (e.g. Managed, Built).',
			fewNumbers:
				'Few points use numbers. Add measurable results where you can (amounts, %, time).',
			bulletTooLong: '{count} point(s) in "{item}" are too long. Split them into shorter points.',
			bulletTooShort:
				'{count} point(s) in "{item}" are too short. Say what you did and the result.',
			firstPerson: '{count} point(s) in "{item}" use "I/my". Start directly with a verb.',
			duplicateBullet: '{count} point(s) appear twice. Remove or rewrite one of them.',
			fewSkills: 'Only {count} skill(s). Add up to 5–10 relevant ones.'
		}
	},
	ai: {
		errors: {
			quota: "Today's free AI help is used up. Try again tomorrow after 00:00 WIB.",
			busy: 'Too many requests. Wait a moment and try again.',
			offline: 'No internet connection. AI help needs internet; your CV is still saved.',
			unavailable: 'AI help is not available right now. Try again later.',
			invalid: 'The request could not be processed. Reload the page and try again.',
			failed: 'The AI could not make a suggestion this time. Your quota was not used; try again.'
		}
	}
};
