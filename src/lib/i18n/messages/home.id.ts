/**
 * Home page "your CVs" strip — Bahasa Indonesia. Registered lazily by `ui/home/RecentCvs.svelte`
 * (only returning visitors need it), so it never weighs on the landing page's initial JS.
 */
export const homeId = {
	homeRecent: {
		title: 'Lanjutkan CV-mu',
		viewAll: 'Lihat semua CV',
		newCv: 'Buat CV baru',
		untitled: 'CV tanpa judul',
		edited: 'Diedit {time}',
		editedNow: 'Diedit baru saja',
		unfinished: 'Belum selesai',
		kindAts: 'ATS',
		kindCreative: 'Creative',
		thumbnailLoading: 'Memuat pratinjau…',
		thumbnailError: 'Pratinjau belum bisa ditampilkan',
		hide: 'Sembunyikan dari beranda',
		hidden: 'CV-mu tidak lagi tampil di beranda perangkat ini.',
		show: 'Tampilkan lagi',
		delete: 'Hapus {title}',
		confirm: 'Hapus CV ini? Link yang pernah dibagikan juga ikut dihapus. Tidak bisa dibatalkan.',
		confirmDelete: 'Hapus',
		cancel: 'Batal',
		deleted: 'CV dihapus.',
		deleteFailed: 'CV belum bisa dihapus. Coba lagi.'
	},
	/** Title of the banner frame (ui/ad-banner.ts; FAQ/About load this namespace through it). */
	adFrame: {
		title: 'Iklan'
	},
	/** "Unggah PDF untuk diedit" (ui/PdfUpload.svelte: home page, Buat CV, CV Saya). */
	pdfUpload: {
		button: 'Unggah PDF untuk diedit',
		hint: 'Hanya PDF yang diunduh dari CV Maker yang bisa diedit lagi.',
		busy: 'Membaca PDF…',
		done: 'CV dari PDF ditambahkan. Silakan edit.',
		notOurs:
			'PDF ini bukan hasil unduhan CV Maker, jadi tidak bisa diedit di sini. Untuk CV lain, pakai Cek ATS → Ubah jadi CV ATS.',
		tooLarge: 'File PDF terlalu besar (maksimal 20 MB).',
		failed: 'PDF belum bisa dibaca. Coba lagi.',
		cta: 'Sudah punya PDF dari CV Maker? Unggah untuk diedit'
	}
};
