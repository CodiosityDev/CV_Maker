# Deploy ke VPS (HestiaCP + nginx)

Situs ini statis (SvelteKit `adapter-static`): hasil `pnpm build` cukup disajikan nginx.
Tidak perlu database maupun proses Node yang terus berjalan.

- Domain: `cvmaker.codiosity.com` (lewat proxy Cloudflare) · user Hestia: `el`
- Folder situs: `/home/el/web/cvmaker.codiosity.com/public_html`
- Deploy: **manual** dari repo **private** `CodiosityDev/CV_Maker-deploy` →
  **Actions → Deploy CV Maker → Run workflow**. Berjalan di **self-hosted runner** di VPS (sama
  seperti situs Codiosity), tanpa SSH. Hanya commit `main` yang **CI-nya sudah lulus** yang bisa di-deploy.
- Repo ini (publik) **tidak boleh** memakai runner VPS: PR dari fork bisa menjalankan kode di sana.
  Karena itu workflow deploy sengaja ada di repo private terpisah.

## Isi folder ini

| File                    | Fungsi                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cv-static.tpl/.stpl`   | Template web Hestia: `/buat` & `/cv/...` → `200.html` (refresh tidak 404), header keamanan (= `static/_headers`), cache 1 tahun untuk `/_app/immutable/*`, HTTP → HTTPS. |
| `security-headers.conf` | Header keamanan, dipasang ke `/etc/nginx/snippets/`.                                                                                                                     |
| `install.sh`            | Memasang template (deteksi otomatis nginx saja / nginx + Apache); mengembalikan template lama jika `nginx -t` gagal.                                                     |

## Sekali saja

1. **SSL** — panel Hestia → **Web** → `cvmaker.codiosity.com` → **Enable SSL** + **Use Let's Encrypt**. ✅
2. **Cloudflare** (zona `codiosity.com`):
   - SSL/TLS → mode **Full (strict)**.
   - Matikan **Rocket Loader**, **Email Address Obfuscation**, dan injeksi **Web Analytics (RUM)** —
     semuanya menyisipkan script pihak ketiga yang diblokir CSP.
3. **Template nginx** (butuh root, sekali): unggah folder `deploy/hestia` ke `/root/cvmaker-hestia`
   (WinSCP sebagai root), lalu di terminal root:

   ```bash
   bash /root/cvmaker-hestia/install.sh el
   ```

4. **Runner**: **CodiosityDev → Settings → Actions → Runner groups** → grup runner VPS →
   _Repository access_: sertakan **`CV_Maker-deploy`** (bukan `CV_Maker`). Biarkan
   **"Allow public repositories" mati**.

## Setiap rilis

1. Merge ke `main` di repo ini, tunggu **CI** hijau.
2. Repo `CV_Maker-deploy` → **Actions → Deploy CV Maker → Run workflow** (kolom _ref_ kosong =
   `main` terbaru; isi SHA untuk rollback ke commit lama yang pernah lulus CI).

Workflow: cek commit ada di `main` & CI lulus → install & build (prioritas rendah) → salin ke `public_html`
(aset dulu, HTML terakhir; chunk lama tetap ada untuk tab yang masih terbuka) → cek situs live
memakai build baru, `/cv/...` tidak 404, dan header keamanan aktif.

Darurat tanpa GitHub: `pnpm build`, lalu unggah **isi** `build/` ke folder situs (WinSCP).

## Mengubah konfigurasi nginx

Edit file di repo ini, unggah ulang ke VPS, jalankan lagi `install.sh el`. Jangan edit file di
`/usr/local/hestia/data/templates/...` langsung — tertimpa saat instal ulang.
