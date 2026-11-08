-- Blok C: status akun, organisasi, dan cabang pengguna.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktif';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('aktif', 'menunggu_persetujuan', 'nonaktif'));

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

COMMIT;

SELECT status, count(*) FROM users GROUP BY status;
