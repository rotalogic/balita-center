-- Jilid 6: katalog material Montessori AMI, milestone perkembangan, dan
-- struktur laporan harian sesuai referensi sekolah.
-- Aman dijalankan berulang.

-- ---------- Blok 1C: katalog material ----------
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  name varchar(160) NOT NULL,
  name_en varchar(160),
  area varchar(24) NOT NULL,          -- practical_life|language|sensorial|mathematics|cultural|observasi
  age_group varchar(12),              -- 0-3 | 3-6
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS materials_nama_unik ON materials (lower(btrim(name))) WHERE branch_id IS NULL;

ALTER TABLE daily_report_activities
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id),
  ADD COLUMN IF NOT EXISTS area varchar(24),
  ADD COLUMN IF NOT EXISTS work_location varchar(16),   -- lantai|meja|alas
  ADD COLUMN IF NOT EXISTS work_mode varchar(16),       -- sendiri|berpasangan|kelompok_kecil|kelompok_besar
  ADD COLUMN IF NOT EXISTS milestone_id uuid;

-- Skala penilaian 1–4 (4 = sempurna). Data lama diskalakan: 1-2 -> 1-2, 3 -> 3, 4 -> 3, 5 -> 4.
ALTER TABLE daily_report_activities ADD COLUMN IF NOT EXISTS rating_lama numeric(3,1);
UPDATE daily_report_activities SET rating_lama = rating WHERE rating_lama IS NULL AND rating IS NOT NULL;
UPDATE daily_report_activities
   SET rating = CASE WHEN rating >= 5 THEN 4 WHEN rating = 4 THEN 3 WHEN rating >= 3 THEN 3
                     WHEN rating = 2 THEN 2 WHEN rating = 1 THEN 1 ELSE rating END
 WHERE rating IS NOT NULL AND rating > 4;

-- ---------- Blok 1B: bagian harian tetap ----------
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS circle_theme text,
  ADD COLUMN IF NOT EXISTS circle_rating smallint,
  ADD COLUMN IF NOT EXISTS circle_notes text,
  ADD COLUMN IF NOT EXISTS special_moment text,
  ADD COLUMN IF NOT EXISTS home_suggestion text;

-- ---------- Blok 2: katalog milestone ----------
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  indikator varchar(240) NOT NULL,
  age_group varchar(12) NOT NULL,     -- 0-<1 | 1-<2 | 2-<3 | 3-<4 | 4-<5 | 5-6
  aspect varchar(32) NOT NULL,        -- nilai_agama_moral|fisik_motorik|kognitif|bahasa|sosial_emosional|seni
  montessori_area varchar(24),
  status varchar(12) NOT NULL DEFAULT 'draf',  -- draf | aktif | arsip
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS milestones_indikator_unik
  ON milestones (lower(btrim(indikator)), age_group) WHERE branch_id IS NULL;

CREATE TABLE IF NOT EXISTS material_milestones (
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, milestone_id)
);

-- Riwayat observasi milestone (dari aktivitas Observasi maupun material terpetakan)
CREATE TABLE IF NOT EXISTS milestone_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  milestone_id uuid NOT NULL REFERENCES milestones(id),
  observed_on date NOT NULL,
  level smallint,                    -- 1..4 (null = observasi ringan dari material)
  report_id uuid REFERENCES daily_reports(id),
  material_id uuid REFERENCES materials(id),
  created_by uuid REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestone_obs_anak ON milestone_observations (child_id, observed_on DESC);
