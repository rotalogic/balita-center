-- Media laporan: video di galeri laporan harian + foto langsung di rapor.
-- daily_report_photos sudah punya media_type/mime_type sejak awal; yang kurang
-- hanya poster_url (gambar sampul video untuk PDF dan daftar). Rapor mendapat
-- tabel foto sendiri supaya guru bisa melengkapi Dokumentasi Kegiatan di luar
-- tarikan otomatis dari laporan harian. Aman dijalankan berulang.

ALTER TABLE daily_report_photos
  ADD COLUMN IF NOT EXISTS poster_url TEXT;

CREATE TABLE IF NOT EXISTS cycle_report_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES cycle_reports(id) ON DELETE CASCADE,
  photo_url  TEXT NOT NULL,
  caption    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cycle_report_photos_report
  ON cycle_report_photos (report_id, sort_order, created_at);
