# CV Maker — AI API

Server kecil Node.js untuk **Bantuan AI** (headline, ringkasan, saran skill). Berjalan di VPS
(PM2, `127.0.0.1:8787`), di belakang nginx pada `https://cvmaker.codiosity.com/api/`.

- Data yang dikirim browser hanya isi CV yang dibutuhkan (posisi, pendidikan, pengalaman, skill,
  ringkasan). **Tidak pernah** nama, email, telepon, kota, link, atau foto — lihat
  `src/lib/core/ai/index.ts` (`aiProfileFromCv`).
- Server **tidak menyimpan isi CV** dan tidak mencatatnya di log. Yang disimpan hanya penghitung
  kuota harian (ID perangkat acak, hash IP) di MySQL; data lebih dari 7 hari dihapus otomatis.
- Kuota: 3× per perangkat per hari (reset 00:00 WIB), plus batas per IP dan batas total harian.
  Kuota hanya berkurang jika AI berhasil memberi jawaban.
- Jawaban AI diperiksa: angka yang tidak ada di CV diganti `[isi angka]`, markdown/emoji/link
  dibuang, skill yang sudah ada tidak disarankan lagi.

## Sekali saja (owner)

1. **Database** — Hestia → DB → Add Database: `cvmaker` (jadi `el_cvmaker`), user `cvmaker`,
   charset utf8mb4. Tabel dibuat otomatis oleh server.
2. **File pengaturan** — buat file ini lewat WinSCP (bukan di repo, bukan di chat):

   `/home/el/web/cvmaker.codiosity.com/private/cvmaker-api.env`

   Salin isi `server/env.example`, isi nilainya. Lalu ubah izin file menjadi **600**
   (WinSCP: klik kanan → Properties → Permissions `rw-------`).

3. **Template nginx** dengan lokasi `/api/` — `deploy/hestia/install.sh` (sekali, sebagai root).
4. **Deploy** — repo private `CV_Maker-deploy` → Actions → Run workflow. Workflow membangun
   `server.mjs`, menjalankannya dengan PM2 (`cvmaker-api`), cek `/api/health`, dan kembali ke
   versi sebelumnya bila gagal. Tanpa file pengaturan, langkah API dilewati.

## Pengembangan

```bash
pnpm build:server                       # → server/dist/server.mjs (satu file, tanpa node_modules)
node --env-file=server/.env server/dist/server.mjs
```

Tanpa `DB_NAME`, kuota disimpan di memori (hanya untuk pengembangan). Test: `tests/unit/ai-*.test.ts`.

## Endpoint

| Method | Path             | Isi                                                                 |
| ------ | ---------------- | ------------------------------------------------------------------- |
| GET    | `/api/health`    | `{ ok: true }`                                                      |
| GET    | `/api/ai/quota`  | `{ limit, remaining, resetsAt }` (header `X-Device-Token` opsional) |
| POST   | `/api/ai/device` | `{ token }` — token perangkat anonim                                |
| POST   | `/api/ai/run`    | body `{ task, profile }` → `{ result, quota }`                      |

Error: `{ error: 'quota' | 'busy' | 'offline' | 'unavailable' | 'invalid' | 'failed', quota? }`.

## Iklan reward (+1 bantuan AI per iklan, maks. 10 per hari)

Jatah habis → user **memilih** "Tonton iklan" → tab baru `https://iklan.codiosity.com` (folder
`adsite/`, origin terpisah sehingga script iklan tidak bisa membaca data CV) → iklan rewarded
Google Ad Manager → halaman iklan menukar tiket ke `/api/ai/reward/claim` → jatah +1.

Google tidak memberi konfirmasi server-ke-server untuk iklan web, jadi klaim butuh tiket yang
ditandatangani, terikat ke perangkat, sekali pakai, minimal `AI_REWARD_MIN_SECONDS` setelah mulai,
dan dibatasi per perangkat (`AI_LIMIT_REWARDS`) serta per IP. Kecurangan paling jauh hanya sampai
batas harian.

Menyalakan (owner):

1. Google Ad Manager → unit iklan format **Rewarded** → isi `adUnitPath` di `adsite/config.js`
   (`'/<network code>/<ad unit code>'`, bukan rahasia) lewat PR.
2. Hestia → Add Web Domain `iklan.codiosity.com` + SSL; DNS `iklan` → IP VPS. Deploy mengisi
   folder `public_html`-nya.
3. `ads.txt` di `codiosity.com` (baris dari AdSense/Ad Manager).
4. File env: `ADS_ENABLED=true`, lalu deploy ulang.

## Akun & Bagikan CV (Fase 2)

Login **opsional** — hanya dibutuhkan untuk membagikan CV lewat link (`/u/<slug>`). Kode:
`src/account/` (routes, store MySQL, Google OAuth, email). Tabel dibuat otomatis saat start:
`cvmaker_users`, `cvmaker_sessions`, `cvmaker_tokens`, `cvmaker_shares`, `cvmaker_share_reports`.

Yang disimpan: email, nama (opsional), hash scrypt kata sandi atau ID akun Google, **hash** token
sesi/email, dan — hanya untuk CV yang dibagikan — salinan CV yang sudah dibuang field
tersembunyinya (dicek ulang di server) serta foto. Log tidak berisi email, nama, atau isi CV.

Menyalakan (owner), lalu deploy ulang:

1. **Google** — Google Cloud → Google Auth Platform: Branding (CV Maker, domain `codiosity.com`),
   Audience External + _Publish app_, scope `openid email profile`. Clients → Web application,
   redirect URI `https://cvmaker.codiosity.com/api/auth/google/callback`. Isi `GOOGLE_CLIENT_ID`
   dan `GOOGLE_CLIENT_SECRET` di file env.
2. **Email** (daftar dengan email + reset kata sandi) — Hestia → Mail → akun `noreply@codiosity.com`.
   Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Pasang SPF/DKIM/DMARC di
   DNS agar tidak masuk spam.

Tanpa pengaturan itu server tetap jalan; `GET /api/auth/me` melaporkan `providers` yang mati dan UI
menampilkan "Login belum tersedia".

| Method | Path                        | Isi                                                                       |
| ------ | --------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/auth/me`              | `{ user \| null, providers: { google, password } }`                       |
| GET    | `/api/auth/google?next=/cv` | 302 ke Google (PKCE + state cookie bertanda tangan)                       |
| POST   | `/api/auth/register`        | `{ email, password, name, locale }` → `{ user }`                          |
| POST   | `/api/auth/login`           | `{ email, password }` → `{ user }`                                        |
| POST   | `/api/auth/logout`          | `{ ok }`                                                                  |
| POST   | `/api/auth/verify`          | `{ token }` dari link email (fragmen `#token=`)                           |
| POST   | `/api/auth/reset`           | `{ email, locale }` → selalu `{ ok }`                                     |
| POST   | `/api/auth/reset/confirm`   | `{ token, password }` → `{ user }` (sesi lain berakhir)                   |
| POST   | `/api/auth/delete`          | `{ confirm: true }` → akun + semua link dihapus permanen                  |
| GET    | `/api/shares`               | `{ shares }` milik user                                                   |
| PUT    | `/api/shares/:cvId`         | simpan/bagikan (perlu email terkonfirmasi)                                |
| POST   | `/api/shares/:cvId/rotate`  | link baru, link lama mati                                                 |
| DELETE | `/api/shares/:cvId`         | hapus salinan dari server                                                 |
| GET    | `/api/s/:slug`              | CV untuk pengunjung; 401 `password`; 404 untuk semua kasus tidak tersedia |
| POST   | `/api/s/:slug/report`       | `{ reason }`                                                              |

Pengelola situs bisa mematikan link yang dilaporkan: `UPDATE cvmaker_shares SET blocked = 1 WHERE slug = '…'`
(laporan ada di `cvmaker_share_reports`).

## Batas, penyimpanan, dan Google Drive

- **Membuat CV tidak dibatasi** dan selalu tersimpan lokal di browser (login atau tidak).
- **VPS hanya menyimpan CV yang dibagikan**: maksimal **3 per akun** (`MAX_SHARED_CVS` di
  `src/lib/core/share/index.ts`), dicek di server sehingga tidak bisa diakali dari browser.
- **Cadangan hanya ke Google Drive milik user** (gratis), tidak ke VPS. User login yang menghubungkan
  Drive mendapat cadangan otomatis (default aktif, bisa dimatikan di `/akun`), paling sering 30
  menit sekali setelah ada perubahan. Izin `drive.file` (hanya file buatan CV Maker); OAuth client &
  redirect URI sama dengan login Google. Refresh token disimpan **terenkripsi** AES-256-GCM (kunci dari
  `APP_SECRET`) di tabel `cvmaker_drive`. File cadangan (format `backupRepo.export()`) dibersihkan
  ulang di server (`src/account/backup-file.ts`) dan hanya melewati server.

Menyalakan Drive (owner): Google Cloud → **APIs & Services → Library → Google Drive API → Enable**,
lalu di Google Auth Platform → Data access tambahkan scope `.../auth/drive.file`.

| Method | Path                    | Isi                                                                |
| ------ | ----------------------- | ------------------------------------------------------------------ |
| GET    | `/api/drive`            | `{ available, connected, lastBackupAt }`                           |
| GET    | `/api/drive/connect`    | 302 ke izin Google Drive                                           |
| POST   | `/api/drive/backup`     | file cadangan → simpan ke Drive; 409 `reconnect` bila izin dicabut |
| GET    | `/api/drive/backup`     | file cadangan dari Drive (dibersihkan)                             |
| POST   | `/api/drive/disconnect` | cabut izin + hapus token                                           |

Tabel `cvmaker_backups` (dari rilis sebelumnya, bila ada) tidak dipakai lagi dan boleh dihapus.
