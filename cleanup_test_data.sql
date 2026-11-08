-- Bersihkan HANYA data uji (baris bertanda Tes/DBG/TESxxx/Foto Tes/Jahat).
-- JANGAN pernah pakai DELETE tanpa WHERE untuk tabel master.
BEGIN;

DELETE FROM daily_report_reviews
 WHERE report_id IN (SELECT id FROM daily_reports WHERE notes ILIKE '%tes%');
DELETE FROM daily_report_photos
 WHERE report_id IN (SELECT id FROM daily_reports WHERE notes ILIKE '%tes%');
DELETE FROM daily_report_activities
 WHERE report_id IN (SELECT id FROM daily_reports WHERE notes ILIKE '%tes%');
DELETE FROM daily_reports WHERE notes ILIKE '%tes%';

DELETE FROM enrollments
 WHERE child_id IN (SELECT id FROM children
                     WHERE full_name ILIKE 'Tes %' OR full_name ILIKE 'Foto Tes%'
                        OR full_name ILIKE 'Jahat %' OR full_name ILIKE 'Dbg %');
DELETE FROM child_guardians
 WHERE child_id IN (SELECT id FROM children
                     WHERE full_name ILIKE 'Tes %' OR full_name ILIKE 'Foto Tes%'
                        OR full_name ILIKE 'Jahat %' OR full_name ILIKE 'Dbg %');
DELETE FROM children
 WHERE full_name ILIKE 'Tes %' OR full_name ILIKE 'Foto Tes%'
    OR full_name ILIKE 'Jahat %' OR full_name ILIKE 'Dbg %';

DELETE FROM staff WHERE full_name ILIKE 'Tes %' OR full_name ILIKE 'Dbg %';
DELETE FROM classes WHERE name ILIKE 'Tes %' OR name ILIKE 'Dbg %';
DELETE FROM programs WHERE code ILIKE 'TES%' OR code ILIKE 'DBG%';
DELETE FROM branches WHERE code ILIKE 'TES%' OR code ILIKE 'DBG%' OR name ILIKE 'Dbg %';

COMMIT;

SELECT 'branches' AS tabel, count(*) FROM branches
UNION ALL SELECT 'programs', count(*) FROM programs
UNION ALL SELECT 'classes', count(*) FROM classes
UNION ALL SELECT 'children', count(*) FROM children
UNION ALL SELECT 'users', count(*) FROM users;
