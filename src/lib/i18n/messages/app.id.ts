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
		otherExamples: 'Contoh bidang lain',
		recommendations: {
			forRole: 'Disarankan untuk {targetRole}',
			emptyTarget: 'Isi posisi tujuan untuk melihat saran yang lebih sesuai.',
			targetAction: 'Isi posisi tujuan',
			popularSoft: 'Soft skill populer',
			added: '{skill} ditambahkan.'
		},
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
		goDashboard: 'Ke CV Saya',
		allCvs: 'Lihat semua CV',
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
				description: 'Unduh CV untuk melamar, atau kembali untuk memperbaiki isinya.'
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
	},
	exportPanel: {
		title: 'Unduh CV',
		pdf: 'PDF untuk melamar',
		pdfHint: 'Buka halaman cetak, lalu pilih Simpan sebagai PDF.',
		pdfAtsHint: 'PDF ini berisi teks asli sehingga terbaca ATS.',
		docx: 'Word (.docx)',
		docxHint: 'Untuk portal kerja yang meminta file Word.',
		txt: 'Teks (.txt)',
		txtHint: 'Unduh isi CV sebagai teks polos.',
		copy: 'Salin teks',
		copyHint: 'Untuk ditempel ke formulir portal kerja.',
		preparing: 'Menyiapkan…',
		copying: 'Menyalin…',
		downloadError: 'File belum bisa disiapkan. Coba unduh lagi.',
		navigationError: 'Perubahan belum tersimpan. Coba lagi sebelum membuka halaman lain.',
		copied: 'Teks disalin',
		manualLabel: 'Teks CV untuk disalin',
		manualHint:
			'Browser belum mengizinkan penyalinan otomatis. Pilih teks di bawah, lalu salin lewat menu perangkatmu.',
		selectText: 'Pilih semua teks',
		backupReminder: 'Simpan backup secara berkala agar isi CV tetap aman.',
		backupLink: 'Backup di CV Saya'
	},
	printPage: {
		title: 'Simpan CV sebagai PDF',
		back: 'Kembali ke CV Saya',
		savePdf: 'Simpan sebagai PDF',
		guideTitle: 'Cara menyimpan sebagai PDF',
		android: 'Android · Chrome',
		androidGuide:
			'Buka menu ⋮ → Bagikan → Cetak. Pilih “Simpan sebagai PDF”, lalu simpan file ke perangkat.',
		iphone: 'iPhone · Safari',
		iphoneGuide:
			'Ketuk Bagikan → Cetak. Cubit ke luar atau perbesar pratinjau, lalu pilih Bagikan → Simpan ke File.',
		desktop: 'Komputer',
		desktopGuide:
			'Pilih tujuan “Simpan sebagai PDF” dan kertas A4. Matikan “Header dan footer” agar alamat halaman tidak ikut tercetak. Gunakan margin Default atau Tidak ada.',
		loading: 'Menyiapkan halaman cetak…',
		loadError: 'Halaman cetak belum bisa dimuat. Coba lagi.',
		retry: 'Muat ulang halaman cetak',
		printError: 'Menu cetak belum bisa dibuka. Coba lagi dari browser ini.',
		notFound: 'CV tidak ditemukan',
		notFoundDescription:
			'CV ini tidak ada di browser ini atau sudah dihapus. Buka CV Saya untuk memilih CV lain.'
	},
	dashboard: {
		pageTitle: 'CV Saya — CV Maker',
		title: 'CV Saya',
		localNote:
			'CV kamu hanya tersimpan di browser ini. Jika data browser dihapus, CV ikut hilang. Simpan backup secara berkala.',
		memoryWarning:
			'Browser ini hanya menyimpan CV sementara. Data akan hilang saat tab ditutup. Unduh CV dan simpan backup sebelum menutup tab.',
		loading: 'Memuat CV di perangkat ini…',
		loadError: 'Daftar CV belum bisa dimuat. Coba lagi.',
		retry: 'Muat ulang',
		create: 'Buat CV',
		empty: 'Belum ada CV di browser ini. Buat CV pertamamu atau pulihkan file backup.',
		untitled: 'CV tanpa judul',
		nameMissing: 'Nama belum diisi',
		roleMissing: 'Posisi tujuan belum diisi',
		updatedAt: 'Diubah',
		unfinished: 'Belum selesai',
		unfinishedDownload:
			'CV ini belum selesai diisi. Kamu tetap bisa mengunduhnya dan melanjutkan pengisian nanti.',
		kindAts: 'CV ATS',
		kindCreative: 'CV Creative',
		continue: 'Lanjutkan',
		edit: 'Ubah',
		download: 'Unduh',
		more: 'Aksi lain untuk {title}',
		duplicate: 'Duplikat',
		duplicated: 'Salinan CV dibuat.',
		rename: 'Ganti nama',
		renameTitle: 'Ganti nama CV',
		titleLabel: 'Judul CV',
		titleRequired: 'Isi judul CV terlebih dahulu.',
		renamed: 'Judul CV disimpan.',
		backupOne: 'Backup CV ini',
		delete: 'Hapus',
		deleteTitle: 'Hapus CV ini?',
		deleteDescription:
			'CV “{title}” akan dihapus permanen dari browser ini. Tindakan ini tidak bisa diurungkan. Simpan backup terlebih dahulu bila masih diperlukan.',
		deleted: 'CV dihapus dari perangkat ini.',
		actionError: 'Tindakan belum berhasil. Coba lagi.',
		missing: 'CV ini sudah tidak ada. Daftar CV telah diperbarui.',
		backupTitle: 'Backup & pulihkan CV',
		backupDescription:
			'Simpan file JSON sebagai cadangan atau untuk memindahkan CV ke browser lain. File ini mencakup isi CV dan foto.',
		backupAll: 'Backup semua CV',
		restore: 'Pulihkan dari backup',
		restoring: 'Memulihkan…',
		backupError: 'Backup belum bisa diunduh. Coba lagi.',
		restoreImported: '{count} CV dipulihkan',
		restoreCopied: '{count} sebagai salinan',
		restoreSkipped: '{count} dilewati',
		restoreEmpty: 'File backup ini tidak berisi CV.',
		restoreErrors: {
			tooLarge: 'File backup terlalu besar. Ukuran maksimal 5 MB.',
			invalidJson: 'File ini bukan JSON yang bisa dibaca. Pilih file backup berformat .json.',
			notBackup: 'File ini bukan file backup CV Maker.',
			newerVersion:
				'Backup ini dibuat dengan versi aplikasi yang lebih baru. Perbarui aplikasi sebelum memulihkannya.'
		},
		wipeTitle: 'Selesai memakai perangkat bersama?',
		wipeDescription:
			'Hapus semua CV, foto, dan preferensi di browser ini. Simpan backup lebih dulu jika masih diperlukan.',
		wipeAction: 'Hapus semua data di perangkat ini',
		wipeConfirmTitle: 'Hapus semua data?',
		wipeConfirmDescription:
			'Semua CV, foto, dan preferensi akan dihapus permanen dari browser ini. File backup yang sudah kamu unduh tetap ada. Tindakan ini tidak bisa diurungkan.',
		wipeWord: 'HAPUS',
		wipeInput: 'Ketik {word} untuk melanjutkan.',
		wipeInputLabel: 'Kata konfirmasi',
		wipeDone: 'Semua data CV di perangkat ini dihapus.'
	}
};
