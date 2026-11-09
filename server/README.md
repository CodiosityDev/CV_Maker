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
