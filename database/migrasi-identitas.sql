-- Migrasi: identitas sekolah + foto profil & tanda tangan staf.
-- Identitas sekolah baris tunggal (id=1): dipakai kop dokumen resmi
-- (rapor, tagihan, kwitansi) menggantikan teks mati "BALITA CENTER".
CREATE TABLE IF NOT EXISTS school_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nama varchar(160) NOT NULL DEFAULT 'Balita Center',
  tagline varchar(160) NOT NULL DEFAULT 'Montessori & Childcare',
  alamat text,
  telepon varchar(40),
  email varchar(160),
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO school_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Foto profil & tanda tangan digital guru (diunggah guru sendiri dari
-- halaman Akun; tanda tangan tampil di kaki laporan harian & rapor).
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS signature_url text;
