# Panduan Deploy Balita Center — Pembaruan 8 November 2026

Membawa situs live (yang masih versi lama) ke kode terbaru di branch `main`
repo ini: laporan harian ala portal lama + PDF, rapor periodik, media
laporan (video & foto rapor), form kesehatan & perkembangan, pemilih
material AMI, kelola katalog Akademik, kunci DeepSeek dari aplikasi,
pilihan model bebas, dan pengiriman tagihan SPP via email.

Urutan di dokumen ini aman dijalankan berurutan. Perkiraan waktu: 30–45
menit termasuk build.

---

## 1. Backup dulu (wajib)

```bash
pg_dump "$DATABASE_URL" > backup-sebelum-deploy-$(date +%F-%H%M).sql
```

Simpan di luar folder aplikasi. Jangan lanjut bila backup gagal.

## 2. Ambil kode terbaru

```bash
cd /path/ke/balita-center
git pull origin main
npm ci
```

## 3. Migrasi database (untuk database live yang sudah berjalan)

Database live sudah memiliki skema dasar, jadi jalankan HANYA migrasi
inkremental sesi 8 November ini, sesuai urutan:

```bash
psql "$DATABASE_URL" -f database/migrasi-rapor.sql
psql "$DATABASE_URL" -f database/migrasi-media.sql
psql "$DATABASE_URL" -f database/migrasi-ailsa-kunci.sql
psql "$DATABASE_URL" -f database/migrasi-ailsa-channel.sql
psql "$DATABASE_URL" -f database/migrasi-gateway.sql
psql "$DATABASE_URL" -f database/migrasi-identitas.sql
psql "$DATABASE_URL" -f database/migrasi-gateway-order.sql
psql "$DATABASE_URL" -f database/migrasi-status-tagihan.sql
psql "$DATABASE_URL" -f database/migrasi-pengguna-login.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap1.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-penerimaan.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-insidentil.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-laporan.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-rapor.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-event.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-skrining.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap3-minat.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap4.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap5.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap2-kerangka.sql
psql "$DATABASE_URL" -f database/migrasi-zkc-tahap2-kurikulum.sql
```

Semua migrasi memakai `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`,
jadi aman bila sebagian ternyata sudah pernah diterapkan.

> Untuk pemasangan BARU dari nol urutannya berbeda: jalankan
> `database/balita-center-database.sql` lalu `database/02-migrasi-dan-seed.sql`
> (file gabungan itu sudah memuat seluruh migrasi di atas).

## 4. Variabel lingkungan

Pastikan env aplikasi (`.env` / `.env.local` / env service) memuat:

| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Koneksi PostgreSQL |
| `AUTH_SECRET` | ya | Rahasia penanda sesi login |
| `APP_BASE_URL` | ya | Alamat publik, mis. `https://balita.rotalogic.id` |
| `UPLOAD_DIR` | ya | Folder berkas unggahan yang persisten |
| `JOB_TOKEN` | ya (untuk cron) | Token rahasia pemicu job tagihan. Buat dengan `openssl rand -hex 24`. Nilainya harus sama dengan yang dipakai skrip cron (langkah 6) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | untuk email | Tanpa ini email tagihan/pengingat tercatat "menunggu_kanal" dan tidak terkirim; aplikasi tetap berjalan |
| `AILSA_LLM_API_KEY` | tidak | Cadangan saja — kunci utama kini diisi admin dari halaman Ailsa |

Sesudah mengubah env, restart aplikasi.

## 5. Build & nyalakan

```bash
npm run build
# lalu restart dengan cara yang dipakai server ini (systemd/pm2/dll), mis.:
# systemctl restart balita-center
curl -s https://balita.rotalogic.id/api/health   # harus {"ok":true,"db":"ok"}
```

**Penting — mode standalone:** aplikasi dibangun dengan `output: "standalone"`.
Bila server dijalankan dari `.next/standalone/server.js`, folder `public/` dan
`.next/static` TIDAK ikut tersalin otomatis dan harus disalin manual setiap
deploy, kalau tidak gambar ilustrasi (`/ilustrasi/...`) dan aset statis akan
404 (gejala: gambar rusak di laporan web):

```bash
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
```

Verifikasi sesudah restart (dengan sesi login): buka
`https://balita.rotalogic.id/ilustrasi/sampul-laporan.jpg` — harus tampil
gambar, bukan 404. Smoke test (langkah 10) juga memeriksanya otomatis.

## 6. Pasang cron job tagihan

Simpan token di file khusus (jangan di crontab langsung):

```bash
sudo mkdir -p /etc/balita-center
sudo sh -c 'printf "APP_URL=https://balita.rotalogic.id\nJOB_TOKEN=<token-yang-sama>\n" > /etc/balita-center/job.env'
sudo chmod 600 /etc/balita-center/job.env
chmod +x deploy/job-tagihan.sh
```

Lalu `crontab -e` dan tambahkan (zona waktu server diasumsikan WIB;
bila server memakai UTC, kurangi 7 jam):

```cron
# Tagihan SPP bulan berikutnya dibuat setiap tanggal 25 pukul 06.00 WIB
0 6 25 * * /path/ke/balita-center/deploy/job-tagihan.sh buat >> /var/log/balita-job.log 2>&1
# Pengingat H-3 & H+1 diperiksa setiap hari pukul 07.00 WIB
0 7 * * * /path/ke/balita-center/deploy/job-tagihan.sh pengingat >> /var/log/balita-job.log 2>&1
```

Uji sekali dengan tangan sebelum menunggu jadwal:

```bash
/path/ke/balita-center/deploy/job-tagihan.sh pengingat
```

Balasan harus `{"ok":true,...}`. Job aman dijalankan berulang: tagihan
tidak akan ganda dan pengingat yang sama tidak terkirim dua kali.

Cara kerja pengiriman tagihan per tagihan baru:
- notifikasi dalam aplikasi ke wali — selalu;
- email ke wali berisi rincian + lampiran PDF tagihan — bila SMTP terisi;
- WhatsApp — hanya bila kanal Meta aktif (saat ini nonaktif atas
  keputusan pemilik, tercatat "menunggu_kanal").

Setiap pengiriman tercatat di tabel `invoice_notifications`
(channel: dalam_aplikasi / email / whatsapp).

## 7. Backup database otomatis

- Skrip `deploy/backup-db.sh` membuat dump PostgreSQL (format custom) ke
  `/var/backups/balita-center/` dan mempertahankan 14 berkas terbaru.
  DATABASE_URL dibaca dari `/etc/balita-center/job.env` yang sama dengan
  job tagihan. Cron-nya ada di langkah 6.
- Uji jalan sekali secara manual setelah deploy:
  `/opt/balita-center/deploy/backup-db.sh` lalu periksa berkasnya dengan
  `pg_restore --list <berkas.dump> | head`.
- Memulihkan (latih dulu di database kosong terpisah, jangan langsung
  ke produksi): `pg_restore --clean --if-exists -d "$DATABASE_URL" <berkas.dump>`.
- Folder backup berada di server yang sama; untuk ketahanan penuh,
  salin berkala ke luar server (mis. rclone ke penyimpanan objek) —
  di luar cakupan panduan ini.

## 8. Payment gateway Midtrans (opsional, bisa menyusul)

1. Di dashboard Midtrans sekolah: ambil Server Key & Client Key
   (Settings → Access Keys), dan atur **Payment Notification URL** ke
   `https://balita.rotalogic.id/api/payments/webhook`.
2. Di aplikasi: halaman Keuangan → kartu "Payment Gateway — Midtrans" →
   tempel kedua kunci, mulai dari mode **Sandbox**, Simpan, lalu Uji
   Server Key. Aktifkan bila uji sandbox sudah benar.
3. Sesudah aktif, orang tua melihat tombol **Bayar Sekarang** di Balita
   Connect; status Lunas + kwitansi berjalan otomatis dari webhook.
   Pembayaran manual oleh staf tetap berjalan berdampingan.
4. Pindah ke mode **Produksi** hanya sesudah alur sandbox terverifikasi
   dengan satu pembayaran uji sungguhan di sandbox.

## 9. Sesudah deploy — tiga hal di dalam aplikasi

1. **Tempel kunci DeepSeek asli**: halaman Ailsa → kartu "Kunci LLM —
   DeepSeek" → tempel kunci, pilih/ muat model, Simpan, lalu Uji
   Koneksi. Jangan kirim kunci lewat chat.
2. **Coba Simulator Ailsa** dengan satu pertanyaan orang tua; jawaban
   asli DeepSeek harus muncul (bukan pesan fallback).
3. **Jalankan job sekali dari aplikasi** (sebagai super admin, jalur
   manual kini memakai izin `finance.manage`) atau lewat skrip di
   langkah 6, lalu periksa `invoice_notifications` untuk periode uji.

## 10. Catatan perbaikan yang ikut dalam rilis ini

- Middleware kini mengecualikan `/api/jobs/*` bila membawa header
  `x-job-token` (token tetap divalidasi di route). Sebelumnya cron
  selalu tertahan 401 di middleware dan job terjadwal tidak pernah bisa
  berjalan.
- Izin jalur manual job diperbaiki dari `finance.update` (tidak ada di
  sistem izin) menjadi `finance.manage`.

## 11. File workflow GitHub (terpisah dari deploy)

`.github/workflows/build.yml` (isi sama dengan `build-check-workflow.yml`
di akar repo bila masih ada) perlu ditambahkan lewat web GitHub atau git
dengan token ber-scope `workflow`, karena token mesin pembangunan tidak
memiliki scope itu. Ini hanya untuk cek build otomatis di GitHub; tidak
menghambat deploy.
