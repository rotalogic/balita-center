-- Absensi guru & staf: tabel staff_attendance sudah ada pada skema dasar
-- (work_date, check_in/check_out, UNIQUE staf+tanggal) tetapi belum pernah
-- mempunyai layar dan API — migrasi ini menyesuaikannya dengan desain
-- lembaga: status Hadir, Terlambat, Izin, Sakit, Cuti beserta jam hadir.
-- 'alpa' dipertahankan pada CHECK demi kesesuaian data lama; layar absensi
-- guru hanya memakai lima status resmi di atas.
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_status_check
  CHECK (status IN ('hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpa'));
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS dicatat_oleh UUID REFERENCES users(id);
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS staff_attendance_work_date_idx ON staff_attendance (work_date);
