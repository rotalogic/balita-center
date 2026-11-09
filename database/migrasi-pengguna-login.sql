-- Migrasi: catat kapan pengguna terakhir masuk.
-- Dipakai halaman Pengguna untuk melihat akun yang tidak aktif.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
