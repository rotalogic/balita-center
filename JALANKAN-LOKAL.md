# Jalankan Balita Center di Localhost (komputer sendiri)

Paket ini adalah source code dari `balita-center-2.zip`, sudah dilengkapi
supaya bisa langsung jalan di komputer sendiri: database utama + seluruh
migrasi + seed katalog terpasang otomatis saat pertama kali dinyalakan.

## Cara paling mudah: Docker

Syarat: Docker Desktop terpasang dan sedang berjalan
(Windows / macOS / Linux).

1. Extract ZIP ini ke sebuah folder.
2. Buka terminal di folder itu.
3. Jalankan:

```bash
docker compose up -d --build
```

4. Tunggu sampai selesai (pertama kali bisa beberapa menit), lalu buka
   browser ke:

```
http://localhost:3000
```

5. Database masih kosong, jadi buat akun pertama lewat tautan
   **Daftar akun** di halaman login.

Berhenti: `docker compose down`
Mulai lagi: `docker compose up -d`
Hapus semua data dan mulai dari nol: `docker compose down -v`, lalu jalankan lagi langkah 3.

## Cara tanpa Docker

Syarat: Node.js 18.18+ dan PostgreSQL 16.

```bash
createdb balita_center
psql balita_center -f database/balita-center-database.sql
psql balita_center -f database/02-migrasi-dan-seed.sql
```

Buat file `.env.local`:

```
DATABASE_URL=postgres://postgres:KATA-SANDI@localhost:5432/balita_center
AUTH_SECRET=teks-acak-panjang-untuk-lokal
APP_BASE_URL=http://localhost:3000
```

Lalu:

```bash
npm install
npm run build
npm run start
```

Buka `http://localhost:3000`.

## Catatan

- Kata sandi database di `docker-compose.yml` adalah contoh untuk lokal.
  Ganti sebelum dipakai di server/produksi, dan samakan dengan yang ada
  di `DATABASE_URL`.
- Fitur yang butuh layanan luar (WhatsApp Ailsa, email, penyimpanan foto)
  tidak aktif di lokal sampai token/kuncinya diisi sendiri.
