/**
 * Namespace 'ats' — core-owned messages (Bahasa Indonesia): ATS checker (one key per CheckId), cover
 * letter labels and checks (`letter.*`), and AI
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
		concise: {
			levels: {
				ok: 'Ringkas',
				wordy: 'Agak bertele-tele',
				veryWordy: 'Bertele-tele'
			},
			issues: {
				filler: 'Ada kata yang tidak menambah informasi, misalnya "{fillers}".',
				tooLong: 'Terlalu panjang ({words} kata). Usahakan satu poin paling banyak 2 baris.',
				multipleIdeas: 'Berisi lebih dari satu hal. Pecah jadi beberapa poin.',
				repetition: 'Ada kata yang diulang. Cukup sebut sekali.',
				vague: 'Masih umum. Sebutkan hasil, alat, atau jumlah yang nyata.',
				indirect: 'Kalimatnya berputar-putar. Mulai langsung dengan kata kerja aktif.'
			}
		},
		convert: {
			notes: {
				monthGuessed:
					'{count} tanggal hanya berisi tahun, jadi bulannya diisi Januari. Periksa dan perbaiki bulannya.',
				missingName: 'Nama lengkap tidak ditemukan. Isi di bagian Data diri.',
				missingContact: 'Email dan nomor HP tidak ditemukan. Isi agar perekrut bisa menghubungimu.',
				notParsed:
					'{count} baris tidak bisa ditempatkan otomatis. Salin ke bagian yang sesuai bila masih diperlukan.'
			}
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
	},
	letter: {
		sources: {
			jobPortal: 'Portal lowongan kerja',
			companySite: 'Situs web perusahaan',
			socialMedia: 'Media sosial',
			campus: 'Kampus / pusat karier',
			referral: 'Rekomendasi seseorang',
			jobFair: 'Bursa kerja',
			other: 'Lainnya'
		},
		attachments: {
			cv: 'CV',
			diploma: 'Ijazah',
			transcript: 'Transkrip nilai',
			idCard: 'KTP',
			photo: 'Pas foto',
			certificates: 'Sertifikat',
			portfolio: 'Portofolio',
			skck: 'SKCK',
			health: 'Surat keterangan sehat',
			reference: 'Surat rekomendasi'
		},
		highlightSections: {
			experience: 'Pengalaman kerja',
			organizations: 'Organisasi',
			projects: 'Proyek',
			certifications: 'Sertifikasi',
			awards: 'Prestasi',
			skills: 'Keahlian'
		},
		skillGroups: {
			hard: 'Keahlian teknis',
			tools: 'Alat & software',
			soft: 'Soft skills'
		},
		blocks: {
			opening: 'Pembuka',
			identity: 'Data diri',
			qualifications: 'Kualifikasi',
			motivation: 'Motivasi',
			attachments: 'Lampiran',
			contact: 'Kontak',
			closing: 'Penutup'
		},
		fonts: {
			times: 'Times New Roman',
			arial: 'Arial',
			calibri: 'Calibri',
			georgia: 'Georgia'
		},
		aligns: {
			left: 'Rata kiri',
			justify: 'Rata kiri-kanan'
		},
		checks: {
			positionMissing: 'Isi posisi yang dilamar.',
			companyMissing: 'Isi nama perusahaan.',
			nameMissing: 'Nama lengkap di CV masih kosong. Isi dulu di CV.',
			contactMissing: 'Telepon dan email di CV masih kosong. Perusahaan perlu cara menghubungimu.',
			cvIncomplete:
				'CV belum berisi pendidikan atau pengalaman. Lengkapi CV agar surat lebih kuat.',
			noHighlights: 'Pilih 1–3 hal dari CV yang mau ditonjolkan.',
			motivationMissing:
				'Tambahkan alasan tertarik dengan perusahaan ini agar surat tidak terasa umum.',
			motivationGeneric:
				'Alasanmu belum menyebut perusahaannya. Sebut satu hal spesifik tentang mereka.',
			identityIncomplete: 'Data diri belum lengkap: tempat lahir, tanggal lahir, atau alamat.',
			placeholder:
				'Masih ada teks dalam kurung siku, misalnya [isi angka]. Ganti dengan isi yang benar.',
			tooLong: 'Surat lebih dari 1 halaman. Persingkat atau pakai cek bertele-tele.',
			dateOld: 'Tanggal surat sudah lebih dari 30 hari yang lalu. Perbarui tanggalnya.'
		},
		concise: {
			issues: {
				filler: 'Ada kata yang tidak menambah informasi, misalnya "{fillers}".',
				tooLong: 'Paragraf terlalu panjang ({words} kata). Usahakan paling banyak 3–4 kalimat.',
				multipleIdeas: 'Berisi terlalu banyak hal. Fokus pada satu gagasan per paragraf.',
				repetition: 'Ada kata yang diulang. Cukup sebut sekali.',
				vague: 'Masih umum. Sebutkan hasil, alat, atau pengalaman yang nyata.',
				indirect: 'Kalimatnya berputar-putar. Tulis langsung dengan kalimat aktif.'
			}
		}
	}
};
