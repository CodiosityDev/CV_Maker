import type { CVDocument } from '../schema/types';

/**
 * Realistic creative CV of an Indonesian design graduate (fictional person & organisations).
 * Uses a custom section and a custom section title. No photo (fixtures have no assets).
 */
export const sampleCvCreative: CVDocument = {
	schemaVersion: 1,
	id: 'sample-creative-0001',
	title: 'CV Kreatif – UI/UX Designer',
	kind: 'creative',
	locale: 'id',
	targetRole: 'Junior UI/UX Designer',
	templateId: 'creative-sidebar',
	theme: { accentColor: '#0f766e', fontId: 'default', fontScale: 1 },
	status: { wizardCompleted: true, wizardStep: 10 },
	layout: {
		order: [
			'summary',
			'experience',
			'projects',
			'education',
			'organizations',
			'skills',
			'custom:portfolio',
			'awards',
			'certifications',
			'languages'
		],
		hidden: ['certifications'],
		customTitles: { projects: 'Proyek Desain' }
	},
	personal: {
		fullName: 'Nadia Putri Maharani',
		headline: 'UI/UX Designer · Lulusan Desain Komunikasi Visual',
		email: 'nadia.maharani@example.com',
		phone: '0857-1234-5678',
		city: 'Yogyakarta',
		province: 'DI Yogyakarta',
		links: [
			{ id: 'link-1', label: 'Portofolio', url: 'nadiamaharani.example.com' },
			{ id: 'link-2', label: 'Dribbble', url: 'https://dribbble.com/nadia-example' }
		]
	},
	summary:
		'Lulusan Desain Komunikasi Visual yang senang merancang pengalaman digital yang sederhana dan mudah dipakai. Berpengalaman merancang aplikasi mobile saat magang dan mengerjakan proyek freelance untuk UMKM.',
	education: [
		{
			id: 'edu-1',
			institution: 'Institut Seni dan Desain Mataram',
			degree: 'S1',
			major: 'Desain Komunikasi Visual',
			gpa: '3.71',
			gpaScale: '4.00',
			dates: { start: '2020-09', end: '2024-09', current: false },
			highlights: ['Tugas akhir: perancangan aplikasi pemesanan kuliner lokal berbasis mobile']
		}
	],
	experience: [
		{
			id: 'exp-1',
			type: 'internship',
			role: 'UI/UX Designer Intern',
			company: 'Studio Kreasi Digital',
			location: 'Yogyakarta',
			dates: { start: '2023-08', end: '2024-01', current: false },
			bullets: [
				'Merancang 40+ layar aplikasi mobile reservasi klinik di Figma bersama tim produk',
				'Melakukan 2 putaran uji kegunaan dengan 10 pengguna dan memperbaiki alur pendaftaran'
			]
		},
		{
			id: 'exp-2',
			type: 'freelance',
			role: 'Desainer Grafis',
			company: 'Freelance',
			dates: { start: '2022-01', current: true },
			bullets: ['Membuat identitas visual dan konten media sosial untuk 6 UMKM kuliner']
		}
	],
	organizations: [
		{
			id: 'org-1',
			name: 'Himpunan Mahasiswa DKV',
			role: 'Kepala Divisi Kreatif',
			dates: { start: '2022-02', end: '2023-02', current: false },
			bullets: ['Memimpin 12 anggota menyiapkan materi publikasi untuk 15 kegiatan himpunan']
		}
	],
	projects: [
		{
			id: 'proj-1',
			name: 'Redesain Aplikasi Perpustakaan Kampus',
			role: 'UI/UX Designer',
			url: 'https://nadiamaharani.example.com/perpustakaan',
			dates: { start: '2023-03', end: '2023-05', current: false },
			bullets: ['Menyederhanakan alur peminjaman buku dari 7 langkah menjadi 4 langkah']
		}
	],
	skills: {
		hard: ['UI Design', 'UX Research', 'Wireframing', 'Prototyping', 'Design System'],
		soft: ['Empati', 'Komunikasi', 'Kolaborasi'],
		tools: ['Figma', 'Adobe Illustrator', 'Adobe Photoshop', 'Notion']
	},
	languages: [
		{ id: 'lang-1', name: 'Bahasa Indonesia', level: 'native' },
		{ id: 'lang-2', name: 'Bahasa Inggris', level: 'intermediate' }
	],
	certifications: [
		{
			id: 'cert-1',
			name: 'Kelas Dasar UI/UX',
			issuer: 'Akademi Desain Digital',
			date: '2022-07'
		}
	],
	awards: [
		{
			id: 'award-1',
			title: 'Finalis Kompetisi Desain Aplikasi Mahasiswa',
			issuer: 'Asosiasi Desainer Muda',
			date: '2023-10'
		}
	],
	custom: [
		{
			key: 'custom:portfolio',
			title: 'Pameran & Karya',
			items: [
				{
					id: 'custom-1',
					title: 'Pameran Tugas Akhir DKV',
					subtitle: 'Galeri Kampus',
					dates: { start: '2024-07', end: '2024-07', current: false },
					bullets: ['Menampilkan prototipe aplikasi kuliner lokal kepada 300+ pengunjung']
				}
			]
		}
	],
	createdAt: '2026-01-15T08:00:00.000Z',
	updatedAt: '2026-01-16T09:00:00.000Z'
};
