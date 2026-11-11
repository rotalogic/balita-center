-- Migrasi ZKC Tahap 2 (kerangka): kamar untuk bahan ajar pelengkap, bank
-- sesi Pendampingan Individual, dan program khusus calistung.
-- KERANGKA SAJA — tanpa seed isi. Isi resmi (Islamic living, Bahasa Inggris,
-- Bahasa Arab, materi sesi, tahapan calistung) dimuat apa adanya dari
-- "Paket Sistem Terpadu Versi Final" lembaga; tidak dikarang di sini.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Bahan Ajar; Bank Sesi;
-- Program Khusus Calistung).
BEGIN;

CREATE TABLE IF NOT EXISTS bahan_ajar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori VARCHAR(40) NOT NULL CHECK (kategori IN ('islamic_living', 'bahasa_inggris', 'bahasa_arab', 'pelengkap')),
  subkategori VARCHAR(120),
  judul VARCHAR(300) NOT NULL,
  isi TEXT,
  teks_latin TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bahan_ajar_kategori ON bahan_ajar (kategori, urutan, judul);

CREATE TABLE IF NOT EXISTS bank_sesi_pendampingan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(300) NOT NULL,
  fokus TEXT,
  kelompok_usia VARCHAR(60),
  durasi_menit INTEGER,
  langkah TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calistung_tahap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(200) NOT NULL,
  keterangan TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calistung_materi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tahap_id UUID NOT NULL REFERENCES calistung_tahap(id) ON DELETE CASCADE,
  nama VARCHAR(300) NOT NULL,
  keterangan TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calistung_materi_tahap ON calistung_materi (tahap_id, urutan, nama);

COMMIT;
