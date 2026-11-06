/** Site content — English (lazy-loaded). */
import type { SiteMessages } from '../translate';

export const siteEn: SiteMessages = {
	landing: {
		title: 'CV Maker — Create a free CV for your first job application',
		description:
			'Build an ATS or Creative CV with guidance for fresh graduates. Free, no sign-up, and your data stays on your device.',
		headline: 'Create a CV for your first job application.',
		intro: 'Free, no sign-up. Choose an ATS or Creative CV, then follow the guidance.',
		mockupLabel: 'Example CV layout',
		mockupName: 'Alya Putri',
		mockupRole: 'Information Systems Graduate',
		mockupContact: 'alya@example.com · 0812-3456-7890 · Malang',
		mockupSummary: 'Summary',
		mockupSummaryText:
			'Information Systems graduate with data analysis project experience. Skilled in SQL and Microsoft Excel.',
		mockupEducation: 'Education',
		mockupUniversity: 'Example University',
		mockupDegree: 'BSc Information Systems · 2024',
		mockupExperience: 'Activities & projects',
		mockupProject: 'Small business sales dashboard',
		mockupBullet: 'Analysed 12 months of sales data and prepared a report for the business owner.',
		mockupSkills: 'Skills',
		mockupSkillText: 'SQL · Microsoft Excel · Data analysis',
		howTitle: 'How it works',
		chooseTitle: 'Choose your CV type',
		chooseCopy: 'Choose ATS for recruitment portals, or Creative for direct applications.',
		fillTitle: 'Follow the guidance',
		fillCopy:
			'Add your personal details, education, experience, and skills with tips and examples.',
		reviewTitle: 'Review your CV',
		reviewCopy:
			'Check your content and contact details in the preview, then download PDF, Word, or text.',
		typeTitle: 'ATS or Creative',
		atsTitle: 'ATS CV',
		atsCopy:
			'One column, no photo, and a focus on text. Suited to recruitment portals that use an ATS.',
		atsDetail: 'A simple structure helps systems read your CV, but does not guarantee selection.',
		creativeTitle: 'Creative CV',
		creativeCopy: 'For direct applications or portfolios, with an optional photo.',
		creativeWarning: 'Less suited to ATS portals',
		creativeDetail: 'Choose from three Creative designs and accent colors at the review step.',
		privacyCopy: 'Your CV is stored in the browser on your device, without being sent to a server.',
		privacyLink: 'Read the privacy policy',
		faqCopy: 'Have a question before you start?',
		faqLink: 'Read the FAQ'
	},
	faq: {
		title: 'FAQ — CV Maker',
		description:
			'Answers about ATS CVs, cost, data storage, mobile use, languages, and who makes CV Maker.',
		heading: 'FAQ',
		intro: 'Answers about using CV Maker and storing your CV data.',
		questionsTitle: 'Questions',
		atsQuestion: 'What is an ATS?',
		atsAnswer:
			'An ATS (Applicant Tracking System) helps companies manage applications. A CV with a simple structure is easier for systems to read, but does not guarantee selection.',
		freeQuestion: 'Is it really free?',
		freeAnswer: 'Yes. Creating and downloading a CV is free and does not require an account.',
		storageQuestion: 'Where is my data stored?',
		storageAnswer:
			'CV data is stored in your browser on the device you are using. It is not sent to a server and does not automatically move to another device.',
		deletedQuestion: 'What if my browser data is erased?',
		deletedAnswer:
			'CVs stored in that browser will be lost. Download PDF/Word files for your records before clearing browser data.',
		incognitoQuestion: 'I use a public or shared computer. Is it safe?',
		incognitoAnswer:
			'Turn on Incognito Mode before creating a CV: its content stays only in this tab and disappears when the tab is closed, refreshed, or left unchanged for 3 hours. For maximum privacy, also open an incognito/private browser window (Ctrl+Shift+N / ⌘+Shift+N). Download your CV before finishing, delete the files from the Downloads folder, choose End & erase, then close the tab. Do not save passwords or accounts in the browser.',
		mobileQuestion: 'Can I use it on my phone?',
		mobileAnswer: 'Yes, directly in your phone, tablet, or computer browser.',
		englishQuestion: 'Is English available?',
		englishAnswer: 'Yes. Choose ID or EN for the interface; choose the CV language separately.',
		makerQuestion: 'Who makes CV Maker?',
		makerAnswer: 'CV Maker is created by Codiosity.',
		makerLink: 'Visit Codiosity',
		back: 'Back to home'
	},
	privacy: {
		title: 'Privacy — CV Maker',
		description:
			'How CV Maker stores data on your device and how to delete it through browser settings.',
		heading: 'CV data privacy',
		intro: 'CV data and photos are stored in the browser on the device you use.',
		storageTitle: 'Stored in your browser, without an account',
		storageCopy:
			'CV data and your language preference are stored in your browser. This version has no accounts or CV storage server, and does not sync data between devices.',
		trackingTitle: 'No third-party trackers',
		trackingCopy:
			'We do not include analytics, advertising pixels, scripts, or fonts from third-party services. Fonts are served by this site. CV data is not sent to a server.',
		photoTitle: 'Photos and location metadata',
		photoCopy:
			'Photos for Creative CVs are processed on your device: resized and re-encoded to remove EXIF metadata, including GPS locations. Photos stay in browser storage.',
		deleteTitle: 'Deleting your data',
		deleteCopy:
			'Clear this site’s data through your browser settings. This removes CVs, photos, and the language preference stored in that browser.',
		lossTitle: 'If browser data is erased',
		lossCopy:
			'Clearing browser data, a broken device, or changing browsers can mean losing your CV. Download PDF/Word files for your records before clearing browser data.',
		sharedCopy:
			'On a shared computer, turn on Incognito Mode before creating your CV. Data stays only in this tab, disappears when the tab is closed or refreshed, and is erased automatically after 3 hours without changes. Download your CV before finishing, delete the files from the Downloads folder, choose End & erase, then close the tab. Do not save passwords or accounts in the browser.',
		back: 'Back to home'
	},
	about: {
		title: 'About — CV Maker',
		description:
			'CV Maker is created and maintained by Codiosity to help fresh graduates build ATS or Creative CVs.',
		heading: 'About CV Maker',
		intro:
			'CV Maker helps fresh graduates build an ATS or Creative CV with guidance, without creating an account.',
		attribution: 'CV Maker is created and maintained by Codiosity.',
		codiosityLink: 'Visit Codiosity',
		openTitle: 'Source code',
		openCopy: 'The CV Maker source code is available on GitHub.',
		github: 'View the code on GitHub',
		back: 'Back to home'
	}
};
