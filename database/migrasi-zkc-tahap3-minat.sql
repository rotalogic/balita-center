-- Migrasi ZKC Tahap 3g: Konsultasi dan Pemetaan Bakat Minat — layanan
-- konsultasi tersendiri (menu Minat & Bakat), label Klien Konsultasi,
-- gerbang usia >= 4 tahun ditegakkan server, keluaran Peta Kekuatan dan
-- Minat + Kecenderungan Arah + Rekomendasi Pengarahan (Laporan Konsultasi).
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Konsultasi dan
-- Pemetaan Bakat Minat; Kecenderungan Arah; empat lensa pemetaan).
BEGIN;

CREATE TABLE IF NOT EXISTS konsultasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  child_id UUID REFERENCES children(id),
  child_name VARCHAR(200) NOT NULL,
  child_birth_date DATE NOT NULL,
  parent_name VARCHAR(200) NOT NULL,
  wa_number VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  biaya NUMERIC(12,2),
  status VARCHAR(16) NOT NULL DEFAULT 'pendaftaran'
    CHECK (status IN ('pendaftaran','pemetaan','selesai')),
  -- Langkah 1 & 2 tersimpan sebagai isian per langkah.
  langkah JSONB NOT NULL DEFAULT '{}',
  -- Bahan Indikasi untuk Rujukan: tanda krisis/bahaya yang terbaca memicu
  -- rujukan segera — hanya pembaca tanda, bukan protokol pemeriksaan.
  tanda_rujukan TEXT,
  -- Keluaran (Langkah 4): Peta Kekuatan dan Minat + Rekomendasi Pengarahan.
  kekuatan_menonjol TEXT,
  bidang_minat TEXT,
  lensa JSONB,
  kecenderungan_arah TEXT,
  rekomendasi TEXT,
  laporan_status VARCHAR(16) NOT NULL DEFAULT 'belum'
    CHECK (laporan_status IN ('belum','draft','final')),
  disetujui_oleh UUID REFERENCES users(id),
  disetujui_at TIMESTAMPTZ,
  sesi_tanggal DATE,
  sesi_oleh VARCHAR(200),
  saluran VARCHAR(16) CHECK (saluran IN ('whatsapp','email')),
  dikirim_at TIMESTAMPTZ,
  dikirim_oleh UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_konsultasi_branch ON konsultasi (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_konsultasi_child ON konsultasi (child_id);

COMMIT;
