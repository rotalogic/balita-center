-- Migrasi ZKC Tahap 3f: Layanan Skrining Berdiri Sendiri (7 jenis final,
-- Tahapan Skrining 1–5 bergerbang server, Laporan Hasil Skrining dengan Peta
-- Perkembangan Anak) + Berkas Rujukan (kolom tujuan selalu KOSONG sampai
-- diterbitkan; persetujuan akhir founder).
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Deteksi dan
-- Rujukan; Layanan Skrining Berdiri Sendiri; Kaidah Keluaran Pemetaan).
BEGIN;

CREATE TABLE IF NOT EXISTS skrining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  child_id UUID REFERENCES children(id),
  child_name VARCHAR(200) NOT NULL,
  child_birth_date DATE,
  parent_name VARCHAR(200) NOT NULL,
  wa_number VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  jenis VARCHAR(32) NOT NULL CHECK (jenis IN (
    'tumbuh_kembang','kesiapan_tk','kesiapan_sd','kesiapan_smp',
    'indikasi_lain','risiko_disleksia','kesiapan_pesantren')),
  status VARCHAR(16) NOT NULL DEFAULT 'pendaftaran'
    CHECK (status IN ('pendaftaran','berjalan','selesai')),
  biaya NUMERIC(12,2),
  -- Persetujuan tertulis orang tua (Tahap 1) — gerbang status Berjalan.
  persetujuan_ortu_at TIMESTAMPTZ,
  persetujuan_ortu_nama VARCHAR(200),
  -- Isian per tahap (JSONB per tahap; kunci tahap1..tahap4 berisi formulir).
  tahap JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skrining_branch ON skrining (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_skrining_child ON skrining (child_id);

CREATE TABLE IF NOT EXISTS laporan_skrining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skrining_id UUID NOT NULL UNIQUE REFERENCES skrining(id) ON DELETE CASCADE,
  -- Tabel hasil per ranah/domain: nama domain & indikator, hasil kata, dan
  -- bukti perilaku teramati. Teks soal/kunci tidak pernah disimpan di sini.
  tabel_hasil JSONB NOT NULL DEFAULT '[]',
  indikasi JSONB NOT NULL DEFAULT '[]',
  ringkasan TEXT,
  -- Peta Perkembangan Anak: tiga bacaan, masing-masing wajib berbukti.
  peta JSONB,
  kesimpulan TEXT,
  rekomendasi TEXT,
  rekomendasi_pilihan VARCHAR(24)
    CHECK (rekomendasi_pilihan IN ('rujukan','observasi_lanjutan','keduanya')),
  rekomendasi_alasan TEXT,
  rekomendasi_bank TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  disetujui_oleh UUID REFERENCES users(id),
  disetujui_at TIMESTAMPTZ,
  penjelasan_tanggal DATE,
  penjelasan_oleh VARCHAR(200),
  saluran VARCHAR(16) CHECK (saluran IN ('whatsapp','email')),
  dikirim_at TIMESTAMPTZ,
  dikirim_oleh UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS berkas_rujukan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  child_id UUID REFERENCES children(id),
  child_name VARCHAR(200) NOT NULL,
  skrining_id UUID REFERENCES skrining(id),
  laporan_skrining_id UUID REFERENCES laporan_skrining(id),
  pemicu TEXT NOT NULL,
  laporan_observasi TEXT,
  persetujuan_ortu_tercatat BOOLEAN NOT NULL DEFAULT false,
  persetujuan_ortu_at TIMESTAMPTZ,
  -- Kolom tujuan SELALU KOSONG pada draf; hanya terisi saat diterbitkan.
  tujuan TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','siap_kirim','terkirim')),
  diterbitkan_oleh UUID REFERENCES users(id),
  diterbitkan_at TIMESTAMPTZ,
  saluran VARCHAR(16) CHECK (saluran IN ('whatsapp','email','langsung')),
  dikirim_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rujukan_child ON berkas_rujukan (child_id, status);

COMMIT;
