/** Site content — English (lazy-loaded). */
import type { SiteMessages } from '../translate';

export const siteEn: SiteMessages = {
	landing: {
		title: 'CV Maker — Create a free CV for your first job application',
		description:
			'Build an ATS or Creative CV with guidance for fresh graduates. Free, no sign-up, and your data stays on your device.',
		headline: 'Create a CV for your first job application.',
		intro: 'Free, no sign-up. Choose an ATS or Creative CV, then follow the guidance.',
		visitor: 'visitor',
		visitors: 'visitors',
		visitorCount: '{count} visitor',
		visitorsCount: '{count} visitors',
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
		privacyCopy:
			'Your CV is stored in your browser. Content is only sent to an AI provider if you choose AI assistance and agree.',
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
			'CV data is stored in your browser and does not automatically move to another device. If you choose AI assistance and agree, some content is sent for AI processing.',
		deletedQuestion: 'What if my browser data is erased?',
		deletedAnswer:
			'CVs stored in that browser will be lost. Download PDF/Word files for your records before clearing browser data.',
		incognitoQuestion: 'I use a public or shared computer. Is it safe?',
		incognitoAnswer:
			'On the Create CV page, use the Incognito button at the top to turn on Incognito Mode before creating a CV. Its content stays only in this tab and disappears when the tab is closed, refreshed, or left unchanged for 3 hours. For maximum privacy, also open an incognito/private browser window (Ctrl+Shift+N / ⌘+Shift+N). Download your CV before finishing, delete the files from the Downloads folder, choose End & erase, then close the tab. Do not save passwords or accounts in the browser.',
		mobileQuestion: 'Can I use it on my phone?',
		mobileAnswer: 'Yes, directly in your phone, tablet, or computer browser.',
		englishQuestion: 'Is English available?',
		englishAnswer: 'Yes. Choose ID or EN for the interface; choose the CV language separately.',
		makerQuestion: 'Who makes CV Maker?',
		aiQuestion: 'What is sent when I use AI assistance?',
		aiAnswer:
			'Only after you agree: target role, education, experience, organisations, projects, skills, certifications, and summary. Your name, email, phone, city, links, and photo are not sent. CV content is not stored on the server.',
		aiQuotaQuestion: 'How many AI uses do I get?',
		aiQuotaAnswer:
			'You get 3 free uses per device per day, resetting at 00:00 WIB. When no uses remain and ads are available, you can choose an ad in a separate tab for 1 extra use, up to 10 ads a day.',
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
			'CV Maker pages do not include third-party trackers. Fonts are served by this site. CV content is sent only if you agree to AI assistance.',
		aiTitle: 'AI assistance',
		aiCopy:
			'AI assistance is optional and only runs after you click its button and agree. Your target role, education and grades, experience, organisations, projects, skills, certifications, summary, and CV language go through the CV Maker server to a third-party AI provider. Your name, email, phone, city, links, and photo are not sent. CV content is not stored on the server. Anonymous usage counters are kept for 7 days.',
		adsTitle: 'Advertising',
		adsCopy:
			'An ad only opens in a separate tab at iklan.codiosity.com when you choose to watch one for an extra AI use. Google Ad Manager supplies non-personalised ads. The ad page cannot see your CV content. CV Maker pages do not load ad scripts.',
		visitorsCopy:
			'To count visitors, your browser stores a random ID without your name or CV data and without cookies. The server counter stores only hashes of the ID and IP address, never the original ID or IP address. The browser ID is removed when you choose Delete all data. In Incognito Mode, the ID stays only in tab memory and is not saved in browser storage.',
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
			'On a shared computer, open the Create CV page and use the Incognito button at the top before creating your CV. Data stays only in this tab, disappears when the tab is closed or refreshed, and is erased automatically after 3 hours without changes. Download your CV before finishing, delete the files from the Downloads folder, choose End & erase, then close the tab. Do not save passwords or accounts in the browser.',
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
