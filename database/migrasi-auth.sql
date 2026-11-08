-- Migrasi: reset kata sandi + 2FA (TOTP)
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS password_resets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_token_hash_idx ON password_resets (token_hash);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

COMMIT;

SELECT column_name FROM information_schema.columns
 WHERE table_name='users' AND column_name LIKE 'totp%';
SELECT 'password_resets ada' WHERE EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name='password_resets');
