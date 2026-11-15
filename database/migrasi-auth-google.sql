-- Migrasi: Masuk/Daftar dengan Google (15 Nov 2026).
-- Menambah penanda identitas Google pada akun pengguna. Aman dijalankan ulang.
-- google_sub = kolom "sub" dari token Google: tetap sama untuk satu akun
-- Google walau alamat emailnya berubah, jadi penautan akun memakai ini dulu,
-- baru mencocokkan email terverifikasi Google.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unik
  ON users (google_sub) WHERE google_sub IS NOT NULL;
