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
		createError: 'CV belum bisa dibuat. Coba pilih lagi.',
		quizTitle: 'Belum yakin? Coba kuis singkat.',
		quizDescription: 'Dua pertanyaan ini membantu memilih jenis CV. Kamu tetap bebas memilih.',
		quizApplication: 'Bagaimana kamu akan mengirim lamaran?',
		quizOnline: 'Portal online, perusahaan besar, atau BUMN',
		quizDirect: 'Langsung ke perekrut / portofolio',
		quizCreative: 'Apakah kamu melamar di bidang desain atau kreatif?',
		quizUnanswered: 'Pilih jawaban',
		quizYes: 'Ya, bidang kreatif',
		quizNo: 'Bidang lainnya',
		quizOptional: 'Kuis ini opsional. Kamu juga bisa langsung memilih di bawah.',
		quizResult: 'Rekomendasi untukmu: {type}. Pilihan akhir tetap di tanganmu.',
		recommended: 'Direkomendasikan',
		chooseAts: 'Pilih CV ATS',
		chooseCreative: 'Pilih CV Creative',
		back: 'Kembali',
		next: 'Lanjut',
		skip: 'Lewati',
		finish: 'Selesaikan CV',
		undo: 'Urungkan',
		redo: 'Ulangi',
		tips: 'Tips untuk langkah ini',
		examples: 'Contoh untuk inspirasi',
		useExample: 'Pakai contoh',
		useSummary: 'Pakai sebagai awal',
		actionVerbs: 'Kata kerja untuk inspirasi',
		replaceTitle: 'Ganti ringkasanmu dengan contoh?',
		replaceDescription:
			'Ringkasan yang sudah kamu tulis akan diganti. Kamu bisa mengurungkannya setelah itu.',
		replace: 'Ganti ringkasan',
		reviewReady: 'CV siap',
		reviewIssues: 'Ada bagian yang perlu dilengkapi',
		reviewInstruction: 'Pilih catatan di bawah untuk langsung memperbaiki isian terkait.',
		issueContext: '{section} — {field}: {message}',
		editAgain: 'Ubah lagi',
		optional: 'Opsional',
		saved: 'Tersimpan di perangkat ini ✓',
		savedMemory: 'Tersimpan sementara di tab ini',
		saving: 'Menyimpan…',
		saveError: 'Perubahan belum tersimpan. Coba simpan lagi.',
		retry: 'Coba lagi',
		externalUpdated: 'CV ini diubah di tab lain.',
		externalRemoved: 'CV ini sudah dihapus di tab lain.',
		reload: 'Muat versi terbaru',
		keepLocal: 'Pakai versi ini',
		notFound: 'CV tidak ditemukan',
		notFoundDescription:
			'CV ini mungkin sudah dihapus, atau tersimpan di browser atau perangkat lain.',
		startNew: 'Buat CV baru',
		memoryWarning:
			'Penyimpanan perangkat tidak tersedia. Data hanya tersimpan sementara dan akan hilang setelah tab ditutup.',
		photoRemove: 'Hapus foto',
		photoAlt: 'Foto profil CV',
		photoBusy: 'Memproses foto…',
		photoFailed: 'Foto belum bisa disimpan. Silakan coba lagi.',
		photoMissing: 'Foto tidak ditemukan di perangkat ini. Pilih foto lagi.',
		atsPhotoHint: 'CV ATS tidak memakai foto agar isi lebih mudah dibaca sistem rekrutmen.',
		loading: 'Menyiapkan panduan…',
		loadError: 'Panduan belum bisa dimuat. Periksa koneksi lalu coba lagi.',
		previewNotice:
			'Preview saat ini memakai ATS Klasik untuk kedua jenis CV. Pilihan desain Creative akan hadir pada tahap template berikutnya.',
		doneAvailability:
			'Isi CV-mu sudah tersimpan. Pilihan template, unduhan, dan editor lengkap akan hadir di tahap berikutnya.',
		addSkill: 'Tambah',
		removeSkill: 'Hapus {skill}',
		skillsLimit: 'Maksimal {max} keahlian per kelompok.',
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
			start: 'Tanggal mulai',
			end: 'Tanggal selesai',
			thesisTitle: 'Judul skripsi / tugas akhir',
			highlights: 'Sorotan pendidikan',
			type: 'Jenis pengalaman',
			role: 'Posisi / peran',
			company: 'Perusahaan / tempat kerja',
			location: 'Lokasi',
			bullets: 'Kontribusi dan pencapaian',
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
				description: 'Pilih jenis CV sesuai cara melamar dan posisi yang kamu tuju.'
			},
			target: {
				short: 'Arah',
				title: 'Arah kariermu',
				description:
					'Mulai dari bahasa CV dan posisi yang kamu incar. Beri judul agar mudah ditemukan lagi.'
			},
			personal: {
				short: 'Data diri',
				title: 'Data diri',
				description: 'Bantu perekrut mengenal dan menghubungimu. Cukup isi informasi yang relevan.'
			},
			education: {
				short: 'Pendidikan',
				title: 'Pendidikan',
				description:
					'Ceritakan latar pendidikanmu. Tugas akhir, mata kuliah, dan beasiswa juga bisa menunjukkan kemampuanmu.'
			},
			experience: {
				short: 'Pengalaman',
				title: 'Pengalaman kerja / magang',
				description:
					'Magang, kerja paruh waktu, dan freelance juga berarti. Belum ada? Kamu boleh melewati langkah ini.'
			},
			organizations: {
				short: 'Organisasi',
				title: 'Organisasi & kepanitiaan',
				description: 'Tunjukkan peran dan kontribusimu saat bekerja bersama orang lain.'
			},
			projects: {
				short: 'Proyek',
				title: 'Proyek',
				description: 'Proyek kuliah, tugas akhir, dan karya pribadi bisa menjadi bukti kemampuanmu.'
			},
			skills: {
				short: 'Keahlian',
				title: 'Keahlian & pencapaian',
				description:
					'Tambahkan keahlian, bahasa, sertifikasi, atau prestasi yang relevan dengan posisi tujuan.'
			},
			summary: {
				short: 'Ringkasan',
				title: 'Ringkasan profil',
				description:
					'Tulis 2–4 kalimat tentang pendidikan, keahlian, dan posisi yang kamu tuju. Gunakan contoh jika diperlukan.'
			},
			review: {
				short: 'Tinjau',
				title: 'Tinjau CV-mu',
				description:
					'Periksa isi, ejaan, dan kontakmu. Preview menampilkan informasi yang akan dibaca perekrut.'
			},
			done: {
				short: 'Selesai',
				title: 'Selamat, CV-mu sudah tersusun!',
				description: 'Isian CV sudah selesai. Kamu bisa meninjau dan memperbaiki isinya dari sini.'
			}
		}
	},
	preview: {
		empty: 'Mulai isi data diri untuk melihat CV-mu terbentuk di sini.',
		label: 'Preview CV',
		loading: 'Menyiapkan preview…',
		caption: 'ATS Klasik · A4',
		open: 'Lihat Preview',
		error: 'Preview belum bisa dimuat.',
		retry: 'Muat ulang preview'
	}
};
