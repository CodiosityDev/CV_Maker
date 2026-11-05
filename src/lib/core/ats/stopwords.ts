/**
 * Words ignored when extracting keywords from a job post (Indonesian + English).
 * Includes common job-ad filler ("kualifikasi", "requirements", "diutamakan", ...).
 */
export const STOPWORDS = new Set(
	`
yang dan di ke dari untuk dengan pada dalam atau ini itu adalah akan sebagai oleh juga dapat bisa
harus serta tidak ada kami kamu anda kita mereka para sudah telah karena agar sehingga saat bagi
tentang setiap lebih kurang minimal maksimal diutamakan memiliki mampu bersedia berpengalaman
pengalaman tahun bulan lulusan kandidat pelamar posisi perusahaan kerja bekerja pekerjaan lowongan
kualifikasi persyaratan syarat tanggung jawab deskripsi tugas gaji benefit tunjangan penempatan
lokasi jenis kelamin usia pria wanita sesuai baik tinggi secara hal hari jam per dll terkait
berbagai sangat salah satu dua tiga empat lima seperti mulai melalui antara hingga sampai maupun
namun tetapi jika bila apabila yaitu yakni dimana mana siapa apa bagaimana kapan saja hanya masih
belum sedang menjadi dilakukan melakukan membuat memiliki menguasai memahami pemahaman kemampuan
kemauan keinginan bersedia siap baru lama penuh waktu paruh kontrak tetap magang fresh graduate
lulus jurusan bidang terutama khususnya diharapkan dibutuhkan dicari mencari bergabung tim kami
kirim lamaran email whatsapp segera via ke berikut sebagai pt cv tbk min max wib senin jumat sabtu
the and or for with to of in on at a an is are be been will would you we our your their they as
by from this that these those have has had must should can could may able ability abilities
experience experienced years year candidate candidates applicant job jobs role position company
work working requirements requirement qualifications qualification responsibilities responsibility
preferred plus including include etc strong good excellent great minimum least degree bachelor
related field skills skill knowledge understanding proficient proficiency familiar familiarity
apply join looking seeking opportunity full part time contract permanent internship based such
other also well into about any all more most than then there what when where which who why how
not no yes per via within without across new fresh graduates graduate send please us its it
`
		.split(/\s+/)
		.filter(Boolean)
);
