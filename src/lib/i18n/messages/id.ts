/**
 * Source dictionary (Bahasa Indonesia). This file defines the SHAPE of all messages:
 * every key added here must also be added to `en.ts` (TypeScript enforces it).
 *
 * Rules:
 * - Plain text only (no HTML). Interpolate with `{name}` placeholders.
 * - Group keys by feature: `app`, `common`, `a11y`, `nav`, `landing`, `wizard`, ...
 */
export const id = {
	app: {
		name: 'CV Maker',
		tagline: 'Buat CV ATS atau kreatif secara gratis, khusus untuk fresh graduate.'
	},
	common: {
		next: 'Lanjut',
		back: 'Kembali',
		skip: 'Lewati',
		save: 'Simpan',
		cancel: 'Batal',
		close: 'Tutup',
		delete: 'Hapus',
		add: 'Tambah',
		edit: 'Ubah',
		confirm: 'Konfirmasi',
		loading: 'Memuat…',
		present: 'Sekarang'
	},
	a11y: {
		skipToContent: 'Lewati ke konten utama'
	},
	locale: {
		label: 'Bahasa',
		id: 'Bahasa Indonesia',
		en: 'English'
	}
};
