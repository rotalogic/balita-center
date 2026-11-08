-- Bersihkan data uji yang tertinggal di BALITA CENTER (produksi).
-- HANYA baris bertanda Tes/TEST — data asli (Malang, khadijah, Reguler, Toddler a) tidak disentuh.
-- Jalankan: sudo docker exec -i balita-db psql -U postgres -d balita_center < bersihkan-data-uji.sql
-- Aman dijalankan berulang.
BEGIN;

CREATE TEMP TABLE _b AS SELECT id FROM branches WHERE code ILIKE 'TES%';
CREATE TEMP TABLE _c AS SELECT id FROM children WHERE full_name ILIKE 'Tes Anak%' OR full_name ILIKE 'TEST%';
CREATE TEMP TABLE _k AS SELECT id FROM classes WHERE name ILIKE 'Tes %' OR name ILIKE 'TEST%';
CREATE TEMP TABLE _s AS SELECT id FROM staff WHERE full_name ILIKE 'Tes %' OR full_name ILIKE 'TEST%';
CREATE TEMP TABLE _p AS SELECT id FROM programs WHERE code ILIKE 'TES%';

DELETE FROM daily_report_reviews  WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id IN (SELECT id FROM _c) OR branch_id IN (SELECT id FROM _b));
DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id IN (SELECT id FROM _c) OR branch_id IN (SELECT id FROM _b));
DELETE FROM daily_report_photos   WHERE report_id IN (SELECT id FROM daily_reports WHERE child_id IN (SELECT id FROM _c) OR branch_id IN (SELECT id FROM _b));
DELETE FROM daily_reports WHERE child_id IN (SELECT id FROM _c) OR branch_id IN (SELECT id FROM _b);

DELETE FROM child_attendance  WHERE child_id IN (SELECT id FROM _c);
DELETE FROM stppa_assessments WHERE child_id IN (SELECT id FROM _c);
DELETE FROM health_checks     WHERE child_id IN (SELECT id FROM _c);
DELETE FROM child_development_records WHERE child_id IN (SELECT id FROM _c);
DELETE FROM invoices          WHERE child_id IN (SELECT id FROM _c);
DELETE FROM enrollments       WHERE child_id IN (SELECT id FROM _c) OR class_id IN (SELECT id FROM _k) OR branch_id IN (SELECT id FROM _b);
DELETE FROM child_guardians   WHERE child_id IN (SELECT id FROM _c);
DELETE FROM children          WHERE id IN (SELECT id FROM _c);

DELETE FROM learning_cycles WHERE class_id IN (SELECT id FROM _k);
DELETE FROM classes  WHERE id IN (SELECT id FROM _k);

-- Laporan yang dibuat staf uji ikut dibuang (created_by NOT NULL, tidak bisa dikosongkan).
DELETE FROM daily_report_reviews WHERE report_id IN (SELECT id FROM daily_reports WHERE created_by IN (SELECT id FROM _s));
DELETE FROM daily_report_activities WHERE report_id IN (SELECT id FROM daily_reports WHERE created_by IN (SELECT id FROM _s));
DELETE FROM daily_report_photos WHERE report_id IN (SELECT id FROM daily_reports WHERE created_by IN (SELECT id FROM _s));
DELETE FROM daily_reports WHERE created_by IN (SELECT id FROM _s);
UPDATE daily_reports SET lead_facilitator_id = NULL WHERE lead_facilitator_id IN (SELECT id FROM _s);
UPDATE daily_reports SET observer_id = NULL WHERE observer_id IN (SELECT id FROM _s);
UPDATE daily_report_reviews SET reviewer_id = NULL WHERE reviewer_id IN (SELECT id FROM _s);
UPDATE classes SET lead_staff_id = NULL WHERE lead_staff_id IN (SELECT id FROM _s);
UPDATE bot_knowledge_entries SET approved_by = NULL WHERE approved_by IN (SELECT id FROM _s);
UPDATE ailsa_analyses SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE email ILIKE '%test%');
UPDATE leave_requests SET decided_by = NULL WHERE decided_by IN (SELECT id FROM _s);
DELETE FROM leave_requests WHERE staff_id IN (SELECT id FROM _s) OR branch_id IN (SELECT id FROM _b);
DELETE FROM staff    WHERE id IN (SELECT id FROM _s);

DELETE FROM leads            WHERE branch_id IN (SELECT id FROM _b);
DELETE FROM school_events    WHERE branch_id IN (SELECT id FROM _b);
DELETE FROM cash_book_entries WHERE branch_id IN (SELECT id FROM _b);
DELETE FROM audit_logs       WHERE branch_id IN (SELECT id FROM _b);
DELETE FROM user_branches    WHERE branch_id IN (SELECT id FROM _b);
DELETE FROM branches         WHERE id IN (SELECT id FROM _b);

DELETE FROM programs WHERE id IN (SELECT id FROM _p);

COMMIT;

SELECT 'cabang' AS tabel, count(*) FROM branches
UNION ALL SELECT 'anak', count(*) FROM children WHERE deleted_at IS NULL
UNION ALL SELECT 'kelas', count(*) FROM classes
UNION ALL SELECT 'program', count(*) FROM programs;
