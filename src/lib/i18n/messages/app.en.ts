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
		otherExamples: 'Examples for other fields',
		recommendations: {
			forRole: 'Suggested for {targetRole}',
			emptyTarget: 'Add a target role for more relevant suggestions.',
			targetAction: 'Add a target role',
			popularSoft: 'Popular soft skills',
			added: '{skill} added.'
		},
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
		goDashboard: 'Go to My CVs',
		allCvs: 'View all CVs',
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
		previewNotice: 'The preview follows your selected template.',
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
				description: 'Download your CV to apply, or go back to change the content.'
			}
		}
	},
	templates: {
		'ats-klasik': {
			name: 'ATS Classic',
			description: 'A simple layout with contact details at the top.'
		},
		'ats-modern': { name: 'ATS Modern', description: 'Generous spacing and easily scanned dates.' },
		'ats-ringkas': { name: 'ATS Compact', description: 'A compact layout that uses fewer pages.' },
		'creative-sidebar': {
			name: 'Creative Sidebar',
			description: 'Contact details and skills in a side panel.'
		},
		'creative-header': {
			name: 'Creative Header',
			description: 'Your name and photo in a colored top band.'
		},
		'creative-timeline': {
			name: 'Creative Timeline',
			description: 'Experience and education along a timeline.'
		}
	},
	templatePicker: {
		title: 'Choose your CV layout',
		description: 'Your CV content stays the same when you switch type or template.',
		kind: 'CV type',
		ats: 'CV ATS',
		creative: 'CV Creative',
		templates: 'Template choices',
		creativeNotice: 'Less suitable for ATS portals',
		selected: 'Selected',
		choose: 'Choose template',
		colorsLabel: 'Accent color',
		thumbnailLoading: 'Preparing example…',
		thumbnailError: 'The example could not be loaded.',
		colors: {
			periwinkle: 'Periwinkle',
			mint: 'Mint',
			peach: 'Peach',
			coral: 'Soft coral',
			sky: 'Sky blue',
			lavender: 'Lavender'
		}
	},
	preview: {
		empty: 'Add personal details to see a preview.',
		label: 'CV preview',
		loading: 'Preparing preview…',
		caption: '{template} · A4',
		open: 'View preview',
		error: 'The preview could not be loaded.',
		retry: 'Reload preview'
	},
	exportPanel: {
		title: 'Download CV',
		simpleLayout: 'Word and text use a simple layout that job portals can read easily.',
		pdf: 'PDF for applications',
		pdfHint: 'Open the print page, then choose Save as PDF.',
		pdfAtsHint: 'This PDF contains real text that ATS systems can read.',
		docx: 'Word (.docx)',
		docxHint: 'For job portals that request a Word file.',
		txt: 'Text (.txt)',
		txtHint: 'Download your CV as plain text.',
		copy: 'Copy text',
		copyHint: 'Paste it into a job portal application form.',
		preparing: 'Preparing…',
		copying: 'Copying…',
		downloadError: 'The file could not be prepared. Try downloading again.',
		navigationError: 'Your changes have not been saved. Try again before opening another page.',
		copied: 'Text copied',
		manualLabel: 'CV text to copy',
		manualHint:
			'Your browser did not allow automatic copying. Select the text below, then copy it using your device’s menu.',
		selectText: 'Select all text',
		backupReminder: 'Save a backup regularly to keep your CV content safe.',
		backupLink: 'Back up in My CVs'
	},
	printPage: {
		title: 'Save your CV as PDF',
		back: 'Back to My CVs',
		savePdf: 'Save as PDF',
		guideTitle: 'How to save as PDF',
		android: 'Android · Chrome',
		androidGuide:
			'Open the ⋮ menu → Share → Print. Select “Save as PDF”, then save the file to your device.',
		iphone: 'iPhone · Safari',
		iphoneGuide:
			'Tap Share → Print. Pinch out or enlarge the preview, then choose Share → Save to Files.',
		desktop: 'Computer',
		desktopGuide:
			'Choose “Save as PDF” as the destination and A4 paper. Turn off “Headers and footers” to leave out the page address. Use Default or None for margins.',
		loading: 'Preparing the print page…',
		loadError: 'The print page could not be loaded. Please try again.',
		retry: 'Reload print page',
		printError: 'The print menu could not be opened. Try again in this browser.',
		notFound: 'CV not found',
		notFoundDescription:
			'This CV is not in this browser or has been deleted. Open My CVs to choose another CV.'
	},
	dashboard: {
		pageTitle: 'My CVs — CV Maker',
		title: 'My CVs',
		localNote:
			'Your CVs are stored only in this browser. Clearing browser data also deletes your CVs. Save a backup regularly.',
		memoryWarning:
			'This browser is keeping your CVs temporarily. They will be lost when this tab closes. Download your CV and save a backup before closing the tab.',
		loading: 'Loading CVs on this device…',
		loadError: 'Your CV list could not be loaded. Try again.',
		retry: 'Reload',
		create: 'Create a CV',
		empty: 'There are no CVs in this browser yet. Create your first CV or restore a backup file.',
		untitled: 'Untitled CV',
		nameMissing: 'Name not added yet',
		roleMissing: 'Target role not added yet',
		updatedAt: 'Updated',
		unfinished: 'Not finished',
		unfinishedDownload:
			'This CV is not finished yet. You can still download it and continue filling it in later.',
		kindAts: 'ATS CV',
		kindCreative: 'Creative CV',
		continue: 'Continue',
		edit: 'Edit',
		download: 'Download',
		more: 'More actions for {title}',
		duplicate: 'Duplicate',
		duplicated: 'A copy of your CV was created.',
		rename: 'Rename',
		renameTitle: 'Rename CV',
		titleLabel: 'CV title',
		titleRequired: 'Enter a CV title first.',
		renamed: 'CV title saved.',
		backupOne: 'Back up this CV',
		delete: 'Delete',
		deleteTitle: 'Delete this CV?',
		deleteDescription:
			'The CV “{title}” will be permanently deleted from this browser. This cannot be undone. Save a backup first if you still need it.',
		deleted: 'CV deleted from this device.',
		actionError: 'That did not work. Please try again.',
		missing: 'This CV no longer exists. Your CV list has been refreshed.',
		backupTitle: 'Back up & restore CVs',
		backupDescription:
			'Save a JSON file as a backup or to move your CVs to another browser. It includes CV content and photos.',
		backupAll: 'Back up all CVs',
		restore: 'Restore from backup',
		restoring: 'Restoring…',
		backupError: 'The backup could not be downloaded. Try again.',
		restoreImported: '{count} CVs restored',
		restoreCopied: '{count} as copies',
		restoreSkipped: '{count} skipped',
		restoreEmpty: 'This backup file does not contain any CVs.',
		restoreErrors: {
			tooLarge: 'This backup file is too large. The maximum size is 5 MB.',
			invalidJson: 'This file is not readable JSON. Choose a .json backup file.',
			notBackup: 'This is not a CV Maker backup file.',
			newerVersion:
				'This backup was made with a newer app version. Update the app before restoring it.'
		},
		wipeTitle: 'Finished using a shared device?',
		wipeDescription:
			'Delete all CVs, photos, and preferences from this browser. Save a backup first if you still need them.',
		wipeAction: 'Delete all data on this device',
		wipeConfirmTitle: 'Delete all data?',
		wipeConfirmDescription:
			'All CVs, photos, and preferences will be permanently deleted from this browser. Backup files you have already downloaded will remain. This cannot be undone.',
		wipeWord: 'DELETE',
		wipeInput: 'Type {word} to continue.',
		wipeInputLabel: 'Confirmation word',
		wipeDone: 'All CV data on this device was deleted.'
	}
};
