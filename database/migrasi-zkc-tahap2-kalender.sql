-- Migrasi ZKC Tahap 2 (kalender): tanggal selesai untuk entri berentang.
-- Kalender resmi lembaga memuat rentang nyata (libur beberapa hari,
-- periode kurikulum SAM, jendela libur semester) — tanggal akhirnya tidak
-- boleh hilang saat dimuat apa adanya dari Kalender_Pendidikan_Momen.
BEGIN;

ALTER TABLE kalender_entri ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;

COMMIT;
