import type { SuggestionData } from '../types';
import { degreeOptions } from '../../education/index';
import { CITIES, INSTITUTIONS, PROVINCES } from './shared';

const SOFT_SKILLS = [
	'Komunikasi',
	'Kerja Tim',
	'Manajemen Waktu',
	'Pemecahan Masalah',
	'Berpikir Kritis',
	'Kepemimpinan',
	'Adaptasi',
	'Ketelitian',
	'Inisiatif',
	'Negosiasi',
	'Presentasi',
	'Kreativitas',
	'Pelayanan Pelanggan',
	'Bekerja di Bawah Tekanan',
	'Organisasi'
];

export const suggestionsId: SuggestionData = {
	jobTitles: [
		{ title: 'Staf Administrasi', category: 'admin' },
		{ title: 'Customer Service', category: 'customer' },
		{ title: 'Junior Data Analyst', category: 'data' },
		{ title: 'Staf Akuntansi', category: 'finance' },
		{ title: 'Digital Marketing', category: 'marketing' },
		{ title: 'Junior Software Engineer', category: 'it' },
		{ title: 'Web Developer', category: 'it' },
		{ title: 'Frontend Developer', category: 'it' },
		{ title: 'Backend Developer', category: 'it' },
		{ title: 'Mobile Developer', category: 'it' },
		{ title: 'IT Support', category: 'it' },
		{ title: 'QA Tester', category: 'it' },
		{ title: 'Network Engineer', category: 'it' },
		{ title: 'System Administrator', category: 'it' },
		{ title: 'Data Entry', category: 'data' },
		{ title: 'Business Intelligence Analyst', category: 'data' },
		{ title: 'Data Scientist', category: 'data' },
		{ title: 'UI/UX Designer', category: 'design' },
		{ title: 'Desainer Grafis', category: 'design' },
		{ title: 'Content Creator', category: 'design' },
		{ title: 'Video Editor', category: 'design' },
		{ title: 'Social Media Specialist', category: 'marketing' },
		{ title: 'Content Writer', category: 'marketing' },
		{ title: 'Copywriter', category: 'marketing' },
		{ title: 'SEO Specialist', category: 'marketing' },
		{ title: 'Marketing Communication', category: 'marketing' },
		{ title: 'Staf Keuangan', category: 'finance' },
		{ title: 'Staf Pajak', category: 'finance' },
		{ title: 'Auditor Junior', category: 'finance' },
		{ title: 'Teller Bank', category: 'finance' },
		{ title: 'Kasir', category: 'finance' },
		{ title: 'Analis Kredit', category: 'finance' },
		{ title: 'Sekretaris', category: 'admin' },
		{ title: 'Resepsionis', category: 'admin' },
		{ title: 'Admin Online Shop', category: 'admin' },
		{ title: 'Staf HRD', category: 'hr' },
		{ title: 'Recruiter', category: 'hr' },
		{ title: 'Staf Personalia', category: 'hr' },
		{ title: 'Sales Executive', category: 'sales' },
		{ title: 'Account Executive', category: 'sales' },
		{ title: 'Business Development', category: 'sales' },
		{ title: 'Sales Representative', category: 'sales' },
		{ title: 'Customer Success', category: 'customer' },
		{ title: 'Call Center', category: 'customer' },
		{ title: 'Teknisi', category: 'engineering' },
		{ title: 'Drafter', category: 'engineering' },
		{ title: 'Quality Control', category: 'engineering' },
		{ title: 'Staf Produksi', category: 'engineering' },
		{ title: 'Engineer Sipil', category: 'engineering' },
		{ title: 'Electrical Engineer', category: 'engineering' },
		{ title: 'Mechanical Engineer', category: 'engineering' },
		{ title: 'Guru', category: 'education' },
		{ title: 'Tutor', category: 'education' },
		{ title: 'Asisten Dosen', category: 'education' },
		{ title: 'Perawat', category: 'health' },
		{ title: 'Apoteker', category: 'health' },
		{ title: 'Analis Laboratorium', category: 'health' },
		{ title: 'Bidan', category: 'health' },
		{ title: 'Barista', category: 'hospitality' },
		{ title: 'Front Office', category: 'hospitality' },
		{ title: 'Staf Logistik', category: 'logistics' },
		{ title: 'Admin Gudang', category: 'logistics' },
		{ title: 'Purchasing', category: 'logistics' },
		{ title: 'Staf Legal', category: 'legal' },
		{ title: 'Paralegal', category: 'legal' },
		{ title: 'Staf Operasional', category: 'operations' },
		{ title: 'Admin Operasional', category: 'operations' },
		{ title: 'Penyuluh Pertanian', category: 'agriculture' },
		{ title: 'Staf Perkebunan', category: 'agriculture' },
		{ title: 'Agronomis', category: 'agriculture' },
		{ title: 'Jurnalis', category: 'media' },
		{ title: 'Reporter', category: 'media' },
		{ title: 'Staf Public Relations', category: 'media' },
		{ title: 'Staf Pemerintahan', category: 'public' },
		{ title: 'Analis Kebijakan', category: 'public' },
		{ title: 'Pranata Komputer', category: 'public' },
		{ title: 'Store Crew', category: 'retail' },
		{ title: 'Kepala Toko', category: 'retail' },
		{ title: 'Merchandiser', category: 'retail' },
		{ title: 'Sales Promotion Girl / Boy (SPG/SPB)', category: 'retail' },
		{ title: 'Arsitek Junior', category: 'construction' },
		{ title: 'Site Engineer', category: 'construction' },
		{ title: 'Estimator', category: 'construction' },
		{ title: 'Surveyor', category: 'construction' },
		{ title: 'Staf HSE', category: 'mining' },
		{ title: 'Geologist', category: 'mining' },
		{ title: 'Engineer Tambang', category: 'mining' },
		{ title: 'Staf Ekspedisi', category: 'transport' },
		{ title: 'Dispatcher', category: 'transport' },
		{ title: 'Staf Bandara', category: 'transport' },
		{ title: 'Asisten Peneliti', category: 'research' },
		{ title: 'Enumerator', category: 'research' },
		{ title: 'Event Organizer', category: 'event' },
		{ title: 'Event Coordinator', category: 'event' },
		{ title: 'Fasilitator Masyarakat', category: 'social' },
		{ title: 'Staf Program LSM', category: 'social' },
		{ title: 'Pekerja Sosial', category: 'social' },
		{ title: 'Management Trainee', category: 'general' }
	],
	skillsByCategory: {
		it: {
			hard: [
				'JavaScript',
				'TypeScript',
				'Python',
				'Java',
				'PHP',
				'SQL',
				'HTML & CSS',
				'REST API',
				'Git',
				'Pemrograman Berorientasi Objek',
				'Pengujian Perangkat Lunak',
				'Jaringan Komputer'
			],
			tools: ['Visual Studio Code', 'GitHub', 'Postman', 'Docker', 'Linux', 'Figma', 'Jira']
		},
		data: {
			hard: [
				'SQL',
				'Python',
				'Analisis Data',
				'Visualisasi Data',
				'Statistika',
				'Data Cleaning',
				'Excel Lanjutan (Pivot, VLOOKUP)',
				'Machine Learning Dasar'
			],
			tools: [
				'Microsoft Excel',
				'Google Sheets',
				'Looker Studio',
				'Tableau',
				'Power BI',
				'Jupyter Notebook'
			]
		},
		design: {
			hard: [
				'Desain Grafis',
				'UI Design',
				'UX Research',
				'Wireframing',
				'Prototyping',
				'Tipografi',
				'Branding',
				'Editing Video'
			],
			tools: [
				'Figma',
				'Adobe Photoshop',
				'Adobe Illustrator',
				'Adobe Premiere Pro',
				'Canva',
				'CapCut'
			]
		},
		marketing: {
			hard: [
				'Digital Marketing',
				'Social Media Marketing',
				'Copywriting',
				'SEO',
				'Content Planning',
				'Meta Ads',
				'Google Ads',
				'Analisis Kampanye'
			],
			tools: ['Meta Business Suite', 'Google Analytics', 'Canva', 'CapCut', 'Google Sheets']
		},
		finance: {
			hard: [
				'Akuntansi Keuangan',
				'Penyusunan Laporan Keuangan',
				'Rekonsiliasi Bank',
				'Perpajakan (PPh & PPN)',
				'Jurnal Umum',
				'Analisis Keuangan',
				'Budgeting'
			],
			tools: ['Microsoft Excel', 'Accurate', 'Zahir', 'MYOB', 'SAP', 'e-Faktur']
		},
		admin: {
			hard: [
				'Administrasi Perkantoran',
				'Pengarsipan Dokumen',
				'Surat-Menyurat',
				'Data Entry',
				'Penjadwalan',
				'Notulensi Rapat'
			],
			tools: ['Microsoft Word', 'Microsoft Excel', 'Google Workspace', 'Microsoft PowerPoint']
		},
		hr: {
			hard: [
				'Rekrutmen',
				'Screening CV',
				'Wawancara Kerja',
				'Administrasi Kepegawaian',
				'Payroll',
				'Onboarding Karyawan',
				'Hukum Ketenagakerjaan Dasar'
			],
			tools: ['Microsoft Excel', 'Google Workspace', 'LinkedIn Recruiter', 'Talenta']
		},
		sales: {
			hard: [
				'Penjualan B2B',
				'Penjualan B2C',
				'Prospecting',
				'Negosiasi Harga',
				'Presentasi Produk',
				'Manajemen Pelanggan',
				'Target Penjualan'
			],
			tools: ['CRM', 'Microsoft Excel', 'Google Sheets', 'WhatsApp Business']
		},
		customer: {
			hard: [
				'Pelayanan Pelanggan',
				'Penanganan Keluhan',
				'Komunikasi via Telepon',
				'Live Chat',
				'Pencatatan Tiket'
			],
			tools: ['Zendesk', 'Freshdesk', 'WhatsApp Business', 'Google Sheets']
		},
		engineering: {
			hard: [
				'Gambar Teknik',
				'Quality Control',
				'K3 (Keselamatan dan Kesehatan Kerja)',
				'Perawatan Mesin',
				'Estimasi Biaya',
				'Manajemen Proyek'
			],
			tools: ['AutoCAD', 'SolidWorks', 'SketchUp', 'MATLAB', 'Microsoft Project']
		},
		education: {
			hard: [
				'Perencanaan Pembelajaran',
				'Penyusunan Materi Ajar',
				'Evaluasi Pembelajaran',
				'Manajemen Kelas',
				'Bimbingan Belajar'
			],
			tools: ['Google Classroom', 'Microsoft PowerPoint', 'Canva', 'Zoom']
		},
		health: {
			hard: [
				'Asuhan Keperawatan',
				'Pelayanan Kefarmasian',
				'Pemeriksaan Laboratorium',
				'Rekam Medis',
				'Edukasi Pasien',
				'Pertolongan Pertama'
			],
			tools: ['SIMRS', 'Microsoft Excel']
		},
		hospitality: {
			hard: [
				'Pelayanan Tamu',
				'Reservasi',
				'Food & Beverage Service',
				'Penanganan Keluhan',
				'Kasir'
			],
			tools: ['Sistem POS', 'Opera PMS']
		},
		logistics: {
			hard: [
				'Manajemen Persediaan',
				'Pengadaan Barang',
				'Pengiriman & Distribusi',
				'Stock Opname',
				'Administrasi Gudang'
			],
			tools: ['Microsoft Excel', 'SAP', 'Google Sheets']
		},
		legal: {
			hard: [
				'Penyusunan Kontrak',
				'Riset Hukum',
				'Legal Drafting',
				'Kepatuhan (Compliance)',
				'Administrasi Perizinan'
			],
			tools: ['Microsoft Word', 'Microsoft Excel']
		},
		operations: {
			hard: [
				'Pengelolaan Operasional',
				'SOP',
				'Koordinasi Antar Divisi',
				'Pelaporan Harian',
				'Pengendalian Biaya'
			],
			tools: ['Microsoft Excel', 'Google Sheets', 'ERP']
		},
		agriculture: {
			hard: [
				'Budidaya Tanaman',
				'Pengendalian Hama Terpadu',
				'Analisis Tanah',
				'Penyuluhan',
				'Pengelolaan Kebun',
				'Pascapanen'
			],
			tools: ['Microsoft Excel', 'GIS (QGIS)']
		},
		media: {
			hard: [
				'Penulisan Berita',
				'Wawancara',
				'Liputan Lapangan',
				'Siaran Pers',
				'Hubungan Media',
				'Editing Naskah'
			],
			tools: ['Microsoft Word', 'Canva', 'Adobe Premiere Pro', 'WordPress']
		},
		public: {
			hard: [
				'Administrasi Pemerintahan',
				'Pelayanan Publik',
				'Penyusunan Laporan',
				'Analisis Kebijakan',
				'Pengelolaan Arsip'
			],
			tools: ['Microsoft Office', 'Google Workspace']
		},
		retail: {
			hard: [
				'Penjualan Ritel',
				'Visual Merchandising',
				'Stock Opname',
				'Kasir',
				'Pelayanan Pelanggan',
				'Target Penjualan'
			],
			tools: ['Sistem POS', 'Microsoft Excel']
		},
		construction: {
			hard: [
				'Gambar Kerja',
				'Rencana Anggaran Biaya (RAB)',
				'Pengawasan Lapangan',
				'K3 Konstruksi',
				'Perhitungan Struktur',
				'Survei dan Pemetaan'
			],
			tools: ['AutoCAD', 'SketchUp', 'Revit', 'Microsoft Project', 'Microsoft Excel']
		},
		mining: {
			hard: [
				'K3 (HSE)',
				'Pemetaan Geologi',
				'Analisis Batuan',
				'Perencanaan Tambang',
				'Pengelolaan Lingkungan'
			],
			tools: ['ArcGIS', 'AutoCAD', 'Microsoft Excel']
		},
		transport: {
			hard: [
				'Penjadwalan Armada',
				'Administrasi Pengiriman',
				'Pelacakan Barang',
				'Pelayanan Penumpang'
			],
			tools: ['Microsoft Excel', 'Google Sheets', 'Sistem Manajemen Transportasi']
		},
		research: {
			hard: [
				'Metodologi Penelitian',
				'Pengumpulan Data Lapangan',
				'Analisis Statistik',
				'Penulisan Ilmiah',
				'Kajian Literatur',
				'Wawancara Mendalam'
			],
			tools: ['SPSS', 'Microsoft Excel', 'NVivo', 'Mendeley', 'KoboToolbox']
		},
		event: {
			hard: [
				'Perencanaan Acara',
				'Manajemen Vendor',
				'Penyusunan Rundown',
				'Pengelolaan Anggaran Acara',
				'Koordinasi Tim'
			],
			tools: ['Google Workspace', 'Canva', 'Microsoft Excel']
		},
		social: {
			hard: [
				'Pemberdayaan Masyarakat',
				'Fasilitasi Diskusi',
				'Monitoring dan Evaluasi',
				'Penulisan Proposal',
				'Pendampingan'
			],
			tools: ['Microsoft Office', 'Google Workspace', 'KoboToolbox']
		},
		general: {
			hard: [
				'Microsoft Office',
				'Analisis Masalah',
				'Manajemen Proyek',
				'Riset',
				'Penulisan Laporan'
			],
			tools: ['Microsoft Excel', 'Microsoft Word', 'Microsoft PowerPoint', 'Google Workspace']
		}
	},
	softSkills: SOFT_SKILLS,
	majors: [
		'Teknik Informatika',
		'Sistem Informasi',
		'Ilmu Komputer',
		'Manajemen',
		'Akuntansi',
		'Ilmu Komunikasi',
		'Ilmu Hukum',
		'Psikologi',
		'Teknik Elektro',
		'Teknik Sipil',
		'Teknik Mesin',
		'Teknik Industri',
		'Teknik Kimia',
		'Teknik Lingkungan',
		'Arsitektur',
		'Ekonomi Pembangunan',
		'Administrasi Bisnis',
		'Administrasi Publik',
		'Bisnis Digital',
		'Hubungan Internasional',
		'Desain Komunikasi Visual',
		'Desain Interior',
		'Pendidikan Guru Sekolah Dasar',
		'Pendidikan Bahasa Inggris',
		'Sastra Inggris',
		'Sastra Indonesia',
		'Kedokteran',
		'Keperawatan',
		'Farmasi',
		'Kesehatan Masyarakat',
		'Gizi',
		'Kebidanan',
		'Agribisnis',
		'Agroteknologi',
		'Biologi',
		'Kimia',
		'Fisika',
		'Matematika',
		'Statistika',
		'Sains Data',
		'Sosiologi',
		'Ilmu Politik',
		'Pariwisata',
		'Perhotelan',
		'Manajemen Informatika',
		'Teknik Komputer Jaringan',
		'Rekayasa Perangkat Lunak',
		'Otomatisasi dan Tata Kelola Perkantoran'
	],
	institutions: INSTITUTIONS,
	degrees: degreeOptions('id'),
	orgRoles: [
		'Ketua',
		'Wakil Ketua',
		'Sekretaris',
		'Bendahara',
		'Koordinator Divisi',
		'Kepala Departemen',
		'Staf Divisi',
		'Anggota',
		'Ketua Pelaksana',
		'Koordinator Acara',
		'Koordinator Humas',
		'Koordinator Publikasi dan Dokumentasi',
		'Koordinator Logistik',
		'Koordinator Konsumsi',
		'Koordinator Dana Usaha',
		'Relawan'
	],
	cities: CITIES,
	provinces: PROVINCES,
	languages: [
		'Bahasa Indonesia',
		'Bahasa Inggris',
		'Bahasa Jawa',
		'Bahasa Sunda',
		'Bahasa Mandarin',
		'Bahasa Jepang',
		'Bahasa Korea',
		'Bahasa Arab',
		'Bahasa Jerman',
		'Bahasa Prancis',
		'Bahasa Belanda',
		'Bahasa Spanyol'
	],
	categoryKeywords: [
		['data', 'data'],
		['analis', 'data'],
		['analyst', 'data'],
		['develop', 'it'],
		['programmer', 'it'],
		['software', 'it'],
		['software engineer', 'it'],
		[' it ', 'it'],
		['elektro', 'engineering'],
		['electrical', 'engineering'],
		['mesin', 'engineering'],
		['mechanical', 'engineering'],
		['jaringan', 'it'],
		['network', 'it'],
		['desain', 'design'],
		['design', 'design'],
		['ui', 'design'],
		['ux', 'design'],
		['video', 'design'],
		['konten', 'marketing'],
		['content', 'marketing'],
		['marketing', 'marketing'],
		['pemasaran', 'marketing'],
		['sosial media', 'marketing'],
		['social media', 'marketing'],
		['akunt', 'finance'],
		['keuangan', 'finance'],
		['finance', 'finance'],
		['pajak', 'finance'],
		['audit', 'finance'],
		['bank', 'finance'],
		['admin', 'admin'],
		['sekretaris', 'admin'],
		['hrd', 'hr'],
		[' hr ', 'hr'],
		['rekrut', 'hr'],
		['recruit', 'hr'],
		['personalia', 'hr'],
		['sales', 'sales'],
		['penjualan', 'sales'],
		['business development', 'sales'],
		['customer', 'customer'],
		['pelanggan', 'customer'],
		['call center', 'customer'],
		['teknik', 'engineering'],
		['teknisi', 'engineering'],
		['produksi', 'engineering'],
		['quality', 'engineering'],
		['sipil', 'engineering'],
		['guru', 'education'],
		['tutor', 'education'],
		['pengajar', 'education'],
		['perawat', 'health'],
		['apotek', 'health'],
		['farmasi', 'health'],
		['bidan', 'health'],
		['laboratorium', 'health'],
		['hotel', 'hospitality'],
		['barista', 'hospitality'],
		['front office', 'hospitality'],
		['logistik', 'logistics'],
		['gudang', 'logistics'],
		['purchasing', 'logistics'],
		['pengadaan', 'logistics'],
		['legal', 'legal'],
		['hukum', 'legal'],
		['operasional', 'operations'],
		['operation', 'operations'],
		['pertanian', 'agriculture'],
		['perkebunan', 'agriculture'],
		['agronom', 'agriculture'],
		['penyuluh', 'agriculture'],
		['jurnalis', 'media'],
		['reporter', 'media'],
		['wartawan', 'media'],
		['public relations', 'media'],
		['humas', 'media'],
		['pemerintah', 'public'],
		['asn', 'public'],
		['pns', 'public'],
		['kebijakan', 'public'],
		['pranata', 'public'],
		['store', 'retail'],
		['toko', 'retail'],
		['ritel', 'retail'],
		['retail', 'retail'],
		['spg', 'retail'],
		['merchandis', 'retail'],
		['arsitek', 'construction'],
		['site engineer', 'construction'],
		['konstruksi', 'construction'],
		['estimator', 'construction'],
		['surveyor', 'construction'],
		['tambang', 'mining'],
		['geolog', 'mining'],
		['hse', 'mining'],
		['ekspedisi', 'transport'],
		['dispatcher', 'transport'],
		['bandara', 'transport'],
		['transport', 'transport'],
		['peneliti', 'research'],
		['research', 'research'],
		['enumerator', 'research'],
		['event', 'event'],
		['acara', 'event'],
		['fasilitator', 'social'],
		['lsm', 'social'],
		['ngo', 'social'],
		['sosial', 'social']
	]
};
