-- Blok 1 & 2 — soft delete laporan, riwayat status, dan penautan akun-staf.
-- Aman dijalankan berulang (IF NOT EXISTS / IF EXISTS).

-- 1) Soft delete: laporan tidak pernah benar-benar hilang.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);

-- 2) Unique (child_id, report_date) harus jadi unik PARSIAL, kalau tidak
--    laporan yang sudah di-soft-delete akan menghalangi pembuatan laporan baru
--    untuk anak+tanggal yang sama.
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_child_id_report_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_child_date_aktif
    ON daily_reports (child_id, report_date)
 WHERE deleted_at IS NULL;

-- 3) Akun pengguna ditautkan eksplisit ke baris staf (Blok 3B).
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_unik ON staff (user_id) WHERE user_id IS NOT NULL;

-- 4) Ditautkan otomatis lewat email yang sama, supaya akun lama tidak perlu diisi manual.
UPDATE staff s SET user_id = u.id
  FROM users u
 WHERE s.user_id IS NULL AND lower(s.email) = lower(u.email);

-- 5) Indeks bantu daftar & laporan.
CREATE INDEX IF NOT EXISTS daily_reports_aktif ON daily_reports (branch_id, report_date DESC)
 WHERE deleted_at IS NULL;

-- 6) Audit tidak boleh menghalangi penghapusan cabang, dan tidak boleh ikut
--    terhapus. Riwayat tetap ada dengan branch_id NULL.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_branch_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
