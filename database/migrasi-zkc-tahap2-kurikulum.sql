-- Migrasi ZKC Tahap 2 (kurikulum): kerangka kurikulum ZKC empat belas bulan
-- dan kurikulum Kelas Movement beserta peta materinya.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM, "Sumber Data Yang Wajib
-- Dimuat Apa Adanya" butir Empat — kurikulum lengkap ZKC 14 bulan dari
-- November 2026 sampai Desember 2027 berisi tema bulanan, fondasi yang
-- dilatih, materi inti, menu sensory play, dan menu movement, beserta
-- kurikulum Kelas Movement dan peta materinya.
-- Yang dibuat di sini adalah RANGKA 14 bulannya (satu baris per bulan);
-- tema dan isi resmi setiap bulan dimuat apa adanya dari Paket Sistem
-- Terpadu lembaga — tidak dikarang.
BEGIN;

CREATE TABLE IF NOT EXISTS kurikulum_bulan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulan VARCHAR(7) NOT NULL UNIQUE,
  tema VARCHAR(300),
  fondasi TEXT,
  materi_inti TEXT,
  menu_sensory TEXT,
  menu_movement TEXT,
  subtema TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO kurikulum_bulan (bulan) VALUES
  ('2026-11'), ('2026-12'),
  ('2027-01'), ('2027-02'), ('2027-03'), ('2027-04'), ('2027-05'), ('2027-06'),
  ('2027-07'), ('2027-08'), ('2027-09'), ('2027-10'), ('2027-11'), ('2027-12')
ON CONFLICT (bulan) DO NOTHING;

CREATE TABLE IF NOT EXISTS movement_materi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(300) NOT NULL,
  keterangan TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
