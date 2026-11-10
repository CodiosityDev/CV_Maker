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
		scan: {
			checks: {
				imageOnly:
					'The text in this file cannot be read: it is an image or a scan. An ATS will see an empty CV. Recreate it as a text document.',
				missingEmail: 'No email found. Recruiters need a way to reach you.',
				missingPhone: 'No phone number found.',
				missingEducation: 'No Education section found. Give it a clear title such as "Education".',
				garbledText:
					'Some text reads as odd symbols or separated letters (icon fonts or letter spacing). An ATS may misread it.',
				multiColumn:
					'The CV uses two columns. Many ATS read line by line, so both columns get mixed up. Use one column.',
				tables: 'The CV uses tables. Some ATS skip or scramble table content.',
				textBoxes: 'The CV uses text boxes. ATS often skip their content.',
				contactInHeaderFooter:
					'Your email/phone is only in the page header or footer. Some ATS do not read it; move it into the body.',
				unclearHeadings:
					'Section titles were not recognised. Use standard titles such as Education, Experience, Skills.',
				noExperience:
					'No Experience, Organisations or Projects section. Add one so the CV does not look empty.',
				noSkills: 'No Skills section found. ATS often search for skill keywords.',
				missingSummary: 'No profile summary found. Add 2–4 sentences at the top.',
				missingDates: 'No years in education or experience. Add periods such as "2021 – 2025".',
				noBullets:
					'Experience is written as paragraphs. Split it into short bullet points that start with a verb.',
				unprofessionalEmail: 'The email looks unprofessional. Use one with your name.',
				tooLong: 'The CV is {pages} pages. For a fresh graduate, aim for 1–2 pages.',
				tooShort: 'The CV has only about {words} words. Add experience, projects or skills.',
				graphics:
					'{count} images/graphics found (photo, icons or skill charts). ATS do not read images; make sure the information is also in text.',
				missingLinkedIn: 'Add your LinkedIn profile so recruiters can learn more about you.',
				bulletNoVerb:
					'{count} bullet points do not start with an action verb (e.g. Managed, Built).',
				fewNumbers:
					'Few bullet points use numbers. Add measurable results where you can (counts, %, time).',
				bulletTooLong: '{count} bullet points are too long. Split them into shorter ones.',
				firstPerson: '{count} bullet points use "I/my". Start with a verb instead.'
			},
			errors: {
				unsupported:
					'File type not supported. Use PDF, DOCX or TXT (old .doc files: save again as DOCX/PDF).',
				tooLarge: 'The file is too large (max 5 MB).',
				encrypted: 'The file is password protected. Save it again without a password and retry.',
				damaged: 'The file is damaged or cannot be opened.',
				empty: 'The file contains no text.',
				failed: 'The file could not be read. Try again or use another format.'
			}
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
