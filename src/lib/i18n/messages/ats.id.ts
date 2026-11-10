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
		scan: {
			checks: {
				imageOnly:
					'Teks di file ini tidak bisa dibaca: isinya berupa gambar atau hasil scan. ATS akan melihat CV kosong. Buat ulang CV sebagai dokumen teks.',
				missingEmail: 'Email tidak ditemukan. Perekrut perlu cara menghubungimu.',
				missingPhone: 'Nomor HP tidak ditemukan.',
				missingEducation:
					'Bagian Pendidikan tidak ditemukan. Beri judul yang jelas, misalnya "Pendidikan".',
				garbledText:
					'Sebagian teks terbaca sebagai simbol aneh atau huruf terpisah (font ikon atau spasi antarhuruf). ATS bisa salah membaca isinya.',
				multiColumn:
					'CV memakai dua kolom. Banyak ATS membaca baris demi baris sehingga isi kedua kolom tercampur. Pakai satu kolom.',
				tables: 'CV memakai tabel. Sebagian ATS melewatkan atau mengacak isi tabel.',
				textBoxes: 'CV memakai kotak teks (text box). Isinya sering dilewati ATS.',
				contactInHeaderFooter:
					'Email/nomor HP hanya ada di header atau footer halaman. Sebagian ATS tidak membacanya; pindahkan ke badan CV.',
				unclearHeadings:
					'Judul bagian tidak dikenali. Pakai judul standar seperti Pendidikan, Pengalaman, Keahlian.',
				noExperience:
					'Tidak ada bagian Pengalaman, Organisasi, atau Proyek. Isi salah satunya agar CV tidak terlihat kosong.',
				noSkills: 'Bagian Keahlian tidak ditemukan. ATS sering mencari kata kunci keahlian.',
				missingSummary: 'Ringkasan profil tidak ditemukan. Tambahkan 2–4 kalimat di bagian atas.',
				missingDates:
					'Tidak ada tahun di pendidikan atau pengalaman. Tulis periode, misalnya "2021 – 2025".',
				noBullets:
					'Pengalaman ditulis sebagai paragraf. Pecah jadi poin-poin singkat yang diawali kata kerja.',
				unprofessionalEmail: 'Email terlihat kurang profesional. Pakai email yang berisi namamu.',
				tooLong: 'CV {pages} halaman. Untuk fresh graduate, usahakan 1–2 halaman.',
				tooShort: 'CV hanya sekitar {words} kata. Tambahkan pengalaman, proyek, atau keahlian.',
				graphics:
					'Ada {count} gambar/grafik (foto, ikon, atau grafik keahlian). ATS tidak membaca gambar; pastikan infonya juga ada sebagai teks.',
				missingLinkedIn: 'Tambahkan profil LinkedIn agar perekrut bisa mengenalmu lebih jauh.',
				bulletNoVerb: '{count} poin belum diawali kata kerja (misalnya Mengelola, Membuat).',
				fewNumbers:
					'Sedikit poin yang memakai angka. Tambahkan hasil terukur bila bisa (jumlah, persen, waktu).',
				bulletTooLong: '{count} poin terlalu panjang. Pecah jadi poin yang lebih singkat.',
				firstPerson: '{count} poin memakai kata "saya/aku". Langsung mulai dengan kata kerja.'
			},
			errors: {
				unsupported:
					'Format file tidak didukung. Pakai PDF, DOCX, atau TXT (file .doc lama: simpan ulang sebagai DOCX/PDF).',
				tooLarge: 'File terlalu besar (maksimal 5 MB).',
				encrypted: 'File dilindungi password. Simpan ulang tanpa password lalu coba lagi.',
				damaged: 'File rusak atau tidak bisa dibuka.',
				empty: 'File tidak berisi teks.',
				failed: 'File tidak bisa dibaca. Coba lagi atau pakai format lain.'
			}
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
