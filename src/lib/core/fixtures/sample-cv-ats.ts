import type { CVDocument } from '../schema/types';

/**
 * Realistic ATS CV of an Indonesian fresh graduate (fictional person & organisations).
 * Use for UI work, template design and tests. Ids & timestamps are fixed (deterministic).
 */
export const sampleCvAts: CVDocument = {
	schemaVersion: 1,
	id: 'sample-ats-0001',
	title: 'CV ATS – Data Analyst',
	kind: 'ats',
	locale: 'id',
	targetRole: 'Junior Data Analyst',
	templateId: 'ats-klasik',
	theme: { fontId: 'default', fontScale: 1 },
	status: { wizardCompleted: true, wizardStep: 10 },
	layout: {
		order: [
			'summary',
			'education',
			'experience',
			'organizations',
			'projects',
			'skills',
			'certifications',
			'awards',
			'languages'
		],
		hidden: [],
		customTitles: {}
	},
	personal: {
		fullName: 'Rizky Aditya Pratama',
		headline: 'Fresh Graduate Sistem Informasi | Data Analyst',
		email: 'rizky.pratama@example.com',
		phone: '+62 812-3456-7890',
		city: 'Malang',
		province: 'Jawa Timur',
		links: [
			{ id: 'link-1', label: 'LinkedIn', url: 'https://www.linkedin.com/in/rizky-pratama-example' },
			{ id: 'link-2', label: 'Portofolio', url: 'https://rizkypratama.example.com' }
		]
	},
	summary:
		'Lulusan S1 Sistem Informasi dengan IPK 3,62 yang berfokus pada analisis data dan visualisasi. Berpengalaman magang 6 bulan sebagai Data Analyst Intern dengan membuat dashboard penjualan yang dipakai tim manajemen setiap minggu. Terbiasa menggunakan SQL, Python, dan Excel, serta aktif berorganisasi sehingga terlatih bekerja dalam tim dan memenuhi tenggat waktu.',
	education: [
		{
			id: 'edu-1',
			institution: 'Universitas Harapan Bangsa',
			degree: 'S1',
			major: 'Sistem Informasi',
			gpa: '3.62',
			gpaScale: '4.00',
			dates: { start: '2020-08', end: '2024-08', current: false },
			thesisTitle: 'Analisis Sentimen Ulasan Aplikasi E-Commerce Menggunakan Metode Naive Bayes',
			highlights: [
				'Mata kuliah relevan: Basis Data, Statistika, Data Mining, Business Intelligence',
				'Penerima beasiswa prestasi akademik 2022–2023'
			]
		}
	],
	experience: [
		{
			id: 'exp-1',
			type: 'internship',
			role: 'Data Analyst Intern',
			company: 'PT Nusantara Niaga Digital',
			location: 'Surabaya',
			dates: { start: '2023-07', end: '2023-12', current: false },
			bullets: [
				'Membuat dashboard penjualan mingguan di Looker Studio yang dipakai 3 kepala divisi untuk rapat evaluasi',
				'Membersihkan dan menggabungkan data transaksi ±50.000 baris per bulan menggunakan SQL dan Python',
				'Mengotomatiskan laporan stok harian sehingga waktu penyusunan turun dari 2 jam menjadi 15 menit'
			]
		}
	],
	organizations: [
		{
			id: 'org-1',
			name: 'Badan Eksekutif Mahasiswa Fakultas Ilmu Komputer',
			role: 'Staf Divisi Riset dan Data',
			dates: { start: '2021-09', end: '2022-08', current: false },
			bullets: [
				'Menyusun survei kepuasan mahasiswa dengan 420 responden dan menyajikan hasilnya ke pimpinan fakultas',
				'Mengelola basis data anggota dan kegiatan organisasi di Google Sheets'
			]
		},
		{
			id: 'org-2',
			name: 'Panitia Pekan Teknologi Informasi 2022',
			role: 'Koordinator Divisi Acara',
			dates: { start: '2022-03', end: '2022-06', current: false },
			bullets: [
				'Memimpin 8 anggota divisi menyelenggarakan seminar dan lomba dengan total 600 peserta'
			]
		}
	],
	projects: [
		{
			id: 'proj-1',
			name: 'Dashboard Analisis Penjualan UMKM',
			role: 'Data Analyst',
			url: 'https://github.com/rizky-example/umkm-dashboard',
			dates: { start: '2023-02', end: '2023-04', current: false },
			bullets: [
				'Menganalisis data penjualan 12 bulan milik UMKM lokal dan merekomendasikan 3 produk prioritas',
				'Membangun dashboard interaktif dengan Python (Pandas) dan Streamlit'
			]
		}
	],
	skills: {
		hard: [
			'SQL',
			'Python (Pandas, NumPy)',
			'Analisis Data',
			'Visualisasi Data',
			'Statistika Dasar'
		],
		soft: ['Komunikasi', 'Kerja Tim', 'Manajemen Waktu', 'Pemecahan Masalah'],
		tools: ['Microsoft Excel', 'Looker Studio', 'Tableau', 'Git']
	},
	languages: [
		{ id: 'lang-1', name: 'Bahasa Indonesia', level: 'native' },
		{ id: 'lang-2', name: 'Bahasa Inggris', level: 'professional', score: 'TOEFL ITP 550' }
	],
	certifications: [
		{
			id: 'cert-1',
			name: 'Pelatihan Data Analytics Dasar',
			issuer: 'Lembaga Pelatihan Digital Indonesia',
			date: '2023-03'
		}
	],
	awards: [
		{
			id: 'award-1',
			title: 'Juara 2 Lomba Analisis Data Tingkat Universitas',
			issuer: 'Universitas Harapan Bangsa',
			date: '2022-11'
		}
	],
	custom: [],
	createdAt: '2026-01-10T08:00:00.000Z',
	updatedAt: '2026-01-12T10:30:00.000Z'
};
