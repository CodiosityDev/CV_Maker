/**
 * Namespace 'app' (wizard, preview, editor) — Bahasa Indonesia. Loaded only by (app) pages.
 * Plain text only. Every key here must also exist in the other language file.
 */
export const appId = {
	wizard: {
		pageTitle: 'Buat CV — CV Maker',
		localNote: 'Tanpa akun. Isi CV tetap di perangkatmu.',
		resumeTitle: 'Lanjutkan CV yang belum selesai',
		resume: 'Lanjutkan',
		untitled: 'CV tanpa judul',
		updatedAt: 'Terakhir diubah:',
		createError: 'CV belum bisa dibuat. Coba lagi.',
		quizTitle: 'Belum yakin pilih yang mana?',
		quizDescription: 'Jawab dua pertanyaan untuk mendapat saran.',
		quizApplication: 'Bagaimana kamu akan mengirim lamaran?',
		quizOnline: 'Portal online, perusahaan besar, atau BUMN',
		quizDirect: 'Langsung ke perekrut / portofolio',
		quizCreative: 'Apakah kamu melamar di bidang desain atau kreatif?',
		quizUnanswered: 'Pilih jawaban',
		quizYes: 'Ya, bidang kreatif',
		quizNo: 'Bidang lainnya',
		quizOptional: 'Boleh langsung pilih jenis CV di bawah.',
		quizResult: 'Saran: {type}. Kamu boleh memilih yang lain.',
		recommended: 'Direkomendasikan',
		chooseAts: 'Pilih CV ATS',
		chooseCreative: 'Pilih CV Creative',
		back: 'Kembali',
		next: 'Lanjut',
		skip: 'Lewati',
		finish: 'Selesai',
		undo: 'Urungkan',
		redo: 'Ulangi',
		tips: 'Tips',
		examples: 'Contoh',
		useExample: 'Pakai contoh',
		useSummary: 'Pakai contoh',
		actionVerbs: 'Pilihan kata kerja',
		replaceTitle: 'Ganti ringkasanmu dengan contoh?',
		replaceDescription: 'Ringkasan lama akan diganti. Bisa diurungkan.',
		replace: 'Ganti ringkasan',
		reviewReady: 'CV siap',
		reviewIssues: 'Ada bagian yang perlu dilengkapi',
		reviewInstruction: 'Klik catatan untuk memperbaiki isian.',
		issueContext: '{section} — {field}: {message}',
		editAgain: 'Ubah lagi',
		optional: 'Opsional',
		saved: 'Tersimpan ✓',
		savedMemory: 'Tersimpan sementara',
		saving: 'Menyimpan…',
		saveError: 'Perubahan belum tersimpan. Coba simpan lagi.',
		retry: 'Coba lagi',
		externalUpdated: 'CV ini diubah di tab lain.',
		externalRemoved: 'CV ini sudah dihapus di tab lain.',
		reload: 'Muat versi terbaru',
		keepLocal: 'Pakai versi ini',
		notFound: 'CV tidak ditemukan',
		notFoundDescription: 'Coba buka browser atau perangkat tempat kamu membuatnya.',
		startNew: 'Buat CV baru',
		memoryWarning: 'Data akan hilang saat tab ditutup karena browser tidak bisa menyimpannya.',
		photoRemove: 'Hapus foto',
		photoAlt: 'Foto profil CV',
		photoBusy: 'Memproses foto…',
		photoFailed: 'Foto belum tersimpan. Coba lagi.',
		photoMissing: 'Foto tidak ditemukan di perangkat ini. Pilih foto lagi.',
		atsPhotoHint: 'Foto tidak ditampilkan pada CV ATS.',
		loading: 'Menyiapkan panduan…',
		loadError: 'Panduan belum bisa dimuat. Periksa koneksi lalu coba lagi.',
		previewNotice: 'Preview memakai ATS Klasik. Desain Creative belum tersedia.',
		doneAvailability: 'Template lain, unduhan, dan editor belum tersedia.',
		addSkill: 'Tambah',
		removeSkill: 'Hapus {skill}',
		skillsLimit: 'Maksimal {max} keahlian per kelompok.',
		hints: {
			gpa: 'Contoh: 3.65 dari 4.00.',
			photo: 'Pilih foto formal berlatar polos.'
		},
		newItems: {
			education: 'Pendidikan baru',
			experience: 'Pengalaman baru',
			organizations: 'Organisasi baru',
			projects: 'Proyek baru',
			languages: 'Bahasa baru',
			certifications: 'Sertifikasi baru',
			awards: 'Prestasi baru',
			links: 'Tautan baru'
		},
		emptyLists: {
			education: 'Tambahkan sekolah atau kampus terakhirmu.',
			experience: 'Magang atau kerja paruh waktu bisa ditulis di sini.',
			organizations: 'Tambahkan organisasi atau kepanitiaan yang pernah kamu ikuti.',
			projects: 'Tambahkan proyek kuliah atau karya pribadimu.',
			languages: 'Tambahkan bahasa yang kamu kuasai.',
			certifications: 'Tambahkan sertifikasi atau pelatihan yang relevan.',
			awards: 'Tambahkan prestasi yang mendukung lamaranmu.',
			links: 'Tambahkan LinkedIn, GitHub, atau portofoliomu.'
		},
		bullets: {
			point: 'Poin {number}',
			remove: 'Hapus poin {number}',
			actions: 'Aksi poin {number}',
			add: 'Tambah poin',
			moveUp: 'Naik',
			moveDown: 'Turun',
			moved: 'Poin {from} dipindah ke {to}.',
			removed: 'Poin {number} dihapus.',
			added: 'Poin {number} ditambahkan.',
			limit: 'Maksimal {count} poin.',
			help: 'Enter untuk poin baru. Alt + ↑ / ↓ untuk mengurutkan.',
			examples: 'Contoh — klik untuk menambah',
			pasteLimited: 'Sebagian teks tidak ditambahkan. Maksimal {count} poin.',
			empty: 'Tulis tugas atau hasil yang paling relevan.'
		},
		photoErrors: {
			'not-an-image': 'Pilih file gambar, misalnya JPEG atau PNG.',
			'too-large': 'Ukuran foto terlalu besar. Pilih file di bawah 15 MB.',
			'decode-failed': 'Gambar belum bisa dibaca. Coba foto lain.',
			'encode-failed': 'Foto belum bisa diproses. Coba gambar lain atau ukuran yang lebih kecil.'
		},
		fields: {
			title: 'Judul CV',
			locale: 'Bahasa isi CV',
			targetRole: 'Posisi yang dituju',
			fullName: 'Nama lengkap',
			headline: 'Headline singkat',
			email: 'Email',
			phone: 'Nomor HP',
			city: 'Kota / kabupaten',
			province: 'Provinsi',
			links: 'Tautan',
			label: 'Nama tautan',
			url: 'URL',
			institution: 'Nama sekolah / kampus',
			degree: 'Jenjang pendidikan',
			major: 'Jurusan',
			gpa: 'IPK',
			gpaScale: 'Skala IPK',
			start: 'Mulai',
			end: 'Selesai',
			thesisTitle: 'Judul skripsi / tugas akhir',
			highlights: 'Sorotan pendidikan',
			type: 'Jenis pengalaman',
			role: 'Posisi / peran',
			company: 'Perusahaan / tempat kerja',
			location: 'Lokasi',
			bullets: 'Apa yang kamu kerjakan & capai',
			name: 'Nama',
			hard: 'Keahlian teknis',
			soft: 'Soft skill',
			tools: 'Tools & software',
			languages: 'Bahasa',
			level: 'Tingkat kemampuan',
			score: 'Skor tes / keterangan',
			certifications: 'Sertifikasi & pelatihan',
			issuer: 'Penerbit / penyelenggara',
			date: 'Tanggal',
			credentialUrl: 'URL sertifikat',
			awards: 'Prestasi & penghargaan',
			awardTitle: 'Judul prestasi',
			description: 'Deskripsi',
			summary: 'Ringkasan profil',
			photo: 'Foto profil (opsional)'
		},
		experienceTypes: {
			internship: 'Magang',
			fulltime: 'Penuh waktu',
			parttime: 'Paruh waktu',
			freelance: 'Freelance',
			contract: 'Kontrak',
			volunteer: 'Relawan'
		},
		languageLevels: {
			native: 'Bahasa ibu',
			fluent: 'Fasih',
			professional: 'Profesional',
			intermediate: 'Menengah',
			basic: 'Dasar'
		},
		steps: {
			type: {
				short: 'Jenis',
				title: 'Pilih jenis CV-mu',
				description: 'Sesuaikan dengan cara kamu melamar.'
			},
			target: {
				short: 'Tujuan',
				title: 'Bahasa & posisi tujuan',
				description: 'Pilih bahasa CV dan posisi yang kamu incar.'
			},
			personal: {
				short: 'Data diri',
				title: 'Data diri',
				description: 'Isi kontak yang bisa dihubungi perekrut.'
			},
			education: {
				short: 'Pendidikan',
				title: 'Pendidikan',
				description: 'Tambahkan sekolah atau kampus terakhir.'
			},
			experience: {
				short: 'Pengalaman',
				title: 'Pengalaman kerja / magang',
				description: 'Isi magang, kerja paruh waktu, atau freelance.'
			},
			organizations: {
				short: 'Organisasi',
				title: 'Organisasi & kepanitiaan',
				description: 'Isi peranmu di organisasi atau kepanitiaan.'
			},
			projects: {
				short: 'Proyek',
				title: 'Proyek',
				description: 'Tambahkan proyek kuliah, tugas akhir, atau karya pribadi.'
			},
			skills: {
				short: 'Keahlian',
				title: 'Keahlian & pencapaian',
				description: 'Pilih keahlian dan pencapaian yang sesuai posisi tujuan.'
			},
			summary: {
				short: 'Ringkasan',
				title: 'Ringkasan profil',
				description: 'Tulis 2–4 kalimat tentang pendidikan dan keahlianmu.'
			},
			review: {
				short: 'Tinjau',
				title: 'Tinjau CV-mu',
				description: 'Periksa isi, ejaan, dan kontakmu di preview.'
			},
			done: {
				short: 'Selesai',
				title: 'CV-mu tersimpan',
				description: 'Kamu masih bisa kembali untuk memperbaiki isinya.'
			}
		}
	},
	preview: {
		empty: 'Isi data diri untuk melihat preview.',
		label: 'Preview CV',
		loading: 'Menyiapkan preview…',
		caption: 'ATS Klasik · A4',
		open: 'Lihat Preview',
		error: 'Preview belum bisa dimuat.',
		retry: 'Muat ulang preview'
	}
};
