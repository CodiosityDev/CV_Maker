/**
 * Namespace 'app' — English (lazy-loaded).
 * Plain text only. Every key here must also exist in the other language file.
 */
import type { AppMessages } from '../translate';

export const appEn: AppMessages = {
	convertAts: {
		title: 'Convert to an ATS CV',
		description:
			'AI restructures your CV for ATS, rewrites experience bullets, and offers suggestions. Contact details are not sent.',
		ai: 'Improve with AI (1 request)',
		local: 'Convert without AI',
		localHint: 'Structured automatically on your device. Check the result in the editor.',
		quotaUnknown: 'AI conversion uses 1 AI assistance request.',
		consentTitle: 'Convert your CV with AI?',
		consentIntro:
			'The CV text below is sent to the CV Maker server and then to the AI provider. Results stay in server memory for up to 2 minutes after they are ready for your browser to retrieve.',
		contactsNotSent:
			'Names, email, phone numbers, links, and addresses are not sent; they are read on your device and added back afterwards.',
		preparing: 'Preparing conversion…',
		sending: 'Sending…',
		working: 'AI is restructuring your CV…',
		localWorking: 'Structuring your CV on this device…',
		saving: 'Saving CV…',
		processingHint: 'Usually 15–40 seconds. Choose Cancel to close the progress view.',
		cancelHint:
			'Cancel closes this process on this page. A request is still used if AI has already started.',
		cancelled: 'Conversion cancelled.',
		localFailed: 'The CV could not be structured. Try again or choose another file.',
		saveFailed: 'The CV has not been saved. Try saving again.',
		openEditor: 'Open editor',
		openFailed: 'The CV is saved, but the editor could not be opened. Try opening it again.',
		retry: 'Try again',
		imageOnly:
			'Text in this file cannot be read, so it cannot be converted to an ATS CV yet. Create a new CV and follow the guidance to enter your details.',
		createNew: 'Create a new CV',
		review: {
			title: 'Review the converted CV',
			description: 'Check the result before saving. You can complete it in the editor.',
			contacts: 'Name and contact details found',
			noContacts: 'No name or contact details found. Add them in the editor.',
			sections: 'CV contents',
			notes: 'Things to check',
			aiNotes: 'AI suggestions',
			suggestedSkills: 'Add skills you have',
			skillsHint: 'Choose only skills you have. Nothing is added automatically.',
			placeholders: 'Replace with a real number or remove.',
			unplaced: 'Unplaced lines',
			copy: 'Copy lines',
			copied: 'Lines copied.',
			manualCopy: 'Copy these lines manually.',
			save: 'Save & open editor',
			cancel: 'Cancel',
			incognito: 'In Incognito Mode, this CV is stored temporarily in this session only.'
		}
	},
	editor: {
		title: 'Edit CV',
		description: 'Edit your CV content and sections. Changes save automatically.',
		download: 'Download',
		view: 'Editor view',
		edit: 'Edit',
		preview: 'Preview',
		appearance: 'Appearance',
		sections: {
			count: '{count} items',
			hidden: 'Hidden',
			up: 'Move up: {title}',
			down: 'Move down: {title}',
			drag: 'Drag to move: {title}',
			moved: '{title} is now at position {position} of {total}',
			more: 'Section actions: {title}',
			rename: 'Rename section',
			renameTitle: 'Rename section',
			titleLabel: 'Section title',
			defaultTitle: 'Default title: {title}. Leave blank to use it.',
			showOnCv: 'Show on CV',
			delete: 'Delete section',
			deleteTitle: 'Delete this section?',
			deleteDescription: 'Delete “{title}” and its {count} items? You can undo this.',
			removed: 'Section deleted.',
			add: 'Add section',
			addTitle: 'Add custom section',
			addPlaceholder: 'Training, Publications, Volunteering',
			limit: 'You can have up to {count} custom sections. Remove one to add another.',
			customEmpty: 'No items yet. Add training or activities to include.',
			itemTitle: 'Title',
			itemSubtitle: 'Subtitle (optional)',
			itemBullets: 'Activity points',
			newItem: 'New item'
		}
	},
	aiAssist: {
		headline: 'Suggest headlines with AI',
		write: 'Write with AI',
		improve: 'Improve with AI',
		skills: 'Suggest skills with AI',
		busy: 'Drafting…',
		needBackground:
			'Add a target role and at least one education, experience, organisation, or project entry first.',
		needSkills: 'Add a target role or one background entry first.',
		quota: '{remaining} of {limit} uses left today',
		reset: 'Uses reset at 00:00 WIB.',
		reward: 'Watch an ad for +1 AI use ({count} ads left today)',
		rewardHint: 'The ad opens in a new tab separate from your CV.',
		quotaAdded: 'An AI use has been added.',
		headlineChoices: 'AI headline suggestions',
		preview: 'AI summary preview',
		use: 'Use this text',
		discard: 'Dismiss',
		placeholder: 'Replace this with a correct number or remove it.',
		applied: 'AI suggestion applied.',
		consentTitle: 'AI assistance',
		consentIntro:
			'What is sent: target role, education and grades, experience, organisations, projects, skills, certifications, and summary. The CV language is included.',
		notSent: 'Your name, email, phone, city, links, and photo are not sent.',
		processing:
			'After you agree, this content goes through the CV Maker server to a third-party AI provider. CV content is not stored on the server; only anonymous usage counters are kept for 7 days.',
		freeQuota: 'You get 3 free uses per device per day, resetting at 00:00 WIB.',
		agree: 'Agree & continue',
		noTarget: 'Not filled in',
		background: 'Background sent',
		backgroundCount:
			'{education} education · {experience} experience · {organizations} organisations · {projects} projects',
		skillsAndSummary: 'Skills, certifications, and summary',
		contentCount:
			'{skills} skills · {certificates} certifications · {characters} summary characters'
	},
	atsPanel: {
		title: 'Check ATS',
		summary: '{error} must fix · {warn} recommended · {tip} tips',
		disclaimer: 'This score is an estimate based on general ATS rules, not a guarantee of success.',
		empty: 'No issues detected.',
		showTips: 'Show {count} tips',
		loading: 'Checking your CV…',
		failed: 'Your CV could not be checked. Try again.',
		retry: 'Try again',
		matchTitle: 'Match a job description',
		jobLabel: 'Paste the job description here',
		jobPlaceholder: 'Example: looking for someone with Excel and SQL skills.',
		jobPrivacy: 'The job description is used only on this page and is not saved.',
		characterCount: '{count}/{max} characters',
		keywordSummary: 'Matching keywords: {matched} of {total} ({percent}%)',
		presentTitle: 'Already in your CV',
		missingTitle: 'Not in your CV yet',
		noKeywords: 'No keywords could be matched yet.',
		nonePresent: 'No matching keywords yet.',
		noneMissing: 'All keywords are already in your CV.',
		keywordHelp: 'Click a missing skill to add it to Technical skills.',
		addKeyword: 'Add {term} to Technical skills',
		added: '{term} added.',
		doneScore: 'ATS score: {score}/100',
		checkAgain: 'Check again'
	},
	incognito: {
		label: 'Incognito Mode',
		headerLabel: 'Incognito',
		headerActive: 'Incognito active',
		startTitle: 'Turn on Incognito Mode?',
		startConfirm: 'Turn on',
		startFailed: 'Your CV has not been saved. Try saving again before turning on Incognito Mode.',
		started: 'Incognito Mode is on',
		startDescription:
			'Your CV is stored only in this tab and disappears when you close or refresh it. Download your CV before finishing.',
		browserTip:
			'For maximum privacy, also open an incognito/private browser window (Ctrl+Shift+N / ⌘+Shift+N).',
		activeTitle: 'Incognito Mode is on',
		activeDescription:
			'Incognito Mode is on — your CV is only in this tab and disappears when you close or refresh it. Download your CV before finishing.',
		idleDescription: 'Your CV is also erased automatically after 3 hours without changes.',
		expires: 'Erased automatically at {time} if there are no changes.',
		expiredMessage:
			'The CVs in this incognito session were erased automatically after 3 hours without changes.',
		expiredStatus: 'This session’s CV has been erased',
		endAction: 'End & erase',
		endTitle: 'End Incognito Mode?',
		endDescription: 'The CVs in this session will be erased. Have you downloaded your CV?',
		ended: 'Incognito Mode ended. This session’s CV data has been erased.',
		actionError: 'That did not work. Please try again.',
		sessionLabel: '(incognito session)',
		saved: 'Saved in this tab',
		downloadSafety:
			'On a shared computer: after downloading, delete the files from the Downloads folder and do not save passwords or accounts in the browser.'
	},
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
			reportGrade: 'Example: 85 out of 100.',
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
			reportGrade: 'Average report grade',
			scoreMaximum: 'Maximum',
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
		selectText: 'Select all text'
	},
	printPage: {
		title: 'Save your CV as PDF',
		incognitoTitle: 'CV',
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
	jobLinks: {
		title: 'Find jobs for {keyword}',
		dialogTitle: 'Find jobs',
		emptyTitle: 'Find jobs',
		description:
			'Open search results on job sites. Only the job title and city are sent, and only when you click.',
		empty: 'Add a target role to find relevant jobs.',
		fillTarget: 'Fill in target role',
		city: 'in {city}',
		wholeCountry: 'across Indonesia',
		newTab: '(opens a new tab)',
		related: 'Also search:',
		resetKeyword: 'Back to {keyword}',
		incognitoNote:
			'Job sites you open appear in your browser history; close the window when you finish.'
	},
	dashboard: {
		findJobs: 'Find jobs',
		checkAts: 'Check ATS',
		pageTitle: 'My CVs — CV Maker',
		title: 'My CVs',
		localNote:
			'Your CVs are stored only in this browser. Clearing browser data also deletes your CVs — download PDF/Word files for your records.',
		memoryWarning:
			'This browser is keeping your CVs temporarily. They will be lost when this tab closes. Download your CV before closing the tab.',
		loading: 'Loading CVs on this device…',
		loadError: 'Your CV list could not be loaded. Try again.',
		retry: 'Reload',
		create: 'Create a CV',
		empty: 'There are no CVs in this browser yet. Create your first CV.',
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
		delete: 'Delete',
		deleteTitle: 'Delete this CV?',
		deleteDescription:
			'The CV “{title}” will be permanently deleted from this browser. This cannot be undone. Download your CV first if you still need it.',
		deleted: 'CV deleted from this device.',
		actionError: 'That did not work. Please try again.',
		missing: 'This CV no longer exists. Your CV list has been refreshed.',
		wipeTitle: 'Finished using a shared device?',
		wipeDescription:
			'Delete all CVs, photos, and preferences from this browser. Download PDF/Word files first if you still need them.',
		wipeAction: 'Delete all data on this device',
		wipeConfirmTitle: 'Delete all data?',
		wipeConfirmDescription:
			'All CVs, photos, and preferences will be permanently deleted from this browser. CV files you have already downloaded will remain. This cannot be undone.',
		wipeWord: 'DELETE',
		wipeInput: 'Type {word} to continue.',
		wipeInputLabel: 'Confirmation word',
		wipeDone: 'All CV data on this device was deleted.'
	}
};
