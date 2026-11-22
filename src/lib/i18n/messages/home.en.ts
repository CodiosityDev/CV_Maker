/** Home page "your CVs" strip — English (lazy-loaded). */
import type { HomeMessages } from '../translate';

export const homeEn: HomeMessages = {
	homeRecent: {
		title: 'Continue your CV',
		viewAll: 'See all CVs',
		newCv: 'Create a new CV',
		untitled: 'Untitled CV',
		edited: 'Edited {time}',
		editedNow: 'Edited just now',
		unfinished: 'Not finished',
		kindAts: 'ATS',
		kindCreative: 'Creative',
		thumbnailLoading: 'Loading preview…',
		thumbnailError: 'Preview unavailable',
		hide: 'Hide from home page',
		hidden: 'Your CVs no longer appear on the home page on this device.',
		show: 'Show again',
		delete: 'Delete {title}',
		confirm: 'Delete this CV? Any link you shared for it is deleted too. This cannot be undone.',
		confirmDelete: 'Delete',
		cancel: 'Cancel',
		deleted: 'CV deleted.',
		deleteFailed: 'The CV could not be deleted. Try again.'
	},
	/** Title of the banner frame (ui/ad-banner.ts; FAQ/About load this namespace through it). */
	adFrame: {
		title: 'Advertisement'
	},
	/** "Unggah PDF untuk diedit" (ui/PdfUpload.svelte: home page, Buat CV, CV Saya). */
	pdfUpload: {
		button: 'Upload PDF to edit',
		hint: 'Only PDFs downloaded from CV Maker can be edited again.',
		busy: 'Reading the PDF…',
		done: 'The CV from your PDF was added. You can edit it now.',
		notOurs:
			'This PDF was not downloaded from CV Maker, so it cannot be edited here. For other CVs, use ATS Check → Convert to an ATS CV.',
		tooLarge: 'The PDF file is too large (20 MB at most).',
		failed: 'The PDF could not be read. Please try again.',
		cta: 'Have a PDF from CV Maker? Upload it to edit'
	}
};
