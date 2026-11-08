// Satu sumber daftar anak per kelas.
// Daily Report menyimpan class_id langsung; enrollments menyimpan riwayat kelas.
// Sebelumnya Absensi hanya membaca enrollments — sehingga kelas yang anaknya
// tercatat di Daily Report tapi enrollments-nya hilang/orphan tampil kosong.
// Keduanya sekarang digabung di sini, dan semua modul memakai fungsi ini.
export const SQL_ANAK_KELAS = `
  SELECT DISTINCT c.id, c.full_name, c.branch_id
    FROM children c
   WHERE c.deleted_at IS NULL
     AND c.status = 'aktif'
     AND c.id IN (
       SELECT e.child_id FROM enrollments e
        WHERE e.class_id = $1 AND e.status = 'aktif' AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
       UNION
       SELECT r.child_id FROM daily_reports r
        WHERE r.class_id = $1 AND r.deleted_at IS NULL
     )`;

export const SQL_ANAK_KELAS_SAAT_INI = `
  SELECT DISTINCT c.id, c.full_name, c.branch_id
    FROM children c
   WHERE c.deleted_at IS NULL
     AND c.status = 'aktif'
     AND c.id IN (
       SELECT e.child_id FROM enrollments e
        WHERE e.class_id = $1 AND e.status = 'aktif'
          AND (e.start_date IS NULL OR e.start_date <= $2::date)
          AND (e.end_date IS NULL OR e.end_date >= $2::date)
       UNION
       SELECT r.child_id FROM daily_reports r
        WHERE r.class_id = $1 AND r.deleted_at IS NULL AND r.report_date = $2::date
     )`;
