-- Migrasi ZKC Tahap 3c: Laporan Harian 9 segmen ZKC, Anekdotal Record SAM,
-- dan Refleksi Guru harian.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Laporan Harian).
BEGIN;

-- Segmen sesi resmi ZKC yang melekat pada laporan harian (9 segmen berurutan).
CREATE TABLE IF NOT EXISTS daily_report_segments (
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  segmen VARCHAR(32) NOT NULL CHECK (segmen IN (
    'connect_arrival','circle_time_lagu','senam','read_aloud','sensory_explore',
    'movement','basic_life_skills','cooling_down','recall_doa')),
  catatan TEXT NOT NULL,
  PRIMARY KEY (report_id, segmen)
);

-- Samakan CHECK media_type foto laporan dengan kode aplikasi ('image'/'video');
-- skema dasar lama hanya mengizinkan 'foto'/'video' sehingga simpan foto dari
-- editor gugur di constraint. Nilai lama 'foto' tetap diterima.
ALTER TABLE daily_report_photos DROP CONSTRAINT IF EXISTS daily_report_photos_media_type_check;
ALTER TABLE daily_report_photos ADD CONSTRAINT daily_report_photos_media_type_check
  CHECK (media_type IN ('foto', 'image', 'video'));

-- Observasi harian SAM: Anekdotal Record lima kolom + satu penanda Fokus Amati.
CREATE TABLE IF NOT EXISTS anekdotal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  fokus_amati VARCHAR(20) NOT NULL CHECK (fokus_amati IN (
    'material','masa_peka','normalisasi','islamic_living','grace_courtesy')),
  kejadian TEXT NOT NULL,
  interpretasi TEXT NOT NULL,
  tindak_lanjut TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS anekdotal_anak_idx ON anekdotal_records (child_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS anekdotal_tanggal_idx ON anekdotal_records (tanggal DESC);

-- Refleksi Guru harian per kelas/kelompok: dibaca founder & manager sebagai
-- bahan pembinaan; tidak pernah tampil mentah kepada orang tua.
CREATE TABLE IF NOT EXISTS refleksi_guru (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  class_id UUID REFERENCES classes(id),
  tanggal DATE NOT NULL,
  penulis_id UUID NOT NULL REFERENCES users(id),
  dipelajari TEXT NOT NULL,
  perubahan TEXT NOT NULL,
  kesadaran TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refleksi_tanggal_idx ON refleksi_guru (tanggal DESC);
CREATE INDEX IF NOT EXISTS refleksi_penulis_idx ON refleksi_guru (penulis_id, tanggal DESC);

COMMIT;
