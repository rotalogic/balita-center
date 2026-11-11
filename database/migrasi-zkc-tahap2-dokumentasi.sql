-- Migrasi ZKC Tahap 2 (dokumentasi anak): tautan folder dokumentasi anak.
-- Permohonan Penyesuaian Ketiga dari lembaga: tersedia kolom khusus tautan
-- folder dokumentasi (Google Drive) pada data anak, dan tautan itu beserta
-- foto anak tampil pada laporan harian dan rapor anak.
BEGIN;

ALTER TABLE children ADD COLUMN IF NOT EXISTS tautan_folder_dokumentasi TEXT;

COMMIT;
