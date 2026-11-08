# Balita Center

ERP untuk PAUD/Montessori multi-cabang: data anak, laporan harian, rapor
periodik, keuangan SPP, admission, dan portal orang tua (Balita Connect).

**Stack:** Next.js 14 (App Router) + React + TypeScript + PostgreSQL 16.
Autentikasi sungguhan (kata sandi scrypt, sesi, RBAC per peran), Jejak Audit
untuk perubahan penting, dan PDF server (pdfkit) yang mengikuti tampilan web.

Versi: **1.2.0**

## Fitur utama

| Area | Isi |
|---|---|
| Anak Didik | Wizard tambah anak, profil 4 tab (Profil, Pendidikan & STPPA, Kesehatan, Laporan & Perkembangan), sampah/pulihkan |
| Kesehatan | **Formulir catat pemeriksaan** (berat, tinggi, lingkar kepala, suhu, status gizi berlabel manusiawi) — mengisi Connect dan panel Tumbuh Kembang rapor |
| Perkembangan | **Formulir penilaian berkala** 7 aspek (persentase) + observasi milestone otomatis dari laporan harian |
| Daily Reports | Editor lengkap: aktivitas dengan **pemilih material katalog AMI + milestone**, area/lokasi/mode kerja, bintang 1–4, Circle Time, Moment Special, Saran di Rumah, foto & **video** (poster otomatis); alur draft → review → terbit dengan Syarat Terbit; tampilan web ala portal + unduh PDF |
| Rapor | Rapor periodik per siklus: 13 narasi (6 aspek STPPA + 5 area Montessori + kesimpulan + saran), agregasi presensi & tumbuh kembang, dokumentasi foto/video, terbit terkunci, PDF mengikuti web |
| Akademik | Siklus belajar, butir STPPA (form + impor CSV), **kelola katalog material & milestone** (tambah, aktif/nonaktif, draf/aktif/arsip, pemetaan material↔milestone) |
| Keuangan | Tagihan SPP per anak/periode + massal, kwitansi otomatis saat lunas, Buku Kas |
| Admission | Pipeline lead (kanban) dari tanya sampai terdaftar |
| Ailsa | Simulator staf (Tahap 0) + Bank Pengetahuan; kanal WhatsApp menunggu kredensial Meta |
| Balita Connect | Portal orang tua terikat akun wali: laporan & rapor terbit saja, perkembangan, kesehatan, galeri foto/video, pembayaran, pesan |
| Lainnya | Absensi, SDM & cuti, Cabang, Laporan & ekspor, Jejak Audit, Pengaturan & pengguna |

## Menjalankan dengan Docker (disarankan untuk VPS)

Prasyarat: Docker + Docker Compose.

```bash
cp .env.example .env        # sesuaikan DATABASE_URL & kata sandi
docker compose up -d --build
```

Aplikasi di `http://IP-VPS:3000`. File SQL di `database/` berjalan otomatis
saat volume database pertama kali dibuat. Pasang ulang dari nol:
`docker compose down -v` lalu `docker compose up -d --build`
(PERINGATAN: menghapus semua data).

**Urutan SQL untuk pemasangan manual / upgrade:** jalankan
`database/balita-center-database.sql`, lalu `database/02-migrasi-dan-seed.sql`
(sudah menggabungkan seluruh migrasi tambahan termasuk rapor & media).
File `database/migrasi-*.sql` adalah riwayat migrasi per tahap.

## Menjalankan tanpa Docker (pengembangan)

Prasyarat: Node.js 20 dan PostgreSQL 16.

```bash
createdb balita_center
cp .env.example .env.local  # isi DATABASE_URL, AUTH_SECRET, APP_BASE_URL
npm run db:setup            # memasang skema utama
psql "$DATABASE_URL" -f database/02-migrasi-dan-seed.sql
npm install
npm run build
npm run start               # http://localhost:3000
```

Mode pengembangan: `npm run dev`.

Variabel lingkungan: lihat `.env.example`. Unggahan berkas tersimpan lokal di
`UPLOAD_DIR` atau ke S3/R2 bila `S3_*` diisi. Kanal WhatsApp Ailsa aktif bila
`AILSA_WHATSAPP_TOKEN`, `AILSA_PHONE_NUMBER_ID`, dan `AILSA_LLM_API_KEY` terisi.

## Urutan pemakaian pertama (database kosong)

1. Masuk sebagai super admin, buat **Data Awal**: cabang, program, kelas, staf.
2. Tambah anak lewat **Anak Didik → Tambah Anak** (wali terhubung untuk Connect).
3. Di **Akademik**, tinjau katalog material & milestone (aktifkan yang dipakai).
4. Buat **Daily Report**, kirim untuk review, lalu terbitkan dari Review.
5. Catat ukur anak di tab **Kesehatan** dan penilaian di tab
   **Laporan & Perkembangan** pada profil anak.
6. Buat siklus dan **Rapor** dari menu Rapor; terbitkan agar tampil di Connect.
7. Orang tua masuk lewat **Balita Connect** dengan akun walinya.

## Pemeriksaan otomatis

Setiap push/PR ke `main` menjalankan **Build Check** (GitHub Actions):
`npm ci` lalu `npm run build`. Build tidak membutuhkan database.

## Catatan kejujuran

- Analisa Ailsa bersifat **internal staf**; orang tua hanya menerima Daily
  Report dan rapor resmi terbitan guru.
- Draf narasi rapor adalah dokumen guru: boleh dibantu data observasi,
  wajib diedit dan disetujui guru sebelum terbit.
