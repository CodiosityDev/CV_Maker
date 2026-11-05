/**
 * Namespace 'app' — English (lazy-loaded).
 * Plain text only. Every key here must also exist in the other language file.
 */
import type { AppMessages } from '../translate';

export const appEn: AppMessages = {
	wizard: {
		pageTitle: 'Create a CV — CV Maker',
		typeEyebrow: 'START WITH HOW YOU APPLY',
		localNote: 'No account. Your CV stays on your device.',
		resumeTitle: 'Continue an unfinished CV',
		resume: 'Continue',
		untitled: 'Untitled CV',
		updatedAt: 'Last updated:',
		createError: 'Your CV could not be created. Please try choosing again.',
		quizTitle: 'Not sure yet? Try a quick quiz.',
		quizDescription: 'These two questions help you choose a CV type. The choice is still yours.',
		quizApplication: 'How will you send your application?',
		quizOnline: 'Online portal, large company, or state-owned company',
		quizDirect: 'Directly to a recruiter / portfolio',
		quizCreative: 'Are you applying for a design or creative role?',
		quizUnanswered: 'Choose an answer',
		quizYes: 'Yes, a creative role',
		quizNo: 'Another field',
		quizOptional: 'This quiz is optional. You can also choose directly below.',
		quizResult: 'Our recommendation: {type}. The final choice is yours.',
		recommended: 'Recommended',
		chooseAts: 'Choose ATS CV',
		chooseCreative: 'Choose Creative CV',
		back: 'Back',
		next: 'Next',
		skip: 'Skip',
		finish: 'Finish my CV',
		undo: 'Undo',
		redo: 'Redo',
		tips: 'Tips for this step',
		examples: 'Examples for inspiration',
		useExample: 'Use example',
		useSummary: 'Use as a starting point',
		actionVerbs: 'Action verbs for inspiration',
		replaceTitle: 'Replace your summary with this example?',
		replaceDescription: 'This replaces the summary you have written. You can undo it afterwards.',
		replace: 'Replace summary',
		reviewReady: 'Your CV is ready',
		reviewIssues: 'A few details need your attention',
		reviewInstruction: 'Select a note below to go straight to the field that needs attention.',
		issueContext: '{section} — {field}: {message}',
		editAgain: 'Edit again',
		optional: 'Optional',
		saved: 'Saved on this device ✓',
		savedMemory: 'Saved temporarily in this tab',
		saving: 'Saving…',
		saveError: 'Changes have not been saved. Please try saving again.',
		retry: 'Try again',
		externalUpdated: 'This CV was changed in another tab.',
		externalRemoved: 'This CV was deleted in another tab.',
		reload: 'Load the latest version',
		keepLocal: 'Use this version',
		notFound: 'CV not found',
		notFoundDescription:
			'This CV may have been deleted, or it may be saved in another browser or on another device.',
		startNew: 'Create a new CV',
		memoryWarning:
			'Device storage is unavailable. Data is only saved temporarily and will be lost when this tab closes.',
		photoRemove: 'Remove photo',
		photoAlt: 'CV profile photo',
		photoBusy: 'Processing photo…',
		photoFailed: 'Your photo could not be saved. Please try again.',
		photoMissing: 'Photo is unavailable on this device. Please choose it again.',
		atsPhotoHint:
			'ATS CVs leave out photos so recruitment systems can read the content more easily.',
		loading: 'Preparing your guidance…',
		loadError: 'Guidance could not be loaded. Check your connection and try again.',
		previewNotice:
			'Both CV types currently use the ATS Classic preview. Creative designs will be available in the next template stage.',
		doneAvailability:
			'Your CV content is saved. Template choices, downloads, and the full editor will arrive in a later stage.',
		addSkill: 'Add',
		removeSkill: 'Remove {skill}',
		skillsLimit: 'Up to {max} skills per group.',
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
			start: 'Start date',
			end: 'End date',
			thesisTitle: 'Thesis / final project title',
			highlights: 'Education highlights',
			type: 'Experience type',
			role: 'Position / role',
			company: 'Company / workplace',
			location: 'Location',
			bullets: 'Contributions and achievements',
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
				title: 'Choose your CV type',
				description:
					'Match your CV to how you apply and the role you want. We will build it together, one step at a time.'
			},
			target: {
				title: 'Your career direction',
				description:
					'Start with your CV language and the role you want. Give it a title so you can find it again.'
			},
			personal: {
				title: 'Personal details',
				description: 'Help recruiters get to know and contact you. Include the details that matter.'
			},
			education: {
				title: 'Education',
				description:
					'Share your educational background. Final projects, coursework, and scholarships can show your skills too.'
			},
			experience: {
				title: 'Work experience / internships',
				description:
					'Internships, part-time work, and freelance projects count too. Nothing yet? You can skip this step.'
			},
			organizations: {
				title: 'Organisations & committees',
				description: 'Show your role and contribution when working with others.'
			},
			projects: {
				title: 'Projects',
				description:
					'University projects, a thesis, and personal work can demonstrate what you can do.'
			},
			skills: {
				title: 'Skills & achievements',
				description:
					'Add skills, languages, certifications, or achievements relevant to the role you want.'
			},
			summary: {
				title: 'Profile summary',
				description:
					'Tell a short story about yourself, your main strengths, and your career direction. The examples below can help you start.'
			},
			review: {
				title: 'Review your CV',
				description:
					'Check your content, spelling, and contact details. The preview shows what a recruiter will read.'
			},
			done: {
				title: 'Well done, your CV is taking shape!',
				description:
					'You have completed an important step. You can review and improve your content from here whenever you need.'
			}
		}
	},
	preview: {
		empty: 'Add your personal details to see your CV take shape here.',
		label: 'CV preview',
		loading: 'Preparing preview…',
		caption: 'ATS Classic · A4',
		open: 'View preview',
		error: 'The preview could not be loaded.',
		retry: 'Reload preview'
	}
};
