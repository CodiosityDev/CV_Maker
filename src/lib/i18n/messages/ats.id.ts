/**
 * Namespace 'ats' — core-owned messages (Bahasa Indonesia): ATS checker (one key per CheckId) and AI
 * assist errors (`ai.errors.<AiErrorCode>`).
 * Plain text only. Every key here must also exist in ats.en.ts.
 */
export const atsId = {
	ats: {
		levels: {
			error: 'Wajib diperbaiki',
			warn: 'Sebaiknya diperbaiki',
			tip: 'Saran'
		},
		grades: {
			good: 'Siap dikirim',
			ok: 'Cukup baik',
			needsWork: 'Perlu diperbaiki'
		},
		checks: {
			missingName: 'Nama lengkap belum diisi.',
			missingEmail: 'Email belum diisi. Perekrut perlu cara menghubungimu.',
			invalidEmail: 'Format email belum benar.',
			missingPhone: 'Nomor HP belum diisi.',
			invalidPhone: 'Nomor HP belum valid.',
			missingEducation: 'Tambahkan minimal satu riwayat pendidikan.',
			noExperience:
				'Belum ada pengalaman, organisasi, atau proyek. Isi salah satunya agar CV tidak terlihat kosong.',
			noSkills: 'Belum ada keahlian. Sistem ATS sering mencari kata kunci keahlian.',
			missingSummary: 'Ringkasan profil belum diisi.',
			longSummary: 'Ringkasan terlalu panjang. Cukup 2–4 kalimat.',
			missingDates: 'Tanggal di "{item}" belum lengkap.',
			invalidLink: 'Tautan "{item}" tidak valid dan tidak akan ditampilkan di CV.',
			unprofessionalEmail: 'Email terlihat kurang profesional. Pakai email yang berisi namamu.',
			creativeForAts:
				'CV Creative kurang cocok untuk portal lowongan. Pakai CV ATS untuk melamar online.',
			itemWithoutBullets: '"{item}" belum punya poin. Tulis apa yang kamu kerjakan atau capai.',
			tooLong: 'CV diperkirakan {pages} halaman. Untuk fresh graduate, usahakan 1 halaman.',
			shortSummary:
				'Ringkasan terlalu singkat. Tambahkan keahlian utama dan posisi yang kamu tuju.',
			missingHeadline: 'Tambahkan headline singkat, misalnya "Fresh Graduate Akuntansi".',
			bulletNoVerb:
				'{count} poin di "{item}" belum diawali kata kerja (misalnya Mengelola, Membuat).',
			fewNumbers:
				'Sedikit poin yang memakai angka. Tambahkan hasil terukur bila bisa (jumlah, persen, waktu).',
			bulletTooLong:
				'{count} poin di "{item}" terlalu panjang. Pecah jadi poin yang lebih singkat.',
			bulletTooShort:
				'{count} poin di "{item}" terlalu singkat. Jelaskan apa yang kamu lakukan dan hasilnya.',
			firstPerson:
				'{count} poin di "{item}" memakai kata "saya/aku". Langsung mulai dengan kata kerja.',
			duplicateBullet: 'Ada {count} poin yang sama persis. Hapus atau ubah salah satunya.',
			fewSkills: 'Baru {count} keahlian. Tambahkan sampai 5–10 yang relevan.'
		}
	},
	ai: {
		errors: {
			quota: 'Jatah bantuan AI hari ini sudah habis. Coba lagi besok setelah pukul 00.00 WIB.',
			busy: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
			offline: 'Tidak ada koneksi internet. Bantuan AI butuh internet; CV-mu tetap tersimpan.',
			unavailable: 'Bantuan AI sedang tidak tersedia. Coba lagi nanti.',
			invalid: 'Permintaan tidak bisa diproses. Muat ulang halaman lalu coba lagi.',
			failed: 'AI belum bisa memberi saran kali ini. Jatahmu tidak berkurang; coba lagi.'
		}
	}
};
