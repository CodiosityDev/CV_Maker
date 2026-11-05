import type { Guidance } from './types';

export const guidance: Guidance = {
	stepTips: {
		type: [
			'Melamar lewat portal online atau perusahaan besar? Pilih CV ATS.',
			'CV Creative cocok untuk bidang desain/kreatif atau dikirim langsung ke HR.'
		],
		target: [
			'Tulis posisi yang kamu incar, misalnya "Junior Data Analyst" atau "Staf Administrasi".',
			'Gunakan bahasa CV sesuai bahasa lowongan. Lowongan berbahasa Inggris → CV bahasa Inggris.'
		],
		personal: [
			'Pakai email profesional, idealnya berisi nama kamu (contoh: nama.belakang@email.com).',
			'Cukup tulis kota dan provinsi. Alamat lengkap tidak perlu dicantumkan.'
		],
		education: [
			'Sebagai fresh graduate, pendidikan adalah bagian penting. Tulis jurusan dan tahun lulus dengan jelas.',
			'Cantumkan IPK jika 3,00 ke atas atau jika diminta di lowongan.',
			'Tambahkan mata kuliah, skripsi, atau beasiswa yang relevan dengan posisi yang dilamar.'
		],
		experience: [
			'Magang, kerja paruh waktu, dan freelance juga termasuk pengalaman.',
			'Belum punya pengalaman kerja? Tidak apa-apa, lewati langkah ini dan tonjolkan organisasi atau proyek.'
		],
		organizations: [
			'Organisasi kampus dan kepanitiaan menunjukkan kerja tim dan kepemimpinan.',
			'Tulis peranmu dan hasil yang kamu capai, bukan hanya nama kegiatannya.'
		],
		projects: [
			'Proyek kuliah, skripsi, lomba, atau proyek pribadi bisa jadi bukti kemampuanmu.',
			'Sertakan tautan (GitHub, portofolio, Google Drive publik) jika ada.'
		],
		skills: [
			'Pisahkan keahlian teknis (misalnya Excel, SQL) dan soft skill (misalnya komunikasi).',
			'Pilih keahlian yang sesuai dengan lowongan. Lebih baik sedikit tapi relevan.'
		],
		summary: [
			'Ringkasan ditulis terakhir agar bisa merangkum isi CV-mu.',
			'Cukup 2–4 kalimat: siapa kamu, keahlian utama, dan posisi yang kamu tuju.'
		],
		review: [
			'Periksa ejaan, nomor HP, dan email sekali lagi.',
			'Untuk fresh graduate, usahakan CV muat dalam 1 halaman.'
		],
		done: [
			'Simpan juga backup (JSON) supaya CV bisa dibuka lagi jika data browser terhapus.',
			'Buat salinan CV untuk setiap jenis posisi agar isinya bisa disesuaikan.'
		]
	},
	fieldTips: {
		headline:
			'Satu baris singkat tentang dirimu, misalnya "Fresh Graduate Akuntansi" atau "Lulusan Teknik Informatika | Web Developer".',
		email: 'Hindari email dengan nama panggilan atau angka acak. Rekruter menilai kesan pertama.',
		phone: 'Gunakan nomor yang aktif dan terhubung ke WhatsApp. Format akan dirapikan otomatis.',
		links: 'LinkedIn, portofolio, atau GitHub. Pastikan tautannya bisa dibuka publik.',
		gpa: 'Tulis dengan titik atau koma, misalnya 3.65. Skala biasanya 4.00.',
		bullets:
			'Mulai dengan kata kerja aktif dan sertakan angka jika bisa. Contoh: "Mengelola 3 akun media sosial dengan 5.000+ pengikut".',
		summary:
			'Hindari kata klise tanpa bukti seperti "pekerja keras". Tunjukkan dengan pengalaman nyata.',
		skills:
			'Tulis satu keahlian per isian. Gunakan istilah yang sama dengan yang tertulis di lowongan.',
		photo:
			'Gunakan foto formal dengan latar polos. Foto hanya dipakai di CV Creative dan diproses di perangkatmu.'
	},
	exampleBullets: {
		internship: [
			'Membantu tim keuangan merekap 200+ faktur per bulan menggunakan Microsoft Excel',
			'Menyusun laporan mingguan penjualan dan mempresentasikannya kepada supervisor',
			'Mengembangkan fitur pencarian pada aplikasi internal menggunakan Laravel'
		],
		organization: [
			'Memimpin divisi beranggotakan 10 orang dalam menjalankan 5 program kerja selama satu periode',
			'Menyusun proposal kegiatan yang berhasil mendapatkan dana sponsor Rp15 juta',
			'Mengelola media sosial organisasi dan meningkatkan jumlah pengikut sebesar 40%'
		],
		committee: [
			'Mengoordinasikan acara seminar nasional dengan 500 peserta sebagai Ketua Divisi Acara',
			'Menghubungi dan mengonfirmasi 6 pembicara tamu sesuai jadwal acara',
			'Mengatur logistik dan konsumsi untuk 3 hari kegiatan dengan anggaran yang ditentukan'
		],
		project: [
			'Membangun aplikasi kasir berbasis web untuk UMKM menggunakan React dan Firebase',
			'Melakukan analisis data survei 300 responden menggunakan SPSS untuk skripsi',
			'Merancang identitas visual untuk acara kampus, termasuk logo, poster, dan merchandise'
		],
		parttime: [
			'Melayani rata-rata 80 pelanggan per hari dengan rating kepuasan tinggi',
			'Mengajar les matematika untuk 5 siswa SMP dan membantu nilai mereka meningkat'
		],
		volunteer: [
			'Mengajar literasi dasar kepada 20 anak di program relawan desa selama 2 bulan',
			'Membantu distribusi bantuan sosial untuk 150 keluarga terdampak banjir'
		]
	},
	actionVerbs: [
		'Mengelola',
		'Memimpin',
		'Menyusun',
		'Mengembangkan',
		'Merancang',
		'Menganalisis',
		'Mengoordinasikan',
		'Meningkatkan',
		'Membangun',
		'Mempresentasikan',
		'Mengoptimalkan',
		'Melatih',
		'Mengevaluasi',
		'Menyelesaikan',
		'Mengimplementasikan',
		'Mendokumentasikan'
	],
	summaryExamples: [
		{
			field: 'it',
			label: 'Teknologi Informasi',
			text: 'Lulusan S1 [jurusan] dengan pengalaman [magang/proyek] di bidang [pengembangan web/analisis data]. Menguasai [keahlian 1], [keahlian 2], dan [keahlian 3]. Mencari kesempatan sebagai [posisi] untuk berkontribusi membangun produk digital yang bermanfaat.'
		},
		{
			field: 'accounting',
			label: 'Akuntansi & Keuangan',
			text: 'Lulusan S1 Akuntansi dengan IPK [IPK] yang teliti dan terbiasa bekerja dengan angka. Berpengalaman [magang/organisasi] dalam [penyusunan laporan keuangan/rekonsiliasi]. Menguasai Microsoft Excel dan [software akuntansi], siap berkontribusi sebagai [posisi].'
		},
		{
			field: 'engineering',
			label: 'Teknik',
			text: 'Lulusan [jurusan teknik] yang memiliki pengalaman [magang/proyek] di [bidang]. Terbiasa menggunakan [software/alat] dan menerapkan [standar/metode]. Bersemangat mengembangkan karier sebagai [posisi].'
		},
		{
			field: 'marketing',
			label: 'Marketing & Komunikasi',
			text: 'Lulusan [jurusan] yang aktif mengelola [media sosial/acara] selama kuliah. Berpengalaman membuat konten dan kampanye yang [hasil, mis. meningkatkan engagement 30%]. Mencari peran sebagai [posisi] untuk membantu brand tumbuh.'
		},
		{
			field: 'design',
			label: 'Desain & Kreatif',
			text: 'Lulusan [jurusan] yang senang merancang [UI/identitas visual/konten] yang mudah dipahami. Berpengalaman mengerjakan [proyek/freelance] menggunakan [Figma/Adobe]. Siap berkontribusi sebagai [posisi].'
		},
		{
			field: 'general',
			label: 'Umum',
			text: 'Lulusan [jenjang] [jurusan] dari [kampus] yang aktif dalam [organisasi/kegiatan]. Memiliki kemampuan [keahlian utama] serta terbiasa bekerja dalam tim dan memenuhi tenggat waktu. Siap belajar dan berkontribusi sebagai [posisi].'
		}
	],
	cvTypes: {
		ats: {
			title: 'CV ATS',
			points: [
				'Satu kolom, rapi, dan mudah dibaca sistem rekrutmen (ATS)',
				'Tanpa foto dan tanpa elemen dekoratif',
				'Paling aman untuk portal lowongan, BUMN, dan perusahaan besar'
			]
		},
		creative: {
			title: 'CV Creative',
			points: [
				'Tata letak visual dengan warna dan foto opsional',
				'Cocok untuk bidang kreatif atau dikirim langsung ke perekrut',
				'Kurang cocok untuk portal yang memakai ATS'
			]
		},
		changeLater: 'Kamu bisa mengganti jenis dan template CV kapan saja nanti.'
	}
};
