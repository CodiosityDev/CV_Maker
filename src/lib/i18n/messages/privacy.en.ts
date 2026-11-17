/** Privacy page — English (lazy-loaded). */
import type { PrivacyMessages } from '../translate';

export const privacyEn: PrivacyMessages = {
	privacy: {
		backupTitle: 'Backups in Google Drive (accounts only)',
		backupCopy:
			'The CV Maker server only stores the CVs you share (at most 3). Other CVs are never backed up to the server. If you sign in and connect Google Drive, a backup file of all your CVs (including cover letters and photos) is saved in your own Drive, automatically after changes unless you turn that off.',
		driveCopy:
			'CV Maker only asks for access to files it creates and cannot read anything else in your Drive. The access token is stored encrypted, the backup file only passes through the server on its way, and you can disconnect at any time.',
		accountTitle: 'Account (optional)',
		accountCopy:
			'You only need an account to share a CV by link. The server stores your email, your name (if given), a password hash (never the password) or your Google account ID, and login sessions as hashes. Google sign-in only asks for your name and email. Your email is only used to confirm it and to reset your password. Sessions use one essential HttpOnly cookie that is only sent to this site.',
		shareTitle: 'Shared CVs',
		shareCopy:
			'When you press Save & share, a copy of that CV is stored on the CV Maker server as you chose: phone, email, city and photo are only included if you turn them on, and cover letters are never included. You choose who can see it (private, anyone with the link, or public) and can add a password or an expiry date. Links that are not public are marked so search engines do not index them. The server counts views without storing visitors’ IP addresses. Reports from visitors are stored without the reporter’s identity.',
		accountDeleteCopy:
			'You can stop sharing or delete the copy from the server at any time, and permanently delete your account with all its links on the Account page. CVs on your device are kept.',
		convertCopy:
			'Converting to an ATS CV without AI runs on your device. If you choose Improve with AI and agree, text without names, contact details, links, and addresses is sent through the CV Maker server to the AI provider. The converted result stays in server memory for up to 2 minutes after it is ready for your browser to retrieve, without being stored in a database. The new CV is saved on your device only when you choose Save & open editor.',
		scanTitle: 'ATS Check',
		scanCopy:
			'CV files are read on your device, are not sent to a server, and are not stored. Only when you choose Ask AI for feedback and agree is CV text without names, contact details, links, or addresses sent through the CV Maker server to the AI provider. The text is not stored.',
		title: 'Privacy — CV Maker',
		description:
			'How CV Maker stores data on your device and how to delete it through browser settings.',
		heading: 'CV data privacy',
		intro: 'CV data and photos are stored in the browser on the device you use.',
		storageTitle: 'Stored in your browser, account optional',
		storageCopy:
			'CV data and your language preference are stored in your browser. Every feature works without an account, and CVs are not synced between devices.',
		trackingTitle: 'No third-party trackers',
		trackingCopy:
			'CV Maker pages do not include third-party trackers. Fonts are served by this site. CV content is sent only if you agree to AI assistance or choose to share a CV.',
		aiTitle: 'AI assistance',
		aiCopy:
			'AI assistance is optional and only runs after you click its button and agree. Your target role, education and grades, experience, organisations, projects, skills, certifications, summary, and CV language go through the CV Maker server to a third-party AI provider. Your name, email, phone, city, links, and photo are not sent. CV content is not stored on the server. Anonymous usage counters are kept for 7 days.',
		adsTitle: 'Advertising',
		adsCopy:
			'Small banner ads appear only at the bottom of the home page and on the FAQ and About pages. They load from iklan.codiosity.com inside a separate frame, so ad scripts cannot read CV Maker pages. The editor, Create CV, ATS Check, print pages and shared CVs never show ads. Ads for extra AI uses only open in a separate tab if you choose to watch one. Ads are supplied by Google Ad Manager and are not personalised.',
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
	}
};
