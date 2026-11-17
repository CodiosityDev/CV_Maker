/** Shared CV page (/u/<slug>) — English (lazy-loaded). */
import type { ViewerMessages } from '../translate';

export const viewerEn: ViewerMessages = {
	viewer: {
		pageTitle: '{name} CV — CV Maker',
		pageTitleFallback: 'Shared CV — CV Maker',
		loading: 'Opening CV…',
		notFoundTitle: 'Link not available',
		notFound:
			'This link has expired, was stopped by its owner, or is mistyped. Ask the CV owner for a current link.',
		passwordTitle: 'This CV is password-protected',
		passwordIntro: 'Enter the password from the CV owner.',
		passwordLabel: 'Password',
		open: 'Open CV',
		wrongPassword: 'Wrong password.',
		error: 'The CV could not be loaded. Try again.',
		busy: 'Too many attempts. Try again later.',
		offline: 'You are offline.',
		retry: 'Try again',
		download: 'Download PDF',
		makeYourOwn: 'Create your own CV',
		sharedVia: 'Shared with',
		report: 'Report',
		reportTitle: 'Report this CV',
		reportIntro: 'Reports are reviewed by the site team. Your identity is not sent.',
		reportReason: 'Reason',
		reasons: {
			spam: 'Spam or advertising',
			impersonation: 'Uses someone else’s identity',
			offensive: 'Abusive or inappropriate content',
			'personal-data': 'My personal data without consent',
			other: 'Other'
		},
		reportSend: 'Send report',
		reportCancel: 'Cancel',
		reported: 'Thank you, the report was sent.',
		reportFailed: 'The report was not sent. Try again.'
	}
};
