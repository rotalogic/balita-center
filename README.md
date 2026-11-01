# Balita Center: Paket Source Code untuk VPS

ERP PAUD/Montessori multi-cabang Balita Center sebagai proyek mandiri
**Next.js 14 + React + TypeScript + PostgreSQL 16**, siap dipasang di VPS
dan dikembangkan lanjut. Paket ini adalah padanan source code dari aplikasi
Balita Center yang berjalan hosted di Muse, dengan database PostgreSQL
yang sama persis (file SQL 1 file di folder `database/`).

## Isi paket

| Bagian | Isi |
|---|---|
| `src/app/login/` | Layar login meniru versi Muse (panel visual + kartu login + pemilih 10 peran). Konteks kerja berlabel, bukan autentikasi sungguhan |
| `src/app/(admin)/` | Dashboard (KPI, grafik laporan 7 hari, jadwal hari ini, aktivitas terbaru, antrean persetujuan), Anak Didik (daftar + ringkasan + filter, wizard tambah 4 langkah + Data Awal, detail 4 tab), Daily Reports (tab status + ekspor CSV, editor dua kolom multi-aktivitas dengan Timeline Hari Ini dan tanda tangan guru, Review & Approval dengan tab, pratinjau, dan checklist syarat terbit), serta halaman modul khusus Akademik, Admission, Keuangan, SDM, Cabang, Laporan, Investor, Komunikasi, Pengaturan yang membaca data tabel aslinya |
| `src/app/(parent)/connect/` | Balita Connect 9 seksi: dashboard orang tua, Pesan, Detail Daily Report (hanya laporan terbit), Perkembangan, Kesehatan, Kegiatan + RSVP, Galeri, Pembayaran, Pengaturan |
| `src/app/api/` | `stats`, `counts`, `meta` (data awal cabang/program/kelas/staf), `children` (GET/POST + detail), `daily-reports` (GET/POST + detail + review), `dashboard`, `finance` (tagihan, SPP massal, konfirmasi bayar masuk Buku Kas), `hr` (staf, cuti, keputusan cuti), `modules` (admission/cabang/investor/komunikasi/pengaturan/akademik/laporan), `connect` (data orang tua + RSVP) |
| `src/lib/db.ts` | Pool PostgreSQL (`pg`) dari `DATABASE_URL` |
| `database/balita-center-database.sql` | Skema lengkap 66 tabel, 158 FK, seed RBAC 10 peran/23 izin/105 pemetaan, kueri verifikasi |
| `docker-compose.yml` | Aplikasi + PostgreSQL satu perintah, SQL terpasang otomatis saat database pertama kali dibuat |
| `Dockerfile` | Build produksi Next.js standalone |

Desain mengikuti sistem visual Balita Center: krem hangat `#FFF9F0`, biru tua
`#173FAD`, teal `#008F83`, sage `#BCE9D7`, font Plus Jakarta Sans + Inter,
sidebar teks 240px, radius 12-20px. Paket ini memakai CSS variabel bertoken
(`src/app/globals.css`) alih-alih Tailwind agar instalasi di VPS ringan;
token warna, tipografi, dan radiusnya sama dengan brief.

## Cara pasang di VPS (Docker, disarankan)

Prasyarat: Docker + Docker Compose terpasang di VPS.

```bash
unzip Balita-Center-Source-Code-VPS.zip
cd balita-center-app
# GANTI kata sandi di docker-compose.yml (POSTGRES_PASSWORD dan DATABASE_URL)
docker compose up -d --build
```

Aplikasi jalan di `http://IP-VPS:3000`, PostgreSQL di port `54329`.
File SQL di folder `database/` otomatis dijalankan saat volume database
pertama kali dibuat. Bila volume sudah pernah dibuat dan Anda ingin memasang
ulang dari nol: `docker compose down -v` lalu `docker compose up -d --build`
(PERINGATAN: menghapus semua data).

## Cara pasang tanpa Docker

Prasyarat: Node.js 18.18+ dan PostgreSQL 16.

```bash
createdb balita_center
cp .env.example .env.local   # isi DATABASE_URL
npm run db:setup              # memasang database/balita-center-database.sql
npm install
npm run build
npm run start                 # http://localhost:3000
```

Mode pengembangan: `npm run dev`.

## Urutan pemakaian pertama (database memang kosong)

1. Buka aplikasi, masuk menu **Anak Didik, Tambah Anak**.
2. Di panel **Data Awal**, buat berurutan: cabang, program, kelas, staf.
3. Isi formulir anak (4 bagian) lalu simpan.
4. Buat **Daily Report**, pilih fasilitator utama, isi aktivitas berbintang
   dengan aparatus dan URL foto, lalu kirim untuk review.
5. Di **Review & Approval**, setujui dan terbitkan. Penerbitan dijaga trigger
   PostgreSQL: laporan yang syaratnya belum lengkap ditolak database dan
   pesan penolakannya tampil di layar.
6. Buka **Balita Connect** dari tautan portal orang tua untuk melihat sisi
   orang tua (laporan terbit, kesehatan, perkembangan, kegiatan + RSVP, pesan).

## Batas paket ini (jujur)

- Layar login meniru tampilan versi Muse tetapi tetap konteks kerja
  berlabel: kata sandi tidak diperiksa, peran hanya disimpan sebagai label
  di peramban. Untuk produksi, tambahkan Auth.js/NextAuth dan kaitkan
  `user_roles` + `user_branches`.
- Balita Connect membaca anak pertama menurut abjad sebagai konteks demo
  orang tua. Produksi wajib memetakan akun orang tua ke anaknya.
- Belum ada integrasi WhatsApp (Bot Ailsa) dan payment gateway; tabel,
  antrean, dan alur datanya sudah disiapkan di skema, dan halaman Admission
  membacanya. Pembayaran dicatat + dikonfirmasi staf dan masuk Buku Kas.
- Unggah foto berkas belum memakai storage S3/R2; dokumentasi laporan
  dicatat sebagai URL media dan tampil di Galeri orang tua setelah terbit.
- Alur kerja penuh yang berfungsi: data awal, anak didik, laporan harian
  sampai terbit, SPP massal + konfirmasi pembayaran, dan keputusan cuti.
  Halaman modul lain menampilkan data tabel aslinya (daftar, agregat,
  ringkasan), tetapi formulir tambah/edit per modul itu belum dibuat.
- Tampilan disamakan semirip mungkin dengan versi Muse dalam struktur,
  palet, dan susunan layar; bukan salinan piksel-per-piksel, dan versi Muse
  tetap memuat beberapa layar kerja yang lebih rinci.
- Row Level Security per cabang/anak belum diaktifkan; kolom pendukungnya
  (`branch_id`, `user_branches`, `user_roles`) sudah ada di skema.

## Verifikasi database setelah pasang

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'; -- 66
SELECT COUNT(*) FROM roles;          -- 10
SELECT COUNT(*) FROM permissions;    -- 23
SELECT COUNT(*) FROM role_permissions; -- 105
```
