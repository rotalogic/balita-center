-- Izinkan peran 'murid' pada kolom users.role (CHECK constraint dari seed awal).
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY[
  'super_admin', 'owner', 'branch_manager', 'kepala_sekolah', 'koordinator_akademik',
  'guru', 'staf_keuangan', 'staf_hr', 'admin_cabang', 'staf', 'orang_tua', 'investor',
  'kandidat', 'murid'
]::text[]));

COMMIT;

SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE contype='c' AND conrelid='users'::regclass AND conname='users_role_check';
