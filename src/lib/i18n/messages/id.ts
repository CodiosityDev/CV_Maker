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
	nav: {
		label: 'Navigasi utama',
		create: 'Buat CV Gratis',
		myCvs: 'CV Saya',
		home: 'Beranda',
		about: 'Tentang',
		privacy: 'Privasi'
	},
	footer: {
		description: 'Langkah kecil untuk kesempatan yang lebih besar.',
		local: 'Dibuat untukmu. Tersimpan di perangkatmu.',
		github: 'GitHub',
		links: 'Tautan situs',
		openSource: 'Gratis & open source'
	},
	landing: {
		title: 'CV Maker — Buat CV gratis untuk langkah karier pertamamu',
		description:
			'Buat CV ATS atau Creative dengan panduan yang ramah untuk fresh graduate. Gratis, tanpa login, dan data tetap di perangkatmu.',
		eyebrow: 'DARI KAMPUS, MENUJU KESEMPATAN BARU',
		headline: 'Langkah pertama menuju kariermu.',
		headlineStart: 'Langkah pertama',
		headlineEnd: 'menuju kariermu.',
		intro:
			'Belum banyak pengalaman? Kamu tetap punya cerita. Susun pendidikan, organisasi, dan proyekmu menjadi CV yang siap melangkah.',
		start: 'Mulai buat CV',
		free: 'Gratis, tanpa daftar',
		local: 'Data tetap di perangkatmu',
		mockupLabel: 'Contoh tampilan CV',
		mockupName: 'Nama lengkapmu',
		mockupRole: 'Fresh Graduate · Bidang pilihanmu',
		mockupContact: 'Email · Telepon · Kota',
		mockupSummary: 'Profil singkat',
		mockupSummaryText: 'Ceritakan kemampuan dan arah karier yang ingin kamu tuju.',
		mockupEducation: 'Pendidikan',
		mockupUniversity: 'Universitas / sekolahmu',
		mockupDegree: 'Program studi · Tahun lulus',
		mockupExperience: 'Organisasi & proyek',
		mockupProject: 'Pengalaman yang berarti',
		mockupBullet: 'Tunjukkan kontribusi, keterampilan, dan hal yang kamu pelajari.',
		mockupSkills: 'Keahlian',
		mockupSkillText: 'Komunikasi · Analisis · Kerja tim',
		mockupTag: 'Potensimu, tersusun rapi.',
		mockupNote: 'Pengalaman kuliah juga berarti.',
		howEyebrow: 'SELANGKAH DEMI SELANGKAH',
		howTitle: 'Dari halaman kosong ke CV pertamamu.',
		howIntro: 'Tidak perlu tahu semuanya dari awal. Kita mulai dari yang kamu punya.',
		stepOne: '01',
		stepTwo: '02',
		stepThree: '03',
		chooseTitle: 'Pilih jenis CV',
		chooseCopy: 'ATS untuk portal lamaran, atau Creative untuk menonjolkan sisi visualmu.',
		fillTitle: 'Isi dengan panduan',
		fillCopy:
			'Susun ceritamu langkah demi langkah, dengan tips yang dekat dengan pengalaman fresh graduate.',
		downloadTitle: 'Unduh PDF / DOCX',
		downloadCopy: 'Pilih format sesuai kebutuhan lamaran. Simpan juga backup untuk berjaga-jaga.',
		typeEyebrow: 'SESUAIKAN DENGAN TUJUANMU',
		typeTitle: 'Satu cerita. Dua cara menyampaikannya.',
		typeIntro: 'Pilih yang cocok dengan cara kamu melamar. Jenis dan template bisa diganti nanti.',
		atsLabel: 'RAPI & MUDAH DIBACA',
		atsTitle: 'CV ATS',
		atsCopy:
			'Satu kolom, tanpa foto, dan fokus pada isi. Pilihan untuk melamar lewat portal rekrutmen.',
		atsDetail:
			'Struktur sederhana membantu sistem membaca CV. Hasil seleksi tetap bergantung pada persyaratan dan proses rekrutmen.',
		creativeLabel: 'RUANG UNTUK EKSPRESI',
		creativeTitle: 'CV Creative',
		creativeCopy:
			'Warna, tata letak visual, dan foto opsional. Cocok untuk portofolio atau dikirim langsung ke perekrut.',
		creativeWarning: 'Kurang cocok untuk portal ATS',
		creativeDetail: 'Pilih sesuai kebutuhan lowongan. Teks pada PDF tetap dapat diseleksi.',
		privacyEyebrow: 'CERITAMU TETAP MILIKMU',
		privacyTitle: 'CV pribadi. Tetap di perangkat sendiri.',
		privacyCopy:
			'Tanpa akun, tanpa mengirim data CV ke server, dan tanpa pelacak pihak ketiga. Kamu yang memegang kendali.',
		privacyBackup:
			'Data browser bisa terhapus. Simpan backup secara berkala, terutama jika memakai komputer bersama.',
		privacyLink: 'Baca cara kami menjaga privasimu',
		faqEyebrow: 'SEBELUM MULAI',
		faqTitle: 'Mungkin ini yang kamu pikirkan.',
		faqIntro: 'Sedikit kejelasan untuk memulai dengan tenang.',
		faqAtsQuestion: 'Apa itu ATS?',
		faqAtsAnswer:
			'ATS (Applicant Tracking System) adalah sistem yang membantu perusahaan mengelola lamaran. CV dengan struktur sederhana lebih mudah dibaca sistem, tetapi tidak menjamin lolos seleksi.',
		faqFreeQuestion: 'Apakah gratis?',
		faqFreeAnswer:
			'Ya. Kamu bisa membuat dan mengunduh CV secara gratis, tanpa perlu membuat akun.',
		faqStorageQuestion: 'Di mana data saya disimpan?',
		faqStorageAnswer:
			'Data CV disimpan di penyimpanan browser pada perangkat yang kamu gunakan. Data tersebut tidak dikirim ke server dan tidak otomatis berpindah ke perangkat lain.',
		faqDeletedQuestion: 'Bagaimana jika data browser terhapus?',
		faqDeletedAnswer:
			'CV yang tersimpan di browser ikut hilang. Simpan backup JSON secara berkala agar bisa diimpor kembali saat diperlukan. File PDF atau DOCX juga sebaiknya disimpan sendiri.',
		faqMobileQuestion: 'Bisa digunakan di HP?',
		faqMobileAnswer:
			'Bisa. Tampilan dirancang untuk HP, tablet, dan komputer. Kamu dapat menyusun CV langsung dari browser.',
		faqEnglishQuestion: 'Ada bahasa Inggris?',
		faqEnglishAnswer:
			'Ada. Bahasa tampilan tersedia dalam Bahasa Indonesia dan English. Bahasa isi CV dapat dipilih terpisah saat membuat CV.',
		closingTitle: 'Kesempatan berikutnya dimulai dari sini.',
		closingCopy: 'Bawa ceritamu. Kita bantu menyusunnya.'
	},
	privacy: {
		title: 'Privasi — CV Maker',
		description:
			'Kenali cara CV Maker menyimpan data di perangkatmu, cara menghapusnya, dan pentingnya backup.',
		eyebrow: 'PRIVASI TANPA BAHASA RUMIT',
		heading: 'Datamu, kendalimu.',
		intro:
			'CV berisi cerita pribadi. Di versi ini, data CV tetap berada di perangkat yang kamu gunakan.',
		storageTitle: 'Tersimpan di browser, tanpa akun',
		storageCopy:
			'Data CV disimpan di penyimpanan browser (IndexedDB). Preferensi bahasa disimpan di localStorage. Tidak ada akun, server penyimpanan CV, atau sinkronisasi antarperangkat pada versi ini.',
		trackingTitle: 'Tanpa pelacak pihak ketiga',
		trackingCopy:
			'Kami tidak memasang analytics, pixel iklan, script, atau font dari layanan pihak ketiga. Font dimuat dari situs ini. Data CV tidak dikirim ke server.',
		photoTitle: 'Foto dan metadata lokasi',
		photoCopy:
			'Saat fitur unggah foto tersedia, foto diproses di perangkat: ukurannya diperkecil dan dikodekan ulang untuk membuang metadata EXIF, termasuk lokasi GPS. Foto tetap disimpan di browser.',
		deleteTitle: 'Menghapus data',
		deleteCopy:
			'Saat dashboard tersedia, gunakan “Hapus semua data di perangkat ini” di CV Saya. Kamu juga bisa menghapus data situs melalui pengaturan browser. Penghapusan ini menghilangkan CV dan foto yang tersimpan di browser tersebut.',
		backupTitle: 'Simpan backup, terutama di komputer bersama',
		backupCopy:
			'Jika data browser dihapus, perangkat rusak, atau browser diganti, CV bisa hilang. Simpan backup JSON secara berkala dan simpan file unduhan di tempat yang kamu kendalikan.',
		sharedCopy:
			'Di komputer umum, unduh berkas yang diperlukan lalu hapus data situs sebelum meninggalkan perangkat. Hapus juga file unduhan dari komputer tersebut setelah dipindahkan.',
		back: 'Kembali ke beranda'
	},
	about: {
		title: 'Tentang — CV Maker',
		description:
			'CV Maker adalah proyek open source untuk membantu fresh graduate membuat CV ATS dan Creative secara gratis.',
		eyebrow: 'TENTANG CV MAKER',
		heading: 'Cerita pertamamu layak mendapat tempat.',
		intro:
			'Belum punya pengalaman kerja bukan berarti belum punya kemampuan. Proyek ini membantu fresh graduate menyusun pendidikan, organisasi, magang, dan proyek menjadi CV yang jelas.',
		purposeTitle: 'Dibuat untuk langkah karier pertama',
		purposeCopy:
			'CV Maker dirancang gratis dan mudah digunakan di HP. Kamu akan dipandu sebelum masuk ke editor yang lebih bebas. Pilih CV ATS untuk struktur sederhana, atau CV Creative untuk kebutuhan visual.',
		openTitle: 'Terbuka untuk dipelajari bersama',
		openCopy:
			'CV Maker adalah proyek open source. Kode sumber dan pengembangan proyek tersedia di GitHub.',
		github: 'Lihat kode di GitHub',
		privacyCopy:
			'Tidak perlu akun. Data CV tetap di perangkatmu. Simpan backup agar ceritamu tetap aman.',
		back: 'Kembali ke beranda'
	},
	ui: {
		loading: 'Memuat…',
		required: 'wajib',
		characterCount: '{count}/{max}',
		stepProgress: 'Langkah {current} dari {total}',
		steps: 'Langkah pembuatan CV',
		completed: 'Selesai',
		currentStep: 'Langkah aktif',
		upcoming: 'Belum dimulai',
		languageId: 'ID',
		languageEn: 'EN',
		close: 'Tutup',
		dismiss: 'Tutup notifikasi',
		dialogTitle: 'Konfirmasi',
		addItem: 'Tambah {label}',
		deleteItem: 'Hapus item {number}',
		moveUp: 'Naikkan item {number}',
		moveDown: 'Turunkan item {number}',
		deleteTitle: 'Hapus item ini?',
		deleteDescription: 'Item {number} akan dihapus dari daftar ini.',
		emptyList: 'Belum ada item. Tambahkan satu untuk mulai bercerita.',
		itemPosition: 'Item {current} dari {total}',
		reordered: 'Item dipindahkan dari urutan {from} ke {to}.',
		removed: 'Item {number} dihapus.',
		added: 'Item {number} ditambahkan.',
		month: 'Bulan',
		year: 'Tahun',
		chooseMonth: 'Pilih bulan',
		chooseYear: 'Pilih tahun',
		untilPresent: 'Sampai sekarang',
		notifications: 'Notifikasi',
		showcaseTitle: 'Komponen — CV Maker',
		showcaseHeading: 'Ruang komponen',
		showcaseIntro: 'Contoh interaktif design system. Data di halaman ini hanya untuk demonstrasi.',
		buttons: 'Tombol',
		primary: 'Utama',
		secondary: 'Sekunder',
		ghost: 'Ghost',
		danger: 'Hapus',
		small: 'Kecil',
		medium: 'Sedang',
		large: 'Besar',
		disabled: 'Nonaktif',
		linkButton: 'Tombol tautan',
		fields: 'Kolom isian',
		nameLabel: 'Nama lengkap',
		namePlaceholder: 'Tulis namamu',
		nameHint: 'Gunakan nama yang ingin ditampilkan di CV.',
		emailLabel: 'Email',
		emailError: 'Periksa kembali format email.',
		disabledField: 'Kolom nonaktif',
		summaryLabel: 'Ringkasan profil',
		summaryHint: 'Ceritakan kemampuan dan tujuanmu secara singkat.',
		selectLabel: 'Jenis CV',
		chooseOption: 'Pilih jenis CV',
		atsOption: 'ATS',
		creativeOption: 'Creative',
		choices: 'Pilihan',
		checkboxLabel: 'Sertakan proyek kuliah',
		toggleLabel: 'Tampilkan bagian ini',
		progress: 'Progres',
		stepType: 'Jenis CV',
		stepPersonal: 'Data diri',
		stepEducation: 'Pendidikan',
		stepReview: 'Tinjau',
		cards: 'Kartu',
		cardTitle: 'Awal yang baik',
		cardBody: 'Pengalaman organisasi dan proyek kuliah juga layak diceritakan.',
		cardFooter: 'Tersimpan di perangkat ini ✓',
		overlays: 'Dialog & bottom sheet',
		openDialog: 'Buka dialog',
		openSheet: 'Buka bottom sheet',
		modalTitle: 'Lihat sebelum melanjutkan',
		modalBody: 'Tekan Tab untuk berpindah fokus dan Esc untuk menutup.',
		sheetTitle: 'Preview singkat',
		sheetBody: 'Di HP, panel ini muncul dari bawah. Di layar besar, panel tampil di tengah.',
		toasts: 'Notifikasi',
		successToast: 'Tampilkan sukses',
		errorToast: 'Tampilkan error',
		infoToast: 'Tampilkan info',
		successMessage: 'Perubahan contoh tersimpan.',
		errorMessage: 'Contoh pesan: perubahan belum tersimpan.',
		infoMessage: 'Ini notifikasi informasi.',
		accordionTitle: 'Panel yang bisa dibuka',
		accordionOne: 'Bagaimana menulis pengalaman pertama?',
		accordionAnswer: 'Mulai dari kontribusimu dalam proyek atau organisasi.',
		accordionTwo: 'Bolehkah beberapa panel terbuka?',
		accordionTwoAnswer: 'Boleh. Setiap panel memiliki kontrolnya sendiri.',
		list: 'Daftar & urutan',
		listLabel: 'proyek',
		emptyListLabel: 'daftar kosong',
		itemLabel: 'Nama proyek {number}',
		itemExample: 'Proyek contoh {number}',
		monthPicker: 'Pilihan bulan',
		dateLabel: 'Tanggal selesai',
		selectedDate: 'Nilai tanggal: {value}',
		noDate: 'Belum dipilih',
		language: 'Bahasa tampilan'
	},
	wizard: {
		pageTitle: 'Buat CV — CV Maker',
		typeEyebrow: 'MULAI DARI CARA KAMU MELAMAR',
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
				title: 'Pilih jenis CV-mu',
				description:
					'Sesuaikan dengan cara melamar dan bidang yang kamu tuju. Kita isi bersama, satu langkah setiap kali.'
			},
			target: {
				title: 'Arah kariermu',
				description:
					'Mulai dari bahasa CV dan posisi yang kamu incar. Beri judul agar mudah ditemukan lagi.'
			},
			personal: {
				title: 'Data diri',
				description: 'Bantu perekrut mengenal dan menghubungimu. Cukup isi informasi yang relevan.'
			},
			education: {
				title: 'Pendidikan',
				description:
					'Ceritakan latar pendidikanmu. Tugas akhir, mata kuliah, dan beasiswa juga bisa menunjukkan kemampuanmu.'
			},
			experience: {
				title: 'Pengalaman kerja / magang',
				description:
					'Magang, kerja paruh waktu, dan freelance juga berarti. Belum ada? Kamu boleh melewati langkah ini.'
			},
			organizations: {
				title: 'Organisasi & kepanitiaan',
				description: 'Tunjukkan peran dan kontribusimu saat bekerja bersama orang lain.'
			},
			projects: {
				title: 'Proyek',
				description: 'Proyek kuliah, tugas akhir, dan karya pribadi bisa menjadi bukti kemampuanmu.'
			},
			skills: {
				title: 'Keahlian & pencapaian',
				description:
					'Tambahkan keahlian, bahasa, sertifikasi, atau prestasi yang relevan dengan posisi tujuan.'
			},
			summary: {
				title: 'Ringkasan profil',
				description:
					'Rangkai cerita singkat tentang dirimu, kemampuan utama, dan arah kariermu. Contoh di bawah bisa jadi titik awal.'
			},
			review: {
				title: 'Tinjau CV-mu',
				description:
					'Periksa isi, ejaan, dan kontakmu. Preview menampilkan informasi yang akan dibaca perekrut.'
			},
			done: {
				title: 'Selamat, CV-mu sudah tersusun!',
				description:
					'Satu langkah penting sudah kamu selesaikan. Kamu bisa meninjau dan memperbaiki isinya kapan saja dari sini.'
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
	},
	locale: {
		label: 'Bahasa',
		id: 'Bahasa Indonesia',
		en: 'English'
	},
	validation: {
		required: 'Wajib diisi.',
		nameTooShort: 'Nama terlalu pendek.',
		emailInvalid: 'Format email belum benar. Contoh: nama@email.com',
		phoneInvalid: 'Nomor HP belum benar. Contoh: 0812-3456-7890',
		educationRequired: 'Tambahkan minimal satu riwayat pendidikan.',
		dateOrder: 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
		itemTitleRequired: 'Lengkapi judul isian ini atau hapus isiannya.'
	}
};
