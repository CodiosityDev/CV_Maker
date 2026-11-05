/**
 * Namespace 'app' — English (lazy-loaded).
 * Plain text only. Every key here must also exist in the other language file.
 */
import type { AppMessages } from '../translate';

export const appEn: AppMessages = {
	wizard: {
		pageTitle: 'Create a CV — CV Maker',
		localNote: 'No account. Your CV stays on your device.',
		resumeTitle: 'Continue an unfinished CV',
		resume: 'Continue',
		untitled: 'Untitled CV',
		updatedAt: 'Last updated:',
		createError: 'Could not create your CV. Try again.',
		quizTitle: 'Not sure which to choose?',
		quizDescription: 'Answer two questions for a suggestion.',
		quizApplication: 'How will you send your application?',
		quizOnline: 'Online portal, large company, or state-owned company',
		quizDirect: 'Directly to a recruiter / portfolio',
		quizCreative: 'Are you applying for a design or creative role?',
		quizUnanswered: 'Choose an answer',
		quizYes: 'Yes, a creative role',
		quizNo: 'Another field',
		quizOptional: 'You can choose a CV type below without taking the quiz.',
		quizResult: 'Suggestion: {type}. You can choose another type.',
		recommended: 'Recommended',
		chooseAts: 'Choose ATS CV',
		chooseCreative: 'Choose Creative CV',
		back: 'Back',
		next: 'Next',
		skip: 'Skip',
		finish: 'Done',
		undo: 'Undo',
		redo: 'Redo',
		tips: 'Tips',
		examples: 'Examples',
		useExample: 'Use example',
		useSummary: 'Use example',
		actionVerbs: 'Action verbs',
		replaceTitle: 'Replace your summary with this example?',
		replaceDescription: 'Your current summary will be replaced. You can undo this.',
		replace: 'Replace summary',
		reviewReady: 'Your CV is ready',
		reviewIssues: 'A few details are missing',
		reviewInstruction: 'Select a note to edit that field.',
		issueContext: '{section} — {field}: {message}',
		editAgain: 'Edit again',
		optional: 'Optional',
		saved: 'Saved ✓',
		savedMemory: 'Saved temporarily',
		saving: 'Saving…',
		saveError: 'Changes have not been saved. Please try saving again.',
		retry: 'Try again',
		externalUpdated: 'This CV was changed in another tab.',
		externalRemoved: 'This CV was deleted in another tab.',
		reload: 'Load the latest version',
		keepLocal: 'Use this version',
		notFound: 'CV not found',
		notFoundDescription: 'Try the browser or device where you created it.',
		startNew: 'Create a new CV',
		memoryWarning: 'Your browser cannot save this CV. It will be lost when the tab closes.',
		photoRemove: 'Remove photo',
		photoAlt: 'CV profile photo',
		photoBusy: 'Processing photo…',
		photoFailed: 'Photo not saved. Try again.',
		photoMissing: 'Photo is unavailable on this device. Please choose it again.',
		atsPhotoHint: 'Photos are not shown on ATS CVs.',
		loading: 'Preparing your guidance…',
		loadError: 'Guidance could not be loaded. Check your connection and try again.',
		previewNotice: 'The preview uses ATS Classic. Creative designs are not available yet.',
		doneAvailability: 'Other templates, downloads, and the editor are not available yet.',
		addSkill: 'Add',
		removeSkill: 'Remove {skill}',
		skillsLimit: 'Up to {max} skills per group.',
		hints: {
			gpa: 'Example: 3.65 out of 4.00.',
			photo: 'Choose a formal photo with a plain background.'
		},
		newItems: {
			education: 'New education',
			experience: 'New experience',
			organizations: 'New organisation',
			projects: 'New project',
			languages: 'New language',
			certifications: 'New certification',
			awards: 'New award',
			links: 'New link'
		},
		emptyLists: {
			education: 'Add your most recent school or university.',
			experience: 'You can include internships or part-time work here.',
			organizations: 'Add an organisation or committee you have joined.',
			projects: 'Add a university project or personal work.',
			languages: 'Add a language you know.',
			certifications: 'Add relevant certifications or training.',
			awards: 'Add an achievement relevant to your application.',
			links: 'Add your LinkedIn, GitHub, or portfolio.'
		},
		bullets: {
			point: 'Point {number}',
			remove: 'Delete point {number}',
			actions: 'Point {number} actions',
			add: 'Add point',
			moveUp: 'Move up',
			moveDown: 'Move down',
			moved: 'Point {from} moved to {to}.',
			removed: 'Point {number} deleted.',
			added: 'Point {number} added.',
			limit: 'Up to {count} points.',
			help: 'Enter adds a point. Alt + ↑ / ↓ changes the order.',
			examples: 'Examples — click to add',
			pasteLimited: 'Some text was not added. Up to {count} points.',
			empty: 'Add a relevant task or result.'
		},
		photoErrors: {
			'not-an-image': 'Choose an image file, such as JPEG or PNG.',
			'too-large': 'This photo is too large. Choose a file under 15 MB.',
			'decode-failed': 'This image could not be read. Try another photo.',
			'encode-failed': 'This photo could not be processed. Try another image or a smaller size.'
		},
		fields: {
			title: 'CV title',
			locale: 'CV content language',
			targetRole: 'Target role',
			fullName: 'Full name',
			headline: 'Short headline',
			email: 'Email',
			phone: 'Phone number',
			city: 'City / regency',
			province: 'Province',
			links: 'Links',
			label: 'Link label',
			url: 'URL',
			institution: 'School / university',
			degree: 'Qualification',
			major: 'Major',
			gpa: 'GPA',
			gpaScale: 'GPA scale',
			start: 'Start',
			end: 'End',
			thesisTitle: 'Thesis / final project title',
			highlights: 'Education highlights',
			type: 'Experience type',
			role: 'Position / role',
			company: 'Company / workplace',
			location: 'Location',
			bullets: 'What you did & achieved',
			name: 'Name',
			hard: 'Technical skills',
			soft: 'Soft skills',
			tools: 'Tools & software',
			languages: 'Languages',
			level: 'Proficiency',
			score: 'Test score / details',
			certifications: 'Certifications & training',
			issuer: 'Issuer / organiser',
			date: 'Date',
			credentialUrl: 'Certificate URL',
			awards: 'Awards & achievements',
			awardTitle: 'Award title',
			description: 'Description',
			summary: 'Profile summary',
			photo: 'Profile photo (optional)'
		},
		experienceTypes: {
			internship: 'Internship',
			fulltime: 'Full-time',
			parttime: 'Part-time',
			freelance: 'Freelance',
			contract: 'Contract',
			volunteer: 'Volunteer'
		},
		languageLevels: {
			native: 'Native',
			fluent: 'Fluent',
			professional: 'Professional',
			intermediate: 'Intermediate',
			basic: 'Basic'
		},
		steps: {
			type: {
				short: 'Type',
				title: 'Choose your CV type',
				description: 'Choose a type for how you plan to apply.'
			},
			target: {
				short: 'Target',
				title: 'CV language & target role',
				description: 'Choose your CV language and target role.'
			},
			personal: {
				short: 'Personal',
				title: 'Personal details',
				description: 'Add the contact details recruiters can reach you at.'
			},
			education: {
				short: 'Education',
				title: 'Education',
				description: 'Add your most recent school or university.'
			},
			experience: {
				short: 'Experience',
				title: 'Work experience / internships',
				description: 'Add internships, part-time work, or freelance work.'
			},
			organizations: {
				short: 'Organisation',
				title: 'Organisations & committees',
				description: 'Add your role in an organisation or committee.'
			},
			projects: {
				short: 'Projects',
				title: 'Projects',
				description: 'Add university projects, a thesis, or personal work.'
			},
			skills: {
				short: 'Skills',
				title: 'Skills & achievements',
				description: 'Choose skills and achievements relevant to your target role.'
			},
			summary: {
				short: 'Summary',
				title: 'Profile summary',
				description: 'Write 2–4 sentences about your education and skills.'
			},
			review: {
				short: 'Review',
				title: 'Review your CV',
				description: 'Check your content, spelling, and contacts in the preview.'
			},
			done: {
				short: 'Done',
				title: 'Your CV is saved',
				description: 'You can still go back to change the content.'
			}
		}
	},
	preview: {
		empty: 'Add personal details to see a preview.',
		label: 'CV preview',
		loading: 'Preparing preview…',
		caption: 'ATS Classic · A4',
		open: 'View preview',
		error: 'The preview could not be loaded.',
		retry: 'Reload preview'
	}
};
