-- Migrasi ZKC Tahap 3d: Rapor lengkap — alur terbit 4 tahap terkunci,
-- komponen Bahasa Inggris ZKC, Kehidupan Islam & Bahasa Arab SAM, Atensi &
-- Konsentrasi, narasi perkembangan berurutan, pertumbuhan, tanggapan orang tua.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Rapor).
BEGIN;

-- Alur terbit empat tahap: draft (Draf Guru) → diperiksa (Diperiksa Manager)
-- → disetujui (Disetujui Founder) → published (Terbit).
ALTER TABLE cycle_reports DROP CONSTRAINT IF EXISTS cycle_reports_status_check;
ALTER TABLE cycle_reports ADD CONSTRAINT cycle_reports_status_check
  CHECK (status IN ('draft','diperiksa','disetujui','published'));

ALTER TABLE cycle_reports
  ADD COLUMN IF NOT EXISTS diperiksa_oleh UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS diperiksa_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disetujui_oleh UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS disetujui_at TIMESTAMPTZ,
  -- Ringkasan satu halaman berbahasa sehari-hari (pembuka laporan).
  ADD COLUMN IF NOT EXISTS ringkasan_ortu TEXT,
  -- Catatan perkembangan dalam urutan resmi lembaga.
  ADD COLUMN IF NOT EXISTS narrative_latar TEXT,
  ADD COLUMN IF NOT EXISTS narrative_gambaran TEXT,
  ADD COLUMN IF NOT EXISTS narrative_kekuatan TEXT,
  ADD COLUMN IF NOT EXISTS narrative_berkembang TEXT,
  ADD COLUMN IF NOT EXISTS narrative_dukungan TEXT,
  ADD COLUMN IF NOT EXISTS narrative_kelekatan TEXT,
  ADD COLUMN IF NOT EXISTS narrative_tema TEXT,
  ADD COLUMN IF NOT EXISTS profil_cara_belajar TEXT,
  -- Komponen Bahasa Inggris ZKC (eksplisit).
  ADD COLUMN IF NOT EXISTS inggris_kata TEXT,
  ADD COLUMN IF NOT EXISTS inggris_respons TEXT,
  ADD COLUMN IF NOT EXISTS inggris_tahap SMALLINT CHECK (inggris_tahap IN (1,2,3)),
  -- Kehidupan Islam dan Bahasa Arab SAM.
  ADD COLUMN IF NOT EXISTS islam_doa TEXT,
  ADD COLUMN IF NOT EXISTS islam_hadis TEXT,
  ADD COLUMN IF NOT EXISTS islam_juz30 TEXT,
  ADD COLUMN IF NOT EXISTS islam_hijaiyah TEXT,
  ADD COLUMN IF NOT EXISTS islam_ummi TEXT,
  -- Atensi dan Konsentrasi (dari K4, normalisasi, anekdotal).
  ADD COLUMN IF NOT EXISTS atensi_durasi TEXT,
  ADD COLUMN IF NOT EXISTS atensi_pengulangan TEXT,
  ADD COLUMN IF NOT EXISTS atensi_siklus TEXT,
  ADD COLUMN IF NOT EXISTS atensi_fokus TEXT,
  -- Pertumbuhan fisik: narasi pembacaan arah (diagram digambar dari data ukur).
  ADD COLUMN IF NOT EXISTS narasi_pertumbuhan TEXT,
  ADD COLUMN IF NOT EXISTS tips_pola_asuh TEXT,
  -- Tanggapan dan masukan orang tua lewat Portal Orang Tua.
  ADD COLUMN IF NOT EXISTS tanggapan_ortu TEXT,
  ADD COLUMN IF NOT EXISTS tanggapan_at TIMESTAMPTZ;

COMMIT;
