-- Migrasi ZKC Tahap 2 (material SAM): kolom untuk memuat berkas
-- impor-material-sam.csv APA ADANYA — jenjang (CASA/NIDO), indikator
-- standar penguasaan, dan usia presentasi lazim tidak boleh hilang.
-- Acuan: Prompt Gabungan (perangkat SAM 164 material) + Permohonan
-- Penyesuaian Kedua (jalan pemuatan massal katalog).
BEGIN;

ALTER TABLE materials ADD COLUMN IF NOT EXISTS jenjang VARCHAR(10);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS indikator_penguasaan TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS usia_presentasi VARCHAR(60);

-- Area lembaga lebih panjang dari batas lama 24 (mis. "Budaya, Alam &
-- Islamic Living", "EPL & Kemandirian Gerak Bertujuan").
ALTER TABLE materials ALTER COLUMN area TYPE VARCHAR(60);

-- Indeks unik lama hanya memakai nama: berkas lembaga memuat material yang
-- sama pada dua jenjang (mis. "Membawa baki dua tangan" di CASA dan NIDO)
-- dengan indikator berbeda — keunikan yang benar adalah nama per jenjang.
DROP INDEX IF EXISTS materials_nama_unik;
CREATE UNIQUE INDEX IF NOT EXISTS materials_nama_jenjang_unik
  ON materials (lower(btrim(name)), jenjang) WHERE branch_id IS NULL;

COMMIT;
