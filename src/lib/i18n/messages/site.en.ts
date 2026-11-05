/**
 * Namespace 'site' — English (lazy-loaded).
 * Plain text only. Every key here must also exist in the other language file.
 */
import type { SiteMessages } from '../translate';

export const siteEn: SiteMessages = {
	landing: {
		title: 'CV Maker — A free CV for your first career step',
		description:
			'Build an ATS-friendly or creative CV with guidance for fresh graduates. Free, no sign-up, and your data stays on your device.',
		eyebrow: 'FROM CAMPUS TO NEW OPPORTUNITIES',
		headline: 'Your first step towards a career.',
		headlineStart: 'Your first step',
		headlineEnd: 'towards a career.',
		intro:
			'Not much experience yet? You still have a story. Turn your education, student activities, and projects into a CV ready for what comes next.',
		start: 'Start my CV',
		free: 'Free, no sign-up',
		local: 'Your data stays on your device',
		mockupLabel: 'Example CV layout',
		mockupName: 'Your full name',
		mockupRole: 'Fresh Graduate · Your chosen field',
		mockupContact: 'Email · Phone · City',
		mockupSummary: 'Profile',
		mockupSummaryText: 'Share your skills and the career direction you want to take.',
		mockupEducation: 'Education',
		mockupUniversity: 'Your university / school',
		mockupDegree: 'Study programme · Graduation year',
		mockupExperience: 'Activities & projects',
		mockupProject: 'Experience that matters',
		mockupBullet: 'Show your contribution, skills, and what you learned.',
		mockupSkills: 'Skills',
		mockupSkillText: 'Communication · Analysis · Teamwork',
		mockupTag: 'Your potential, on paper.',
		mockupNote: 'Your campus experience counts, too.',
		howEyebrow: 'ONE STEP AT A TIME',
		howTitle: 'From a blank page to your first CV.',
		howIntro: 'You do not need all the answers yet. Start with what you have.',
		stepOne: '01',
		stepTwo: '02',
		stepThree: '03',
		chooseTitle: 'Choose your CV type',
		chooseCopy: 'ATS for application portals, or Creative to show your visual side.',
		fillTitle: 'Follow the guidance',
		fillCopy: 'Build your story step by step, with tips that fit a fresh graduate’s experience.',
		downloadTitle: 'Download PDF / DOCX',
		downloadCopy: 'Choose the format your application needs. Save a backup for peace of mind.',
		typeEyebrow: 'MADE FOR YOUR NEXT MOVE',
		typeTitle: 'One story. Two ways to tell it.',
		typeIntro: 'Choose what fits the way you apply. You can change your type and template later.',
		atsLabel: 'CLEAR & EASY TO READ',
		atsTitle: 'ATS CV',
		atsCopy:
			'One column, no photo, and a focus on content. A choice for applying through recruitment portals.',
		atsDetail:
			'A simple structure helps systems read your CV. Selection still depends on the requirements and recruitment process.',
		creativeLabel: 'ROOM FOR EXPRESSION',
		creativeTitle: 'Creative CV',
		creativeCopy:
			'Colour, visual layouts, and an optional photo. Suited to portfolios or sending directly to a recruiter.',
		creativeWarning: 'Less suited to ATS portals',
		creativeDetail: 'Follow the job’s requirements. Text in the PDF remains selectable.',
		privacyEyebrow: 'YOUR STORY STAYS YOURS',
		privacyTitle: 'A personal CV. On your own device.',
		privacyCopy:
			'No account, no CV data sent to a server, and no third-party trackers. You stay in control.',
		privacyBackup:
			'Browser data can be erased. Save a backup regularly, especially on shared computers.',
		privacyLink: 'Read how your privacy is protected',
		faqEyebrow: 'BEFORE YOU START',
		faqTitle: 'A few things you might be wondering.',
		faqIntro: 'A little clarity to help you start with confidence.',
		faqAtsQuestion: 'What is an ATS?',
		faqAtsAnswer:
			'An ATS (Applicant Tracking System) helps companies manage applications. A CV with a simple structure is easier for systems to read, but does not guarantee selection.',
		faqFreeQuestion: 'Is it really free?',
		faqFreeAnswer: 'Yes. You can create and download your CV for free, without an account.',
		faqStorageQuestion: 'Where is my data stored?',
		faqStorageAnswer:
			'CV data is stored in your browser on the device you are using. It is not sent to a server and does not automatically move to another device.',
		faqDeletedQuestion: 'What if my browser data is erased?',
		faqDeletedAnswer:
			'CVs stored in that browser will be lost. Save a JSON backup regularly so you can import it again when needed. Keep your own copies of PDF or DOCX files too.',
		faqMobileQuestion: 'Can I use it on my phone?',
		faqMobileAnswer:
			'Yes. The layout is designed for phones, tablets, and computers. You can build your CV right in your browser.',
		faqEnglishQuestion: 'Is English available?',
		faqEnglishAnswer:
			'Yes. The interface is available in Indonesian and English. You can choose the CV’s content language separately when creating your CV.',
		closingTitle: 'Your next opportunity starts here.',
		closingCopy: 'Bring your story. We will help you put it on paper.'
	},
	privacy: {
		title: 'Privacy — CV Maker',
		description:
			'Learn how CV Maker stores data on your device, how to delete it, and why backups matter.',
		eyebrow: 'PRIVACY IN PLAIN LANGUAGE',
		heading: 'Your data, your control.',
		intro: 'Your CV tells a personal story. In this version, CV data stays on the device you use.',
		storageTitle: 'Stored in your browser, without an account',
		storageCopy:
			'CV data is stored in browser storage (IndexedDB). Your language preference is saved in localStorage. This version has no accounts, CV storage server, or cross-device sync.',
		trackingTitle: 'No third-party trackers',
		trackingCopy:
			'We do not include analytics, advertising pixels, scripts, or fonts from third-party services. Fonts are served by this site. CV data is not sent to a server.',
		photoTitle: 'Photos and location metadata',
		photoCopy:
			'When photo uploads are available, photos are processed on your device: resized and re-encoded to remove EXIF metadata, including GPS locations. Photos stay in browser storage.',
		deleteTitle: 'Deleting your data',
		deleteCopy:
			'When the dashboard is available, use “Delete all data on this device” in My CVs. You can also clear this site’s data in your browser settings. This removes CVs and photos stored in that browser.',
		backupTitle: 'Keep a backup, especially on shared computers',
		backupCopy:
			'Clearing browser data, a broken device, or changing browsers can mean losing your CV. Save a JSON backup regularly and keep downloaded files somewhere you control.',
		sharedCopy:
			'On a public computer, download what you need and clear site data before leaving. Also delete downloaded files from that computer after transferring them.',
		back: 'Back to home'
	},
	about: {
		title: 'About — CV Maker',
		description:
			'CV Maker is an open-source project helping fresh graduates create ATS and creative CVs for free.',
		eyebrow: 'ABOUT CV MAKER',
		heading: 'Your first story deserves a place.',
		intro:
			'No work experience does not mean no skills. This project helps fresh graduates turn education, student activities, internships, and projects into a clear CV.',
		purposeTitle: 'Built for your first career step',
		purposeCopy:
			'CV Maker is designed to be free and easy to use on a phone. You will follow a guided flow before moving to a flexible editor. Choose an ATS CV for a simple structure, or a Creative CV for visual needs.',
		openTitle: 'Open for everyone to learn together',
		openCopy:
			'CV Maker is an open-source project. The source code and project development are available on GitHub.',
		github: 'View the code on GitHub',
		privacyCopy:
			'No account needed. Your CV data stays on your device. Save a backup to keep your story safe.',
		back: 'Back to home'
	}
};
