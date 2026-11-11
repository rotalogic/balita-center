-- Migrasi ZKC Tahap 2 (deteksi & rujukan): bank acuan deteksi dini.
-- Berisi katalog dari Paket Sistem Terpadu folder 04: 12 kelompok indikasi
-- beserta ambang rujuknya (Panduan Red Flag), 12 baris Bank Program
-- Individual, 100 indikator kesulitan belajar usia sekolah (SD-SMA),
-- bank tugas Skrining Risiko Disleksia, dan kesimpulan kurasi folder
-- Bakat Minat. Seluruhnya bahan acuan staf — bukan alat diagnosis.
BEGIN;

CREATE TABLE IF NOT EXISTS bank_deteksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori VARCHAR(60) NOT NULL,
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  urutan INT NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_deteksi_kategori ON bank_deteksi (kategori, urutan);

COMMIT;
