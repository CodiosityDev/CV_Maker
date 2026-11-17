/** Privacy page — Bahasa Indonesia. Registered by /privasi only (not part of the landing bundle). */
export const privacyId = {
	privacy: {
		backupTitle: 'Cadangan di Google Drive (khusus akun)',
		backupCopy:
			'Server CV Maker hanya menyimpan CV yang kamu bagikan (maksimal 3). CV lain tidak pernah dicadangkan ke server. Jika kamu login dan menghubungkan Google Drive, file cadangan semua CV-mu (termasuk surat lamaran dan foto) disimpan di Drive milikmu, otomatis setelah ada perubahan jika kamu tidak mematikannya.',
		driveCopy:
			'CV Maker hanya meminta izin untuk file yang ia buat sendiri dan tidak bisa membaca file lain di Drive-mu. Token aksesnya disimpan terenkripsi, file cadangan hanya melewati server saat dikirim, dan kamu bisa memutuskan sambungan kapan saja.',
		accountTitle: 'Akun (opsional)',
		accountCopy:
			'Akun hanya dibutuhkan untuk membagikan CV lewat link. Server menyimpan email, nama (jika diisi), hash kata sandi (bukan kata sandinya) atau ID akun Google, dan sesi login dalam bentuk hash. Login dengan Google hanya meminta nama dan email. Email hanya dipakai untuk konfirmasi dan atur ulang kata sandi. Sesi login memakai satu cookie penting (HttpOnly) yang hanya dikirim ke situs ini.',
		shareTitle: 'CV yang dibagikan',
		shareCopy:
			'Saat kamu menekan Simpan & bagikan, salinan CV itu disimpan di server CV Maker sesuai pilihanmu: nomor HP, email, kota, dan foto hanya ikut jika kamu menyalakannya, dan surat lamaran tidak pernah ikut. Kamu memilih siapa yang bisa melihat (pribadi, siapa saja yang punya link, atau publik) dan bisa memberi sandi atau tanggal kedaluwarsa. Link yang tidak publik ditandai agar tidak diindeks mesin pencari. Server menghitung jumlah dilihat tanpa menyimpan alamat IP pengunjung. Laporan dari pengunjung disimpan tanpa identitas pelapor.',
		accountDeleteCopy:
			'Kamu bisa menghentikan berbagi atau menghapus salinan CV dari server kapan saja, serta menghapus akun beserta semua link-nya secara permanen di halaman Akun. CV di perangkatmu tidak ikut terhapus.',
		convertCopy:
			'Ubah jadi CV ATS tanpa AI berjalan di perangkatmu. Jika kamu memilih Rapikan dengan AI dan setuju, teks tanpa nama, kontak, tautan, dan alamat dikirim melalui server CV Maker ke penyedia AI. Hasil konversi tersedia sementara di memori server maksimal 2 menit setelah siap untuk diambil browser, tanpa disimpan ke database. CV baru disimpan di perangkatmu setelah kamu memilih Simpan & buka editor.',
		scanTitle: 'Cek ATS',
		scanCopy:
			'File CV dibaca di perangkat, tidak dikirim ke server, dan tidak disimpan. Hanya bila kamu menekan Minta saran AI dan setuju, teks CV tanpa nama, kontak, tautan, dan alamat dikirim melalui server CV Maker ke penyedia AI. Teks tidak disimpan.',
		title: 'Privasi — CV Maker',
		description:
			'Cara CV Maker menyimpan data di perangkatmu dan menghapusnya melalui pengaturan browser.',
		heading: 'Privasi data CV',
		intro: 'Data CV dan foto disimpan di browser pada perangkat yang kamu gunakan.',
		storageTitle: 'Tersimpan di browser, akun opsional',
		storageCopy:
			'Data CV dan preferensi bahasa tersimpan di browser. Semua fitur bisa dipakai tanpa akun, dan CV tidak disinkronkan antarperangkat.',
		trackingTitle: 'Tanpa pelacak pihak ketiga',
		trackingCopy:
			'Kami tidak memasang pelacak pihak ketiga di halaman CV Maker. Font dimuat dari situs ini. Isi CV hanya dikirim jika kamu menyetujui Bantuan AI atau memilih membagikan CV.',
		aiTitle: 'Bantuan AI',
		aiCopy:
			'Bantuan AI bersifat opsional, hanya dipanggil setelah tombol diklik dan kamu memberi persetujuan. Posisi tujuan, pendidikan dan nilai, pengalaman, organisasi, proyek, skill, sertifikasi, ringkasan, serta bahasa CV dikirim melalui server CV Maker ke penyedia AI pihak ketiga. Nama, email, telepon, kota, link, dan foto tidak dikirim. Isi CV tidak disimpan di server. Penghitung jatah anonim disimpan selama 7 hari.',
		adsTitle: 'Iklan',
		adsCopy:
			'Banner iklan kecil hanya tampil di bagian bawah beranda serta di halaman FAQ dan Tentang. Banner dimuat dari iklan.codiosity.com di dalam bingkai terpisah, sehingga script iklan tidak bisa membaca halaman CV Maker. Editor, Buat CV, Cek ATS, halaman cetak, dan CV yang dibagikan tidak memuat iklan. Iklan untuk tambahan jatah AI hanya dibuka di tab terpisah jika kamu memilih menontonnya. Iklan disediakan Google Ad Manager dan tidak dipersonalisasi.',
		visitorsCopy:
			'Untuk menghitung pengunjung, browser menyimpan ID acak tanpa nama atau data CV dan tanpa cookie. Penghitung di server hanya menyimpan hash dari ID dan alamat IP, bukan ID atau IP aslinya. ID di browser ikut dihapus saat kamu memilih Hapus semua data. Dalam Mode Incognito, ID hanya ada di memori tab dan tidak disimpan di browser.',
		photoTitle: 'Foto dan metadata lokasi',
		photoCopy:
			'Foto untuk CV Creative diproses di perangkat: ukurannya diperkecil dan dikodekan ulang untuk membuang metadata EXIF, termasuk lokasi GPS. Foto tetap disimpan di browser.',
		deleteTitle: 'Menghapus data',
		deleteCopy:
			'Hapus data situs melalui pengaturan browser. Ini akan menghapus CV, foto, dan preferensi bahasa yang tersimpan di browser tersebut.',
		lossTitle: 'Jika data browser terhapus',
		lossCopy:
			'CV bisa hilang jika data browser dihapus, perangkat rusak, atau browser diganti. Unduh PDF/Word sebagai arsip sebelum menghapus data browser.',
		sharedCopy:
			'Di komputer umum, buka halaman Buat CV lalu tekan tombol Incognito di bagian atas sebelum membuat CV. Data hanya ada di tab ini, hilang saat tab ditutup atau di-refresh, dan dihapus otomatis setelah 3 jam tanpa perubahan. Unduh CV sebelum selesai, hapus file dari folder Download, pilih Akhiri & hapus, lalu tutup tab. Jangan simpan password/akun di browser.',
		back: 'Kembali ke beranda'
	}
};
